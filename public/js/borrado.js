// Módulo: Borrado con papelera
//
// Hasta ahora la app no permitía dar de baja propietarios ni mascotas: una vez
// registrados, ahí quedaban. Esto lo permite, pero sin que nada desaparezca de
// verdad al primer clic.
//
// Cómo funciona:
//  1. Se avisa exactamente QUÉ se va a borrar (cuántas mascotas, cuántos
//     registros clínicos), porque borrar un propietario arrastra a sus
//     mascotas y a toda su historia.
//  2. Hay que confirmar.
//  3. Lo borrado NO se destruye: se mueve a la papelera (`vv_store.papelera`),
//     con fecha y con todo su contenido. Desde ahí se puede restaurar.
//  4. Se ofrece deshacer de inmediato, y además queda en la papelera por si
//     alguien se da cuenta al día siguiente.
//
// El espejo relacional acompaña: al borrar se borra también en las tablas, y
// al restaurar se vuelven a crear.

const PAPELERA_DIAS = 90;   // cuánto se conserva antes de poder purgar

function _resumenBorrado(props, mas, hist) {
  const partes = [];
  if (props.length) partes.push(props.length + (props.length === 1 ? ' propietario' : ' propietarios'));
  if (mas.length)   partes.push(mas.length   + (mas.length === 1 ? ' mascota' : ' mascotas'));
  if (hist.length)  partes.push(hist.length  + (hist.length === 1 ? ' registro clínico' : ' registros clínicos'));
  return partes.join(', ');
}

// Guarda en la papelera y quita de las colecciones vivas. Devuelve el lote.
async function _moverAPapelera(props, mas, hist, motivo) {
  const lote = {
    id: 'del' + Date.now(),
    fecha: new Date().toISOString(),
    motivo,
    resumen: _resumenBorrado(props, mas, hist),
    props, mas, hist
  };

  const papelera = DB.get('papelera');
  papelera.push(lote);
  await DB.set('papelera', papelera);

  // Recién cuando la papelera está guardada se quita de las colecciones vivas,
  // para que un fallo a mitad de camino nunca deje datos sin respaldo.
  const idsP = new Set(props.map(x => x.id));
  const idsM = new Set(mas.map(x => x.id));
  const idsH = new Set(hist.map(x => x.id));
  if (idsH.size) await DB.set('hist',  DB.get('hist').filter(x => !idsH.has(x.id)));
  if (idsM.size) await DB.set('mas',   DB.get('mas').filter(x => !idsM.has(x.id)));
  if (idsP.size) await DB.set('props', DB.get('props').filter(x => !idsP.has(x.id)));

  // Espejo: borrar también en las tablas relacionales
  for (const h of hist) await espejoBorrarHist(h.id);
  for (const m of mas)  await espejoBorrarMas(m.id);
  for (const p of props) await espejoBorrarProp(p.id);

  return lote;
}

function _ofrecerDeshacer(lote) {
  const el = document.getElementById('undo-bar');
  if (!el) { toast('Eliminado: ' + lote.resumen, 'ok'); return; }
  el.innerHTML = `<span>🗑️ Eliminado: <strong>${lote.resumen}</strong></span>
    <button class="btn btn-outline btn-xs" onclick="deshacerBorrado('${lote.id}')">Deshacer</button>`;
  el.style.display = 'flex';
  clearTimeout(window._undoTimer);
  window._undoTimer = setTimeout(() => { el.style.display = 'none'; }, 15000);
}

// ── Borrar una mascota (y su historia) ────────────────────────────────────
async function borrarMas(id) {
  const m = DB.get('mas').find(x => x.id === id);
  if (!m) return;
  const hist = DB.get('hist').filter(h => h.mid === id);

  const aviso = `¿Eliminar a ${m.nombre}?\n\n` +
    `Se eliminará también su historia clínica: ${hist.length} registro(s).\n\n` +
    `Queda en la papelera ${PAPELERA_DIAS} días y se puede restaurar.`;
  if (!confirm(aviso)) return;

  const lote = await _moverAPapelera([], [m], hist, 'mascota ' + m.nombre);
  updSelects(); rMas(); rProp(); rHistList(); rStats();
  _ofrecerDeshacer(lote);
}

// ── Borrar un propietario (y sus mascotas, y la historia de estas) ────────
async function borrarProp(id) {
  const p = DB.get('props').find(x => x.id === id);
  if (!p) return;
  const mas = DB.get('mas').filter(m => m.pid === id);
  const idsM = new Set(mas.map(m => m.id));
  const hist = DB.get('hist').filter(h => idsM.has(h.mid));

  const detalle = mas.length
    ? `\nArrastra a sus ${mas.length} mascota(s): ${mas.map(m => m.nombre).join(', ')}\n` +
      `y ${hist.length} registro(s) clínico(s).\n`
    : '\nNo tiene mascotas registradas.\n';
  const aviso = `¿Eliminar a ${p.nombre}?\n${detalle}\n` +
    `Queda en la papelera ${PAPELERA_DIAS} días y se puede restaurar.`;
  if (!confirm(aviso)) return;

  const lote = await _moverAPapelera([p], mas, hist, 'propietario ' + p.nombre);
  updSelects(); rProp(); rMas(); rHistList(); rStats();
  _ofrecerDeshacer(lote);
}

// ── Restaurar ─────────────────────────────────────────────────────────────
async function deshacerBorrado(loteId) {
  const papelera = DB.get('papelera');
  const i = papelera.findIndex(l => l.id === loteId);
  if (i < 0) { toast('Ese borrado ya no está en la papelera', 'err'); return }
  const lote = papelera[i];

  // Se devuelven a su colección, evitando duplicar si ya volvieron por otra vía
  const meter = async (clave, filas) => {
    if (!filas.length) return;
    const vivos = DB.get(clave);
    const ids = new Set(vivos.map(x => x.id));
    await DB.set(clave, vivos.concat(filas.filter(f => !ids.has(f.id))));
  };
  await meter('props', lote.props);
  await meter('mas',   lote.mas);
  await meter('hist',  lote.hist);

  // Espejo: volver a crearlos en las tablas relacionales
  for (const p of lote.props) await espejoProp(p);
  for (const m of lote.mas)   await espejoMas(m);
  for (const h of lote.hist)  await espejoHist(h);

  papelera.splice(i, 1);
  await DB.set('papelera', papelera);

  const bar = document.getElementById('undo-bar'); if (bar) bar.style.display = 'none';
  updSelects(); rProp(); rMas(); rHistList(); rStats();
  toast('Restaurado: ' + lote.resumen, 'ok');
}

// ── Ver la papelera ───────────────────────────────────────────────────────
function verPapelera() {
  const papelera = DB.get('papelera').slice().reverse();
  const cuerpo = document.getElementById('papelera-body');
  if (!cuerpo) return;
  cuerpo.innerHTML = papelera.length
    ? papelera.map(l => {
        const f = new Date(l.fecha);
        const dias = Math.floor((Date.now() - f.getTime()) / 86400000);
        return `<tr>
          <td><span class="cs">${f.toLocaleDateString('es-CO')} ${f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></td>
          <td>${l.motivo}</td>
          <td>${l.resumen}</td>
          <td><span class="badge ${dias >= PAPELERA_DIAS ? 'bg-gray' : 'bg-teal'}">hace ${dias} día(s)</span></td>
          <td><button class="btn btn-green btn-xs" onclick="deshacerBorrado('${l.id}')">↩️ Restaurar</button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--g500);padding:18px">La papelera está vacía</td></tr>';
  openM('m-papelera');
}
