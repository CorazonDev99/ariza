#!/usr/bin/env bash
# Pull latest code, rebuild, run migrations, restart service.
#
# Usage (on the server):
#   cd /var/www/ariza
#   sudo bash deploy/update.sh

set -euo pipefail

APP_DIR="/var/www/ariza"
APP_USER="ariza"

cd "${APP_DIR}"

echo "==> git pull"
sudo -u "${APP_USER}" -H git pull --ff-only

echo "==> npm ci (production deps + devDeps for build)"
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
