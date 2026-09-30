// Módulo: Finanzas — pantalla
//
// Llama a FinanzasRepo (datos) y a las funciones fin* (reglas), nunca habla
// con Supabase directo. Mismo patrón que agenda-ui.js / inventario-ui.js.
//
// Toda llamada a Supabase va en try/catch desde el principio (lección de
// Agenda: sin esto, una falla de red deja la pantalla en "Cargando…" o un
// botón trabado en "Guardando…").

let FIN_VISTA = 'mes';          // 'dia' | 'semana' | 'mes'
let FIN_CACHE_GASTOS = [];      // último listarGastos() — para prellenar el modal de editar

// ── Render principal — lo llama go('finanzas', ...) en nav.js ──────────────
async function rFinanzas() {
  const cont = document.getElementById('fin-gastos-tabla'); if (!cont) return;
  cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-s">Cargando…</div></div>';
  const facCont = document.getElementById('fin-facturas-tabla');
  if (facCont) facCont.innerHTML = '';

  const { desde, hasta } = FIN_VISTA === 'dia' ? finRangoDia() : FIN_VISTA === 'semana' ? finRangoSemana() : finRangoMes();
  const fEl = document.getElementById('fin-rango-actual');
  if (fEl) fEl.textContent = `${desde.toLocaleDateString('es-CO')} – ${hasta.toLocaleDateString('es-CO')}`;

  let facturas, gastos;
  try {
    [facturas, gastos] = await Promise.all([
      FinanzasRepo.listarFacturas(desde.toISOString(), hasta.toISOString()),
      FinanzasRepo.listarGastos(_finSoloFecha(desde), _finSoloFecha(hasta)),
    ]);
  } catch (e) {
    console.warn('[finanzas] rFinanzas:', e);
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div>
      <div class="empty-t">No se pudo cargar Finanzas</div>
      <div class="empty-s">Verifica tu conexión e intenta de nuevo</div></div>`;
    return;
  }

  FIN_CACHE_GASTOS = gastos;
  _finRenderResumen(finCalcularResumen(facturas, gastos));
  _finRenderFacturas(facturas);
  _finRenderGastos(gastos);
}

function _finSoloFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _finRenderResumen(r) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt$(val) };
  setVal('fin-kpi-ingresos', r.ingresos);
  setVal('fin-kpi-gastos', r.gastos);
  setVal('fin-kpi-balance', r.balance);
  const card = document.getElementById('fin-kpi-balance-card');
  if (card) card.style.setProperty('--c', r.balance >= 0 ? 'var(--green)' : '#dc2626');
}

function _finRenderFacturas(facturas) {
  const cont = document.getElementById('fin-facturas-tabla'); if (!cont) return;
  if (!facturas.length) {
    cont.innerHTML = '<p style="color:var(--g500);font-size:12px;padding:8px 0">Sin facturas emitidas en este rango</p>';
    return;
  }
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Número</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
    <tbody>${facturas.map(f => `
      <tr>
        <td>${f.numero || '—'}</td>
        <td>${new Date(f.created_at).toLocaleDateString('es-CO')}</td>
        <td>${fmt$(f.total)}</td>
        <td><span class="badge bg-green">${f.estado || 'emitida'}</span></td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

function _finRenderGastos(gastos) {
  const cont = document.getElementById('fin-gastos-tabla'); if (!cont) return;
  if (!gastos.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:30px"><div class="empty-ic">💸</div>
      <div class="empty-t">Sin gastos registrados en este rango</div>
      <div class="empty-s">Usa "+ Nuevo gasto" para registrar el primero</div></div>`;
    return;
  }
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Acciones</th></tr></thead>
    <tbody>${gastos.map(g => `
      <tr>
        <td>${new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-CO')}</td>
        <td><span class="badge bg-gray">${finCategoriaLabel(g.categoria)}</span></td>
        <td>${g.descripcion || '—'}</td>
        <td>${fmt$(g.monto)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-outline btn-xs" onclick="finAbrirEditarGasto('${g.id}')">✎</button>
          <button class="btn btn-outline btn-xs" onclick="finEliminarGasto('${g.id}')">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

function fFinRango(tipo, btn) {
  FIN_VISTA = tipo;
  document.querySelectorAll('#page-finanzas .ftab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  rFinanzas();
}

// ── Modal "Nuevo/Editar gasto" ─────────────────────────────────────────────
function finAbrirNuevoGasto() {
  document.getElementById('fin-gasto-id').value = '';
  document.getElementById('m-fin-gasto-titulo').textContent = '💸 Nuevo gasto';
  document.getElementById('fin-g-cat').value = 'insumos';
  document.getElementById('fin-g-monto').value = '';
  document.getElementById('fin-g-desc').value = '';
  document.getElementById('fin-g-fecha').value = _finSoloFecha(new Date());
  openM('m-fin-gasto');
}

function finAbrirEditarGasto(id) {
  const g = FIN_CACHE_GASTOS.find(x => x.id === id);
  if (!g) { toast('Gasto no encontrado', 'err'); return; }
  document.getElementById('fin-gasto-id').value = g.id;
  document.getElementById('m-fin-gasto-titulo').textContent = '✎ Editar gasto';
  document.getElementById('fin-g-cat').value = g.categoria;
  document.getElementById('fin-g-monto').value = g.monto;
  document.getElementById('fin-g-desc').value = g.descripcion || '';
  document.getElementById('fin-g-fecha').value = g.fecha;
  openM('m-fin-gasto');
}

async function finGuardarGasto() {
  const id = document.getElementById('fin-gasto-id').value;
  const { error, fila } = finConstruirGasto({
    categoria: document.getElementById('fin-g-cat').value,
    monto: document.getElementById('fin-g-monto').value,
    descripcion: document.getElementById('fin-g-desc').value,
    fecha: document.getElementById('fin-g-fecha').value,
  });
  if (error) { toast(error, 'err'); return; }

  const btn = document.getElementById('fin-g-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    if (id) await FinanzasRepo.actualizarGasto(id, fila);
    else await FinanzasRepo.crearGasto(fila);
    toast(id ? 'Gasto actualizado ✓' : 'Gasto registrado ✓', 'ok');
    closeM('m-fin-gasto');
    rFinanzas();
  } catch (e) {
    toast('No se pudo guardar el gasto', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar' }
  }
}

async function finEliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto? No se puede deshacer.')) return;
  try {
    await FinanzasRepo.eliminarGasto(id);
    toast('Gasto eliminado ✓', 'ok');
    rFinanzas();
  } catch (e) { toast('No se pudo eliminar el gasto', 'err'); console.warn(e); }
}
