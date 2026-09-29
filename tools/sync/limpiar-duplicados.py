#!/usr/bin/env python3
"""
Limpia pacientes duplicados en las tablas relacionales.

  SIMULACRO (no borra nada):  python3 tools/sync/limpiar-duplicados.py
  BORRAR DE VERDAD:           python3 tools/sync/limpiar-duplicados.py --aplicar

Qué borra, y solo eso:
  Un paciente se considera duplicado descartable cuando cumple las TRES:
    1. No viene del panel clínico (saas_mas_id vacío).
    2. No tiene ni un registro de historia clínica, vacuna, desparasitación
       ni peso. O sea: nadie lo ha atendido nunca.
    3. Existe otro paciente con el MISMO nombre, raza y fecha de nacimiento
       que sí viene del panel. Es decir, es una copia del mismo animal.

  Si falla cualquiera de las tres, no se toca y se reporta aparte.

De dónde salieron: la función create_paciente_from_saas insertaba el paciente
pero devolvía null y sin vincular al dueño, así que el panel nunca supo que
existía y quedó una copia suelta. Esa función ya no se usa (se quitó del código
el 2026-09-25), así que esto no se vuelve a generar. La etiqueta "Portal Web"
que llevan despista: es el valor por defecto de la columna, no su origen real.

NUNCA toca vv_store, que es la fuente de verdad de la clínica.
Antes de correrlo con --aplicar, hacer un respaldo: tools/sync/respaldo.sh
"""
import json, os, pathlib, re, subprocess, sys
from collections import defaultdict

APLICAR = "--aplicar" in sys.argv
ENV = pathlib.Path.home() / "IA-VitalVet/agente-whatsapp-vitabot/.env"
env = dict(re.findall(r'^([A-Z_]+)=(.*)$', ENV.read_text(), re.M))
limpia = lambda s: s.strip().strip('"').strip("'")
URL, KEY = limpia(env["SUPABASE_URL"]), limpia(env["SUPABASE_SERVICE_KEY"])

def api(metodo, ruta):
    r = subprocess.run(["curl", "-sS", "--max-time", "120", "-X", metodo,
                        f"{URL}/rest/v1/{ruta}", "-H", f"apikey: {KEY}",
                        "-H", f"Authorization: Bearer {KEY}", "-w", "\n%{http_code}"],
                       capture_output=True, text=True)
    cuerpo, _, codigo = r.stdout.rpartition("\n")
    if not codigo.strip().isdigit() or int(codigo) >= 300:
        raise SystemExit(f"Error de Supabase en {metodo} {ruta}: {cuerpo[:300]}")
    return json.loads(cuerpo) if cuerpo.strip() else []

def todas(tabla, cols="*"):
    filas, desde = [], 0
    while True:
        lote = api("GET", f"{tabla}?select={cols}&limit=1000&offset={desde}")
        filas += lote
        if len(lote) < 1000: return filas
        desde += 1000

n = lambda s: re.sub(r"\s+", " ", str(s or "").strip().lower())
fecha = lambda v: str(v or "")[:10]

print("=" * 70)
print("  SIMULACRO — no se borra nada" if not APLICAR else "  BORRANDO DE VERDAD")
print("=" * 70)

pac  = todas("pacientes", "id,tutor_id,nombre,especie,raza,fecha_nacimiento,saas_mas_id,creado_en,registrado_por")
mas  = api("GET", "vv_store?key=eq.mas&select=data")[0]["data"]

# Un paciente está "en uso" si alguien lo atendió alguna vez.
en_uso = set()
for tabla in ("historia_clinica", "vacunas", "desparasitaciones", "registro_peso"):
    for f in todas(tabla, "paciente_id"):
        if f.get("paciente_id"): en_uso.add(f["paciente_id"])

# Huella del animal: nombre + raza + nacimiento. Es lo que distingue a dos
# mascotas homónimas del mismo dueño, y lo comprobamos contra vv_store.
huella_mas = defaultdict(int)
for m in mas:
    huella_mas[(n(m.get("nombre")), n(m.get("raza")), fecha(m.get("fn")))] += 1

candidatos, protegidos = [], defaultdict(list)
for p in pac:
    if p.get("saas_mas_id"):
        continue                                  # viene del panel: se queda
    if p["id"] in en_uso:
        protegidos["tiene atenciones registradas"].append(p); continue
    h = (n(p.get("nombre")), n(p.get("raza")), fecha(p.get("fecha_nacimiento")))
    if huella_mas.get(h):
        candidatos.append(p)
    elif p.get("tutor_id"):
        protegidos["registro propio del portal (no duplica a nadie)"].append(p)
    else:
        protegidos["sin dueño y sin equivalente en el panel"].append(p)

print(f"\npacientes en la tabla : {len(pac)}")
print(f"vienen del panel      : {sum(1 for p in pac if p.get('saas_mas_id'))}")
print(f"\nDUPLICADOS A BORRAR   : {len(candidatos)}")
for p in candidatos[:8]:
    print(f"    · {str(p.get('nombre'))[:24]:<24} {str(p.get('raza'))[:18]:<18} nac {fecha(p.get('fecha_nacimiento'))}")
if len(candidatos) > 8: print(f"    … y {len(candidatos) - 8} más")

print(f"\nNO SE TOCAN           : {sum(len(v) for v in protegidos.values())}")
for motivo, filas in protegidos.items():
    print(f"    · {motivo}: {len(filas)}")
    for p in filas[:4]:
        print(f"        {str(p.get('nombre'))[:30]}")

if not APLICAR:
    print("\nSimulacro. Para borrar de verdad:")
    print("  tools/sync/respaldo.sh && python3 tools/sync/limpiar-duplicados.py --aplicar")
    sys.exit(0)

if not candidatos:
    print("\nNada que borrar."); sys.exit(0)

print(f"\nBorrando {len(candidatos)}…")
for i, p in enumerate(candidatos, 1):
    api("DELETE", f"pacientes?id=eq.{p['id']}")
    if i % 25 == 0 or i == len(candidatos):
        print(f"  {i}/{len(candidatos)}", end="\r", flush=True)

restantes = todas("pacientes", "id,saas_mas_id")
print(f"\n\npacientes ahora: {len(restantes)} · del panel: {sum(1 for p in restantes if p.get('saas_mas_id'))}")
print("vv_store NO fue modificado.")
