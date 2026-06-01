#!/usr/bin/env python3
"""Verify ERPNext alterations via MCP-equivalent whitelisted API calls.

Each step creates or mutates documents, then verifies via follow-up API/REST.

Environment: ERPNEXT_URL, ERPNEXT_NO_AUTH=1 (localhost dev login).

Usage:
  ERPNEXT_NO_AUTH=1 python3 scripts/test_mcp_alterations.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import http.cookiejar
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from load_demo_env import load_demo_env  # noqa: E402

STO = "erpnext.intercompany.stock_transfer_order"
IC = "erpnext.intercompany.intercompany_billing"


@dataclass
class Step:
	name: str
	status: str
	verify: str
	detail: str = ""


def env(k: str, d: str = "") -> str:
	return os.environ.get(k, d)


def localhost_ok(url: str) -> bool:
	h = urllib.parse.urlparse(url).hostname or ""
	return h.lower() in ("localhost", "127.0.0.1", "::1")


class Client:
	def __init__(self, base: str):
		self.base = base.rstrip("/")
		self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
		self.headers = {"Content-Type": "application/json", "Accept": "application/json"}
		if env("ERPNEXT_NO_AUTH") in ("1", "true", "True"):
			if not localhost_ok(base):
				raise SystemExit("ERPNEXT_NO_AUTH requires localhost")
			pwd = env("ERPNEXT_DEV_PASSWORD") or env("FRAPPE_ADMIN_PASSWORD") or env("DEMO_ADMIN_PASSWORD")
			if not pwd:
				raise SystemExit("Missing desk password — set in config/demo-credentials.env")
			self._post(
				"login",
				{"usr": env("ERPNEXT_DEV_USER") or env("DEMO_ADMIN_USER", "Administrator"), "pwd": pwd},
				auth=False,
			)
		elif env("ERPNEXT_API_KEY") and env("ERPNEXT_API_SECRET"):
			self.headers["Authorization"] = f"token {env('ERPNEXT_API_KEY')}:{env('ERPNEXT_API_SECRET')}"

	def _post(self, method: str, args: dict | None = None, auth: bool = True) -> Any:
		if method == "login":
			url = f"{self.base}/api/method/login"
		else:
			enc = ".".join(urllib.parse.quote(p, safe="") for p in method.split("."))
			url = f"{self.base}/api/method/{enc}"
		req = urllib.request.Request(url, json.dumps(args or {}).encode(), method="POST", headers=self.headers)
		with self.opener.open(req, timeout=120) as r:
			payload = json.loads(r.read().decode())
		if payload.get("exc_type"):
			raise RuntimeError(payload.get("message") or str(payload))
		return payload.get("message")

	def method(self, dotted: str, args: dict | None = None) -> Any:
		return self._post(dotted, args)

	def get_doc(self, doctype: str, name: str) -> dict:
		q = urllib.parse.urlencode({"doctype": doctype, "name": name})
		url = f"{self.base}/api/resource/{urllib.parse.quote(doctype)}/{urllib.parse.quote(name)}"
		req = urllib.request.Request(url, headers=self.headers, method="GET")
		with self.opener.open(req, timeout=60) as r:
			payload = json.loads(r.read().decode())
		return payload.get("data") or {}


def abbr(company: str) -> str:
	return {"Opulent Fresh NA": "OFNA", "Opulent Fresh EU": "OFEU"}.get(company, "OFNA")


def main() -> int:
	load_demo_env()
	base = env("ERPNEXT_URL", "http://localhost:8000")
	company = env("STO_TEST_COMPANY", "Opulent Fresh NA")
	supplier = env("STO_TEST_SUPPLIER", "Internal Supplier Opulent Fresh EU")
	item = env("STO_TEST_ITEM", "STO-TEST-ITEM-001")
	from_co = env("IC_TEST_FROM_COMPANY", "Opulent Fresh EU")
	to_co = env("IC_TEST_TO_COMPANY", "Opulent Fresh NA")
	client = Client(base)
	steps: list[Step] = []

	# Baseline IC accounts
	try:
		pairs = client.method(f"{IC}.list_intercompany_accounts", {})
		ok = isinstance(pairs, list) and len(pairs) >= 1
		steps.append(Step("ic_list_accounts", "PASS" if ok else "FAIL", f"{len(pairs) if isinstance(pairs, list) else 0} pairs"))
	except Exception as e:
		steps.append(Step("ic_list_accounts", "FAIL", str(e)))

	list_before = client.method(f"{STO}.list_stock_transfer_orders", {"limit": 50})
	n0 = len(list_before) if isinstance(list_before, list) else 0

	created = client.method(
		f"{STO}.create_stock_transfer_order",
		{
			"company": company,
			"supplier": supplier,
			"warehouse": f"Stores - {abbr(company)}",
			"items": json.dumps([{"item_code": item, "qty": 1, "rate": 75}]),
			"submit": 0,
		},
	)
	po = created.get("purchase_order") if isinstance(created, dict) else None
	list_after = client.method(f"{STO}.list_stock_transfer_orders", {"limit": 50})
	n1 = len(list_after) if isinstance(list_after, list) else 0
	po_doc = client.get_doc("Purchase Order", po) if po else {}
	steps.append(
		Step(
			"sto_create → sto_list/REST",
			"PASS" if po and n1 >= n0 and po_doc.get("name") == po else "FAIL",
			f"PO={po} list {n0}→{n1} docstatus={po_doc.get('docstatus')}",
		)
	)
	if not po:
		_report(steps)
		return 1

	submitted = client.method(f"{STO}.submit_stock_transfer_order", {"purchase_order": po})
	ds = submitted.get("docstatus") if isinstance(submitted, dict) else None
	po_doc2 = client.get_doc("Purchase Order", po)
	steps.append(
		Step(
			"sto_submit → REST docstatus",
			"PASS" if ds == 1 and po_doc2.get("docstatus") == 1 else "FAIL",
			f"api docstatus={ds} rest={po_doc2.get('docstatus')}",
		)
	)

	routed = client.method(f"{STO}.approve_and_route_stock_transfer", {"purchase_order": po, "submit": 1})
	so = routed.get("sales_order") if isinstance(routed, dict) else None
	trace = client.method(f"{STO}.get_stock_transfer_trace", {"purchase_order": po})
	so_in_trace = None
	if isinstance(trace, dict):
		doc = trace.get("documents", {}).get("sales_order")
		so_in_trace = doc.get("name") if isinstance(doc, dict) else doc
	has_so = so_in_trace == so
	steps.append(
		Step(
			"sto_approve_and_route → sto_get_trace",
			"PASS" if so and has_so else "FAIL",
			f"SO={so}",
		)
	)

	items_json = json.dumps([{"item_code": item, "qty": 1, "rate": 40}])
	pair = client.method(
		f"{IC}.create_intercompany_invoice_pair",
		{"from_company": from_co, "to_company": to_co, "items": items_json, "submit": 0},
	)
	si = pair.get("sales_invoice") if isinstance(pair, dict) else None
	pi = pair.get("purchase_invoice") if isinstance(pair, dict) else None
	status = client.method(f"{IC}.get_intercompany_invoice_status", {"sales_invoice": si, "purchase_invoice": pi})
	si_doc = client.get_doc("Sales Invoice", si) if si else {}
	pi_doc = client.get_doc("Purchase Invoice", pi) if pi else {}
	ok_ic = si and pi and isinstance(status, dict) and si_doc.get("name") == si and pi_doc.get("name") == pi
	steps.append(
		Step(
			"ic_create_invoice_pair → ic_get_invoice_status/REST",
			"PASS" if ok_ic else "FAIL",
			f"{si}/{pi} draft si_ds={si_doc.get('docstatus')} pi_ds={pi_doc.get('docstatus')}",
		)
	)

	return _report(steps)


def _report(steps: list[Step]) -> int:
	print("\n=== MCP alteration verification ===")
	fails = 0
	for s in steps:
		icon = "✓" if s.status == "PASS" else "✗"
		print(f"{icon} {s.name}: {s.status} — {s.verify} | {s.detail[:100]}")
		if s.status != "PASS":
			fails += 1
	print(f"\nSteps: {len(steps)} | FAIL: {fails}")
	return 1 if fails else 0


if __name__ == "__main__":
	sys.exit(main())
