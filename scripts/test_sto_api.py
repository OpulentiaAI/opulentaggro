#!/usr/bin/env python3
"""Integration tests for STO whitelisted API methods.

Requires a running ERPNext site with seeded master data and API credentials.

Environment:
  ERPNEXT_URL          Base URL (e.g. http://localhost:8000)
  ERPNEXT_API_KEY      API key
  ERPNEXT_API_SECRET   API secret
  STO_TEST_COMPANY     Optional override for receiving company
  STO_TEST_SUPPLIER    Optional override for internal supplier
  STO_TEST_ITEM        Optional override for item code

Usage:
  python3 scripts/test_sto_api.py
  python3 scripts/test_sto_api.py --list-only
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
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from load_demo_env import load_demo_env  # noqa: E402

METHOD_PREFIX = "erpnext.intercompany.stock_transfer_order"

STO_METHODS = [
	"create_stock_transfer_order",
	"submit_stock_transfer_order",
	"approve_and_route_stock_transfer",
	"post_goods_in_transit",
	"create_intercompany_invoice",
	"post_stock_transfer_receipt",
	"get_stock_transfer_trace",
	"run_stock_transfer_three_way_match",
	"list_stock_transfer_orders",
]

MCP_TOOL_MAP = {
	"create_stock_transfer_order": "sto_create",
	"submit_stock_transfer_order": "sto_submit",
	"approve_and_route_stock_transfer": "sto_approve_and_route",
	"post_goods_in_transit": "sto_post_goods_in_transit",
	"create_intercompany_invoice": "sto_create_ic_invoice",
	"post_stock_transfer_receipt": "sto_post_goods_receipt",
	"get_stock_transfer_trace": "sto_get_trace",
	"run_stock_transfer_three_way_match": "sto_three_way_match",
	"list_stock_transfer_orders": "sto_list",
}


@dataclass
class TestResult:
	endpoint: str
	mcp_tool: str
	status: str
	ms: float
	detail: str = ""


class ERPNextClient:
	def __init__(self, base_url: str, api_key: str, api_secret: str):
		self.base_url = base_url.rstrip("/")
		self.auth_header = f"token {api_key}:{api_secret}"

	def call_method(self, method: str, args: dict[str, Any] | None = None) -> tuple[Any, float]:
		encoded = ".".join(urllib.parse.quote(part, safe="") for part in method.split("."))
		url = f"{self.base_url}/api/method/{encoded}"
		body = json.dumps(args or {}).encode("utf-8")
		req = urllib.request.Request(
			url,
			data=body,
			method="POST",
			headers={
				"Authorization": self.auth_header,
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
		)
		start = time.perf_counter()
		with urllib.request.urlopen(req, timeout=120) as resp:
			payload = json.loads(resp.read().decode("utf-8"))
		elapsed_ms = (time.perf_counter() - start) * 1000
		if payload.get("exc_type"):
			raise RuntimeError(payload.get("message") or payload.get("exc") or "ERPNext error")
		return payload.get("message"), elapsed_ms


def _env(name: str, default: str = "") -> str:
	return os.environ.get(name, default).strip()


def _default_create_payload(client: ERPNextClient) -> dict[str, Any]:
	company = _env("STO_TEST_COMPANY", "Opulent Fresh NA")
	supplier = _env("STO_TEST_SUPPLIER", "Internal Supplier Opulent Fresh EU")
	item = _env("STO_TEST_ITEM", "STO-TEST-ITEM-001")
	return {
		"company": company,
		"supplier": supplier,
		"warehouse": "Stores - OFNA",
		"items": json.dumps([{"item_code": item, "qty": 5, "rate": 100}]),
	}


def run_workflow(client: ERPNextClient, list_only: bool = False) -> list[TestResult]:
	results: list[TestResult] = []
	po_name: str | None = None

	def record(method: str, ok: bool, ms: float, detail: str = "") -> None:
		results.append(
			TestResult(
				endpoint=method,
				mcp_tool=MCP_TOOL_MAP[method],
				status="PASS" if ok else "FAIL",
				ms=round(ms, 1),
				detail=detail,
			)
		)

	# list (fast path, no stage)
	try:
		msg, ms = client.call_method(
			f"{METHOD_PREFIX}.list_stock_transfer_orders",
			{"limit": 5, "include_stage": 0},
		)
		record("list_stock_transfer_orders", isinstance(msg, list), ms, f"count={len(msg)}")
	except Exception as exc:
		record("list_stock_transfer_orders", False, 0, str(exc))

	if list_only:
		return results

	# create
	try:
		payload = _default_create_payload(client)
		msg, ms = client.call_method(f"{METHOD_PREFIX}.create_stock_transfer_order", payload)
		po_name = msg.get("purchase_order") if isinstance(msg, dict) else None
		record("create_stock_transfer_order", bool(po_name), ms, po_name or str(msg))
	except Exception as exc:
		record("create_stock_transfer_order", False, 0, str(exc))
		return results

	assert po_name

	steps: list[tuple[str, dict[str, Any]]] = [
		("submit_stock_transfer_order", {"purchase_order": po_name}),
		("approve_and_route_stock_transfer", {"purchase_order": po_name, "delivery_date": "2026-06-15"}),
		("post_goods_in_transit", {"purchase_order": po_name}),
		("create_intercompany_invoice", {"purchase_order": po_name}),
		("post_stock_transfer_receipt", {"purchase_order": po_name}),
		("get_stock_transfer_trace", {"purchase_order": po_name}),
		(
			"run_stock_transfer_three_way_match",
			{"purchase_order": po_name, "qty_tolerance_percent": 0, "price_tolerance_percent": 0},
		),
	]

	for method, args in steps:
		try:
			msg, ms = client.call_method(f"{METHOD_PREFIX}.{method}", args)
			ok = msg is not None
			detail = ""
			if isinstance(msg, dict):
				detail = msg.get("stage") or msg.get("matched") or msg.get("sales_order") or ""
				detail = str(detail)
			record(method, ok, ms, detail)
		except Exception as exc:
			record(method, False, 0, str(exc))
			break

	return results


def print_table(results: list[TestResult]) -> None:
	print("\n| Endpoint | MCP Tool | Status | ms | Detail |")
	print("|----------|----------|--------|-----|--------|")
	for row in results:
		detail = (row.detail or "")[:60].replace("|", "/")
		print(f"| {row.endpoint} | {row.mcp_tool} | {row.status} | {row.ms} | {detail} |")


def main() -> int:
	load_demo_env()
	parser = argparse.ArgumentParser(description="STO API integration tests")
	parser.add_argument("--list-only", action="store_true", help="Only test list endpoint")
	args = parser.parse_args()

	base_url = _env("ERPNEXT_URL")
	api_key = _env("ERPNEXT_API_KEY")
	api_secret = _env("ERPNEXT_API_SECRET")

	if not base_url or not api_key or not api_secret:
		print(
			"SKIP: Set ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET for live API tests.",
			file=sys.stderr,
		)
		print_table(
			[
				TestResult(m, MCP_TOOL_MAP[m], "SKIP", 0, "no credentials")
				for m in STO_METHODS
			]
		)
		return 2

	client = ERPNextClient(base_url, api_key, api_secret)
	try:
		results = run_workflow(client, list_only=args.list_only)
	except urllib.error.URLError as exc:
		print(f"FAIL: Cannot reach ERPNext at {base_url}: {exc}", file=sys.stderr)
		print_table(
			[TestResult(m, MCP_TOOL_MAP[m], "FAIL", 0, "site unreachable") for m in STO_METHODS]
		)
		return 1

	print_table(results)
	failed = [r for r in results if r.status == "FAIL"]
	return 1 if failed else 0


if __name__ == "__main__":
	sys.exit(main())
