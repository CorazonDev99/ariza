#!/usr/bin/env bash
# Ariza-bot watchdog. Runs from a systemd timer every minute.
#
# What it checks:
#   1. systemctl says the unit is `active` (otherwise restart it)
#   2. Telegram API responds to getMe with the bot's token
#      (catches the "process alive but stuck" case)
#
# On two consecutive failures, alerts admins via Telegram and
# kicks `systemctl restart ariza-bot`. Sends a recovery message
# when health returns.
#
# State is persisted in $STATE_FILE so transient blips don't spam.

set -u

PROJECT_DIR="/var/www/ariza"
STATE_FILE="/var/lib/ariza-bot/watchdog.state"
UNIT="ariza-bot.service"

mkdir -p "$(dirname "$STATE_FILE")"

# Pull BOT_TOKEN + ADMIN_CHAT_IDS from the project's .env (read-only).
set -a
# shellcheck disable=SC1091
. "$PROJECT_DIR/.env" 2>/dev/null || exit 0
set +a

: "${BOT_TOKEN:=}"
: "${ADMIN_CHAT_IDS:=}"

send_alert() {
    local text="$1"
    [ -z "$BOT_TOKEN" ] && return 0
    [ -z "$ADMIN_CHAT_IDS" ] && return 0
    for chat in ${ADMIN_CHAT_IDS//,/ }; do
        curl -fsS --max-time 10 \
            "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${chat}" \
            --data-urlencode "parse_mode=HTML" \
            --data-urlencode "text=${text}" \
            >/dev/null 2>&1 || true
    done
}

healthy=true
reason=""

# 1. Is the unit active?
if ! systemctl is-active --quiet "$UNIT"; then
    healthy=false
    reason="systemctl: $(systemctl is-active "$UNIT" 2>&1 || true)"
fi

# 2. Does Telegram's getMe come back OK?
if $healthy && [ -n "$BOT_TOKEN" ]; then
    resp="$(curl -fsS --max-time 10 "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null || true)"
    case "$resp" in
        *'"ok":true'*) ;;
        *)
            healthy=false
            reason="telegram getMe failed"
            ;;
    esac
fi

prev="$(cat "$STATE_FILE" 2>/dev/null || echo ok)"

if $healthy; then
    if [ "$prev" = "alerted" ]; then
        send_alert "✅ <b>ariza-bot recovered</b>"
    fi
    echo ok >"$STATE_FILE"
    exit 0
fi

# Unhealthy path — debounce one cycle, then restart + alert.
case "$prev" in
    ok)
        echo "fail-1" >"$STATE_FILE"
        ;;
    fail-1 | alerted)
        systemctl restart "$UNIT" || true
        # Only alert once per outage.
        if [ "$prev" != "alerted" ]; then
            send_alert "🚨 <b>ariza-bot is DOWN — restarting</b>%0AReason: <code>${reason}</code>%0ALogs: <code>journalctl -u ariza-bot -n 50</code>"
        fi
        echo "alerted" >"$STATE_FILE"
        ;;
esac
