// Navegación entre tabs y estadísticas globales
function go(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  const pg = document.getElementById('page-' + page); if (pg) pg.classList.add('on');
  if (btn) btn.classList.add('on');
  if (page === 'informes') { rInfProp(); rInfMas(); rStats() }
  if (page === 'recordatorios') rRecordatorios();
  if (page === 'cotizacion') rCotizacion();
  // Las estadísticas se calculan al entrar, con los datos que ya están en
  // memoria. Si nada cambió desde la última vez, no se redibujan (ver
  // js/estadisticas-tab.js).
  if (page === 'estadisticas') abrirEstadisticas();
  // Inicio: recalcular al entrar, igual que Informes/Estadísticas.
  if (page === 'inicio' && typeof rDashboard === 'function') rDashboard();
  // Agenda: igual que Informes/Estadísticas, se recalcula al entrar.
  if (page === 'agenda' && typeof rAgenda === 'function') rAgenda();
  // Inventario: igual que Agenda, se recalcula al entrar.
  if (page === 'inventario' && typeof rInventario === 'function') rInventario();
  // Finanzas: igual que Agenda/Inventario, se recalcula al entrar. Sin badge
  // en el sidebar (a diferencia de Agenda/Inventario): un balance no reduce
  // bien a un contador chico, y mostrar solo un número sin signo/contexto
  // confundiría más de lo que ayuda.
  if (page === 'finanzas' && typeof rFinanzas === 'function') rFinanzas();
  // Ventas: igual que los demás, se recalcula al entrar.
  if (page === 'ventas' && typeof rVentas === 'function') rVentas();
  // Marketing: sin red, se recalcula al entrar igual que los demás —
  // acá el "recalcular" es puramente local (DB.get), nunca Supabase.
  if (page === 'marketing' && typeof rMarketing === 'function') rMarketing();
}

function boot() {
  updSelects(); rProp(); rMas(); rHistList(); rSeg(); rRecordatorios(); rCotizacion(); rInfProp(); rInfMas(); rStats();
  if (typeof rDashboard === 'function') rDashboard();
  // Solo el contador del sidebar (citas de hoy / bajo stock), no la lista
  // completa: la lista se calcula recién cuando se entra a la pestaña (arriba
  // en go()).
  if (typeof _actualizarBadge === 'function') _actualizarBadge();
  if (typeof _invActualizarBadge === 'function') _invActualizarBadge();
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

  // rStats() ya se ejecuta tras cada alta, edición y borrado, así que es el
  // punto natural para avisar a la pestaña de Estadísticas. Si está a la vista
  // se recalcula al instante; si no, se marca y se recalcula al abrirla. Así no
  // hace falta nada programado preguntando cada tanto si algo cambió.
  if (typeof marcarEstadisticasDesactualizadas === 'function') marcarEstadisticasDesactualizadas();
}
