// Módulo: Seguimiento activo
let segFilter = 'todos';

function saveSeg() {
  const mid = document.getElementById('sg-mas').value, diag = document.getElementById('sg-diag').value.trim();
  if (!mid || !diag) { toast('Mascota y diagnóstico son obligatorios', 'err'); return }
  const ns = {
    id: 's' + Date.now(), mid, tipo: document.getElementById('sg-tipo').value, diag,
    trat: document.getElementById('sg-trat').value.trim(),
    dia: parseInt(document.getElementById('sg-dia').value) || 1,
    activo: true, not: document.getElementById('sg-not').value.trim(),
    fecha: new Date().toLocaleDateString('es-CO')
  };
  const segs = DB.get('segs'); segs.push(ns); DB.set('segs', segs);
  closeM('m-seg'); rSeg(); rStats(); toast('Seguimiento registrado ✓', 'ok');
}

function rSeg(f) {
  f = f || segFilter;
  let data = DB.get('segs').filter(s => s.activo); if (f !== 'todos') data = data.filter(s => s.tipo === f);
  const mas = DB.get('mas'), props = DB.get('props'), cont = document.getElementById('seg-list'); if (!cont) return;
  if (!data.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-ic">🏥</div><div class="empty-t">Sin pacientes en seguimiento</div><div class="empty-s">Registra el primero</div></div>`;
    return;
  }
  cont.innerHTML = data.map(s => {
    const m = mas.find(x => x.id === s.mid), p = m ? props.find(x => x.id === m.pid) : null;
    return `<div class="seg-card">
      <div class="seg-dot ${s.tipo === 'hospitalizacion' ? 'hosp' : 'amb'}"></div>
      <div style="font-size:24px">${m ? EI(m.esp) : '🐾'}</div>
      <div class="seg-info">
        <div class="seg-pet">${m ? m.nombre : '—'} <span class="badge ${s.tipo === 'hospitalizacion' ? 'bg-red' : 'bg-yellow'}" style="margin-left:4px">${s.tipo === 'hospitalizacion' ? 'Hospitalización' : 'Ambulatorio'}</span></div>
        <div style="font-size:11px;color:var(--g500);margin-top:1px">Tutor: ${p ? p.nombre + '  ·  ' + p.telefono : '—'}</div>
        <div class="seg-dx"><strong>Dx:</strong> ${s.diag}</div>
        ${s.trat ? `<div style="font-size:11px;color:var(--g500)"><strong>Tx:</strong> ${s.trat}</div>` : ''}
      </div>
      <div class="seg-day"><div class="seg-dn">${s.dia}</div><div class="seg-dl">Día</div></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="diaPlus('${s.id}')">+1 Día</button>
        <button class="btn btn-red btn-sm" onclick="darAlta('${s.id}')">Alta médica</button>
      </div>
    </div>`;
  }).join('');
}

function diaPlus(id) { const segs = DB.get('segs'), s = segs.find(x => x.id === id); if (s) { s.dia++; DB.set('segs', segs); rSeg() } }
function darAlta(id) { const segs = DB.get('segs'), s = segs.find(x => x.id === id); if (s) { s.activo = false; DB.set('segs', segs); rSeg(); rStats(); toast('Paciente dado de alta ✓', 'ok') } }
function fSeg(f, btn) { segFilter = f; document.querySelectorAll('#page-seguimiento .ftab').forEach(t => t.classList.remove('on')); if (btn) btn.classList.add('on'); rSeg(f) }
