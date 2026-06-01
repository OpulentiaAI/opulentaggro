# OpulentAggro ERPNext v15 — Railway production image
#
# Build context: repository root (docker build -f railway/Dockerfile .)
#
# Embeds the workspace intercompany STO module over stock ERPNext v15.
# First boot creates site, migrates, seeds (optional), starts nginx + gunicorn + workers.
#
# Adaptations from the proven praveen-ks-2001/erpnext-railway template:
#   * Source: workspace's `erpnext/erpnext/...` overlay (OpulentAggro fork)
#     rather than `pipech/erpnext-docker-debian` (we need the IC overlays).
#   * Default site name is the Railway public domain; SITE_HOST defaults to it.
#   * `use_dns_multitenant=0` is set in the entrypoint to bypass the 404
#     "Application not found" Railway edge fallback.

FROM python:3.11-slim-bookworm AS base

ENV DEBIAN_FRONTEND=noninteractive \
	FRAPPE_USER=frappe \
	BENCH_PATH=/home/frappe/frappe-bench \
	NVM_DIR=/home/frappe/.nvm \
	NODE_VERSION=18.20.4

RUN apt-get update && apt-get install -y --no-install-recommends \
		bash curl git supervisor nginx mariadb-client redis-tools \
		build-essential cron libffi-dev libssl-dev \
		libmariadb-dev pkg-config \
		wget xvfb libfontconfig wkhtmltopdf gettext-base netcat-openbsd \
	&& rm -rf /var/lib/apt/lists/* \
	&& mkdir -p /var/lib/mysql /run/mysqld

RUN useradd -ms /bin/bash frappe
USER frappe
WORKDIR /home/frappe

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
	&& . "$NVM_DIR/nvm.sh" \
	&& nvm install "$NODE_VERSION" \
	&& nvm alias default "$NODE_VERSION" \
	&& npm install -g yarn

ENV PATH="/home/frappe/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"

# Install bench CLI to /home/frappe/.local/bin/bench
RUN pip install --user frappe-bench
ENV PATH="/home/frappe/.local/bin:${PATH}"

# --- Bench init (Frappe + ERPNext v15) ---------------------------------------
ARG FRAPPE_BRANCH=version-15
ARG ERPNEXT_BRANCH=version-15

RUN bench init frappe-bench \
		--frappe-branch "$FRAPPE_BRANCH" \
		--frappe-path https://github.com/frappe/frappe \
		--skip-redis-config-generation \
		--python python3

WORKDIR /home/frappe/frappe-bench

# Apply the IPv6 hotfix for Railway private networking (Railway DNS returns AAAA only).
# https://docs.railway.com/guides/private-networking#caveats
RUN sed -i 's/socket\.AF_INET, socket\.SOCK_STREAM/socket.AF_INET6, socket.SOCK_STREAM/g' \
		/home/frappe/frappe-bench/apps/frappe/frappe/utils/connections.py || true

RUN bench get-app erpnext --branch "$ERPNEXT_BRANCH"

# --- OpulentAggro intercompany overlay (from workspace fork) ------------------
USER root
COPY --chown=frappe:frappe erpnext/erpnext/intercompany/ \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/intercompany/
COPY --chown=frappe:frappe erpnext/erpnext/public/js/intercompany/ \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/public/js/intercompany/
COPY --chown=frappe:frappe erpnext/erpnext/public/scss/opulentaggro-pierre.bundle.scss \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/public/scss/
COPY --chown=frappe:frappe erpnext/erpnext/public/images/opulentaggro-logo.svg \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/public/images/
COPY --chown=frappe:frappe erpnext/erpnext/hooks.py \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/hooks.py
COPY --chown=frappe:frappe erpnext/erpnext/startup/boot.py \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/startup/boot.py
COPY --chown=frappe:frappe erpnext/erpnext/workspace_sidebar/intercompany.json \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/workspace_sidebar/

# CRITICAL: hooks.py references erpnext.accounts.utils.pre_submit_validation
# (see pre_submit_validation_doctypes), but stock ERPNext v15 from GitHub does
# NOT ship that function. Without this overlay copy, every submitted document
# (Sales/Purchase/Delivery/Receipt) fails with:
#   AttributeError: module 'erpnext.accounts.utils' has no attribute 'pre_submit_validation'
# The workspace fork adds the function at erpnext/erpnext/accounts/utils.py:2750.
COPY --chown=frappe:frappe erpnext/erpnext/accounts/utils.py \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/accounts/utils.py

# Build marker — grep for the function so deploy logs prove the overlay shipped
RUN grep -n "def pre_submit_validation" /home/frappe/frappe-bench/apps/erpnext/erpnext/accounts/utils.py \
	|| (echo "BUILD MARKER MISSING: pre_submit_validation not in accounts/utils.py" && exit 1)

# Seed scripts (renamed on copy to match expected import paths)
COPY --chown=frappe:frappe scripts/seed_mcp_alignment.py \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/intercompany/mcp_alignment_seed.py
COPY --chown=frappe:frappe scripts/seed_sto_test_data.py \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/intercompany/sto_test_seed.py
COPY --chown=frappe:frappe scripts/print_admin_api_keys.py \
	/home/frappe/frappe-bench/apps/erpnext/erpnext/intercompany/print_admin_api_keys.py

# Railway runtime configs (supervisord, nginx, entrypoint)
COPY railway/supervisord.conf /etc/supervisor/conf.d/frappe.conf
COPY railway/temp_supervisor.conf /home/frappe/temp_supervisor.conf
COPY railway/temp_nginx.conf /home/frappe/temp_nginx.conf
COPY railway/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
	&& rm -f /etc/nginx/sites-enabled/default \
	&& mkdir -p /var/log/supervisor /var/log/nginx /var/lib/nginx/body \
	&& chown -R frappe:frappe /var/log/nginx /var/lib/nginx

USER frappe
RUN ./env/bin/pip install -e apps/erpnext

# Pre-create sites dir structure
RUN mkdir -p sites/assets

USER root

EXPOSE 80 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=1800s --retries=10 \
	CMD curl -f http://localhost:80/api/method/ping || exit 1

ENTRYPOINT ["/entrypoint.sh"]
# cache-bust Sun May 31 23:08:13 CDT 2026
