#!/usr/bin/env bash
# One-shot installer for ariza-bot on a fresh Ubuntu host.
#
# Usage (run on the server, as root or with sudo):
#   cd /var/www/ariza
#   sudo bash deploy/install.sh
#
# Assumes:
#   - The repo is already cloned to /var/www/ariza
#   - PostgreSQL is already running on 127.0.0.1:5432 (DB + role created)
#   - .env exists in /var/www/ariza with a valid DATABASE_URL and BOT_TOKEN
#
# Idempotent — safe to re-run after a `git pull`.

set -euo pipefail

APP_DIR="/var/www/ariza"
APP_USER="ariza"
NODE_MAJOR="20"

cd "${APP_DIR}"

echo "==> [1/6] System packages (LibreOffice, fonts, build tools)"
apt-get update
apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto \
    ca-certificates \
    curl \
    gnupg

echo "==> [2/6] Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
fi
node -v
npm -v

echo "==> [3/6] Service user '${APP_USER}' + ownership of ${APP_DIR}"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

# Runtime dirs must exist before chown so they get the right owner too.
mkdir -p "${APP_DIR}/generated" "${APP_DIR}/data"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> [4/6] Install npm deps, generate Prisma client, build TS"
sudo -u "${APP_USER}" -H bash -c "
    cd '${APP_DIR}' &&
    npm ci &&
    npx prisma generate &&
    npm run build
"

echo "==> [5/6] Sync Prisma schema to Postgres"
sudo -u "${APP_USER}" -H bash -c "
    cd '${APP_DIR}' &&
    npx prisma db push --skip-generate
"

echo "==> [6/6] Install + start systemd unit"
install -m 0644 deploy/ariza-bot.service /etc/systemd/system/ariza-bot.service

systemctl daemon-reload
systemctl enable ariza-bot.service
systemctl restart ariza-bot.service

echo
echo "Done. Useful commands:"
echo "  sudo systemctl status ariza-bot"
echo "  sudo journalctl -u ariza-bot -f"
echo "  sudo systemctl restart ariza-bot"
