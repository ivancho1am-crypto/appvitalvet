// Módulo: Marketing — capa de datos (v1.1)
//
// Único archivo de Marketing que habla con Supabase. Mismo patrón de
// try/catch y mensajes de error específicos que ventas/inventario/
// finanzas-repository.js.
//
// Reusa marketing_campaigns / broadcast_campaign_deliveries — las MISMAS
// tablas que ya usa VitaBot (agente-whatsapp-vitabot/routes/campanas-edades.js)
// para sus campañas automáticas reales por WhatsApp. Decisión explícita de
// Iván: un solo historial de campañas, visible desde los dos lados, en vez
// de duplicar estructura. Para no mezclarse con los envíos reales del bot:
//
//   - content_type / campaign_type / canal quedan marcados como
//     'whatsapp_manual'/'manual_dashboard' (el bot usa
//     'whatsapp_broadcast'/'broadcast').
//   - broadcast_campaign_deliveries.status siempre lleva el prefijo
//     'manual_' ('manual_pendiente', 'manual_abierto') — nunca 'sent' ni
//     'failed', esos son del envío real del bot vía API.
//   - message_sent (lo que el bot realmente mandó por la API de WhatsApp)
//     NO se escribe acá. El texto ya personalizado de cada paciente va en
//     message_rendered (columna agregada en la migración 2026-10-01 para
//     esto, ver db/migraciones/2026-10-01_marketing_v1_1_manual_tracking.sql).
//   - whatsapp_leads (cooldown/opt-in del envío automático del bot) NO se
//     toca nunca desde acá: un clic manual en el dashboard es un canal de
//     contacto independiente del broadcast automático, a propósito.

const MktRepo = {
  // Crea la campaña (filtros + mensaje tal como se guardaron al momento de
  // pulsar "Guardar campaña"). No reintenta sola si falla: ver crearCiclo
  // en marketing-ui.js para el mensaje de error específico según en qué
  // paso se quedó.
  async crearCampaña({ nombre, filtros, mensaje, totalDestinatarios }) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('marketing_campaigns').insert({
      nombre,
      content_type: 'whatsapp_manual',
      campaign_type: 'manual_dashboard',
      canal: 'whatsapp',
      estado: 'manual',
      audience_filters: filtros,
      message_template: mensaje,
      metricas: { total_destinatarios: totalDestinatarios, abiertos: 0 },
      fecha_creacion: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error('No se pudo crear la campaña: ' + error.message);
    return data;
  },

  // filasBase: ya armadas por mktConstruirFilasDelivery (marketing-service.js)
  // — esta capa solo agrega campaign_id e inserta, no calcula nada.
  async crearDeliveries(campaignId, filasBase) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    if (!filasBase.length) return [];
    const filas = filasBase.map(f => ({ ...f, campaign_id: campaignId }));
    const { data, error } = await sb.from('broadcast_campaign_deliveries').insert(filas).select();
    if (error) throw new Error('Campaña creada, pero no se pudo generar la lista de contactos: ' + error.message);
    return data;
  },

  // Se llama al abrir WhatsApp para un paciente que ya tiene delivery
  // guardado. Best-effort: si falla, se registra en consola pero no
  // interrumpe al usuario — el mensaje de WhatsApp ya se abrió igual.
  async registrarAperturaManual(deliveryId) {
    try {
      const sb = getSB(); if (!sb) return;
      const correo = await _mktUsuarioActual();
      const { error } = await sb.from('broadcast_campaign_deliveries')
        .update({ status: 'manual_abierto', manual_opened_at: new Date().toISOString(), manual_opened_by: correo })
        .eq('id', deliveryId);
      if (error) console.warn('[marketing] registrarAperturaManual:', error.message);
    } catch (e) { console.warn('[marketing] registrarAperturaManual:', e.message); }
  },

  // Solo las campañas creadas desde ESTE dashboard (campaign_type
  // 'manual_dashboard') — las campañas automáticas del bot no se listan
  // acá, tienen su propio panel en VitaBot.
  async listarCampañas() {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('marketing_campaigns').select('*')
      .eq('campaign_type', 'manual_dashboard')
      .order('fecha_creacion', { ascending: false });
    if (error) { console.warn('[marketing] listarCampañas:', error.message); return []; }
    return data || [];
  },

  async listarDeliveries(campaignId) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('broadcast_campaign_deliveries').select('*')
      .eq('campaign_id', campaignId).order('created_at', { ascending: true });
    if (error) { console.warn('[marketing] listarDeliveries:', error.message); return []; }
    return data || [];
  },
};

// Mismo patrón que _ventaUsuarioActual/_finUsuarioActual — duplicado a
// propósito, no se importa entre módulos.
async function _mktUsuarioActual() {
  try {
    const sb = getSB(); if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return (session && session.user && session.user.email) || null;
  } catch { return null; }
}
