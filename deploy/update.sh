#!/usr/bin/env bash
# Pull latest code, rebuild, run migrations, restart service.
#
# Usage (on the server):
#   sudo bash /var/www/ariza/deploy/update.sh
#
# Self-healing — handles two common gotchas automatically:
#   1. Repo files owned by `ariza` while we run as root → `safe.directory`
#      exception added on first run.
#   2. Remote configured as SSH (`git@github.com:…`) → switched to HTTPS
#      so the script doesn't depend on the `ariza` user having SSH keys.

set -euo pipefail

APP_DIR="/var/www/ariza"
APP_USER="ariza"
REPO_HTTPS_URL="https://github.com/CorazonDev99/ariza.git"

cd "${APP_DIR}"

# Trust the repo for the user running this script (root, via sudo).
git config --global --add safe.directory "${APP_DIR}" >/dev/null

# If origin still points at SSH, rewrite to HTTPS. Pulling over HTTPS
# only needs network access — no SSH key on the box, no fiddling with
# known_hosts for the `ariza` system user.
current_url="$(git remote get-url origin 2>/dev/null || echo "")"
case "${current_url}" in
    git@github.com:*|ssh://git@github.com/*)
        echo "==> Rewriting origin from SSH to HTTPS"
        git remote set-url origin "${REPO_HTTPS_URL}"
        ;;
esac

echo "==> git pull (as root)"
git pull --ff-only

echo "==> chown to ${APP_USER}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> npm ci + prisma generate + build (bot + webapp) + db push (as ${APP_USER})"
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
