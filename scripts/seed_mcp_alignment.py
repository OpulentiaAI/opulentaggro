#!/usr/bin/env python3
"""Idempotent master data aligned with all STO + IC MCP tools.

Run on a Frappe site:

    bench --site sto.local execute scripts.seed_mcp_alignment.run

Tool → DB prerequisites (summary):
  sto_create/submit/...     → 2+ companies, internal supplier, items, warehouses, price list
  sto_post_goods_in_transit → GIT warehouse on receiver company
  sto_list/get_trace/...    → existing PO/SO chain (optional; list works with empty)
  ic_list_accounts          → internal Customer/Supplier rows per company pair
  ic_create_*               → pair A↔B and A↔C with items + item prices

See .cursor/skills/mcp-db-alignment/references/tool-registry.md for full mapping.
"""

from __future__ import annotations

import frappe
from frappe.utils import nowdate

# Re-use STO constants; extend for multi-pair IC billing
COMPANY_A = "Opulent Fresh NA"
COMPANY_B = "Opulent Fresh EU"
COMPANY_C = "Opulent Fresh APAC"
ITEM_PRIMARY = "STO-TEST-ITEM-001"
ITEM_SECONDARY = "STO-TEST-ITEM-002"
PRICE_LIST = "Standard Selling"


def _ensure_warehouse_type(name: str, description: str = "") -> None:
	if frappe.db.exists("Warehouse Type", name):
		return
	doc = frappe.get_doc({"doctype": "Warehouse Type", "name": name, "description": description})
	doc.flags.ignore_permissions = True
	doc.insert(ignore_permissions=True)


def _ensure_company(name: str, abbr: str, currency: str = "USD", country: str | None = None) -> None:
	if frappe.db.exists("Company", name):
		return
	if country is None:
		if "NA" in name:
			country = "United States"
		elif "EU" in name:
			country = "Germany"
		else:
			country = "Singapore"
	# ERPNext's create_default_warehouses references "Transit" Warehouse Type for
	# the Goods In Transit warehouse. The Warehouse Type record isn't auto-created
	# in a clean install; create it here so the company setup completes.
	_ensure_warehouse_type("Transit", "Warehouses used for goods in transit between companies")

	doc = frappe.get_doc(
		{
			"doctype": "Company",
			"company_name": name,
			"abbr": abbr,
			"default_currency": currency,
			"country": country,
		}
	)
	doc.insert(ignore_permissions=True)


def _warehouse_name(company: str, wh: str) -> str:
	abbr = frappe.db.get_value("Company", company, "abbr")
	return f"{wh} - {abbr}"


def _ensure_warehouse(company: str, warehouse_name: str, is_group: int = 0) -> str:
	name = _warehouse_name(company, warehouse_name)
	if frappe.db.exists("Warehouse", name):
		return name
	doc = frappe.get_doc(
		{
			"doctype": "Warehouse",
			"warehouse_name": warehouse_name,
			"company": company,
			"is_group": is_group,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _ensure_item_group() -> None:
	if frappe.db.exists("Item Group", "Products"):
		return
	frappe.get_doc({"doctype": "Item Group", "item_group_name": "Products", "is_group": 0}).insert(
		ignore_permissions=True
	)


def _ensure_uom() -> None:
	if frappe.db.exists("UOM", "Nos"):
		return
	frappe.get_doc({"doctype": "UOM", "uom_name": "Nos", "enabled": 1}).insert(
		ignore_permissions=True
	)


def _ensure_item(item_code: str, item_name: str) -> None:
	if frappe.db.exists("Item", item_code):
		return
	_ensure_item_group()
	_ensure_uom()
	frappe.get_doc(
		{
			"doctype": "Item",
			"item_code": item_code,
			"item_name": item_name,
			"item_group": "Products",
			"stock_uom": "Nos",
			"is_stock_item": 1,
		}
	).insert(ignore_permissions=True)


def _ensure_price_list() -> None:
	if frappe.db.exists("Price List", PRICE_LIST):
		return
	frappe.get_doc(
		{
			"doctype": "Price List",
			"price_list_name": PRICE_LIST,
			"currency": "USD",
			"selling": 1,
			"buying": 1,
		}
	).insert(ignore_permissions=True)


def _ensure_item_price(item_code: str, rate: float) -> None:
	if frappe.db.get_value(
		"Item Price",
		{"item_code": item_code, "price_list": PRICE_LIST},
		"name",
	):
		return
	frappe.get_doc(
		{
			"doctype": "Item Price",
			"item_code": item_code,
			"price_list": PRICE_LIST,
			"price_list_rate": rate,
		}
	).insert(ignore_permissions=True)


def _ensure_company_pair(selling_company: str, buying_company: str) -> dict[str, str]:
	"""Bidirectional internal customer (on seller) and supplier (on buyer)."""
	cust_name = f"Internal Customer {buying_company}"
	if not frappe.db.exists("Customer", cust_name):
		frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": cust_name,
				"customer_type": "Company",
				"is_internal_customer": 1,
				"represents_company": buying_company,
				"companies": [{"company": selling_company}],
			}
		).insert(ignore_permissions=True)

	supp_name = f"Internal Supplier {selling_company}"
	if not frappe.db.exists("Supplier", supp_name):
		frappe.get_doc(
			{
				"doctype": "Supplier",
				"supplier_name": supp_name,
				"supplier_type": "Company",
				"is_internal_supplier": 1,
				"represents_company": selling_company,
				"companies": [{"company": buying_company}],
			}
		).insert(ignore_permissions=True)

	return {"internal_customer": cust_name, "internal_supplier": supp_name}


def _enable_inter_company() -> None:
	frappe.db.set_single_value("Selling Settings", "allow_inter_company_invoice", 1)
	frappe.db.set_single_value("Buying Settings", "allow_inter_company_invoice", 1)
	frappe.db.set_single_value("Selling Settings", "allow_sales_order_creation_for_expired_item", 1)
	frappe.db.set_single_value("Buying Settings", "maintain_same_rate", 0)


def run() -> dict:
	"""Entry point for bench execute."""
	_ensure_company(COMPANY_A, "OFNA", "USD")
	_ensure_company(COMPANY_B, "OFEU", "USD")
	_ensure_company(COMPANY_C, "OFAP", "USD")
	_enable_inter_company()

	_ensure_item(ITEM_PRIMARY, "STO Test Widget")
	_ensure_item(ITEM_SECONDARY, "STO Test Widget B")
	_ensure_price_list()
	_ensure_item_price(ITEM_PRIMARY, 100.0)
	_ensure_item_price(ITEM_SECONDARY, 75.0)

	wh_a = _ensure_warehouse(COMPANY_A, "Stores")
	wh_b = _ensure_warehouse(COMPANY_B, "Stores")
	wh_c = _ensure_warehouse(COMPANY_C, "Stores")
	git_b = _ensure_warehouse(COMPANY_B, "GIT In Transit")
	git_a = _ensure_warehouse(COMPANY_A, "GIT In Transit")

	# STO default: NA receives from EU (PO on NA, supplier = EU)
	pair_ab_na_po = _ensure_company_pair(COMPANY_B, COMPANY_A)
	# Reverse for EU→NA IC billing tests
	pair_ba = _ensure_company_pair(COMPANY_B, COMPANY_A)
	# Multi-account: A↔C and B↔C
	pair_ac = _ensure_company_pair(COMPANY_A, COMPANY_C)
	pair_bc = _ensure_company_pair(COMPANY_B, COMPANY_C)
	pair_ca = _ensure_company_pair(COMPANY_C, COMPANY_A)

	frappe.db.commit()

	return {
		"companies": [COMPANY_A, COMPANY_B, COMPANY_C],
		"items": [ITEM_PRIMARY, ITEM_SECONDARY],
		"price_list": PRICE_LIST,
		"warehouses": {
			COMPANY_A: {"stores": wh_a, "git": git_a},
			COMPANY_B: {"stores": wh_b, "git": git_b},
			COMPANY_C: {"stores": wh_c},
		},
		"company_pairs": {
			"eu_to_na_sto": {
				"receiving_company": COMPANY_A,
				"internal_supplier": pair_ab_na_po["internal_supplier"],
				**pair_ab_na_po,
			},
			"eu_to_na_ic": pair_ba,
			"a_to_c": pair_ac,
			"b_to_c": pair_bc,
			"c_to_a": pair_ca,
		},
		"sample_sto_payload": {
			"company": COMPANY_A,
			"supplier": pair_ab_na_po["internal_supplier"],
			"warehouse": wh_a,
			"items": [{"item_code": ITEM_PRIMARY, "qty": 10, "rate": 100}],
			"transaction_date": nowdate(),
		},
		"sample_ic_payload": {
			"from_company": COMPANY_B,
			"to_company": COMPANY_A,
			"items": [{"item_code": ITEM_PRIMARY, "qty": 1, "rate": 100}],
		},
	}
