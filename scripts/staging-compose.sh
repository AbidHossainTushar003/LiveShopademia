#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.staging"
COMPOSE_FILE="$ROOT_DIR/docker-compose.staging.yml"

if [[ $# -ne 1 ]]; then
    printf 'Usage: %s {validate|config|build|up|status|logs|stop}\n' "$0" >&2
    exit 2
fi

action="$1"
case "$action" in
    validate)
        cd "$ROOT_DIR"
        exec node scripts/validate-staging-config.js
        ;;
    config|build|up|status|logs|stop)
        ;;
    *)
        printf 'Unsupported staging action: %s\n' "$action" >&2
        exit 2
        ;;
esac

if [[ ! -f "$ENV_FILE" || -L "$ENV_FILE" ]]; then
    printf 'A regular, non-symlink .env.staging file is required; copy the example and supply staging-only values.\n' >&2
    exit 1
fi

if [[ -n "${DOCKER_HOST:-}" || -n "${DOCKER_CONTEXT:-}" ]]; then
    printf 'Refusing Docker overrides; unset DOCKER_HOST and DOCKER_CONTEXT and use the local default context.\n' >&2
    exit 1
fi

docker_context="$(docker context show)"
if [[ "$docker_context" != "default" ]]; then
    printf 'Refusing non-default Docker context: %s\n' "$docker_context" >&2
    exit 1
fi
docker_endpoint="$(docker context inspect default --format '{{ (index .Endpoints "docker").Host }}')"
if [[ "$docker_endpoint" != unix://* && "$docker_endpoint" != npipe://* ]]; then
    printf 'Refusing non-local Docker endpoint.\n' >&2
    exit 1
fi

cd "$ROOT_DIR"
node scripts/validate-staging-config.js

unset STAGING_DOMAIN STAGING_DEPLOY_AUTHORIZED STAGING_CHANGE_ID STAGING_OPERATOR
unset POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_APP_PASSWORD POSTGRES_MIGRATION_PASSWORD
unset DATABASE_URL MIGRATION_DATABASE_URL JWT_SECRET MFA_ENCRYPTION_KEY ADMIN_EMAIL ADMIN_PASSWORD
unset DELIVERY_ADVANCE_CHARGE
for compose_var in ${!COMPOSE_@}; do
    unset "$compose_var"
done

case "$action" in
    config)
        exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
        ;;
    build)
        exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build
        ;;
    up)
        exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build --detach
        ;;
    status)
        exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
        ;;
    logs)
        exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=100
        ;;
    stop)
        exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop
        ;;
esac
