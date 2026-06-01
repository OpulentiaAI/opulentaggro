# Frappe bench config templates (STO local dev)

Copy into your bench after `bench init`:

```bash
BENCH=~/frappe-bench   # your bench path

cp config/bench/common_site_config.json "$BENCH/sites/common_site_config.json"

# After bench new-site sto.local, merge Redis/DB host settings:
bench --site sto.local set-config redis_cache "redis://127.0.0.1:6379"
bench --site sto.local set-config redis_queue "redis://127.0.0.1:6380"
bench --site sto.local set-config redis_socketio "redis://127.0.0.1:6379"
```

`site_config.sto.local.json.template` shows the expected per-site shape; `bench new-site` writes `sites/sto.local/site_config.json` with generated `db_name` / `db_password`.

Connection values: [docs/erpnext-sto-test-setup.md](../../docs/erpnext-sto-test-setup.md).
