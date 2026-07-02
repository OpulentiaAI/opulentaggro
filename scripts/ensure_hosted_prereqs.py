"""Railway entrypoint wrapper — delegates to erpnext.intercompany.ensure_hosted_prereqs.

Copied into the Railway image as hosted_prereqs.py (see railway/Dockerfile).
"""


def run():
	from erpnext.intercompany.ensure_hosted_prereqs import run as _run

	return _run()
