#!/usr/bin/env bash
set -euo pipefail

# Run SQL migrations in server/drizzle against the DATABASE_URL.
# Usage:
#   With default .env resolution (server/.env):
#     pnpm run db:migrate
#   With named env file (e.g. .env.dev):
#     pnpm run db:migrate dev
#     pnpm run db:migrate --env dev
#   With explicit env file path:
#     pnpm run db:migrate --env-file /absolute/path/to/.env.dev
#   You can also set ENV_FILE or DOTENV_CONFIG_PATH to point to the env file.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments for environment selection
ENV_NAME=""
ENV_FILE_ARG=""

if [[ "${1:-}" == "--env" && -n "${2:-}" ]]; then
  ENV_NAME="$2"
elif [[ "${1:-}" == "--env-file" && -n "${2:-}" ]]; then
  ENV_FILE_ARG="$2"
elif [[ -n "${1:-}" ]]; then
  # First positional argument can be an env name or a file path
  if [[ -f "$1" ]]; then
    ENV_FILE_ARG="$1"
  else
    ENV_NAME="$1"
  fi
fi

# Support npm config style: pnpm run db:migrate --env=dev
if [[ -z "$ENV_NAME" && -n "${npm_config_env:-}" ]]; then
  ENV_NAME="$npm_config_env"
fi
if [[ -z "$ENV_FILE_ARG" && -n "${npm_config_env_file:-}" ]]; then
  ENV_FILE_ARG="$npm_config_env_file"
fi

# Also respect ENV_FILE if provided
if [[ -z "$ENV_FILE_ARG" && -n "${ENV_FILE:-}" ]]; then
  ENV_FILE_ARG="$ENV_FILE"
fi

RESOLVED_ENV_FILE=""

resolve_path() {
  local p="$1"
  if [[ -z "$p" ]]; then
    return 0
  fi
  if [[ -f "$p" ]]; then
    echo "$(cd "$(dirname "$p")" && pwd)/$(basename "$p")"
    return 0
  fi
  # Try relative to repo root and server dir
  if [[ -f "$ROOT_DIR/$p" ]]; then
    echo "$ROOT_DIR/$p"
    return 0
  fi
  if [[ -f "$ROOT_DIR/server/$p" ]]; then
    echo "$ROOT_DIR/server/$p"
    return 0
  fi
  return 1
}

if [[ -n "$ENV_FILE_ARG" ]]; then
  if RESOLVED=$(resolve_path "$ENV_FILE_ARG"); then
    RESOLVED_ENV_FILE="$RESOLVED"
  else
    echo "⚠️  Specified env file not found: $ENV_FILE_ARG"
    exit 1
  fi
elif [[ -n "$ENV_NAME" ]]; then
  # Prefer env file in server/, then root
  if RESOLVED=$(resolve_path ".env.$ENV_NAME"); then
    RESOLVED_ENV_FILE="$RESOLVED"
  else
    echo "⚠️  Env file .env.$ENV_NAME not found in repo root or server/"
    exit 1
  fi
fi

if [[ -n "$RESOLVED_ENV_FILE" ]]; then
  export DOTENV_CONFIG_PATH="$RESOLVED_ENV_FILE"
  echo "🧩 Using env file: $DOTENV_CONFIG_PATH"
fi

echo "📦 Running migrations"

cd "$ROOT_DIR/server"
pnpm run db:migrate:sql

echo "✅ Migrations completed"
