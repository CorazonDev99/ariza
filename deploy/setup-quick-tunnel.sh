#!/usr/bin/env bash
# Persistent Cloudflare QUICK tunnel as a systemd service. Use this
# when you don't have a Cloudflare-managed domain yet — the tunnel
# survives SSH disconnects and reboots, but the *.trycloudflare.com
# URL changes each time the service restarts. The script auto-discovers
# the current URL from journalctl and writes it into the bot's .env.
#
# Usage (run on the server, as root):
#   sudo bash deploy/setup-quick-tunnel.sh
#
# Re-run any time the URL changes (after reboot, after restarting
# cloudflared) — it will detect the new URL and restart the bot.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ariza}"
ENV_FILE="${APP_DIR}/.env"
LOCAL_PORT="${LOCAL_PORT:-3000}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Must run as root (use sudo)." >&2
  exit 1
fi

echo "==> [1/4] Install cloudflared if missing"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(. /etc/os-release && echo $VERSION_CODENAME) main" \
    | tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  apt-get update
  apt-get install -y cloudflared
fi
cloudflared --version | head -n1

echo "==> [2/4] Install + start systemd unit (cloudflared-quick.service)"
# We deliberately do NOT also enable the named-tunnel `cloudflared.service`
# — only one of the two should run at a time. Stop the named one if it
# was previously installed.
systemctl stop cloudflared.service 2>/dev/null || true
systemctl disable cloudflared.service 2>/dev/null || true

install -m 0644 "${APP_DIR}/deploy/cloudflared-quick.service" \
        /etc/systemd/system/cloudflared-quick.service
systemctl daemon-reload
systemctl enable cloudflared-quick.service
systemctl restart cloudflared-quick.service

echo "==> [3/4] Wait for tunnel URL to appear in journal (up to 30s)"
URL=""
for i in $(seq 1 30); do
  URL=$(journalctl -u cloudflared-quick.service --since "1 minute ago" --no-pager 2>/dev/null \
        | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
        | tail -n1 || true)
  if [[ -n "${URL}" ]]; then
    echo "    Found URL after ${i}s: ${URL}"
    break
  fi
  sleep 1
done

if [[ -z "${URL}" ]]; then
  echo "Failed to find tunnel URL in journalctl after 30s." >&2
  echo "Check 'journalctl -u cloudflared-quick.service -f' for details." >&2
  exit 1
fi

echo "==> [4/4] Update WEBAPP_URL in ${ENV_FILE} + restart bot"
WEBAPP="${URL}/webapp"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "WEBAPP_URL=${WEBAPP}" > "${ENV_FILE}"
else
  if grep -q '^WEBAPP_URL=' "${ENV_FILE}"; then
    sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=${WEBAPP}|" "${ENV_FILE}"
  else
    echo "WEBAPP_URL=${WEBAPP}" >> "${ENV_FILE}"
  fi
fi
echo "    WEBAPP_URL=${WEBAPP}"

systemctl restart ariza-bot.service
sleep 1

echo
echo "==> Done."
echo
echo "    Public URL: ${URL}"
echo "    Mini App:   ${WEBAPP}"
echo
echo "    Quick tunnel URLs ROTATE on each cloudflared restart. If the"
echo "    Mini App stops working, re-run this script to pick up the new URL."
echo
echo "    For a permanent URL on your own domain, use:"
echo "      sudo bash deploy/setup-cloudflared.sh <hostname>"
