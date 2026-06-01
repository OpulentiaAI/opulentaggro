#!/usr/bin/env python3
"""Run STO + IC MCP tools via stdio JSON-RPC against run_mcp_server.sh.

Outputs JSON with per-tool results and created document names.
Usage:
  bash -lc 'source scripts/load_env.sh && ERPNEXT_NO_AUTH=1 python3 scripts/mcp_stdio_runner.py'
  python3 scripts/mcp_stdio_runner.py --report /tmp/mcp-stdio.json
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from load_demo_env import load_demo_env  # noqa: E402


@dataclass
class ToolResult:
	tool: str
	status: str
	ms: float
	detail: str = ""
	response: dict[str, Any] | list[Any] | None = None


@dataclass
class RunState:
	results: list[ToolResult] = field(default_factory=list)
	po_name: str | None = None
	si_name: str | None = None
	pi_name: str | None = None
	pair_si: str | None = None
	pair_pi: str | None = None


class MCPStdioClient:
	def __init__(self, root: Path, env: dict[str, str]):
		self.root = root
		self.env = env
		self._id = 0
		self._proc: subprocess.Popen[str] | None = None

	def start(self) -> None:
		cmd = ["timeout", "180", str(self.root / "scripts" / "run_mcp_server.sh")]
		self._proc = subprocess.Popen(
			cmd,
			stdin=subprocess.PIPE,
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE,
			text=True,
			env=self.env,
			cwd=str(self.root),
			bufsize=1,
		)
		self._send({"jsonrpc": "2.0", "id": self._next_id(), "method": "initialize", "params": {
			"protocolVersion": "2024-11-05",
			"capabilities": {},
			"clientInfo": {"name": "mcp-stdio-runner", "version": "1.0"},
		}})
		self._read_until_id(1)
		self._send({"jsonrpc": "2.0", "method": "notifications/initialized"})

	def close(self) -> None:
		if self._proc and self._proc.stdin:
			self._proc.stdin.close()
		if self._proc:
			self._proc.wait(timeout=5)

	def _next_id(self) -> int:
		self._id += 1
		return self._id

	def _send(self, msg: dict[str, Any]) -> None:
		if not self._proc or not self._proc.stdin:
			raise RuntimeError("MCP process not started")
		self._proc.stdin.write(json.dumps(msg) + "\n")
		self._proc.stdin.flush()

	def _read_until_id(self, req_id: int, timeout: float = 120.0) -> dict[str, Any]:
		if not self._proc or not self._proc.stdout:
			raise RuntimeError("MCP process not started")
		deadline = time.monotonic() + timeout
		while time.monotonic() < deadline:
			line = self._proc.stdout.readline()
			if not line:
				break
			line = line.strip()
			if not line:
				continue
			try:
				data = json.loads(line)
			except json.JSONDecodeError:
				continue
			if data.get("id") == req_id:
				return data
		raise TimeoutError(f"No MCP response for id={req_id}")

	def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> tuple[Any, float, bool]:
		req_id = self._next_id()
		start = time.perf_counter()
		self._send({"jsonrpc": "2.0", "id": req_id, "method": "tools/call", "params": {
			"name": name,
			"arguments": arguments or {},
		}})
		data = self._read_until_id(req_id)
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


def run_all(client: MCPStdioClient, state: RunState) -> None:
	company = os.environ.get("STO_TEST_COMPANY", "Opulent Fresh NA")
	supplier = os.environ.get("STO_TEST_SUPPLIER", "Internal Supplier Opulent Fresh EU")
	item = os.environ.get("STO_TEST_ITEM", "STO-TEST-ITEM-001")
	from_co = os.environ.get("IC_TEST_FROM_COMPANY", "Opulent Fresh EU")
	to_co = os.environ.get("IC_TEST_TO_COMPANY", "Opulent Fresh NA")
	items = [{"item_code": item, "qty": 2, "rate": 100}]
	ic_items = [{"item_code": item, "qty": 1, "rate": 50}]

	def record(tool: str, resp: Any, ms: float, is_error: bool, detail: str = "") -> None:
		status = "FAIL" if is_error else "PASS"
		state.results.append(ToolResult(tool, status, ms, detail, resp if isinstance(resp, (dict, list)) else None))

	# ic_list_accounts
	resp, ms, err = client.call_tool("ic_list_accounts", {})
	pairs = len(resp) if isinstance(resp, list) else 0
	record("ic_list_accounts", resp, ms, err, f"{pairs} pairs")

	# sto_list
	resp, ms, err = client.call_tool("sto_list", {"limit": 5})
	count = len(resp) if isinstance(resp, list) else 0
	record("sto_list", resp, ms, err, f"{count} rows")

	# sto_create
	resp, ms, err = client.call_tool("sto_create", {
		"company": company,
		"supplier": supplier,
		"warehouse": "Stores - OFNA",
		"items": items,
		"submit": False,
	})
	po = resp.get("purchase_order") if isinstance(resp, dict) else None
	state.po_name = po
	record("sto_create", resp, ms, err or not po, str(po))

	if not po:
		return

	chain = [
		("sto_submit", {"purchase_order": po}),
		("sto_approve_and_route", {"purchase_order": po, "submit": True}),
		("sto_post_goods_in_transit", {"purchase_order": po, "submit": True}),
		("sto_create_ic_invoice", {"purchase_order": po, "submit": True}),
		("sto_post_goods_receipt", {"purchase_order": po, "submit": True}),
		("sto_get_trace", {"purchase_order": po}),
		("sto_three_way_match", {"purchase_order": po}),
	]
	for tool, args in chain:
		resp, ms, err = client.call_tool(tool, args)
		detail = json.dumps(resp)[:120] if resp else ""
		record(tool, resp, ms, err, detail)

	# IC standalone
	resp, ms, err = client.call_tool("ic_create_sales_invoice", {
		"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False,
	})
	si = resp.get("sales_invoice") if isinstance(resp, dict) else None
	state.si_name = si
	record("ic_create_sales_invoice", resp, ms, err or not si, str(si))

	resp, ms, err = client.call_tool("ic_create_purchase_invoice", {
		"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False,
	})
	pi = resp.get("purchase_invoice") if isinstance(resp, dict) else None
	state.pi_name = pi
	record("ic_create_purchase_invoice", resp, ms, err or not pi, str(pi))

	resp, ms, err = client.call_tool("ic_create_invoice_pair", {
		"from_company": from_co, "to_company": to_co, "items": ic_items, "submit": False,
	})
	if isinstance(resp, dict):
		state.pair_si = resp.get("sales_invoice")
		state.pair_pi = resp.get("purchase_invoice")
		if state.pair_si:
			state.si_name = state.pair_si
		if state.pair_pi:
			state.pi_name = state.pair_pi
	record("ic_create_invoice_pair", resp, ms, err or not (state.pair_si and state.pair_pi),
	       f"{state.pair_si}/{state.pair_pi}")

	if state.si_name or state.pi_name:
		resp, ms, err = client.call_tool("ic_get_invoice_status", {
			"sales_invoice": state.si_name,
			"purchase_invoice": state.pi_name,
		})
		record("ic_get_invoice_status", resp, ms, err)

		resp, ms, err = client.call_tool("ic_submit_invoice", {
			"sales_invoice": state.si_name,
			"purchase_invoice": None,
		})
		record("ic_submit_invoice", resp, ms, err)


def main() -> int:
	load_demo_env()
	parser = argparse.ArgumentParser()
	parser.add_argument("--report", type=str, default="")
	args = parser.parse_args()

	env = {**os.environ, "ERPNEXT_NO_AUTH": "1", "ERPNEXT_URL": os.environ.get("ERPNEXT_URL", "http://localhost:8000")}
	state = RunState()
	client = MCPStdioClient(ROOT, env)
	try:
		client.start()
		run_all(client, state)
	finally:
		client.close()

	out = {
		"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
		"po_name": state.po_name,
		"si_name": state.si_name,
		"pi_name": state.pi_name,
		"pair_si": state.pair_si,
		"pair_pi": state.pair_pi,
		"results": [asdict(r) for r in state.results],
	}
	report_path = args.report or str(ROOT / "docs" / "mcp-stdio-results.json")
	Path(report_path).write_text(json.dumps(out, indent=2), encoding="utf-8")

	fails = [r for r in state.results if r.status == "FAIL"]
	print("\n=== MCP stdio endpoint results ===")
	for r in state.results:
		icon = "✓" if r.status == "PASS" else "✗"
		print(f"{icon} {r.tool}: {r.status} ({r.ms:.0f}ms) {r.detail[:80]}")
	print(f"\nTotal: {len(state.results)} | PASS: {sum(1 for r in state.results if r.status == 'PASS')} | FAIL: {len(fails)}")
	print(f"PO: {state.po_name} | SI: {state.si_name} | PI: {state.pi_name}")
	print(f"Report: {report_path}")
	return 1 if fails else 0


if __name__ == "__main__":
	sys.exit(main())
