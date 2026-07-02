# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Triangular sales MVP — customer SO + foreign plant billing chain."""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import flt, nowdate


def _parse_json(value: Any) -> Any:
	if isinstance(value, str):
		try:
			return json.loads(value)
		except json.JSONDecodeError:
			return value
	return value


def _triangular_tag() -> str:
	return "[IC:triangular]"


@frappe.whitelist()
def create_triangular_sale(
	selling_company: str,
	billing_company: str,
	customer: str,
	items: str | list[dict],
	plant_company: str | None = None,
	posting_date: str | None = None,
	submit: int | bool = 0,
) -> dict:
	"""Create triangular sale: SO on seller + linked IC invoice pair to billing/plant company."""
	from erpnext.intercompany.intercompany_billing import create_intercompany_invoice_pair

	items = _parse_json(items)
	if not items:
		frappe.throw(_("At least one item is required."))

	plant = plant_company or billing_company
	posting_date = posting_date or nowdate()

	from erpnext.intercompany.stock_transfer_order import _default_stores_warehouse

	default_wh = _default_stores_warehouse(selling_company)

	so = frappe.new_doc("Sales Order")
	so.company = selling_company
	so.customer = customer
	so.transaction_date = posting_date
	so.delivery_date = posting_date
	for row in items:
		so.append(
			"items",
			{
				"item_code": row["item_code"],
				"qty": flt(row.get("qty", 1)),
				"rate": flt(row.get("rate", 0)),
				"warehouse": row.get("warehouse") or default_wh,
			},
		)
	so.set_missing_values()
	so.insert()
	if frappe.utils.cint(submit):
		so.submit()

	ic = create_intercompany_invoice_pair(
		from_company=selling_company,
		to_company=billing_company,
		items=items,
		posting_date=posting_date,
		submit=submit,
	)

	frappe.get_doc(
		{
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": "Sales Order",
			"reference_name": so.name,
			"content": (
				f"{_triangular_tag()} "
				f'{json.dumps({"billing_company": billing_company, "plant_company": plant, "ic": ic})}'
			),
		}
	).insert(ignore_permissions=True)

	return {
		"sales_order": so.name,
		"sales_order_docstatus": so.docstatus,
		"selling_company": selling_company,
		"billing_company": billing_company,
		"plant_company": plant,
		"customer": customer,
		"intercompany_invoices": ic,
		"status": "Submitted" if so.docstatus == 1 else "Draft",
	}


@frappe.whitelist()
def list_triangular_sales(company: str | None = None, limit: int = 20) -> list[dict]:
	"""List sales orders tagged as triangular sales."""
	limit = min(max(1, frappe.utils.cint(limit)), 100)
	rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Sales Order",
			"content": ["like", f"%{_triangular_tag()}%"],
		},
		fields=["reference_name", "content", "creation"],
		order_by="creation desc",
		limit_page_length=limit * 2,
	)
	seen: set[str] = set()
	out: list[dict] = []
	for row in rows:
		so_name = row.reference_name
		if so_name in seen:
			continue
		seen.add(so_name)
		so = frappe.db.get_value(
			"Sales Order",
			so_name,
			["name", "company", "customer", "status", "docstatus", "grand_total"],
			as_dict=True,
		)
		if not so:
			continue
		if company and so.company != company:
			continue
		out.append(
			{
				"sales_order": so.name,
				"selling_company": so.company,
				"customer": so.customer,
				"status": so.status,
				"docstatus": so.docstatus,
				"grand_total": flt(so.grand_total),
				"created_at": str(row.creation),
			}
		)
		if len(out) >= limit:
			break
	return out


@frappe.whitelist()
def get_triangular_sale(sales_order: str) -> dict:
	"""Trace triangular sale SO + IC billing metadata."""
	if not frappe.db.exists("Sales Order", sales_order):
		frappe.throw(_("Sales Order {0} does not exist.").format(sales_order))

	so = frappe.get_doc("Sales Order", sales_order)
	meta = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Sales Order",
			"reference_name": sales_order,
			"content": ["like", f"%{_triangular_tag()}%"],
		},
		fields=["content", "creation"],
		order_by="creation desc",
		limit=1,
	)
	ic_meta = {}
	if meta:
		try:
			_, _, rest = meta[0].content.partition("]")
			ic_meta = json.loads(rest.strip() or "{}")
		except json.JSONDecodeError:
			ic_meta = {}

	return {
		"sales_order": so.name,
		"selling_company": so.company,
		"customer": so.customer,
		"status": so.status,
		"docstatus": so.docstatus,
		"grand_total": flt(so.grand_total),
		"triangular_metadata": ic_meta,
	}
