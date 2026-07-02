# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Intercompany treasury — match & clear (F110-lite) and reconciliation helpers."""

from __future__ import annotations

from typing import Any

import frappe
from frappe import _
from frappe.utils import flt, nowdate


def _resolve_invoice_pair(
	sales_invoice: str | None = None,
	purchase_invoice: str | None = None,
) -> tuple[str | None, str | None]:
	if sales_invoice and not purchase_invoice:
		purchase_invoice = frappe.db.get_value(
			"Sales Invoice", sales_invoice, "inter_company_invoice_reference"
		)
	elif purchase_invoice and not sales_invoice:
		sales_invoice = frappe.db.get_value(
			"Purchase Invoice", purchase_invoice, "inter_company_invoice_reference"
		)
	return sales_invoice, purchase_invoice


def _invoice_outstanding(doctype: str, name: str) -> float:
	return flt(frappe.db.get_value(doctype, name, "outstanding_amount"))


def _clearing_comment_tag() -> str:
	return "[IC:cleared]"


@frappe.whitelist()
def match_and_clear_intercompany_invoice(
	sales_invoice: str | None = None,
	purchase_invoice: str | None = None,
	posting_date: str | None = None,
) -> dict:
	"""Clear linked intercompany SI/PI open items via Payment Entries (F110-lite)."""
	sales_invoice, purchase_invoice = _resolve_invoice_pair(sales_invoice, purchase_invoice)
	if not sales_invoice or not purchase_invoice:
		frappe.throw(_("Provide linked sales_invoice and/or purchase_invoice."))

	si = frappe.get_doc("Sales Invoice", sales_invoice)
	pi = frappe.get_doc("Purchase Invoice", purchase_invoice)

	if si.docstatus != 1 or pi.docstatus != 1:
		frappe.throw(_("Both invoices must be submitted before clearing."))

	linked = (
		si.inter_company_invoice_reference == pi.name and pi.inter_company_invoice_reference == si.name
	)
	if not linked:
		if pi.inter_company_invoice_reference == si.name and not si.inter_company_invoice_reference:
			frappe.db.set_value(
				"Sales Invoice",
				sales_invoice,
				"inter_company_invoice_reference",
				purchase_invoice,
				update_modified=False,
			)
			si.inter_company_invoice_reference = purchase_invoice
			linked = True
	if not linked:
		frappe.throw(_("Sales Invoice and Purchase Invoice are not intercompany-linked."))

	existing = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Sales Invoice",
			"reference_name": sales_invoice,
			"content": ["like", f"%{_clearing_comment_tag()}%"],
		},
		limit=1,
	)
	if existing:
		return get_clearing_status(sales_invoice=sales_invoice, purchase_invoice=purchase_invoice)

	posting_date = posting_date or nowdate()
	result: dict[str, Any] = {
		"sales_invoice": sales_invoice,
		"purchase_invoice": purchase_invoice,
		"posting_date": posting_date,
		"payment_entries": [],
	}

	si_outstanding = _invoice_outstanding("Sales Invoice", sales_invoice)
	pi_outstanding = _invoice_outstanding("Purchase Invoice", purchase_invoice)

	if si_outstanding > 0:
		pe = _create_invoice_payment_entry(si, si_outstanding, posting_date)
		result["payment_entries"].append({"doctype": "Payment Entry", "name": pe.name, "side": "AR"})

	if pi_outstanding > 0:
		pe = _create_invoice_payment_entry(pi, pi_outstanding, posting_date)
		result["payment_entries"].append({"doctype": "Payment Entry", "name": pe.name, "side": "AP"})

	frappe.get_doc(
		{
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": "Sales Invoice",
			"reference_name": sales_invoice,
			"content": f"{_clearing_comment_tag()} cleared with {purchase_invoice}",
		}
	).insert(ignore_permissions=True)

	result["status"] = "Cleared"
	result.update(get_clearing_status(sales_invoice=sales_invoice, purchase_invoice=purchase_invoice))
	return result


def _create_invoice_payment_entry(
	invoice: frappe.model.document.Document,
	amount: float,
	posting_date: str,
) -> frappe.model.document.Document:
	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	pe = get_payment_entry(invoice.doctype, invoice.name, party_amount=amount)
	pe.posting_date = posting_date
	pe.reference_no = f"IC-CLEAR-{invoice.name}"
	pe.reference_date = posting_date
	pe.remarks = _("Intercompany match & clear (OpulentAggro F110-lite)")
	pe.insert(ignore_permissions=True)
	pe.submit()
	return pe


@frappe.whitelist()
def get_clearing_status(
	sales_invoice: str | None = None,
	purchase_invoice: str | None = None,
) -> dict:
	"""Return AR/AP outstanding and clearing state for a linked invoice pair."""
	sales_invoice, purchase_invoice = _resolve_invoice_pair(sales_invoice, purchase_invoice)
	if not sales_invoice and not purchase_invoice:
		frappe.throw(_("Provide sales_invoice and/or purchase_invoice."))

	si_out = _invoice_outstanding("Sales Invoice", sales_invoice) if sales_invoice else None
	pi_out = _invoice_outstanding("Purchase Invoice", purchase_invoice) if purchase_invoice else None

	cleared = False
	if sales_invoice:
		cleared = bool(
			frappe.get_all(
				"Comment",
				filters={
					"reference_doctype": "Sales Invoice",
					"reference_name": sales_invoice,
					"content": ["like", f"%{_clearing_comment_tag()}%"],
				},
				limit=1,
			)
		)

	return {
		"sales_invoice": sales_invoice,
		"purchase_invoice": purchase_invoice,
		"ar_outstanding": si_out,
		"ap_outstanding": pi_out,
		"cleared": cleared or (si_out == 0 and pi_out == 0),
		"status": "Cleared" if cleared or (si_out == 0 and pi_out == 0) else "Pending",
	}


@frappe.whitelist()
def list_pending_ic_clearing(company: str | None = None, limit: int = 20) -> list[dict]:
	"""List submitted intercompany invoice pairs with outstanding AR/AP."""
	limit = min(max(1, frappe.utils.cint(limit)), 100)
	filters: dict[str, Any] = {
		"docstatus": 1,
		"is_internal_customer": 1,
		"outstanding_amount": [">", 0],
	}
	if company:
		filters["company"] = company

	sis = frappe.get_all(
		"Sales Invoice",
		filters=filters,
		fields=["name", "company", "customer", "grand_total", "outstanding_amount", "posting_date"],
		order_by="modified desc",
		limit_page_length=limit * 2,
	)

	out: list[dict] = []
	for si in sis:
		pi_name = frappe.db.get_value("Sales Invoice", si.name, "inter_company_invoice_reference")
		if not pi_name:
			continue
		status = get_clearing_status(sales_invoice=si.name, purchase_invoice=pi_name)
		if status.get("cleared"):
			continue
		out.append(
			{
				"sales_invoice": si.name,
				"purchase_invoice": pi_name,
				"seller_company": si.company,
				"buyer_company": frappe.db.get_value("Purchase Invoice", pi_name, "company"),
				"ar_outstanding": status.get("ar_outstanding"),
				"ap_outstanding": status.get("ap_outstanding"),
				"status": status.get("status"),
				"posting_date": str(si.posting_date),
			}
		)
		if len(out) >= limit:
			break
	return out


@frappe.whitelist()
def get_central_reconciliation_summary(company: str | None = None) -> dict:
	"""Cross-company IC reconciliation dashboard data."""
	pending = list_pending_ic_clearing(company=company, limit=50)
	open_disputes = frappe.call(
		"erpnext.intercompany.stock_transfer_order.list_sto_disputes",
		company=company,
		limit=50,
	)

	by_company: dict[str, dict[str, float]] = {}
	for row in pending:
		for key in ("seller_company", "buyer_company"):
			co = row.get(key)
			if not co:
				continue
			entry = by_company.setdefault(co, {"pending_clearing": 0, "ar_outstanding": 0, "ap_outstanding": 0})
			entry["pending_clearing"] += 1
			if key == "seller_company":
				entry["ar_outstanding"] += flt(row.get("ar_outstanding"))
			else:
				entry["ap_outstanding"] += flt(row.get("ap_outstanding"))

	return {
		"company_filter": company,
		"pending_clearing_count": len(pending),
		"open_dispute_count": len(open_disputes) if isinstance(open_disputes, list) else 0,
		"pending_clearing": pending[:20],
		"open_disputes": open_disputes[:20] if isinstance(open_disputes, list) else [],
		"by_company": by_company,
	}
