#!/usr/bin/env bash
# OpulentAggro ERPNext — Railway production entrypoint
#
# Wait for MariaDB → write site config → create site if missing → migrate →
# enable scheduler → generate API keys → start nginx + supervisor.
set -euo pipefail

BENCH="/home/frappe/frappe-bench"
SITE="${FRAPPE_SITE_NAME:-frontend}"
# SITE_HOST must be hostname only (no scheme); strip if misconfigured in Railway vars.
SITE_HOST="${SITE_HOST:-$SITE}"
SITE_HOST="${SITE_HOST#https://}"
SITE_HOST="${SITE_HOST#http://}"
SITE_HOST="${SITE_HOST%%/*}"

cd "$BENCH"

log() { echo "[entrypoint] $(date -Iseconds) $*"; }

# --- Resolve DB credentials from Railway MariaDB/MySQL plugin or explicit env -
resolve_db_env() {
	# Python resolver: plugin vars (MYSQLDATABASE/MARIADB_*) beat MYSQL_URL path
	# parsing, which often exposes a short alias (e.g. "railway") instead of the
	# full provisioned database name (e.g. "railway_abc123").
	local resolved
	resolved="$(python3 - <<'PY'
import os
import urllib.parse

def _clean(value: str) -> str:
	value = (value or "").strip()
	if value.startswith("${{") and value.endswith("}}"):
		return ""
	return value

def _first(*keys: str) -> str:
	for key in keys:
		value = _clean(os.environ.get(key, ""))
		if value:
			return value
	return ""

host = _first("DB_HOST", "MYSQLHOST", "MARIADBHOST", "MARIADB_HOST")
port = _first("DB_PORT", "MYSQLPORT", "MARIADBPORT", "MARIADB_PORT") or "3306"
user = _first("DB_USER", "MYSQLUSER", "MARIADBUSER", "MARIADB_USER") or "frappe"
password = _first("DB_PASSWORD", "MYSQLPASSWORD", "MARIADBPASSWORD", "MARIADB_PASSWORD")
root_password = _first(
	"DB_ROOT_PASSWORD",
	"MARIADB_ROOT_PASSWORD",
	"MYSQL_ROOT_PASSWORD",
	"MYSQLROOTPASSWORD",
	"DB_PASSWORD",
	"MARIADBPASSWORD",
	"MYSQLPASSWORD",
)
db_name = _first(
	"DB_NAME",
	"MYSQLDATABASE",
	"MARIADBDATABASE",
	"MARIADB_DATABASE",
	"MYSQL_DATABASE",
)

mysql_url = _clean(os.environ.get("MYSQL_URL", ""))
if mysql_url:
	parsed = urllib.parse.urlparse(mysql_url)
	if not host:
		host = parsed.hostname or ""
	if port == "3306" and parsed.port:
		port = str(parsed.port)
	if not user and parsed.username:
		user = parsed.username
	if not password and parsed.password:
		password = parsed.password
	if not db_name:
		db_name = (parsed.path or "/").lstrip("/").split("?")[0]

if not db_name:
	db_name = "railway"
if not host:
	host = "127.0.0.1"
if not root_password:
	root_password = password

print(f"host={host}")
print(f"port={port}")
print(f"user={user}")
print(f"password={password}")
print(f"root_password={root_password}")
print(f"name={db_name}")
PY
)"
	DB_HOST="$(echo "$resolved" | awk -F= '/^host=/{print substr($0, index($0, "=")+1)}')"
	DB_PORT="$(echo "$resolved" | awk -F= '/^port=/{print substr($0, index($0, "=")+1)}')"
	DB_USER="$(echo "$resolved" | awk -F= '/^user=/{print substr($0, index($0, "=")+1)}')"
	DB_PASSWORD="$(echo "$resolved" | awk -F= '/^password=/{print substr($0, index($0, "=")+1)}')"
	DB_ROOT_PASSWORD="$(echo "$resolved" | awk -F= '/^root_password=/{print substr($0, index($0, "=")+1)}')"
	DB_NAME="$(echo "$resolved" | awk -F= '/^name=/{print substr($0, index($0, "=")+1)}')"
	DB_NAME="${DB_NAME//$'\r'/}"  # strip CR from Railway env injection
	DB_NAME="${DB_NAME#"${DB_NAME%%[![:space:]]*}"}"  # trim leading ws
	DB_NAME="${DB_NAME%"${DB_NAME##*[![:space:]]}"}"  # trim trailing ws
	DB_HOST_VAL="${DB_HOST:-127.0.0.1}"
	DB_PORT_VAL="${DB_PORT:-3306}"
	log "Resolved DB: host=${DB_HOST_VAL} port=${DB_PORT_VAL} name=${DB_NAME} user=${DB_USER}"
}

resolve_db_env

# --- Start bundled Redis (required for bench migrate / workers) ---------------
REDIS_URL="${REDIS_CACHE_URL:-${REDIS_URL:-redis://127.0.0.1:6379}}"
REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|redis://([^:/]+).*|\1|')
REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')
REDIS_PORT="${REDIS_PORT:-6379}"
if [[ "$REDIS_HOST" == "127.0.0.1" || "$REDIS_HOST" == "localhost" ]]; then
	if ! (echo >"/dev/tcp/$REDIS_HOST/$REDIS_PORT") >/dev/null 2>&1; then
		log "Starting bundled Redis on $REDIS_HOST:$REDIS_PORT"
		redis-server --bind 127.0.0.1 --port "$REDIS_PORT" --save "" --appendonly no &
		sleep 1
	fi
fi

run_bench_cfg() {
	su frappe -s /bin/bash -c "cd '$BENCH' && $*"
}

# --- Wait for MariaDB --------------------------------------------------------
if [[ -n "$DB_HOST_VAL" && "$DB_HOST_VAL" != "127.0.0.1" ]]; then
	log "Waiting for MariaDB at ${DB_HOST_VAL}:${DB_PORT_VAL}"
	for i in $(seq 1 90); do
		if mysqladmin ping -h"${DB_HOST_VAL}" -P"${DB_PORT_VAL}" \
			-uroot -p"${DB_ROOT_PASSWORD}" \
			--silent >/dev/null 2>&1; then
			log "MariaDB is ready (root ping OK)"
			break
		fi
		# Railway MariaDB plugin may expose a non-root app user only
		if [[ -n "$DB_USER" && -n "$DB_PASSWORD" ]] && \
			mysqladmin ping -h"${DB_HOST_VAL}" -P"${DB_PORT_VAL}" \
				-u"${DB_USER}" -p"${DB_PASSWORD}" \
				--silent >/dev/null 2>&1; then
			log "MariaDB is ready (${DB_USER} ping OK)"
			break
		fi
		if [[ "$i" -eq 90 ]]; then
			log "ERROR: MariaDB at ${DB_HOST_VAL}:${DB_PORT_VAL} not reachable after 180s"
			exit 1
		fi
		sleep 2
	done
else
	DB_HOST_VAL="127.0.0.1"
fi

site_db_ok() {
	run_bench_cfg "bench --site '${SITE}' list-apps" >/dev/null 2>&1
}

mysql_root() {
	mysql -h"${DB_HOST_VAL}" -P"${DB_PORT_VAL}" -uroot -p"${DB_ROOT_PASSWORD}" "$@"
}

database_has_frappe() {
	local db_name="$1"
	mysql_root -N -e "SELECT 1 FROM \`${db_name}\`.tabSingles LIMIT 1" >/dev/null 2>&1
}

get_site_db_user() {
	local db_name="$1"
	local db_user
	# Frappe authenticates with user=db_name from site_config. Prefer a dedicated
	# site user over the shared MariaDB plugin user (frappe).
	db_user="$(mysql_root -N -e "SELECT User FROM mysql.db WHERE Db='${db_name}' AND User NOT IN ('root','frappe','mysql','mariadb.sys') ORDER BY User LIMIT 1" 2>/dev/null || true)"
	if [[ -z "$db_user" ]]; then
		db_user="$db_name"
	fi
	echo "$db_user"
}

# Frappe encrypts API secrets with encryption_key in site_config.json. attach_existing_site
# rebuilds the site dir; preserve the key from volume/backup/env or API auth breaks (401).
read_preserved_encryption_key() {
	local site_config="${SITE_PATH}/site_config.json"
	local backup="${SITE_PATH}/private/.encryption_key"
	local key=""

	if [[ -f "$site_config" ]]; then
		key="$(python3 - <<PY 2>/dev/null || true
import json
with open("${site_config}") as f:
    print(json.load(f).get("encryption_key", "") or "")
PY
)"
	fi
	if [[ -z "$key" && -f "$backup" ]]; then
		key="$(tr -d '\n\r' < "$backup" 2>/dev/null || true)"
	fi
	if [[ -z "$key" && -n "${FRAPPE_ENCRYPTION_KEY:-}" ]]; then
		key="${FRAPPE_ENCRYPTION_KEY}"
	fi
	echo "$key"
}

persist_encryption_key_backup() {
	local key="$1"
	[[ -n "$key" ]] || return 0
	install -d -m 700 -o frappe -g frappe "${SITE_PATH}/private"
	printf '%s' "$key" > "${SITE_PATH}/private/.encryption_key"
	chown frappe:frappe "${SITE_PATH}/private/.encryption_key"
	chmod 600 "${SITE_PATH}/private/.encryption_key"
}

write_site_config() {
	local db_user="$1"
	local db_pass="$2"
	local db_name="$3"
	local enc_key="${4:-}"
	local site_config="${SITE_PATH}/site_config.json"
	# Frappe uses db_name as both database name and MySQL username.
	local had_key="$([[ -n "${enc_key}" ]] && echo 1 || echo 0)"
	SITE_ENCRYPTION_KEY="$(python3 - <<PY
import json
import secrets

config = {
    "db_name": "${db_user}",
    "db_password": "${db_pass}",
    "db_type": "mariadb",
    "db_host": "${DB_HOST_VAL}",
    "db_port": int("${DB_PORT_VAL}"),
    "use_mysqlclient": 1,
}
enc_key = """${enc_key}""".strip()
if not enc_key:
    enc_key = secrets.token_hex(20)
config["encryption_key"] = enc_key
with open("${site_config}", "w") as f:
    json.dump(config, f, indent=1)
    f.write("\n")
print(enc_key)
PY
)"
	if [[ "$had_key" == "0" ]]; then
		log "Generated new encryption_key for site_config"
	fi
	chown frappe:frappe "$site_config" 2>/dev/null || true
}

ensure_site_db_user() {
	local db_name="$1"
	local db_user="$2"
	local db_pass="$3"
	mysql_root -e "
		CREATE USER IF NOT EXISTS '${db_user}'@'%' IDENTIFIED BY '${db_pass}';
		ALTER USER '${db_user}'@'%' IDENTIFIED BY '${db_pass}';
		GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'%';
		FLUSH PRIVILEGES;
	" 2>/dev/null || log "WARNING: could not ensure DB user ${db_user}"
}

attach_existing_site() {
	local safe_db="${SAFE_DB_NAME}"
	local db_user db_pass="${DB_PASSWORD:-}"
	local enc_key
	if [[ -z "$db_pass" ]]; then
		db_pass="$(openssl rand -hex 16)"
	fi
	db_user="$(get_site_db_user "$safe_db")"
	enc_key="$(read_preserved_encryption_key)"
	if [[ -n "$enc_key" ]]; then
		log "Preserving encryption_key from existing site volume/backup"
	else
		log "WARNING: no encryption_key found — API secrets may need regeneration after attach"
	fi
	log "Attaching site ${SITE} to existing database ${safe_db} (db_user=${db_user})"
	rm -rf "${SITE_PATH}"
	mkdir -p "${SITE_PATH}/private/backups" "${SITE_PATH}/logs" "${SITE_PATH}/locks"
	ensure_site_db_user "$safe_db" "$db_user" "$db_pass"
	write_site_config "$db_user" "$db_pass" "$safe_db" "$enc_key"
	persist_encryption_key_backup "$SITE_ENCRYPTION_KEY"
	printf 'frappe\nerpnext\n' > "${SITE_PATH}/apps.txt"
	chown -R frappe:frappe "${SITE_PATH}"
	run_bench_cfg "bench use '${SITE}'"
	if ! run_bench_cfg "bench --site '${SITE}' list-apps" >/dev/null 2>&1; then
		log "ERROR: attach failed — bench cannot connect with db_user=${db_user}"
		return 1
	fi
	run_bench_cfg "bench --site '${SITE}' migrate" || log "migrate skipped during attach"
	run_bench_cfg "bench build --app erpnext" || log "bench build skipped during attach"
	run_bench_cfg "bench --site '${SITE}' enable-scheduler" || log "enable-scheduler skipped"
	log "Site ${SITE} attached to existing database ${safe_db}"
}

drop_stale_site_db() {
	local site_config="${BENCH}/sites/${SITE}/site_config.json"
	if [[ ! -f "$site_config" ]]; then
		return 0
	fi
	local db_name
	db_name="$(python3 - <<PY
import json
with open("${site_config}") as f:
    print(json.load(f).get("db_name", ""))
PY
)"
	if [[ -z "$db_name" ]]; then
		return 0
	fi
	log "Dropping stale database and user ${db_name}"
	mysql -h"${DB_HOST_VAL}" -P"${DB_PORT_VAL}" -uroot -p"${DB_ROOT_PASSWORD}" \
		-e "DROP DATABASE IF EXISTS \`${db_name}\`; DROP USER IF EXISTS '${db_name}'@'%'; DROP USER IF EXISTS '${db_name}'@'localhost';" \
		2>/dev/null || log "WARNING: could not drop stale database ${db_name} (may already be gone)"
}

remove_site() {
	log "Removing site ${SITE}"
	if [[ -d "${BENCH}/sites/${SITE}" ]]; then
		run_bench_cfg "bench drop-site '${SITE}' --force --no-backup" \
			2>/dev/null || drop_stale_site_db
	fi
	rm -rf "${BENCH}/sites/${SITE}"
}

create_site() {
	local safe_db="${SAFE_DB_NAME}"
	log "Creating new site ${SITE} db=${safe_db} db_host=${DB_HOST_VAL} (3–5 minutes)"
	run_bench_cfg "bench new-site '${SITE}' \
		--db-name '${safe_db}' \
		--db-host '${DB_HOST_VAL}' \
		--db-port '${DB_PORT_VAL}' \
		--mariadb-user-host-login-scope='%' \
		--admin-password '${FRAPPE_ADMIN_PASSWORD:?FRAPPE_ADMIN_PASSWORD required}' \
		--db-root-password '${DB_ROOT_PASSWORD}' \
		--install-app erpnext"
	run_bench_cfg "bench use '${SITE}'"
	run_bench_cfg "bench --site '${SITE}' enable-scheduler" || log "enable-scheduler skipped"
	run_bench_cfg "bench --site '${SITE}' execute erpnext.setup.setup_wizard.operations.install_fixtures.install --kwargs '{\"country\": \"United States\"}'" \
		|| log "install_fixtures skipped"
	# Finalize Frappe desk (embeds hang on setup wizard when setup_complete=0)
	run_bench_cfg "bench --site '${SITE}' execute frappe.client.set_value --args '[\"System Settings\", null, \"setup_complete\", 1]'" \
		|| log "setup_complete skipped"
	log "Site ${SITE} created and scheduler enabled"
}

# --- Ensure common_site_config.json exists -----------------------------------
COMMON_CONFIG="${BENCH}/sites/common_site_config.json"
if [[ ! -s "$COMMON_CONFIG" ]]; then
	log "Creating empty common_site_config.json"
	echo "{}" > "$COMMON_CONFIG"
	chown frappe:frappe "$COMMON_CONFIG"
fi

# --- Write DB / Redis / routing settings into common_site_config --------------
# Use plugin DB_NAME as-is (after trim); only sanitize when falling back to SITE.
if [[ -n "${DB_NAME}" ]]; then
	SAFE_DB_NAME="${DB_NAME}"
else
	SAFE_DB_NAME="$(echo "${SITE}" | tr -c 'A-Za-z0-9' '_' | cut -c1-40)"
fi

log "Writing connection settings into common_site_config.json (db_name=${SAFE_DB_NAME}, db_host=${DB_HOST_VAL})"
run_bench_cfg "bench set-config -g db_host '${DB_HOST_VAL}'" || true
run_bench_cfg "bench set-config -gp db_port '${DB_PORT_VAL}'" || true
run_bench_cfg "bench set-config -g db_name '${SAFE_DB_NAME}'" || true
run_bench_cfg "bench set-config -g redis_cache '${REDIS_CACHE_URL:-${REDIS_URL:-redis://127.0.0.1:6379}}'" || true
run_bench_cfg "bench set-config -g redis_queue '${REDIS_QUEUE_URL:-${REDIS_URL:-redis://127.0.0.1:6379}}'" || true
run_bench_cfg "bench set-config -g redis_socketio '${REDIS_SOCKETIO_URL:-${REDIS_URL:-redis://127.0.0.1:6379}}'" || true
run_bench_cfg "bench set-config -gp use_dns_multitenant 0" || true
# host_name is skipped: bench set-config literal_evals the value and rejects
# raw URLs as a "decimal literal". Not needed when use_dns_multitenant=0.

# --- Bootstrap site ------------------------------------------------------------
# RECREATE_SITE_ON_DB_FAILURE=1 (default) helps first boot when volume has stale
# site_config.json vs MariaDB. After one successful boot, set both to 0 in Railway
# so a transient DB blip does not wipe the site (see docs/railway-backend-deployment.md).
SITE_PATH="${BENCH}/sites/${SITE}"
RECREATE_ON_DB_FAIL="${RECREATE_SITE_ON_DB_FAILURE:-1}"

if [[ "${FORCE_RECREATE_SITE:-0}" == "1" && -d "$SITE_PATH" ]]; then
	log "FORCE_RECREATE_SITE=1 — removing existing site"
	remove_site
fi

if [[ ! -d "$SITE_PATH" ]]; then
	if database_has_frappe "${SAFE_DB_NAME}"; then
		log "No site directory but Frappe database ${SAFE_DB_NAME} exists — attaching"
		attach_existing_site || exit 1
	elif [[ "$RECREATE_ON_DB_FAIL" == "1" ]]; then
		log "No site directory found — dropping any stale database/user before site creation"
		mysql_root \
			-e "DROP DATABASE IF EXISTS \`${SAFE_DB_NAME}\`; DROP USER IF EXISTS '${SAFE_DB_NAME}'@'%'; DROP USER IF EXISTS '${SAFE_DB_NAME}'@'localhost';" \
			2>/dev/null || log "WARNING: could not drop stale database ${SAFE_DB_NAME}"
		create_site
	else
		create_site
	fi
else
	log "Site ${SITE} already exists — verifying DB connectivity"
	if ! site_db_ok; then
		if database_has_frappe "${SAFE_DB_NAME}"; then
			log "Site DB unreachable but ${SAFE_DB_NAME} has Frappe data — reattaching credentials"
			attach_existing_site || exit 1
		elif [[ "$RECREATE_ON_DB_FAIL" == "1" ]]; then
			log "Site DB credentials stale or IPv6 host denied — recreating site"
			remove_site
			create_site
		else
			log "ERROR: Site DB unreachable; set RECREATE_SITE_ON_DB_FAILURE=1 or FORCE_RECREATE_SITE=1"
			exit 1
		fi
	else
		log "Running migrate"
		run_bench_cfg "bench use '${SITE}'" || true
		run_bench_cfg "bench --site '${SITE}' migrate" || log "migrate skipped"
		log "Building app assets after migrate"
		run_bench_cfg "bench build --app erpnext" || log "bench build skipped"
	fi
fi

# Direct Python invocation — bench execute eval context cannot resolve erpnext.*
run_seed_script() {
	local script_path="$1"
	local label="$2"
	[[ -f "$script_path" ]] || { log "${label}: script not found, skipped"; return 0; }
	log "Running ${label}"
	install -d -m 755 -o frappe -g frappe /home/frappe/logs
	touch /home/frappe/logs/database.log
	chown frappe:frappe /home/frappe/logs/database.log
	local site_logs_dir="${BENCH}/sites/${SITE}/logs"
	install -d -m 755 -o frappe -g frappe "$site_logs_dir"
	touch "$site_logs_dir/database.log"
	chown frappe:frappe "$site_logs_dir/database.log"
	local bench_site_logs_dir="${BENCH}/${SITE}/logs"
	install -d -m 755 -o frappe -g frappe "$bench_site_logs_dir"
	touch "$bench_site_logs_dir/database.log"
	chown frappe:frappe "$bench_site_logs_dir/database.log"
	su frappe -s /bin/bash -c "cd '$BENCH' && '$BENCH/env/bin/python' - <<'PY'
import importlib.util
import frappe

frappe.init(site='${SITE}', sites_path='${BENCH}/sites')
frappe.connect()
spec = importlib.util.spec_from_file_location('seed_mod', '${script_path}')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
if hasattr(mod, 'run'):
    mod.run()
frappe.db.commit()
frappe.destroy()
PY
" || log "${label} failed or partial"
}

# --- Schema hotfixes (desk boot columns missed by partial migrate) -------------
ensure_schema_hotfixes() {
	local script="${BENCH}/schema_hotfixes.py"
	[[ -f "$script" ]] || { log "schema_hotfixes.py not found, skipped"; return 0; }
	if ! site_db_ok; then
		return 0
	fi
	log "Applying schema hotfixes"
	run_seed_script "$script" "schema hotfixes"
}

ensure_schema_hotfixes

# --- Hosted MCP prerequisites (setup_complete, FY, demo stock) ----------------
ensure_hosted_prereqs() {
	local script="${BENCH}/hosted_prereqs.py"
	[[ -f "$script" ]] || { log "hosted_prereqs.py not found, skipped"; return 0; }
	if ! site_db_ok; then
		return 0
	fi
	log "Ensuring hosted MCP prerequisites (setup_complete, fiscal year, stock)"
	run_seed_script "$script" "hosted MCP prerequisites"
}

ensure_hosted_prereqs

# --- Ensure Administrator password matches FRAPPE_ADMIN_PASSWORD --------------
log "Ensuring Administrator password matches FRAPPE_ADMIN_PASSWORD"
run_bench_cfg "bench --site '${SITE}' set-admin-password '${FRAPPE_ADMIN_PASSWORD:?FRAPPE_ADMIN_PASSWORD required}'" \
	|| log "set-admin-password skipped"

# --- Install STO desk pages (sto-dashboard, sto-trace, intercompany workspace) -
install_sto_desk_pages() {
	log "Installing STO desk pages (Module Def, Page, Workspace)"
	run_bench_cfg "bench --site '${SITE}' execute frappe.get_doc --kwargs '{\"doctype\": \"Module Def\", \"module_name\": \"Intercompany\", \"app_name\": \"erpnext\", \"custom\": 0}'" \
		2>/dev/null || true
	for doc in \
		apps/erpnext/erpnext/intercompany/page/sto_dashboard/sto_dashboard.json \
		apps/erpnext/erpnext/intercompany/page/sto_trace/sto_trace.json \
		apps/erpnext/erpnext/intercompany/workspace/intercompany/intercompany.json; do
		run_bench_cfg "bench --site '${SITE}' import-doc '${doc}'" \
			|| log "import-doc ${doc} skipped"
	done
	run_bench_cfg "bench build --app erpnext" || log "bench build skipped"
	run_bench_cfg "bench --site '${SITE}' clear-cache" || true
}

DB_READY=0
if site_db_ok; then
	DB_READY=1
else
	log "WARNING: Site DB still unreachable — skipping seeds and API key steps"
fi

if [[ "$DB_READY" == "1" ]]; then
	install_sto_desk_pages
fi

# --- Optional seeds (MCP master data, STO test data) -------------------------
if [[ "$DB_READY" == "1" && "${RUN_MCP_SEED:-0}" == "1" ]]; then
	run_seed_script "${BENCH}/apps/erpnext/erpnext/intercompany/mcp_alignment_seed.py" "MCP alignment seed"
fi

if [[ "$DB_READY" == "1" && "${RUN_STO_TEST_SEED:-0}" == "1" ]]; then
	run_seed_script "${BENCH}/apps/erpnext/erpnext/intercompany/sto_test_seed.py" "STO test seed"
fi

# --- Generate Administrator API keys -----------------------------------------
if [[ "$DB_READY" == "1" && "${GENERATE_API_KEYS:-1}" == "1" ]]; then
	log "Ensuring Administrator API keys exist"
	run_bench_cfg "bench --site '${SITE}' execute frappe.core.doctype.user.user.generate_keys --args '[\"Administrator\"]'" \
		|| log "API key generation skipped"
fi

# --- Print API keys (captured in Railway logs for Vercel sync) ----------------
if [[ "$DB_READY" == "1" && "${PRINT_API_KEYS:-1}" == "1" ]]; then
	run_seed_script "${BENCH}/apps/erpnext/erpnext/intercompany/print_admin_api_keys.py" "Print Administrator API keys"
fi

# --- Clear cache (best-effort, requires live DB) ------------------------------
if [[ "$DB_READY" == "1" ]]; then
	log "Clearing cache"
	run_bench_cfg "bench --site '${SITE}' execute frappe.cache_manager.clear_global_cache" || true
fi

# --- Render nginx and supervisor configs -------------------------------------
log "Rendering nginx config"
if [[ -f /home/frappe/temp_nginx.conf ]]; then
	# Debian default site conflicts with our listen :PORT default_server
	rm -f /etc/nginx/sites-enabled/default
	export PORT="${PORT:-80}"
	envsubst '$SITE_HOST $PORT' < /home/frappe/temp_nginx.conf > /etc/nginx/conf.d/frappe.conf
	sed -i "s/\\\${PORT:-80}/${PORT}/g" /etc/nginx/conf.d/frappe.conf
	rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
else
	log "No temp_nginx.conf — skipping nginx (gunicorn exposed directly on 8000)"
fi

log "Rendering supervisor config"
if [[ -f /home/frappe/temp_supervisor.conf ]]; then
	envsubst '$PATH,$HOME,$NVM_DIR,$NODE_VERSION' \
		< /home/frappe/temp_supervisor.conf > /home/frappe/supervisor.conf
	SUPERVISOR_CONF="/home/frappe/supervisor.conf"
else
	log "No temp_supervisor.conf — using /etc/supervisor/conf.d/frappe.conf"
	SUPERVISOR_CONF="/etc/supervisor/conf.d/frappe.conf"
fi

# --- Start services ----------------------------------------------------------
if [[ -f /etc/nginx/conf.d/frappe.conf ]]; then
	log "Starting nginx on port ${PORT}"
	nginx
else
	log "Starting gunicorn directly on 8000"
	cd "${BENCH}/sites"
	exec /home/frappe/frappe-bench/env/bin/gunicorn \
		-b 0.0.0.0:8000 \
		-w 2 --threads 4 --timeout 120 --graceful-timeout 30 --preload \
		frappe.app:application
fi

log "Starting supervisord"
exec /usr/bin/supervisord -n -c "$SUPERVISOR_CONF"
