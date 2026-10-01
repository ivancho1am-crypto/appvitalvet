// Módulo: Finanzas — capa de datos
//
// Único archivo de Finanzas que habla con Supabase. Mismo patrón que
// agenda-repository.js / inventario-repository.js.
//
// Esquema real confirmado contra Supabase (OpenAPI de PostgREST, 2026-10-01)
// antes de escribir esto — no se adivinó ninguna columna:
//
//   finanzas_resumen_facturas: factura_id, propietario_id, facturado,
//     cobrado, saldo_pendiente, estado, fecha
//   finanzas_resumen_mensual: mes, facturado, cobrado, por_cobrar, gastos
//   gastos: ...+ anulado, anulado_at, anulado_por (antes no existían)
//
// FACTURADO/COBRADO/POR COBRAR nunca se calculan a mano sobre facturas.total
// — siempre se leen de estas vistas, que ya conocen los pagos reales.

const FinanzasRepo = {
  // Facturas emitidas en el rango (tabla cruda: tiene `numero`, que las
  // vistas de resumen no traen — por eso se consulta aparte).
  async listarFacturas(desdeFecha, hastaFecha) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('facturas').select('*')
      .gte('fecha', desdeFecha).lte('fecha', hastaFecha)
      .order('fecha', { ascending: false });
    if (error) { console.warn('[finanzas] listarFacturas:', error.message); return []; }
    return data || [];
  },

  // FACTURADO/COBRADO/POR COBRAR por factura, ya resueltos en Supabase.
  async resumenFacturasEnRango(desdeFecha, hastaFecha) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('finanzas_resumen_facturas').select('*')
      .gte('fecha', desdeFecha).lte('fecha', hastaFecha)
      .order('fecha', { ascending: false });
    if (error) { console.warn('[finanzas] resumenFacturasEnRango:', error.message); return []; }
    return data || [];
  },

  // Resumen de un mes completo, ya agregado en Supabase. Devuelve null si
  // ese mes todavía no tiene fila (p.ej. con las tablas financieras en 0
  // registros) — la UI cae entonces al cálculo por factura de arriba.
  async resumenMensual(mesISO) {
    const sb = getSB(); if (!sb) return null;
    const { data, error } = await sb.from('finanzas_resumen_mensual').select('*')
      .eq('mes', mesISO).maybeSingle();
    if (error) { console.warn('[finanzas] resumenMensual:', error.message); return null; }
    return data || null;
  },

  // Solo gastos NO anulados — un gasto anulado no debe sumar en el resumen.
  async listarGastos(desdeFecha, hastaFecha) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('gastos').select('*')
      .eq('anulado', false)
      .gte('fecha', desdeFecha).lte('fecha', hastaFecha)
      .order('fecha', { ascending: false });
    if (error) { console.warn('[finanzas] listarGastos:', error.message); return []; }
    return data || [];
  },

  async crearGasto(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const payload = { ...fila, creado_por: fila.creado_por || await _finUsuarioActual() };
    const { data, error } = await sb.from('gastos').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async actualizarGasto(id, cambios) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('gastos').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Antes esto borraba la fila de verdad. `gastos` ahora tiene
  // anulado/anulado_at/anulado_por (mismo patrón que `pagos`) — un gasto ya
  // no se borra, se anula, para no perder el rastro de auditoría de un
  // movimiento financiero real.
  async anularGasto(id) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const correo = await _finUsuarioActual();
    const { error } = await sb.from('gastos')
      .update({ anulado: true, anulado_at: new Date().toISOString(), anulado_por: correo })
      .eq('id', id);
    if (error) throw error;
  },

  // ── Pagos (Ciclo 4) ────────────────────────────────────────────────────
  // Cuentas de caja/banco activas, para el <select> del modal de pago.
  async listarCuentas() {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('financial_accounts').select('*')
      .eq('activo', true).order('nombre', { ascending: true });
    if (error) { console.warn('[finanzas] listarCuentas:', error.message); return []; }
    return data || [];
  },

  // Pagos de una factura (solo lectura, para el historial). No filtra
  // anulado=false a propósito: un pago anulado debe seguir viéndose en el
  // historial (tachado en la UI), igual que pasa con un pago real anulado
  // en cualquier sistema contable — desaparecer la fila sería peor que
  // mostrarla marcada.
  async pagosDeFactura(facturaId) {
    const sb = getSB(); if (!sb || !facturaId) return [];
    const { data, error } = await sb.from('pagos').select('*')
      .eq('factura_id', facturaId).order('fecha', { ascending: false });
    if (error) { console.warn('[finanzas] pagosDeFactura:', error.message); return []; }
    return data || [];
  },

  // Al insertar, finanzas_resumen_facturas/finanzas_resumen_mensual quedan
  // al día solas (son vistas que agregan sobre `pagos`) — no hace falta
  // recalcular "cobrado" ni "por cobrar" a mano en ningún lado.
  async crearPago(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const payload = { ...fila, creado_por: fila.creado_por || await _finUsuarioActual() };
    const { data, error } = await sb.from('pagos').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  // Mismo criterio que anularGasto: un pago no se borra, se anula.
  async anularPago(id) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const correo = await _finUsuarioActual();
    const { error } = await sb.from('pagos')
      .update({ anulado: true, anulado_at: new Date().toISOString(), anulado_por: correo })
      .eq('id', id);
    if (error) throw error;
  },
};

// Mismo patrón que dashboard.js (_rSaludo): si no hay sesión todavía, se
// queda en null sin romper nada — creado_por/anulado_por simplemente quedan
// vacíos en vez de fallar el guardado.
async function _finUsuarioActual() {
  try {
    const sb = getSB(); if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return (session && session.user && session.user.email) || null;
  } catch { return null; }
}
