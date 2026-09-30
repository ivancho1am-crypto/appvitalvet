// Módulo: Agenda — pantalla
//
// Llama a AgendaRepo (datos) y a las funciones ag* (reglas), nunca habla con
// Supabase directo. Mismo patrón de los demás módulos: render() + funciones
// sueltas colgadas de window, sin clases ni build step.

let AG_VISTA = 'lista';      // 'lista' | 'dia'
let AG_FECHA = new Date();   // fecha de referencia para la vista Día

// ── Render principal — lo llama go('agenda', ...) en nav.js ─────────────
async function rAgenda() {
  const cont = document.getElementById('ag-lista'); if (!cont) return;
  cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-s">Cargando…</div></div>';

  const { desde, hasta } = AG_VISTA === 'dia' ? agRangoDia(AG_FECHA) : agRangoSemanaAmplia();
  let citas;
  try {
    citas = await AgendaRepo.listar(desde.toISOString(), hasta.toISOString());
  } catch (e) {
    console.warn('[agenda] rAgenda:', e);
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div>
      <div class="empty-t">No se pudo cargar la agenda</div>
      <div class="empty-s">Verifica tu conexión e intenta de nuevo</div></div>`;
    return;
  }

  const fEl = document.getElementById('ag-fecha-actual');
  if (fEl) fEl.textContent = AG_VISTA === 'dia'
    ? AG_FECHA.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Próximos 14 días';

  if (!citas.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">📅</div>
      <div class="empty-t">Sin citas ${AG_VISTA === 'dia' ? 'este día' : 'en este rango'}</div>
      <div class="empty-s">Usa "+ Nueva cita" para agendar la primera</div></div>`;
    return;
  }

  const grupos = agAgruparPorDia(citas);
  cont.innerHTML = Object.keys(grupos).sort().map(clave => `
    <div class="ag-day-group">
      <div class="ag-day-hdr">${agTituloDia(clave)}</div>
      ${grupos[clave].map(c => _renderCitaCard(c)).join('')}
    </div>`).join('');

  _actualizarBadge();
}

function agRangoSemanaAmplia() {
  const desde = new Date(); desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 14); hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

function _renderCitaCard(c) {
  const info = agEstadoInfo(c.estado);
  const hora = new Date(c.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const puedeHistoria = c.estado === 'atendida' && c.paciente_id;
  return `<div class="ag-card">
    <div class="ag-card-hora">${hora}<span class="ag-card-dur">${c.duracion_min || 30}′</span></div>
    <div class="ag-card-body">
      <div class="ag-card-top">
        <span class="ag-card-mascota">${EI(c.mascota_especie)} ${c.mascota_nombre || 'Sin nombre'}</span>
        <span class="badge ${info.badge}">${info.label}</span>
      </div>
      <div class="ag-card-sub">${c.servicio || ''} ${c.tutor_name ? '· ' + c.tutor_name : ''}${c.phone ? ' · ' + c.phone : ''}</div>
      ${c.notas ? `<div class="ag-card-notas">${c.notas}</div>` : ''}
    </div>
    <div class="ag-card-acciones">
      ${info.siguiente.map(sig => `<button class="btn btn-outline btn-xs" onclick="agCambiarEstado('${c.id}','${sig}')">${agEstadoInfo(sig).label}</button>`).join('')}
      ${puedeHistoria ? `<button class="btn btn-green btn-xs" onclick="agIrAHistoria('${c.paciente_id}')">📋 Historia</button>` : ''}
    </div>
  </div>`;
}

// ── Navegación de vista ───────────────────────────────────────────────────
function agVerLista(btn) { AG_VISTA = 'lista'; _marcarBotonVista(btn); rAgenda(); }
function agVerDia(btn) { AG_VISTA = 'dia'; _marcarBotonVista(btn); rAgenda(); }
function _marcarBotonVista(btn) {
  document.querySelectorAll('#page-agenda .ftab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
}
function agDiaAnterior() { AG_FECHA.setDate(AG_FECHA.getDate() - 1); rAgenda(); }
function agDiaSiguiente() { AG_FECHA.setDate(AG_FECHA.getDate() + 1); rAgenda(); }
function agHoy() { AG_FECHA = new Date(); rAgenda(); }

// ── Cambiar estado ────────────────────────────────────────────────────────
async function agCambiarEstado(id, nuevoEstado) {
  try {
    await AgendaRepo.actualizar(id, { estado: nuevoEstado });
    toast('Cita actualizada ✓', 'ok');
    rAgenda();
  } catch (e) { toast('No se pudo actualizar la cita', 'err'); console.warn(e); }
}

// ── Ir a Historia Clínica desde una cita atendida ──────────────────────────
// Mismo patrón que abrirHist() en propietarios.js: cambia de pestaña y luego
// abre la historia de esa mascota. Resuelve el id LOCAL vía Supabase
// (AgendaRepo.idLocalDeMascota) en vez de buscar por nombre: ya hay mascotas
// homónimas en los datos reales y emparejar por texto abriría la historia
// de la mascota equivocada.
async function agIrAHistoria(pacienteIdSupabase) {
  let midLocal;
  try { midLocal = await AgendaRepo.idLocalDeMascota(pacienteIdSupabase); }
  catch (e) { toast('No se pudo abrir la historia clínica', 'err'); console.warn(e); return; }
  if (!midLocal || !DB.get('mas').some(m => m.id === midLocal)) {
    toast('No encontré esta mascota en el panel local', 'err'); return;
  }
  go('historia', document.querySelector(".sidebar-item[onclick*=\"go('historia'\"]"));
  setTimeout(() => { openHist(midLocal); setTimeout(() => openHistModal(), 150); }, 200);
}

// ── Badge del sidebar: citas de HOY (no canceladas/no-asistió) ────────────
async function _actualizarBadge() {
  const el = document.getElementById('ag-n'); if (!el) return;
  try { el.textContent = await AgendaRepo.contarHoy(); }
  catch (e) { console.warn('[agenda] _actualizarBadge:', e); }
}

// ── Modal "Nueva cita" ─────────────────────────────────────────────────────
function agAbrirNuevaCita() {
  openM('m-cita');
  const hoy = new Date();
  document.getElementById('ag-fecha').value =
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}T${String(hoy.getHours()).padStart(2, '0')}:00`;
  document.getElementById('ag-info-mascota').innerHTML = '';
}

// Al elegir la mascota: mostrar última consulta/procedimiento, como pidió
// el diseño original ("reduce muchísimo el trabajo del veterinario"). Todo
// derivado de DB.get('hist'), sin ninguna consulta nueva.
function agMascotaSeleccionada() {
  const mid = document.getElementById('ag-mas').value;
  const el = document.getElementById('ag-info-mascota');
  if (!el) return;
  if (!mid) { el.innerHTML = ''; return; }
  const m = DB.get('mas').find(x => x.id === mid);
  if (!m) { el.innerHTML = ''; return; }
  const hist = DB.get('hist').filter(h => h.mid === mid).sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
  const ultima = hist[0];
  const ultimoProc = hist.find(h => h.tipo === 'cirugia' || h.tipo === 'formula');
  el.innerHTML = `<div class="ag-mascota-info">
    <strong>${EI(m.esp)} ${m.nombre}</strong> · ${m.esp}${m.raza ? ' · ' + m.raza : ''} · ${edad(m.fn)}
    ${ultima ? `<div class="ag-mascota-info-row">Última consulta: <strong>${ultima.fecha}</strong> (${HLBL[ultima.tipo] || ultima.tipo})</div>` : '<div class="ag-mascota-info-row">Sin historia clínica todavía</div>'}
    ${ultimoProc ? `<div class="ag-mascota-info-row">Último procedimiento: <strong>${ultimoProc.desc || HLBL[ultimoProc.tipo]}</strong></div>` : ''}
  </div>`;
}

async function agGuardarCita() {
  const mascotaId = document.getElementById('ag-mas').value;
  const servicio = document.getElementById('ag-servicio').value;
  const fechaHora = document.getElementById('ag-fecha').value;
  const duracion = document.getElementById('ag-duracion').value;
  const motivo = document.getElementById('ag-motivo').value;

  // Valida lo obligatorio antes de consultar Supabase (resolverEnlace):
  // así un campo vacío no gasta una petición de red de entrada.
  if (!mascotaId) { toast('Selecciona una mascota', 'err'); return; }
  if (!fechaHora) { toast('Selecciona fecha y hora', 'err'); return; }
  if (!servicio) { toast('Selecciona un servicio', 'err'); return; }

  const btn = document.getElementById('ag-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const { pacienteId, tutorId } = await AgendaRepo.resolverEnlace(mascotaId);
    const { error, fila } = agConstruirFila({ mascotaId, servicio, fechaHora, duracion, motivo, pacienteId, tutorId });

    if (error) { toast(error, 'err'); return; }

    await AgendaRepo.crear(fila);
    toast('Cita agendada ✓', 'ok');
    closeM('m-cita');
    ['ag-mas', 'ag-servicio', 'ag-motivo'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    document.getElementById('ag-info-mascota').innerHTML = '';
    rAgenda();
  } catch (e) {
    toast('No se pudo guardar la cita', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cita'; }
  }
}
