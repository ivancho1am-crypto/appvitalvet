#!/usr/bin/env python3
"""Descarga el respaldo. Lo invoca respaldo.sh, que le pasa SB_URL, SB_KEY y OUT.

Se separa del shell porque hay que paginar y armar JSON, y hacerlo con `curl` y
`cat` dentro de bash se rompe en cuanto un campo trae saltos de línea (a
historia_clinica.datos_extra le pasa).
"""
import json, os, pathlib, subprocess, sys

URL, KEY = os.environ["SB_URL"], os.environ["SB_KEY"]
OUT = pathlib.Path(os.environ["OUT"])

TABLAS = ["tutores", "pacientes", "historia_clinica", "vacunas", "desparasitaciones",
          "registro_peso", "recordatorios", "app_users", "administradores", "guias_clinicas"]


def pedir(ruta):
    r = subprocess.run(["curl", "-fsS", "--max-time", "120", f"{URL}/rest/v1/{ruta}",
                        "-H", f"apikey: {KEY}", "-H", f"Authorization: Bearer {KEY}"],
                       capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or "sin detalle")[:200])
    return json.loads(r.stdout)


def todas(tabla):
    """Pagina hasta agotar la tabla. Sin esto el respaldo se trunca a 1000 filas."""
    filas, desde = [], 0
    while True:
        lote = pedir(f"{tabla}?select=*&limit=1000&offset={desde}")
        filas += lote
        if len(lote) < 1000:
            return filas
        desde += 1000


fallos = 0

# ── vv_store: la fuente de verdad de la clínica ──────────────────────────────
crudo = pedir("vv_store?select=key,data,updated_at")
(OUT / "vv_store_completo.json").write_text(json.dumps(crudo, ensure_ascii=False))

resumen = {}
for fila in crudo:
    datos = fila.get("data")
    (OUT / f"vv_store__{fila['key']}.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1))
    resumen[fila["key"]] = {"elementos": len(datos) if isinstance(datos, list) else None,
                            "actualizado": fila.get("updated_at")}
(OUT / "_resumen.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=1))
for k, v in sorted(resumen.items(), key=lambda x: -(x[1]["elementos"] or 0)):
    print(f"  vv_store/{k:<12} {str(v['elementos']):>6} elementos   {(v['actualizado'] or '')[:10]}")

# ── tablas relacionales ──────────────────────────────────────────────────────
for tabla in TABLAS:
    try:
        filas = todas(tabla)
        (OUT / f"tabla_{tabla}.json").write_text(json.dumps(filas, ensure_ascii=False))
        print(f"  tabla/{tabla:<20} {len(filas):>6} filas")
    except Exception as e:
        fallos += 1
        print(f"  tabla/{tabla:<20}   ERROR: {e}", file=sys.stderr)

# Una comprobación final: que lo guardado se pueda volver a leer. Un respaldo
# que no abre no es un respaldo.
malos = []
for f in OUT.glob("*.json"):
    try:
        json.loads(f.read_text())
    except Exception as e:
        malos.append(f"{f.name}: {e}")
if malos:
    print("\n  ARCHIVOS ILEGIBLES:", file=sys.stderr)
    for m in malos:
        print("   ", m, file=sys.stderr)
    sys.exit(1)
if fallos:
    sys.exit(1)
print(f"\n  {len(list(OUT.glob('*.json')))} archivos, todos verificados legibles.")
