# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

import frappe
from frappe import _

from erpnext.intercompany.stock_transfer_order import STO_STAGES, list_stock_transfer_orders


@frappe.whitelist()
def get_sto_dashboard_data(company: str | None = None, stage: str | None = None, limit: int = 50) -> dict:
	"""Return STO summary cards and list rows for the desk dashboard."""
	orders = list_stock_transfer_orders(company=company, limit=limit)

	if stage and stage != "All":
		orders = [row for row in orders if row.get("stage") == stage]

	stage_counts = {stage_name: 0 for stage_name in STO_STAGES}
	all_orders = list_stock_transfer_orders(company=company, limit=500)
	for row in all_orders:
		stage_counts[row.get("stage", "Draft")] = stage_counts.get(row.get("stage"), 0) + 1

	return {
		"brand": "OpulentAggro",
		"stage_counts": stage_counts,
		"total": len(all_orders),
		"orders": orders,
		"stages": list(STO_STAGES),
	}
