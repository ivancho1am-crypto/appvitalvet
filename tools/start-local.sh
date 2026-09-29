#!/usr/bin/env bash
# Arranca el servidor local (puerto 3000) con el dashboard /estadisticas.html conectado
# a los MISMOS datos de Supabase que usa producción (solo lectura desde el dashboard).
#
# - La conexión (URL + clave anon) es pública: producción se la entrega a cualquier navegador
#   que abra la app. Se lee de allí en cada arranque, así no se guarda ninguna clave en el repo.
# - Se pasa como STATS_SUPABASE_*: solo afecta a /estadisticas.html. La app clínica local (/)
#   sigue SIN sincronizar, para que probar cosas en local nunca escriba en la base de producción.
# - Los datos siguen protegidos por RLS: hay que iniciar sesión en el dashboard para ver algo.
set -euo pipefail
cd "$(dirname "$0")/.."

PROD="${PROD_URL:-https://appvitalvet-production.up.railway.app}"
html="$(curl -fsS --max-time 15 "$PROD/")" || { echo "No pude contactar $PROD" >&2; exit 1; }

export STATS_SUPABASE_URL="$(grep -o 'window.__SB_URL="[^"]*"' <<<"$html" | head -1 | cut -d'"' -f2)"
export STATS_SUPABASE_ANON_KEY="$(grep -o 'window.__SB_KEY="[^"]*"' <<<"$html" | head -1 | cut -d'"' -f2)"

if [ -z "$STATS_SUPABASE_URL" ] || [ -z "$STATS_SUPABASE_ANON_KEY" ]; then
  echo "La página de $PROD no trae la conexión a Supabase; el dashboard quedará en modo snapshot." >&2
fi

# Por defecto la app clínica local NO se conecta a Supabase, para que probar
# cosas en local nunca escriba en la base real. Con --con-datos-reales sí se
# conecta: hace falta para probar el espejo relacional de punta a punta, porque
# ese camino necesita una sesión de personal de verdad.
if [ "${1:-}" = "--con-datos-reales" ]; then
  export SUPABASE_URL="$STATS_SUPABASE_URL"
  export SUPABASE_ANON_KEY="$STATS_SUPABASE_ANON_KEY"
  echo
  echo "  ⚠  MODO DATOS REALES: lo que guardes en la app local se escribe en la"
  echo "     base de producción. Úsalo solo para probar, y borra lo que crees."
  echo
fi

if [ -n "${SUPABASE_URL:-}" ]; then estado_app="conectada a datos reales"; else estado_app="sin conexión, modo seguro"; fi

echo "Dashboard: http://localhost:${PORT:-3000}/estadisticas.html  (Supabase: ${STATS_SUPABASE_URL:-sin configurar})"
echo "App:       http://localhost:${PORT:-3000}/  ($estado_app)"
exec node server.js
