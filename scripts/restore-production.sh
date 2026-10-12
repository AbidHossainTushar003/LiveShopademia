#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 4 ]]; then
    printf 'Usage: %s <database.dump.age> <uploads.tar.gz.age> <age-identity> <new-restore-directory>\n' "$0" >&2
    exit 2
fi

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.production.yml"
database_backup="$1"
uploads_backup="$2"
age_identity="$3"
restore_directory="$4"

for file in "$database_backup" "$uploads_backup" "$age_identity"; do
    if [[ ! -f "$file" ]]; then
        printf 'Required file not found: %s\n' "$file" >&2
        exit 1
    fi
done
if [[ ! -f "$ENV_FILE" ]]; then
    printf 'Environment file not found: %s\n' "$ENV_FILE" >&2
    exit 1
fi
if [[ -e "$restore_directory" ]]; then
    printf 'Restore directory already exists; choose a new empty path: %s\n' "$restore_directory" >&2
    exit 1
fi
for command_name in age docker tar; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf '%s is required to restore production backups.\n' "$command_name" >&2
        exit 1
    fi
done

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

umask 077
mkdir -m 700 -- "$restore_directory"
staging_directory="$(mktemp -d "${TMPDIR:-/tmp}/shopademia-restore.XXXXXX")"
restore_database="shopademia_restore_$(date -u +%Y%m%d%H%M%S)_$$"
database_created=false
restore_complete=false
cleanup() {
    rm -rf -- "$staging_directory"
    if [[ "$database_created" == true && "$restore_complete" != true ]]; then
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
            dropdb --if-exists --username "$POSTGRES_USER" "$restore_database" >&2 || true
        rmdir -- "$restore_directory" 2>/dev/null || true
    fi
}
trap cleanup EXIT

age --decrypt --identity "$age_identity" --output "$staging_directory/database.dump" "$database_backup"
age --decrypt --identity "$age_identity" --output "$staging_directory/uploads.tar.gz" "$uploads_backup"

while IFS= read -r entry; do
    if [[ "$entry" == uploads/ ]] || [[ "$entry" =~ ^uploads/[0-9a-fA-F-]{36}\.(jpg|png|webp)$ ]]; then
        continue
    fi
    printf 'Refusing unexpected path in uploads archive: %s\n' "$entry" >&2
    exit 1
done < <(tar --list --gzip --file "$staging_directory/uploads.tar.gz")
if tar --list --verbose --gzip --file "$staging_directory/uploads.tar.gz" | grep -Eq '^[lh]'; then
    printf 'Refusing links in uploads backup archive.\n' >&2
    exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
    createdb --username "$POSTGRES_USER" "$restore_database"
database_created=true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
    pg_restore --exit-on-error --no-owner --username "$POSTGRES_USER" --dbname "$restore_database" \
    < "$staging_directory/database.dump"
tar --extract --gzip --file "$staging_directory/uploads.tar.gz" --directory "$restore_directory" \
    --no-same-owner --no-same-permissions
restore_complete=true

printf 'Database restored to isolated database: %s\n' "$restore_database"
printf 'Uploaded files restored under: %s/uploads\n' "$restore_directory"
printf 'This script does not replace production data or copy files into the live uploads volume.\n'
