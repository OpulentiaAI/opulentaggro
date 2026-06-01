"""Print Administrator API keys for Railway → Vercel sync.

Usage (inside bench):
  bench --site SITE execute erpnext.intercompany.print_admin_api_keys.run

Copied into the image as erpnext/intercompany/print_admin_api_keys.py during Docker build.
"""

from __future__ import annotations


def run() -> None:
    import frappe
    from frappe.core.doctype.user.user import generate_keys

    user = frappe.get_doc("User", "Administrator")
    if not user.api_key:
        generate_keys("Administrator")
        user.reload()

    api_secret = user.get_password("api_secret")
    print(f"ERPNEXT_API_KEY={user.api_key}")
    print(f"ERPNEXT_API_SECRET={api_secret}")
