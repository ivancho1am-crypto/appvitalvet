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
let VENTAS_CACHE_LISTA = [];        // ventas del día que se están viendo, para anular sin volver a pedirlas

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
    VENTAS_CACHE_LISTA = ventas;
  } catch (e) {
    console.warn('[ventas] rVentas:', e);
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div>
      <div class="empty-t">No se pudo cargar el registro de ventas</div>
      <div class="empty-s">Verifica tu conexión e intenta de nuevo</div></div>`;
    return;
  }

  _ventaRenderWidget(ventas);

  if (!ventas.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">🛒</div>
      <div class="empty-t">Sin ventas registradas este día</div>
      <div class="empty-s">Usa "+ Nueva venta" para registrar la primera</div></div>`;
    return;
  }

  cont.innerHTML = ventas.map(v => _renderVentaCard(v)).join('');
}

function _ventasSoloFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Widget propio del día: total, cantidad, y desglose por método de pago —
// siempre se pinta (incluso en 0 ventas), para que el panel no se sienta
// vacío mientras #ventas-lista sí muestra su empty-state.
function _ventaRenderWidget(ventas) {
  const cont = document.getElementById('ventas-widget'); if (!cont) return;
  const r = ventaCalcularResumen(ventas);
  const desglose = Object.entries(r.porMetodo)
    .filter(([, monto]) => monto > 0)
    .map(([m, monto]) => `<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0">
      <span>${VENTA_METODOS_PAGO[m]}</span><strong>${fmt$(monto)}</strong></div>`).join('')
    || '<p style="color:var(--g500);font-size:12px">Sin ventas este día</p>';

  cont.innerHTML = `
    <div class="kpi-row" style="grid-template-columns:repeat(2,1fr);margin-bottom:14px">
      <div class="kpi-card" style="--c:var(--green)">
        <div class="kc-ic">🛒</div><div class="kc-val">${fmt$(r.total)}</div><div class="kc-lbl">Total vendido este día</div>
      </div>
      <div class="kpi-card" style="--c:var(--brand)">
        <div class="kc-ic">#️⃣</div><div class="kc-val">${r.cantidad}</div><div class="kc-lbl">Ventas registradas</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="card-hdr"><div class="card-title">Por método de pago</div></div>
      <div class="card-body">${desglose}</div>
    </div>`;
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
  const v = (VENTAS_CACHE_LISTA || []).find(x => x.id === id);
  const productos = v ? (v.items || []).filter(i => i.tipo === 'producto' && i.producto_id) : [];
  const detalle = productos.length
    ? `\n\nSe devolverán al inventario:\n` + productos.map(i => `  · ${i.cantidad} × ${i.nombre}`).join('\n')
    : '\n\nEsta venta no tiene productos de inventario, así que no hay stock que devolver.';
  if (!confirm(`¿Anular esta venta${v ? ' por ' + fmt$(v.total) : ''}?${detalle}\n\nLa venta queda registrada como anulada, no se borra.`)) return;

  try {
    const r = await VentasRepo.anularVenta(id);
    const n = (r && r.productosDevueltos) || 0;
    toast(n ? `Venta anulada ✓ — ${n} producto${n === 1 ? '' : 's'} devuelto${n === 1 ? '' : 's'} al inventario` : 'Venta anulada ✓', 'ok');
    rVentas();
    // El stock cambió: si Inventario está cargado, que se vea al instante.
    if (typeof _invActualizarBadge === 'function') _invActualizarBadge();
  } catch (e) {
    console.error('[ventas] anular:', e);
    toast(e.message || 'No se pudo anular la venta', 'err');
    rVentas();   // puede haber quedado anulada aunque fallara la devolución
  }
}

// ── Modal "Nueva venta" ─────────────────────────────────────────────────────
function ventaAbrirNueva() {
  VENTA_ITEMS_ACTUAL = [];
  _ventaRenderItems();
  document.getElementById('venta-cliente-nombre').value = '';
  document.getElementById('venta-fecha').value = _ventasSoloFecha(new Date());
  document.getElementById('venta-metodo-pago').value = 'efectivo';

  // Buscador de propietario (2026-10-06): antes era un <select> con los
  // 500+ propietarios cargados de una — con ese volumen, buscar uno a mano
  // en la lista desplegada era incómodo. Ahora se escribe y aparecen
  // coincidencias, igual criterio que el buscador global de la topbar.
  document.getElementById('venta-propietario-buscar').value = '';
  document.getElementById('venta-propietario').value = '';
  document.getElementById('venta-propietario-resultados').classList.remove('show');
  ventaActualizarMascotasDelPropietario();   // arranca vacío (sin propietario elegido)

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

// Buscador de propietario — escribe y aparecen coincidencias (por nombre o
// cédula), mismo patrón visual que globalSearch() en dashboard.js
// (.app-search-results/.app-search-row), pero acotado a esta caja: no
// navega a ningún lado, solo selecciona para esta venta.
function ventaBuscarPropietario(q) {
  const el = document.getElementById('venta-propietario-resultados');
  q = (q || '').trim().toLowerCase();
  // Sin texto: si ya había un propietario elegido, no reabre la lista con
  // los 500 — se vuelve a escribir solo si de verdad se quiere cambiar.
  if (!q) { el.classList.remove('show'); el.innerHTML = ''; return; }

  const props = DB.get('props')
    .filter(p => p.nombre.toLowerCase().includes(q) || (p.cedula || '').includes(q))
    .slice(0, 8);   // la lista completa puede tener 500+; 8 coincidencias alcanza para elegir

  if (!props.length) {
    el.innerHTML = '<div class="app-search-row" style="cursor:default;color:var(--ink-2)">Sin resultados</div>';
    el.classList.add('show');
    return;
  }
  el.innerHTML = props.map(p => `
    <div class="app-search-row" onmousedown="ventaSeleccionarPropietario('${p.id}', '${(p.nombre || '').replace(/'/g, "\\'")}')">
      👤 ${p.nombre}<span class="asr-tag">${p.cedula || ''}</span>
    </div>`).join('');
  el.classList.add('show');
}

// onmousedown (no onclick) en las filas de arriba: dispara ANTES que el
// onblur del input, que si no se adelantaría y cerraría la lista primero
// — exactamente el mismo motivo por el que globalSearch() usa onmousedown.
function ventaSeleccionarPropietario(id, nombre) {
  document.getElementById('venta-propietario').value = id;
  document.getElementById('venta-propietario-buscar').value = nombre;
  document.getElementById('venta-propietario-resultados').classList.remove('show');
  ventaActualizarMascotasDelPropietario();
}

// Al perder el foco: si quedó texto escrito que nunca se convirtió en una
// selección real (se tipeó un nombre pero nunca se hizo clic en ninguna
// fila), se descarta — mejor una caja vacía y clara que un texto que
// parece elegido sin estarlo. Si SÍ hay un propietario elegido, se deja
// tal cual. 150ms de margen para que el onmousedown de arriba alcance a
// disparar antes de que esto borre la lista.
function ventaCerrarBusquedaPropietario() {
  setTimeout(() => {
    const resultados = document.getElementById('venta-propietario-resultados');
    if (resultados) resultados.classList.remove('show');
    if (!document.getElementById('venta-propietario').value) {
      document.getElementById('venta-propietario-buscar').value = '';
    }
  }, 150);
}

// Mascota opcional: solo tiene sentido si hay un propietario real elegido
// (de mostrador no se conocen sus mascotas) — se puebla con DB.get('mas')
// filtrado por pid, mismo origen que usa Mascotas/Marketing.
function ventaActualizarMascotasDelPropietario() {
  const propietarioId = document.getElementById('venta-propietario').value;
  const wrap = document.getElementById('venta-mascota-wrap');
  const sel = document.getElementById('venta-mascota');
  if (!propietarioId) {
    wrap.style.display = 'none';
    sel.innerHTML = '<option value="">Ninguna</option>';
    return;
  }
  const mascotas = DB.get('mas').filter(m => m.pid === propietarioId);
  sel.innerHTML = '<option value="">Ninguna</option>' +
    mascotas.map(m => `<option value="${m.id}">${EI(m.esp)} ${m.nombre}</option>`).join('');
  wrap.style.display = mascotas.length ? '' : 'none';
}

async function ventaGuardarCompleta() {
  const { error, venta } = ventaConstruirCabecera({
    propietarioId: document.getElementById('venta-propietario').value,
    clienteNombre: document.getElementById('venta-cliente-nombre').value,
    fecha: document.getElementById('venta-fecha').value,
    items: VENTA_ITEMS_ACTUAL,
    metodoPago: document.getElementById('venta-metodo-pago').value,
    cuentaId: document.getElementById('venta-cuenta').value,
    mascotaId: document.getElementById('venta-mascota').value,
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

// ── Histórico de ventas (2026-10-06) ───────────────────────────────────────
// Centro histórico: cualquier rango de fechas (no solo "el día de hoy" como
// el registro de arriba), con filtros de propietario/mascota/producto/
// método + búsqueda libre, y los 4 KPIs del período filtrado.
let VH_FILAS = [];       // histórico aplanado (una fila por ítem) del rango actual, sin filtrar
let VH_DESDE = null;
let VH_HASTA = null;

async function ventaAbrirHistorico() {
  const hoy = new Date();
  const hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30);
  document.getElementById('vh-f-desde').value = _ventasSoloFecha(hace30);
  document.getElementById('vh-f-hasta').value = _ventasSoloFecha(hoy);
  document.getElementById('vh-f-propietario').value = '';
  document.getElementById('vh-f-mascota').value = '';
  document.getElementById('vh-f-metodo').value = 'todos';
  document.getElementById('vh-f-busqueda').value = '';
  openM('m-venta-historico');
  await _ventaCargarHistorico();
}

async function _ventaCargarHistorico() {
  const cont = document.getElementById('vh-tabla');
  cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-s">Cargando…</div></div>';
  VH_DESDE = document.getElementById('vh-f-desde').value;
  VH_HASTA = document.getElementById('vh-f-hasta').value;
  if (!VH_DESDE || !VH_HASTA) return;
  try {
    const ventas = await VentasRepo.listarHistorico(VH_DESDE, VH_HASTA);
    VH_FILAS = ventaAplanarHistorico(ventas);
  } catch (e) {
    console.warn('[ventas] historico:', e);
    VH_FILAS = [];
    cont.innerHTML = '<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div><div class="empty-t">No se pudo cargar el histórico</div></div>';
    return;
  }
  _ventaPoblarSelectProducto();
  ventaAplicarFiltrosHistorico();
}

function _ventaPoblarSelectProducto() {
  const sel = document.getElementById('vh-f-producto');
  const valorActual = sel.value;
  sel.innerHTML = '<option value="todos">Todos</option>' +
    ventaListaConceptosHistorico(VH_FILAS).map(c => `<option value="${c}">${c}</option>`).join('');
  if ([...sel.options].some(o => o.value === valorActual)) sel.value = valorActual;
}

// Si cambia el rango de fechas, hay que volver a pedir datos a Supabase;
// los demás filtros (propietario/mascota/producto/método/búsqueda) son
// puramente locales sobre VH_FILAS, ya cargado — mismo criterio que
// Marketing (cambiar un filtro no dispara red).
function ventaAplicarFiltrosHistorico() {
  const desde = document.getElementById('vh-f-desde').value;
  const hasta = document.getElementById('vh-f-hasta').value;
  if (desde !== VH_DESDE || hasta !== VH_HASTA) { _ventaCargarHistorico(); return; }

  const filtros = {
    propietario: document.getElementById('vh-f-propietario').value,
    mascota: document.getElementById('vh-f-mascota').value,
    producto: document.getElementById('vh-f-producto').value,
    metodo: document.getElementById('vh-f-metodo').value,
    busqueda: document.getElementById('vh-f-busqueda').value,
  };
  const filtradas = ventaFiltrarHistorico(VH_FILAS, filtros);
  _ventaRenderKPIsHistorico(filtradas);
  _ventaRenderTablaHistorico(filtradas);
}

function ventaLimpiarFiltrosHistorico() {
  document.getElementById('vh-f-propietario').value = '';
  document.getElementById('vh-f-mascota').value = '';
  document.getElementById('vh-f-producto').value = 'todos';
  document.getElementById('vh-f-metodo').value = 'todos';
  document.getElementById('vh-f-busqueda').value = '';
  ventaAplicarFiltrosHistorico();
}

function _ventaRenderKPIsHistorico(filasFiltradas) {
  const k = ventaCalcularKPIsHistorico(filasFiltradas, VH_DESDE, VH_HASTA);
  document.getElementById('vh-kpi-total').textContent = fmt$(k.total);
  document.getElementById('vh-kpi-cantidad').textContent = k.cantidad;
  document.getElementById('vh-kpi-ticket').textContent = fmt$(k.ticketPromedio);
  document.getElementById('vh-kpi-diario').textContent = fmt$(k.promedioDiario);
}

function _ventaRenderTablaHistorico(filasFiltradas) {
  const cont = document.getElementById('vh-tabla');
  if (!filasFiltradas.length) {
    cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-ic">🛒</div><div class="empty-t">Sin ventas con estos filtros</div></div>';
    return;
  }
  // Más reciente primero — igual criterio que el registro diario.
  const ordenadas = [...filasFiltradas].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Fecha</th><th>Hora</th><th>Propietario</th><th>Mascota</th><th>Concepto</th><th>Valor</th><th>Método</th></tr></thead>
    <tbody>${ordenadas.map(f => `
      <tr style="${f.anulado ? 'opacity:.5' : ''}">
        <td style="white-space:nowrap">${new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-CO')}</td>
        <td>${f.createdAt ? new Date(f.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td>${f.propietarioNombre}${f.anulado ? ' <span style="font-size:10px;color:var(--g500)">(ANULADA)</span>' : ''}</td>
        <td>${f.mascotaNombre || '—'}</td>
        <td>${f.concepto}</td>
        <td><strong>${fmt$(f.valor)}</strong></td>
        <td style="font-size:11px">${VENTA_METODOS_PAGO[f.metodoPago] || f.metodoPago || ''}</td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}
