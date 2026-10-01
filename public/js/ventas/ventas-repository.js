// Módulo: Ventas — capa de datos
//
// Único archivo de Ventas que habla con Supabase. Mismo patrón que
// agenda/inventario/finanzas-repository.js.
//
// `ventas`/`venta_items` son tablas propias (Opción B — ver
// db/migraciones/2026-10-01_ventas-v1.sql), todavía NO conectadas a
// cotizaciones/facturas. Independiente a propósito de FinanzasRepo /
// InventarioRepo (mismo criterio de los demás módulos entre sí): el único
// punto de contacto con Inventario es el `inventario_movimientos` que se
// crea al vender un producto, acá abajo.

const VentasRepo = {
  // Ventas del rango + sus ítems. Dos consultas simples en vez de un
  // embedding de PostgREST (venta_items(*)) — más fácil de razonar y de
  // depurar si algo falla, y acá el volumen diario no justifica optimizar.
  async listarVentas(desdeFecha, hastaFecha) {
    const sb = getSB(); if (!sb) return [];
    const { data: ventas, error } = await sb.from('ventas').select('*')
      .gte('fecha', desdeFecha).lte('fecha', hastaFecha)
      .order('created_at', { ascending: false });
    if (error) { console.warn('[ventas] listarVentas:', error.message); return []; }
    if (!ventas || !ventas.length) return [];

    const ids = ventas.map(v => v.id);
    const { data: items, error: errItems } = await sb.from('venta_items').select('*').in('venta_id', ids);
    if (errItems) { console.warn('[ventas] listarVentas (items):', errItems.message); return ventas.map(v => ({ ...v, items: [] })); }

    const itemsPorVenta = {};
    (items || []).forEach(i => { (itemsPorVenta[i.venta_id] = itemsPorVenta[i.venta_id] || []).push(i) });
    return ventas.map(v => ({ ...v, items: itemsPorVenta[v.id] || [] }));
  },

  // Inserta la venta, sus ítems, y por cada ítem de producto el movimiento
  // de salida en Inventario. Secuencial, no es una transacción atómica real
  // (no hay RPC de Postgres para esto todavía — de más para este ciclo): si
  // algo falla a mitad de camino, se lanza un error que dice en qué paso
  // quedó, para que ventas-ui.js pueda avisar exactamente qué se alcanzó a
  // guardar en vez de un "algo salió mal" genérico.
  async crearVenta(ventaFila, itemsFilas) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const correo = await _ventaUsuarioActual();

    const { data: venta, error: errVenta } = await sb.from('ventas')
      .insert({ ...ventaFila, creado_por: ventaFila.creado_por || correo }).select().single();
    if (errVenta) throw new Error('No se pudo crear la venta: ' + errVenta.message);

    const itemsConVentaId = itemsFilas.map(i => ({ ...i, venta_id: venta.id }));
    const { error: errItems } = await sb.from('venta_items').insert(itemsConVentaId);
    if (errItems) throw new Error(`Venta #${venta.id} creada, pero fallaron sus ítems: ` + errItems.message);

    const movimientos = itemsFilas
      .filter(i => i.tipo === 'producto' && i.producto_id)
      .map(i => ({
        producto_id: i.producto_id,
        cantidad: -Math.abs(i.cantidad),
        motivo: 'venta',
        // venta_id (Ciclo 2 de Inventario, 2026-10-03): enlace real además
        // de la nota de texto — se mantienen los dos; la nota sigue
        // sirviendo si `venta_id` todavía no existe en Supabase (código
        // desplegado antes que la migración), y venta_id permite un join
        // real para el Kardex una vez que la columna exista.
        venta_id: venta.id,
        nota: `Venta #${venta.id}`,
      }));
    if (movimientos.length) {
      const { error: errMov } = await sb.from('inventario_movimientos').insert(movimientos);
      if (errMov) throw new Error(`Venta #${venta.id} y sus ítems quedaron guardados, pero el inventario NO se descontó: ` + errMov.message);
    }

    return venta;
  },

  // Mismo criterio que anularGasto/anularPago: no se borra, se anula. OJO:
  // no revierte el inventario_movimientos asociado — limitación conocida de
  // este ciclo (ver reporte), habría que ajustarlo a mano en Inventario si
  // hace falta.
  async anularVenta(id) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const correo = await _ventaUsuarioActual();
    const { error } = await sb.from('ventas')
      .update({ anulado: true, anulado_at: new Date().toISOString(), anulado_por: correo })
      .eq('id', id);
    if (error) throw error;
  },
};

// Mismo patrón que _finUsuarioActual (finanzas-repository.js) y _rSaludo
// (dashboard.js) — duplicado acá a propósito, no importado entre módulos.
async function _ventaUsuarioActual() {
  try {
    const sb = getSB(); if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return (session && session.user && session.user.email) || null;
  } catch { return null; }
}
