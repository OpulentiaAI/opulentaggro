# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Standalone intercompany billing API (AR/AP) for multiple company pairs.

Supports creating Sales Invoices (AR on seller), Purchase Invoices (AP on buyer),
and linked SI+PI pairs without requiring a Stock Transfer Order context.
"""

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


def _allowed_companies_for_party(party_type: str, party: str) -> set[str]:
	rows = frappe.get_all(
		"Allowed To Transact With",
		filters={"parenttype": party_type, "parent": party},
		pluck="company",
	)
	return set(rows)


def _get_internal_customer_for_pair(selling_company: str, buying_company: str) -> str:
	"""Internal customer on seller's books representing the buyer."""
	candidates = frappe.get_all(
		"Customer",
		filters={
			"disabled": 0,
			"is_internal_customer": 1,
			"represents_company": buying_company,
		},
		fields=["name"],
	)
	for row in candidates:
		if selling_company in _allowed_companies_for_party("Customer", row.name):
			return row.name

	frappe.throw(
		_(
			"No internal customer found on {0} representing {1}. "
			"Configure Customer (Is Internal Customer, Represents Company, Allowed To Transact With)."
		).format(frappe.bold(selling_company), frappe.bold(buying_company))
	)


def _get_internal_supplier_for_pair(buying_company: str, selling_company: str) -> str:
	"""Internal supplier on buyer's books representing the seller."""
	candidates = frappe.get_all(
		"Supplier",
		filters={
			"disabled": 0,
			"is_internal_supplier": 1,
			"represents_company": selling_company,
		},
		fields=["name"],
	)
	for row in candidates:
		if buying_company in _allowed_companies_for_party("Supplier", row.name):
			return row.name

	frappe.throw(
		_(
			"No internal supplier found on {0} representing {1}. "
			"Configure Supplier (Is Internal Supplier, Represents Company, Allowed To Transact With)."
		).format(frappe.bold(buying_company), frappe.bold(selling_company))
	)


def _resolve_company_pair(
	from_company: str,
	to_company: str,
	customer: str | None = None,
	supplier: str | None = None,
) -> dict[str, str]:
	"""Resolve internal customer (AR) and supplier (AP) for a seller→buyer pair."""
	if from_company == to_company:
		frappe.throw(_("from_company and to_company must be different."))

	if not frappe.db.exists("Company", from_company):
		frappe.throw(_("Company {0} does not exist.").format(from_company))
	if not frappe.db.exists("Company", to_company):
		frappe.throw(_("Company {0} does not exist.").format(to_company))

	resolved_customer = customer or _get_internal_customer_for_pair(from_company, to_company)
	resolved_supplier = supplier or _get_internal_supplier_for_pair(to_company, from_company)

	if frappe.db.get_value("Customer", resolved_customer, "represents_company") != to_company:
		frappe.throw(_("Customer {0} does not represent company {1}.").format(resolved_customer, to_company))
	if frappe.db.get_value("Supplier", resolved_supplier, "represents_company") != from_company:
		frappe.throw(_("Supplier {0} does not represent company {1}.").format(resolved_supplier, from_company))

	return {
		"from_company": from_company,
		"to_company": to_company,
		"internal_customer": resolved_customer,
		"internal_supplier": resolved_supplier,
	}


def _append_invoice_items(doc: frappe.model.document.Document, items: list[dict]) -> None:
	for row in items:
		doc.append(
			"items",
			{
				"item_code": row["item_code"],
				"qty": flt(row.get("qty", 1)),
				"rate": flt(row.get("rate", 0)),
				"description": row.get("description"),
				"warehouse": row.get("warehouse"),
			},
		)


def _invoice_summary(doctype: str, name: str | None) -> dict | None:
	if not name or not frappe.db.exists(doctype, name):
		return None

	doc = frappe.get_doc(doctype, name)
	return {
		"doctype": doctype,
		"name": doc.name,
		"docstatus": doc.docstatus,
		"status": getattr(doc, "status", None),
		"company": getattr(doc, "company", None),
		"party": getattr(doc, "customer", None) or getattr(doc, "supplier", None),
		"grand_total": flt(getattr(doc, "grand_total", 0)),
		"outstanding_amount": flt(getattr(doc, "outstanding_amount", 0)),
		"posting_date": str(getattr(doc, "posting_date", "")),
		"inter_company_invoice_reference": getattr(doc, "inter_company_invoice_reference", None),
	}


@frappe.whitelist()
def list_intercompany_accounts(company: str | None = None) -> list[dict]:
	"""List configured intercompany company pairs with internal customer/supplier links."""
	pairs: dict[tuple[str, str], dict] = {}

	customers = frappe.get_all(
		"Customer",
		filters={"disabled": 0, "is_internal_customer": 1},
		fields=["name", "represents_company"],
	)
	for cust in customers:
		if not cust.represents_company:
			continue
		for selling_company in _allowed_companies_for_party("Customer", cust.name):
			if company and company not in (selling_company, cust.represents_company):
				continue
			key = (selling_company, cust.represents_company)
			entry = pairs.setdefault(
				key,
				{
					"from_company": selling_company,
					"to_company": cust.represents_company,
					"internal_customer": cust.name,
					"internal_supplier": None,
				},
			)
			entry["internal_customer"] = cust.name

	suppliers = frappe.get_all(
		"Supplier",
		filters={"disabled": 0, "is_internal_supplier": 1},
		fields=["name", "represents_company"],
	)
	for supp in suppliers:
		if not supp.represents_company:
			continue
		for buying_company in _allowed_companies_for_party("Supplier", supp.name):
			if company and company not in (buying_company, supp.represents_company):
				continue
			key = (supp.represents_company, buying_company)
			entry = pairs.setdefault(
				key,
				{
					"from_company": supp.represents_company,
					"to_company": buying_company,
					"internal_customer": None,
					"internal_supplier": supp.name,
				},
			)
			entry["internal_supplier"] = supp.name

	result = []
	for (_from, _to), row in sorted(pairs.items()):
		row["pair_key"] = f"{_from}|{_to}"
		row["ar_side"] = {
			"company": row["from_company"],
			"doctype": "Sales Invoice",
			"party_type": "Customer",
			"party": row["internal_customer"],
		}
		row["ap_side"] = {
			"company": row["to_company"],
			"doctype": "Purchase Invoice",
			"party_type": "Supplier",
			"party": row["internal_supplier"],
		}
		row["configured"] = bool(row["internal_customer"] and row["internal_supplier"])
		result.append(row)

	return result


@frappe.whitelist()
def create_intercompany_sales_invoice(
	from_company: str,
	to_company: str,
	items: str | list[dict],
	posting_date: str | None = None,
	customer: str | None = None,
	submit: int | bool = 0,
) -> dict:
	"""Create Sales Invoice on seller (from_company) — posts to AR for intercompany customer."""
	items = _parse_json(items)
	if not items:
		frappe.throw(_("At least one item is required."))

	pair = _resolve_company_pair(from_company, to_company, customer=customer)

	si = frappe.new_doc("Sales Invoice")
	si.company = from_company
	si.customer = pair["internal_customer"]
	si.is_internal_customer = 1
	si.posting_date = posting_date or nowdate()
	_append_invoice_items(si, items)
	si.set_missing_values()
	si.insert()

	if frappe.utils.cint(submit):
		si.submit()

	return {
		"from_company": from_company,
		"to_company": to_company,
		"internal_customer": pair["internal_customer"],
		"sales_invoice": si.name,
		"docstatus": si.docstatus,
		"grand_total": flt(si.grand_total),
		"ledger_side": "AR",
		"status": si.status,
	}


@frappe.whitelist()
def create_intercompany_purchase_invoice(
	from_company: str,
	to_company: str,
	items: str | list[dict],
	posting_date: str | None = None,
	supplier: str | None = None,
	submit: int | bool = 0,
) -> dict:
	"""Create Purchase Invoice on buyer (to_company) — posts to AP for intercompany supplier."""
	items = _parse_json(items)
	if not items:
		frappe.throw(_("At least one item is required."))

	pair = _resolve_company_pair(from_company, to_company, supplier=supplier)

	pi = frappe.new_doc("Purchase Invoice")
	pi.company = to_company
	pi.supplier = pair["internal_supplier"]
	pi.is_internal_supplier = 1
	pi.posting_date = posting_date or nowdate()
	_append_invoice_items(pi, items)
	pi.set_missing_values()
	pi.insert()

	if frappe.utils.cint(submit):
		pi.submit()

	return {
		"from_company": from_company,
		"to_company": to_company,
		"internal_supplier": pair["internal_supplier"],
		"purchase_invoice": pi.name,
		"docstatus": pi.docstatus,
		"grand_total": flt(pi.grand_total),
		"ledger_side": "AP",
		"status": pi.status,
	}


@frappe.whitelist()
def create_intercompany_invoice_pair(
	from_company: str,
	to_company: str,
	items: str | list[dict],
	posting_date: str | None = None,
	customer: str | None = None,
	supplier: str | None = None,
	submit: int | bool = 1,
) -> dict:
	"""Create linked Sales Invoice (AR) and Purchase Invoice (AP) for a company pair."""
	from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_inter_company_purchase_invoice

	si_result = create_intercompany_sales_invoice(
		from_company=from_company,
		to_company=to_company,
		items=items,
		posting_date=posting_date,
		customer=customer,
		submit=0,
	)

	si_name = si_result["sales_invoice"]
	pi = make_inter_company_purchase_invoice(si_name)

	if frappe.utils.cint(submit):
		if frappe.db.get_value("Sales Invoice", si_name, "docstatus") == 0:
			frappe.get_doc("Sales Invoice", si_name).submit()
		pi.insert()
		pi.submit()
	else:
		pi.insert()

	return {
		"from_company": from_company,
		"to_company": to_company,
		"internal_customer": si_result["internal_customer"],
		"internal_supplier": pi.supplier,
		"sales_invoice": si_name,
		"purchase_invoice": pi.name,
		"sales_invoice_docstatus": frappe.db.get_value("Sales Invoice", si_name, "docstatus"),
		"purchase_invoice_docstatus": pi.docstatus,
		"ledger_sides": {"seller": "AR", "buyer": "AP"},
	}


@frappe.whitelist()
def submit_intercompany_invoice(
	sales_invoice: str | None = None,
	purchase_invoice: str | None = None,
) -> dict:
	"""Submit one or both intercompany invoices (SI and/or PI)."""
	result: dict[str, Any] = {}

	if sales_invoice:
		si = frappe.get_doc("Sales Invoice", sales_invoice)
		if si.docstatus == 0:
			si.submit()
		result["sales_invoice"] = _invoice_summary("Sales Invoice", si.name)

	if purchase_invoice:
		pi = frappe.get_doc("Purchase Invoice", purchase_invoice)
		if pi.docstatus == 0:
			pi.submit()
		result["purchase_invoice"] = _invoice_summary("Purchase Invoice", pi.name)

	if not sales_invoice and not purchase_invoice:
		frappe.throw(_("Provide sales_invoice and/or purchase_invoice."))

	return result


@frappe.whitelist()
def get_intercompany_invoice_status(
	sales_invoice: str | None = None,
	purchase_invoice: str | None = None,
) -> dict:
	"""Trace AR/AP posting status for intercompany invoice(s)."""
	if sales_invoice and not purchase_invoice:
		purchase_invoice = frappe.db.get_value(
			"Sales Invoice", sales_invoice, "inter_company_invoice_reference"
		)
	elif purchase_invoice and not sales_invoice:
		sales_invoice = frappe.db.get_value(
			"Purchase Invoice", purchase_invoice, "inter_company_invoice_reference"
		)

	if not sales_invoice and not purchase_invoice:
		frappe.throw(_("Provide sales_invoice and/or purchase_invoice."))

	si_summary = _invoice_summary("Sales Invoice", sales_invoice)
	pi_summary = _invoice_summary("Purchase Invoice", purchase_invoice)

	linked = False
	if si_summary and pi_summary:
		si_ref = si_summary.get("inter_company_invoice_reference")
		pi_ref = pi_summary.get("inter_company_invoice_reference")
		linked = si_ref == pi_summary.get("name") and pi_ref == si_summary.get("name")

	ar_posted = bool(si_summary and si_summary.get("docstatus") == 1)
	ap_posted = bool(pi_summary and pi_summary.get("docstatus") == 1)

	return {
		"sales_invoice": si_summary,
		"purchase_invoice": pi_summary,
		"linked": linked,
		"ar_posted": ar_posted,
		"ap_posted": ap_posted,
		"fully_posted": ar_posted and ap_posted,
		"ledger_sides": {
			"sales_invoice": "AR",
			"purchase_invoice": "AP",
		},
	}
