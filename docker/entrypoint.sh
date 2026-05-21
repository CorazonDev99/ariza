#!/usr/bin/env bash
set -euo pipefail

# Sync Prisma schema → DB (idempotent — works on fresh DBs and existing).
# `db push` is fine while we don't carry a migrations/ folder. Switch to
# `migrate deploy` once we commit migrations.
echo "[entrypoint] Syncing Prisma schema to database..."
npx prisma db push --skip-generate

# NOTE: template seeding is performed by `SeedService` at bot startup
# (see src/main.ts) — no need to invoke `scripts/seed-templates.ts`
# here. That CLI script imports from `src/` which is intentionally
# NOT shipped in the runtime image (only `dist/`).
#
# Same story for `scripts/create-sample-template.ts` — sample .docx
# files are pre-generated on the dev machine and copied into the image
# via `COPY templates ./templates` in the Dockerfile.

echo "[entrypoint] Starting: $*"
exec "$@"
