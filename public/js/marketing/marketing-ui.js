// Módulo: Marketing — pantalla
//
// Llama a las funciones mkt* (reglas), nunca habla con Supabase — Marketing
// v1 es 100% datos locales ya cargados (DB.get), igual que Estadísticas.
// Cambiar un filtro NO dispara ninguna petición de red: todo se recalcula
// en memoria sobre MKT_PACIENTES (ver rMarketing()).

let MKT_PACIENTES = [];   // todos los pacientes (mascota+tutor), construido una vez al entrar
let MKT_FILTRADOS = [];   // resultado del filtro actual, para no recalcular 2 veces
let MKT_FILTROS = { especie: 'todos', raza: 'todos', grupoEtario: 'todos', reproduccion: 'todos', sexo: 'todos', ciudad: 'todos' };

// ── Render principal — lo llama go('marketing', ...) en nav.js ────────────
function rMarketing() {
  MKT_PACIENTES = mktConstruirPacientes(DB.get('props'), DB.get('mas'));
  _mktPoblarSelectsDinamicos();
  _mktAplicarFiltrosYRenderizar();
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
}
