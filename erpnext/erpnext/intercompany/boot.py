# Copyright (c) 2026, Opulent AI and contributors
# License: GNU General Public License v3. See license.txt

"""OpulentAggro boot extensions for Frappe desk."""


def extend_boot_session(bootinfo):
	"""Inject OpulentAggro branding and Pierre theme metadata into desk boot."""
	bootinfo.opulentaggro = {
		"brand": "OpulentAggro",
		"theme": "pierre",
		"theme_accent": "#009fff",
	}

	if hasattr(bootinfo, "page_info") and bootinfo.page_info is not None:
		bootinfo.page_info.update(
			{
				"Stock Transfer Orders": {"title": "Stock Transfer Orders", "route": "sto-dashboard"},
				"STO Trace": {"title": "STO Trace", "route": "sto-trace"},
			}
		)
