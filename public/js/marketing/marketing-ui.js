// Módulo: Marketing — pantalla
//
// Llama a las funciones mkt* (reglas), nunca habla con Supabase — Marketing
// v1 es 100% datos locales ya cargados (DB.get), igual que Estadísticas.
// Cambiar un filtro NO dispara ninguna petición de red: todo se recalcula
// en memoria sobre MKT_PACIENTES (ver rMarketing()).

let MKT_PACIENTES = [];   // todos los pacientes (mascota+tutor), construido una vez al entrar
let MKT_FILTRADOS = [];   // resultado del filtro actual, para no recalcular 2 veces
let MKT_FILTROS = { especie: 'todos', raza: 'todos', grupoEtario: 'todos', reproduccion: 'todos', sexo: 'todos', ciudad: 'todos' };

// v1.1 — campaña recién guardada (si la hay) y su mapa mascotaId→delivery,
// para poder registrar manual_opened_at al pulsar WhatsApp. Cambiar de
// filtros después de guardar NO borra esto — el mapa sigue siendo válido
// para los pacientes que sí quedaron en esa campaña.
let MKT_DELIVERY_POR_MASCOTA = {};

// ── Render principal — lo llama go('marketing', ...) en nav.js ────────────
function rMarketing() {
  MKT_PACIENTES = mktConstruirPacientes(DB.get('props'), DB.get('mas'));
  _mktPoblarSelectsDinamicos();
  _mktAplicarFiltrosYRenderizar();
  _mktRenderHistorial();
}

function _mktPoblarSelectsDinamicos() {
  const selRaza = document.getElementById('mkt-f-raza');
  const vRaza = selRaza.value;
  selRaza.innerHTML = '<option value="todos">Todas</option>' +
    mktListaRazas(MKT_PACIENTES).map(r => `<option value="${r}">${r}</option>`).join('');
  if ([...selRaza.options].some(o => o.value === vRaza)) selRaza.value = vRaza;

  const selCiudad = document.getElementById('mkt-f-ciudad');
  const vCiudad = selCiudad.value;
  selCiudad.innerHTML = '<option value="todos">Todas</option>' +
    mktListaCiudades(MKT_PACIENTES).map(c => `<option value="${c}">${c}</option>`).join('');
  if ([...selCiudad.options].some(o => o.value === vCiudad)) selCiudad.value = vCiudad;
}

// Cada <select> de filtro llama esto en su onchange, con su propia clave.
function mktCambiarFiltro(campo, valor) {
  MKT_FILTROS[campo] = valor;
  _mktAplicarFiltrosYRenderizar();
}

function mktLimpiarFiltros() {
  MKT_FILTROS = { especie: 'todos', raza: 'todos', grupoEtario: 'todos', reproduccion: 'todos', sexo: 'todos', ciudad: 'todos' };
  ['mkt-f-especie', 'mkt-f-raza', 'mkt-f-grupo', 'mkt-f-repro', 'mkt-f-sexo', 'mkt-f-ciudad'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = 'todos';
  });
  _mktAplicarFiltrosYRenderizar();
}

function _mktAplicarFiltrosYRenderizar() {
  MKT_FILTRADOS = mktFiltrarPacientes(MKT_PACIENTES, MKT_FILTROS);
  _mktRenderContadores();
  _mktRenderTabla();
}

function _mktRenderContadores() {
  const conTel = MKT_FILTRADOS.filter(p => p.telefono).length;
  const elN = document.getElementById('mkt-contador-total');
  const elTel = document.getElementById('mkt-contador-telefono');
  if (elN) elN.textContent = `${MKT_FILTRADOS.length} paciente${MKT_FILTRADOS.length === 1 ? '' : 's'} seleccionado${MKT_FILTRADOS.length === 1 ? '' : 's'}`;
  if (elTel) elTel.textContent = `${conTel} con teléfono`;
}

function _mktRenderTabla() {
  const cont = document.getElementById('mkt-tabla'); if (!cont) return;
  if (!MKT_FILTRADOS.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">📣</div>
      <div class="empty-t">Sin pacientes con estos filtros</div>
      <div class="empty-s">Probá "↺ Limpiar filtros" para ver todos</div></div>`;
    return;
  }
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Mascota</th><th>Raza</th><th>Edad</th><th>Reproducción</th><th>Tutor</th><th>Teléfono</th><th>Acción</th></tr></thead>
    <tbody>${MKT_FILTRADOS.map(p => `
      <tr>
        <td>${EI(p.especie)} ${p.mascotaNombre}</td>
        <td>${p.raza || '—'}</td>
        <td>${edad(p.fn)}</td>
        <td style="font-size:11px;text-transform:capitalize">${(p.repr || '').replace('_', ' ') || '—'}</td>
        <td>${p.tutorNombre}</td>
        <td>${p.telefono || '—'}</td>
        <td>${p.telefono
          ? `<button class="btn btn-green btn-xs" onclick="mktAbrirWhatsapp('${p.mascotaId}')">💬 WhatsApp</button>`
          : '<span style="font-size:11px;color:var(--g500)">Sin teléfono</span>'}</td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

// Arma el mensaje de ESTE paciente puntual (plantilla ya con sus variables
// resueltas) y abre WhatsApp Web/app con el texto precargado — el navegador
// abre la conversación, la persona decide si lo envía. VitalVet no manda
// nada directo, a propósito (ver el diseño del módulo).
function mktAbrirWhatsapp(mascotaId) {
  const p = MKT_FILTRADOS.find(x => x.mascotaId === mascotaId);
  if (!p) { toast('Paciente no encontrado en la selección actual', 'err'); return; }
  if (!p.telefono) { toast('Este tutor no tiene teléfono registrado', 'err'); return; }
  const plantilla = document.getElementById('mkt-mensaje').value;
  if (!plantilla.trim()) { toast('Escribí un mensaje antes de enviar', 'err'); return; }
  const mensaje = mktAplicarPlantilla(plantilla, p);
  window.open(mktLinkWhatsapp(p.telefono, mensaje), '_blank');

  // v1.1: si este paciente quedó en la última campaña guardada, registra
  // la apertura — best-effort, nunca bloquea ni revierte el wa.me de arriba.
  const delivery = MKT_DELIVERY_POR_MASCOTA[mascotaId];
  if (delivery) MktRepo.registrarAperturaManual(delivery.id).then(() => _mktRenderHistorial());
}

// ── v1.1: Guardar campaña — crea marketing_campaigns + un delivery por
// paciente CON teléfono de la selección actual. No se puede deshacer desde
// acá (si te equivocás de filtro, queda guardada igual: es historial, no
// un borrador) — por eso se pide confirmación antes.
async function mktGuardarCampaña() {
  const mensaje = (document.getElementById('mkt-mensaje').value || '').trim();
  if (!mensaje) { toast('Escribí un mensaje antes de guardar la campaña', 'err'); return; }
  const conTelefono = MKT_FILTRADOS.filter(p => p.telefono);
  if (!conTelefono.length) { toast('No hay pacientes con teléfono en esta selección', 'err'); return; }

  const nombre = prompt('Nombre de la campaña (para identificarla en el Historial):', `Campaña ${new Date().toLocaleDateString('es-CO')}`);
  if (nombre === null) return; // canceló

  const btn = document.getElementById('mkt-btn-guardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  try {
    const campaña = await MktRepo.crearCampaña({
      nombre: nombre.trim() || `Campaña ${new Date().toLocaleDateString('es-CO')}`,
      filtros: MKT_FILTROS,
      mensaje,
      totalDestinatarios: conTelefono.length,
    });
    const filas = mktConstruirFilasDelivery(conTelefono, mensaje);
    const deliveries = await MktRepo.crearDeliveries(campaña.id, filas);

    MKT_DELIVERY_POR_MASCOTA = {};
    deliveries.forEach(d => { MKT_DELIVERY_POR_MASCOTA[d.mascota_id] = d });

    toast(`Campaña guardada: ${deliveries.length} contacto${deliveries.length === 1 ? '' : 's'} listos para WhatsApp`, 'ok');
    _mktRenderHistorial();
  } catch (e) {
    console.error('[marketing] mktGuardarCampaña:', e);
    toast(e.message || 'No se pudo guardar la campaña', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar campaña y generar lista'; }
  }
}

// ── v1.1: Historial — campañas guardadas desde este dashboard ────────────
async function _mktRenderHistorial() {
  const cont = document.getElementById('mkt-historial'); if (!cont) return;
  cont.innerHTML = '<p style="color:var(--g500);font-size:12px">Cargando historial…</p>';
  const campañas = await MktRepo.listarCampañas();
  if (!campañas.length) {
    cont.innerHTML = '<p style="color:var(--g500);font-size:12px">Todavía no guardaste ninguna campaña.</p>';
    return;
  }
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Campaña</th><th>Fecha</th><th>Destinatarios</th><th>Mensaje</th><th>Acción</th></tr></thead>
    <tbody>${campañas.map(c => `
      <tr>
        <td>${c.nombre || '—'}</td>
        <td>${c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleString('es-CO') : '—'}</td>
        <td>${(c.metricas && c.metricas.total_destinatarios) || 0}</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--g500)">${(c.message_template || '').replace(/\n/g, ' ')}</td>
        <td><button class="btn btn-outline btn-xs" onclick="mktVerDetalleCampaña('${c.id}')">Ver detalle</button></td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

// Detalle de una campaña: a quién se le generó delivery y si ya se abrió
// WhatsApp (manual_opened_at) o sigue pendiente.
async function mktVerDetalleCampaña(campaignId) {
  openM('m-mkt-historial');
  const cont = document.getElementById('mkt-historial-detalle');
  cont.innerHTML = '<p style="color:var(--g500);font-size:12px">Cargando…</p>';
  const deliveries = await MktRepo.listarDeliveries(campaignId);
  if (!deliveries.length) {
    cont.innerHTML = '<p style="color:var(--g500);font-size:12px">Sin contactos registrados.</p>';
    return;
  }
  const abiertos = deliveries.filter(d => d.manual_opened_at).length;
  cont.innerHTML = `
    <p style="font-size:12px;margin-bottom:10px"><strong>${abiertos}</strong> de <strong>${deliveries.length}</strong> abiertos en WhatsApp</p>
    <div class="tw"><table>
      <thead><tr><th>Tutor</th><th>Teléfono</th><th>Estado</th><th>Abierto</th></tr></thead>
      <tbody>${deliveries.map(d => `
        <tr>
          <td>${d.tutor_name || '—'}</td>
          <td>${d.phone || '—'}</td>
          <td style="font-size:11px">${d.manual_opened_at ? '✅ Abierto' : '⏳ Pendiente'}</td>
          <td style="font-size:11px">${d.manual_opened_at ? new Date(d.manual_opened_at).toLocaleString('es-CO') : '—'}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}
