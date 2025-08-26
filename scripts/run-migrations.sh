#!/usr/bin/env bash
set -euo pipefail

# Run SQL migrations in server/drizzle against the DATABASE_URL.
# Usage:
#   export DATABASE_URL='postgresql://user:pass@host:5432/dbname'
#   ./scripts/run-migrations.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Export it, e.g.:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
  exit 1
fi

MASKED_DB=$(echo "$DATABASE_URL" | sed 's/:.*@/:***@/')
echo "📦 Running migrations"
echo "🔌 Database: $MASKED_DB"

cd "$ROOT_DIR/server"
pnpm run db:migrate:sql

echo "✅ Migrations completed"


