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

// Valida y arma la fila de un producto nuevo/editado.
function invConstruirProducto({ nombre, categoria, unidad, stockMinimo, costo, precio, proveedor }) {
  if (!nombre || !nombre.trim()) return { error: 'Escribe el nombre del producto' };
  if (!categoria || !INV_CATEGORIAS[categoria]) return { error: 'Selecciona una categoría' };
  const min = parseFloat(stockMinimo);
  if (stockMinimo !== '' && (isNaN(min) || min < 0)) return { error: 'Stock mínimo inválido' };
  return {
    fila: {
      nombre: nombre.trim(),
      categoria,
      unidad: (unidad || 'unidad').trim(),
      stock_minimo: isNaN(min) ? 0 : min,
      costo_unitario: costo === '' || costo == null ? null : parseFloat(costo),
      precio_venta: precio === '' || precio == null ? null : parseFloat(precio),
      proveedor: (proveedor || '').trim() || null,
    }
  };
}

// Valida y arma la fila de un movimiento. `accion` decide el signo de
// `cantidad`: así el formulario siempre pide un número positivo y nunca hay
// que explicarle al usuario que "para salida escribe negativo".
function invConstruirMovimiento({ productoId, accion, cantidad, motivo, nota }) {
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
      nota: (nota || '').trim() || null,
    }
  };
}
