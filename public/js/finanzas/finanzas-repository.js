// Módulo: Finanzas — capa de datos
//
// Único archivo de Finanzas que habla con Supabase. Mismo patrón que
// agenda-repository.js / inventario-repository.js.
//
// OJO: los INGRESOS no tienen tabla propia de Finanzas — se leen directo de
// `facturas`, que ya crea Cotizaciones al emitir una factura (cotizacion.js,
// generarFactura()). Finanzas nunca escribe ahí, solo lee — así el número de
// ingresos es siempre el mismo que ve Cotizaciones, sin una segunda copia
// que se pueda desincronizar.

const FinanzasRepo = {
  // Facturas emitidas en el rango (los "ingresos" reales de la clínica).
  async listarFacturas(desdeISO, hastaISO) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('facturas').select('*')
      .gte('created_at', desdeISO).lte('created_at', hastaISO)
      .order('created_at', { ascending: false });
    if (error) { console.warn('[finanzas] listarFacturas:', error.message); return []; }
    return data || [];
  },

  async listarGastos(desdeFecha, hastaFecha) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('gastos').select('*')
      .gte('fecha', desdeFecha).lte('fecha', hastaFecha)
      .order('fecha', { ascending: false });
    if (error) { console.warn('[finanzas] listarGastos:', error.message); return []; }
    return data || [];
  },

  async crearGasto(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('gastos').insert(fila).select().single();
    if (error) throw error;
    return data;
  },

  async actualizarGasto(id, cambios) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('gastos').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async eliminarGasto(id) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { error } = await sb.from('gastos').delete().eq('id', id);
    if (error) throw error;
  }
};
