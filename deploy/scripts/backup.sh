#!/bin/sh
set -eu
umask 077

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
env_file=${ELIBRARY_ENV_FILE:-"$project_dir/deploy/.env"}
backup_root=${ELIBRARY_BACKUP_DIR:-"$project_dir/deploy/backups"}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="$backup_root/$stamp"
compose_file="$project_dir/deploy/compose.yml"

test -f "$env_file"
mkdir -p "$backup_root"
mkdir "$backup_dir"
docker compose --env-file "$env_file" -f "$compose_file" exec -T db \
    pg_dump -U elibrary -d elibrary --format=custom > "$backup_dir/database.dump.partial"
mv "$backup_dir/database.dump.partial" "$backup_dir/database.dump"
docker compose --env-file "$env_file" -f "$compose_file" exec -T api \
    tar -C /app/media -cf - . > "$backup_dir/media.tar.partial"
mv "$backup_dir/media.tar.partial" "$backup_dir/media.tar"
docker compose --env-file "$env_file" -f "$compose_file" images --format json > "$backup_dir/images.json"
cp "$env_file" "$backup_dir/release.env"
if [ -d "$project_dir/deploy/certs" ]; then
    tar -C "$project_dir/deploy" -cf "$backup_dir/certificates.tar" certs
fi
printf '%s\n' "Backup saved: $backup_dir"
printf '%s\n' 'Contains private configuration/certificates. Store securely and test restoration on an isolated database.'
