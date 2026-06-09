# Test harness reference

## test_all_41_mcp_tools.py

**33 of 41** tools exercised per run (8 generic registry-only).

| Group | Tools in harness |
|-------|------------------|
| STO | all 16 |
| IC billing | all 6 |
| IC extended | all 8 |
| Generic | `get_document`, `get_documents`, `call_method` |

### Flags

```bash
python3 scripts/test_all_41_mcp_tools.py --report docs/local-mcp-41-results.json
python3 scripts/test_all_41_mcp_tools.py --direct-only
python3 scripts/test_all_41_mcp_tools.py --mcp-only
```

### Env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `ERPNEXT_URL` | hosted Railway | Direct REST target |
| `ERPNEXT_API_KEY` / `SECRET` | from env files | Auth |
| `VERCEL_MCP_URL` | `{VERCEL_URL}/api/mcp` or `localhost:3000/api/mcp` | SSE transport |
| `MCP_AUTH_TOKEN` | empty local | Bearer for prod |
| `STO_TEST_COMPANY` | Opulent Fresh NA | Create company |
| `STO_TEST_SUPPLIER` | Internal Supplier Opulent Fresh APAC | Internal supplier |
| `STO_TEST_ITEM` | STO-TEST-ITEM-001 | Line item |
| `IC_TEST_FROM_COMPANY` | Opulent Fresh APAC | IC seller |
| `IC_TEST_TO_COMPANY` | Opulent Fresh NA | IC buyer |

### Chain order (abbreviated)

1. List tools (read-only)
2. `sto_create` qty=101
3. DoA: request → approve → submit
4. Separate PO for reject test
5. STO chain: route → GIT → IC invoice → GR → trace → match → BOL → dispute → resolve
6. IC billing: SI, PI, pair, status, submit
7. Treasury: clearing status, match_and_clear
8. Triangular + accrual
9. Generic spot checks

Stock prereq: `_ensure_local_stock_prereqs()` calls `ensure_hosted_prereqs.run` on localhost.

## Other scripts

| Script | Purpose |
|--------|---------|
| `verify_mcp_alignment.sh` | Build + mock + registry |
| `test_local_mcp_ui_screenshots.sh` | 11 UI PNGs |
| `test_all_mcp_endpoints.py` | Legacy 15-tool suite |
| `test_hosted_mcp_e2e.py` | Hosted 15-tool E2E |
| `cloud_agent_validate.sh` | Cloud agent wrapper |
| `ensure_hosted_prereqs.py` | Multi-warehouse stock |

## Exit codes

`test_all_41_mcp_tools.py` returns **0** only when both direct and Vercel MCP show 33/33 PASS.
