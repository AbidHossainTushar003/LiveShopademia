#!/bin/sh
set -eu

: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_MIGRATION_PASSWORD:?POSTGRES_MIGRATION_PASSWORD is required}"

case "$POSTGRES_PASSWORD $POSTGRES_APP_PASSWORD $POSTGRES_MIGRATION_PASSWORD" in
    *replace-with*|*change-this*)
        printf 'Replace all example database passwords before production initialization.\n' >&2
        exit 1
        ;;
esac
if [ "${#POSTGRES_PASSWORD}" -lt 32 ] || [ "${#POSTGRES_APP_PASSWORD}" -lt 32 ] \
    || [ "${#POSTGRES_MIGRATION_PASSWORD}" -lt 32 ]; then
    printf 'Production database passwords must each contain at least 32 characters.\n' >&2
    exit 1
fi

psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=app_password="$POSTGRES_APP_PASSWORD" \
    --set=migration_password="$POSTGRES_MIGRATION_PASSWORD" \
    --command "CREATE ROLE shopademia_migrator LOGIN PASSWORD :'migration_password'; CREATE ROLE shopademia_app LOGIN PASSWORD :'app_password'; GRANT USAGE, CREATE ON SCHEMA public TO shopademia_migrator; GRANT USAGE ON SCHEMA public TO shopademia_app; ALTER DEFAULT PRIVILEGES FOR ROLE shopademia_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shopademia_app; ALTER DEFAULT PRIVILEGES FOR ROLE shopademia_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO shopademia_app;"
