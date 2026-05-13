// Módulo: Cotización y Facturación
const COT = {
  items: [],
  manuales: [],
  cat: 'todos',
  guardadaId: null,
  facturaId: null,
  facturaCreada: false,
  seq: 1,
  get allItems() { return [...this.items, ...this.manuales]; },
  get total() { return this.allItems.reduce((s, i) => s + (i.precio || 0), 0); },
  get count() { return this.allItems.length; },
  toggleProc(proc) {
    const idx = this.items.findIndex(i => i.proc_id === proc.id);
    if (idx > -1) { this.items.splice(idx, 1); return false; }
    this.items.push({ uid: 'u' + (this.seq++), proc_id: proc.id, nombre: proc.nombre, precio: proc.precio, cat: proc.cat, tipo: 'proc' });
    return true;
  },
  isSelected(pid) { return this.items.some(i => i.proc_id === pid); },
  addManual(nombre, precio) { this.manuales.push({ uid: 'u' + (this.seq++), proc_id: null, nombre, precio: parseFloat(precio) || 0, cat: 'manual', tipo: 'manual' }); },
  reset() {
    this.items = []; this.manuales = []; this.cat = 'todos';
    this.guardadaId = null; this.facturaId = null; this.facturaCreada = false;
  }
};

function rCotizacion() {
  const ps = document.getElementById('cot-prop');
  if (ps) { const sv = ps.value, p = DB.get('props'); ps.innerHTML = '<option value="">Selecciona propietario...</option>' + p.map(x => `<option value="${x.id}">${x.nombre}</option>`).join(''); if (sv) ps.value = sv; }
  const cats = ['todos', 'consulta', 'cirugia', 'laboratorio', 'imagen', 'vacunacion', 'hospitalizacion', 'peluqueria', 'otro'];
  const catLbl = { todos: 'Todos', consulta: 'Consulta', cirugia: 'Cirugía', laboratorio: 'Lab', imagen: 'Imagen', vacunacion: 'Vacuna', hospitalizacion: 'Hosp.', peluqueria: 'Peluq.', otro: 'Otro' };
  const ce = document.getElementById('cot-cats');
  if (ce) ce.innerHTML = cats.map(c => `<button class="ftab ${c === COT.cat ? 'on' : ''}" onclick="fCot('${c}',this)">${catLbl[c]}</button>`).join('');
  let data = DB.get('procs');
  if (COT.cat !== 'todos') data = data.filter(p => p.cat === COT.cat);
  const el = document.getElementById('cot-procs'); if (!el) return;
  if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="empty-s">Sin procedimientos en esta categoría</div></div>'; return; }
  el.innerHTML = data.map(p => {
    const sel = COT.isSelected(p.id);
    const item = COT.items.find(i => i.proc_id === p.id);
    const precio = item ? item.precio : p.precio;
    const nombre = item ? item.nombre : p.nombre;
    return `<div class="cot-item-edit ${sel ? 'sel' : ''}" id="cot-row-${p.id}">
      <input type="checkbox" class="cot-check" ${sel ? 'checked' : ''} onchange="cotToggleProc('${p.id}')">
      <input class="cot-edit-name" value="${nombre.replace(/"/g, '&quot;')}" title="Editar nombre" ${sel ? '' : 'readonly tabindex="-1"'} oninput="cotEditNombreProc('${p.id}',this.value)">
      <span class="badge bg-gray" style="font-size:9px">${p.cat}</span>
      <span style="font-size:10px;color:var(--g500)">$</span>
      <input class="cot-edit-price" type="number" value="${precio}" title="Editar precio" ${sel ? '' : 'readonly tabindex="-1"'} oninput="cotEditPrecioProc('${p.id}',this.value)">
      <button class="cot-del-btn" onclick="cotDelProc('${p.id}')" title="Eliminar">✕</button>
    </div>`;
  }).join('');
  updCotTotal();
}

function fCot(f, btn) {
  COT.cat = f;
  document.querySelectorAll('#cot-cats .ftab').forEach(t => t.classList.remove('on'));
  if (btn) btn.classList.add('on');
  rCotizacion();
}

function cotToggleProc(procId) {
  const proc = DB.get('procs').find(p => p.id === procId); if (!proc) return;
  COT.toggleProc(proc);
  const row = document.getElementById('cot-row-' + procId);
  if (row) {
    const sel = COT.isSelected(procId);
    row.classList.toggle('sel', sel);
    const ck = row.querySelector('.cot-check'); if (ck) ck.checked = sel;
    const ni = row.querySelector('.cot-edit-name'), pi = row.querySelector('.cot-edit-price');
    if (ni) { ni.readOnly = !sel; ni.removeAttribute('tabindex'); }
    if (pi) { pi.readOnly = !sel; pi.removeAttribute('tabindex'); }
    const item = COT.items.find(i => i.proc_id === procId);
    if (item && ni) ni.value = item.nombre;
    if (item && pi) pi.value = item.precio;
  }
  updCotTotal();
}

function cotEditNombreProc(pid, val) {
  const item = COT.items.find(i => i.proc_id === pid); if (item) item.nombre = val;
  const procs = DB.get('procs'), p = procs.find(x => x.id === pid); if (p) { p.nombre = val; DB.set('procs', procs); }
}
function cotEditPrecioProc(pid, val) {
  const item = COT.items.find(i => i.proc_id === pid); if (item) { item.precio = parseFloat(val) || 0; updCotTotal(); }
  const procs = DB.get('procs'), p = procs.find(x => x.id === pid); if (p) { p.precio = parseFloat(val) || 0; DB.set('procs', procs); }
}
function cotDelProc(pid) {
  const procs = DB.get('procs'); DB.set('procs', procs.filter(p => p.id !== pid));
  COT.items = COT.items.filter(i => i.proc_id !== pid);
  rCotizacion(); updCotTotal(); toast('Procedimiento eliminado', 'info');
}

function updCotTotal() {
  const tv = document.getElementById('cot-total'), tc = document.getElementById('cot-cnt');
  if (tv) tv.textContent = fmt$(COT.total);
  if (tc) tc.textContent = COT.count + ' ítem' + (COT.count !== 1 ? 's' : '');
}

function cotMas() {
  const pid = document.getElementById('cot-prop').value, sel = document.getElementById('cot-mas');
  const mas = DB.get('mas').filter(m => m.pid === pid);
  sel.innerHTML = '<option value="">Sin mascota registrada</option>' + mas.map(m => `<option value="${m.id}">${EI(m.esp)} ${m.nombre}</option>`).join('');
  if (mas.length === 1) {
    const esp = mas[0].esp, esel = document.getElementById('cot-especie');
    if (esel) { const opt = [...esel.options].find(o => o.value === esp); if (opt) esel.value = esp; else { esel.value = 'otro'; const w = document.getElementById('cot-esp-otro-wrap'); if (w) w.style.display = 'block'; const eo = document.getElementById('cot-esp-otro'); if (eo) eo.value = esp; } }
  }
}
function cotEspecieChange() {
  const v = document.getElementById('cot-especie')?.value;
  const w = document.getElementById('cot-esp-otro-wrap'); if (w) w.style.display = v === 'otro' ? 'block' : 'none';
}

function addManualItem() {
  const nom = document.getElementById('cot-man-nom').value.trim();
  const val = parseFloat(document.getElementById('cot-man-val').value) || 0;
  if (!nom) { toast('Escribe el nombre del ítem', 'err'); return }
  COT.addManual(nom, val);
  document.getElementById('cot-man-nom').value = '';
  document.getElementById('cot-man-val').value = '';
  renderManualItems(); updCotTotal(); toast('Ítem manual agregado ✓', 'ok');
}
function editManItem(uid, field, val) { const m = COT.manuales.find(x => x.uid === uid); if (m) { m[field] = field === 'precio' ? parseFloat(val) || 0 : val; updCotTotal(); } }
function delManItem(uid) { COT.manuales = COT.manuales.filter(m => m.uid !== uid); renderManualItems(); updCotTotal(); }
function renderManualItems() {
  const el = document.getElementById('cot-manual-list'); if (!el) return;
  if (!COT.manuales.length) { el.innerHTML = ''; return; }
  el.innerHTML = COT.manuales.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--g200)">
      <input style="flex:1;border:1.5px solid var(--g300);border-radius:6px;padding:5px 8px;font-family:inherit;font-size:12px;outline:none"
        value="${m.nombre.replace(/"/g, '&quot;')}" oninput="editManItem('${m.uid}','nombre',this.value)">
      <input type="number" style="width:110px;border:1.5px solid var(--g300);border-radius:6px;padding:5px 8px;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--teal);text-align:right;outline:none"
        value="${m.precio}" oninput="editManItem('${m.uid}','precio',this.value)">
      <button class="cot-del-btn" onclick="delManItem('${m.uid}')">✕</button>
    </div>`).join('');
}

function saveProc() {
  const nom = document.getElementById('proc-nom').value.trim(); if (!nom) { toast('Nombre obligatorio', 'err'); return; }
  const np = { id: 'pr' + Date.now(), nombre: nom, cat: document.getElementById('proc-cat').value, precio: parseFloat(document.getElementById('proc-precio').value) || 0, desc: document.getElementById('proc-desc').value.trim() };
  const procs = DB.get('procs'); procs.push(np); DB.set('procs', procs);
  closeM('m-proc'); rCotizacion(); toast('Procedimiento agregado ✓', 'ok');
}

function resetCotizacion() {
  COT.reset();
  ['cot-prop', 'cot-mas', 'cot-especie', 'cot-diag', 'cot-pron', 'cot-notas', 'cot-esp-otro'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const wrap = document.getElementById('cot-esp-otro-wrap'); if (wrap) wrap.style.display = 'none';
  renderManualItems();
  document.getElementById('cot-preview').style.display = 'none';
  const fp = document.getElementById('factura-preview'); if (fp) fp.style.display = 'none';
  const btnF = document.getElementById('btn-gen-factura'); if (btnF) { btnF.style.display = 'none'; btnF.disabled = false; btnF.textContent = '🧾 Generar factura'; }
  const btnG = document.getElementById('btn-guardar-cot'); if (btnG) { btnG.disabled = false; btnG.textContent = '💾 Guardar cotización'; btnG.style.display = ''; }
  document.querySelectorAll('.cot-edit-name,.cot-edit-price,#cot-notas,.cot-check,#cot-man-nom,#cot-man-val').forEach(el => { el.disabled = false; el.style.opacity = ''; });
  document.querySelectorAll('.cot-del-btn').forEach(b => { b.disabled = false; b.style.opacity = ''; });
  rCotizacion(); updCotTotal(); toast('Nueva cotización lista', 'ok');
}
function borrarCotizacion() { if (!confirm('¿Borrar toda la cotización actual?')) return; resetCotizacion(); toast('Cotización borrada', 'info'); }

function _getCotContext() {
  const pid = document.getElementById('cot-prop').value, mid = document.getElementById('cot-mas').value;
  const prop = DB.get('props').find(p => p.id === pid) || null;
  const masc = DB.get('mas').find(m => m.id === mid) || null;
  let esp = document.getElementById('cot-especie')?.value || '';
  if (esp === 'otro') esp = document.getElementById('cot-esp-otro')?.value || 'otro';
  const diag = document.getElementById('cot-diag')?.value || '';
  const pron = document.getElementById('cot-pron')?.value || '';
  const notas = document.getElementById('cot-notas')?.value || '';
  return { prop, masc, esp, diag, pron, notas };
}

function _buildPreviewHTML(ctx, items, total, tipo) {
  const { prop, masc, esp, diag, pron, notas } = ctx;
  const folio = tipo === 'factura' ? `FAC-${Date.now().toString().slice(-6)}` : `COT-${Date.now().toString().slice(-6)}`;
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div><div style="font-size:10px;color:var(--g500);text-transform:uppercase;letter-spacing:.5px">VitalVet · Barbosa, Santander · Dr. Iván Durán MV</div>
      <div style="font-size:10px;color:var(--g400);margin-top:2px">www.vitalvetcrv.com.co</div></div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:700;color:var(--teal);text-transform:uppercase">${tipo === 'factura' ? 'Factura' : 'Cotización'}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--g500)">${folio}</div>
        <div style="font-size:10px;color:var(--g400)">${new Date().toLocaleDateString('es-CO')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:var(--g100);border-radius:8px;padding:10px 14px">
        <div style="font-size:9px;font-weight:700;color:var(--g500);text-transform:uppercase;margin-bottom:3px">Propietario / Tutor</div>
        <div style="font-size:13px;font-weight:600">${prop ? prop.nombre : 'No especificado'}</div>
        ${prop && prop.telefono ? `<div style="font-size:11px;color:var(--g500)">${prop.telefono}</div>` : ''}
        ${prop && prop.cedula ? `<div style="font-size:10px;color:var(--g400)">CC: ${prop.cedula}</div>` : ''}
      </div>
      <div style="background:var(--g100);border-radius:8px;padding:10px 14px">
        <div style="font-size:9px;font-weight:700;color:var(--g500);text-transform:uppercase;margin-bottom:3px">Paciente</div>
        <div style="font-size:13px;font-weight:600">${masc ? EI(masc.esp) + ' ' + masc.nombre : 'No especificado'}</div>
        ${esp ? `<div style="font-size:11px;color:var(--g500);text-transform:capitalize">${esp}</div>` : ''}
        ${masc && masc.raza ? `<div style="font-size:10px;color:var(--g400)">${masc.raza}</div>` : ''}
      </div>
      ${diag ? `<div style="background:var(--g100);border-radius:8px;padding:10px 14px;grid-column:1/-1"><div style="font-size:9px;font-weight:700;color:var(--g500);text-transform:uppercase;margin-bottom:3px">Diagnóstico / Motivo</div><div style="font-size:12px">${diag}</div></div>` : ''}
    </div>
    <table><thead style="background:var(--navy-m)"><tr>
      <th style="color:#fff">Procedimiento / Servicio</th><th style="color:#fff">Categoría</th><th style="color:#fff;text-align:right">Valor</th>
    </tr></thead>
    <tbody>${items.map(s => `<tr>
      <td style="font-weight:500">${s.nombre}</td>
      <td><span class="badge ${s.tipo === 'manual' ? 'bg-yellow' : 'bg-teal'}">${s.tipo === 'manual' ? 'Manual' : s.cat}</span></td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:var(--teal)">${fmt$(s.precio)}</td>
    </tr>`).join('')}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin:14px 0">
      <div style="background:var(--green-lt);border-radius:8px;padding:12px 20px;text-align:right;min-width:180px">
        <div style="font-size:10px;color:var(--g500);margin-bottom:3px">TOTAL ${tipo === 'factura' ? 'FACTURA' : 'COTIZACIÓN'}</div>
        <div style="font-size:26px;font-weight:800;color:var(--teal)">${fmt$(total)}</div>
      </div>
    </div>
    ${pron ? `<div style="background:var(--g100);border-radius:8px;padding:12px 14px;font-size:12px;margin-bottom:10px"><strong>Pronóstico:</strong> ${pron}</div>` : ''}
    ${notas ? `<div style="background:#fffde7;border-radius:8px;padding:12px 14px;font-size:12px;border-left:3px solid #f9a825;margin-bottom:10px"><strong>Información adicional:</strong><br>${notas}</div>` : ''}
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--g200);font-size:10px;color:var(--g400);text-align:center">
      ${tipo === 'factura' ? 'Factura emitida' : 'Esta cotización tiene validez de 30 días'} · VitalVet Clínica Regional Veterinaria · Barbosa, Santander · Dr. Iván Durán MV
    </div>`;
}

function genCot() {
  if (!COT.count) { toast('Selecciona al menos un procedimiento', 'err'); return; }
  const ctx = _getCotContext();
  document.getElementById('cot-preview-body').innerHTML = _buildPreviewHTML(ctx, COT.allItems, COT.total, 'cotizacion');
  document.getElementById('cot-preview').style.display = 'block';
  toast('Cotización generada — revisa y guarda', 'info');
  setTimeout(() => document.getElementById('cot-preview').scrollIntoView({ behavior: 'smooth' }), 200);
}

async function saveCotSupabase() {
  if (!COT.count) { toast('Sin ítems para guardar', 'err'); return; }
  const btnG = document.getElementById('btn-guardar-cot');
  if (btnG) { btnG.disabled = true; btnG.textContent = '⏳ Guardando...'; }
  const ctx = _getCotContext();
  const sb = getSB();
  const cotPayload = {
    propietario_id: document.getElementById('cot-prop').value || null,
    nombre_manual: ctx.prop ? ctx.prop.nombre : null,
    mascota_manual: ctx.masc ? ctx.masc.nombre : null,
    especie: ctx.esp || null, diagnostico: ctx.diag || null, pronostico: ctx.pron || null,
    informacion: document.getElementById('cot-notas')?.value || null,
    total: COT.total, created_at: new Date().toISOString()
  };
  try {
    let cotId = null;
    if (sb) {
      const { data, error } = await sb.from('cotizaciones').insert([cotPayload]).select();
      if (error) throw error;
      cotId = data[0]?.id;
      if (cotId) {
        const ip = COT.allItems.map(i => ({ cotizacion_id: cotId, proc_id: i.proc_id || null, nombre: i.nombre, precio: i.precio, categoria: i.cat, tipo: i.tipo }));
        await sb.from('cotizacion_items').insert(ip);
      }
    }
    COT.guardadaId = cotId || 'local-' + Date.now();
    const btnF = document.getElementById('btn-gen-factura'); if (btnF) btnF.style.display = '';
    if (btnG) { btnG.disabled = false; btnG.textContent = '✓ Guardada'; }
    toast(sb ? '✅ Cotización guardada en Supabase' : '✅ Cotización guardada (local)', 'ok');
  } catch (e) {
    console.warn('Supabase:', e.message);
    COT.guardadaId = 'local-' + Date.now();
    const btnF = document.getElementById('btn-gen-factura'); if (btnF) btnF.style.display = '';
    if (btnG) { btnG.disabled = false; btnG.textContent = '💾 Guardar cotización'; }
    toast('Guardado local (sin conexión BD)', 'info');
  }
}

async function generarFactura() {
  if (COT.facturaCreada) { toast('Ya existe una factura para esta cotización', 'info'); return; }
  if (!COT.guardadaId) { toast('Primero guarda la cotización', 'err'); return; }
  if (!confirm('¿Generar factura? Una vez creada no se podrá editar.')) return;
  const ctx = _getCotContext();
  const sb = getSB();
  const factNumero = 'FAC-' + Date.now().toString().slice(-6);
  const sbCotId = COT.guardadaId && !String(COT.guardadaId).startsWith('local-') ? COT.guardadaId : null;
  const factPayload = {
    cotizacion_id: sbCotId,
    propietario_id: document.getElementById('cot-prop').value || null,
    numero: factNumero, total: COT.total, estado: 'emitida', created_at: new Date().toISOString()
  };
  try {
    let factId = null;
    if (sb && sbCotId) {
      const { data, error } = await sb.from('facturas').insert([factPayload]).select();
      if (error) throw error;
      factId = data[0]?.id;
      if (factId) {
        const ip = COT.allItems.map(i => ({ factura_id: factId, cotizacion_id: sbCotId, nombre: i.nombre, precio: i.precio, categoria: i.cat, tipo: i.tipo }));
        await sb.from('factura_items').insert(ip);
      }
    }
    COT.facturaId = factId || factNumero;
    COT.facturaCreada = true;
    document.querySelectorAll('.cot-edit-name,.cot-edit-price,#cot-notas,.cot-check,#cot-man-nom,#cot-man-val').forEach(el => { el.disabled = true; el.style.opacity = '.5'; });
    document.querySelectorAll('.cot-del-btn').forEach(b => { b.disabled = true; b.style.opacity = '.3'; });
    const btnF = document.getElementById('btn-gen-factura'); if (btnF) { btnF.disabled = true; btnF.textContent = '✓ Factura creada'; }
    const btnG = document.getElementById('btn-guardar-cot'); if (btnG) btnG.disabled = true;
    const factPrev = document.getElementById('factura-preview');
    const factBody = document.getElementById('factura-body');
    const factNum = document.getElementById('factura-numero');
    if (factNum) factNum.textContent = factNumero;
    if (factBody) factBody.innerHTML = _buildPreviewHTML(ctx, COT.allItems, COT.total, 'factura');
    if (factPrev) factPrev.style.display = 'block';
    toast('🧾 Factura generada ✓', 'ok');
    setTimeout(() => factPrev && factPrev.scrollIntoView({ behavior: 'smooth' }), 200);
  } catch (e) {
    console.warn('Factura error:', e.message);
    COT.facturaCreada = true;
    toast('Factura creada localmente', 'info');
  }
}

function exportPDF(tipo) {
  if (!window.jspdf) { toast('jsPDF no disponible', 'err'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  const teal = [11, 124, 122], dark = [48, 61, 58], gray = [122, 146, 168], light = [232, 247, 243];
  const ctx = _getCotContext();
  const { prop, masc, esp, diag, pron, notas } = ctx;
  const items = COT.allItems, total = COT.total;
  const esFac = tipo === 'factura';
  const folio = esFac && COT.facturaId ? String(COT.facturaId) : 'COT-' + Date.now().toString().slice(-6);
  doc.setFillColor(...dark); doc.rect(0, 0, W, 36, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('VitalVet', M, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 200, 196);
  doc.text('Centro de Cirugía Compleja y Medicina Avanzada · Barbosa, Santander', M, 21);
  doc.text('www.vitalvetcrv.com.co  |  Dr. Iván Durán MV', M, 26);
  doc.setTextColor(...teal); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(esFac ? 'FACTURA' : 'COTIZACIÓN DE SERVICIOS', W - M, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 200, 196);
  doc.text('N°: ' + folio, W - M, 21, { align: 'right' });
  doc.text('Fecha: ' + new Date().toLocaleDateString('es-CO'), W - M, 26, { align: 'right' });
  let y = 44;
  doc.setFillColor(...light); doc.roundedRect(M, y, W - M * 2, 30, 3, 3, 'F');
  const c1 = M + 4, c2 = M + 92;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...teal);
  doc.text('PROPIETARIO / TUTOR', c1, y + 8); doc.text('PACIENTE', c2, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...dark);
  doc.text(prop ? prop.nombre : 'No especificado', c1, y + 16);
  doc.text(masc ? masc.nombre : 'No especificado', c2, y + 16);
  doc.setFontSize(7.5); doc.setTextColor(...gray);
  if (prop && prop.telefono) doc.text('Tel: ' + prop.telefono, c1, y + 22);
  if (esp) doc.text(esp.charAt(0).toUpperCase() + esp.slice(1), c2, y + 22);
  if (diag) { doc.setTextColor(...dark); doc.text('Motivo: ' + diag.substring(0, 80), c1, y + 27); }
  y += 38;
  doc.setFillColor(...dark); doc.rect(M, y, W - M * 2, 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('PROCEDIMIENTO / SERVICIO', c1, y + 5); doc.text('CAT', M + 120, y + 5); doc.text('VALOR', W - M - 4, y + 5, { align: 'right' });
  y += 7;
  items.forEach((s, i) => {
    if (y > 260) { doc.addPage(); y = 20; }
    if (i % 2 === 0) { doc.setFillColor(248, 252, 251); doc.rect(M, y, W - M * 2, 7, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text(s.nombre.length > 50 ? s.nombre.substring(0, 50) + '…' : s.nombre, c1, y + 5);
    doc.setFontSize(7); doc.setTextColor(...gray); doc.text(s.tipo === 'manual' ? 'Manual' : s.cat, M + 120, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...teal);
    doc.text(fmt$(s.precio), W - M - 4, y + 5, { align: 'right' }); y += 7;
  });
  y += 4;
  doc.setFillColor(...dark); doc.roundedRect(M, y, W - M * 2, 13, 3, 3, 'F');
  doc.setTextColor(180, 200, 196); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('TOTAL', c1, y + 9);
  doc.setTextColor(...teal); doc.setFontSize(13); doc.text(fmt$(total), W - M - 4, y + 9.5, { align: 'right' });
  y += 18;
  if (notas) {
    doc.setFillColor(255, 253, 231); doc.roundedRect(M, y, W - M * 2, 16, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(120, 90, 0); doc.text('Información adicional:', c1, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...dark);
    const ls = doc.splitTextToSize(notas, W - M * 2 - 8); doc.text(ls[0] || '', c1, y + 13); y += 18;
  }
  if (pron) { y += 3; doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...gray); doc.text('Pronóstico: ' + pron, c1, y); }
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gray);
  doc.text((esFac ? 'Factura emitida' : 'Cotización válida 30 días') + ' · VitalVet · Barbosa, Santander · Dr. Iván Durán MV', W / 2, y, { align: 'center' });
  const mn = masc ? masc.nombre : 'paciente';
  doc.save('VitalVet_' + (esFac ? 'Factura' : 'Cotizacion') + '_' + folio + '_' + mn + '.pdf');
  toast('📥 PDF ' + (esFac ? 'factura' : 'cotización') + ' descargado', 'ok');
}
