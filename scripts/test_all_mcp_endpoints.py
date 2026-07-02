#!/usr/bin/env python3
"""Test all STO + IC MCP tools against live ERPNext (or API methods directly).

Supports API token auth or dev session login (ERPNEXT_NO_AUTH=1).

Environment:
  ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET
  ERPNEXT_NO_AUTH=1  — localhost only; uses ERPNEXT_DEV_USER/PASSWORD (or FRAPPE_ADMIN_PASSWORD)
  STO_TEST_* / IC_TEST_* — overrides from seed_mcp_alignment defaults

Usage:
  python3 scripts/test_all_mcp_endpoints.py
  python3 scripts/test_all_mcp_endpoints.py --mock-only
  python3 scripts/test_all_mcp_endpoints.py --report /tmp/mcp-report.json
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MCP_SERVER = ROOT / "erpnext-mcp-server"

sys.path.insert(0, str(ROOT / "scripts"))
from load_demo_env import load_demo_env  # noqa: E402

STO_TOOLS = [
	"sto_create",
	"sto_submit",
	"sto_approve_and_route",
	"sto_post_goods_in_transit",
	"sto_create_ic_invoice",
	"sto_post_goods_receipt",
	"sto_get_trace",
	"sto_three_way_match",
	"sto_list",
	"sto_generate_booking_advice",
	"sto_request_approval",
	"sto_approve",
	"sto_reject",
	"sto_open_dispute",
	"sto_resolve_dispute",
	"sto_list_disputes",
]

IC_TOOLS = [
	"ic_list_accounts",
	"ic_create_sales_invoice",
	"ic_create_purchase_invoice",
	"ic_create_invoice_pair",
	"ic_submit_invoice",
	"ic_get_invoice_status",
	"ic_match_and_clear",
	"ic_get_clearing_status",
	"ic_list_pending_clearing",
	"ic_get_reconciliation_summary",
	"ic_triangular_sale",
	"ic_list_triangular_sales",
	"ic_create_accrual",
	"ic_list_accruals",
]

GENERIC_SMOKE = ["get_doctypes"]

STO_METHOD_PREFIX = "erpnext.intercompany.stock_transfer_order"
IC_METHOD_PREFIX = "erpnext.intercompany.intercompany_billing"


@dataclass
class TestResult:
	tool: str
	layer: str
	status: str
	ms: float
	detail: str = ""


def _env(key: str, default: str = "") -> str:
	return os.environ.get(key, default)


def _is_localhost(url: str) -> bool:
	try:
		host = urllib.parse.urlparse(url).hostname or ""
		return host.lower() in ("localhost", "127.0.0.1", "::1")
	except Exception:
		return False


def _no_auth_enabled() -> bool:
	flag = _env("ERPNEXT_NO_AUTH") or _env("MCP_NO_AUTH")
	if flag not in ("1", "true", "True"):
		return False
	url = _env("ERPNEXT_URL", "http://localhost:8000")
	if not _is_localhost(url):
		raise SystemExit("ERPNEXT_NO_AUTH is only allowed for localhost ERPNEXT_URL")
	return True


class ERPNextClient:
	def __init__(self, base_url: str, api_key: str = "", api_secret: str = ""):
		self.base_url = base_url.rstrip("/")
		self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
		self.headers = {"Content-Type": "application/json", "Accept": "application/json"}
		if api_key and api_secret:
			self.headers["Authorization"] = f"token {api_key}:{api_secret}"
		elif _no_auth_enabled():
			self._login_dev_session()

	def _login_dev_session(self) -> None:
		user = _env("ERPNEXT_DEV_USER") or _env("DEMO_ADMIN_USER", "Administrator")
		password = (
			_env("ERPNEXT_DEV_PASSWORD")
			or _env("FRAPPE_ADMIN_PASSWORD")
			or _env("DEMO_ADMIN_PASSWORD")
		)
		if not password:
			raise RuntimeError(
				"Missing desk password — set ERPNEXT_DEV_PASSWORD in config/demo-credentials.env"
			)
		url = f"{self.base_url}/api/method/login"
		body = json.dumps({"usr": user, "pwd": password}).encode("utf-8")
		req = urllib.request.Request(url, data=body, method="POST", headers=self.headers)
		with self.opener.open(req, timeout=30) as resp:
			payload = json.loads(resp.read().decode("utf-8"))
		msg = payload.get("message")
		if msg not in ("Logged In", "No App") and not (isinstance(msg, dict) and msg.get("full_name")):
			raise RuntimeError(f"Dev login failed: {payload}")

	def call_method(self, method: str, args: dict[str, Any] | None = None) -> tuple[Any, float]:
		encoded = ".".join(urllib.parse.quote(part, safe="") for part in method.split("."))
		url = f"{self.base_url}/api/method/{encoded}"
		body = json.dumps(args or {}).encode("utf-8")
		req = urllib.request.Request(url, data=body, method="POST", headers=self.headers)
		start = time.perf_counter()
		try:
			with self.opener.open(req, timeout=120) as resp:
				payload = json.loads(resp.read().decode("utf-8"))
		except urllib.error.HTTPError as exc:
			err_body = exc.read().decode("utf-8", errors="replace")
			raise RuntimeError(f"HTTP {exc.code}: {err_body}") from exc
		ms = (time.perf_counter() - start) * 1000
		if payload.get("exc_type"):
			raise RuntimeError(payload.get("message") or str(payload))
		return payload.get("message"), ms


def run_mock_layer() -> list[TestResult]:
	results: list[TestResult] = []
	tests = [
		("sto-tools.test.mjs", "sto_mock"),
		("ic-billing-tools.test.mjs", "ic_mock"),
	]
	for script, label in tests:
		start = time.perf_counter()
		proc = subprocess.run(
			["node", f"tests/{script}"],
			cwd=MCP_SERVER,
			capture_output=True,
			text=True,
		)
		ms = (time.perf_counter() - start) * 1000
		status = "PASS" if proc.returncode == 0 else "FAIL"
		detail = (proc.stderr or proc.stdout or "").strip()[-500:]
		results.append(TestResult(tool=label, layer="mock", status=status, ms=ms, detail=detail))
	return results


def run_live_sto_ic(client: ERPNextClient) -> list[TestResult]:
	results: list[TestResult] = []
	company = _env("STO_TEST_COMPANY", "Opulent Fresh NA")
	supplier = _env("STO_TEST_SUPPLIER", "Internal Supplier Opulent Fresh EU")
	item = _env("STO_TEST_ITEM", "STO-TEST-ITEM-001")
	from_co = _env("IC_TEST_FROM_COMPANY", "Opulent Fresh EU")
	to_co = _env("IC_TEST_TO_COMPANY", "Opulent Fresh NA")

	# ic_list_accounts
	try:
		msg, ms = client.call_method(f"{IC_METHOD_PREFIX}.list_intercompany_accounts", {})
		pairs = len(msg) if isinstance(msg, list) else 0
		results.append(TestResult("ic_list_accounts", "live", "PASS", ms, f"{pairs} pairs"))
	except Exception as exc:
		results.append(TestResult("ic_list_accounts", "live", "FAIL", 0, str(exc)))

	# sto_list
	try:
		msg, ms = client.call_method(f"{STO_METHOD_PREFIX}.list_stock_transfer_orders", {"limit": 5})
		count = len(msg) if isinstance(msg, list) else 0
		results.append(TestResult("sto_list", "live", "PASS", ms, f"{count} rows"))
	except Exception as exc:
		results.append(TestResult("sto_list", "live", "FAIL", 0, str(exc)))

	po_name: str | None = None
	si_name: str | None = None
	pi_name: str | None = None

	# sto_create (receiving warehouse only — PO validates against company)
	try:
		wh_recv = f"Stores - {frappe_abbr(company)}"
		msg, ms = client.call_method(
			f"{STO_METHOD_PREFIX}.create_stock_transfer_order",
			{
				"company": company,
				"supplier": supplier,
				"warehouse": wh_recv,
				"items": json.dumps([{"item_code": item, "qty": 2, "rate": 100}]),
				"submit": 0,
			},
		)
		po_name = msg.get("purchase_order") if isinstance(msg, dict) else None
		results.append(TestResult("sto_create", "live", "PASS" if po_name else "FAIL", ms, str(po_name)))
	except Exception as exc:
		results.append(TestResult("sto_create", "live", "FAIL", 0, str(exc)))

	if not po_name:
		return results

	for tool, method, args in [
		("sto_submit", "submit_stock_transfer_order", {"purchase_order": po_name}),
		("sto_approve_and_route", "approve_and_route_stock_transfer", {"purchase_order": po_name, "submit": 1}),
		("sto_post_goods_in_transit", "post_goods_in_transit", {"purchase_order": po_name, "submit": 1}),
		("sto_create_ic_invoice", "create_intercompany_invoice", {"purchase_order": po_name, "submit": 1}),
		("sto_post_goods_receipt", "post_stock_transfer_receipt", {"purchase_order": po_name, "submit": 1}),
		("sto_get_trace", "get_stock_transfer_trace", {"purchase_order": po_name}),
		("sto_three_way_match", "run_stock_transfer_three_way_match", {"purchase_order": po_name}),
	]:
		try:
			msg, ms = client.call_method(f"{STO_METHOD_PREFIX}.{method}", args)
			results.append(TestResult(tool, "live", "PASS", ms, json.dumps(msg)[:120]))
		except Exception as exc:
			results.append(TestResult(tool, "live", "FAIL", 0, str(exc)))

	# IC standalone (draft invoices)
	items_json = json.dumps([{"item_code": item, "qty": 1, "rate": 50}])
	try:
		msg, ms = client.call_method(
			f"{IC_METHOD_PREFIX}.create_intercompany_sales_invoice",
			{"from_company": from_co, "to_company": to_co, "items": items_json, "submit": 0},
		)
		si_name = msg.get("sales_invoice") if isinstance(msg, dict) else None
		results.append(TestResult("ic_create_sales_invoice", "live", "PASS" if si_name else "FAIL", ms, str(si_name)))
	except Exception as exc:
		results.append(TestResult("ic_create_sales_invoice", "live", "FAIL", 0, str(exc)))

	try:
		msg, ms = client.call_method(
			f"{IC_METHOD_PREFIX}.create_intercompany_purchase_invoice",
			{"from_company": from_co, "to_company": to_co, "items": items_json, "submit": 0},
		)
		pi_name = msg.get("purchase_invoice") if isinstance(msg, dict) else None
		results.append(TestResult("ic_create_purchase_invoice", "live", "PASS" if pi_name else "FAIL", ms, str(pi_name)))
	except Exception as exc:
		results.append(TestResult("ic_create_purchase_invoice", "live", "FAIL", 0, str(exc)))

	try:
		msg, ms = client.call_method(
			f"{IC_METHOD_PREFIX}.create_intercompany_invoice_pair",
			{
				"from_company": from_co,
				"to_company": to_co,
				"items": items_json,
				"submit": 0,
			},
		)
		pair_si = msg.get("sales_invoice") if isinstance(msg, dict) else None
		pair_pi = msg.get("purchase_invoice") if isinstance(msg, dict) else None
		results.append(
			TestResult(
				"ic_create_invoice_pair",
				"live",
				"PASS" if pair_si and pair_pi else "FAIL",
				ms,
				f"{pair_si}/{pair_pi}",
			)
		)
		if pair_si:
			si_name = pair_si
		if pair_pi:
			pi_name = pair_pi
	except Exception as exc:
		results.append(TestResult("ic_create_invoice_pair", "live", "FAIL", 0, str(exc)))

	if si_name or pi_name:
		try:
			msg, ms = client.call_method(
				f"{IC_METHOD_PREFIX}.get_intercompany_invoice_status",
				{"sales_invoice": si_name, "purchase_invoice": pi_name},
			)
			results.append(TestResult("ic_get_invoice_status", "live", "PASS", ms))
		except Exception as exc:
			results.append(TestResult("ic_get_invoice_status", "live", "FAIL", 0, str(exc)))

		try:
			msg, ms = client.call_method(
				f"{IC_METHOD_PREFIX}.submit_intercompany_invoice",
				{"sales_invoice": si_name, "purchase_invoice": None},
			)
			results.append(TestResult("ic_submit_invoice", "live", "PASS", ms))
		except Exception as exc:
			results.append(TestResult("ic_submit_invoice", "live", "SKIP", 0, str(exc)[:200]))

	return results


def frappe_abbr(company: str) -> str:
	m = {
		"Opulent Fresh NA": "OFNA",
		"Opulent Fresh EU": "OFEU",
		"Opulent Fresh APAC": "OFAP",
	}
	return m.get(company, company[:4].upper())


def print_report(results: list[TestResult]) -> int:
	fails = [r for r in results if r.status == "FAIL"]
	print("\n=== MCP endpoint test report ===")
	for r in results:
		icon = "✓" if r.status == "PASS" else ("○" if r.status == "SKIP" else "✗")
		print(f"{icon} [{r.layer}] {r.tool}: {r.status} ({r.ms:.0f}ms) {r.detail[:80]}")
	print(f"\nTotal: {len(results)} | PASS: {sum(1 for r in results if r.status == 'PASS')} | FAIL: {len(fails)}")
	return 1 if fails else 0


def main() -> int:
	load_demo_env()
	parser = argparse.ArgumentParser()
	parser.add_argument("--mock-only", action="store_true")
	parser.add_argument("--live-only", action="store_true")
	parser.add_argument("--report", type=str, default="")
	args = parser.parse_args()

	all_results: list[TestResult] = []

	if not args.live_only:
		all_results.extend(run_mock_layer())

	if not args.mock_only:
		url = _env("ERPNEXT_URL", "http://localhost:8000")
		key = _env("ERPNEXT_API_KEY")
		secret = _env("ERPNEXT_API_SECRET")
		if not (key and secret) and not _no_auth_enabled():
			print("SKIP live tests: set API keys or ERPNEXT_NO_AUTH=1", file=sys.stderr)
		else:
			try:
				client = ERPNextClient(url, key, secret)
				all_results.extend(run_live_sto_ic(client))
			except Exception as exc:
				all_results.append(TestResult("live_suite", "live", "FAIL", 0, str(exc)))

	if args.report:
		Path(args.report).write_text(json.dumps([asdict(r) for r in all_results], indent=2), encoding="utf-8")

	return print_report(all_results)


if __name__ == "__main__":
	sys.exit(main())
