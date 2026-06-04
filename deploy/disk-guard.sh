#!/usr/bin/env bash
# Disk-space guard for the Ariza server.
#
# Runs from cron every few minutes. When the root filesystem crosses a
# warning threshold it:
#   1. Aggressively frees space (generated docs, journald, apt, npm cache).
#   2. Sends a Telegram alert to the first admin in ADMIN_CHAT_IDS.
#
# It is SAFE to run often — when disk is healthy it does nothing but a
# cheap `df` check and exits.
#
# Install (run once, as root):
#   sudo cp /var/www/ariza/deploy/disk-guard.sh /usr/local/bin/ariza-disk-guard
#   sudo chmod +x /usr/local/bin/ariza-disk-guard
#   ( crontab -l 2>/dev/null; echo '*/10 * * * * /usr/local/bin/ariza-disk-guard' ) | sudo crontab -
#
# Tune WARN_PCT below if you want it to react sooner/later.

set -uo pipefail

APP_DIR="/var/www/ariza"
ENV_FILE="${APP_DIR}/.env"
GEN_DIR="${APP_DIR}/generated"
WARN_PCT=85            # act when used% >= this
MOUNT="/"

used_pct() { df --output=pcent "${MOUNT}" | tail -1 | tr -dc '0-9'; }

# Load BOT_TOKEN + ADMIN_CHAT_IDS from .env (ignore the rest).
get_env() { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'; }

notify() {
    local token chat msg
    token="$(get_env BOT_TOKEN)"
    chat="$(get_env ADMIN_CHAT_IDS | cut -d, -f1)"
    msg="$1"
    [ -z "${token}" ] || [ -z "${chat}" ] && return 0
    curl -s -m 10 "https://api.telegram.org/bot${token}/sendMessage" \
        --data-urlencode "chat_id=${chat}" \
        --data-urlencode "text=${msg}" \
        --data-urlencode "parse_mode=HTML" >/dev/null 2>&1 || true
}

before="$(used_pct)"
[ "${before:-0}" -lt "${WARN_PCT}" ] && exit 0   # healthy → nothing to do

# ── over threshold: free space ──────────────────────────────────────
find "${GEN_DIR}" -type f -delete 2>/dev/null
journalctl --vacuum-size=100M >/dev/null 2>&1
apt-get clean >/dev/null 2>&1
[ -d "${APP_DIR}/node_modules/.cache" ] && rm -rf "${APP_DIR}/node_modules/.cache"

after="$(used_pct)"
avail="$(df -h "${MOUNT}" | tail -1 | awk '{print $4}')"

notify "⚠️ <b>ArizaPro: дискка эътибор</b>
Диск банди: <b>${before}%</b> → <b>${after}%</b> (бўш: ${avail})
Автоматик тозалаш бажарилди (generated/, journald, apt, npm).
Агар ${after}% ҳали ҳам юқори бўлса — серверни текширинг."

# If still critical after cleanup, make sure Postgres + bot recover.
if [ "${after:-0}" -ge 97 ]; then
    systemctl restart postgresql@*-main 2>/dev/null || systemctl restart postgresql 2>/dev/null
    systemctl restart ariza-bot 2>/dev/null
    notify "🔴 <b>ArizaPro: диск ҳали тўла (${after}%)</b>
Postgres ва бот қайта ишга туширилди. Қўлда текшириш керак: <code>sudo du -h -d1 / | sort -h</code>"
fi
