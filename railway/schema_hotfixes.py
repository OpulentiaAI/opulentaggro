"""Idempotent schema fixes when bench migrate skips columns (e.g. version skew on Railway)."""

from __future__ import annotations

import frappe

# (table, column, ddl) — keep in sync with erpnext DocType fields used at desk boot
_HOTFIXES: list[tuple[str, str, str]] = [
    (
        "tabCompany",
        "default_letter_head_report",
        "ALTER TABLE `tabCompany` ADD COLUMN `default_letter_head_report` varchar(140) DEFAULT NULL",
    ),
]


def run() -> None:
    for table, column, ddl in _HOTFIXES:
        exists = frappe.db.sql(
            f"SHOW COLUMNS FROM `{table.replace('`', '')}` LIKE %s", (column,)
        )
        if exists:
            continue
        frappe.db.sql(ddl)
        frappe.db.commit()
        print(f"[schema_hotfixes] added {table}.{column}")
