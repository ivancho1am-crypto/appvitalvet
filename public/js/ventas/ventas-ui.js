// Módulo: Ventas — pantalla
//
// Llama a VentasRepo (datos) y a las funciones venta* (reglas), nunca habla
// con Supabase directo. Mismo patrón que agenda/inventario/finanzas-ui.js.
//
// Reutiliza, sin tocarlos: InventarioRepo.listarProductos()/listarStock()
// (para el select de productos) y DB.get('procs') (catálogo de servicios
// que ya usa Cotizaciones) — Ventas no duplica esos catálogos.

let VENTAS_FECHA = new Date();      // día que se está viendo en el registro
let VENTA_ITEMS_ACTUAL = [];        // ítems agregados en el formulario, antes de guardar
let VENTAS_CACHE_PRODUCTOS = [];    // último listarProductos(), para el select del ítem

// ── Render principal — lo llama go('ventas', ...) en nav.js ────────────────
async function rVentas() {
  const cont = document.getElementById('ventas-lista'); if (!cont) return;
  cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-s">Cargando…</div></div>';

  const fEl = document.getElementById('ventas-fecha-actual');
  if (fEl) fEl.textContent = VENTAS_FECHA.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const fecha = _ventasSoloFecha(VENTAS_FECHA);
  let ventas;
  try {
    ventas = await VentasRepo.listarVentas(fecha, fecha);
  } catch (e) {
    console.warn('[ventas] rVentas:', e);
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div>
      <div class="empty-t">No se pudo cargar el registro de ventas</div>
      <div class="empty-s">Verifica tu conexión e intenta de nuevo</div></div>`;
    return;
  }

  if (!ventas.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">🛒</div>
      <div class="empty-t">Sin ventas registradas este día</div>
      <div class="empty-s">Usa "+ Nueva venta" para registrar la primera</div></div>`;
    return;
  }

  const totalDia = ventas.filter(v => !v.anulado).reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;color:var(--g500)">
      <span>${ventas.length} venta(s)</span><strong style="color:var(--navy)">Total del día: ${fmt$(totalDia)}</strong>
    </div>
    ${ventas.map(v => _renderVentaCard(v)).join('')}`;
}

function _ventasSoloFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _renderVentaCard(v) {
  const hora = new Date(v.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const quien = v.cliente_nombre || (v.propietario_id ? 'Propietario registrado' : 'Mostrador');
  return `<div class="ag-card" style="${v.anulado ? 'opacity:.5' : ''}">
    <div class="ag-card-hora">${hora}</div>
    <div class="ag-card-body">
      <div class="ag-card-top">
        <span class="ag-card-mascota">🛒 ${quien}${v.anulado ? ' (ANULADA)' : ''}</span>
        <span class="badge bg-green">${fmt$(v.total)}</span>
      </div>
      <div class="ag-card-sub">${(v.items || []).map(i => `${i.cantidad}× ${i.nombre}`).join(' · ') || 'Sin ítems'}</div>
      <div class="ag-card-sub">${VENTA_METODOS_PAGO[v.metodo_pago] || v.metodo_pago || ''}</div>
    </div>
    <div class="ag-card-acciones">
      ${!v.anulado ? `<button class="btn btn-outline btn-xs" onclick="ventaAnular('${v.id}')">🚫 Anular</button>` : ''}
    </div>
  </div>`;
}

function ventasDiaAnterior() { VENTAS_FECHA.setDate(VENTAS_FECHA.getDate() - 1); rVentas(); }
function ventasDiaSiguiente() { VENTAS_FECHA.setDate(VENTAS_FECHA.getDate() + 1); rVentas(); }
function ventasHoy() { VENTAS_FECHA = new Date(); rVentas(); }

async function ventaAnular(id) {
  if (!confirm('¿Anular esta venta? El inventario descontado NO se revierte automáticamente — si hace falta, ajustalo a mano en Inventario.')) return;
  try {
    await VentasRepo.anularVenta(id);
    toast('Venta anulada ✓', 'ok');
    rVentas();
  } catch (e) { toast('No se pudo anular la venta', 'err'); console.warn(e); }
}

// ── Modal "Nueva venta" ─────────────────────────────────────────────────────
function ventaAbrirNueva() {
  VENTA_ITEMS_ACTUAL = [];
  _ventaRenderItems();
  document.getElementById('venta-cliente-nombre').value = '';
  document.getElementById('venta-fecha').value = _ventasSoloFecha(new Date());
  document.getElementById('venta-metodo-pago').value = 'efectivo';

  const selProp = document.getElementById('venta-propietario');
  const props = DB.get('props');
  selProp.innerHTML = '<option value="">— Mostrador (sin registrar) —</option>' +
    props.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

  ventaCambiarTipoItem('producto');
  _ventaCargarServicios();
  openM('m-venta');

  // Cuenta (caja/banco) opcional — reusa FinanzasRepo, igual que ya se
  // reusa InventarioRepo acá abajo. Si no hay cuentas o falla, el select
  // queda en "Ninguna" sin bloquear el formulario (mismo criterio que
  // _invCargarCitasDelSelect en Inventario).
  (async () => {
    const selCta = document.getElementById('venta-cuenta');
    selCta.innerHTML = '<option value="">Ninguna</option>';
    try {
      const cuentas = await FinanzasRepo.listarCuentas();
      selCta.innerHTML += cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.tipo})</option>`).join('');
    } catch (e) { console.warn('[ventas] listarCuentas:', e); }
  })();

  VENTAS_CACHE_PRODUCTOS = [];
  (async () => {
    const selProd = document.getElementById('venta-item-producto');
    try {
      const [productos, stock] = await Promise.all([
        InventarioRepo.listarProductos(),
        InventarioRepo.listarStock(),
      ]);
      const stockPorId = {}; stock.forEach(s => { stockPorId[s.producto_id] = s.stock_actual });
      VENTAS_CACHE_PRODUCTOS = productos;
      selProd.innerHTML = '<option value="">Selecciona producto</option>' +
        productos.map(p => `<option value="${p.id}" data-precio="${p.precio_venta || 0}">${p.nombre} (stock: ${stockPorId[p.id] ?? '?'} ${p.unidad})</option>`).join('');
    } catch (e) {
      selProd.innerHTML = '<option value="">No se pudieron cargar los productos</option>';
      console.warn('[ventas] cargar productos:', e);
    }
  })();
}

function _ventaCargarServicios(seleccionarId) {
  const sel = document.getElementById('venta-item-servicio');
  const procs = DB.get('procs');
  sel.innerHTML = '<option value="">Selecciona servicio</option>' +
    procs.map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre}</option>`).join('') +
    '<option value="__nuevo__">+ Nuevo servicio…</option>';
  if (seleccionarId) sel.value = seleccionarId;
}

// Alterna qué mitad del formulario de ítem se ve, según tipo elegido.
function ventaCambiarTipoItem(tipo) {
  document.getElementById('venta-item-tipo').value = tipo;
  document.getElementById('venta-item-prod-wrap').style.display = tipo === 'producto' ? '' : 'none';
  document.getElementById('venta-item-serv-wrap').style.display = tipo === 'servicio' ? '' : 'none';
  document.querySelectorAll('#m-venta .ftab[data-tipo-item]').forEach(b => b.classList.toggle('on', b.dataset.tipoItem === tipo));
}

// Al elegir un producto o servicio existente, prellena el precio con el
// precio_venta/precio del catálogo — queda editable igual que en Cotización.
function ventaPrecioDesdeOpcion(selectId, precioInputId) {
  const sel = document.getElementById(selectId);
  const opt = sel.options[sel.selectedIndex];
  const precio = opt ? opt.dataset.precio : null;
  if (precio != null && precio !== '') document.getElementById(precioInputId).value = precio;
}

function ventaServicioSeleccionado() {
  const sel = document.getElementById('venta-item-servicio');
  if (sel.value === '__nuevo__') {
    document.getElementById('venta-serv-nuevo-wrap').style.display = '';
    document.getElementById('venta-item-nombre-manual').value = '';
    document.getElementById('venta-item-precio').value = '';
    return;
  }
  document.getElementById('venta-serv-nuevo-wrap').style.display = 'none';
  ventaPrecioDesdeOpcion('venta-item-servicio', 'venta-item-precio');
}

function ventaGuardarServicioNuevo() {
  const { error, proc } = ventaAgregarServicioAlCatalogo({
    nombre: document.getElementById('venta-serv-nuevo-nombre').value,
    cat: document.getElementById('venta-serv-nuevo-cat').value,
    precio: document.getElementById('venta-serv-nuevo-precio').value,
  });
  if (error) { toast(error, 'err'); return; }
  toast('Servicio agregado al catálogo ✓', 'ok');
  _ventaCargarServicios(proc.id);
  document.getElementById('venta-serv-nuevo-wrap').style.display = 'none';
  ventaPrecioDesdeOpcion('venta-item-servicio', 'venta-item-precio');
}

// ── Lista de ítems de la venta en curso (todavía no guardada) ──────────────
function ventaAgregarItemALista() {
  const tipo = document.getElementById('venta-item-tipo').value;
  let nombre, productoId;
  if (tipo === 'producto') {
    const sel = document.getElementById('venta-item-producto');
    productoId = sel.value;
    const prod = VENTAS_CACHE_PRODUCTOS.find(p => p.id === productoId);
    nombre = prod ? prod.nombre : '';
  } else {
    const sel = document.getElementById('venta-item-servicio');
    if (sel.value === '__nuevo__') { toast('Primero guarda el servicio nuevo con el botón de abajo', 'err'); return; }
    nombre = document.getElementById('venta-item-nombre-manual').value || (sel.options[sel.selectedIndex] || {}).textContent || '';
    // Si viene de un servicio ya guardado, usamos su nombre real, no el textContent con el ícono.
    const procs = DB.get('procs'); const p = procs.find(x => x.id === sel.value);
    if (p) nombre = p.nombre;
  }

  const { error, item } = ventaConstruirItem({
    tipo, productoId,
    nombre,
    cantidad: document.getElementById('venta-item-cant').value,
    precioUnitario: document.getElementById('venta-item-precio').value,
  });
  if (error) { toast(error, 'err'); return; }

  VENTA_ITEMS_ACTUAL.push(item);
  _ventaRenderItems();
  document.getElementById('venta-item-cant').value = '1';
  document.getElementById('venta-item-precio').value = '';
}

function ventaQuitarItemDeLista(idx) {
  VENTA_ITEMS_ACTUAL.splice(idx, 1);
  _ventaRenderItems();
}

function _ventaRenderItems() {
  const cont = document.getElementById('venta-items-lista'); if (!cont) return;
  const totalEl = document.getElementById('venta-total-corriendo');
  const total = VENTA_ITEMS_ACTUAL.reduce((s, i) => s + i.subtotal, 0);
  if (totalEl) totalEl.textContent = fmt$(total);
  if (!VENTA_ITEMS_ACTUAL.length) { cont.innerHTML = '<p style="color:var(--g500);font-size:12px">Sin ítems todavía</p>'; return; }
  cont.innerHTML = VENTA_ITEMS_ACTUAL.map((i, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--g200);font-size:12px">
      <span>${VENTA_TIPOS_ITEM[i.tipo]}: ${i.cantidad}× ${i.nombre} (${fmt$(i.precio_unitario)} c/u)</span>
      <span style="display:flex;align-items:center;gap:8px"><strong>${fmt$(i.subtotal)}</strong>
        <button class="btn btn-outline btn-xs" onclick="ventaQuitarItemDeLista(${idx})">✕</button></span>
    </div>`).join('');
}

async function ventaGuardarCompleta() {
  const { error, venta } = ventaConstruirCabecera({
    propietarioId: document.getElementById('venta-propietario').value,
    clienteNombre: document.getElementById('venta-cliente-nombre').value,
    fecha: document.getElementById('venta-fecha').value,
    items: VENTA_ITEMS_ACTUAL,
    metodoPago: document.getElementById('venta-metodo-pago').value,
    cuentaId: document.getElementById('venta-cuenta').value,
  });
  if (error) { toast(error, 'err'); return; }

  const btn = document.getElementById('venta-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    await VentasRepo.crearVenta(venta, VENTA_ITEMS_ACTUAL);
    toast('Venta registrada ✓', 'ok');
    closeM('m-venta');
    rVentas();
  } catch (e) {
    // El mensaje de VentasRepo.crearVenta ya dice exactamente qué paso falló.
    toast(e.message || 'No se pudo registrar la venta', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Registrar venta' }
  }
}
