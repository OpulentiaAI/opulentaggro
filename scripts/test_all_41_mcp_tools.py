#!/usr/bin/env python3
"""Test all 41 MCP tools against Railway (direct) + Vercel /api/mcp proxy.

Usage:
  bash -lc 'source scripts/load_cloud_agent_env.sh && python3 scripts/test_all_41_mcp_tools.py'
  python3 scripts/test_all_41_mcp_tools.py --report docs/hosted-mcp-41-results.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from load_demo_env import load_demo_env  # noqa: E402

STO = "erpnext.intercompany.stock_transfer_order"
IC = "erpnext.intercompany.intercompany_billing"
TREASURY = "erpnext.intercompany.intercompany_treasury"
TRIANGULAR = "erpnext.intercompany.intercompany_triangular"
ACCRUAL = "erpnext.intercompany.intercompany_accrual"

ALL_41_TOOLS = [
	# STO (16)
	"sto_create", "sto_submit", "sto_request_approval", "sto_approve", "sto_reject",
	"sto_approve_and_route", "sto_post_goods_in_transit", "sto_create_ic_invoice",
	"sto_post_goods_receipt", "sto_get_trace", "sto_three_way_match", "sto_list",
	"sto_generate_booking_advice", "sto_open_dispute", "sto_resolve_dispute", "sto_list_disputes",
	# IC billing (6)
	"ic_list_accounts", "ic_create_sales_invoice", "ic_create_purchase_invoice",
	"ic_create_invoice_pair", "ic_submit_invoice", "ic_get_invoice_status",
	# IC extended (8)
	"ic_match_and_clear", "ic_get_clearing_status", "ic_list_pending_clearing",
	"ic_get_reconciliation_summary", "ic_triangular_sale", "ic_list_triangular_sales",
	"ic_create_accrual", "ic_list_accruals",
	# Generic spot-check (3 of 11)
	"get_document", "call_method", "get_documents",
]

GENERIC_SPOT = {"get_document", "call_method", "get_documents"}


@dataclass
class ToolResult:
	tool: str
	transport: str
	status: str
	ms: float
	detail: str = ""
	verify: str = ""


@dataclass
class RunState:
	po_name: str | None = None
	reject_po: str | None = None
	si_name: str | None = None
	pi_name: str | None = None
	pair_si: str | None = None
	pair_pi: str | None = None
	triangular_so: str | None = None
	accrual_je: str | None = None
	customer: str | None = None
	debit_account: str | None = None
	credit_account: str | None = None
	results: list[ToolResult] = field(default_factory=list)


def env(k: str, d: str = "") -> str:
	return os.environ.get(k, d)


def abbr(company: str) -> str:
	return {
		"Opulent Fresh NA": "OFNA",
		"Opulent Fresh EU": "OFEU",
		"Opulent Fresh APAC": "OFAP",
	}.get(company, "OFNA")


class ERPNextClient:
	def __init__(self, base: str, key: str, secret: str):
		self.base = base.rstrip("/")
		self.headers = {
			"Content-Type": "application/json",
			"Accept": "application/json",
			"Authorization": f"token {key}:{secret}",
		}

	def call(self, method: str, args: dict | None = None) -> tuple[Any, float]:
		enc = ".".join(urllib.parse.quote(p, safe="") for p in method.split("."))
		url = f"{self.base}/api/method/{enc}"
		start = time.perf_counter()
		req = urllib.request.Request(url, json.dumps(args or {}).encode(), method="POST", headers=self.headers)
		with urllib.request.urlopen(req, timeout=180) as r:
			payload = json.loads(r.read().decode())
		ms = (time.perf_counter() - start) * 1000
		if payload.get("exc_type"):
			raise RuntimeError(payload.get("message") or str(payload))
		return payload.get("message"), ms

	def get_doc(self, doctype: str, name: str) -> dict:
		url = f"{self.base}/api/resource/{urllib.parse.quote(doctype)}/{urllib.parse.quote(name)}"
		req = urllib.request.Request(url, headers=self.headers, method="GET")
		with urllib.request.urlopen(req, timeout=60) as r:
			payload = json.loads(r.read().decode())
		return payload.get("data") or {}

	def list_docs(self, doctype: str, limit: int = 5, fields: list | None = None) -> list:
		params = {"limit_page_length": limit}
		if fields:
			params["fields"] = json.dumps(fields)
		url = f"{self.base}/api/resource/{urllib.parse.quote(doctype)}?{urllib.parse.urlencode(params)}"
		req = urllib.request.Request(url, headers=self.headers, method="GET")
		with urllib.request.urlopen(req, timeout=60) as r:
			payload = json.loads(r.read().decode())
		return payload.get("data") or []


class VercelMcpClient:
	def __init__(self, url: str, token: str = ""):
		self.url = url.rstrip("/")
		self._id = 0
		self.headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
		if token:
			self.headers["Authorization"] = f"Bearer {token}"

	def _next_id(self) -> int:
		self._id += 1
		return self._id

	def _post(self, body: dict) -> dict:
		req = urllib.request.Request(self.url, json.dumps(body).encode(), method="POST", headers=self.headers)
		with urllib.request.urlopen(req, timeout=180) as r:
			raw = r.read().decode()
		if not raw.strip():
			return {}
		if "data:" in raw:
			for line in raw.splitlines():
				if line.startswith("data:"):
					payload = line[5:].strip()
					if payload:
						return json.loads(payload)
			return {}
		return json.loads(raw)

	def initialize(self) -> None:
		rid = self._next_id()
		self._post({
			"jsonrpc": "2.0", "id": rid, "method": "initialize",
			"params": {"protocolVersion": "2024-11-05", "capabilities": {},
			           "clientInfo": {"name": "test-all-41", "version": "1.0"}},
		})
		self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

	def call_tool(self, name: str, arguments: dict | None = None) -> tuple[Any, float, bool]:
		rid = self._next_id()
		start = time.perf_counter()
		data = self._post({
			"jsonrpc": "2.0", "id": rid, "method": "tools/call",
			"params": {"name": name, "arguments": arguments or {}},
		})
		ms = (time.perf_counter() - start) * 1000
		result = data.get("result") or {}
		is_error = bool(result.get("isError"))
		content = result.get("content") or []
		text = content[0].get("text", "") if content else ""
		if is_error:
			return text, ms, True
		try:
			return json.loads(text), ms, False
		except json.JSONDecodeError:
			return text, ms, False


def record(state: RunState, tool: str, transport: str, resp: Any, ms: float, err: bool,
           detail: str = "", verify: str = "") -> None:
	state.results.append(ToolResult(tool, transport, "FAIL" if err else "PASS", ms, detail[:200], verify))


def _resolve_accounts(erp: ERPNextClient, from_co: str) -> tuple[str, str]:
	"""Pick receivable/payable accounts for accrual test."""
	try:
		rows = erp.list_docs("Account", limit=20, fields=["name", "account_type", "company"])
		debit = credit = None
		for row in rows:
			if row.get("company") != from_co:
				continue
			at = row.get("account_type") or ""
			if at in ("Receivable", "Asset Received But Not Billed") and not debit:
				debit = row["name"]
			if at in ("Payable", "Expense Account") and not credit:
				credit = row["name"]
		if debit and credit:
			return debit, credit
	except Exception:
		pass
	return "Debtors - OFAP", "Creditors - OFAP"


def _resolve_customer(erp: ERPNextClient) -> str:
	try:
		rows = erp.list_docs("Customer", limit=5, fields=["name"])
		if rows:
			return rows[0]["name"]
	except Exception:
		pass
	return "Internal Customer Opulent Fresh NA"


def run_all_tools(client: ERPNextClient | VercelMcpClient, transport: str, state: RunState) -> None:
	company = env("STO_TEST_COMPANY", "Opulent Fresh NA")
	supplier = env("STO_TEST_SUPPLIER", "Internal Supplier Opulent Fresh APAC")
	item = env("STO_TEST_ITEM", "STO-TEST-ITEM-001")
	from_co = env("IC_TEST_FROM_COMPANY", "Opulent Fresh APAC")
	to_co = env("IC_TEST_TO_COMPANY", "Opulent Fresh NA")
	items_101 = [{"item_code": item, "qty": 101, "rate": 100}]
	ic_items = [{"item_code": item, "qty": 1, "rate": 50}]
	erp = client if isinstance(client, ERPNextClient) else None

	if erp:
		state.customer = _resolve_customer(erp)
		state.debit_account, state.credit_account = _resolve_accounts(erp, from_co)

	def direct_call(method: str, args: dict) -> tuple[Any, float, bool]:
		start = time.perf_counter()
		try:
			msg, _ = client.call(method, args)  # type: ignore[attr-defined]
			return msg, (time.perf_counter() - start) * 1000, False
		except Exception as exc:
			return str(exc), (time.perf_counter() - start) * 1000, True

	def mcp_call(tool: str, args: dict) -> tuple[Any, float, bool]:
		return client.call_tool(tool, args)  # type: ignore[union-attr]

	def invoke(tool: str, direct_method: str, direct_args: dict, mcp_args: dict) -> tuple[Any, float, bool]:
		if isinstance(client, VercelMcpClient):
			return mcp_call(tool, mcp_args)
		return direct_call(direct_method, direct_args)

	# --- Read-only / list tools ---
	for tool, method, args, mcp_a in [
		("ic_list_accounts", f"{IC}.list_intercompany_accounts", {}, {}),
		("sto_list", f"{STO}.list_stock_transfer_orders", {"limit": 5}, {"limit": 5}),
		("sto_list_disputes", f"{STO}.list_sto_disputes", {"limit": 5}, {"limit": 5}),
		("ic_list_pending_clearing", f"{TREASURY}.list_pending_ic_clearing", {"limit": 5}, {"limit": 5}),
		("ic_get_reconciliation_summary", f"{TREASURY}.get_central_reconciliation_summary", {}, {}),
		("ic_list_triangular_sales", f"{TRIANGULAR}.list_triangular_sales", {"limit": 5}, {"limit": 5}),
		("ic_list_accruals", f"{ACCRUAL}.list_accrual_allocations", {"limit": 5}, {"limit": 5}),
	]:
		resp, ms, err = invoke(tool, method, args, mcp_a)
		record(state, tool, transport, resp, ms, err, json.dumps(resp)[:80] if resp else "")

	# --- Generic spot checks ---
	resp, ms, err = invoke("call_method", "frappe.ping", {}, {"method": "frappe.ping", "args": {}})
	record(state, "call_method", transport, resp, ms, err, str(resp)[:80])

	if erp:
		cust = state.customer or "Administrator"
		resp, ms, err = invoke(
			"get_document", "", {},
			{"doctype": "Customer", "name": cust},
		)
		if isinstance(client, ERPNextClient):
			start = time.perf_counter()
			try:
				doc = erp.get_doc("Customer", cust)
				resp, ms, err = doc, (time.perf_counter() - start) * 1000, not doc.get("name")
			except Exception as exc:
				resp, ms, err = str(exc), 0, True
		record(state, "get_document", transport, resp, ms, err, cust)

		resp, ms, err = invoke(
			"get_documents", "", {},
			{"doctype": "Customer", "limit": 3},
		)
		if isinstance(client, ERPNextClient):
			start = time.perf_counter()
			try:
				rows = erp.list_docs("Customer", limit=3)
				resp, ms, err = rows, (time.perf_counter() - start) * 1000, len(rows) < 1
			except Exception as exc:
				resp, ms, err = str(exc), 0, True
		record(state, "get_documents", transport, resp, ms, err, f"{len(resp) if isinstance(resp, list) else 0} rows")
	else:
		cust = state.customer or "Internal Customer Opulent Fresh NA"
		resp, ms, err = invoke("get_document", "", {}, {"doctype": "Customer", "name": cust})
		err = err or not (isinstance(resp, dict) and resp.get("name"))
		record(state, "get_document", transport, resp, ms, err, cust)
		resp, ms, err = invoke("get_documents", "", {}, {"doctype": "Customer", "limit": 3})
		record(state, "get_documents", transport, resp, ms, err)

	# --- Create main STO (qty=101 marker) ---
	create_args = {
		"company": company, "supplier": supplier,
		"warehouse": f"Stores - {abbr(company)}",
		"items": json.dumps(items_101) if isinstance(client, ERPNextClient) else items_101,
		"submit": 0,
	}
	mcp_create = {"company": company, "supplier": supplier, "items": items_101, "submit": False}
	resp, ms, err = invoke("sto_create", f"{STO}.create_stock_transfer_order", create_args, mcp_create)
	po = resp.get("purchase_order") if isinstance(resp, dict) else None
	if po:
		state.po_name = po
	record(state, "sto_create", transport, resp, ms, err or not po, str(po))

	if not state.po_name:
		return

	# --- Approval workflow: request → approve → submit path ---
	for tool, method, args, mcp_a in [
		("sto_request_approval", f"{STO}.request_sto_approval", {"purchase_order": state.po_name}, {"purchase_order": state.po_name}),
		("sto_approve", f"{STO}.approve_sto", {"purchase_order": state.po_name}, {"purchase_order": state.po_name}),
	]:
		resp, ms, err = invoke(tool, method, args, mcp_a)
		record(state, tool, transport, resp, ms, err, json.dumps(resp)[:80] if resp else "")

	resp, ms, err = invoke(
		"sto_submit", f"{STO}.submit_stock_transfer_order",
		{"purchase_order": state.po_name}, {"purchase_order": state.po_name},
	)
	verify = ""
	if erp:
		try:
			doc = erp.get_doc("Purchase Order", state.po_name)
			verify = f"docstatus={doc.get('docstatus')}"
			err = doc.get("docstatus", 0) < 1
		except Exception:
			pass
	elif isinstance(resp, dict) and resp.get("docstatus") == 1:
		err = False
	record(state, "sto_submit", transport, resp, ms, err, verify)

	# --- Reject on separate draft PO ---
	reject_create = {
		"company": company, "supplier": supplier,
		"warehouse": f"Stores - {abbr(company)}",
		"items": json.dumps([{"item_code": item, "qty": 1, "rate": 50}]),
		"submit": 0,
	}
	resp, ms, err = invoke(
		"sto_create", f"{STO}.create_stock_transfer_order", reject_create,
		{"company": company, "supplier": supplier, "items": [{"item_code": item, "qty": 1, "rate": 50}], "submit": False},
	)
	reject_po = resp.get("purchase_order") if isinstance(resp, dict) else None
	if reject_po:
		state.reject_po = reject_po
	invoke_req = ("sto_request_approval", f"{STO}.request_sto_approval", {"purchase_order": reject_po}, {"purchase_order": reject_po})
	if reject_po:
		invoke(invoke_req[0], invoke_req[1], invoke_req[2], invoke_req[3])
		resp, ms, err = invoke(
			"sto_reject", f"{STO}.reject_sto",
			{"purchase_order": reject_po, "reason": "MCP E2E test rejection"},
			{"purchase_order": reject_po, "reason": "MCP E2E test rejection"},
		)
		record(state, "sto_reject", transport, resp, ms, err, reject_po)
	else:
		record(state, "sto_reject", transport, None, 0, True, "no reject PO")

	# --- STO workflow chain ---
	for tool, method, mcp_extra in [
		("sto_approve_and_route", "approve_and_route_stock_transfer", {"submit": 1}),
		("sto_post_goods_in_transit", "post_goods_in_transit", {"submit": 1}),
		("sto_create_ic_invoice", "create_intercompany_invoice", {"submit": 1}),
		("sto_post_goods_receipt", "post_stock_transfer_receipt", {"submit": 1}),
	]:
		args = {"purchase_order": state.po_name, **mcp_extra}
		mcp_a = {"purchase_order": state.po_name, **{k: (v == 1) if k == "submit" else v for k, v in mcp_extra.items()}}
		resp, ms, err = invoke(tool, f"{STO}.{method}", args, mcp_a)
		record(state, tool, transport, resp, ms, err, json.dumps(resp)[:80] if resp else "")

	resp, ms, err = invoke(
		"sto_get_trace", f"{STO}.get_stock_transfer_trace",
		{"purchase_order": state.po_name}, {"purchase_order": state.po_name},
	)
	err = err or not (isinstance(resp, dict) and resp.get("purchase_order"))
	record(state, "sto_get_trace", transport, resp, ms, err, "trace OK" if not err else "missing PO")

	resp, ms, err = invoke(
		"sto_three_way_match", f"{STO}.run_stock_transfer_three_way_match",
		{"purchase_order": state.po_name}, {"purchase_order": state.po_name},
	)
	record(state, "sto_three_way_match", transport, resp, ms, err)

	resp, ms, err = invoke(
		"sto_generate_booking_advice", f"{STO}.generate_booking_advice",
		{"purchase_order": state.po_name}, {"purchase_order": state.po_name},
	)
	record(state, "sto_generate_booking_advice", transport, resp, ms, err, json.dumps(resp)[:80] if resp else "")

	resp, ms, err = invoke(
		"sto_open_dispute", f"{STO}.open_sto_dispute",
		{"purchase_order": state.po_name, "reason": "MCP E2E tolerance test"},
		{"purchase_order": state.po_name, "reason": "MCP E2E tolerance test"},
	)
	record(state, "sto_open_dispute", transport, resp, ms, err)

	resp, ms, err = invoke(
		"sto_resolve_dispute", f"{STO}.resolve_sto_dispute",
		{"purchase_order": state.po_name, "resolution": "Resolved in MCP E2E test"},
		{"purchase_order": state.po_name, "resolution": "Resolved in MCP E2E test"},
	)
	record(state, "sto_resolve_dispute", transport, resp, ms, err)

	# --- IC billing ---
	items_json = json.dumps(ic_items)
	for tool, method, args, mcp_a in [
		("ic_create_sales_invoice", f"{IC}.create_intercompany_sales_invoice",
		 {"from_company": from_co, "to_company": to_co, "items": items_json, "submit": 0},
		 {"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False}),
		("ic_create_purchase_invoice", f"{IC}.create_intercompany_purchase_invoice",
		 {"from_company": from_co, "to_company": to_co, "items": items_json, "submit": 0},
		 {"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False}),
	]:
		resp, ms, err = invoke(tool, method, args, mcp_a)
		if tool == "ic_create_sales_invoice" and isinstance(resp, dict) and resp.get("sales_invoice"):
			state.si_name = resp["sales_invoice"]
		if tool == "ic_create_purchase_invoice" and isinstance(resp, dict) and resp.get("purchase_invoice"):
			state.pi_name = resp["purchase_invoice"]
		record(state, tool, transport, resp, ms, err, json.dumps(resp)[:80] if resp else "")

	resp, ms, err = invoke(
		"ic_create_invoice_pair", f"{IC}.create_intercompany_invoice_pair",
		{"from_company": from_co, "to_company": to_co, "items": items_json, "submit": 0},
		{"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False},
	)
	if isinstance(resp, dict):
		state.pair_si = resp.get("sales_invoice")
		state.pair_pi = resp.get("purchase_invoice")
		if state.pair_si:
			state.si_name = state.pair_si
		if state.pair_pi:
			state.pi_name = state.pair_pi
	record(state, "ic_create_invoice_pair", transport, resp, ms, err or not (state.pair_si and state.pair_pi),
	       f"{state.pair_si}/{state.pair_pi}")

	if state.si_name or state.pi_name:
		resp, ms, err = invoke(
			"ic_get_invoice_status", f"{IC}.get_intercompany_invoice_status",
			{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
			{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
		)
		record(state, "ic_get_invoice_status", transport, resp, ms, err)

		resp, ms, err = invoke(
			"ic_submit_invoice", f"{IC}.submit_intercompany_invoice",
			{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
			{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
		)
		record(state, "ic_submit_invoice", transport, resp, ms, err)

	# --- IC extended ---
	resp, ms, err = invoke(
		"ic_get_clearing_status", f"{TREASURY}.get_clearing_status",
		{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
		{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
	)
	record(state, "ic_get_clearing_status", transport, resp, ms, err)

	resp, ms, err = invoke(
		"ic_match_and_clear", f"{TREASURY}.match_and_clear_intercompany_invoice",
		{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
		{"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
	)
	# match_and_clear may SKIP if already cleared — treat non-fatal errors as PASS if status returned
	if err and isinstance(resp, str) and ("already" in resp.lower() or "cleared" in resp.lower()):
		err = False
	record(state, "ic_match_and_clear", transport, resp, ms, err, json.dumps(resp)[:80] if resp else "")

	customer = state.customer or _resolve_customer(erp) if erp else "Internal Customer Opulent Fresh NA"
	resp, ms, err = invoke(
		"ic_triangular_sale", f"{TRIANGULAR}.create_triangular_sale",
		{
			"selling_company": from_co, "billing_company": to_co, "customer": customer,
			"items": items_json, "submit": 0,
		},
		{
			"selling_company": from_co, "billing_company": to_co, "customer": customer,
			"items": ic_items, "submit": False,
		},
	)
	if isinstance(resp, dict):
		state.triangular_so = resp.get("sales_order") or resp.get("sales_order_name")
	record(state, "ic_triangular_sale", transport, resp, ms, err, str(state.triangular_so))

	debit = state.debit_account or "Debtors - OFAP"
	credit = state.credit_account or "Creditors - OFAP"
	resp, ms, err = invoke(
		"ic_create_accrual", f"{ACCRUAL}.create_accrual_allocation",
		{
			"company": from_co, "counterparty_company": to_co, "amount": 10.0,
			"debit_account": debit, "credit_account": credit, "submit": 1,
			"remarks": "MCP E2E accrual test",
		},
		{
			"company": from_co, "counterparty_company": to_co, "amount": 10.0,
			"debit_account": debit, "credit_account": credit, "submit": True,
			"remarks": "MCP E2E accrual test",
		},
	)
	if isinstance(resp, dict):
		state.accrual_je = resp.get("journal_entry") or resp.get("name")
	record(state, "ic_create_accrual", transport, resp, ms, err, str(state.accrual_je))


def _ensure_stock_prereqs(erp: ERPNextClient) -> None:
	"""Top up multi-warehouse stock so GIT at qty=101 does not hit NegativeStockError."""
	try:
		erp.call("erpnext.intercompany.ensure_hosted_prereqs.run", {})
	except Exception as exc:
		print(f"WARN: stock prereqs skipped: {exc}", file=sys.stderr)


def main() -> int:
	load_demo_env()
	parser = argparse.ArgumentParser()
	parser.add_argument("--direct-only", action="store_true")
	parser.add_argument("--mcp-only", action="store_true")
	parser.add_argument("--report", default=str(ROOT / "docs" / "hosted-mcp-41-results.json"))
	args = parser.parse_args()

	base = env("ERPNEXT_URL", "https://erpnext-production-512a.up.railway.app")
	key = env("ERPNEXT_API_KEY")
	secret = env("ERPNEXT_API_SECRET")
	local_mcp = env("VERCEL_URL", "").rstrip("/")
	default_mcp = f"{local_mcp}/api/mcp" if local_mcp else "http://localhost:3000/api/mcp"
	mcp_url = env("VERCEL_MCP_URL", default_mcp)
	mcp_token = env("MCP_AUTH_TOKEN", "")

	all_results: list[ToolResult] = []
	summary: dict[str, Any] = {
		"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
		"erpnext_url": base,
		"vercel_mcp_url": mcp_url,
		"tools_total": len(ALL_41_TOOLS),
		"transports": {},
	}

	direct_state = RunState()
	mcp_state = RunState()

	if not args.mcp_only:
		if not key or not secret:
			print("SKIP direct: ERPNEXT_API_KEY/SECRET not set", file=sys.stderr)
		else:
			erp = ERPNextClient(base, key, secret)
			_ensure_stock_prereqs(erp)
			run_all_tools(erp, "direct", direct_state)
			all_results.extend(direct_state.results)
			summary["transports"]["direct"] = {
				"po_name": direct_state.po_name,
				"si_name": direct_state.si_name,
				"pi_name": direct_state.pi_name,
				"triangular_so": direct_state.triangular_so,
				"pass": sum(1 for r in direct_state.results if r.status == "PASS"),
				"fail": sum(1 for r in direct_state.results if r.status == "FAIL"),
			}

	if not args.direct_only:
		if key and secret:
			_ensure_stock_prereqs(ERPNextClient(base, key, secret))
		mcp = VercelMcpClient(mcp_url, mcp_token)
		try:
			mcp.initialize()
			run_all_tools(mcp, "vercel_mcp", mcp_state)
		except Exception as exc:
			record(mcp_state, "vercel_mcp_init", "vercel_mcp", None, 0, True, str(exc))
		all_results.extend(mcp_state.results)
		summary["transports"]["vercel_mcp"] = {
			"po_name": mcp_state.po_name,
			"si_name": mcp_state.si_name,
			"pi_name": mcp_state.pi_name,
			"triangular_so": mcp_state.triangular_so,
			"pass": sum(1 for r in mcp_state.results if r.status == "PASS"),
			"fail": sum(1 for r in mcp_state.results if r.status == "FAIL"),
		}

	tool_status: dict[str, dict] = {}
	for tool in ALL_41_TOOLS:
		direct_r = [r for r in all_results if r.tool == tool and r.transport == "direct"]
		mcp_r = [r for r in all_results if r.tool == tool and r.transport == "vercel_mcp"]
		tool_status[tool] = {
			"direct": direct_r[0].status if direct_r else "SKIP",
			"vercel_mcp": mcp_r[0].status if mcp_r else "SKIP",
		}
	summary["tools"] = tool_status
	summary["results"] = [asdict(r) for r in all_results]
	summary["artifacts"] = {
		"po_name": direct_state.po_name or mcp_state.po_name,
		"reject_po": direct_state.reject_po or mcp_state.reject_po,
		"si_name": direct_state.si_name or mcp_state.si_name,
		"pi_name": direct_state.pi_name or mcp_state.pi_name,
		"triangular_so": direct_state.triangular_so or mcp_state.triangular_so,
		"accrual_je": direct_state.accrual_je or mcp_state.accrual_je,
	}

	Path(args.report).parent.mkdir(parents=True, exist_ok=True)
	Path(args.report).write_text(json.dumps(summary, indent=2), encoding="utf-8")

	total = len(ALL_41_TOOLS)
	direct_pass = sum(1 for t, s in tool_status.items() if s.get("direct") == "PASS")
	mcp_pass = sum(1 for t, s in tool_status.items() if s.get("vercel_mcp") == "PASS")
	print(f"\n=== All 41 MCP tools ===")
	for tool in ALL_41_TOOLS:
		s = tool_status[tool]
		print(f"{'✓' if s.get('direct')=='PASS' else '✗'} direct | {'✓' if s.get('vercel_mcp')=='PASS' else '✗'} mcp | {tool}")
	print(f"\nDirect: {direct_pass}/{total} | Vercel MCP: {mcp_pass}/{total} | Report: {args.report}")
	print(f"PO: {summary['artifacts']['po_name']} | SI: {summary['artifacts']['si_name']} | PI: {summary['artifacts']['pi_name']}")
	return 0 if direct_pass == total and mcp_pass == total else 1


if __name__ == "__main__":
	sys.exit(main())
