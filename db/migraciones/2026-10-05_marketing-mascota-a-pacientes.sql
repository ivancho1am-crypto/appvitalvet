-- Marketing — corregir broadcast_campaign_deliveries.mascota_id antes de que
-- alguien lo use (encontrado el 2026-10-05, mismo patrón que el bug real de
-- ventas.propietario_id del 2026-10-02).
--
-- EL PROBLEMA: la migración 2026-10-01_marketing_v1_1_manual_tracking.sql
-- agregó mascota_id con FK a `mascotas` — pero esa tabla quedó VACÍA (0
-- filas) desde la migración relacional de septiembre, igual que
-- `propietarios`. Debió apuntar a `pacientes`, como todo lo demás del
-- proyecto desde esa fecha.
--
-- POR QUÉ NO CAUSÓ DAÑO TODAVÍA: nadie ha usado "Guardar campaña" en
-- Marketing para una campaña real (0 filas con campaign_type=
-- 'manual_dashboard', 0 deliveries con mascota_id no nulo — verificado por
-- lectura el 2026-10-05). Es un bug latente, no un dato corrupto. Se
-- corrige ahora, antes del primer uso real, como se hizo con ventas.
--
-- SEGURO DE APLICAR: 0 filas con mascota_id no nulo, verificado el mismo día.

do $$
declare
  nombre_constraint text;
begin
  select con.conname into nombre_constraint
  from pg_constraint con
  join pg_class    rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'broadcast_campaign_deliveries'
    and con.contype = 'f'
    and con.conkey = array[
      (select attnum from pg_attribute
        where attrelid = 'public.broadcast_campaign_deliveries'::regclass and attname = 'mascota_id')
    ]::smallint[];

  if nombre_constraint is not null then
    execute format('alter table public.broadcast_campaign_deliveries drop constraint %I', nombre_constraint);
    raise notice 'FK anterior eliminada: %', nombre_constraint;
  else
    raise notice 'No había FK sobre mascota_id (nada que quitar)';
  end if;
end $$;

alter table public.broadcast_campaign_deliveries
  add constraint broadcast_campaign_deliveries_mascota_id_fkey
  foreign key (mascota_id) references public.pacientes(id) on delete set null;

-- ── Verificación (ejecutar después, debe decir 'pacientes') ──────────────
-- select con.conname, rel_ref.relname as tabla_referenciada
--   from pg_constraint con
--   join pg_class rel      on rel.oid = con.conrelid
--   join pg_class rel_ref  on rel_ref.oid = con.confrelid
--  where rel.relname = 'broadcast_campaign_deliveries' and con.contype = 'f'
--    and con.conname like '%mascota%';
