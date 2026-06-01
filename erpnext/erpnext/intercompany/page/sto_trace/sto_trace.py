# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

import frappe
from frappe import _

from erpnext.intercompany.stock_transfer_order import STO_STAGES


@frappe.whitelist()
def get_sto_trace_page_data(purchase_order: str) -> dict:
	"""Return trace payload plus workflow metadata for the desk trace page."""
	from erpnext.intercompany.stock_transfer_order import get_stock_transfer_trace

	trace = get_stock_transfer_trace(purchase_order)
	stage = trace.get("stage")
	stage_index = list(STO_STAGES).index(stage) if stage in STO_STAGES else -1

	return {
		**trace,
		"stages": list(STO_STAGES),
		"stage_index": stage_index,
		"brand": "OpulentAggro",
	}
