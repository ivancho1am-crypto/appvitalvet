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

  // Crea la venta + sus ítems + el movimiento de inventario de cada
  // producto. Desde 2026-10-05 intenta hacerlo ATÓMICO de verdad, vía la
  // función crear_venta_completa() (ver db/migraciones/2026-10-05_ventas-
  // transaccional.sql): si cualquier paso falla, Postgres revierte TODO
  // solo, no hay estado parcial posible. Si esa migración todavía no se
  // aplicó, cae al camino secuencial de siempre (_ventaCrearSecuencial) sin
  // romper nada — esto es puramente aditivo.
  async crearVenta(ventaFila, itemsFilas) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const correo = await _ventaUsuarioActual();

    // El panel manda el id de vv_store del propietario ('p1738…'), pero la
    // columna es uuid y apunta a `tutores`. Se traduce acá, que es la capa
    // que habla con la base. Ver _ventaResolverTutorId abajo.
    const propietarioUuid = await _ventaResolverTutorId(sb, ventaFila.propietario_id);
    const creadoPor = ventaFila.creado_por || correo;

    const { data: viaRPC, error: errRPC } = await sb.rpc('crear_venta_completa', {
      p_propietario_id: propietarioUuid,
      p_cliente_nombre: ventaFila.cliente_nombre || null,
      p_fecha: ventaFila.fecha,
      p_metodo_pago: ventaFila.metodo_pago,
      p_cuenta_id: ventaFila.cuenta_id || null,
      p_total: ventaFila.total,
      p_creado_por: creadoPor,
      p_items: itemsFilas,
    });

    if (!errRPC) return viaRPC;

    // PGRST202 = PostgREST no encontró la función — la migración todavía no
    // se aplicó. Cualquier OTRO error (ej. la FK de propietario sin migrar
    // también) sí se reporta tal cual, igual que antes.
    const funcionNoExiste = errRPC.code === 'PGRST202' || /crear_venta_completa/i.test(errRPC.message || '');
    if (!funcionNoExiste) {
      const esFKPropietario = /foreign key|violates/i.test(errRPC.message || '') && /propietario/i.test(errRPC.message || '');
      if (esFKPropietario) {
        throw new Error('Falta aplicar en Supabase la migración db/migraciones/2026-10-02_ventas-propietario-a-tutores.sql. Mientras tanto, registrá la venta como mostrador.');
      }
      throw new Error('No se pudo crear la venta: ' + errRPC.message);
    }

    console.warn('[ventas] crear_venta_completa no existe todavía (falta aplicar db/migraciones/2026-10-05_ventas-transaccional.sql) — usando el modo secuencial de respaldo, igual que siempre.');
    return _ventaCrearSecuencial(sb, { ...ventaFila, propietario_id: propietarioUuid, creado_por: creadoPor }, itemsFilas);
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

// Camino de respaldo de crearVenta() — el que existía antes de 2026-10-05,
// sin cambiar su comportamiento: 3 inserts secuenciales, con el mensaje de
// error específico de en qué paso se quedó si algo falla a mitad de camino.
// Puede dejar un estado parcial en la base (exactamente la deuda técnica que
// crear_venta_completa resuelve) — se conserva solo para que la app siga
// funcionando igual que siempre en cualquier ambiente donde esa migración
// todavía no se haya aplicado.
async function _ventaCrearSecuencial(sb, ventaFila, itemsFilas) {
  const { data: venta, error: errVenta } = await sb.from('ventas')
    .insert(ventaFila).select().single();
  if (errVenta) {
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
      venta_id: venta.id,
      nota: `Venta #${venta.id}`,
    }));
  if (movimientos.length) {
    const { error: errMov } = await sb.from('inventario_movimientos').insert(movimientos);
    if (errMov) throw new Error(`Venta #${venta.id} y sus ítems quedaron guardados, pero el inventario NO se descontó: ` + errMov.message);
  }

  return venta;
}

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
