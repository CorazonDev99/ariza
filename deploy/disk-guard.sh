#!/usr/bin/env bash
# Health guard for the Ariza server. Runs from cron every few minutes.
#
# It is QUIET by design — it only sends a Telegram alert on a REAL problem:
#   • the bot service is down (not active), or
#   • the disk is critically full (>= DISK_ALERT_PCT).
#
# Anti-spam: it remembers the last reported state in a small state file and
#   - alerts ONCE when a problem first appears,
#   - stays silent while the same problem persists (re-pings at most every
#     RENOTIFY_SEC, default 6h),
#   - sends a single "recovered" message when things go back to normal.
#
# Routine cleanup (generated/, journald, apt, npm cache) still runs whenever
# the disk is above CLEAN_PCT, but SILENTLY — no message for housekeeping.
#
# Install (run once, as root):
#   sudo cp /var/www/ariza/deploy/disk-guard.sh /usr/local/bin/ariza-disk-guard
#   sudo chmod +x /usr/local/bin/ariza-disk-guard
#   ( sudo crontab -l 2>/dev/null; echo '*/10 * * * * /usr/local/bin/ariza-disk-guard' ) | sudo crontab -

set -uo pipefail

APP_DIR="/var/www/ariza"
ENV_FILE="${APP_DIR}/.env"
GEN_DIR="${APP_DIR}/generated"
STATE_FILE="/var/tmp/ariza-disk-guard.state"
SERVICE="ariza-bot"
MOUNT="/"

CLEAN_PCT=85          # above this → silently free space
DISK_ALERT_PCT=95     # at/above this → REAL threat, notify
RENOTIFY_SEC=21600    # re-ping an ongoing problem at most every 6h

used_pct() { df --output=pcent "${MOUNT}" | tail -1 | tr -dc '0-9'; }
avail_h()  { df -h "${MOUNT}" | tail -1 | awk '{print $4}'; }
now()      { date +%s; }

get_env() { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'; }

notify() {
    local token chat
    token="$(get_env BOT_TOKEN)"
    chat="$(get_env ADMIN_CHAT_IDS | cut -d, -f1)"
    { [ -z "${token}" ] || [ -z "${chat}" ]; } && return 0
    curl -s -m 10 "https://api.telegram.org/bot${token}/sendMessage" \
        --data-urlencode "chat_id=${chat}" \
        --data-urlencode "text=$1" \
        --data-urlencode "parse_mode=HTML" >/dev/null 2>&1 || true
}

# ── read previous state: "<state> <epoch>" ──────────────────────────
prev_state="ok"; prev_when=0
if [ -f "${STATE_FILE}" ]; then
    read -r prev_state prev_when < "${STATE_FILE}" 2>/dev/null || true
    [ -z "${prev_when:-}" ] && prev_when=0
fi
save_state() { echo "$1 $2" > "${STATE_FILE}"; }

# ── silent housekeeping when disk is getting full ───────────────────
pct="$(used_pct)"
if [ "${pct:-0}" -ge "${CLEAN_PCT}" ]; then
    find "${GEN_DIR}" -type f -delete 2>/dev/null
    journalctl --vacuum-size=100M >/dev/null 2>&1
    apt-get clean >/dev/null 2>&1
    [ -d "${APP_DIR}/node_modules/.cache" ] && rm -rf "${APP_DIR}/node_modules/.cache"
    pct="$(used_pct)"   # recheck after cleanup
fi

# ── classify current health (priority: bot down > disk) ─────────────
svc="$(systemctl is-active "${SERVICE}" 2>/dev/null || true)"
state="ok"
if [ "${svc}" != "active" ] && [ "${svc}" != "activating" ]; then
    state="botdown"
elif [ "${pct:-0}" -ge "${DISK_ALERT_PCT}" ]; then
    state="disk"
fi

N="$(now)"

# ── healthy now ─────────────────────────────────────────────────────
if [ "${state}" = "ok" ]; then
    if [ "${prev_state}" != "ok" ]; then
        notify "✅ <b>ArizaPro: ҳаммаси яхши</b>
Муаммо бартараф этилди. Диск банди: ${pct}% (бўш: $(avail_h)), бот ишламоқда."
    fi
    save_state "ok" "${N}"
    exit 0
fi

# ── a problem exists: alert only on change or after RENOTIFY_SEC ─────
elapsed=$(( N - prev_when ))
if [ "${state}" = "${prev_state}" ] && [ "${elapsed}" -lt "${RENOTIFY_SEC}" ]; then
    exit 0   # same problem, already reported recently → stay silent
fi

if [ "${state}" = "botdown" ]; then
    systemctl restart "${SERVICE}" 2>/dev/null
    sleep 3
    svc2="$(systemctl is-active "${SERVICE}" 2>/dev/null || true)"
    if [ "${svc2}" = "active" ]; then
        notify "🟠 <b>ArizaPro: бот тўхтаган эди</b>
Ҳолат: <code>${svc}</code> → автоматик қайта ишга туширилди ва ҳозир ишламоқда."
        save_state "ok" "${N}"
    else
        notify "🔴 <b>ArizaPro: бот ишламаяпти!</b>
Ҳолат: <code>${svc2}</code>. Қайта ишга тушириш ёрдам бермади — қўлда текширинг:
<code>sudo journalctl -u ${SERVICE} -n 50 --no-pager</code>"
        save_state "botdown" "${N}"
    fi
    exit 0
fi

# state == disk (critical)
if [ "${pct:-0}" -ge 98 ]; then
    systemctl restart postgresql@*-main 2>/dev/null || systemctl restart postgresql 2>/dev/null
    systemctl restart "${SERVICE}" 2>/dev/null
fi
notify "🔴 <b>ArizaPro: диск деярли тўла!</b>
Диск банди: <b>${pct}%</b> (бўш: $(avail_h)).
Автоматик тозалаш етарли бўлмади. Қўлда текшириш керак:
<code>sudo du -h -d1 / | sort -h | tail</code>"
save_state "disk" "${N}"
exit 0
