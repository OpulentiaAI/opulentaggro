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
        keys = generate_keys("Administrator")
    else:
        keys = generate_keys("Administrator")
    api_key = keys.get("api_key") or user.api_key
    api_secret = keys.get("api_secret")
    if not api_secret:
        api_secret = user.get_password("api_secret")
    print(f"ERPNEXT_API_KEY={api_key}")
    print(f"ERPNEXT_API_SECRET={api_secret}")
