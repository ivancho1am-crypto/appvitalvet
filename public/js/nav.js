// Navegación entre tabs y estadísticas globales
function go(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  const pg = document.getElementById('page-' + page); if (pg) pg.classList.add('on');
  if (btn) btn.classList.add('on');
  if (page === 'informes') { rInfProp(); rInfMas(); rStats() }
  if (page === 'recordatorios') rRecordatorios();
  if (page === 'cotizacion') rCotizacion();
}

function boot() {
  updSelects(); rProp(); rMas(); rHistList(); rSeg(); rRecordatorios(); rCotizacion(); rInfProp(); rInfMas(); rStats();
}

function rStats() {
  const p = DB.get('props'), m = DB.get('mas'), h = DB.get('hist'), s = DB.get('segs').filter(x => x.activo);
  ['cnt-p', 'i-p'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = p.length });
  ['cnt-m', 'i-m'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = m.length });
  const ib = document.getElementById('i-h'); if (ib) ib.textContent = h.length;
  ['i-s'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = s.length });
  ['seg-n'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = s.length });
  const sb = document.getElementById('seg-badge'); if (sb) sb.textContent = `🏥 ${s.length} en seguimiento`;
  const bp = document.getElementById('cnt-prop-badge'); if (bp) bp.textContent = p.length;
  // gráfico por especie
  const re = document.getElementById('rep-esp');
  if (re) {
    const ec = {}; m.forEach(x => { ec[x.esp] = (ec[x.esp] || 0) + 1 });
    const cols = { canino: '#22aa86', felino: '#0071e2', equino: '#ff9800', exotico: '#c434d1', otro: '#7e57c2' };
    re.innerHTML = Object.entries(ec).map(([e, cnt]) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span>${EI(e)} <span style="text-transform:capitalize">${e}</span></span><strong>${cnt}</strong></div>
        <div style="height:6px;background:var(--g200);border-radius:4px">
          <div style="height:6px;background:${cols[e] || '#22aa86'};border-radius:4px;width:${m.length ? Math.round(cnt / m.length * 100) : 0}%"></div>
        </div></div>`).join('') || '<p style="color:var(--g500);font-size:12px">Sin datos</p>';
  }
}
