// Módulo: Inventario — pantalla
//
// Llama a InventarioRepo (datos) y a las funciones inv* (reglas), nunca habla
// con Supabase directo. Mismo patrón que agenda-ui.js.
//
// Cada llamada a Supabase va en try/catch: la primera versión de Agenda se
// quedaba en "Cargando…" o con el botón trabado si fallaba la red, y eso se
// corrigió después de probarlo — acá se aplica desde el principio.

let INV_FILTRO = 'todos';
let INV_CACHE_PRODUCTOS = [];   // último listarProductos() — para prellenar el modal de editar
let INV_CACHE_FILAS = [];       // productos + stock ya combinados — para poder filtrar sin volver a pedir

// ── Render principal — lo llama go('inventario', ...) en nav.js ────────────
async function rInventario() {
  const cont = document.getElementById('inv-tabla'); if (!cont) return;
  cont.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-s">Cargando…</div></div>';

  let productos, stock;
  try {
    [productos, stock] = await Promise.all([InventarioRepo.listarProductos(), InventarioRepo.listarStock()]);
  } catch (e) {
    console.warn('[inventario] rInventario:', e);
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">⚠️</div>
      <div class="empty-t">No se pudo cargar el inventario</div>
      <div class="empty-s">Verifica tu conexión e intenta de nuevo</div></div>`;
    return;
  }

  const stockPorId = {}; stock.forEach(s => { stockPorId[s.producto_id] = s.stock_actual });
  INV_CACHE_PRODUCTOS = productos;
  INV_CACHE_FILAS = productos.map(p => ({ ...p, stock_actual: stockPorId[p.id] ?? 0 }));

  _invRenderAlerta();
  _invRenderTabla();
  _invActualizarBadge(stock);
  _invRenderValorInventario();
  _invRenderVencimientos();     // widget propio, independiente del catálogo
  _invRenderUltimosMovimientos();
}

function _invRenderValorInventario() {
  const el = document.getElementById('inv-kpi-valor'); const nota = document.getElementById('inv-kpi-valor-nota');
  if (!el) return;
  const { total, conFallback } = invCalcularValorInventario(INV_CACHE_FILAS);
  el.textContent = fmt$(total);
  if (nota) nota.textContent = conFallback > 0 ? `${conFallback} producto(s) sin costo, usando precio de venta` : 'Basado en costo de adquisición';
}

// Vencimientos: widget independiente (su propia consulta a Supabase), para
// no esperar a que termine de cargar el catálogo completo si tarda.
async function _invRenderVencimientos() {
  const el = document.getElementById('inv-vencimientos'); if (!el) return;
  el.innerHTML = '<p style="color:var(--g500);font-size:12px">Cargando…</p>';
  let lotes;
  try { lotes = await InventarioRepo.listarVencimientosProximos(90); }
  catch (e) { el.innerHTML = '<p style="color:var(--g500);font-size:12px">No se pudo cargar</p>'; console.warn(e); return; }
  if (!lotes.length) { el.innerHTML = '<p style="color:var(--g500);font-size:12px">Sin vencimientos próximos ✓</p>'; return; }
  el.innerHTML = lotes.map(l => {
    const clase = invClasificarVencimiento(l.fecha_vencimiento);
    const info = INV_VENC_INFO[clase] || { icon: '', label: '', badge: 'bg-gray' };
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--g200)">
      <span>${info.icon} ${l.producto_nombre} <span style="color:var(--g500)">(Lote ${l.numero_lote})</span></span>
      <span class="badge ${info.badge}">${l.stock_actual} ${l.unidad} — vence ${l.fecha_vencimiento}</span>
    </div>`;
  }).join('');
}

async function _invRenderUltimosMovimientos() {
  const el = document.getElementById('inv-ultimos-mov'); if (!el) return;
  el.innerHTML = '<p style="color:var(--g500);font-size:12px">Cargando…</p>';
  let movs;
  try { movs = await InventarioRepo.listarUltimosMovimientos(10); }
  catch (e) { el.innerHTML = '<p style="color:var(--g500);font-size:12px">No se pudo cargar</p>'; console.warn(e); return; }
  if (!movs.length) { el.innerHTML = '<p style="color:var(--g500);font-size:12px">Sin movimientos todavía</p>'; return; }
  el.innerHTML = movs.map(m => `
    <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:4px 0;border-bottom:1px solid var(--g200)">
      <span>${m.producto_nombre} — ${INV_MOTIVOS[m.motivo] || m.motivo}</span>
      <span class="badge ${m.cantidad > 0 ? 'bg-green' : 'bg-red'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</span>
    </div>`).join('');
}

function _invRenderAlerta() {
  const el = document.getElementById('inv-alerta'); if (!el) return;
  const bajos = INV_CACHE_FILAS.filter(invEsBajoStock);
  if (!bajos.length) { el.innerHTML = '<p style="color:var(--g500);font-size:12px">Todo el stock está por encima de su mínimo ✓</p>'; return; }
  el.innerHTML = bajos.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--g200)">
      <span>${invCategoriaInfo(p.categoria).icon} ${p.nombre}</span>
      <span class="badge bg-red">${p.stock_actual} ${p.unidad} (mín. ${p.stock_minimo})</span>
    </div>`).join('');
}

function _invRenderTabla() {
  const cont = document.getElementById('inv-tabla'); if (!cont) return;
  const filas = INV_FILTRO === 'todos' ? INV_CACHE_FILAS : INV_CACHE_FILAS.filter(p => p.categoria === INV_FILTRO);
  if (!filas.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:36px"><div class="empty-ic">📦</div>
      <div class="empty-t">Sin productos ${INV_FILTRO === 'todos' ? '' : 'en esta categoría'}</div>
      <div class="empty-s">Usa "+ Nuevo producto" para crear el primero</div></div>`;
    return;
  }
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo</th><th>Precio venta</th><th>Acciones</th></tr></thead>
    <tbody>${filas.map(p => `
      <tr>
        <td>${p.codigo || '—'}</td>
        <td>${p.nombre}${p.proveedor ? `<div style="font-size:11px;color:var(--g500)">${p.proveedor}</div>` : ''}${p.ubicacion ? `<div style="font-size:11px;color:var(--g500)">📍 ${p.ubicacion}</div>` : ''}</td>
        <td><span class="badge bg-gray">${invCategoriaInfo(p.categoria).icon} ${invCategoriaInfo(p.categoria).label}</span></td>
        <td>${invEsBajoStock(p) ? '<span class="badge bg-red">' : invEsSobreStock(p) ? '<span class="badge bg-yellow">' : '<span>'}${p.stock_actual} ${p.unidad}${(invEsBajoStock(p) || invEsSobreStock(p)) ? '</span>' : '</span>'}</td>
        <td>${p.stock_minimo} ${p.unidad}</td>
        <td>${p.costo_unitario != null ? fmt$(p.costo_unitario) : '—'}</td>
        <td>${p.precio_venta != null ? fmt$(p.precio_venta) : '—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-outline btn-xs" onclick="invAbrirMovimiento('${p.id}')">↕ Movimiento</button>
          <button class="btn btn-outline btn-xs" onclick="invCorregirExistencias('${p.id}')" title="Corregir las unidades si se registraron de más o de menos">🔢 Existencias</button>
          <button class="btn btn-outline btn-xs" onclick="invAbrirNuevoLote('${p.id}')">📦+ Lote</button>
          <button class="btn btn-outline btn-xs" onclick="invVerHistorial('${p.id}')">🕓</button>
          <button class="btn btn-outline btn-xs" onclick="invAbrirEditarProducto('${p.id}')">✎</button>
          <button class="btn btn-outline btn-xs" onclick="invDesactivarProducto('${p.id}')">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

function fInv(cat, btn) {
  INV_FILTRO = cat;
  document.querySelectorAll('#page-inventario .ftab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  _invRenderTabla();
}

async function _invActualizarBadge(stockYaCargado) {
  const el = document.getElementById('inv-n'); if (!el) return;
  try {
    const stock = stockYaCargado || await InventarioRepo.listarStock();
    el.textContent = stock.filter(r => r.stock_minimo > 0 && r.stock_actual <= r.stock_minimo).length;
  } catch (e) { console.warn('[inventario] _invActualizarBadge:', e); }
}

// ── Modal "Nuevo/Editar producto" ──────────────────────────────────────────
const INV_CAMPOS_PROD_TEXTO = ['inv-p-nombre', 'inv-p-unidad', 'inv-p-min', 'inv-p-costo', 'inv-p-precio', 'inv-p-prov',
  'inv-p-codigo', 'inv-p-presentacion', 'inv-p-barras', 'inv-p-max', 'inv-p-reorden', 'inv-p-ubicacion'];

const INV_CAMPOS_PROD_LOTE = ['inv-p-lote-numero', 'inv-p-lote-fabricacion', 'inv-p-lote-vencimiento', 'inv-p-lote-cantidad'];

function invAbrirNuevoProducto() {
  document.getElementById('inv-prod-id').value = '';
  document.getElementById('m-inv-prod-titulo').textContent = '📦 Nuevo producto';
  INV_CAMPOS_PROD_TEXTO.forEach(id => { document.getElementById(id).value = '' });
  document.getElementById('inv-p-cat').value = 'medicamento';
  // "Primer lote" solo tiene sentido al CREAR — un producto existente ya
  // tiene su propio botón "📦+ Lote" para agregar lotes nuevos.
  const wrap = document.getElementById('inv-p-lote-wrap');
  if (wrap) wrap.style.display = '';
  INV_CAMPOS_PROD_LOTE.forEach(id => { const el = document.getElementById(id); if (el) el.value = '' });
  openM('m-inv-prod');
}

function invAbrirEditarProducto(id) {
  const p = INV_CACHE_PRODUCTOS.find(x => x.id === id);
  if (!p) { toast('Producto no encontrado', 'err'); return; }
  document.getElementById('inv-prod-id').value = p.id;
  document.getElementById('m-inv-prod-titulo').textContent = '✎ Editar producto';
  document.getElementById('inv-p-nombre').value = p.nombre;
  document.getElementById('inv-p-cat').value = p.categoria;
  document.getElementById('inv-p-unidad').value = p.unidad;
  document.getElementById('inv-p-min').value = p.stock_minimo;
  document.getElementById('inv-p-costo').value = p.costo_unitario ?? '';
  document.getElementById('inv-p-precio').value = p.precio_venta ?? '';
  document.getElementById('inv-p-prov').value = p.proveedor || '';
  // Fase 1 — campos nuevos, opcionales: un producto creado antes de este
  // ciclo simplemente los trae en null/undefined y el formulario los
  // muestra vacíos, sin romper nada.
  document.getElementById('inv-p-codigo').value = p.codigo || '';
  document.getElementById('inv-p-presentacion').value = p.presentacion || '';
  document.getElementById('inv-p-barras').value = p.codigo_barras || '';
  document.getElementById('inv-p-max').value = p.stock_maximo ?? '';
  document.getElementById('inv-p-reorden').value = p.punto_reorden ?? '';
  document.getElementById('inv-p-ubicacion').value = p.ubicacion || '';
  // Editar un producto existente nunca crea un lote nuevo acá — para eso
  // está "📦+ Lote" en su fila de la tabla.
  const wrap = document.getElementById('inv-p-lote-wrap');
  if (wrap) wrap.style.display = 'none';
  openM('m-inv-prod');
}

async function invGuardarProducto() {
  const id = document.getElementById('inv-prod-id').value;
  const { error, fila } = invConstruirProducto({
    nombre: document.getElementById('inv-p-nombre').value,
    categoria: document.getElementById('inv-p-cat').value,
    unidad: document.getElementById('inv-p-unidad').value,
    stockMinimo: document.getElementById('inv-p-min').value,
    costo: document.getElementById('inv-p-costo').value,
    precio: document.getElementById('inv-p-precio').value,
    proveedor: document.getElementById('inv-p-prov').value,
    codigo: document.getElementById('inv-p-codigo').value,
    presentacion: document.getElementById('inv-p-presentacion').value,
    codigoBarras: document.getElementById('inv-p-barras').value,
    stockMaximo: document.getElementById('inv-p-max').value,
    puntoReorden: document.getElementById('inv-p-reorden').value,
    ubicacion: document.getElementById('inv-p-ubicacion').value,
  });
  if (error) { toast(error, 'err'); return; }

  // Primer lote (opcional, solo al crear): si se llenó número + cantidad,
  // se valida ACÁ, antes de tocar red, para no crear el producto si el
  // lote que lo acompaña está mal — mismo criterio que el resto del
  // proyecto (validar todo antes del primer paso de red).
  const loteNumero = document.getElementById('inv-p-lote-numero').value;
  const loteCantidad = document.getElementById('inv-p-lote-cantidad').value;
  const quiereLote = !id && (loteNumero.trim() || loteCantidad.trim());
  let loteFila = null, movimientoBase = null;
  if (quiereLote) {
    const resLote = invConstruirLote({
      productoId: 'pendiente', // se reemplaza por el id real una vez creado el producto
      numeroLote: loteNumero,
      fechaFabricacion: document.getElementById('inv-p-lote-fabricacion').value,
      fechaVencimiento: document.getElementById('inv-p-lote-vencimiento').value,
      cantidadInicial: loteCantidad,
      costoUnitario: document.getElementById('inv-p-costo').value,
      proveedor: document.getElementById('inv-p-prov').value,
    });
    if (resLote.error) { toast(resLote.error, 'err'); return; }
    loteFila = resLote.loteFila; movimientoBase = resLote.movimientoBase;
  }

  const btn = document.getElementById('inv-p-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    if (id) {
      await InventarioRepo.actualizarProducto(id, fila);
    } else {
      const producto = await InventarioRepo.crearProducto(fila);
      if (quiereLote) {
        try {
          loteFila.producto_id = producto.id;
          const lote = await InventarioRepo.crearLote(loteFila);
          try {
            await InventarioRepo.registrarMovimiento({ ...movimientoBase, producto_id: producto.id, lote_id: lote.id });
          } catch (eMov) {
            toast(`Producto y lote "${lote.numero_lote}" creados, pero la entrada inicial NO se registró: ${eMov.message}`, 'err');
            console.warn(eMov);
            closeM('m-inv-prod'); rInventario();
            return;
          }
        } catch (eLote) {
          toast(`Producto creado, pero el lote NO se registró: ${eLote.message}`, 'err');
          console.warn(eLote);
          closeM('m-inv-prod'); rInventario();
          return;
        }
      }
    }
    toast(id ? 'Producto actualizado ✓' : (quiereLote ? 'Producto y primer lote registrados ✓' : 'Producto creado ✓'), 'ok');
    closeM('m-inv-prod');
    rInventario();
  } catch (e) {
    // Si el código ya existe en otro producto, Postgres lo rechaza por el
    // índice único (idx_productos_codigo_unico) — se muestra tal cual en
    // vez de un genérico, para que quede claro por qué falló.
    const esCodigoDuplicado = /idx_productos_codigo_unico|duplicate key/i.test(e.message || '');
    toast(esCodigoDuplicado ? 'Ese código ya está en uso por otro producto' : 'No se pudo guardar el producto', 'err');
    console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar' }
  }
}

async function invDesactivarProducto(id) {
  const p = INV_CACHE_PRODUCTOS.find(x => x.id === id);
  if (!confirm(`¿Desactivar "${p ? p.nombre : 'este producto'}"? Deja de aparecer en la lista, pero su historial se conserva.`)) return;
  try {
    await InventarioRepo.actualizarProducto(id, { activo: false });
    toast('Producto desactivado ✓', 'ok');
    rInventario();
  } catch (e) { toast('No se pudo desactivar el producto', 'err'); console.warn(e); }
}

// ── Modal "Registrar movimiento" ───────────────────────────────────────────
async function invAbrirMovimiento(productoIdPreseleccionado) {
  const sel = document.getElementById('inv-m-prod');
  sel.innerHTML = '<option value="">Selecciona producto</option>' +
    INV_CACHE_PRODUCTOS.map(p => `<option value="${p.id}">${invCategoriaInfo(p.categoria).icon} ${p.nombre}</option>`).join('');
  if (productoIdPreseleccionado) sel.value = productoIdPreseleccionado;
  document.getElementById('inv-m-accion').value = 'entrada';
  document.getElementById('inv-m-cant').value = '';
  document.getElementById('inv-m-motivo').value = 'compra';
  document.getElementById('inv-m-nota').value = '';
  openM('m-inv-mov');
  _invCargarCitasDelSelect();   // no bloquea el modal: corre después de abrirlo
  _invCargarLotesDelSelect(productoIdPreseleccionado || '');
}

// Lote opcional del movimiento — solo tiene sentido si el producto elegido
// tiene lotes activos. Si no tiene ninguno (la mayoría de los productos,
// hoy) el select queda en "Ninguno" sin molestar: el lote nunca es
// obligatorio para registrar un movimiento.
async function _invCargarLotesDelSelect(productoId) {
  const sel = document.getElementById('inv-m-lote'); if (!sel) return;
  sel.innerHTML = '<option value="">Ninguno</option>';
  if (!productoId) return;
  try {
    const lotes = await InventarioRepo.listarLotesDeProducto(productoId);
    sel.innerHTML += lotes.filter(l => l.stock_actual > 0).map(l =>
      `<option value="${l.lote_id}">${l.numero_lote}${l.fecha_vencimiento ? ' — vence ' + l.fecha_vencimiento : ''} (stock: ${l.stock_actual})</option>`
    ).join('');
  } catch (e) { console.warn('[inventario] _invCargarLotesDelSelect:', e); }
}
function invMovimientoProductoCambiado() {
  _invCargarLotesDelSelect(document.getElementById('inv-m-prod').value);
}

// Opcional, no crítico: si falla o Agenda no está cargada, el select queda
// en "Ninguna" y el formulario sigue funcionando exactamente igual.
async function _invCargarCitasDelSelect() {
  const sel = document.getElementById('inv-m-cita'); if (!sel) return;
  sel.innerHTML = '<option value="">Ninguna</option>';
  if (typeof AgendaRepo === 'undefined') return;
  try {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy); desde.setDate(desde.getDate() - 2);
    const hasta = new Date(hoy); hasta.setDate(hasta.getDate() + 3); hasta.setHours(23, 59, 59, 999);
    const citas = await AgendaRepo.listar(desde.toISOString(), hasta.toISOString());
    sel.innerHTML += citas.map(c => {
      const hora = new Date(c.fecha_hora).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<option value="${c.id}">${hora} — ${c.mascota_nombre || 'Sin nombre'}</option>`;
    }).join('');
  } catch (e) { console.warn('[inventario] _invCargarCitasDelSelect:', e); }
}

async function invGuardarMovimiento() {
  const { error, fila } = invConstruirMovimiento({
    productoId: document.getElementById('inv-m-prod').value,
    accion: document.getElementById('inv-m-accion').value,
    cantidad: document.getElementById('inv-m-cant').value,
    motivo: document.getElementById('inv-m-motivo').value,
    nota: document.getElementById('inv-m-nota').value,
    citaId: document.getElementById('inv-m-cita').value,
    loteId: document.getElementById('inv-m-lote').value,
  });
  if (error) { toast(error, 'err'); return; }

  const btn = document.getElementById('inv-m-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    await InventarioRepo.registrarMovimiento(fila);
    toast('Movimiento registrado ✓', 'ok');
    closeM('m-inv-mov');
    rInventario();
  } catch (e) {
    toast('No se pudo registrar el movimiento', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar' }
  }
}

// ── Modal "Kardex" (solo lectura) — antes "Historial", mismo botón/modal ───
// Evolucionado de una lista simple a un Kardex real (Ciclo 3): saldo
// corrido, lote, documento de origen. kardexDeProducto() ya viene ordenado
// ascendente (lo necesita invCalcularKardex para el saldo); se muestra
// descendente (más reciente primero), igual que el historial de antes.
async function invVerHistorial(productoId) {
  const p = INV_CACHE_PRODUCTOS.find(x => x.id === productoId);
  document.getElementById('m-inv-hist-titulo').textContent = `🕓 Kardex — ${p ? p.nombre : ''}`;
  const cont = document.getElementById('inv-hist-lista');
  cont.innerHTML = '<div class="empty-s">Cargando…</div>';
  openM('m-inv-hist');
  let mov;
  try { mov = await InventarioRepo.kardexDeProducto(productoId); }
  catch (e) { cont.innerHTML = '<div class="empty-s">No se pudo cargar el Kardex</div>'; console.warn(e); return; }
  if (!mov.length) { cont.innerHTML = '<div class="empty-s">Sin movimientos todavía</div>'; return; }
  // Orden ascendente (más viejo primero) — mismo formato que el ejemplo del
  // Kardex: el saldo se lee bajando por la página, no al revés.
  const filas = invCalcularKardex(mov);
  cont.innerHTML = `<div class="tw"><table>
    <thead><tr><th>Fecha</th><th>Lote</th><th>Motivo</th><th>Documento</th><th>Entrada</th><th>Salida</th><th>Saldo</th><th>Usuario</th><th>Observación</th></tr></thead>
    <tbody>${filas.map(m => `
      <tr>
        <td style="white-space:nowrap">${new Date(m.created_at).toLocaleDateString('es-CO')}</td>
        <td>${m.numero_lote || '—'}</td>
        <td>${INV_MOTIVOS[m.motivo] || m.motivo}</td>
        <td>${m.documento}</td>
        <td>${m.entrada != null ? `<span class="badge bg-green">+${m.entrada}</span>` : ''}</td>
        <td>${m.salida != null ? `<span class="badge bg-red">−${m.salida}</span>` : ''}</td>
        <td><strong>${m.saldo}</strong></td>
        <td style="font-size:11px;color:var(--g500)">${m.creado_por || '—'}</td>
        <td style="font-size:11px;color:var(--g500)">${m.nota || ''}</td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}

// ── Modal "Nuevo lote" (Ciclo 2) ────────────────────────────────────────────
function invAbrirNuevoLote(productoId) {
  const p = INV_CACHE_PRODUCTOS.find(x => x.id === productoId);
  if (!p) { toast('Producto no encontrado', 'err'); return; }
  document.getElementById('inv-l-producto-id').value = productoId;
  document.getElementById('m-inv-lote-titulo').textContent = `📦 Nuevo lote — ${p.nombre}`;
  document.getElementById('inv-l-numero').value = '';
  document.getElementById('inv-l-fabricacion').value = '';
  document.getElementById('inv-l-vencimiento').value = '';
  document.getElementById('inv-l-cantidad').value = '';
  document.getElementById('inv-l-costo').value = p.costo_unitario ?? '';
  document.getElementById('inv-l-proveedor').value = p.proveedor || '';
  openM('m-inv-lote');
}

// Crea el lote y, encadenado, su movimiento de entrada inicial — un lote
// con cantidad > 0 SIEMPRE queda respaldado por un movimiento real (nunca
// un número suelto que no sume al SUM() del stock). Si el lote se crea
// pero el movimiento falla, se avisa explícitamente qué quedó a medias,
// mismo criterio que VentasRepo.crearVenta.
async function invGuardarLote() {
  const productoId = document.getElementById('inv-l-producto-id').value;
  const { error, loteFila, movimientoBase } = invConstruirLote({
    productoId,
    numeroLote: document.getElementById('inv-l-numero').value,
    fechaFabricacion: document.getElementById('inv-l-fabricacion').value,
    fechaVencimiento: document.getElementById('inv-l-vencimiento').value,
    cantidadInicial: document.getElementById('inv-l-cantidad').value,
    costoUnitario: document.getElementById('inv-l-costo').value,
    proveedor: document.getElementById('inv-l-proveedor').value,
  });
  if (error) { toast(error, 'err'); return; }

  const btn = document.getElementById('inv-l-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    const lote = await InventarioRepo.crearLote(loteFila);
    try {
      await InventarioRepo.registrarMovimiento({ ...movimientoBase, producto_id: productoId, lote_id: lote.id });
    } catch (eMov) {
      toast(`Lote "${lote.numero_lote}" creado, pero su entrada inicial NO se registró: ${eMov.message}`, 'err');
      console.warn(eMov);
      closeM('m-inv-lote');
      rInventario();
      return;
    }
    toast('Lote registrado ✓', 'ok');
    closeM('m-inv-lote');
    rInventario();
  } catch (e) {
    toast('No se pudo crear el lote', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar lote' }
  }
}

// ── Conteo físico (Ciclo 3) ──────────────────────────────────────────────
// Nunca toca stock directo — ya es imposible (no existe esa columna): al
// confirmar, se arma un movimiento de ajuste como cualquier otro.
function invAbrirConteo() {
  const sel = document.getElementById('inv-c-prod');
  sel.innerHTML = '<option value="">Selecciona producto</option>' +
    INV_CACHE_FILAS.map(p => `<option value="${p.id}" data-stock="${p.stock_actual}">${invCategoriaInfo(p.categoria).icon} ${p.nombre}</option>`).join('');
  document.getElementById('inv-c-sistema').value = '';
  document.getElementById('inv-c-fisico').value = '';
  document.getElementById('inv-c-diferencia').value = '';
  document.getElementById('inv-c-nota').value = '';
  openM('m-inv-conteo');
}

// Corregir las unidades de UN producto concreto, desde su propia fila.
// Es el mismo conteo físico de siempre (crea un movimiento de ajuste, nunca
// toca el stock directo), pero llegando desde el producto en vez de tener que
// buscarlo en la lista: el caso real es "registré 10 y eran 8, lo corrijo ya".
function invCorregirExistencias(productoId) {
  invAbrirConteo();
  const sel = document.getElementById('inv-c-prod');
  if (!sel) return;
  sel.value = productoId;
  if (sel.value !== productoId) {   // el producto no está en la lista cargada
    toast('No encontré ese producto en la lista actual', 'err');
    return;
  }
  invConteoProductoCambiado();      // rellena "stock del sistema"
  const fisico = document.getElementById('inv-c-fisico');
  if (fisico) fisico.focus();
}

function invConteoProductoCambiado() {
  const sel = document.getElementById('inv-c-prod');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('inv-c-sistema').value = opt && opt.dataset.stock != null ? opt.dataset.stock : '';
  document.getElementById('inv-c-fisico').value = '';
  document.getElementById('inv-c-diferencia').value = '';
}

function invConteoCalcularDiferencia() {
  const sistema = parseFloat(document.getElementById('inv-c-sistema').value) || 0;
  const fisico = parseFloat(document.getElementById('inv-c-fisico').value);
  const dif = document.getElementById('inv-c-diferencia');
  if (isNaN(fisico)) { dif.value = ''; return; }
  const d = Math.round((fisico - sistema) * 100) / 100;
  dif.value = (d > 0 ? '+' : '') + d;
}

async function invConfirmarConteo() {
  const { error, fila, diferencia } = invConstruirAjusteConteo({
    productoId: document.getElementById('inv-c-prod').value,
    stockSistema: document.getElementById('inv-c-sistema').value,
    stockContado: document.getElementById('inv-c-fisico').value,
    nota: document.getElementById('inv-c-nota').value,
  });
  if (error) { toast(error, 'err'); return; }
  if (!confirm(`¿Confirmar ajuste de ${diferencia > 0 ? '+' : ''}${diferencia}? Esto crea un movimiento de ajuste, no modifica nada directo.`)) return;

  const btn = document.getElementById('inv-c-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    await InventarioRepo.registrarMovimiento(fila);
    toast('Ajuste registrado ✓', 'ok');
    closeM('m-inv-conteo');
    rInventario();
  } catch (e) {
    toast('No se pudo registrar el ajuste', 'err'); console.warn(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Confirmar ajuste' }
  }
}
