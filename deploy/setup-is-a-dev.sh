#!/usr/bin/env bash
# Provision a Cloudflare named tunnel that uses a FREE is-a.dev
# subdomain instead of a domain you own. The flow has two phases
# because is-a.dev manages DNS for you — you open a GitHub PR with
# the tunnel UUID, wait for it to merge, then finish setup.
#
# Phase 1 (BEFORE the PR is merged) — gives you the data for the PR:
#   sudo bash deploy/setup-is-a-dev.sh prepare <subdomain>
#   # Example: sudo bash deploy/setup-is-a-dev.sh prepare ariza
#
# Phase 2 (AFTER the PR is merged) — wires up systemd + .env:
#   sudo bash deploy/setup-is-a-dev.sh finish <subdomain>
#   # Example: sudo bash deploy/setup-is-a-dev.sh finish ariza
#
# How to open the PR:
#   1. Fork https://github.com/is-a-dev/register
#   2. Add the JSON shown by `prepare` to `domains/<subdomain>.json`
#   3. Open PR — maintainers usually merge within 1-3 days
#
# Anatomy of the resulting JSON (the script prints a ready-to-paste one):
#   {
#     "owner":   { "username": "...", "email": "..." },
#     "record":  { "CNAME": "<UUID>.cfargotunnel.com" },
#     "proxied": true
#   }
#
# `proxied: true` is REQUIRED — that's what makes Cloudflare's edge
# terminate TLS for <subdomain>.is-a.dev and forward decrypted traffic
# into your tunnel.

set -euo pipefail

PHASE="${1:-}"
SUBDOMAIN="${2:-}"
TUNNEL_NAME="${TUNNEL_NAME:-ariza}"
APP_DIR="${APP_DIR:-/var/www/ariza}"
LOCAL_PORT="${LOCAL_PORT:-3000}"
ENV_FILE="${APP_DIR}/.env"

if [[ -z "${PHASE}" || -z "${SUBDOMAIN}" ]]; then
  cat <<'EOF' >&2
Usage:
  sudo bash deploy/setup-is-a-dev.sh prepare <subdomain>
  sudo bash deploy/setup-is-a-dev.sh finish  <subdomain>

Example:
  sudo bash deploy/setup-is-a-dev.sh prepare ariza
    → outputs the JSON you paste into is-a.dev/register PR

  sudo bash deploy/setup-is-a-dev.sh finish ariza
    → once the PR is merged, wires the tunnel + restarts the bot
EOF
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Must run as root (use sudo)." >&2
  exit 1
fi

# Lowercase + strip leading/trailing dots, just in case.
SUBDOMAIN="$(echo "${SUBDOMAIN}" | tr 'A-Z' 'a-z' | sed 's/^\.//;s/\.$//')"
HOSTNAME="${SUBDOMAIN}.is-a.dev"

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then return; fi
  echo "==> Installing cloudflared..."
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(. /etc/os-release && echo $VERSION_CODENAME) main" \
    | tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  apt-get update
  apt-get install -y cloudflared
}

get_tunnel_uuid() {
  # Locate the credentials JSON cloudflared dropped under /root/.cloudflared
  local creds
  creds=$(find /root/.cloudflared -maxdepth 1 -name '*.json' -type f \
          -not -name 'cert.json' | head -n1)
  if [[ -z "${creds}" ]]; then
    echo "Could not find tunnel credentials JSON under /root/.cloudflared" >&2
    return 1
  fi
  basename "${creds}" .json
}

# ---------------------------------------------------------------------
# Phase 1 — prepare: install, login, create tunnel, print PR JSON
# ---------------------------------------------------------------------
if [[ "${PHASE}" == "prepare" ]]; then
  echo "==> [1/4] Install cloudflared if missing"
  ensure_cloudflared
  cloudflared --version | head -n1

  echo "==> [2/4] Cloudflare login (browser-based, one-time)"
  if [[ ! -f /root/.cloudflared/cert.pem ]]; then
    echo
    echo "    cloudflared will print a URL below. Open it in your local"
    echo "    browser, sign in, pick ANY zone (you can pick is-a.dev or"
    echo "    your own — the cert is account-wide, not zone-specific),"
    echo "    and approve. Then come back here."
    echo
    cloudflared tunnel login
  else
    echo "    cert.pem already present — skipping login."
  fi

  echo "==> [3/4] Create tunnel '${TUNNEL_NAME}' (idempotent)"
  if cloudflared tunnel list 2>/dev/null | awk 'NR>1 {print $2}' | grep -qx "${TUNNEL_NAME}"; then
    echo "    Tunnel '${TUNNEL_NAME}' already exists — reusing."
  else
    cloudflared tunnel create "${TUNNEL_NAME}"
  fi

  UUID="$(get_tunnel_uuid)"

  echo "==> [4/4] is-a.dev PR data"
  cat <<EOF

  +--------------------------------------------------------------+
  | NEXT STEP — open a PR to https://github.com/is-a-dev/register |
  +--------------------------------------------------------------+

  1) Fork the repo on GitHub.
  2) Create a new file at: domains/${SUBDOMAIN}.json
  3) Paste this content (REPLACE <YOUR_GITHUB_USERNAME> and email):

  {
    "owner": {
      "username": "<YOUR_GITHUB_USERNAME>",
      "email":    "<YOUR_EMAIL>"
    },
    "description": "ariza-bot — Telegram Mini App for Uzbekistan court schedules",
    "record": {
      "CNAME": "${UUID}.cfargotunnel.com"
    },
    "proxied": true
  }

  4) Open a Pull Request titled e.g. "Add ${SUBDOMAIN}.is-a.dev".
  5) Wait for a maintainer to merge (usually 1-3 days).
  6) Once merged, come back and run:

       sudo bash deploy/setup-is-a-dev.sh finish ${SUBDOMAIN}

EOF

  echo "  Tunnel UUID (also written to /tmp/ariza-tunnel-uuid for the finish step):"
  echo "  ${UUID}"
  echo "${UUID}" > /tmp/ariza-tunnel-uuid
  exit 0
fi

# ---------------------------------------------------------------------
# Phase 2 — finish: write config, enable systemd, update .env, restart
# ---------------------------------------------------------------------
if [[ "${PHASE}" == "finish" ]]; then
  echo "==> [1/6] Sanity checks"
  ensure_cloudflared

  if [[ ! -f /root/.cloudflared/cert.pem ]]; then
    echo "Missing /root/.cloudflared/cert.pem — run the 'prepare' phase first." >&2
    exit 1
  fi

  UUID="$(get_tunnel_uuid)"

  echo "==> [2/6] Verify DNS for ${HOSTNAME} is live"
  # is-a.dev uses Cloudflare DNS; a CNAME should resolve once merged.
  # Try a few times in case DNS hasn't propagated to our resolver yet.
  RESOLVED=""
  for i in $(seq 1 6); do
    RESOLVED="$(dig +short CNAME "${HOSTNAME}" @1.1.1.1 2>/dev/null | head -n1)"
    if [[ -n "${RESOLVED}" ]]; then break; fi
    echo "    Try ${i}/6: no DNS yet, waiting 5s..."
    sleep 5
  done

  if [[ -z "${RESOLVED}" ]]; then
    cat <<EOF >&2

  ${HOSTNAME} doesn't resolve yet.

  Likely causes:
    - PR not merged yet (check the PR page)
    - DNS still propagating (give it 5-10 more minutes)
    - is-a.dev JSON file uses a different subdomain

  Re-run when ready:
    sudo bash deploy/setup-is-a-dev.sh finish ${SUBDOMAIN}
EOF
    exit 1
  fi
  echo "    ${HOSTNAME} → ${RESOLVED}"

  if [[ "${RESOLVED}" != *"cfargotunnel.com"* ]]; then
    echo "    WARN: CNAME doesn't point to *.cfargotunnel.com — your" >&2
    echo "    is-a.dev PR may use a different target. Tunnel will still" >&2
    echo "    fail unless you fix the JSON." >&2
  fi

  echo "==> [3/6] Write /etc/cloudflared/config.yml"
  CREDS="/root/.cloudflared/${UUID}.json"
  mkdir -p /etc/cloudflared
  cat > /etc/cloudflared/config.yml <<EOF
# Generated by deploy/setup-is-a-dev.sh
tunnel: ${TUNNEL_NAME}
credentials-file: ${CREDS}

ingress:
  - hostname: ${HOSTNAME}
    service: http://localhost:${LOCAL_PORT}
  - service: http_status:404
EOF
  chmod 644 /etc/cloudflared/config.yml

  echo "==> [4/6] Install + enable cloudflared.service"
  # Stop the quick-tunnel sibling if it was previously active —
  # only one cloudflared instance should bind to a tunnel at a time.
  systemctl stop cloudflared-quick.service 2>/dev/null || true
  systemctl disable cloudflared-quick.service 2>/dev/null || true

  install -m 0644 "${APP_DIR}/deploy/cloudflared.service" \
          /etc/systemd/system/cloudflared.service
  systemctl daemon-reload
  systemctl enable cloudflared.service
  systemctl restart cloudflared.service
  sleep 2
  systemctl --no-pager status cloudflared.service | head -n 10 || true

  echo "==> [5/6] Update WEBAPP_URL in ${ENV_FILE}"
  URL="https://${HOSTNAME}/webapp"
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "WEBAPP_URL=${URL}" > "${ENV_FILE}"
  else
    if grep -q '^WEBAPP_URL=' "${ENV_FILE}"; then
      sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=${URL}|" "${ENV_FILE}"
    else
      echo "WEBAPP_URL=${URL}" >> "${ENV_FILE}"
    fi
  fi
  echo "    WEBAPP_URL=${URL}"

  echo "==> [6/6] Restart ariza-bot"
  systemctl restart ariza-bot.service
  sleep 1

  echo
  echo "==> Done."
  echo
  echo "  Public URL: ${URL}"
  echo "  Smoke test: curl -I https://${HOSTNAME}/health"
  echo "  Logs:       journalctl -u cloudflared -f"
  exit 0
fi

echo "Unknown phase: '${PHASE}'. Use 'prepare' or 'finish'." >&2
exit 1
