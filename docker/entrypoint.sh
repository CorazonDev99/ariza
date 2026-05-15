#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] Syncing Prisma schema to database..."
# `db push` works on fresh DBs without a migrations folder.
# If you commit prisma/migrations later, switch this to `migrate deploy`.
npx prisma db push --skip-generate

if [ ! -f /app/templates/ariza-alimony.docx ]; then
  echo "[entrypoint] Sample template missing — generating..."
  npx tsx scripts/create-sample-template.ts || true
fi

echo "[entrypoint] Seeding templates..."
npx tsx scripts/seed-templates.ts || true

echo "[entrypoint] Starting: $*"
exec "$@"
