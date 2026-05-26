#!/usr/bin/env bash
# Pull latest code, rebuild, run migrations, restart service.
#
# Usage (on the server):
#   cd /var/www/ariza
#   sudo bash deploy/update.sh
#
# Why two users:
#   - Git operations run as root (the user invoking sudo) so we don't
#     depend on the `ariza` system user having SSH keys / known_hosts
#     configured for github.com. The remote should be HTTPS — see
#     `git remote set-url origin https://github.com/...` if you cloned
#     with SSH and want this script to work non-interactively.
#   - Build + runtime ownership stay with `ariza` so the systemd service
#     can read files without root.

set -euo pipefail

APP_DIR="/var/www/ariza"
APP_USER="ariza"

cd "${APP_DIR}"

# Git refuses to touch a repo it doesn't think it owns. Add an exception
# for root once — idempotent — so `git pull` below works after the
# `chown ariza:ariza` from a previous run.
git config --global --add safe.directory "${APP_DIR}" >/dev/null

echo "==> git pull (as root)"
git pull --ff-only

echo "==> chown to ${APP_USER}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> npm ci + prisma generate + build + db push (as ${APP_USER})"
sudo -u "${APP_USER}" -H bash -c "
    cd '${APP_DIR}' &&
    npm ci &&
    npx prisma generate &&
    npm run build &&
    npx prisma db push --skip-generate
"

echo "==> systemctl restart ariza-bot"
systemctl restart ariza-bot.service
sleep 1
systemctl --no-pager status ariza-bot.service | head -n 15
