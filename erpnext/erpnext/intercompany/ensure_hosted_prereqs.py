# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Idempotent hosted-stack prerequisites for MCP E2E (Railway production).

Ensures:
  - System Settings.setup_complete = 1 (desk embeds)
  - System Settings.currency = USD (intercompany validation)
  - Fiscal Year 2026 for all Opulent companies
  - Stock on hand in APAC/EU/NA Stores for STO test items (GIT/GR chain)

Run on a Frappe site:

    bench --site SITE execute erpnext.intercompany.ensure_hosted_prereqs.run
"""

from __future__ import annotations

import frappe
from frappe.utils import getdate, nowdate

COMPANIES = ("Opulent Fresh NA", "Opulent Fresh EU", "Opulent Fresh APAC")
COMPANY_WAREHOUSES = {
	"Opulent Fresh APAC": "Stores - OFAP",
	"Opulent Fresh EU": "Stores - OFEU",
	"Opulent Fresh NA": "Stores - OFNA",
}
STOCK_ITEMS: tuple[tuple[str, float, float], ...] = (
	("STO-TEST-ITEM-001", 100.0, 50.0),
	("STO-TEST-ITEM-002", 200.0, 50.0),
)
# E2E harness creates qty=101 STOs on direct + Vercel MCP (202 units/cycle).
MIN_STOCK_QTY = 250.0
RECEIPT_QTY = 250.0
FISCAL_YEAR = "2026"


def _ensure_setup_complete() -> None:
	frappe.db.set_single_value("System Settings", "setup_complete", 1)
	frappe.db.set_single_value("System Settings", "currency", "USD")


def _ensure_public_files_dir() -> None:
	import os

	from frappe.utils import get_site_path

	os.makedirs(get_site_path("public", "files"), exist_ok=True)


def _ensure_fiscal_year() -> None:
	if frappe.db.exists("Fiscal Year", FISCAL_YEAR):
		return
	doc = frappe.get_doc(
		{
			"doctype": "Fiscal Year",
			"year": FISCAL_YEAR,
			"year_start_date": f"{FISCAL_YEAR}-01-01",
			"year_end_date": f"{FISCAL_YEAR}-12-31",
			"companies": [{"company": c} for c in COMPANIES],
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert(ignore_permissions=True)


def _bin_qty(item_code: str, warehouse: str) -> float:
	return float(
		frappe.db.get_value(
			"Bin",
			{"item_code": item_code, "warehouse": warehouse},
			"actual_qty",
		)
		or 0
	)


def _material_receipt(item_code: str, qty: float, rate: float, company: str, warehouse: str) -> str | None:
	if not frappe.db.exists("Item", item_code):
		return None
	doc = frappe.get_doc(
		{
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Receipt",
			"company": company,
			"posting_date": nowdate(),
			"items": [
				{
					"item_code": item_code,
					"qty": qty,
					"basic_rate": rate,
					"t_warehouse": warehouse,
				}
			],
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert(ignore_permissions=True)
	doc.submit()
	return doc.name


def _ensure_stock() -> list[dict]:
	created: list[dict] = []
	for company, warehouse in COMPANY_WAREHOUSES.items():
		for item_code, rate, _ in STOCK_ITEMS:
			qty = _bin_qty(item_code, warehouse)
			if qty >= MIN_STOCK_QTY:
				created.append(
					{
						"company": company,
						"warehouse": warehouse,
						"item_code": item_code,
						"skipped": True,
						"actual_qty": qty,
					}
				)
				continue
			add_qty = max(RECEIPT_QTY, MIN_STOCK_QTY - qty)
			name = _material_receipt(item_code, add_qty, rate, company, warehouse)
			new_qty = _bin_qty(item_code, warehouse)
			created.append(
				{
					"company": company,
					"warehouse": warehouse,
					"item_code": item_code,
					"stock_entry": name,
					"actual_qty": new_qty,
					"added_qty": add_qty if name else 0,
				}
			)
	return created


@frappe.whitelist()
def run() -> dict:
	"""Entry point for bench execute / Railway entrypoint / MCP E2E stock top-up."""
	_ensure_setup_complete()
	_ensure_public_files_dir()
	_ensure_fiscal_year()
	stock = _ensure_stock()
	frappe.db.commit()
	return {
		"setup_complete": 1,
		"currency": "USD",
		"fiscal_year": FISCAL_YEAR,
		"warehouses": list(COMPANY_WAREHOUSES.values()),
		"stock": stock,
		"as_of": str(getdate()),
	}
