# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Workflow-lite metadata for STO approval and disputes (Comment-backed)."""

from __future__ import annotations

import json
from typing import Any

import frappe


def _comment_tag(kind: str) -> str:
	return f"[STO:{kind}]"


def _parse_comment_payload(content: str) -> dict[str, Any] | None:
	if not content or not content.startswith("[STO:"):
		return None
	try:
		_, _, rest = content.partition("]")
		return json.loads(rest.strip() or "{}")
	except json.JSONDecodeError:
		return None


def _write_comment(
	purchase_order: str,
	kind: str,
	payload: dict[str, Any],
) -> str:
	content = f"{_comment_tag(kind)} {json.dumps(payload)}"
	doc = frappe.get_doc(
		{
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": "Purchase Order",
			"reference_name": purchase_order,
			"content": content,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _latest_comment(purchase_order: str, kind: str) -> dict[str, Any] | None:
	tag = _comment_tag(kind)
	rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Purchase Order",
			"reference_name": purchase_order,
			"comment_type": "Info",
		},
		fields=["name", "content", "creation", "owner"],
		order_by="creation desc",
		limit=50,
	)
	for row in rows:
		if not row.content or not row.content.startswith(tag):
			continue
		payload = _parse_comment_payload(row.content) or {}
		payload["comment"] = row.name
		payload["created_at"] = str(row.creation)
		payload["created_by"] = row.owner
		return payload
	return None


def get_approval_status(purchase_order: str) -> dict[str, Any]:
	latest = _latest_comment(purchase_order, "approval")
	if not latest:
		return {"status": "Not Requested"}
	return latest


def set_approval_status(purchase_order: str, status: str, **extra: Any) -> dict[str, Any]:
	payload = {"status": status, **extra}
	_write_comment(purchase_order, "approval", payload)
	return payload


def get_dispute_status(purchase_order: str) -> dict[str, Any] | None:
	latest = _latest_comment(purchase_order, "dispute")
	if not latest:
		return None
	return latest


def get_booking_advice_status(purchase_order: str) -> dict[str, Any] | None:
	return _latest_comment(purchase_order, "booking_advice")


def set_dispute_status(purchase_order: str, status: str, **extra: Any) -> dict[str, Any]:
	payload = {"status": status, **extra}
	_write_comment(purchase_order, "dispute", payload)
	return payload


def list_open_disputes(company: str | None = None, limit: int = 20) -> list[dict]:
	limit = min(max(1, frappe.utils.cint(limit)), 100)
	rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Purchase Order",
			"comment_type": "Info",
		},
		fields=["reference_name", "content", "creation", "owner"],
		order_by="creation desc",
		limit_page_length=500,
	)
	seen: set[str] = set()
	out: list[dict] = []
	for row in rows:
		payload = _parse_comment_payload(row.content or "")
		if not payload or payload.get("status") != "Open":
			continue
		po = row.reference_name
		if po in seen:
			continue
		seen.add(po)
		if company and frappe.db.get_value("Purchase Order", po, "company") != company:
			continue
		out.append(
			{
				"purchase_order": po,
				"status": payload.get("status"),
				"reason": payload.get("reason"),
				"parties": payload.get("parties", ["Requestor", "Sender"]),
				"opened_at": str(row.creation),
				"opened_by": row.owner,
			}
		)
		if len(out) >= limit:
			break
	return out
