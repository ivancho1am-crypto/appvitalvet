// Módulo: Inicio (Dashboard)
//
// Esta página no tiene backend propio ni colección propia en DB. Todo lo que
// pinta sale de DB.get() sobre las mismas colecciones que ya usan los demás
// módulos (props/mas/hist/segs). Es solo lectura: rDashboard() nunca llama a
// DB.set(), nunca abre un modal por su cuenta, nunca inserta un registro.
//
// Se llama desde boot() (arranque y "Sincronizar") y desde go('inicio', ...)
// en nav.js — ver esos dos puntos de enganche.

// ── Saludo con la sesión real de Supabase Auth ──────────────────────────
// No hardcodeamos un nombre: mostramos el correo con el que se inició sesión,
// que sí sale de Supabase Auth. auth.js/app.js ya piden la sesión al cargar;
// aquí solo la leemos, sin tocar su flujo.
async function _rSaludo() {
  const el = document.getElementById('dash-saludo');
  if (!el) return;
  const h = new Date().getHours();
  const franja = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  let quien = '';
  try {
    const sb = getSB();
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user && session.user.email) quien = ' · ' + session.user.email;
    }
  } catch (e) { /* sin sesión todavía: se queda solo el saludo */ }
  el.textContent = franja + ' 👋' + quien;
}

// ── KPIs ──────────────────────────────────────────────────────────────
function _rKPIs(props, mas, hist, segsActivos) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dash-kpi-props', props.length);
  set('dash-kpi-mas', mas.length);
  set('dash-kpi-hist', hist.length);
  set('dash-kpi-segs', segsActivos.length);
}

// ── Seguimiento: resumen (el módulo completo vive en seguimiento.js/rSeg()) ──
function _rSegResumen(segsActivos) {
  const el = document.getElementById('dash-seg-resumen'); if (!el) return;
  if (!segsActivos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-s">Sin pacientes en seguimiento</div></div>';
    return;
  }
  const hosp = segsActivos.filter(s => s.tipo === 'hospitalizacion').length;
  const amb = segsActivos.length - hosp;
  const diasProm = Math.round(segsActivos.reduce((a, s) => a + (s.dia || 0), 0) / segsActivos.length);
  el.innerHTML = `
    <div class="mini-stat-row">
      <div class="mini-stat"><div class="ms-val">${segsActivos.length}</div><div class="ms-lbl">Activos</div></div>
      <div class="mini-stat"><div class="ms-val">${hosp}</div><div class="ms-lbl">Hospitalización</div></div>
      <div class="mini-stat"><div class="ms-val">${amb}</div><div class="ms-lbl">Ambulatorio</div></div>
      <div class="mini-stat"><div class="ms-val">${diasProm || 0}</div><div class="ms-lbl">Días prom.</div></div>
    </div>`;
}

// ── Recordatorios: resumen (el detalle completo vive en rRecordatorios()) ──
// Mismos criterios que recordatorios.js: vacunas/desparasitaciones con
// h.prox en 0-60 días. Aquí solo se cuentan y se listan los 3 más próximos.
function _rRecResumen(mas, props, hist) {
  const el = document.getElementById('dash-rec-resumen'); if (!el) return;
  const today = new Date();
  const proximos = (tipo) => hist.filter(h => h.tipo === tipo && h.prox).map(h => {
    const diff = Math.ceil((new Date(h.prox) - today) / 86400000);
    return { h, diff };
  }).filter(x => x.diff >= 0 && x.diff <= 60);

  const vac = proximos('vacunacion'), desp = proximos('desparasitacion');
  const top = [...vac, ...desp].sort((a, b) => a.diff - b.diff).slice(0, 3);

  const cabecera = `
    <div class="mini-stat-row">
      <div class="mini-stat"><div class="ms-val">${vac.length}</div><div class="ms-lbl">💉 Vacunas</div></div>
      <div class="mini-stat"><div class="ms-val">${desp.length}</div><div class="ms-lbl">🦟 Desparasit.</div></div>
    </div>`;

  if (!top.length) { el.innerHTML = cabecera + '<div class="empty-state" style="padding:8px"><div class="empty-s">Sin recordatorios en 60 días</div></div>'; return; }

  el.innerHTML = cabecera + top.map(({ h, diff }) => {
    const m = mas.find(x => x.id === h.mid), p = m ? props.find(x => x.id === m.pid) : null;
    return `<div class="recent-row" onclick="go('recordatorios',document.querySelector('.sidebar-item[onclick*=recordatorios]'))">
      <div class="recent-ic">${h.tipo === 'vacunacion' ? '💉' : '🦟'}</div>
      <div class="recent-info">
        <div class="recent-name">${m ? EI(m.esp) + ' ' + m.nombre : '—'}</div>
        <div class="recent-sub">${p ? p.nombre : ''}</div>
      </div>
      <div class="recent-when">${diff === 0 ? 'Hoy' : diff + ' d'}</div>
    </div>`;
  }).join('');
}

// ── Pacientes recientes ──────────────────────────────────────────────────
// `created` es un texto tipo "30/9/2026" (sin ceros, sin hora): no ordena
// cronológicamente bien como string. El id sí sirve — 'm' + Date.now() — así
// que se ordena por ahí. No se inventa ningún dato: se deriva de lo que ya
// existe en cada registro.
function _rRecientes(mas, props) {
  const el = document.getElementById('dash-recientes'); if (!el) return;
  if (!mas.length) { el.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-s">Sin mascotas registradas</div></div>'; return; }
  const ts = m => parseInt(String(m.id).replace(/^\D+/, ''), 10) || 0;
  const recientes = [...mas].sort((a, b) => ts(b) - ts(a)).slice(0, 6);
  el.innerHTML = recientes.map(m => {
    const p = props.find(x => x.id === m.pid);
    return `<div class="recent-row" onclick="openHist('${m.id}')">
      <div class="recent-ic">${EI(m.esp)}</div>
      <div class="recent-info">
        <div class="recent-name">${m.nombre}</div>
        <div class="recent-sub">${m.esp}${m.raza ? ' · ' + m.raza : ''} · ${p ? p.nombre : 'Sin propietario'}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Actividad reciente ────────────────────────────────────────────────────
// Se deriva mezclando los últimos registros de props/mas/hist/segs por su
// timestamp embebido en el id. No existe (ni se crea) una tabla de auditoría:
// es una lectura combinada de lo que ya hay.
function _rActividad(props, mas, hist, segs) {
  const el = document.getElementById('dash-actividad'); if (!el) return;
  const ts = x => parseInt(String(x.id).replace(/^\D+/, ''), 10) || 0;
  const eventos = [
    ...props.map(p => ({ t: ts(p), ic: '👤', txt: `Nuevo propietario: <strong>${p.nombre}</strong>` })),
    ...mas.map(m => ({ t: ts(m), ic: '🐾', txt: `Nueva mascota: <strong>${m.nombre}</strong>` })),
    ...hist.map(h => ({ t: ts(h), ic: '📋', txt: `Nueva entrada de historia (${HLBL[h.tipo] || h.tipo})` })),
    ...segs.map(s => ({ t: ts(s), ic: '🏥', txt: `Nuevo seguimiento registrado` })),
  ].filter(e => e.t > 0).sort((a, b) => b.t - a.t).slice(0, 8);

  if (!eventos.length) { el.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-s">Sin actividad todavía</div></div>'; return; }

  el.innerHTML = eventos.map(e => {
    const d = new Date(e.t);
    const cuando = isNaN(d) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return `<div class="activity-row"><div class="activity-dot"></div>
      <div><div class="activity-txt">${e.ic} ${e.txt}</div><div class="activity-when">${cuando}</div></div></div>`;
  }).join('');
}

// ── Distribución por especie ────────────────────────────────────────────
// Ojo: NO es #rep-esp (ese id ya existe y está en uso real en Informes,
// pintado por rStats() en nav.js — lo confirmé al ver un id duplicado antes
// de probar esto). Este widget tiene su propio id y su propio render, del
// mismo patrón visual, para no tocar rStats() ni pisar ese otro elemento.
function _rEspecies(mas) {
  const el = document.getElementById('dash-especies'); if (!el) return;
  if (!mas.length) { el.innerHTML = '<div class="empty-state" style="padding:8px"><div class="empty-s">Sin mascotas registradas</div></div>'; return; }
  const cols = { canino: '#22aa86', felino: '#0071e2', equino: '#ff9800', exotico: '#c434d1', otro: '#7e57c2' };
  const conteo = {}; mas.forEach(m => { conteo[m.esp] = (conteo[m.esp] || 0) + 1 });
  el.innerHTML = Object.entries(conteo).sort((a, b) => b[1] - a[1]).map(([esp, cnt]) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span>${EI(esp)} <span style="text-transform:capitalize">${esp}</span></span><strong>${cnt}</strong></div>
      <div style="height:6px;background:var(--line);border-radius:4px">
        <div style="height:6px;background:${cols[esp] || '#22aa86'};border-radius:4px;width:${Math.round(cnt / mas.length * 100)}%"></div>
      </div></div>`).join('');
}

// ── Orquestador ───────────────────────────────────────────────────────────
function rDashboard() {
  const props = DB.get('props'), mas = DB.get('mas'), hist = DB.get('hist');
  const segsActivos = DB.get('segs').filter(s => s.activo);

  _rSaludo();
  _rKPIs(props, mas, hist, segsActivos);
  _rSegResumen(segsActivos);
  _rRecResumen(mas, props, hist);
  _rRecientes(mas, props);
  _rActividad(props, mas, hist, DB.get('segs'));
  _rEspecies(mas);

  // Espejo relacional: chequeo silencioso una sola vez por sesión, y
  // desprendido (setTimeout dentro) — no puede retrasar ni romper este
  // render ni el arranque. Solo avisa si algo quedó sin llegar a las tablas;
  // reparar siempre lo decide la persona. Ver js/espejo-verificar.js.
  if (typeof espejoChequeoSilencioso === 'function') espejoChequeoSilencioso();
}

// ── Sidebar: colapsar/expandir (desktop) y drawer (móvil) ─────────────────
// Puramente visual — no toca datos ni navegación.
function toggleSidebar() {
  const sb = document.getElementById('app-sidebar');
  if (!sb) return;
  if (window.innerWidth <= 768) { sb.classList.toggle('mobile-open'); return; }
  sb.classList.toggle('collapsed');
  try { localStorage.setItem('vv_sidebar_collapsed', sb.classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
}
(function () {
  try {
    if (localStorage.getItem('vv_sidebar_collapsed') === '1' && window.innerWidth > 768) {
      document.addEventListener('DOMContentLoaded', () => {
        const sb = document.getElementById('app-sidebar');
        if (sb) sb.classList.add('collapsed');
      });
    }
  } catch (e) {}
})();

// ── Buscador global (topbar) ───────────────────────────────────────────────
// Solo lectura sobre props/mas ya cargados. No es una ruta ni un módulo
// nuevo: reutiliza openHist()/selProp() que ya existen.
function globalSearch(q) {
  const el = document.getElementById('global-search-results');
  if (!el) return;
  q = (q || '').trim().toLowerCase();
  if (!q) { el.classList.remove('show'); return; }

  const props = DB.get('props').filter(p => p.nombre.toLowerCase().includes(q) || p.cedula.includes(q)).slice(0, 5);
  const mas = DB.get('mas').filter(m => m.nombre.toLowerCase().includes(q)).slice(0, 5);

  if (!props.length && !mas.length) {
    el.innerHTML = '<div class="app-search-row" style="cursor:default;color:var(--ink-2)">Sin resultados</div>';
    el.classList.add('show'); return;
  }

  el.innerHTML =
    props.map(p => `<div class="app-search-row" onmousedown="irAPropietario('${p.id}','${p.nombre.replace(/'/g, "\\'")}')">👤 ${p.nombre}<span class="asr-tag">${p.cedula}</span></div>`).join('') +
    mas.map(m => `<div class="app-search-row" onmousedown="irAMascota('${m.id}')">${EI(m.esp)} ${m.nombre}<span class="asr-tag">mascota</span></div>`).join('');
  el.classList.add('show');
}

// Ir a un propietario desde el buscador: reutiliza el propio filtro de la
// pestaña Propietarios (rProp + su input), no el modal de "nueva mascota"
// (selProp() es para esa otra cosa y habría abierto un modal inesperado).
function irAPropietario(pid, nombre) {
  go('propietario', document.querySelector('.sidebar-item[onclick*=propietario]'));
  setTimeout(() => {
    const filtro = document.querySelectorAll('#page-propietario input[type="text"]')[1]; // "Filtrar..." de la tabla
    if (filtro) { filtro.value = nombre; rProp(nombre); }
  }, 60);
}

// Ir a una mascota desde el buscador: mismo patrón que abrirHist() en
// propietarios.js (cambia de pestaña y luego abre la historia).
function irAMascota(mid) {
  go('historia', document.querySelector('.sidebar-item[onclick*=historia]'));
  setTimeout(() => openHist(mid), 200);
}
