#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.production.yml"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/shopademia}"

if [[ ! -f "$ENV_FILE" ]]; then
    printf 'Environment file not found: %s\n' "$ENV_FILE" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    printf 'BACKUP_AGE_RECIPIENT must be set in %s\n' "$ENV_FILE" >&2
    exit 1
fi
if ! command -v age >/dev/null 2>&1; then
    printf 'age is required to encrypt database backups.\n' >&2
    exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
    printf 'Docker is required to create database backups.\n' >&2
    exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/shopademia-$timestamp.dump.age"
temporary_file="$(mktemp "$BACKUP_DIR/.shopademia-$timestamp.XXXXXX")"
trap 'rm -f -- "$temporary_file"' EXIT

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
    sh -c 'pg_dump --format=custom --username="$POSTGRES_USER" "$POSTGRES_DB"' \
    | age --recipient "$BACKUP_AGE_RECIPIENT" > "$temporary_file"

mv -- "$temporary_file" "$backup_file"
printf 'Encrypted backup created: %s\n' "$backup_file"
