// Módulo: Propietarios
const CRM_URL = 'https://vitabot-vitalvet-production.up.railway.app';

function syncPropToCRM(prop) {
  const mascotas = DB.get('mas').filter(m => m.pid === prop.id);
  fetch(CRM_URL + '/api/crm/sync-patient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propietario: prop, mascotas })
  }).catch(() => {}); // fire-and-forget: nunca bloquea la app
}
function saveProp() {
  const ced = document.getElementById('p-ced').value.trim(), nom = document.getElementById('p-nom').value.trim();
  if (!ced || !nom) { toast('Cédula y nombre son obligatorios', 'err'); return }
  const props = DB.get('props');
  if (props.find(p => p.cedula === ced)) { toast('Esa cédula ya existe', 'err'); return }
  const np = {
    id: 'p' + Date.now(), tdoc: document.getElementById('p-tdoc').value, cedula: ced, nombre: nom,
    telefono: document.getElementById('p-tel').value.trim(), email: document.getElementById('p-email').value.trim(),
    direccion: document.getElementById('p-dir').value.trim(), ciudad: document.getElementById('p-ciu').value.trim() || 'Barbosa',
    como: document.getElementById('p-como').value, contacto: document.getElementById('p-cont').value.trim(),
    talt: document.getElementById('p-talt').value.trim(), created: new Date().toLocaleDateString('es-CO')
  };
  props.push(np); DB.set('props', props); closeM('m-prop');
  ['p-ced', 'p-nom', 'p-tel', 'p-email', 'p-dir', 'p-cont', 'p-talt'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' });
  document.getElementById('p-ciu').value = 'Barbosa';
  updSelects(); rProp(); rStats(); toast('Propietario guardado ✓', 'ok');
  syncPropToCRM(np);
}

function rProp(q) {
  q = (q || '').toLowerCase();
  let data = DB.get('props'); if (q) data = data.filter(p => p.nombre.toLowerCase().includes(q) || p.cedula.includes(q) || (p.telefono || '').includes(q));
  const mas = DB.get('mas'), tb = document.getElementById('tb-prop'), em = document.getElementById('em-prop');
  const bp = document.getElementById('cnt-prop-badge'); if (bp) bp.textContent = DB.get('props').length;
  if (!data.length) { if (tb) tb.innerHTML = ''; if (em) em.style.display = 'block'; return }
  if (em) em.style.display = 'none';
  if (tb) tb.innerHTML = data.map(p => {
    const mm = mas.filter(m => m.pid === p.id);
    return `<tr>
      <td><div class="ac"><div class="av" style="background:${avColor(p.nombre)}">${ini(p.nombre)}</div>
      <div><div class="cn">${p.nombre}</div><div class="cs">${p.email || 'Sin email'}</div></div></div></td>
      <td><span style="font-family:'DM Mono',monospace;font-size:11px">${p.cedula}</span></td>
      <td>${p.telefono || '—'}</td><td style="font-size:11px">${p.email || '—'}</td>
      <td>${mm.map(m => `<span class="badge bg-teal" style="margin:1px">${EI(m.esp)} ${m.nombre}</span>`).join('') || '<span class="badge bg-gray">Sin mascotas</span>'}</td>
      <td><span class="cs">${p.created}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-xs" onclick="editProp('${p.id}')">✏️</button>
        <button class="btn btn-outline btn-xs" onclick="abrirHist('${p.id}')">📋</button>
        <button class="btn btn-green btn-xs" onclick="nuevaMas('${p.id}')">+🐾</button>
      </td></tr>`;
  }).join('');
}

function buscarProp(q) {
  q = q.toLowerCase(); const res = document.getElementById('search-results');
  if (!q) { res.innerHTML = ''; return }
  const data = DB.get('props').filter(p => p.nombre.toLowerCase().includes(q) || p.cedula.includes(q));
  if (!data.length) { res.innerHTML = '<p style="color:var(--g500);font-size:12px;padding:6px">Sin resultados</p>'; return }
  res.innerHTML = data.map(p => `
    <div onclick="selProp('${p.id}')" style="display:flex;align-items:center;gap:8px;padding:8px;
      border-radius:8px;cursor:pointer;border:1px solid var(--g200);margin-bottom:5px;background:var(--g100)">
      <div class="av" style="background:${avColor(p.nombre)};width:28px;height:28px;font-size:10px">${ini(p.nombre)}</div>
      <div><div style="font-size:12px;font-weight:600">${p.nombre}</div>
      <div style="font-size:10px;color:var(--g500)">${p.cedula} · ${p.telefono || ''}</div></div>
      <span style="margin-left:auto;font-size:10px;color:var(--green);font-weight:600">Seleccionar →</span>
    </div>`).join('');
}

function selProp(pid) {
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-in').value = '';
  openM('m-mas'); setTimeout(() => { document.getElementById('m-prop-sel').value = pid }, 60);
}

function editProp(id) {
  const p = DB.get('props').find(x => x.id === id); if (!p) return;
  document.getElementById('ep-id').value = id; document.getElementById('ep-nom').value = p.nombre;
  document.getElementById('ep-tel').value = p.telefono || ''; document.getElementById('ep-email').value = p.email || '';
  document.getElementById('ep-dir').value = p.direccion || ''; document.getElementById('ep-ciu').value = p.ciudad || 'Barbosa';
  document.getElementById('ep-cont').value = p.contacto || ''; openM('m-edit-prop');
}

function updateProp() {
  const id = document.getElementById('ep-id').value, props = DB.get('props'), p = props.find(x => x.id === id); if (!p) return;
  p.nombre = document.getElementById('ep-nom').value.trim(); p.telefono = document.getElementById('ep-tel').value.trim();
  p.email = document.getElementById('ep-email').value.trim(); p.direccion = document.getElementById('ep-dir').value.trim();
  p.ciudad = document.getElementById('ep-ciu').value.trim(); p.contacto = document.getElementById('ep-cont').value.trim();
  DB.set('props', props); closeM('m-edit-prop'); rProp(); updSelects(); toast('Propietario actualizado ✓', 'ok');
  syncPropToCRM(p);
}

function abrirHist(pid) {
  const mm = DB.get('mas').filter(m => m.pid === pid);
  if (!mm.length) { toast('Sin mascotas registradas', 'err'); return }
  go('historia', document.querySelectorAll('.tab-btn')[2]);
  setTimeout(() => openHist(mm[0].id), 200);
}

function nuevaMas(pid) { openM('m-mas'); setTimeout(() => { document.getElementById('m-prop-sel').value = pid }, 60) }
