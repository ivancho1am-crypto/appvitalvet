// Pestaña Estadísticas dentro del panel clínico.
//
// Reutiliza tal cual el motor del panel grande (js/estadisticas-core.js): los
// mismos cálculos y los mismos 13 gráficos. Aquí solo se decide CUÁNDO recalcular.
//
// No hay nada programado ni ninguna petición de red: los datos ya están en
// memoria, porque la app los carga al iniciar sesión y los mantiene al día.
// Calcular los agregados de ~600 mascotas y ~1.600 registros toma milisegundos,
// así que se recalcula entero en vez de llevar contadores incrementales, que
// habría que mantener sincronizados en cada alta, edición y borrado — más
// código, más formas de que se desajuste, y ninguna ganancia perceptible.
//
// Los grupos de edad se derivan de la fecha de nacimiento contra la fecha de
// HOY, así que una mascota cambia de grupo sola al cumplir años. No hace falta
// ningún proceso que recorra la base para actualizarlos.

let _statsPintadas = false;   // ¿ya se dibujaron alguna vez?
let _statsAlDia    = false;   // ¿siguen valiendo, o cambiaron los datos?

function _tabEstadisticasVisible() {
  const pg = document.getElementById('page-estadisticas');
  return pg && pg.classList.contains('on');
}

// Recalcula y redibuja. Se llama al abrir la pestaña, y tras guardar si está
// abierta en ese momento.
function renderEstadisticas() {
  if (typeof Chart === 'undefined' || typeof buildData !== 'function') return;
  try {
    DATA = buildData(DB.get('props'), DB.get('mas'), DB.get('hist'));
    updateKPIs();
    initCharts();
    _statsPintadas = true;
    _statsAlDia = true;
    const sello = document.getElementById('stats-sello');
    if (sello) {
      sello.textContent = 'Calculado ' + new Date().toLocaleString('es-CO',
        { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' +
        DATA.mascotas + ' pacientes · ' + DATA.historial + ' registros';
    }
  } catch (e) {
    console.warn('[estadisticas] no pude calcular:', e);
  }
}

// La llama go() al entrar a la pestaña. Si nada cambió desde la última vez, no
// se redibuja: no tiene sentido rehacer 13 gráficos para mostrar lo mismo.
function abrirEstadisticas() {
  if (!_statsPintadas || !_statsAlDia) renderEstadisticas();
}

// La llama rStats(), que ya se ejecuta tras cada alta, edición y borrado.
// Si la pestaña está a la vista, se actualiza al instante; si no, se marca y se
// recalcula cuando el usuario entre. Así guardar un paciente nunca paga el coste
// de redibujar una pantalla que nadie está mirando.
function marcarEstadisticasDesactualizadas() {
  _statsAlDia = false;
  if (_tabEstadisticasVisible()) renderEstadisticas();
}
