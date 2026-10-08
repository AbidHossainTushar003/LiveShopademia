#!/bin/sh
set -eu

: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=app_password="$POSTGRES_APP_PASSWORD" \
    --command "CREATE ROLE shopademia_app LOGIN PASSWORD :'app_password'; GRANT USAGE, CREATE ON SCHEMA public TO shopademia_app;"
