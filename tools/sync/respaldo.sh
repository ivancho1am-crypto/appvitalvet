#!/usr/bin/env bash
# Respaldo completo de los datos de VitalVet en Supabase (wjzxdevrnzvgklapolve).
#
# Qué hace: descarga a disco las 9 filas de vv_store (donde vive TODA la clínica:
# propietarios, mascotas e historia clínica) y además las tablas relacionales.
# Solo lectura: no modifica nada en Supabase.
#
# Por qué existe: vv_store guarda cada colección como un único JSON gigante. Si
# una escritura sale mal, se pierde la colección entera de una sola vez. Este
# respaldo es la red antes de cualquier limpieza o migración.
#
# Uso:  tools/sync/respaldo.sh
# Deja: ~/vitalvet-backups/<fecha-hora>/*.json  (permisos 700, solo tu usuario)
set -euo pipefail

ENV_FILE="$HOME/IA-VitalVet/agente-whatsapp-vitabot/.env"
[ -f "$ENV_FILE" ] || { echo "No encuentro $ENV_FILE (de ahí sale la credencial)." >&2; exit 1; }

# La clave nunca se imprime ni se guarda en el respaldo.
SB_URL=$(grep -E '^SUPABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
SB_KEY=$(grep -E '^SUPABASE_SERVICE_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
[ -n "$SB_URL" ] && [ -n "$SB_KEY" ] || { echo "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env" >&2; exit 1; }

STAMP=$(date '+%Y-%m-%d_%H%M')
OUT="$HOME/vitalvet-backups/$STAMP"
mkdir -p "$OUT"; chmod 700 "$HOME/vitalvet-backups" "$OUT"
echo "Respaldando en $OUT"

# Todo el trabajo va en Python: hay que paginar, porque PostgREST devuelve como
# máximo 1000 filas por petición y NO avisa de que recortó. Sin paginar, el
# respaldo de historia_clinica se truncaba en silencio a 1000 de 1615 registros
# — un respaldo incompleto que parecía completo.
SB_URL="$SB_URL" SB_KEY="$SB_KEY" OUT="$OUT" python3 "$(dirname "$0")/respaldo.py"

chmod -R go-rwx "$OUT"
echo
echo "Listo. Tamaño: $(du -sh "$OUT" | cut -f1)"
echo "Los archivos son JSON legible: se pueden abrir con cualquier editor."
