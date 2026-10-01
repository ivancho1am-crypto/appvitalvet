// Módulo: Finanzas — reglas de negocio
//
// Nada de DOM, nada de Supabase. Solo cálculos y validaciones, igual que
// agenda-service.js / inventario-service.js.

const FIN_CATEGORIAS_GASTO = {
  insumos:            'Insumos / medicamentos',
  arriendo:           'Arriendo',
  servicios_publicos: 'Servicios públicos',
  nomina:             'Nómina',
  impuestos:          'Impuestos',
  mantenimiento:      'Mantenimiento / equipos',
  otro:               'Otro',
};

function finCategoriaLabel(cat) { return FIN_CATEGORIAS_GASTO[cat] || FIN_CATEGORIAS_GASTO.otro; }

// Rango [00:00, 23:59:59.999] del día dado (o de hoy) — mismo criterio que agRangoDia.
function finRangoDia(fecha) {
  const d = fecha ? new Date(fecha) : new Date();
  const ini = new Date(d); ini.setHours(0, 0, 0, 0);
  const fin = new Date(d); fin.setHours(23, 59, 59, 999);
  return { desde: ini, hasta: fin };
}

// Últimos 7 días, incluyendo hoy.
function finRangoSemana() {
  const hasta = new Date(); hasta.setHours(23, 59, 59, 999);
  const desde = new Date(hasta); desde.setDate(desde.getDate() - 6); desde.setHours(0, 0, 0, 0);
  return { desde, hasta };
}

// Del día 1 del mes actual a hoy.
function finRangoMes() {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
  const hasta = new Date(hoy); hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

// Valida y arma la fila de un gasto nuevo/editado.
function finConstruirGasto({ categoria, monto, descripcion, fecha, productoId }) {
  if (!categoria || !FIN_CATEGORIAS_GASTO[categoria]) return { error: 'Selecciona una categoría' };
  const m = parseFloat(monto);
  if (isNaN(m) || m <= 0) return { error: 'El monto debe ser mayor que cero' };
  if (!fecha) return { error: 'Selecciona una fecha' };
  return {
    fila: {
      categoria,
      monto: m,
      descripcion: (descripcion || '').trim() || null,
      fecha,
      producto_id: productoId || null,
    }
  };
}

// 'YYYY-MM-01' del mes de la fecha dada (o de hoy) — para consultar
// finanzas_resumen_mensual, que guarda `mes` truncado al primer día.
function finPrimerDiaMes(fecha) {
  const d = fecha ? new Date(fecha) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Suma FACTURADO/COBRADO/POR COBRAR de varias filas de
// finanzas_resumen_facturas (fallback cuando no hay fila en el resumen
// mensual, o para los rangos Hoy/Últimos 7 días, que no son un mes completo).
// Nunca se interpreta facturas.total como dinero cobrado — "cobrado" y
// "saldo_pendiente" salen siempre de la vista, nunca de un cálculo propio.
function finSumarResumenFacturas(filas) {
  return filas.reduce((acc, f) => ({
    facturado: acc.facturado + (parseFloat(f.facturado) || 0),
    cobrado:   acc.cobrado   + (parseFloat(f.cobrado) || 0),
    porCobrar: acc.porCobrar + (parseFloat(f.saldo_pendiente) || 0),
  }), { facturado: 0, cobrado: 0, porCobrar: 0 });
}

function finSumarGastos(gastos) {
  return gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
}

// Ventas directas (mostrador/servicios) — siempre se registran ya cobradas
// (decisión de Iván, 2026-10-02: no pasan por facturas/pagos), así que su
// total ES dinero cobrado, aunque viva en una tabla aparte de
// finanzas_resumen_*. Se suma acá, nunca dentro de `cobrado` (ese número
// tiene que seguir coincidiendo exacto con lo que dice la vista de
// Supabase) — ver "Total cobrado real" en la UI para el combinado.
function finSumarVentasDirectas(ventas) {
  return ventas.filter(v => !v.anulado).reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
}

// ── Pagos (Ciclo 4) ──────────────────────────────────────────────────────
const FIN_METODOS_PAGO = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro',
};

// Valida y arma la fila de un pago. `saldoPendiente` viene de
// finanzas_resumen_facturas (resuelto en finanzas-ui.js) — nunca se deja
// registrar un pago mayor al saldo real de la factura, para que "por
// cobrar" nunca se vuelva negativo por error de tipeo.
function finConstruirPago({ facturaId, cuentaId, monto, metodo, fecha, referencia, nota, saldoPendiente }) {
  if (!facturaId) return { error: 'Factura no encontrada' };
  if (!cuentaId) return { error: 'Selecciona una cuenta (caja/banco)' };
  const m = parseFloat(monto);
  if (isNaN(m) || m <= 0) return { error: 'El monto debe ser mayor que cero' };
  if (typeof saldoPendiente === 'number' && m > saldoPendiente + 0.01) {
    return { error: `El monto no puede superar el saldo pendiente (${saldoPendiente})` };
  }
  if (!metodo || !FIN_METODOS_PAGO[metodo]) return { error: 'Selecciona un método de pago' };
  if (!fecha) return { error: 'Selecciona fecha y hora' };
  return {
    fila: {
      factura_id: facturaId,
      cuenta_id: cuentaId,
      monto: m,
      metodo,
      fecha: new Date(fecha).toISOString(),
      referencia: (referencia || '').trim() || null,
      nota: (nota || '').trim() || null,
    }
  };
}
