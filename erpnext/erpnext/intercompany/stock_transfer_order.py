# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Intercompany Stock Transfer Order (STO) API.

Maps AgroFresh-style intercompany stock transfer workflow onto ERPNext internal
transfer documents (Internal Purchase Order → Sales Order → Delivery Note →
Purchase Receipt → Sales/Purchase Invoice).
"""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import add_days, flt, getdate, nowdate


STO_STAGES = (
	"Draft",
	"Pending Approval",
	"Approved",
	"Goods In Transit",
	"IC Invoiced",
	"Received",
	"Three Way Matched",
	"Dispute",
	"Completed",
)


def _parse_json(value: Any) -> Any:
	if isinstance(value, str):
		try:
			return json.loads(value)
		except json.JSONDecodeError:
			return value
	return value


def _ensure_internal_po(po_name: str) -> frappe.model.document.Document:
	po = frappe.get_doc("Purchase Order", po_name)
	if not po.is_internal_supplier:
		frappe.throw(_("Purchase Order {0} is not an internal supplier STO.").format(po_name))
	return po


def _get_linked_sales_order(po_name: str) -> str | None:
	po_ref = frappe.db.get_value("Purchase Order", po_name, "inter_company_order_reference")
	if po_ref:
		return po_ref

	return frappe.db.get_value(
		"Sales Order",
		{"inter_company_order_reference": po_name, "docstatus": ["!=", 2]},
		"name",
	)


def _get_delivery_notes_for_po(po_name: str) -> list[str]:
	return frappe.get_all(
		"Delivery Note Item",
		filters={"purchase_order": po_name, "docstatus": ["!=", 2]},
		pluck="parent",
		distinct=True,
	)


def _get_purchase_receipts_for_po(po_name: str) -> list[str]:
	return frappe.get_all(
		"Purchase Receipt Item",
		filters={"purchase_order": po_name, "docstatus": ["!=", 2]},
		pluck="parent",
		distinct=True,
	)


def _get_sales_invoices_for_po(po_name: str) -> list[str]:
	return frappe.get_all(
		"Sales Invoice Item",
		filters={"purchase_order": po_name, "docstatus": ["!=", 2]},
		pluck="parent",
		distinct=True,
	)


def _get_purchase_invoices_for_po(po_name: str) -> list[str]:
	pi_names = set(
		frappe.get_all(
			"Purchase Invoice Item",
			filters={"purchase_order": po_name, "docstatus": ["!=", 2]},
			pluck="parent",
		)
	)

	for si in _get_sales_invoices_for_po(po_name):
		ref = frappe.db.get_value("Sales Invoice", si, "inter_company_invoice_reference")
		if ref:
			pi_names.add(ref)

	return sorted(pi_names)




def _default_stores_warehouse(company: str) -> str:
	warehouses = frappe.get_all(
		"Warehouse",
		filters={"company": company, "warehouse_name": "Stores", "is_group": 0},
		pluck="name",
		limit=1,
	)
	if warehouses:
		return warehouses[0]
	warehouses = frappe.get_all(
		"Warehouse",
		filters={"company": company, "is_group": 0},
		pluck="name",
		limit=1,
	)
	if not warehouses:
		frappe.throw(_("No warehouse found for company {0}.").format(company))
	return warehouses[0]

def _resolve_in_transit_warehouse(po: frappe.model.document.Document, in_transit_warehouse: str | None) -> str:
	if in_transit_warehouse:
		return in_transit_warehouse

	git = frappe.db.get_value(
		"Warehouse",
		{"company": po.company, "warehouse_name": ["like", "%GIT%"], "is_group": 0},
		"name",
	)
	if git:
		return git

	warehouses = frappe.get_all(
		"Warehouse",
		filters={"company": po.company, "is_group": 0},
		pluck="name",
		limit=1,
	)
	if not warehouses:
		frappe.throw(_("No warehouse found for company {0}.").format(po.company))
	return warehouses[0]


def _doc_summary(doctype: str, name: str | None) -> dict | None:
	if not name or not frappe.db.exists(doctype, name):
		return None

	doc = frappe.get_doc(doctype, name)
	return {
		"doctype": doctype,
		"name": doc.name,
		"docstatus": doc.docstatus,
		"status": getattr(doc, "status", None),
		"company": getattr(doc, "company", None),
	}


class _PoStageContext:
	"""Minimal PO fields for stage inference without loading child tables."""

	def __init__(self, name: str, docstatus: int, status: str | None = None):
		self.name = name
		self.docstatus = docstatus
		self.status = status


def _infer_stage(po: frappe.model.document.Document | _PoStageContext, *, quick: bool = False) -> str:
	if po.docstatus == 0:
		return "Draft"
	if po.docstatus == 2:
		return "Cancelled"

	so = _get_linked_sales_order(po.name)
	dns = _get_delivery_notes_for_po(po.name)
	prs = _get_purchase_receipts_for_po(po.name)
	sis = _get_sales_invoices_for_po(po.name)
	pis = _get_purchase_invoices_for_po(po.name)

	if po.status == "Completed":
		return "Completed"
	if prs and sis and pis:
		if quick:
			return "Reconciliation Pending"
		match = run_stock_transfer_three_way_match(po.name, return_only=True)
		if match.get("matched"):
			return "Three Way Matched"
		return "Dispute"
	if prs:
		return "Received"
	if sis and pis:
		return "IC Invoiced"
	if dns:
		return "Goods In Transit"
	if so:
		return "Approved"
	if po.docstatus == 1:
		return "Pending Approval"
	return "Draft"


@frappe.whitelist()
def create_stock_transfer_order(
	company: str,
	supplier: str,
	items: str | list[dict],
	transaction_date: str | None = None,
	schedule_date: str | None = None,
	from_warehouse: str | None = None,
	warehouse: str | None = None,
	submit: int | bool = 0,
) -> dict:
	"""Create an intercompany stock transfer order as an internal Purchase Order."""
	items = _parse_json(items)
	if not items:
		frappe.throw(_("At least one item is required for a stock transfer order."))

	if not frappe.db.get_value("Supplier", supplier, "is_internal_supplier"):
		frappe.throw(_("Supplier {0} must be flagged as an internal supplier.").format(supplier))

	if not warehouse:
		warehouse = _default_stores_warehouse(company)

	po = frappe.new_doc("Purchase Order")
	po.company = company
	po.supplier = supplier
	po.is_internal_supplier = 1
	po.transaction_date = transaction_date or nowdate()
	po.schedule_date = schedule_date or add_days(nowdate(), 1)

	po.buying_price_list = po.buying_price_list or "Standard Selling"

	for row in items:
		po.append(
			"items",
			{
				"item_code": row["item_code"],
				"qty": flt(row.get("qty", 1)),
				"rate": flt(row.get("rate", 0)),
				"warehouse": row.get("warehouse") or warehouse,
				"from_warehouse": row.get("from_warehouse") or from_warehouse,
				"schedule_date": row.get("schedule_date") or po.schedule_date,
			},
		)

	po.set_missing_values()
	po.insert()

	if frappe.utils.cint(submit):
		po.submit()

	return {
		"purchase_order": po.name,
		"docstatus": po.docstatus,
		"stage": _infer_stage(po),
		"status": po.status,
	}


@frappe.whitelist()
def submit_stock_transfer_order(purchase_order: str) -> dict:
	"""Submit a draft STO (DoA approval / post). Idempotent if already submitted."""
	po = _ensure_internal_po(purchase_order)
	if po.docstatus == 1:
		return {
			"purchase_order": po.name,
			"docstatus": po.docstatus,
			"stage": _infer_stage(po),
			"status": po.status,
			"already_submitted": True,
		}
	if po.docstatus != 0:
		frappe.throw(_("Stock transfer order {0} is not in draft state.").format(purchase_order))

	po.submit()
	return {
		"purchase_order": po.name,
		"docstatus": po.docstatus,
		"stage": _infer_stage(po),
		"status": po.status,
	}


@frappe.whitelist()
def approve_and_route_stock_transfer(
	purchase_order: str,
	delivery_date: str | None = None,
	submit: int | bool = 1,
) -> dict:
	"""Create the sender-side Sales Order from an approved internal PO."""
	from erpnext.buying.doctype.purchase_order.purchase_order import make_inter_company_sales_order

	po = _ensure_internal_po(purchase_order)
	if po.docstatus != 1:
		frappe.throw(_("Stock transfer order {0} must be submitted before routing.").format(purchase_order))

	existing_so = _get_linked_sales_order(purchase_order)
	if existing_so:
		so = frappe.get_doc("Sales Order", existing_so)
	else:
		so = make_inter_company_sales_order(purchase_order)
		del_date = getdate(delivery_date or po.schedule_date or add_days(nowdate(), 1))
		represents_company = frappe.db.get_value("Supplier", po.supplier, "represents_company")
		source_wh = _default_stores_warehouse(represents_company) if represents_company else None
		for item in so.items:
			item.delivery_date = del_date
			if source_wh and not item.warehouse:
				item.warehouse = source_wh

		so.insert()
		if frappe.utils.cint(submit):
			so.submit()

	return {
		"purchase_order": purchase_order,
		"sales_order": so.name,
		"sales_order_docstatus": so.docstatus,
		"stage": _infer_stage(po),
	}


@frappe.whitelist()
def post_goods_in_transit(
	purchase_order: str,
	in_transit_warehouse: str | None = None,
	submit: int | bool = 1,
) -> dict:
	"""Sender confirms delivery and posts goods in transit (SAP movement 643 equivalent)."""
	from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

	po = _ensure_internal_po(purchase_order)
	if po.docstatus != 1:
		frappe.throw(_("Stock transfer order {0} must be submitted.").format(purchase_order))

	so_name = _get_linked_sales_order(purchase_order)
	if not so_name:
		frappe.throw(_("No linked Sales Order found for {0}. Run approve_and_route first.").format(purchase_order))

	so = frappe.get_doc("Sales Order", so_name)
	if so.docstatus != 1:
		frappe.throw(_("Linked Sales Order {0} must be submitted.").format(so_name))

	git_warehouse = _resolve_in_transit_warehouse(po, in_transit_warehouse)

	existing_dns = _get_delivery_notes_for_po(purchase_order)
	for dn_name in existing_dns:
		existing = frappe.get_doc("Delivery Note", dn_name)
		if existing.docstatus == 1:
			return {
				"purchase_order": purchase_order,
				"sales_order": so_name,
				"delivery_note": existing.name,
				"in_transit_warehouse": git_warehouse,
				"movement_type": "643",
				"stage": _infer_stage(po),
				"already_posted": True,
			}

	dn = make_delivery_note(so_name)

	for item in dn.items:
		item.target_warehouse = git_warehouse

	if frappe.utils.cint(submit):
		dn.insert()
		dn.submit()
	else:
		dn.insert()

	return {
		"purchase_order": purchase_order,
		"sales_order": so_name,
		"delivery_note": dn.name,
		"in_transit_warehouse": git_warehouse,
		"movement_type": "643",
		"stage": _infer_stage(po),
	}


@frappe.whitelist()
def create_intercompany_invoice(purchase_order: str, submit: int | bool = 1) -> dict:
	"""Auto-create intercompany Sales Invoice and Purchase Invoice."""
	from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_inter_company_purchase_invoice
	from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

	po = _ensure_internal_po(purchase_order)
	so_name = _get_linked_sales_order(purchase_order)
	if not so_name:
		frappe.throw(_("No linked Sales Order found for {0}.").format(purchase_order))

	si = make_sales_invoice(so_name)
	if frappe.utils.cint(submit):
		si.insert()
		si.submit()
	else:
		si.insert()

	pi = make_inter_company_purchase_invoice(si.name)
	if frappe.utils.cint(submit):
		pi.insert()
		pi.submit()
	else:
		pi.insert()

	return {
		"purchase_order": purchase_order,
		"sales_order": so_name,
		"sales_invoice": si.name,
		"purchase_invoice": pi.name,
		"stage": _infer_stage(po),
	}


@frappe.whitelist()
def post_stock_transfer_receipt(
	purchase_order: str | None = None,
	delivery_note: str | None = None,
	submit: int | bool = 1,
) -> dict:
	"""Requestor posts goods receipt (intercompany Purchase Receipt)."""
	from erpnext.stock.doctype.delivery_note.delivery_note import make_inter_company_purchase_receipt

	if not delivery_note:
		if not purchase_order:
			frappe.throw(_("Either purchase_order or delivery_note is required."))
		delivery_notes = _get_delivery_notes_for_po(purchase_order)
		if not delivery_notes:
			frappe.throw(_("No Delivery Note found for {0}.").format(purchase_order))
		delivery_note = delivery_notes[0]

	dn = frappe.get_doc("Delivery Note", delivery_note)
	po_name = purchase_order or dn.items[0].purchase_order
	po = _ensure_internal_po(po_name)

	existing_prs = _get_purchase_receipts_for_po(po_name)
	for pr_name in existing_prs:
		existing = frappe.get_doc("Purchase Receipt", pr_name)
		if existing.docstatus == 1:
			return {
				"purchase_order": po_name,
				"delivery_note": delivery_note,
				"purchase_receipt": existing.name,
				"stage": _infer_stage(po),
				"already_posted": True,
			}

	pr = make_inter_company_purchase_receipt(delivery_note)
	if frappe.utils.cint(submit):
		pr.insert()
		pr.submit()
	else:
		pr.insert()

	return {
		"purchase_order": po_name,
		"delivery_note": delivery_note,
		"purchase_receipt": pr.name,
		"stage": _infer_stage(po),
	}


@frappe.whitelist()
def get_stock_transfer_trace(purchase_order: str) -> dict:
	"""Return the full STO document chain and inferred workflow stage."""
	po = _ensure_internal_po(purchase_order)
	so_name = _get_linked_sales_order(purchase_order)
	dns = _get_delivery_notes_for_po(purchase_order)
	prs = _get_purchase_receipts_for_po(purchase_order)
	sis = _get_sales_invoices_for_po(purchase_order)
	pis = _get_purchase_invoices_for_po(purchase_order)

	match_result = None
	if prs and sis and pis:
		match_result = run_stock_transfer_three_way_match(purchase_order, return_only=True)

	from erpnext.intercompany.sto_workflow import (
		get_approval_status,
		get_booking_advice_status,
		get_dispute_status,
	)

	approval = get_approval_status(purchase_order)
	dispute = get_dispute_status(purchase_order)
	booking_advice = get_booking_advice_status(purchase_order)

	clearing_status = None
	if sis and pis:
		try:
			clearing_status = frappe.call(
				"erpnext.intercompany.intercompany_treasury.get_clearing_status",
				sales_invoice=sis[0],
				purchase_invoice=pis[0],
			)
		except Exception:
			clearing_status = None

	return {
		"purchase_order": purchase_order,
		"stage": _infer_stage(po),
		"documents": {
			"purchase_order": _doc_summary("Purchase Order", purchase_order),
			"sales_order": _doc_summary("Sales Order", so_name),
			"delivery_notes": [_doc_summary("Delivery Note", dn) for dn in dns],
			"purchase_receipts": [_doc_summary("Purchase Receipt", pr) for pr in prs],
			"sales_invoices": [_doc_summary("Sales Invoice", si) for si in sis],
			"purchase_invoices": [_doc_summary("Purchase Invoice", pi) for pi in pis],
		},
		"three_way_match": match_result,
		"approval": approval,
		"dispute": dispute,
		"booking_advice": booking_advice,
		"clearing_status": clearing_status,
	}


@frappe.whitelist()
def run_stock_transfer_three_way_match(
	purchase_order: str,
	qty_tolerance_percent: float = 0,
	price_tolerance_percent: float = 0,
	return_only: int | bool = 0,
) -> dict:
	"""Compare STO (PO), goods receipt (PR), and IC invoice (PI) quantities and amounts."""
	po = _ensure_internal_po(purchase_order)
	prs = _get_purchase_receipts_for_po(purchase_order)
	pis = _get_purchase_invoices_for_po(purchase_order)

	if not prs or not pis:
		result = {
			"purchase_order": purchase_order,
			"matched": False,
			"reason": "missing_documents",
			"message": _("Goods receipt and/or purchase invoice not yet posted."),
		}
		if not frappe.utils.cint(return_only):
			return result
		return result

	po_qty = sum(flt(row.qty) for row in po.items)
	po_amount = flt(po.grand_total)

	pr_qty = flt(
		frappe.db.sql(
			"""
			select sum(qty)
			from `tabPurchase Receipt Item`
			where purchase_order = %s and docstatus = 1
			""",
			purchase_order,
		)[0][0]
	)

	pi_amount = flt(
		frappe.db.sql(
			"""
			select sum(grand_total)
			from `tabPurchase Invoice`
			where name in %s and docstatus = 1
			""",
			(pis,),
		)[0][0]
	)

	qty_diff_pct = abs(po_qty - pr_qty) / po_qty * 100 if po_qty else 100
	price_diff_pct = abs(po_amount - pi_amount) / po_amount * 100 if po_amount else 100

	qty_ok = qty_diff_pct <= flt(qty_tolerance_percent)
	price_ok = price_diff_pct <= flt(price_tolerance_percent)
	matched = qty_ok and price_ok

	result = {
		"purchase_order": purchase_order,
		"matched": matched,
		"within_tolerance": matched,
		"qty_tolerance_percent": flt(qty_tolerance_percent),
		"price_tolerance_percent": flt(price_tolerance_percent),
		"comparison": {
			"po_qty": po_qty,
			"pr_qty": pr_qty,
			"qty_variance_percent": qty_diff_pct,
			"po_amount": po_amount,
			"pi_amount": pi_amount,
			"price_variance_percent": price_diff_pct,
		},
		"route": "ic_match_and_clear" if matched else "dispute",
		"documents": {
			"purchase_receipts": prs,
			"purchase_invoices": pis,
		},
	}

	if not matched:
		result["dispute_parties"] = ["Requestor", "Sender"]

	return result


@frappe.whitelist()
def list_stock_transfer_orders(
	company: str | None = None,
	status: str | None = None,
	limit: int = 20,
	include_stage: int | bool = 0,
) -> list[dict]:
	"""List internal purchase orders representing stock transfer orders."""
	filters: dict[str, Any] = {"is_internal_supplier": 1, "docstatus": ["!=", 2]}
	if company:
		filters["company"] = company
	if status:
		filters["status"] = status

	limit = min(max(1, frappe.utils.cint(limit)), 100)

	orders = frappe.get_all(
		"Purchase Order",
		filters=filters,
		fields=["name", "company", "supplier", "status", "docstatus", "transaction_date", "grand_total"],
		order_by="modified desc",
		limit_page_length=limit,
	)

	if frappe.utils.cint(include_stage):
		for row in orders:
			ctx = _PoStageContext(row.name, row.docstatus, row.status)
			row["stage"] = _infer_stage(ctx, quick=True)

	return orders


@frappe.whitelist()
def generate_booking_advice(
	purchase_order: str,
	delivery_note: str | None = None,
) -> dict:
	"""Generate booking advice / BOL document metadata and attach to Delivery Note."""
	import os

	from frappe.utils import get_site_path

	from erpnext.intercompany.sto_workflow import _write_comment, get_booking_advice_status

	po = _ensure_internal_po(purchase_order)
	if not delivery_note:
		dns = _get_delivery_notes_for_po(purchase_order)
		if not dns:
			frappe.throw(_("No Delivery Note found for {0}. Post goods in transit first.").format(purchase_order))
		delivery_note = dns[0]

	existing_bol = get_booking_advice_status(purchase_order)
	if existing_bol:
		return {
			"purchase_order": purchase_order,
			"delivery_note": existing_bol.get("delivery_note") or delivery_note,
			"booking_advice_file": existing_bol.get("file"),
			"file_name": existing_bol.get("file_name"),
			"sharepoint_archive_path": existing_bol.get("sharepoint_archive_path"),
			"sales_order": _get_linked_sales_order(purchase_order),
			"movement_type": "643",
			"already_generated": True,
		}

	dn = frappe.get_doc("Delivery Note", delivery_note)
	so_name = _get_linked_sales_order(purchase_order)
	sender_company = frappe.db.get_value("Supplier", po.supplier, "represents_company") or po.supplier

	html = f"""
	<h2>Booking Advice / Bill of Lading</h2>
	<p><strong>STO:</strong> {purchase_order}</p>
	<p><strong>Delivery Note:</strong> {dn.name}</p>
	<p><strong>Sender:</strong> {sender_company}</p>
	<p><strong>Receiver:</strong> {po.company}</p>
	<p><strong>Date:</strong> {dn.posting_date or nowdate()}</p>
	<p><strong>Movement Type:</strong> 643 (Goods In Transit)</p>
	<hr>
	<table border="1" cellpadding="4">
	<tr><th>Item</th><th>Qty</th><th>UOM</th></tr>
	{"".join(f"<tr><td>{row.item_code}</td><td>{row.qty}</td><td>{row.uom or ''}</td></tr>" for row in dn.items)}
	</table>
	<p><em>OpulentAggro — Tier 2 SharePoint archive path: /sites/IC-Archive/STO/BOL/{purchase_order}.pdf</em></p>
	"""

	file_name = f"BOL-{purchase_order}-{dn.name}.html"
	os.makedirs(get_site_path("public", "files"), exist_ok=True)
	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": file_name,
			"attached_to_doctype": "Delivery Note",
			"attached_to_name": dn.name,
			"content": html,
			"is_private": 0,
		}
	)
	file_doc.insert(ignore_permissions=True)

	_write_comment(
		purchase_order,
		"booking_advice",
		{
			"delivery_note": dn.name,
			"file": file_doc.file_url,
			"sharepoint_archive_path": f"/sites/IC-Archive/STO/BOL/{purchase_order}.pdf",
		},
	)

	return {
		"purchase_order": purchase_order,
		"delivery_note": dn.name,
		"booking_advice_file": file_doc.file_url,
		"file_name": file_name,
		"sharepoint_archive_path": f"/sites/IC-Archive/STO/BOL/{purchase_order}.pdf",
		"sales_order": so_name,
		"movement_type": "643",
	}


@frappe.whitelist()
def request_sto_approval(purchase_order: str, requestor: str | None = None) -> dict:
	"""Request DoA approval for a draft STO (workflow-lite)."""
	from erpnext.intercompany.sto_workflow import get_approval_status, set_approval_status

	po = _ensure_internal_po(purchase_order)
	if po.docstatus != 0:
		frappe.throw(_("Only draft STOs can request approval."))

	payload = set_approval_status(
		purchase_order,
		"Pending Approval",
		requestor=requestor or frappe.session.user,
	)
	return {
		"purchase_order": purchase_order,
		"approval": payload,
		"stage": "Pending Approval",
	}


@frappe.whitelist()
def approve_sto(purchase_order: str, approver: str | None = None) -> dict:
	"""Approve STO — records approval then submits PO (DoA gate)."""
	from erpnext.intercompany.sto_workflow import set_approval_status

	po = _ensure_internal_po(purchase_order)
	if po.docstatus != 0:
		frappe.throw(_("STO {0} is not in draft state.").format(purchase_order))

	set_approval_status(
		purchase_order,
		"Approved",
		approver=approver or frappe.session.user,
	)
	result = submit_stock_transfer_order(purchase_order)
	result["approval"] = {"status": "Approved", "approver": approver or frappe.session.user}
	return result


@frappe.whitelist()
def reject_sto(purchase_order: str, reason: str | None = None, approver: str | None = None) -> dict:
	"""Reject STO approval request (workflow-lite)."""
	from erpnext.intercompany.sto_workflow import set_approval_status

	po = _ensure_internal_po(purchase_order)
	if po.docstatus != 0:
		frappe.throw(_("Only draft STOs can be rejected."))

	payload = set_approval_status(
		purchase_order,
		"Rejected",
		reason=reason,
		approver=approver or frappe.session.user,
	)
	return {
		"purchase_order": purchase_order,
		"approval": payload,
		"stage": "Draft",
	}


@frappe.whitelist()
def open_sto_dispute(
	purchase_order: str,
	reason: str,
	parties: str | list | None = None,
) -> dict:
	"""Open a dispute on an STO (outside three-way match tolerance)."""
	from erpnext.intercompany.sto_workflow import set_dispute_status

	po = _ensure_internal_po(purchase_order)
	parties = _parse_json(parties) if parties else ["Requestor", "Sender"]
	if isinstance(parties, str):
		parties = [parties]

	payload = set_dispute_status(
		purchase_order,
		"Open",
		reason=reason,
		parties=parties,
	)
	return {
		"purchase_order": purchase_order,
		"dispute": payload,
		"stage": _infer_stage(po),
	}


@frappe.whitelist()
def resolve_sto_dispute(
	purchase_order: str,
	resolution: str,
	resolved_by: str | None = None,
) -> dict:
	"""Resolve an open STO dispute."""
	from erpnext.intercompany.sto_workflow import get_dispute_status, set_dispute_status

	po = _ensure_internal_po(purchase_order)
	current = get_dispute_status(purchase_order)
	if not current or current.get("status") != "Open":
		frappe.throw(_("No open dispute found for {0}.").format(purchase_order))

	payload = set_dispute_status(
		purchase_order,
		"Resolved",
		resolution=resolution,
		resolved_by=resolved_by or frappe.session.user,
		previous_reason=current.get("reason"),
	)
	return {
		"purchase_order": purchase_order,
		"dispute": payload,
		"stage": _infer_stage(po),
	}


@frappe.whitelist()
def list_sto_disputes(company: str | None = None, limit: int = 20) -> list[dict]:
	"""List open STO disputes."""
	from erpnext.intercompany.sto_workflow import list_open_disputes

	return list_open_disputes(company=company, limit=limit)
