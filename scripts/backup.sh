#!/bin/sh
# Backup diário do PostgreSQL, com retenção configurável.
# Roda dentro do container "backup" do docker-compose.prod.yml.
#
# Restaurar um backup:
#   gunzip -c backups/ticketeira-2026-07-28-030000.sql.gz | \
#     docker compose -f docker-compose.prod.yml exec -T db psql -U ticketeira -d ticketeira

set -eu

RETENTION="${BACKUP_RETENTION_DAYS:-14}"
DIR=/backups
mkdir -p "$DIR"

run_backup() {
	stamp=$(date +%Y-%m-%d-%H%M%S)
	file="$DIR/ticketeira-$stamp.sql.gz"
	echo "[backup] gerando $file"
	if pg_dump --no-owner --no-privileges | gzip -9 >"$file.tmp"; then
		mv "$file.tmp" "$file"
		echo "[backup] ok - $(du -h "$file" | cut -f1)"
	else
		rm -f "$file.tmp"
		echo "[backup] FALHOU" >&2
		return 1
	fi
	# remove backups mais antigos que a retenção
	find "$DIR" -name 'ticketeira-*.sql.gz' -type f -mtime "+$RETENTION" -delete
}

# Um backup ao subir, depois um por dia às 03h (horário de Brasília).
run_backup || true

seconds_until_3am() {
	# ${x#0} remove o zero à esquerda: sem isso o shell interpreta "08" como octal
	h=$(date +%H); h=${h#0}; h=${h:-0}
	m=$(date +%M); m=${m#0}; m=${m:-0}
	s=$(date +%S); s=${s#0}; s=${s:-0}
	now=$((h * 3600 + m * 60 + s))
	target=$((3 * 3600))
	if [ "$now" -lt "$target" ]; then
		echo $((target - now))
	else
		echo $((86400 - now + target))
	fi
}

while true; do
	sleep "$(seconds_until_3am)"
	run_backup || true
done
