// Módulo: Inventario — capa de datos
//
// Único archivo de Inventario que habla con Supabase. `productos` e
// `inventario_movimientos` son tablas relacionales nuevas (ver
// db/migraciones/2026-09-30_inventario-v1.sql) — no son parte de
// vv_store/DB, así que cada función consulta Supabase directo, igual que
// agenda-repository.js.
//
// El stock NUNCA se calcula aquí a mano: siempre se lee de la vista
// `inventario_stock_actual` (SUM de los movimientos), para que solo haya
// un lugar donde el número pueda estar mal.

const InventarioRepo = {
  async listarProductos() {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('productos').select('*')
      .eq('activo', true).order('nombre', { ascending: true });
    if (error) { console.warn('[inventario] listarProductos:', error.message); return []; }
    return data || [];
  },

  // Catálogo + stock actual en una sola llamada (lo que pinta la tabla).
  async listarStock() {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('inventario_stock_actual').select('*')
      .order('nombre', { ascending: true });
    if (error) { console.warn('[inventario] listarStock:', error.message); return []; }
    return data || [];
  },

  async crearProducto(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('productos').insert(fila).select().single();
    if (error) throw error;
    return data;
  },

  async actualizarProducto(id, cambios) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('productos').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async registrarMovimiento(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('inventario_movimientos').insert(fila).select().single();
    if (error) throw error;
    return data;
  },

  // Historial de un producto, el más reciente primero (para el modal de detalle).
  async historialProducto(productoId) {
    const sb = getSB(); if (!sb || !productoId) return [];
    const { data, error } = await sb.from('inventario_movimientos').select('*')
      .eq('producto_id', productoId).order('created_at', { ascending: false });
    if (error) { console.warn('[inventario] historialProducto:', error.message); return []; }
    return data || [];
  },

  // Cuántos productos están en o por debajo de su stock mínimo (badge del sidebar).
  async contarBajoStock() {
    const sb = getSB(); if (!sb) return 0;
    const { data, error } = await sb.from('inventario_stock_actual').select('producto_id, stock_actual, stock_minimo');
    if (error) { console.warn('[inventario] contarBajoStock:', error.message); return 0; }
    return (data || []).filter(r => r.stock_actual <= r.stock_minimo).length;
  }
};
