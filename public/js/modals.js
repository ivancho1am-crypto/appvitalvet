// Módulo: Modales y selects compartidos
function openM(id) { document.getElementById(id).classList.add('open'); updSelects() }
function closeM(id) { document.getElementById(id).classList.remove('open') }

document.querySelectorAll('.mo').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open') }));

function updSelects() {
  const props = DB.get('props'), mas = DB.get('mas');
  ['m-prop-sel'].forEach(id => { const sel = document.getElementById(id); if (!sel) return;
    sel.innerHTML = '<option value="">Selecciona propietario</option>' + props.map(p => `<option value="${p.id}">${p.nombre} (${p.cedula})</option>`).join('') });
  // ag-mas (Agenda) salió de acá el 2026-10-06: ya no es un <select>, es un
  // buscador que se maneja solo en agenda-ui.js (agBuscarMascota).
  ['sg-mas'].forEach(id => { const sel = document.getElementById(id); if (!sel) return;
    sel.innerHTML = '<option value="">Selecciona mascota</option>' + mas.map(m => { const p = props.find(x => x.id === m.pid); return `<option value="${m.id}">${EI(m.esp)} ${m.nombre} — ${p ? p.nombre : ''}</option>` }).join('') });
}
