// Módulo: Recordatorios y agenda
function rRecordatorios() {
  const mas = DB.get('mas'), props = DB.get('props'), hist = DB.get('hist');
  const today = new Date();

  // Cumpleaños
  const be = document.getElementById('rec-birth');
  if (be) {
    const b = mas.filter(m => m.fn).map(m => {
      const fn = new Date(m.fn), next = new Date(today.getFullYear(), fn.getMonth(), fn.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const diff = Math.ceil((next - today) / (86400000)); return { m, diff };
    }).filter(x => x.diff <= 30).sort((a, b) => a.diff - b.diff);
    be.innerHTML = b.length ? b.map(({ m, diff }) => {
      const p = props.find(x => x.id === m.pid);
      return `<div class="rec-card"><div class="rec-ic" style="background:#fef3c7">🎂</div>
      <div class="rec-info"><div class="rec-title">${EI(m.esp)} ${m.nombre} ${diff === 0 ? '🎂 ¡HOY!' : ''}</div>
      <div class="rec-sub">${p ? p.nombre : ''} · Cumple ${edad(m.fn)}</div></div>
      <div class="rec-date">${diff === 0 ? 'Hoy' : diff + ' días'}</div></div>`;
    }).join('')
    : `<div class="empty-state"><div class="empty-ic">🎂</div><div class="empty-s">Sin cumpleaños próximos</div></div>`;
  }

  // Vacunas
  const ve = document.getElementById('rec-vac');
  if (ve) {
    const v = hist.filter(h => h.tipo === 'vacunacion' && h.prox).map(h => {
      const m = mas.find(x => x.id === h.mid), p = m ? props.find(x => x.id === m.pid) : null;
      const diff = Math.ceil((new Date(h.prox) - today) / (86400000));
      return { h, m, p, diff };
    }).filter(x => x.diff >= 0 && x.diff <= 60).sort((a, b) => a.diff - b.diff);
    ve.innerHTML = v.length ? v.map(({ h, m, p, diff }) => `
      <div class="rec-card"><div class="rec-ic" style="background:#dcfce7">💉</div>
      <div class="rec-info"><div class="rec-title">${m ? EI(m.esp) + ' ' + m.nombre : '—'}</div>
      <div class="rec-sub">${p ? p.nombre + ' · ' + p.telefono : ''}</div></div>
      <div class="rec-date">${h.prox}</div></div>`).join('')
    : `<div class="empty-state"><div class="empty-ic">💉</div><div class="empty-s">Sin vacunas próximas</div></div>`;
  }

  // Desparasitaciones
  const de = document.getElementById('rec-desp');
  if (de) {
    const d = hist.filter(h => h.tipo === 'desparasitacion' && h.prox).map(h => {
      const m = mas.find(x => x.id === h.mid), p = m ? props.find(x => x.id === m.pid) : null;
      const diff = Math.ceil((new Date(h.prox) - today) / (86400000));
      return { h, m, p, diff };
    }).filter(x => x.diff >= 0 && x.diff <= 60).sort((a, b) => a.diff - b.diff);
    de.innerHTML = d.length ? d.map(({ h, m, p }) => `
      <div class="rec-card"><div class="rec-ic" style="background:#e0f2f1">🦟</div>
      <div class="rec-info"><div class="rec-title">${m ? EI(m.esp) + ' ' + m.nombre : '—'}</div>
      <div class="rec-sub">${p ? p.nombre + ' · ' + p.telefono : ''}</div></div>
      <div class="rec-date">${h.prox}</div></div>`).join('')
    : `<div class="empty-state"><div class="empty-ic">🦟</div><div class="empty-s">Sin desparasitaciones próximas</div></div>`;
  }

  // Controles
  const ce = document.getElementById('rec-ctrl');
  if (ce) {
    const c = hist.filter(h => h.prox && h.tipo !== 'vacunacion' && h.tipo !== 'desparasitacion').map(h => {
      const m = mas.find(x => x.id === h.mid), p = m ? props.find(x => x.id === m.pid) : null;
      const diff = Math.ceil((new Date(h.prox) - today) / (86400000));
      return { h, m, p, diff };
    }).filter(x => x.diff >= 0 && x.diff <= 90).sort((a, b) => a.diff - b.diff);
    ce.innerHTML = c.length ? `<table><thead><tr><th>Mascota</th><th>Propietario</th><th>Tipo</th><th>Fecha</th><th>Días</th><th>WhatsApp</th></tr></thead><tbody>
    ${c.map(({ h, m, p, diff }) => `<tr>
      <td>${m ? EI(m.esp) + ' ' + m.nombre : '—'}</td>
      <td>${p ? p.nombre : '—'}</td>
      <td><span class="badge bg-teal">${HLBL[h.tipo] || h.tipo}</span></td>
      <td class="cs">${h.prox}</td>
      <td><span class="badge ${diff <= 7 ? 'bg-red' : diff <= 15 ? 'bg-yellow' : 'bg-green'}">${diff} días</span></td>
      <td>${p && p.telefono ? `<a href="https://wa.me/${p.telefono.replace(/\D/g, '')}?text=Hola+${encodeURIComponent(p.nombre)}%2C+le+recordamos+el+control+de+${encodeURIComponent(m ? m.nombre : '')}+para+el+${encodeURIComponent(h.prox)}+en+VitalVet.+📞+3103314665" target="_blank" class="btn btn-green btn-xs">📲 Recordar</a>` : '—'}</td>
    </tr>`).join('')}</tbody></table>`
    : `<div class="empty-state"><div class="empty-ic">📅</div><div class="empty-s">Sin controles próximos</div></div>`;
  }
}
