// Módulo: Ventas — reglas de negocio
//
// Nada de DOM, nada de Supabase. Solo cálculos y validaciones, igual que
// agenda/inventario/finanzas-service.js.

const VENTA_TIPOS_ITEM = { producto: 'Producto', servicio: 'Servicio' };

// Mismo vocabulario que pagos.metodo (finanzas-service.js) — duplicado a
// propósito, no importado entre módulos. Una venta siempre se registra ya
// cobrada (decisión de Iván: no pasa por `pagos`/`facturas`), así que el
// método de pago es obligatorio.
const VENTA_METODOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

// Resumen para el widget de Ventas: total y cantidad (excluyendo anuladas,
// mismo criterio que "Total del día"), más el desglose por método de pago
// — así se ve de un vistazo cuánto entró en efectivo vs. transferencia/etc.
function ventaCalcularResumen(ventas) {
  const activas = ventas.filter(v => !v.anulado);
  const porMetodo = {};
  Object.keys(VENTA_METODOS_PAGO).forEach(m => { porMetodo[m] = 0 });
  activas.forEach(v => { porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + (parseFloat(v.total) || 0) });
  return {
    total: activas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0),
    cantidad: activas.length,
    porMetodo,
  };
}

// Arma y valida un ítem de venta. `subtotal` se calcula acá, nunca se
// recibe ya calculado — una sola fórmula, un solo lugar.
function ventaConstruirItem({ tipo, productoId, nombre, cantidad, precioUnitario }) {
  if (tipo !== 'producto' && tipo !== 'servicio') return { error: 'Tipo de ítem inválido' };
  if (!nombre || !nombre.trim()) return { error: 'Falta el nombre del ítem' };
  const cant = parseFloat(cantidad);
  if (isNaN(cant) || cant <= 0) return { error: 'La cantidad debe ser mayor que cero' };
  const precio = parseFloat(precioUnitario);
  if (isNaN(precio) || precio < 0) return { error: 'El precio no puede ser negativo' };
  if (tipo === 'producto' && !productoId) return { error: 'Selecciona un producto del inventario' };
  return {
    item: {
      tipo,
      producto_id: tipo === 'producto' ? productoId : null,
      nombre: nombre.trim(),
      cantidad: cant,
      precio_unitario: precio,
      subtotal: Math.round((cant * precio) * 100) / 100,
    }
  };
}

// Valida la venta completa antes de guardarla: al menos 1 ítem, cliente
// identificado de alguna forma (propietario real o nombre de mostrador),
// y método de pago (toda venta se registra ya cobrada). `cuentaId` es
// opcional: no bloquea el registro si todavía no hay cuentas creadas.
function ventaConstruirCabecera({ propietarioId, clienteNombre, fecha, items, metodoPago, cuentaId, mascotaId }) {
  if (!items || !items.length) return { error: 'Agrega al menos un ítem a la venta' };
  if (!propietarioId && !(clienteNombre || '').trim()) {
    return { error: 'Selecciona un propietario o escribe un nombre de mostrador' };
  }
  if (!fecha) return { error: 'Selecciona una fecha' };
  if (!metodoPago || !VENTA_METODOS_PAGO[metodoPago]) return { error: 'Selecciona un método de pago' };
  const total = items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);
  const venta = {
    propietario_id: propietarioId || null,
    cliente_nombre: propietarioId ? null : clienteNombre.trim(),
    fecha,
    metodo_pago: metodoPago,
    cuenta_id: cuentaId || null,
    total: Math.round(total * 100) / 100,
  };
  // mascota_id SOLO se incluye si hay una mascota elegida. La columna es
  // nueva (2026-10-06) y puede todavía no existir en Supabase — si no se
  // manda la clave, ventas-repository.js nunca la menciona en el insert y
  // el guardado funciona igual exista o no esa columna. Ver el manejo de
  // "columna no existe todavía" en VentasRepo._ventaCrearSecuencial.
  if (mascotaId) venta.mascota_id = mascotaId;
  return { venta };
}

// Agrega un servicio nuevo al catálogo compartido con Cotizaciones
// (DB.get('procs') / DB.set('procs', ...)) — mismo shape exacto que usa
// cotizacion.js (saveProc()): { id, nombre, cat, precio, desc }. Así el
// servicio queda disponible para la próxima cotización o venta también,
// en vez de vivir solo dentro de esta venta.
const VENTA_CATS_SERVICIO = ['consulta', 'cirugia', 'laboratorio', 'imagen', 'vacunacion', 'hospitalizacion', 'peluqueria', 'otro'];

function ventaAgregarServicioAlCatalogo({ nombre, cat, precio }) {
  const nom = (nombre || '').trim();
  if (!nom) return { error: 'Escribe el nombre del servicio' };
  const p = parseFloat(precio);
  if (isNaN(p) || p < 0) return { error: 'El precio no puede ser negativo' };
  const categoria = VENTA_CATS_SERVICIO.includes(cat) ? cat : 'otro';
  const nuevo = { id: 'pr' + Date.now(), nombre: nom, cat: categoria, precio: p, desc: '' };
  const procs = DB.get('procs');
  procs.push(nuevo);
  DB.set('procs', procs);
  return { proc: nuevo };
}

// ── Histórico de ventas (2026-10-06) — funciones puras ────────────────────
// Nada de DOM, nada de Supabase: VentasRepo.listarHistorico() ya entrega
// cada venta con propietario_nombre/mascota_nombre resueltos (no uuids) —
// acá solo se aplana a filas por ítem, se filtra y se calculan los KPIs.

// Una fila por ítem, no por venta: dos ventas con 2 ítems cada una dan 4
// filas. Es la unidad que pinta la tabla y la que filtra "producto/servicio"
// — mismo criterio que pidió Iván en el mockup (cada concepto, su propia
// fila con su propio valor).
function ventaAplanarHistorico(ventas) {
  const filas = [];
  (ventas || []).forEach(v => {
    (v.items || []).forEach(i => {
      filas.push({
        ventaId: v.id,
        fecha: v.fecha,
        createdAt: v.created_at,
        propietarioNombre: v.propietario_nombre || 'Mostrador',
        mascotaNombre: v.mascota_nombre || '',
        concepto: i.nombre,
        valor: parseFloat(i.subtotal) || 0,
        metodoPago: v.metodo_pago,
        anulado: !!v.anulado,
      });
    });
  });
  return filas;
}

// Texto vacío en un filtro = no filtra por ese campo. Los de texto son
// "contiene", sin mayúsculas/minúsculas — a esta escala (decenas/cientos de
// filas) no hace falta nada más fino.
function ventaFiltrarHistorico(filas, { propietario, mascota, producto, metodo, busqueda } = {}) {
  const prop = (propietario || '').trim().toLowerCase();
  const masc = (mascota || '').trim().toLowerCase();
  const q = (busqueda || '').trim().toLowerCase();
  return filas.filter(f => {
    if (prop && !f.propietarioNombre.toLowerCase().includes(prop)) return false;
    if (masc && !f.mascotaNombre.toLowerCase().includes(masc)) return false;
    if (producto && producto !== 'todos' && f.concepto !== producto) return false;
    if (metodo && metodo !== 'todos' && f.metodoPago !== metodo) return false;
    if (q) {
      const texto = `${f.propietarioNombre} ${f.mascotaNombre} ${f.concepto}`.toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  });
}

// Lista de conceptos distintos presentes en las filas — para poblar el
// <select> de "Producto/servicio", siempre acotada a lo que realmente
// existe en el rango cargado (nunca una lista fija que se desactualice).
function ventaListaConceptosHistorico(filas) {
  return [...new Set((filas || []).map(f => f.concepto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

// KPIs del período FILTRADO (no del total sin filtrar): si Iván filtra por
// un producto puntual, "Ventas del período" debe sumar solo esas filas, no
// el total de todas las ventas que de casualidad también tengan ese ítem.
// Las anuladas se excluyen siempre (mismo criterio que ventaCalcularResumen
// del widget del día) — se siguen viendo en la tabla, marcadas, pero no
// cuentan como ingreso.
function ventaCalcularKPIsHistorico(filasFiltradas, desdeFecha, hastaFecha) {
  const activas = (filasFiltradas || []).filter(f => !f.anulado);
  const total = activas.reduce((s, f) => s + f.valor, 0);
  const cantidad = new Set(activas.map(f => f.ventaId)).size;
  const ticketPromedio = cantidad ? total / cantidad : 0;
  const dias = Math.max(1, Math.round((new Date(hastaFecha) - new Date(desdeFecha)) / 86400000) + 1);
  const promedioDiario = total / dias;
  return { total, cantidad, ticketPromedio, promedioDiario };
}
