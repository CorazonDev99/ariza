#!/usr/bin/env bash
# Keep the bot's WEBAPP_URL in sync with the QUICK tunnel's rotating URL.
#
# Quick-tunnel (*.trycloudflare.com) URLs change on every cloudflared
# restart / server reboot. This script reads the current URL from the
# cloudflared-quick journal and, if it differs from WEBAPP_URL in the
# bot's .env, updates .env and restarts the bot (which re-registers the
# Telegram chat-menu button with the new URL).
#
# It is idempotent and cheap — when the URL is unchanged it does nothing.
# Installed as /usr/local/bin/ariza-tunnel-sync and run by a systemd
# timer every couple of minutes (see cloudflared-url-sync.timer).

set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/ariza}"
ENV_FILE="${APP_DIR}/.env"

# Latest URL printed by cloudflared during the current boot.
URL=$(journalctl -u cloudflared-quick.service -b --no-pager 2>/dev/null \
      | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
      | tail -n1 || true)

[ -z "${URL}" ] && exit 0   # tunnel not up yet — nothing to do

WEBAPP="${URL}/webapp"
CURRENT=$(grep -E '^WEBAPP_URL=' "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)

[ "${CURRENT}" = "${WEBAPP}" ] && exit 0   # already current

if [ -f "${ENV_FILE}" ] && grep -q '^WEBAPP_URL=' "${ENV_FILE}"; then
    sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=${WEBAPP}|" "${ENV_FILE}"
else
    echo "WEBAPP_URL=${WEBAPP}" >> "${ENV_FILE}"
fi

echo "ariza-tunnel-sync: WEBAPP_URL -> ${WEBAPP} (restarting ariza-bot)"
systemctl restart ariza-bot.service
