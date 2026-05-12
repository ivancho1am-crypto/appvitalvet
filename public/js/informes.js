// Módulo: Informes y exportables
function rInfProp(q) {
  q = (q || '').toLowerCase(); let data = DB.get('props'); if (q) data = data.filter(p => p.nombre.toLowerCase().includes(q) || p.cedula.includes(q));
  const mas = DB.get('mas'), tb = document.getElementById('tb-inf-prop'); if (!tb) return;
  tb.innerHTML = data.map(p => { const mm = mas.filter(m => m.pid === p.id);
    return `<tr><td><div class="ac"><div class="av" style="background:${avColor(p.nombre)}">${ini(p.nombre)}</div><div class="cn">${p.nombre}</div></div></td>
    <td style="font-family:'DM Mono',monospace;font-size:11px">${p.cedula}</td><td>${p.telefono || '—'}</td>
    <td style="font-size:11px">${p.email || '—'}</td><td>${p.ciudad || 'Barbosa'}</td>
    <td>${mm.length}</td><td class="cs">${p.created}</td></tr>`;
  }).join('');
}

function rInfMas() {
  const data = DB.get('mas'), props = DB.get('props'), tb = document.getElementById('tb-inf-mas'); if (!tb) return;
  tb.innerHTML = data.map(m => { const p = props.find(x => x.id === m.pid);
    return `<tr><td><div class="ac"><div style="font-size:18px">${EI(m.esp)}</div><div class="cn">${m.nombre}</div></div></td>
    <td style="text-transform:capitalize">${m.esp}</td><td>${m.raza || 'Mestizo'}</td>
    <td style="text-transform:capitalize">${m.gen || '—'}</td><td>${edad(m.fn)}</td>
    <td>${m.peso ? m.peso + ' kg' : '—'}</td><td>${p ? p.nombre : '—'}</td>
    <td style="font-size:11px;text-transform:capitalize">${(m.repr || '').replace('_', ' ') || '—'}</td></tr>`;
  }).join('');
}

function exportCSV(type) {
  let data, headers, rows;
  if (type === 'props') { data = DB.get('props'); headers = ['ID', 'Cédula', 'Nombre', 'Teléfono', 'Email', 'Dirección', 'Ciudad', 'Registrado']; rows = data.map(p => [p.id, p.cedula, p.nombre, p.telefono, p.email, p.direccion, p.ciudad, p.created]) }
  else if (type === 'mas') { data = DB.get('mas'); const props = DB.get('props'); headers = ['ID', 'Nombre', 'Especie', 'Raza', 'Género', 'Edad', 'Peso', 'Propietario']; rows = data.map(m => { const p = props.find(x => x.id === m.pid); return [m.id, m.nombre, m.esp, m.raza, m.gen, edad(m.fn), m.peso, p ? p.nombre : ''] }) }
  else { data = DB.get('hist'); const mas = DB.get('mas'); headers = ['ID', 'Mascota', 'Tipo', 'Fecha', 'Diagnóstico', 'Tratamiento', 'Veterinario']; rows = data.map(h => { const m = mas.find(x => x.id === h.mid); return [h.id, m ? m.nombre : '', h.tipo, h.fecha, h.diag, h.trat, h.vet] }) }
  const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv);
  a.download = `vitalvet_${type}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  toast('CSV exportado ✓', 'ok');
}
