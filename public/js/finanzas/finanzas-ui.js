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

  let facturas, resumenFacturas, gastos, ventas;
  try {
    [facturas, resumenFacturas, gastos, ventas] = await Promise.all([
      FinanzasRepo.listarFacturas(desdeFecha, hastaFecha),
      FinanzasRepo.resumenFacturasEnRango(desdeFecha, hastaFecha),
      FinanzasRepo.listarGastos(desdeFecha, hastaFecha),
      // Ventas directas: tabla aparte (VentasRepo, no FinanzasRepo), mismo
      // criterio ya usado al revés en ventas-ui.js (llama a FinanzasRepo
      // directo). Si el módulo Ventas no estuviera cargado, no rompe nada.
      typeof VentasRepo !== 'undefined' ? VentasRepo.listarVentas(desdeFecha, hastaFecha) : Promise.resolve([]),
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
  resumen.ventasDirectas = finSumarVentasDirectas(ventas);

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
  // Ventas directas: aparte de los 4 de arriba a propósito — "cobrado" tiene
  // que seguir coincidiendo exacto con finanzas_resumen_*. El combinado de
  // abajo es solo una suma visual, no un número que se guarde en ningún lado.
  setVal('fin-kpi-ventas', r.ventasDirectas);
  setVal('fin-total-cobrado-real', r.cobrado + r.ventasDirectas);
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
    <thead><tr><th>Número</th><th>Fecha</th><th>Facturado</th><th>Cobrado</th><th>Por cobrar</th><th>Estado</th><th>Acciones</th></tr></thead>
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
        <td style="white-space:nowrap">
          ${saldo > 0 ? `<button class="btn btn-outline btn-xs" onclick="finAbrirPago('${f.id}',${saldo})">💰 Pago</button>` : ''}
          <button class="btn btn-outline btn-xs" onclick="finVerPagos('${f.id}','${f.numero || ''}')">🕓</button>
        </td>
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

// ── Modal "Registrar pago" (Ciclo 4) ───────────────────────────────────────
// `facturaId`/`saldoPendiente` vienen del botón de la fila (ver
// _finRenderFacturas) — el monto se prellena con el saldo completo, el caso
// más común (pago total), pero queda editable para pagos parciales.
async function finAbrirPago(facturaId, saldoPendiente) {
  document.getElementById('fin-pago-factura-id').value = facturaId;
  document.getElementById('fin-pago-saldo').value = saldoPendiente;
  document.getElementById('fin-p-monto').value = saldoPendiente;
  document.getElementById('fin-p-metodo').value = 'efectivo';
  document.getElementById('fin-p-referencia').value = '';
  document.getElementById('fin-p-nota').value = '';
  const hoy = new Date();
  document.getElementById('fin-p-fecha').value =
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}T${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}`;

  const sel = document.getElementById('fin-p-cuenta');
  sel.innerHTML = '<option value="">Cargando cuentas…</option>';
  openM('m-fin-pago');
  try {
    const cuentas = await FinanzasRepo.listarCuentas();
    sel.innerHTML = cuentas.length
      ? '<option value="">Selecciona cuenta</option>' + cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.tipo})</option>`).join('')
      : '<option value="">Sin cuentas creadas todavía</option>';
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudieron cargar las cuentas</option>';
    console.warn('[finanzas] listarCuentas:', e);
  }
}

async function finGuardarPago() {
  const facturaId = document.getElementById('fin-pago-factura-id').value;
  const saldoPendiente = parseFloat(document.getElementById('fin-pago-saldo').value) || 0;
  const { error, fila } = finConstruirPago({
    facturaId,
    cuentaId: document.getElementById('fin-p-cuenta').value,
    monto: document.getElementById('fin-p-monto').value,
    metodo: document.getElementById('fin-p-metodo').value,
    fecha: document.getElementById('fin-p-fecha').value,
    referencia: document.getElementById('fin-p-referencia').value,
    nota: document.getElementById('fin-p-nota').value,
    saldoPendiente,
  });
  if (error) { toast(error, 'err'); return; }

  const btn = document.getElementById('fin-p-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    await FinanzasRepo.crearPago(fila);
    toast('Pago registrado ✓', 'ok');
    closeM('m-fin-pago');
    rFinanzas();   // cobrado/por_cobrar salen solos al releer las vistas
  } catch (e) {
    toast('No se pudo registrar el pago', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Registrar pago' }
  }
}

// ── Modal "Historial de pagos" de una factura (solo lectura) ──────────────
async function finVerPagos(facturaId, numero) {
  document.getElementById('m-fin-pagos-titulo').textContent = `🕓 Pagos — ${numero || 'factura'}`;
  const cont = document.getElementById('fin-pagos-lista');
  cont.innerHTML = '<div class="empty-s">Cargando…</div>';
  openM('m-fin-pagos');
  let pagos;
  try { pagos = await FinanzasRepo.pagosDeFactura(facturaId); }
  catch (e) { cont.innerHTML = '<div class="empty-s">No se pudo cargar el historial</div>'; console.warn(e); return; }
  if (!pagos.length) { cont.innerHTML = '<div class="empty-s">Sin pagos registrados todavía</div>'; return; }
  cont.innerHTML = pagos.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--g200)${p.anulado ? ';opacity:.5' : ''}">
      <div>
        <div style="font-size:12px">${FIN_METODOS_PAGO[p.metodo] || p.metodo}${p.referencia ? ' — ' + p.referencia : ''}${p.anulado ? ' (ANULADO)' : ''}</div>
        <div style="font-size:11px;color:var(--g500)">${new Date(p.fecha).toLocaleString('es-CO')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge bg-green">${fmt$(p.monto)}</span>
        ${!p.anulado ? `<button class="btn btn-outline btn-xs" onclick="finAnularPago('${p.id}','${facturaId}','${(numero || '').replace(/'/g, "\\'")}')">🚫</button>` : ''}
      </div>
    </div>`).join('');
}

async function finAnularPago(id, facturaId, numero) {
  if (!confirm('¿Anular este pago? El saldo pendiente de la factura vuelve a subir.')) return;
  try {
    await FinanzasRepo.anularPago(id);
    toast('Pago anulado ✓', 'ok');
    finVerPagos(facturaId, numero);   // refresca el historial abierto
    rFinanzas();                      // y los KPIs/tabla de atrás
  } catch (e) { toast('No se pudo anular el pago', 'err'); console.warn(e); }
}
