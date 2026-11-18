#!/bin/sh
set -eu

: "${NAS_SSH_TARGET:?Set NAS_SSH_TARGET to your SSH alias or user@host}"
NAS_PROJECT_DIR=${NAS_PROJECT_DIR:-/volume1/docker/e-library-service}
case "$NAS_SSH_TARGET" in
    -*|*[!a-zA-Z0-9_.@:-]*) printf '%s\n' 'Use a simple SSH alias or user@hostname.' >&2; exit 1 ;;
esac
case "$NAS_PROJECT_DIR" in
    /|*..*|*[!a-zA-Z0-9_/.-]*|'') printf '%s\n' 'Use a dedicated absolute project path without spaces or parent traversal.' >&2; exit 1 ;;
    /*) ;;
    *) printf '%s\n' 'NAS_PROJECT_DIR must be absolute.' >&2; exit 1 ;;
esac

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
ssh "$NAS_SSH_TARGET" "mkdir -p '$NAS_PROJECT_DIR/deploy/scripts'; if [ ! -d '$NAS_PROJECT_DIR/deploy/certs' ]; then mkdir -m 700 '$NAS_PROJECT_DIR/deploy/certs'; fi"
for file in compose.yml Caddyfile Caddyfile.https .env.example; do
    ssh "$NAS_SSH_TARGET" "cat > '$NAS_PROJECT_DIR/deploy/$file'" < "$project_dir/deploy/$file"
    ssh "$NAS_SSH_TARGET" "chmod 644 '$NAS_PROJECT_DIR/deploy/$file'"
done
for file in deploy.sh backup.sh smoke.py; do
    ssh "$NAS_SSH_TARGET" "cat > '$NAS_PROJECT_DIR/deploy/scripts/$file'" < "$project_dir/deploy/scripts/$file"
done
ssh "$NAS_SSH_TARGET" "chmod 755 '$NAS_PROJECT_DIR/deploy/scripts/deploy.sh' '$NAS_PROJECT_DIR/deploy/scripts/backup.sh' '$NAS_PROJECT_DIR/deploy/scripts/smoke.py'"
printf '%s\n' 'Configuration copied. No credentials were copied and no containers were started.'
printf '%s\n' "On the NAS, prepare $NAS_PROJECT_DIR/deploy/.env and certificates, then run:"
printf '%s\n' "cd '$NAS_PROJECT_DIR' && sudo ./deploy/scripts/deploy.sh"
