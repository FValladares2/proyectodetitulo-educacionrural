#!/bin/sh
# Respaldo periódico de la base de datos local (servicio "respaldo" de compose.local.yaml).
# Cada RESPALDO_INTERVALO_HORAS genera respaldos/<base>-<fecha>.archive.gz y elimina los que
# tengan más de RESPALDO_RETENCION_DIAS días.
#
# Restaurar un respaldo (reemplaza los datos actuales):
#   docker compose -f compose.yaml -f compose.local.yaml exec respaldo \
#     mongorestore --uri "mongodb://mongodb:27017/" --gzip --drop --archive=/respaldos/<archivo>
#
# Los archivos están cifrados con ENCRYPTION_KEY: guardar una copia de esa clave fuera del
# servidor, ya que un respaldo sin ella no permite recuperar los archivos.
set -u
INTERVALO=$(( ${RESPALDO_INTERVALO_HORAS:-24} * 3600 ))
RETENCION=${RESPALDO_RETENCION_DIAS:-7}
DB=${MONGODB_DB:-educacionrural}
URI=${MONGODB_URI:-mongodb://mongodb:27017/}

mkdir -p /respaldos
sleep 60  # dar tiempo a que MongoDB inicie
while true; do
    archivo="/respaldos/${DB}-$(date +%Y%m%d-%H%M).archive.gz"
    if mongodump --uri "$URI" --db "$DB" --gzip --archive="$archivo" --quiet; then
        echo "$(date -Iseconds) respaldo creado: $archivo"
    else
        echo "$(date -Iseconds) ERROR: no se pudo crear el respaldo" >&2
        rm -f "$archivo"
    fi
    find /respaldos -name "${DB}-*.archive.gz" -mtime +"$RETENCION" -delete
    sleep "$INTERVALO"
done
