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

// El balance nunca se guarda: siempre se calcula a partir de lo que ya se
// leyó de `facturas` y `gastos` — mismo criterio que el stock de Inventario.
function finCalcularResumen(facturas, gastos) {
  const ingresos = facturas.reduce((s, f) => s + (parseFloat(f.total) || 0), 0);
  const totalGastos = gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  return { ingresos, gastos: totalGastos, balance: ingresos - totalGastos };
}
