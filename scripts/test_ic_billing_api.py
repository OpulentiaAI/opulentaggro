#!/usr/bin/env python3
"""Integration tests for intercompany billing whitelisted API methods.

Requires a running ERPNext site with seeded master data and API credentials.

Environment:
  ERPNEXT_URL          Base URL (e.g. http://localhost:8000)
  ERPNEXT_API_KEY      API key
  ERPNEXT_API_SECRET   API secret
  IC_TEST_FROM_COMPANY Selling company (default: Opulent Fresh EU)
  IC_TEST_TO_COMPANY   Buying company (default: Opulent Fresh NA)
  IC_TEST_ITEM         Item code (default: STO-TEST-ITEM-001)

Usage:
  python3 scripts/test_ic_billing_api.py
  python3 scripts/test_ic_billing_api.py --list-only
  python3 scripts/test_ic_billing_api.py --dry-run
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
from typing import Any

METHOD_PREFIX = "erpnext.intercompany.intercompany_billing"

IC_METHODS = [
	"list_intercompany_accounts",
	"create_intercompany_sales_invoice",
	"create_intercompany_purchase_invoice",
	"create_intercompany_invoice_pair",
	"submit_intercompany_invoice",
	"get_intercompany_invoice_status",
]

MCP_TOOL_MAP = {
	"list_intercompany_accounts": "ic_list_accounts",
	"create_intercompany_sales_invoice": "ic_create_sales_invoice",
	"create_intercompany_purchase_invoice": "ic_create_purchase_invoice",
	"create_intercompany_invoice_pair": "ic_create_invoice_pair",
	"submit_intercompany_invoice": "ic_submit_invoice",
	"get_intercompany_invoice_status": "ic_get_invoice_status",
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
		try:
			with urllib.request.urlopen(req, timeout=120) as resp:
				payload = json.loads(resp.read().decode("utf-8"))
		except urllib.error.HTTPError as exc:
			err_body = exc.read().decode("utf-8", errors="replace")
			raise RuntimeError(f"HTTP {exc.code}: {err_body}") from exc
		ms = (time.perf_counter() - start) * 1000
		if payload.get("exc_type"):
			raise RuntimeError(payload.get("message") or payload.get("exc") or str(payload))
		return payload.get("message"), ms


def _env(key: str, default: str) -> str:
	return os.environ.get(key, default)


def run_tests(client: ERPNextClient, *, dry_run: bool = False) -> list[TestResult]:
	from_company = _env("IC_TEST_FROM_COMPANY", "Opulent Fresh EU")
	to_company = _env("IC_TEST_TO_COMPANY", "Opulent Fresh NA")
	item = _env("IC_TEST_ITEM", "STO-TEST-ITEM-001")
	items = [{"item_code": item, "qty": 1, "rate": 50}]

	results: list[TestResult] = []

	def record(method: str, status: str, ms: float, detail: str = "") -> None:
		results.append(
			TestResult(
				endpoint=f"{METHOD_PREFIX}.{method}",
				mcp_tool=MCP_TOOL_MAP[method],
				status=status,
				ms=ms,
				detail=detail,
			)
		)

	# 1. List accounts
	try:
		data, ms = client.call_method(f"{METHOD_PREFIX}.list_intercompany_accounts", {})
		pairs = len(data) if isinstance(data, list) else 0
		record("list_intercompany_accounts", "PASS", ms, f"{pairs} pair(s)")
	except Exception as exc:
		record("list_intercompany_accounts", "FAIL", 0, str(exc))
		return results

	if dry_run:
		for method in IC_METHODS[1:]:
			record(method, "SKIP", 0, "dry-run")
		return results

	si_name = None
	pi_name = None

	# 2. Invoice pair (preferred path — AR + AP linked)
	try:
		data, ms = client.call_method(
			f"{METHOD_PREFIX}.create_intercompany_invoice_pair",
			{
				"from_company": from_company,
				"to_company": to_company,
				"items": json.dumps(items),
				"submit": 1,
			},
		)
		si_name = data.get("sales_invoice")
		pi_name = data.get("purchase_invoice")
		record(
			"create_intercompany_invoice_pair",
			"PASS",
			ms,
			f"SI={si_name}, PI={pi_name}",
		)
	except Exception as exc:
		record("create_intercompany_invoice_pair", "FAIL", 0, str(exc))

	# 3. Status
	if si_name or pi_name:
		try:
			data, ms = client.call_method(
				f"{METHOD_PREFIX}.get_intercompany_invoice_status",
				{"sales_invoice": si_name, "purchase_invoice": pi_name},
			)
			posted = data.get("fully_posted")
			record("get_intercompany_invoice_status", "PASS", ms, f"fully_posted={posted}")
		except Exception as exc:
			record("get_intercompany_invoice_status", "FAIL", 0, str(exc))

	# 4. Standalone SI (draft)
	try:
		data, ms = client.call_method(
			f"{METHOD_PREFIX}.create_intercompany_sales_invoice",
			{
				"from_company": from_company,
				"to_company": to_company,
				"items": json.dumps(items),
				"submit": 0,
			},
		)
		record("create_intercompany_sales_invoice", "PASS", ms, data.get("sales_invoice", ""))
	except Exception as exc:
		record("create_intercompany_sales_invoice", "FAIL", 0, str(exc))

	# 5. Standalone PI (draft)
	try:
		data, ms = client.call_method(
			f"{METHOD_PREFIX}.create_intercompany_purchase_invoice",
			{
				"from_company": from_company,
				"to_company": to_company,
				"items": json.dumps(items),
				"submit": 0,
			},
		)
		draft_pi = data.get("purchase_invoice")
		record("create_intercompany_purchase_invoice", "PASS", ms, draft_pi or "")

		# 6. Submit draft PI
		if draft_pi:
			_, ms = client.call_method(
				f"{METHOD_PREFIX}.submit_intercompany_invoice",
				{"purchase_invoice": draft_pi},
			)
			record("submit_intercompany_invoice", "PASS", ms, draft_pi)
	except Exception as exc:
		record("create_intercompany_purchase_invoice", "FAIL", 0, str(exc))

	return results


def main() -> int:
	parser = argparse.ArgumentParser(description="Test intercompany billing API")
	parser.add_argument("--list-only", action="store_true", help="Print method/tool map only")
	parser.add_argument("--dry-run", action="store_true", help="List accounts only, no creates")
	args = parser.parse_args()

	if args.list_only:
		for method in IC_METHODS:
			print(f"{METHOD_PREFIX}.{method} -> {MCP_TOOL_MAP[method]}")
		return 0

	base_url = os.environ.get("ERPNEXT_URL", "")
	api_key = os.environ.get("ERPNEXT_API_KEY", "")
	api_secret = os.environ.get("ERPNEXT_API_SECRET", "")

	if not all([base_url, api_key, api_secret]):
		print("SKIP: Set ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET", file=sys.stderr)
		return 0

	client = ERPNextClient(base_url, api_key, api_secret)
	results = run_tests(client, dry_run=args.dry_run)

	print("\n| Endpoint | MCP Tool | Status | ms | Detail |")
	print("|----------|----------|--------|-----|--------|")
	for r in results:
		print(f"| {r.endpoint.split('.')[-1]} | {r.mcp_tool} | {r.status} | {r.ms:.1f} | {r.detail[:60]} |")

	failed = [r for r in results if r.status == "FAIL"]
	return 1 if failed else 0


if __name__ == "__main__":
	sys.exit(main())
