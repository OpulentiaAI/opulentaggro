---
name: erpnext-sto-mcp
description: Alias for opulentaggro-sto-mcp — Operates all 41 erpnext-mcp-server tools (sto_*, ic_*, generic). Use opulentaggro-sto-mcp for full schemas; this skill redirects for backward compatibility.
---

# ERPNext STO MCP (redirect)

**Primary skill:** [opulentaggro-sto-mcp](../opulentaggro-sto-mcp/SKILL.md)

Load **opulentaggro-sto-mcp** for:

- All 41 tool catalogs with JSON schemas and UI verification
- Transport (stdio + Vercel SSE `/api/mcp`)
- Workflow diagrams and troubleshooting (7 fixes)
- MCP call → API → UI proof patterns

**E2E testing:** [opulentaggro-mcp-ui-e2e](../opulentaggro-mcp-ui-e2e/SKILL.md)

Legacy reference files in this directory remain for compatibility; canonical copies live under `opulentaggro-sto-mcp/references/`.
