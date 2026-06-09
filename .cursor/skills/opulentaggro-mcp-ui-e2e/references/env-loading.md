# Environment loading

## Local (`scripts/load_env.sh`)

Loads `config/demo-credentials.env`:

```bash
source scripts/load_env.sh
export ERPNEXT_NO_AUTH=1   # localhost MCP only
```

Sets: `ERPNEXT_URL=http://localhost:8000`, `ERPNEXT_DEV_USER`, `ERPNEXT_DEV_PASSWORD`, optional API keys.

## Hosted (`scripts/load_cloud_agent_env.sh`)

Loads `config/cloud-agent-remote.env`:

```bash
source scripts/load_cloud_agent_env.sh
```

Sets: Railway `ERPNEXT_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET`, `VERCEL_URL`, `VERCEL_MCP_URL`, test company vars.

Template: `config/cloud-agent-remote.env.example`

## Vercel MCP SSE headers

```
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <MCP_AUTH_TOKEN>   # production only
```

## zsh note

Wrap in bash when sourcing:

```bash
bash -lc 'source scripts/load_env.sh && python3 scripts/test_all_41_mcp_tools.py'
```
