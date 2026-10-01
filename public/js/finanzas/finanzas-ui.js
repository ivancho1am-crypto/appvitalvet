// Módulo: Finanzas — pantalla
//
// Llama a FinanzasRepo (datos) y a las funciones fin* (reglas), nunca habla
// con Supabase directo. Mismo patrón que agenda-ui.js / inventario-ui.js.
//
// Ciclo 3 (v1.2): deja de interpretar `facturas.total` como dinero cobrado.
// Ahora muestra FACTURADO / COBRADO / POR COBRAR / GASTOS, leídos de
// finanzas_resumen_facturas y finanzas_resumen_mensual — nunca calculados
// a mano sobre facturas.total. Todavía NO se registra ningún pago desde
// acá (eso es el siguiente ciclo) — esta pantalla es de solo lectura para
// lo financiero, salvo Gastos, que ya existía.

let FIN_VISTA = 'mes';          // 'dia' | 'semana' | 'mes'
let FIN_CACHE_GASTOS = [];      // último listarGastos() — para prellenar el modal de editar

// ── Render principal — lo llama go('finanzas', ...) en nav.js ──────────────
async function rFinanzas() {
  const cont = document.getElementById('fin-gastos-tabla'); if (!cont) return;
  cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-s">Cargando…</div></div>';
  const facCont = document.getElementById('fin-facturas-tabla');
  if (facCont) facCont.innerHTML = '';

  const { desde, hasta } = FIN_VISTA === 'dia' ? finRangoDia() : FIN_VISTA === 'semana' ? finRangoSemana() : finRangoMes();
  const desdeFecha = _finSoloFecha(desde), hastaFecha = _finSoloFecha(hasta);
  const fEl = document.getElementById('fin-rango-actual');
  if (fEl) fEl.textContent = `${desde.toLocaleDateString('es-CO')} – ${hasta.toLocaleDateString('es-CO')}`;

  let facturas, resumenFacturas, gastos;
  try {
    [facturas, resumenFacturas, gastos] = await Promise.all([
      FinanzasRepo.listarFacturas(desdeFecha, hastaFecha),
      FinanzasRepo.resumenFacturasEnRango(desdeFecha, hastaFecha),
      FinanzasRepo.listarGastos(desdeFecha, hastaFecha),
    ]);
  } catch (e) {
    console.warn('[finanzas] rFinanzas:', e);
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div>
      <div class="empty-t">No se pudo cargar Finanzas</div>
      <div class="empty-s">Verifica tu conexión e intenta de nuevo</div></div>`;
    return;
  }

  // KPIs: en "Este mes" se prefiere finanzas_resumen_mensual (ya agregada en
  // Supabase). Si ese mes todavía no tiene fila (tablas financieras en 0
  // registros, por ejemplo) o la consulta falla, se cae al cálculo por
  // factura de abajo — nunca se inventa un número.
  let resumen = null;
  if (FIN_VISTA === 'mes') {
    try {
      const filaMes = await FinanzasRepo.resumenMensual(finPrimerDiaMes());
      if (filaMes) {
        resumen = {
          facturado: parseFloat(filaMes.facturado) || 0,
          cobrado:   parseFloat(filaMes.cobrado) || 0,
          porCobrar: parseFloat(filaMes.por_cobrar) || 0,
          gastos:    parseFloat(filaMes.gastos) || 0,
        };
      }
    } catch (e) { console.warn('[finanzas] resumenMensual:', e); }
  }
  if (!resumen) resumen = { ...finSumarResumenFacturas(resumenFacturas), gastos: finSumarGastos(gastos) };

  FIN_CACHE_GASTOS = gastos;
  _finRenderResumen(resumen);
  _finRenderFacturas(facturas, resumenFacturas);
  _finRenderGastos(gastos);
}

function _finSoloFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _finRenderResumen(r) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt$(val) };
  setVal('fin-kpi-facturado', r.facturado);
  setVal('fin-kpi-cobrado', r.cobrado);
  setVal('fin-kpi-porcobrar', r.porCobrar);
  setVal('fin-kpi-gastos', r.gastos);
}

// `resumenFacturas` trae cobrado/saldo_pendiente por factura_id — se cruza
// acá con la lista cruda (que trae `numero`, el folio legible) para no pedir
// dos veces lo mismo ni duplicar el cálculo.
function _finRenderFacturas(facturas, resumenFacturas) {
  const cont = document.getElementById('fin-facturas-tabla'); if (!cont) return;
  if (!facturas.length) {
    cont.innerHTML = '<p style="color:var(--g500);font-size:12px;padding:8px 0">Sin facturas emitidas en este rango</p>';
    return;
  }
  const resumenPorId = {}; resumenFacturas.forEach(r => { resumenPorId[r.factura_id] = r });
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Número</th><th>Fecha</th><th>Facturado</th><th>Cobrado</th><th>Por cobrar</th><th>Estado</th></tr></thead>
    <tbody>${facturas.map(f => {
      const r = resumenPorId[f.id];
      // Si la vista todavía no trae esta factura (debería ser rarísimo, pero
      // por las dudas), se asume sin cobrar — nunca al revés.
      const cobrado = r ? (parseFloat(r.cobrado) || 0) : 0;
      const saldo = r ? (parseFloat(r.saldo_pendiente) || 0) : (parseFloat(f.total) || 0);
      return `<tr>
        <td>${f.numero || '—'}</td>
        <td>${new Date(f.fecha || f.created_at).toLocaleDateString('es-CO')}</td>
        <td>${fmt$(f.total)}</td>
        <td>${fmt$(cobrado)}</td>
        <td><span class="badge ${saldo > 0 ? 'bg-yellow' : 'bg-green'}">${fmt$(saldo)}</span></td>
        <td><span class="badge bg-gray">${f.estado || 'emitida'}</span></td>
      </tr>`;
    }).join('')}</tbody>
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
          <button class="btn btn-outline btn-xs" onclick="finAnularGasto('${g.id}')">🚫 Anular</button>
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

// Reemplaza al antiguo finEliminarGasto: ahora anula en vez de borrar (ver
// FinanzasRepo.anularGasto), para no perder el rastro de auditoría.
async function finAnularGasto(id) {
  if (!confirm('¿Anular este gasto? Deja de contar en los totales, pero el registro se conserva.')) return;
  try {
    await FinanzasRepo.anularGasto(id);
    toast('Gasto anulado ✓', 'ok');
    rFinanzas();
  } catch (e) { toast('No se pudo anular el gasto', 'err'); console.warn(e); }
}
