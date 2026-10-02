// Módulo: Verificación y reparación del espejo relacional
//
// `espejo.js` replica cada guardado a las tablas relacionales, pero por diseño
// NUNCA interrumpe el guardado: si el espejo falla (red caída, sesión vencida,
// un rato sin conexión), el dato queda a salvo en vv_store y el espejo se
// intenta de nuevo recién al siguiente guardado DE ESE MISMO registro. Si
// nadie vuelve a tocar ese registro, el hueco se queda ahí en silencio.
//
// Eso ya pasó: 8 vacunaciones del 2026-09-25 (entre 16:33 y 17:23, el día que
// se desplegó el espejo) quedaron en vv_store y nunca llegaron a
// historia_clinica. Nada posterior a esa hora quedó sin espejar.
//
// Este módulo cierra ese agujero: compara lo que hay en vv_store contra lo que
// hay en las tablas, y lo que falte lo vuelve a espejar REUSANDO las funciones
// de espejo.js tal cual (no se reimplementa ningún mapeo de campos, para que
// una fila reparada hoy sea idéntica a una espejada en su momento).
//
// Reglas de diseño (iguales a espejo.js):
//  · Solo lee ids de enlace, nunca datos clínicos, para comparar.
//  · La reparación es idempotente: reparar dos veces no duplica nada (el
//    enlace vive en saas_*_id y _guardar() de espejo.js hace insert-o-update).
//  · La verificación automática al entrar corre DESPRENDIDA del arranque: no
//    puede retrasar ni bloquear el login, pase lo que pase.
//  · La reparación NUNCA es automática: muestra qué falta y Iván decide.

// PostgREST devuelve máximo 1000 filas por consulta, sin avisar que cortó.
// Con 1.600+ historias eso daría un falso "faltan 600" — hay que paginar.
const ESPEJO_PAGINA = 1000;

const ESPEJO_GRUPOS = [
  { clave: 'props', etiqueta: 'Propietarios',     tabla: 'tutores',          col: 'saas_prop_id', reparar: p => espejoProp(p) },
  { clave: 'mas',   etiqueta: 'Mascotas',         tabla: 'pacientes',        col: 'saas_mas_id',  reparar: m => espejoMas(m) },
  { clave: 'hist',  etiqueta: 'Historia clínica', tabla: 'historia_clinica', col: 'saas_hist_id', reparar: h => espejoHist(h) },
];

// Trae TODOS los ids de enlace de una tabla, paginando hasta que se acaben.
async function _espejoIdsEnlace(sb, tabla, col) {
  const ids = new Set();
  for (let desde = 0; ; desde += ESPEJO_PAGINA) {
    const { data, error } = await sb.from(tabla).select(col)
      .order(col, { ascending: true }).range(desde, desde + ESPEJO_PAGINA - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    data.forEach(r => { if (r[col]) ids.add(r[col]) });
    if (data.length < ESPEJO_PAGINA) break;
  }
  return ids;
}

// Devuelve un reporte por colección: cuántos hay, cuántos están espejados y
// qué registros concretos faltan. No escribe nada.
async function espejoVerificar() {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb) return null;

  const reporte = [];
  for (const g of ESPEJO_GRUPOS) {
    const locales = DB.get(g.clave).filter(x => x && x.id);
    try {
      const enTabla = await _espejoIdsEnlace(sb, g.tabla, g.col);
      const faltantes = locales.filter(x => !enTabla.has(x.id));
      reporte.push({ grupo: g, total: locales.length, faltantes, error: null });
    } catch (e) {
      reporte.push({ grupo: g, total: locales.length, faltantes: [], error: e.message || String(e) });
    }
  }
  return reporte;
}

// Reintenta el espejo de todo lo que falte, en orden: primero propietarios,
// después mascotas, al final historia clínica — así los padres existen antes
// que los hijos y no se hace trabajo repetido (espejo.js los crearía igual,
// pero de a uno y preguntando a la base cada vez).
async function espejoReparar(reporte) {
  const resultado = { ok: 0, fallidos: [] };
  for (const fila of reporte || []) {
    for (const registro of fila.faltantes) {
      try {
        const id = await fila.grupo.reparar(registro);
        if (id) resultado.ok++;
        else resultado.fallidos.push({ etiqueta: fila.grupo.etiqueta, id: registro.id, razon: 'el espejo devolvió vacío' });
      } catch (e) {
        resultado.fallidos.push({ etiqueta: fila.grupo.etiqueta, id: registro.id, razon: e.message || String(e) });
      }
    }
  }
  return resultado;
}

// ── Pantalla (tarjeta en Inicio) ──────────────────────────────────────────

let ESPEJO_ULTIMO_REPORTE = null;

function _espejoPintar(html) {
  const el = document.getElementById('espejo-estado');
  if (el) el.innerHTML = html;
}

function _espejoResumenHTML(reporte) {
  const conError = reporte.filter(f => f.error);
  const faltan = reporte.reduce((n, f) => n + f.faltantes.length, 0);

  const lineas = reporte.map(f => {
    if (f.error) return `<div style="font-size:12px;color:var(--danger,#d33)">⚠️ ${f.grupo.etiqueta}: no se pudo verificar — ${f.error}</div>`;
    const espejados = f.total - f.faltantes.length;
    const icono = f.faltantes.length ? '⚠️' : '✅';
    return `<div style="font-size:12px">${icono} ${f.grupo.etiqueta}: <strong>${espejados}</strong> de <strong>${f.total}</strong> en la tabla relacional` +
           (f.faltantes.length ? ` · <span style="color:var(--danger,#d33)">faltan ${f.faltantes.length}</span>` : '') + `</div>`;
  }).join('');

  let pie;
  if (conError.length) {
    pie = `<p style="font-size:11px;color:var(--g500);margin-top:8px">Revisá la conexión y volvé a verificar.</p>`;
  } else if (faltan) {
    pie = `<button class="btn btn-green btn-sm" style="margin-top:10px" id="espejo-btn-reparar" onclick="espejoRepararDesdeUI()">🔧 Reparar ${faltan} registro${faltan === 1 ? '' : 's'}</button>
           <p style="font-size:11px;color:var(--g500);margin-top:6px">Vuelve a enviar a las tablas relacionales lo que quedó solo en el JSON. No borra ni modifica nada existente.</p>`;
  } else {
    pie = `<p style="font-size:11px;color:var(--g500);margin-top:8px">Todo lo guardado en el panel está también en las tablas relacionales (las que usa el portal de tutores y los reportes en SQL).</p>`;
  }
  return lineas + pie;
}

async function espejoVerificarDesdeUI() {
  const btn = document.getElementById('espejo-btn-verificar');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }
  _espejoPintar('<p style="font-size:12px;color:var(--g500)">Comparando vv_store con las tablas relacionales…</p>');
  try {
    const reporte = await espejoVerificar();
    if (!reporte) { _espejoPintar('<p style="font-size:12px;color:var(--g500)">Sin conexión a Supabase — no hay nada que verificar.</p>'); return; }
    ESPEJO_ULTIMO_REPORTE = reporte;
    _espejoPintar(_espejoResumenHTML(reporte));
  } catch (e) {
    console.error('[espejo] verificar:', e);
    _espejoPintar(`<p style="font-size:12px;color:var(--danger,#d33)">No se pudo verificar: ${e.message || e}</p>`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Verificar ahora'; }
  }
}

async function espejoRepararDesdeUI() {
  if (!ESPEJO_ULTIMO_REPORTE) { toast('Primero verificá, para saber qué falta', 'err'); return; }
  const faltan = ESPEJO_ULTIMO_REPORTE.reduce((n, f) => n + f.faltantes.length, 0);
  if (!faltan) { toast('No hay nada que reparar', 'ok'); return; }
  if (!confirm(`¿Reparar ${faltan} registro(s)?\n\nSe vuelven a enviar a las tablas relacionales los registros que quedaron solo en el JSON.\nNo se borra ni se modifica nada de lo que ya está.`)) return;

  const btn = document.getElementById('espejo-btn-reparar');
  if (btn) { btn.disabled = true; btn.textContent = 'Reparando…'; }
  try {
    const r = await espejoReparar(ESPEJO_ULTIMO_REPORTE);
    if (r.fallidos.length) {
      console.warn('[espejo] reparación — no se pudieron espejar:', r.fallidos);
      toast(`Reparados ${r.ok}; ${r.fallidos.length} no se pudieron (ver consola)`, 'info');
    } else {
      toast(`Reparados ${r.ok} registro${r.ok === 1 ? '' : 's'} ✓`, 'ok');
    }
    await espejoVerificarDesdeUI();   // vuelve a medir, para confirmar en pantalla
  } catch (e) {
    console.error('[espejo] reparar:', e);
    toast('No se pudo completar la reparación — revisá la consola', 'err');
    if (btn) { btn.disabled = false; btn.textContent = '🔧 Reparar'; }
  }
}

// Chequeo silencioso al entrar. Se llama DESPRENDIDO de boot() (ver app.js /
// auth.js NO se tocan: lo dispara dashboard.js al pintar Inicio, una sola vez
// por sesión) y solo avisa si encuentra algo: nunca repara solo.
let _espejoYaChequeado = false;
function espejoChequeoSilencioso() {
  if (_espejoYaChequeado) return;
  _espejoYaChequeado = true;
  setTimeout(async () => {
    try {
      const reporte = await espejoVerificar();
      if (!reporte) return;
      ESPEJO_ULTIMO_REPORTE = reporte;
      const faltan = reporte.reduce((n, f) => n + f.faltantes.length, 0);
      if (document.getElementById('espejo-estado')) _espejoPintar(_espejoResumenHTML(reporte));
      if (faltan && typeof toast === 'function') {
        toast(`${faltan} registro(s) todavía no llegaron a las tablas relacionales — mirá "Espejo relacional" en Inicio`, 'info');
      }
    } catch (e) { console.warn('[espejo] chequeo silencioso:', e.message || e); }
  }, 4000);   // después de que el panel ya pintó, nunca antes
}
