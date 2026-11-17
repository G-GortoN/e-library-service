#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file=${ELIBRARY_ENV_FILE:-"$project_dir/deploy/.env"}
compose_file="$project_dir/deploy/compose.yml"

if [ ! -f "$env_file" ]; then
    printf '%s\n' "Missing deployment environment: $env_file" >&2
    printf '%s\n' 'Copy deploy/.env.example, replace the placeholders, then retry.' >&2
    exit 1
fi

# Docker access is intentionally not elevated or reconfigured by this script.
docker info > /dev/null
docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
api = config["services"]["api"]["environment"]
for name in ("DATABASE_PASSWORD", "APP_ADMIN_PASSWORD"):
    value = str(api.get(name, ""))
    if not value or value.startswith("replace-with-"):
        sys.exit("Replace the example " + name + " before deployment")
for name in ("api", "web"):
    if "replace-with-" in config["services"][name]["image"]:
        sys.exit("Select a verified image reference before deployment")
if ".invalid" in str(api.get("APP_PUBLIC_BASE_URL", "")):
    sys.exit("Configure a trusted public HTTPS base URL before deployment")
'
docker compose --env-file "$env_file" -f "$compose_file" pull
docker compose --env-file "$env_file" -f "$compose_file" up -d --wait --wait-timeout 180
docker compose --env-file "$env_file" -f "$compose_file" ps
docker compose --env-file "$env_file" -f "$compose_file" images --format json

printf '%s\n' 'Containers are healthy. Verify HTTPS, sign-in, mail delivery and both external network paths separately.'
