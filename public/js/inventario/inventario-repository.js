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
  },

  // ── Lotes (Ciclo 2) ──────────────────────────────────────────────────
  async listarLotesDeProducto(productoId) {
    const sb = getSB(); if (!sb || !productoId) return [];
    const { data, error } = await sb.from('inventario_stock_por_lote').select('*')
      .eq('producto_id', productoId).order('fecha_vencimiento', { ascending: true, nullsFirst: false });
    if (error) { console.warn('[inventario] listarLotesDeProducto:', error.message); return []; }
    return data || [];
  },

  // Desactivar un producto NO desactivaba sus lotes (bug encontrado el
  // 2026-10-05: un lote mal registrado quedaba "vencido" en el widget para
  // siempre, aunque el producto ya se hubiera desactivado). invDesactivarProducto
  // llama esto justo después de desactivar el producto — ver inventario-ui.js.
  async desactivarLotesDeProducto(productoId) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('lotes')
      .update({ activo: false }).eq('producto_id', productoId).eq('activo', true).select('id');
    if (error) throw error;
    return (data || []).length;
  },

  async crearLote(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('lotes').insert(fila).select().single();
    if (error) throw error;
    return data;
  },

  async actualizarLote(id, cambios) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('lotes').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── Kardex + vencimientos + últimos movimientos (Ciclo 3) ──────────────
  // Lotes activos con stock > 0 y vencimiento dentro del horizonte — 2
  // consultas en vez de un embedding de PostgREST (mismo criterio que
  // VentasRepo.listarVentas: más fácil de depurar, el volumen no justifica
  // optimizar). `inventario_stock_por_lote` no trae el nombre del producto,
  // por eso se cruza acá con `productos`.
  async listarVencimientosProximos(diasHorizonte = 90) {
    const sb = getSB(); if (!sb) return [];
    const limite = new Date(); limite.setDate(limite.getDate() + diasHorizonte);
    const limiteISO = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
    const { data: lotes, error } = await sb.from('inventario_stock_por_lote').select('*')
      .gt('stock_actual', 0).not('fecha_vencimiento', 'is', null)
      .lte('fecha_vencimiento', limiteISO).order('fecha_vencimiento', { ascending: true });
    if (error) { console.warn('[inventario] listarVencimientosProximos:', error.message); return []; }
    if (!lotes || !lotes.length) return [];

    const idsProductos = [...new Set(lotes.map(l => l.producto_id))];
    const { data: productos, error: errProd } = await sb.from('productos').select('id, nombre, unidad').in('id', idsProductos);
    if (errProd) { console.warn('[inventario] listarVencimientosProximos (productos):', errProd.message); return lotes; }
    const porId = {}; (productos || []).forEach(p => { porId[p.id] = p });
    return lotes.map(l => ({ ...l, producto_nombre: (porId[l.producto_id] || {}).nombre || '—', unidad: (porId[l.producto_id] || {}).unidad || '' }));
  },

  // Movimientos de un producto, orden ASCENDENTE (para calcular saldo
  // corrido) con el número de lote asociado si lo tiene — misma estrategia
  // de 2 consultas + merge en JS.
  async kardexDeProducto(productoId) {
    const sb = getSB(); if (!sb || !productoId) return [];
    const { data: movs, error } = await sb.from('inventario_movimientos').select('*')
      .eq('producto_id', productoId).order('created_at', { ascending: true });
    if (error) { console.warn('[inventario] kardexDeProducto:', error.message); return []; }
    if (!movs || !movs.length) return [];

    const idsLotes = [...new Set(movs.map(m => m.lote_id).filter(Boolean))];
    if (!idsLotes.length) return movs;
    const { data: lotes, error: errLotes } = await sb.from('lotes').select('id, numero_lote').in('id', idsLotes);
    if (errLotes) { console.warn('[inventario] kardexDeProducto (lotes):', errLotes.message); return movs; }
    const porId = {}; (lotes || []).forEach(l => { porId[l.id] = l.numero_lote });
    return movs.map(m => ({ ...m, numero_lote: m.lote_id ? (porId[m.lote_id] || null) : null }));
  },

  // Globales, de cualquier producto — para el widget "Últimos movimientos".
  async listarUltimosMovimientos(limite = 10) {
    const sb = getSB(); if (!sb) return [];
    const { data: movs, error } = await sb.from('inventario_movimientos').select('*')
      .order('created_at', { ascending: false }).limit(limite);
    if (error) { console.warn('[inventario] listarUltimosMovimientos:', error.message); return []; }
    if (!movs || !movs.length) return [];

    const idsProductos = [...new Set(movs.map(m => m.producto_id))];
    const { data: productos, error: errProd } = await sb.from('productos').select('id, nombre').in('id', idsProductos);
    if (errProd) { console.warn('[inventario] listarUltimosMovimientos (productos):', errProd.message); return movs; }
    const porId = {}; (productos || []).forEach(p => { porId[p.id] = p.nombre });
    return movs.map(m => ({ ...m, producto_nombre: porId[m.producto_id] || '—' }));
  }
};
