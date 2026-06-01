#!/usr/bin/env python3
"""Seed minimal master data for intercompany STO testing.

Delegates to seed_mcp_alignment.run (all STO + IC MCP tools).

    bench --site sto.local execute scripts.seed_mcp_alignment.run
"""

from __future__ import annotations


def run() -> dict:
	"""Entry point for bench execute (backward-compatible name)."""
	from erpnext.intercompany import mcp_alignment_seed

	return mcp_alignment_seed.run()
