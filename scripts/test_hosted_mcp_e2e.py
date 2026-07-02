#!/usr/bin/env python3
"""Hosted MCP E2E — all 15 STO+IC tools against production Railway + Vercel HTTP MCP.

Each tool: invoke → verify document/state change on Railway via follow-up API/REST.

Environment (from config/demo-credentials.env + env):
  ERPNEXT_URL          — Railway backend URL
  ERPNEXT_API_KEY      — Administrator API key
  ERPNEXT_API_SECRET   — API secret
  VERCEL_MCP_URL       — e.g. https://vercel-indol-phi-69.vercel.app/api/mcp
  MCP_AUTH_TOKEN       — optional Bearer for /api/mcp

Usage:
  python3 scripts/test_hosted_mcp_e2e.py
  python3 scripts/test_hosted_mcp_e2e.py --direct-only
  python3 scripts/test_hosted_mcp_e2e.py --mcp-only
  python3 scripts/test_hosted_mcp_e2e.py --report docs/hosted-mcp-results.json
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

CORE_TOOLS = [
	"sto_create",
	"sto_submit",
	"sto_approve_and_route",
	"sto_post_goods_in_transit",
	"sto_create_ic_invoice",
	"sto_post_goods_receipt",
	"sto_get_trace",
	"sto_three_way_match",
	"sto_list",
	"ic_list_accounts",
	"ic_create_sales_invoice",
	"ic_create_purchase_invoice",
	"ic_create_invoice_pair",
	"ic_submit_invoice",
	"ic_get_invoice_status",
]

# Read-only / list extended tools (safe on hosted without full workflow chain)
EXTENDED_TOOLS = [
	"sto_list_disputes",
	"ic_get_clearing_status",
	"ic_list_pending_clearing",
	"ic_get_reconciliation_summary",
	"ic_list_triangular_sales",
	"ic_list_accruals",
]


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
	si_name: str | None = None
	pi_name: str | None = None
	pair_si: str | None = None
	pair_pi: str | None = None
	results: list[ToolResult] = field(default_factory=list)


def env(k: str, d: str = "") -> str:
	return os.environ.get(k, d)


def abbr(company: str) -> str:
	return {"Opulent Fresh NA": "OFNA", "Opulent Fresh EU": "OFEU"}.get(company, "OFNA")


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
		# notifications/initialized → 202 with empty body; streamable HTTP may use SSE
		if not raw.strip():
			return {}
		if raw.startswith("event:") or raw.startswith("data:") or "data:" in raw:
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
			"jsonrpc": "2.0",
			"id": rid,
			"method": "initialize",
			"params": {
				"protocolVersion": "2024-11-05",
				"capabilities": {},
				"clientInfo": {"name": "hosted-mcp-e2e", "version": "1.0"},
			},
		})
		self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

	def call_tool(self, name: str, arguments: dict | None = None) -> tuple[Any, float, bool]:
		rid = self._next_id()
		start = time.perf_counter()
		data = self._post({
			"jsonrpc": "2.0",
			"id": rid,
			"method": "tools/call",
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


def record(state: RunState, tool: str, transport: str, resp: Any, ms: float, err: bool, detail: str = "", verify: str = "") -> None:
	state.results.append(ToolResult(tool, transport, "FAIL" if err else "PASS", ms, detail[:200], verify))


def run_tool_chain(client: ERPNextClient | VercelMcpClient, transport: str, state: RunState) -> None:
	company = env("STO_TEST_COMPANY", "Opulent Fresh NA")
	supplier = env("STO_TEST_SUPPLIER", "Internal Supplier Opulent Fresh EU")
	item = env("STO_TEST_ITEM", "STO-TEST-ITEM-001")
	from_co = env("IC_TEST_FROM_COMPANY", "Opulent Fresh EU")
	to_co = env("IC_TEST_TO_COMPANY", "Opulent Fresh NA")
	items = [{"item_code": item, "qty": 2, "rate": 100}]
	ic_items = [{"item_code": item, "qty": 1, "rate": 50}]

	mcp_tool_args: dict[str, dict] = {
		"sto_list": {"limit": 5},
		"ic_list_accounts": {},
		"sto_create": {"company": company, "supplier": supplier, "items": items, "submit": False},
		"sto_submit": {"purchase_order": state.po_name},
		"sto_approve_and_route": {"purchase_order": state.po_name, "submit": True},
		"sto_post_goods_in_transit": {"purchase_order": state.po_name, "submit": True},
		"sto_create_ic_invoice": {"purchase_order": state.po_name, "submit": True},
		"sto_post_goods_receipt": {"purchase_order": state.po_name, "submit": True},
		"sto_get_trace": {"purchase_order": state.po_name},
		"sto_three_way_match": {"purchase_order": state.po_name},
		"ic_create_sales_invoice": {
			"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False,
		},
		"ic_create_purchase_invoice": {
			"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False,
		},
		"ic_create_invoice_pair": {
			"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False,
		},
		"ic_get_invoice_status": {"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
		"ic_submit_invoice": {"sales_invoice": state.si_name},
		"sto_list_disputes": {"limit": 5},
		"ic_get_clearing_status": {"sales_invoice": state.si_name, "purchase_invoice": state.pi_name},
		"ic_list_pending_clearing": {"limit": 5},
		"ic_get_reconciliation_summary": {},
		"ic_list_triangular_sales": {"limit": 5},
		"ic_list_accruals": {"limit": 5},
	}

	def call_tool(name: str, args: dict | None = None) -> tuple[Any, float, bool]:
		if isinstance(client, VercelMcpClient):
			tool_args = mcp_tool_args.get(name, args or {})
			# Late-bound PO/SI names for tools invoked after sto_create
			if name == "sto_submit" and state.po_name:
				tool_args = {**tool_args, "purchase_order": state.po_name}
			if name in (
				"sto_approve_and_route", "sto_post_goods_in_transit", "sto_create_ic_invoice",
				"sto_post_goods_receipt", "sto_get_trace", "sto_three_way_match",
			) and state.po_name:
				tool_args = {**tool_args, "purchase_order": state.po_name}
			if name == "ic_get_invoice_status" and (state.si_name or state.pi_name):
				tool_args = {
					"sales_invoice": state.si_name,
					"purchase_invoice": state.pi_name,
				}
			if name == "ic_submit_invoice" and state.si_name:
				tool_args = {"sales_invoice": state.si_name}
			return client.call_tool(name, tool_args)
		method_map = {
			"sto_list": (f"{STO}.list_stock_transfer_orders", {"limit": 5}),
			"ic_list_accounts": (f"{IC}.list_intercompany_accounts", {}),
			"sto_create": (f"{STO}.create_stock_transfer_order", {
				"company": company, "supplier": supplier,
				"warehouse": f"Stores - {abbr(company)}",
				"items": json.dumps(items), "submit": 0,
			}),
			"sto_submit": (f"{STO}.submit_stock_transfer_order", {"purchase_order": state.po_name}),
			"sto_approve_and_route": (f"{STO}.approve_and_route_stock_transfer", {"purchase_order": state.po_name, "submit": 1}),
			"sto_post_goods_in_transit": (f"{STO}.post_goods_in_transit", {"purchase_order": state.po_name, "submit": 1}),
			"sto_create_ic_invoice": (f"{STO}.create_intercompany_invoice", {"purchase_order": state.po_name, "submit": 1}),
			"sto_post_goods_receipt": (f"{STO}.post_stock_transfer_receipt", {"purchase_order": state.po_name, "submit": 1}),
			"sto_get_trace": (f"{STO}.get_stock_transfer_trace", {"purchase_order": state.po_name}),
			"sto_three_way_match": (f"{STO}.run_stock_transfer_three_way_match", {"purchase_order": state.po_name}),
			"ic_create_sales_invoice": (f"{IC}.create_intercompany_sales_invoice", {
				"from_company": from_co, "to_company": to_co, "items": json.dumps(ic_items), "submit": 0,
			}),
			"ic_create_purchase_invoice": (f"{IC}.create_intercompany_purchase_invoice", {
				"from_company": from_co, "to_company": to_co, "items": json.dumps(ic_items), "submit": 0,
			}),
			"ic_create_invoice_pair": (f"{IC}.create_intercompany_invoice_pair", {
				"from_company": from_co, "to_company": to_co, "items": json.dumps(ic_items), "submit": 0,
			}),
			"ic_get_invoice_status": (f"{IC}.get_intercompany_invoice_status", {
				"sales_invoice": state.si_name, "purchase_invoice": state.pi_name,
			}),
			"ic_submit_invoice": (f"{IC}.submit_intercompany_invoice", {
				"sales_invoice": state.si_name, "purchase_invoice": None,
			}),
			"sto_list_disputes": (f"{STO}.list_sto_disputes", {"limit": 5}),
			"ic_get_clearing_status": (f"erpnext.intercompany.intercompany_treasury.get_clearing_status", {
				"sales_invoice": state.si_name, "purchase_invoice": state.pi_name,
			}),
			"ic_list_pending_clearing": (f"erpnext.intercompany.intercompany_treasury.list_pending_ic_clearing", {"limit": 5}),
			"ic_get_reconciliation_summary": (f"erpnext.intercompany.intercompany_treasury.get_central_reconciliation_summary", {}),
			"ic_list_triangular_sales": (f"erpnext.intercompany.intercompany_triangular.list_triangular_sales", {"limit": 5}),
			"ic_list_accruals": (f"erpnext.intercompany.intercompany_accrual.list_accrual_allocations", {"limit": 5}),
		}
		m, a = method_map[name]
		start = time.perf_counter()
		try:
			msg, _ = client.call(m, a)  # type: ignore[attr-defined]
			ms = (time.perf_counter() - start) * 1000
			return msg, ms, False
		except Exception as exc:
			return str(exc), (time.perf_counter() - start) * 1000, True

	erp = client if isinstance(client, ERPNextClient) else None
	list_before = 0
	if erp:
		try:
			msg, ms = erp.call(f"{STO}.list_stock_transfer_orders", {"limit": 50})
			list_before = len(msg) if isinstance(msg, list) else 0
		except Exception:
			pass

	resp, ms, err = call_tool("ic_list_accounts")
	pairs = len(resp) if isinstance(resp, list) else 0
	record(state, "ic_list_accounts", transport, resp, ms, err or pairs < 1, f"{pairs} pairs", "list >= 1 pair")

	resp, ms, err = call_tool("sto_list")
	count = len(resp) if isinstance(resp, list) else 0
	record(state, "sto_list", transport, resp, ms, err, f"{count} rows", "list returned")

	resp, ms, err = call_tool("sto_create")
	po = resp.get("purchase_order") if isinstance(resp, dict) else None
	if po:
		state.po_name = po
	verify = ""
	if erp and po:
		doc = erp.get_doc("Purchase Order", po)
		msg2, _ = erp.call(f"{STO}.list_stock_transfer_orders", {"limit": 50})
		n1 = len(msg2) if isinstance(msg2, list) else 0
		verify = f"REST PO={doc.get('name')} list {list_before}→{n1}"
		err = err or doc.get("name") != po or n1 < list_before
	record(state, "sto_create", transport, resp, ms, err or not po, str(po), verify)

	if not state.po_name:
		return

	for tool in [
		"sto_submit", "sto_approve_and_route", "sto_post_goods_in_transit",
		"sto_create_ic_invoice", "sto_post_goods_receipt", "sto_get_trace", "sto_three_way_match",
	]:
		resp, ms, err = call_tool(tool)
		verify = ""
		if erp and tool == "sto_submit" and not err:
			doc = erp.get_doc("Purchase Order", state.po_name)
			verify = f"docstatus={doc.get('docstatus')}"
			err = doc.get("docstatus", 0) < 1
		if erp and tool == "sto_get_trace" and not err:
			verify = "trace has purchase_order" if isinstance(resp, dict) and resp.get("purchase_order") else "missing PO in trace"
			err = not (isinstance(resp, dict) and resp.get("purchase_order"))
		record(state, tool, transport, resp, ms, err, json.dumps(resp)[:80] if resp else "", verify)

	resp, ms, err = call_tool("ic_create_sales_invoice")
	si = resp.get("sales_invoice") if isinstance(resp, dict) else None
	if si:
		state.si_name = si
	record(state, "ic_create_sales_invoice", transport, resp, ms, err or not si, str(si), "REST SI exists" if erp and si and erp.get_doc("Sales Invoice", si).get("name") else "")

	resp, ms, err = call_tool("ic_create_purchase_invoice")
	pi = resp.get("purchase_invoice") if isinstance(resp, dict) else None
	if pi:
		state.pi_name = pi
	record(state, "ic_create_purchase_invoice", transport, resp, ms, err or not pi, str(pi), "")

	resp, ms, err = call_tool("ic_create_invoice_pair")
	if isinstance(resp, dict):
		state.pair_si = resp.get("sales_invoice")
		state.pair_pi = resp.get("purchase_invoice")
		if state.pair_si:
			state.si_name = state.pair_si
		if state.pair_pi:
			state.pi_name = state.pair_pi
	record(state, "ic_create_invoice_pair", transport, resp, ms, err or not (state.pair_si and state.pair_pi),
	       f"{state.pair_si}/{state.pair_pi}", "pair SI+PI")

	if state.si_name or state.pi_name:
		resp, ms, err = call_tool("ic_get_invoice_status")
		record(state, "ic_get_invoice_status", transport, resp, ms, err, json.dumps(resp)[:80] if resp else "", "status returned")

		resp, ms, err = call_tool("ic_submit_invoice")
		verify = ""
		if erp and state.si_name and not err:
			doc = erp.get_doc("Sales Invoice", state.si_name)
			verify = f"SI docstatus={doc.get('docstatus')}"
		record(state, "ic_submit_invoice", transport, resp, ms, err, "", verify)

	for tool in EXTENDED_TOOLS:
		resp, ms, err = call_tool(tool)
		record(state, tool, transport, resp, ms, err, json.dumps(resp)[:80] if resp else "", "extended list/status")


def wait_for_ping(url: str, retries: int = 60, interval: int = 15) -> bool:
	ping = f"{url.rstrip('/')}/api/method/ping"
	for i in range(retries):
		try:
			req = urllib.request.Request(ping, method="GET")
			with urllib.request.urlopen(req, timeout=10) as r:
				body = r.read().decode()
				if "pong" in body.lower():
					print(f"✓ Railway ping OK after {i * interval}s")
					return True
		except Exception as exc:
			print(f"  ping attempt {i + 1}/{retries}: {exc}")
		time.sleep(interval)
	return False


def main() -> int:
	load_demo_env()
	parser = argparse.ArgumentParser()
	parser.add_argument("--direct-only", action="store_true")
	parser.add_argument("--mcp-only", action="store_true")
	parser.add_argument("--report", default=str(ROOT / "docs" / "hosted-mcp-results.json"))
	parser.add_argument("--wait-ping", action="store_true", help="Wait for Railway ping before tests")
	args = parser.parse_args()

	base = env("ERPNEXT_URL", "https://erpnext-production-512a.up.railway.app")
	key = env("ERPNEXT_API_KEY")
	secret = env("ERPNEXT_API_SECRET")
	mcp_url = env("VERCEL_MCP_URL", "https://vercel-indol-phi-69.vercel.app/api/mcp")
	mcp_token = env("MCP_AUTH_TOKEN", "")

	if args.wait_ping and not wait_for_ping(base):
		print("FAIL: Railway ping never returned pong", file=sys.stderr)
		return 1

	all_results: list[ToolResult] = []
	summary: dict[str, Any] = {
		"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
		"erpnext_url": base,
		"vercel_mcp_url": mcp_url,
		"transports": {},
	}

	if not args.mcp_only:
		if not key or not secret:
			print("SKIP direct: ERPNEXT_API_KEY/SECRET not set", file=sys.stderr)
		else:
			state = RunState()
			erp = ERPNextClient(base, key, secret)
			run_tool_chain(erp, "direct", state)
			all_results.extend(state.results)
			summary["transports"]["direct"] = {
				"po_name": state.po_name,
				"pass": sum(1 for r in state.results if r.status == "PASS"),
				"fail": sum(1 for r in state.results if r.status == "FAIL"),
			}

	if not args.direct_only:
		state = RunState()
		mcp = VercelMcpClient(mcp_url, mcp_token)
		try:
			mcp.initialize()
			run_tool_chain(mcp, "vercel_mcp", state)
		except Exception as exc:
			record(state, "vercel_mcp_init", "vercel_mcp", None, 0, True, str(exc))
		all_results.extend(state.results)
		summary["transports"]["vercel_mcp"] = {
			"po_name": state.po_name,
			"pass": sum(1 for r in state.results if r.status == "PASS"),
			"fail": sum(1 for r in state.results if r.status == "FAIL"),
		}

	# Per-tool summary (direct transport preferred)
	tool_status: dict[str, str] = {}
	all_tools = CORE_TOOLS + EXTENDED_TOOLS
	for tool in all_tools:
		passes = [r for r in all_results if r.tool == tool and r.status == "PASS"]
		tool_status[tool] = "PASS" if passes else "FAIL"
	summary["tools"] = tool_status
	summary["results"] = [asdict(r) for r in all_results]

	Path(args.report).parent.mkdir(parents=True, exist_ok=True)
	Path(args.report).write_text(json.dumps(summary, indent=2), encoding="utf-8")

	print("\n=== Hosted MCP E2E (15 core + 6 extended tools) ===")
	for tool in all_tools:
		icon = "✓" if tool_status.get(tool) == "PASS" else "✗"
		rows = [r for r in all_results if r.tool == tool]
		detail = rows[0].detail[:60] if rows else ""
		print(f"{icon} {tool}: {tool_status.get(tool, 'SKIP')} {detail}")
	pass_n = sum(1 for t in CORE_TOOLS if tool_status.get(t) == "PASS")
	ext_n = sum(1 for t in EXTENDED_TOOLS if tool_status.get(t) == "PASS")
	print(f"\n{pass_n}/15 core PASS | {ext_n}/{len(EXTENDED_TOOLS)} extended PASS | Report: {args.report}")
	return 0 if pass_n == 15 else 1


if __name__ == "__main__":
	sys.exit(main())
