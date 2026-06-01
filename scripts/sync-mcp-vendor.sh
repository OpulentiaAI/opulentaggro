#!/usr/bin/env bash
# Sync erpnext-mcp-server build into vercel/vendor for self-contained Vercel deploys.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/erpnext-mcp-server"
DEST="$ROOT/vercel/vendor/erpnext-mcp-server"

cd "$SRC"
npm run build

rm -rf "$DEST"
mkdir -p "$DEST/build"
cp "$SRC/build/"*.js "$DEST/build/"

cat > "$DEST/package.json" <<'EOF'
{
  "name": "erpnext-mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./build/index.js",
    "./create-server": "./build/create-server.js",
    "./erpnext-client": "./build/erpnext-client.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "axios": "^1.8.4",
    "zod": "^3.25.0 || ^4.0.0"
  }
}
EOF

echo "Synced erpnext-mcp-server -> vercel/vendor/erpnext-mcp-server"
