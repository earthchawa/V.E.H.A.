#!/bin/sh
# Build command on Vercel (npm runs "vercel-build" instead of "build" when present).
# 1. Apply migrations over a direct (unpooled) connection — Neon's pooler can't run them.
# 2. With DEMO_SEED=true, create/refresh the demo accounts and sample data (idempotent).
# 3. Build Next.js.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Add a Postgres database (Vercel → Storage → Neon) and redeploy." >&2
  exit 1
fi

MIGRATE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy

if [ "$DEMO_SEED" = "true" ]; then
  npx tsx prisma/seed.ts --demo
fi

npx next build
