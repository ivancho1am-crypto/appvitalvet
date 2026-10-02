-- Marketing v1.1 — tracking manual sobre las tablas de campañas existentes.
--
-- NO EJECUTAR: esta migración ya fue aplicada directamente en Supabase de
-- producción por ChatGPT el 2026-10-01 (nombre registrado:
-- marketing_v1_1_manual_tracking_2026_10_01). Este archivo documenta el
-- estado resultante para mantener sincronizado el historial Git↔Supabase
-- (deuda técnica #1, ver docs/deuda-tecnica.md). Verificado con lectura
-- real del esquema (OpenAPI) el mismo día: las 4 columnas existen y son
-- nullable; ningún dato existente fue tocado.
--
-- IMPORTANTE — estas NO son tablas nuevas ni dedicadas al dashboard:
-- marketing_campaigns / broadcast_campaign_deliveries ya existían y las usa
-- agente-whatsapp-vitabot/routes/campanas-edades.js para sus campañas
-- automáticas reales por WhatsApp (por grupo etario, jornada de
-- esterilización, campaña dirigida). Marketing v1.1 del dashboard reusa las
-- MISMAS tablas (decisión de Iván: un solo historial, visible en los dos
-- lados) pero marca todo lo que escribe con canal/campaign_type distintos
-- y nunca toca whatsapp_leads ni los campos que usa el envío real del bot
-- (message_sent, wa_message_id) — ver marketing-repository.js.

alter table public.broadcast_campaign_deliveries
  add column if not exists mascota_id uuid references public.mascotas(id),
  add column if not exists message_rendered text,
  add column if not exists manual_opened_at timestamptz,
  add column if not exists manual_opened_by text;

create index if not exists idx_bcd_campania_telefono on public.broadcast_campaign_deliveries(campaign_id, phone);
create index if not exists idx_bcd_mascota on public.broadcast_campaign_deliveries(mascota_id);
create index if not exists idx_mkt_campaigns_fecha on public.marketing_campaigns(fecha_creacion);
create index if not exists idx_mkt_campaigns_tipo_canal on public.marketing_campaigns(campaign_type, canal);

-- Verificación (ya ejecutada por GPT; se deja para referencia futura):
-- select column_name, is_nullable from information_schema.columns
--  where table_name = 'broadcast_campaign_deliveries'
--    and column_name in ('mascota_id','message_rendered','manual_opened_at','manual_opened_by');
