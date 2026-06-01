# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""Unit tests for intercompany billing API helpers."""

from frappe.tests import IntegrationTestCase

from erpnext.intercompany.intercompany_billing import (
	_parse_json,
	list_intercompany_accounts,
)


class TestIntercompanyBillingHelpers(IntegrationTestCase):
	def test_parse_json_string(self):
		self.assertEqual(_parse_json('[{"item_code": "X"}]'), [{"item_code": "X"}])
		self.assertEqual(_parse_json("plain"), "plain")

	def test_list_intercompany_accounts_returns_list(self):
		result = list_intercompany_accounts()
		self.assertIsInstance(result, list)
		for row in result:
			self.assertIn("from_company", row)
			self.assertIn("to_company", row)
			self.assertIn("pair_key", row)
			self.assertIn("configured", row)

	def test_list_intercompany_accounts_company_filter(self):
		companies = {r["from_company"] for r in list_intercompany_accounts()} | {
			r["to_company"] for r in list_intercompany_accounts()
		}
		if not companies:
			return
		sample = next(iter(companies))
		filtered = list_intercompany_accounts(company=sample)
		for row in filtered:
			self.assertTrue(sample in (row["from_company"], row["to_company"]))
