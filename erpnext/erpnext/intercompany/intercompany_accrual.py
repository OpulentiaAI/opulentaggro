# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Accrual allocation MVP — journal entries for intercompany CO adjustments."""

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


def _accrual_tag() -> str:
	return "[IC:accrual]"


@frappe.whitelist()
def create_accrual_allocation(
	company: str,
	counterparty_company: str,
	amount: float,
	debit_account: str,
	credit_account: str,
	posting_date: str | None = None,
	remarks: str | None = None,
	submit: int | bool = 1,
) -> dict:
	"""Create accrual Journal Entry for intercompany allocation (MVP)."""
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Amount must be positive."))

	for acct in (debit_account, credit_account):
		if not frappe.db.exists("Account", acct):
			frappe.throw(_("Account {0} does not exist.").format(acct))

	from erpnext.intercompany.intercompany_billing import (
		_get_internal_customer_for_pair,
		_get_internal_supplier_for_pair,
	)

	posting_date = posting_date or nowdate()
	je = frappe.new_doc("Journal Entry")
	je.voucher_type = "Journal Entry"
	je.company = company
	je.posting_date = posting_date
	je.user_remark = remarks or _("Intercompany accrual allocation — {0} ↔ {1}").format(
		company, counterparty_company
	)

	def _party_for_account(account: str, is_debit: bool) -> dict[str, str]:
		account_type = frappe.get_cached_value("Account", account, "account_type")
		if account_type == "Receivable":
			return {
				"party_type": "Customer",
				"party": _get_internal_customer_for_pair(company, counterparty_company),
			}
		if account_type == "Payable":
			return {
				"party_type": "Supplier",
				"party": _get_internal_supplier_for_pair(company, counterparty_company),
			}
		return {}

	je.append(
		"accounts",
		{
			"account": debit_account,
			"debit_in_account_currency": amount,
			"credit_in_account_currency": 0,
			**_party_for_account(debit_account, is_debit=True),
		},
	)
	je.append(
		"accounts",
		{
			"account": credit_account,
			"debit_in_account_currency": 0,
			"credit_in_account_currency": amount,
			**_party_for_account(credit_account, is_debit=False),
		},
	)
	je.set_missing_values()
	je.insert(ignore_permissions=True)

	frappe.get_doc(
		{
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": "Journal Entry",
			"reference_name": je.name,
			"content": (
				f"{_accrual_tag()} "
				f'{json.dumps({"counterparty_company": counterparty_company, "amount": amount})}'
			),
		}
	).insert(ignore_permissions=True)

	if frappe.utils.cint(submit):
		je.submit()

	return {
		"journal_entry": je.name,
		"docstatus": je.docstatus,
		"company": company,
		"counterparty_company": counterparty_company,
		"amount": amount,
		"posting_date": posting_date,
		"status": "Submitted" if je.docstatus == 1 else "Draft",
	}


@frappe.whitelist()
def list_accrual_allocations(company: str | None = None, limit: int = 20) -> list[dict]:
	"""List journal entries tagged as intercompany accrual allocations."""
	limit = min(max(1, frappe.utils.cint(limit)), 100)
	rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Journal Entry",
			"content": ["like", f"%{_accrual_tag()}%"],
		},
		fields=["reference_name", "content", "creation"],
		order_by="creation desc",
		limit_page_length=limit * 2,
	)
	seen: set[str] = set()
	out: list[dict] = []
	for row in rows:
		je_name = row.reference_name
		if je_name in seen:
			continue
		seen.add(je_name)
		je = frappe.db.get_value(
			"Journal Entry",
			je_name,
			["name", "company", "posting_date", "total_debit", "docstatus", "user_remark"],
			as_dict=True,
		)
		if not je:
			continue
		if company and je.company != company:
			continue
		meta: dict[str, Any] = {}
		try:
			_, _, rest = row.content.partition("]")
			meta = json.loads(rest.strip() or "{}")
		except json.JSONDecodeError:
			pass
		out.append(
			{
				"journal_entry": je.name,
				"company": je.company,
				"counterparty_company": meta.get("counterparty_company"),
				"amount": flt(meta.get("amount") or je.total_debit),
				"posting_date": str(je.posting_date),
				"docstatus": je.docstatus,
				"remarks": je.user_remark,
				"created_at": str(row.creation),
			}
		)
		if len(out) >= limit:
			break
	return out
