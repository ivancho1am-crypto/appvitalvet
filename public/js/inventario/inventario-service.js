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
// que explicarle al usuario que "para salida escribe negativo".
function invConstruirMovimiento({ productoId, accion, cantidad, motivo, nota, citaId }) {
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
      nota: (nota || '').trim() || null,
    }
  };
}
