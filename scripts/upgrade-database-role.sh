#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.production.yml"

if [[ ! -f "$ENV_FILE" ]]; then
    printf 'Environment file not found: %s\n' "$ENV_FILE" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${POSTGRES_MIGRATION_PASSWORD:-}" ]]; then
    printf 'POSTGRES_MIGRATION_PASSWORD must be set in %s\n' "$ENV_FILE" >&2
    exit 1
fi
if [[ ${#POSTGRES_MIGRATION_PASSWORD} -lt 32 || "$POSTGRES_MIGRATION_PASSWORD" == *replace-with* \
    || "$POSTGRES_MIGRATION_PASSWORD" == *change-this* ]]; then
    printf 'Set a unique migration password of at least 32 characters in %s\n' "$ENV_FILE" >&2
    exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
    printf 'Docker is required to update database roles.\n' >&2
    exit 1
fi

table_exists="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
    --tuples-only --no-align --command "SELECT to_regclass('public.shop_transactions') IS NOT NULL")"
if [[ "$table_exists" == t ]]; then
    duplicate_references="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
        psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
        --tuples-only --no-align --command \
        "SELECT EXISTS (SELECT 1 FROM shop_transactions GROUP BY shop_id, lower(btrim(reference)) HAVING COUNT(*) > 1)")"
    if [[ "$duplicate_references" == t ]]; then
        printf 'Duplicate shop transaction references must be reconciled before role upgrade and deployment.\n' >&2
        exit 1
    fi
fi

printf 'This changes ownership and grants for every object in the public schema.\n'
printf 'Create and verify a restorable backup before continuing.\n'
read -r -p 'Type UPGRADE-DB-ROLE to proceed: ' confirmation
if [[ "$confirmation" != UPGRADE-DB-ROLE ]]; then
    printf 'Database role upgrade cancelled.\n' >&2
    exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T database \
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=migration_password="$POSTGRES_MIGRATION_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE shopademia_migrator LOGIN PASSWORD %L', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopademia_migrator')
\gexec
ALTER ROLE shopademia_migrator LOGIN PASSWORD :'migration_password';
GRANT USAGE, CREATE ON SCHEMA public TO shopademia_migrator;
GRANT USAGE ON SCHEMA public TO shopademia_app;
ALTER DEFAULT PRIVILEGES FOR ROLE shopademia_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shopademia_app;
ALTER DEFAULT PRIVILEGES FOR ROLE shopademia_migrator IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO shopademia_app;
DO $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO shopademia_migrator', item.tablename);
    END LOOP;
    FOR item IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO shopademia_migrator', item.sequencename);
    END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shopademia_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO shopademia_app;
REVOKE CREATE ON SCHEMA public FROM shopademia_app;
SQL

printf 'Database roles updated. Set MIGRATION_DATABASE_URL to shopademia_migrator and redeploy.\n'
