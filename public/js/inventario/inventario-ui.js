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
    <thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo</th><th>Precio venta</th><th>Acciones</th></tr></thead>
    <tbody>${filas.map(p => `
      <tr>
        <td>${p.nombre}${p.proveedor ? `<div style="font-size:11px;color:var(--g500)">${p.proveedor}</div>` : ''}</td>
        <td><span class="badge bg-gray">${invCategoriaInfo(p.categoria).icon} ${invCategoriaInfo(p.categoria).label}</span></td>
        <td>${invEsBajoStock(p) ? '<span class="badge bg-red">' : '<span>'}${p.stock_actual} ${p.unidad}${invEsBajoStock(p) ? '</span>' : '</span>'}</td>
        <td>${p.stock_minimo} ${p.unidad}</td>
        <td>${p.costo_unitario != null ? fmt$(p.costo_unitario) : '—'}</td>
        <td>${p.precio_venta != null ? fmt$(p.precio_venta) : '—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-outline btn-xs" onclick="invAbrirMovimiento('${p.id}')">↕ Movimiento</button>
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
function invAbrirNuevoProducto() {
  document.getElementById('inv-prod-id').value = '';
  document.getElementById('m-inv-prod-titulo').textContent = '📦 Nuevo producto';
  ['inv-p-nombre', 'inv-p-unidad', 'inv-p-min', 'inv-p-costo', 'inv-p-precio', 'inv-p-prov'].forEach(id => { document.getElementById(id).value = '' });
  document.getElementById('inv-p-cat').value = 'medicamento';
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
  });
  if (error) { toast(error, 'err'); return; }

  const btn = document.getElementById('inv-p-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    if (id) await InventarioRepo.actualizarProducto(id, fila);
    else await InventarioRepo.crearProducto(fila);
    toast(id ? 'Producto actualizado ✓' : 'Producto creado ✓', 'ok');
    closeM('m-inv-prod');
    rInventario();
  } catch (e) {
    toast('No se pudo guardar el producto', 'err'); console.warn(e);
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

// ── Modal "Historial" (solo lectura) ───────────────────────────────────────
async function invVerHistorial(productoId) {
  const p = INV_CACHE_PRODUCTOS.find(x => x.id === productoId);
  document.getElementById('m-inv-hist-titulo').textContent = `🕓 Historial — ${p ? p.nombre : ''}`;
  const cont = document.getElementById('inv-hist-lista');
  cont.innerHTML = '<div class="empty-s">Cargando…</div>';
  openM('m-inv-hist');
  let mov;
  try { mov = await InventarioRepo.historialProducto(productoId); }
  catch (e) { cont.innerHTML = '<div class="empty-s">No se pudo cargar el historial</div>'; console.warn(e); return; }
  if (!mov.length) { cont.innerHTML = '<div class="empty-s">Sin movimientos todavía</div>'; return; }
  cont.innerHTML = mov.map(m => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--g200)">
      <div>
        <div style="font-size:12px">${INV_MOTIVOS[m.motivo] || m.motivo}${m.nota ? ' — ' + m.nota : ''}</div>
        <div style="font-size:11px;color:var(--g500)">${new Date(m.created_at).toLocaleString('es-CO')}</div>
      </div>
      <span class="badge ${m.cantidad > 0 ? 'bg-green' : 'bg-red'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</span>
    </div>`).join('');
}
