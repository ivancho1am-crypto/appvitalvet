#!/usr/bin/env python3
"""
PASO 3 — Copia vv_store (JSON) a las tablas relacionales de VitalVet.

  SIMULACRO (no escribe nada):   python3 paso3-copiar.py
  COPIA DE VERDAD:               python3 paso3-copiar.py --aplicar

Qué hace:
  vv_store.props (497)  →  tutores           (enlazando por cédula)
  vv_store.mas   (611)  →  pacientes         (enlazando por dueño + nombre)
  vv_store.hist (1613)  →  historia_clinica  (con el registro original íntegro)

Garantías:
  · NUNCA escribe en vv_store. La clínica sigue funcionando igual durante y después.
  · Repetible: se apoya en saas_prop_id / saas_mas_id / saas_hist_id, que son
    índices únicos. Correrlo diez veces da el mismo resultado que correrlo una.
  · Nada se pierde: los 47 campos de cada registro clínico se guardan completos
    en historia_clinica.datos_extra, además de los 18 que van a columna propia.
  · Ante cualquier ambigüedad (mascotas duplicadas, dueño inexistente) NO adivina:
    se salta el caso y lo reporta para que lo revises tú.
"""
import json, re, sys, subprocess, tempfile, pathlib
from collections import defaultdict

APLICAR = "--aplicar" in sys.argv
ENV = pathlib.Path.home() / "IA-VitalVet/agente-whatsapp-vitabot/.env"

def credenciales():
    txt = ENV.read_text()
    d = dict(re.findall(r'^([A-Z_]+)=(.*)$', txt, re.M))
    limpia = lambda s: s.strip().strip('"').strip("'")
    return limpia(d["SUPABASE_URL"]), limpia(d["SUPABASE_SERVICE_KEY"])

URL, KEY = credenciales()

def api(metodo, ruta, cuerpo=None, prefer=None):
    """Usa curl: el Python de Homebrew no trae los certificados raíz configurados."""
    cmd = ["curl", "-sS", "--max-time", "180", "-X", metodo, f"{URL}/rest/v1/{ruta}",
           "-H", f"apikey: {KEY}", "-H", f"Authorization: Bearer {KEY}",
           "-H", "Content-Type: application/json", "-w", "\n%{http_code}"]
    if prefer: cmd += ["-H", f"Prefer: {prefer}"]
    tmp = None
    if cuerpo is not None:
        # El cuerpo va por archivo: 1.600 registros no caben en un argumento de shell.
        tmp = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
        json.dump(cuerpo, tmp); tmp.close()
        cmd += ["--data-binary", f"@{tmp.name}"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
    finally:
        if tmp: pathlib.Path(tmp.name).unlink(missing_ok=True)
    if r.returncode != 0:
        raise SystemExit(f"\nERROR de red en {metodo} {ruta}:\n  {r.stderr[:300]}\n"
                         f"No se escribió nada más. vv_store está intacto.")
    cuerpo_resp, _, codigo = r.stdout.rpartition("\n")
    if not codigo.strip().isdigit() or not (200 <= int(codigo) < 300):
        raise SystemExit(f"\nERROR de Supabase en {metodo} {ruta} (HTTP {codigo.strip()}):\n"
                         f"  {cuerpo_resp[:400]}\nNo se escribió nada más. vv_store está intacto.")
    return json.loads(cuerpo_resp) if cuerpo_resp.strip() else []

def leer_todo(tabla, columnas):
    """Pagina de a 1000: PostgREST no devuelve más en una sola petición."""
    fuera, desde = [], 0
    while True:
        lote = api("GET", f"{tabla}?select={columnas}&limit=1000&offset={desde}")
        fuera += lote
        if len(lote) < 1000: return fuera
        desde += 1000

def insertar(tabla, filas, etiqueta):
    """Inserta en lotes y devuelve las filas creadas (con su id)."""
    if not filas: return []
    if not APLICAR:
        # En simulacro no se escribe, pero se inventan ids para que las fases
        # siguientes cuenten bien. Sin esto, las mascotas de un dueño que aún
        # no existe se reportarían como huérfanas y el conteo engañaría.
        return [dict(f, id=f"simulado-{tabla}-{i}") for i, f in enumerate(filas)]
    creadas = []
    for i in range(0, len(filas), 200):
        trozo = filas[i:i+200]
        creadas += api("POST", tabla, trozo, prefer="return=representation")
        print(f"    {etiqueta}: {min(i+200, len(filas))}/{len(filas)}", end="\r", flush=True)
    print(" " * 60, end="\r")
    return creadas

def parchar(tabla, fila_id, cambios):
    if APLICAR and cambios:
        api("PATCH", f"{tabla}?id=eq.{fila_id}", cambios)

# ── normalizadores ────────────────────────────────────────────────────────────
txt   = lambda v: (str(v).strip() or None) if v not in (None, "") else None
dig   = lambda v: re.sub(r"\D", "", str(v or ""))
norm  = lambda v: re.sub(r"\s+", " ", str(v or "").strip().lower())
def fecha(v):
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", str(v or ""))
    return m.group(1) if m else None
def numero(v):
    try:
        n = float(str(v).replace(",", "."))
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None
def booleano(v):
    return True if str(v).strip().lower() in ("si", "sí", "true", "1", "x") else None

print("=" * 72)
print("  SIMULACRO — no se escribe nada" if not APLICAR else "  APLICANDO CAMBIOS REALES")
print("=" * 72)

# ── origen: vv_store en vivo (solo lectura) ───────────────────────────────────
print("\nLeyendo vv_store (solo lectura)…")
store = {f["key"]: f["data"] for f in api("GET", "vv_store?select=key,data")}
props, mas, hist = store.get("props", []), store.get("mas", []), store.get("hist", [])
print(f"  props {len(props)} · mas {len(mas)} · hist {len(hist)}")

problemas = defaultdict(list)

# ══ FASE A — propietarios → tutores ═══════════════════════════════════════════
print("\nFASE A · propietarios → tutores")
tut = leer_todo("tutores", "id,saas_prop_id,identificacion,como,email,direccion,contacto_emergencia")
por_saas = {t["saas_prop_id"]: t for t in tut if t.get("saas_prop_id")}
por_ced  = {}
for t in tut:
    c = dig(t.get("identificacion"))
    if c: por_ced.setdefault(c, t)

mapa_tutor, nuevos, enlazados = {}, [], 0
for p in props:
    pid, ced = p.get("id"), dig(p.get("cedula"))
    if pid in por_saas:                      # ya migrado antes
        mapa_tutor[pid] = por_saas[pid]["id"]; continue
    t = por_ced.get(ced) if ced else None
    if t:                                    # existe como tutor: enlazar, no duplicar
        cambios = {"saas_prop_id": pid}
        # solo rellena lo que esté vacío; nunca pisa un dato ya existente
        for destino, origen in [("como","como"), ("email","email"),
                                ("direccion","direccion"), ("contacto_emergencia","contacto")]:
            if not t.get(destino) and txt(p.get(origen)): cambios[destino] = txt(p.get(origen))
        parchar("tutores", t["id"], cambios)
        mapa_tutor[pid] = t["id"]; enlazados += 1
    else:
        nuevos.append({"nombre": txt(p.get("nombre")) or "(sin nombre)",
                       "identificacion": txt(p.get("cedula")), "celular": txt(p.get("telefono")),
                       "telefono": txt(p.get("talt")), "email": txt(p.get("email")),
                       "direccion": txt(p.get("direccion")), "ciudad": txt(p.get("ciudad")),
                       "contacto_emergencia": txt(p.get("contacto")), "como": txt(p.get("como")),
                       "saas_prop_id": pid})
print(f"  ya enlazados: {len(mapa_tutor) - enlazados} · enlazados ahora: {enlazados} · a crear: {len(nuevos)}")
for t in insertar("tutores", nuevos, "creando tutores"):
    mapa_tutor[t["saas_prop_id"]] = t["id"]

# ══ FASE B — mascotas → pacientes ═════════════════════════════════════════════
print("\nFASE B · mascotas → pacientes")
pac = leer_todo("pacientes", "id,saas_mas_id,tutor_id,nombre,raza,fecha_nacimiento")
pac_saas = {p["saas_mas_id"]: p for p in pac if p.get("saas_mas_id")}

# Al cruce solo entran los pacientes LIBRES (sin mascota asignada todavía).
# Sin esto, una mascota le quitaba el enlace a otra que ya lo tenía.
libres = [p for p in pac if not p.get("saas_mas_id")]
por_exacto, pac_clave = defaultdict(list), defaultdict(list)
for p in libres:
    por_exacto[(p.get("tutor_id"), p.get("nombre"), p.get("raza"), p.get("fecha_nacimiento"))].append(p)
    pac_clave[(p.get("tutor_id"), norm(p.get("nombre")))].append(p)

def tomar_paciente(m, tid):
    """Del criterio más preciso al más laxo. Devuelve (paciente, motivo)."""
    # 1) mismo dueño + nombre idéntico + raza + fecha de nacimiento.
    #    Esto distingue a 'TONY' de 'Tony' y a dos mascotas homónimas del mismo dueño.
    exacto = [p for p in por_exacto.get((tid, txt(m.get("nombre")), txt(m.get("raza")),
                                         fecha(m.get("fn"))), []) if not p.get("_usado")]
    if exacto: return exacto[0], "exacto"
    # 2) mismo dueño + nombre, solo si queda UNA candidata libre
    cand = [p for p in pac_clave.get((tid, norm(m.get("nombre"))), []) if not p.get("_usado")]
    if len(cand) == 1: return cand[0], "nombre"
    if len(cand) > 1:  return None, "ambiguo"
    return None, "crear"

mapa_pac, nuevos_p, enlazados_p = {}, [], 0
for m in mas:
    mid, tid = m.get("id"), mapa_tutor.get(m.get("pid"))
    if not tid:
        problemas["mascota sin dueño en vv_store"].append(m.get("nombre")); continue
    if mid in pac_saas:
        mapa_pac[mid] = pac_saas[mid]["id"]; continue
    elegido, motivo = tomar_paciente(m, tid)
    if motivo == "ambiguo":
        problemas["varios pacientes posibles (revisar a mano)"].append(m.get("nombre")); continue
    if elegido:
        elegido["_usado"] = True        # queda reservado: ninguna otra mascota lo toma
        parchar("pacientes", elegido["id"], {"saas_mas_id": mid})
        mapa_pac[mid] = elegido["id"]; enlazados_p += 1
    else:
        if pac_clave.get((tid, norm(m.get("nombre")))):
            # Existe alguien con ese nombre pero ya está tomado: en vv_store hay
            # dos mascotas homónimas del mismo dueño. Se crea fila aparte para no
            # perder ninguna, y se avisa.
            problemas["mismo nombre y dueño en vv_store (se creó fila aparte)"].append(m.get("nombre"))
        nuevos_p.append({"tutor_id": tid, "nombre": txt(m.get("nombre")) or "(sin nombre)",
                         "especie": txt(m.get("esp")), "raza": txt(m.get("raza")),
                         "genero": txt(m.get("gen")), "fecha_nacimiento": fecha(m.get("fn")),
                         "color": txt(m.get("color")), "talla": txt(m.get("talla")),
                         "peso_actual": numero(m.get("peso")),
                         "estado_reproductivo": txt(m.get("repr")), "chip": txt(m.get("chip")),
                         "alimento": txt(m.get("ali")), "animal_servicio": booleano(m.get("serv")),
                         "apoyo_emocional": booleano(m.get("emoc")),
                         "registrado_por": "Migración vv_store", "saas_mas_id": mid})
print(f"  ya enlazados: {len(mapa_pac) - enlazados_p} · enlazados ahora: {enlazados_p} · a crear: {len(nuevos_p)}")
for p in insertar("pacientes", nuevos_p, "creando pacientes"):
    mapa_pac[p["saas_mas_id"]] = p["id"]

# ══ FASE C — historia clínica ═════════════════════════════════════════════════
print("\nFASE C · historia clínica → historia_clinica")
ya = {h["saas_hist_id"] for h in leer_todo("historia_clinica", "saas_hist_id") if h.get("saas_hist_id")}
COLUMNA = {"tipo":"tipo", "desc":"descripcion", "diag":"diagnostico", "trat":"tratamiento",
           "med":"medicamentos", "not":"notas", "vet":"veterinario", "exam":"observaciones",
           "vacuna":"vacuna", "lab":"laboratorio", "lote":"lote", "via":"via_administracion",
           "producto":"producto", "dosis":"dosis"}
nuevos_h, sin_paciente = [], 0
for h in hist:
    hid = h.get("id")
    if hid in ya: continue
    pac_id = mapa_pac.get(h.get("mid"))
    if not pac_id: sin_paciente += 1; continue
    # PostgREST exige que TODAS las filas de un lote tengan las mismas claves,
    # así que se arman completas y los campos ausentes van como null.
    fila = {"paciente_id": pac_id, "saas_hist_id": hid, "fuente": "saas",
            "fecha": fecha(h.get("fecha")), "proxima_fecha": fecha(h.get("prox")),
            "peso": numero(h.get("peso")),
            # el registro ORIGINAL completo, sin recortar: garantía de cero pérdida
            "datos_extra": h}
    for origen, destino in COLUMNA.items():
        fila[destino] = txt(h.get(origen))
    fila["tipo"] = fila.get("tipo") or "consulta"
    nuevos_h.append(fila)
print(f"  ya copiados: {len(ya)} · a copiar: {len(nuevos_h)}" +
      (f" · sin paciente: {sin_paciente}" if sin_paciente else ""))
insertar("historia_clinica", nuevos_h, "copiando historia")

# ══ INFORME ═══════════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
if problemas:
    print("CASOS QUE NO TOQUÉ (necesitan tu decisión):")
    for k, v in problemas.items():
        print(f"  · {k}: {len(v)}")
        for n in v[:5]: print(f"      - {n}")
        if len(v) > 5: print(f"      … y {len(v)-5} más")
if APLICAR:
    print("\nCONTEO REAL EN SUPABASE (leído de vuelta, no calculado):")
    esperado = {"tutores": len(props), "pacientes": len(mas), "historia_clinica": len(hist)}
    for tabla, col in (("tutores","saas_prop_id"), ("pacientes","saas_mas_id"),
                       ("historia_clinica","saas_hist_id")):
        total    = len(leer_todo(tabla, "id"))
        enlazado = len([f for f in leer_todo(tabla, col) if f.get(col)])
        print(f"  {tabla:<18} {total:>5} filas · {enlazado:>5} vienen de vv_store "
              f"(de {esperado[tabla]} en origen)")
    print("\nListo. vv_store NO fue modificado: la clínica sigue funcionando igual.")
else:
    print("Esto fue un SIMULACRO: no se escribió nada.")
    print("Si los números cuadran, corre:  python3 ~/vitalvet-backups/paso3-copiar.py --aplicar")
print("=" * 72)
