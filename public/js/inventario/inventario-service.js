// Módulo: Inventario — reglas de negocio
//
// Nada de DOM, nada de Supabase. Solo cálculos y validaciones, igual que
// agenda-service.js.

const INV_CATEGORIAS = {
  medicamento:       { label: 'Medicamento',        icon: '💊' },
  vacuna:            { label: 'Vacuna',              icon: '💉' },
  insumo_quirurgico: { label: 'Insumo quirúrgico',    icon: '🩹' },
  alimento:          { label: 'Alimento',             icon: '🥫' },
  otro:              { label: 'Otro',                 icon: '📦' },
};

const INV_MOTIVOS = {
  compra:       'Compra (entrada)',
  uso_clinico:  'Uso clínico (salida)',
  merma:        'Merma / vencido (salida)',
  ajuste:       'Ajuste de conteo',
  devolucion:   'Devolución de proveedor (salida)',
  otro:         'Otro',
};

function invCategoriaInfo(cat) { return INV_CATEGORIAS[cat] || INV_CATEGORIAS.otro; }

// Un producto está en alerta si su stock ya llegó (o bajó de) su mínimo.
// stock_minimo en 0 nunca genera alerta — así un producto sin umbral definido
// no aparece en rojo por defecto.
function invEsBajoStock(row) {
  return row.stock_minimo > 0 && row.stock_actual <= row.stock_minimo;
}

// Mismo criterio que invEsBajoStock pero del otro lado: solo alerta si hay
// stock_maximo definido (muchos productos nunca van a tener uno, y eso no
// debe generar ruido).
function invEsSobreStock(row) {
  return row.stock_maximo != null && row.stock_maximo > 0 && row.stock_actual > row.stock_maximo;
}

// Valida y arma la fila de un producto nuevo/editado. Los campos de Fase 1
// (codigo/presentacion/codigoBarras/stockMaximo/puntoReorden/ubicacion) son
// todos opcionales — un producto viejo sin ninguno sigue siendo válido.
function invConstruirProducto({ nombre, categoria, unidad, stockMinimo, costo, precio, proveedor,
                                 codigo, presentacion, codigoBarras, stockMaximo, puntoReorden, ubicacion }) {
  if (!nombre || !nombre.trim()) return { error: 'Escribe el nombre del producto' };
  if (!categoria || !INV_CATEGORIAS[categoria]) return { error: 'Selecciona una categoría' };
  const min = parseFloat(stockMinimo);
  if (stockMinimo !== '' && (isNaN(min) || min < 0)) return { error: 'Stock mínimo inválido' };
  const max = stockMaximo === '' || stockMaximo == null ? null : parseFloat(stockMaximo);
  if (stockMaximo !== '' && stockMaximo != null && isNaN(max)) return { error: 'Stock máximo inválido' };
  if (max != null && max < (isNaN(min) ? 0 : min)) return { error: 'El stock máximo no puede ser menor que el mínimo' };
  const reorden = puntoReorden === '' || puntoReorden == null ? null : parseFloat(puntoReorden);
  if (puntoReorden !== '' && puntoReorden != null && isNaN(reorden)) return { error: 'Punto de reorden inválido' };
  return {
    fila: {
      nombre: nombre.trim(),
      categoria,
      unidad: (unidad || 'unidad').trim(),
      stock_minimo: isNaN(min) ? 0 : min,
      costo_unitario: costo === '' || costo == null ? null : parseFloat(costo),
      precio_venta: precio === '' || precio == null ? null : parseFloat(precio),
      proveedor: (proveedor || '').trim() || null,
      codigo: (codigo || '').trim() || null,
      presentacion: (presentacion || '').trim() || null,
      codigo_barras: (codigoBarras || '').trim() || null,
      stock_maximo: max,
      punto_reorden: reorden,
      ubicacion: (ubicacion || '').trim() || null,
    }
  };
}

// Valida y arma la fila de un movimiento. `accion` decide el signo de
// `cantidad`: así el formulario siempre pide un número positivo y nunca hay
// que explicarle al usuario que "para salida escribe negativo". `loteId` es
// opcional — productos sin lote (o movimientos de categorías que no lo
// necesitan) siguen funcionando exactamente igual que antes.
function invConstruirMovimiento({ productoId, accion, cantidad, motivo, nota, citaId, loteId }) {
  if (!productoId) return { error: 'Selecciona un producto' };
  if (accion !== 'entrada' && accion !== 'salida') return { error: 'Selecciona entrada o salida' };
  const cant = parseFloat(cantidad);
  if (isNaN(cant) || cant <= 0) return { error: 'La cantidad debe ser mayor que cero' };
  if (!motivo || !INV_MOTIVOS[motivo]) return { error: 'Selecciona un motivo' };
  return {
    fila: {
      producto_id: productoId,
      cantidad: accion === 'entrada' ? cant : -cant,
      motivo,
      // Opcional: si el movimiento corresponde a una cita puntual (ej. se usó
      // una vacuna durante esa consulta), queda enlazado — sin tocar historia
      // clínica ni vv_store, solo una referencia de contexto en inventario.
      cita_id: citaId || null,
      lote_id: loteId || null,
      nota: (nota || '').trim() || null,
    }
  };
}

// Valida y arma, en un solo paso, el lote nuevo Y el movimiento de entrada
// inicial que le corresponde — crear un lote con cantidad > 0 SIEMPRE
// genera su movimiento, nunca queda como un número suelto sin respaldo en
// inventario_movimientos (eso rompería la regla de "el stock es la suma de
// los movimientos"). `loteFila`/`movimientoFila` se insertan en dos pasos
// desde el repository (el movimiento necesita el id del lote recién
// creado), pero los dos se validan juntos acá.
function invConstruirLote({ productoId, numeroLote, fechaFabricacion, fechaVencimiento, cantidadInicial, costoUnitario, proveedor }) {
  if (!productoId) return { error: 'Selecciona un producto' };
  if (!numeroLote || !numeroLote.trim()) return { error: 'Escribe el número de lote' };
  const cant = parseFloat(cantidadInicial);
  if (isNaN(cant) || cant <= 0) return { error: 'La cantidad inicial debe ser mayor que cero' };
  if (fechaFabricacion && fechaVencimiento && fechaFabricacion > fechaVencimiento) {
    return { error: 'La fecha de fabricación no puede ser posterior al vencimiento' };
  }
  const costo = costoUnitario === '' || costoUnitario == null ? null : parseFloat(costoUnitario);
  return {
    loteFila: {
      producto_id: productoId,
      numero_lote: numeroLote.trim(),
      fecha_fabricacion: fechaFabricacion || null,
      fecha_vencimiento: fechaVencimiento || null,
      cantidad_inicial: cant,
      costo_unitario: costo,
      proveedor: (proveedor || '').trim() || null,
    },
    // Se completa con producto_id/lote_id/creado_por en inventario-ui.js,
    // una vez que el lote ya tiene id — acá solo lo que ya se conoce.
    movimientoBase: { cantidad: cant, motivo: 'compra' },
  };
}

// Corregir un lote YA creado (2026-10-05): número/fechas/costo/proveedor,
// nunca cantidad_inicial — es un dato histórico ("lo que entró ese día"),
// igual que ya dice el comentario de la migración. Si la cantidad real
// estaba mal, eso se corrige con un movimiento de ajuste (🔢 Existencias),
// no editando el lote.
//
// Se construyó porque no existía NINGUNA forma de arreglar un lote mal
// registrado salvo crear uno nuevo — eso fue justo lo que generó 3 lotes
// "WPT2504" distintos (uno por cada intento de corrección) en vez de 1.
function invConstruirEdicionLote({ numeroLote, fechaFabricacion, fechaVencimiento, costoUnitario, proveedor }) {
  if (!numeroLote || !numeroLote.trim()) return { error: 'Escribe el número de lote' };
  if (fechaFabricacion && fechaVencimiento && fechaFabricacion > fechaVencimiento) {
    return { error: 'La fecha de fabricación no puede ser posterior al vencimiento' };
  }
  const costo = costoUnitario === '' || costoUnitario == null ? null : parseFloat(costoUnitario);
  if (costo != null && (isNaN(costo) || costo < 0)) return { error: 'El costo no puede ser negativo' };
  return {
    cambios: {
      numero_lote: numeroLote.trim(),
      fecha_fabricacion: fechaFabricacion || null,
      fecha_vencimiento: fechaVencimiento || null,
      costo_unitario: costo,
      proveedor: (proveedor || '').trim() || null,
    },
  };
}

// ── Kardex, vencimientos, valor de inventario, conteo físico (Ciclo 3) ─────

// Recorre movimientos YA ordenados cronológicamente (ascendente) y agrega
// el saldo corrido a cada uno — se calcula siempre al vuelo, nunca se
// guarda un saldo en ninguna tabla (mismo criterio que el stock general).
function invCalcularKardex(movimientos) {
  let saldo = 0;
  return movimientos.map(m => {
    saldo += (parseFloat(m.cantidad) || 0);
    return {
      ...m,
      entrada: m.cantidad > 0 ? m.cantidad : null,
      salida: m.cantidad < 0 ? Math.abs(m.cantidad) : null,
      saldo,
      // Documento: de dónde vino el movimiento, para la columna del Kardex.
      documento: m.venta_id ? 'Venta' : m.cita_id ? 'Cita' : '—',
    };
  });
}

const INV_DIAS_ROJO = 30;
const INV_DIAS_AMARILLO = 90;

// 'vencido' | 'rojo_30' | 'amarillo_90' | null (fuera de horizonte o sin fecha)
function invClasificarVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + 'T00:00:00');
  const dias = Math.round((venc - hoy) / 86400000);
  if (dias < 0) return 'vencido';
  if (dias <= INV_DIAS_ROJO) return 'rojo_30';
  if (dias <= INV_DIAS_AMARILLO) return 'amarillo_90';
  return null;
}

const INV_VENC_INFO = {
  vencido:     { icon: '🔴', label: 'Vencido',     badge: 'bg-red' },
  rojo_30:     { icon: '🟠', label: '0-30 días',   badge: 'bg-yellow' },
  amarillo_90: { icon: '🟡', label: '31-90 días',  badge: 'bg-yellow' },
};

// Suma stock_actual * costo_unitario. Si un producto no tiene costo_unitario
// cargado, usa precio_venta como respaldo (nunca inventa un número) y lo
// marca en `conFallback` — para no mentir sobre qué tan confiable es el
// total mostrado.
function invCalcularValorInventario(filasConStock) {
  let total = 0, conFallback = 0;
  filasConStock.forEach(p => {
    const costo = p.costo_unitario != null ? p.costo_unitario : p.precio_venta;
    if (costo == null) return;
    if (p.costo_unitario == null) conFallback++;
    total += (parseFloat(p.stock_actual) || 0) * costo;
  });
  return { total: Math.round(total * 100) / 100, conFallback };
}

// Conteo físico: arma el movimiento de ajuste (nunca toca stock directo —
// ya es imposible, no existe esa columna; esto deja explícita la regla).
// diferencia = contado - sistema; si da 0, no hay nada que ajustar.
function invConstruirAjusteConteo({ productoId, stockSistema, stockContado, nota }) {
  if (!productoId) return { error: 'Selecciona un producto' };
  const sistema = parseFloat(stockSistema);
  const contado = parseFloat(stockContado);
  if (isNaN(contado)) return { error: 'Escribe el conteo físico' };
  const diferencia = Math.round((contado - (isNaN(sistema) ? 0 : sistema)) * 100) / 100;
  if (diferencia === 0) return { error: 'No hay diferencia — nada que ajustar' };
  return {
    diferencia,
    fila: {
      producto_id: productoId,
      cantidad: diferencia,
      motivo: 'ajuste',
      nota: (nota || '').trim() || `Conteo físico: sistema ${isNaN(sistema) ? 0 : sistema}, contado ${contado}`,
    }
  };
}
