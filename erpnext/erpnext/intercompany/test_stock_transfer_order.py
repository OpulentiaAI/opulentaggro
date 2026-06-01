# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Unit tests for intercompany Stock Transfer Order API helpers."""

from types import SimpleNamespace

import frappe
from frappe.tests import IntegrationTestCase

from erpnext.intercompany.stock_transfer_order import (
	STO_STAGES,
	_PoStageContext,
	_infer_stage,
	_parse_json,
	list_stock_transfer_orders,
)


class TestStockTransferOrderHelpers(IntegrationTestCase):
	def test_parse_json_string(self):
		self.assertEqual(_parse_json('[{"item_code": "X"}]'), [{"item_code": "X"}])
		self.assertEqual(_parse_json("plain"), "plain")

	def test_po_stage_context(self):
		ctx = _PoStageContext("PO-TEST", 0, "Draft")
		self.assertEqual(ctx.name, "PO-TEST")
		self.assertEqual(ctx.docstatus, 0)

	def test_infer_stage_draft(self):
		po = SimpleNamespace(name="PO-NEW", docstatus=0, status="Draft")
		self.assertEqual(_infer_stage(po), "Draft")

	def test_infer_stage_cancelled(self):
		po = SimpleNamespace(name="PO-CAN", docstatus=2, status="Cancelled")
		self.assertEqual(_infer_stage(po), "Cancelled")

	def test_list_stock_transfer_orders_respects_limit(self):
		"""List endpoint should not load full PO documents (performance)."""
		result = list_stock_transfer_orders(limit=5, include_stage=0)
		self.assertIsInstance(result, list)
		self.assertLessEqual(len(result), 5)

	def test_sto_stages_defined(self):
		self.assertIn("Draft", STO_STAGES)
		self.assertIn("Three Way Matched", STO_STAGES)
