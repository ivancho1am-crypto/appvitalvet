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
function ventaConstruirCabecera({ propietarioId, clienteNombre, fecha, items, metodoPago, cuentaId }) {
  if (!items || !items.length) return { error: 'Agrega al menos un ítem a la venta' };
  if (!propietarioId && !(clienteNombre || '').trim()) {
    return { error: 'Selecciona un propietario o escribe un nombre de mostrador' };
  }
  if (!fecha) return { error: 'Selecciona una fecha' };
  if (!metodoPago || !VENTA_METODOS_PAGO[metodoPago]) return { error: 'Selecciona un método de pago' };
  const total = items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);
  return {
    venta: {
      propietario_id: propietarioId || null,
      cliente_nombre: propietarioId ? null : clienteNombre.trim(),
      fecha,
      metodo_pago: metodoPago,
      cuenta_id: cuentaId || null,
      total: Math.round(total * 100) / 100,
    }
  };
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
