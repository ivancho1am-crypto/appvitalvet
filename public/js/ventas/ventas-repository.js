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

    // El panel manda el id de vv_store del propietario ('p1738…'), pero la
    // columna es uuid y apunta a `tutores`. Se traduce acá, que es la capa
    // que habla con la base. Ver _ventaResolverTutorId abajo.
    const propietarioUuid = await _ventaResolverTutorId(sb, ventaFila.propietario_id);

    const { data: venta, error: errVenta } = await sb.from('ventas')
      .insert({ ...ventaFila, propietario_id: propietarioUuid, creado_por: ventaFila.creado_por || correo })
      .select().single();
    if (errVenta) {
      // Mientras no se aplique db/migraciones/2026-10-02_ventas-propietario-a-tutores.sql,
      // la FK de propietario_id sigue apuntando a `propietarios` (vacía) y
      // cualquier venta con propietario registrado rebota acá. El mensaje de
      // Postgres no dice nada útil, así que se traduce.
      const esFKPropietario = /foreign key|violates/i.test(errVenta.message || '') &&
                              /propietario/i.test(errVenta.message || '');
      if (esFKPropietario) {
        throw new Error('Falta aplicar en Supabase la migración db/migraciones/2026-10-02_ventas-propietario-a-tutores.sql. Mientras tanto, registrá la venta como mostrador.');
      }
      throw new Error('No se pudo crear la venta: ' + errVenta.message);
    }

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

  // Mismo criterio que anularGasto/anularPago: no se borra, se anula. Y
  // desde 2026-10-02 también DEVUELVE el stock al inventario: antes la venta
  // quedaba anulada pero el producto seguía descontado y había que
  // corregirlo a mano.
  //
  // El orden importa. Primero se anula y después se devuelve el stock, no al
  // revés: si fallara el paso 2 queda una venta anulada con el stock todavía
  // descontado — exactamente el comportamiento viejo, molesto pero inofensivo
  // y corregible desde "🔢 Existencias". Al revés sería peor: stock devuelto
  // sobre una venta que sigue activa, o sea inventario inflado.
  async anularVenta(id) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const correo = await _ventaUsuarioActual();

    // Anular dos veces devolvería el stock por duplicado.
    const { data: actual, error: errLeer } = await sb.from('ventas')
      .select('id, anulado').eq('id', id).maybeSingle();
    if (errLeer) throw new Error('No se pudo leer la venta: ' + errLeer.message);
    if (!actual) throw new Error('Esa venta ya no existe');
    if (actual.anulado) throw new Error('Esa venta ya estaba anulada');

    const { error } = await sb.from('ventas')
      .update({ anulado: true, anulado_at: new Date().toISOString(), anulado_por: correo })
      .eq('id', id);
    if (error) throw error;

    // Solo los movimientos de motivo 'venta': las devoluciones que escribe
    // esta misma función también llevan venta_id, y sin este filtro una
    // segunda anulación las volvería a sumar.
    const { data: movs, error: errMovs } = await sb.from('inventario_movimientos')
      .select('producto_id, cantidad, lote_id').eq('venta_id', id).eq('motivo', 'venta');
    if (errMovs) throw new Error('Venta anulada, pero no pude leer sus movimientos de inventario: ' + errMovs.message);

    const devoluciones = (movs || [])
      .filter(m => (parseFloat(m.cantidad) || 0) < 0)
      .map(m => ({
        producto_id: m.producto_id,
        lote_id: m.lote_id || null,          // vuelve al mismo lote si salió de uno
        cantidad: Math.abs(parseFloat(m.cantidad)),
        motivo: 'devolucion',
        venta_id: id,
        nota: `Anulación de venta #${id}`,
      }));

    if (devoluciones.length) {
      const { error: errDev } = await sb.from('inventario_movimientos').insert(devoluciones);
      if (errDev) throw new Error('Venta anulada, pero el stock NO se devolvió al inventario: ' + errDev.message + ' — corregilo con "🔢 Existencias" en Inventario.');
    }
    return { productosDevueltos: devoluciones.length };
  },
};

// El select de propietario se llena con DB.get('props') (vv_store), así que
// manda ids tipo 'p1738…'. Pero ventas.propietario_id es uuid y apunta a
// `tutores`. El puente es tutores.saas_prop_id, el mismo enlace que usa
// js/espejo.js. Sin esta traducción, toda venta con propietario registrado
// fallaba (la de mostrador no, porque ahí va NULL).
const _RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function _ventaResolverTutorId(sb, propietarioId) {
  if (!propietarioId) return null;                        // venta de mostrador
  if (_RE_UUID.test(propietarioId)) return propietarioId; // ya venía resuelto
  const { data, error } = await sb.from('tutores')
    .select('id').eq('saas_prop_id', propietarioId).maybeSingle();
  if (error) throw new Error('No se pudo buscar el propietario: ' + error.message);
  if (!data) {
    throw new Error('Ese propietario todavía no llegó a la base relacional. Entrá a Inicio → "🔗 Espejo relacional" → Verificar ahora → Reparar, y volvé a intentar la venta.');
  }
  return data.id;
}

// Mismo patrón que _finUsuarioActual (finanzas-repository.js) y _rSaludo
// (dashboard.js) — duplicado acá a propósito, no importado entre módulos.
async function _ventaUsuarioActual() {
  try {
    const sb = getSB(); if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return (session && session.user && session.user.email) || null;
  } catch { return null; }
}
