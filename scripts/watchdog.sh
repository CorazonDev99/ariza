#!/usr/bin/env bash
# Ariza-bot watchdog. Runs from cron every minute; pings Telegram
# admins if the bot has been unhealthy/exited for more than two
# consecutive checks. Sends a recovery message when it comes back.
#
# Install once:
#   chmod +x /var/www/ariza/scripts/watchdog.sh
#   crontab -e
#   # add the line:
#   * * * * * /var/www/ariza/scripts/watchdog.sh >/dev/null 2>&1
#
# Requires: docker, curl

set -u
PROJECT_DIR="/var/www/ariza"
STATE_FILE="/tmp/ariza-watchdog.state"
CONTAINER="ariza-bot"

# Pull BOT_TOKEN + ADMIN_CHAT_IDS from the project's .env
set -a
# shellcheck disable=SC1091
. "$PROJECT_DIR/.env" 2>/dev/null || exit 0
set +a

send_alert() {
  local text="$1"
  for chat in ${ADMIN_CHAT_IDS//,/ }; do
    curl -fsS --max-time 10 \
      "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${chat}" \
      --data-urlencode "parse_mode=HTML" \
      --data-urlencode "text=${text}" \
      >/dev/null || true
  done
}

state=$(docker inspect --format '{{.State.Status}}:{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo "missing:none")
prev=$(cat "$STATE_FILE" 2>/dev/null || echo "ok")

healthy=false
case "$state" in
  running:healthy|running:none|running:starting) healthy=true ;;
esac

if $healthy; then
  if [ "$prev" = "alerted" ]; then
    send_alert "✅ <b>ariza-bot recovered</b>%0AState: <code>${state}</code>"
  fi
  echo "ok" > "$STATE_FILE"
  exit 0
fi

# Unhealthy path.
case "$prev" in
  ok)
    # First failure — wait one more cycle to filter transient blips.
    echo "fail-1" > "$STATE_FILE"
    ;;
  fail-1)
    # Two consecutive failures — alert admins, mark as acknowledged.
    send_alert "🚨 <b>ariza-bot is DOWN</b>%0AState: <code>${state}</code>%0ARun: <code>docker compose logs --tail=100 bot</code>"
    echo "alerted" > "$STATE_FILE"
    ;;
  *)
    # Already alerted — do nothing until recovery.
    ;;
esac
