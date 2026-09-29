-- Migración aplicada el 2026-09-24 en Supabase wjzxdevrnzvgklapolve (Vitalvet Latam).
-- Preparó el terreno para copiar vv_store (JSON) a las tablas relacionales.
-- Ya está TODO aplicado; este archivo es el registro, no hace falta correrlo.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Seguridad: funciones que cualquiera podía llamar desde internet.
--    bridge_mas_to_pacientes escribía masivamente en pacientes y en
--    vv_store.mas saltándose RLS, sin sesión ni límite de uso, y ningún
--    código la llamaba. check_rate_limit permitía bloquear a otro usuario a
--    propósito. link_to_vitalvet requiere sesión de todos modos.
-- ─────────────────────────────────────────────────────────────────────────
revoke execute on function public.bridge_mas_to_pacientes()        from anon, authenticated, public;
revoke execute on function public.check_rate_limit(text, int, int) from anon, authenticated, public;
revoke execute on function public.link_to_vitalvet(text, text)     from anon, public;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Columnas de enlace con el origen + índices que hacen la copia repetible.
--    `pacientes` no tenía NINGÚN índice único: sin esto, correr la copia dos
--    veces duplicaba las 611 mascotas. Los índices son parciales porque las
--    filas que ya existían tienen la columna vacía y no deben chocar.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.tutores   add column if not exists saas_prop_id text;
alter table public.pacientes add column if not exists saas_mas_id  text;

-- "Cómo nos conoció" (referido, publicidad, Facebook…). Estaba en 411 de los
-- 497 propietarios y no tenía dónde caer: migrar sin esta columna habría
-- borrado el dato con el que se arman las campañas de captación.
alter table public.tutores   add column if not exists como text;

create unique index if not exists tutores_saas_prop_id_uniq
  on public.tutores (saas_prop_id) where saas_prop_id is not null;
create unique index if not exists pacientes_saas_mas_id_uniq
  on public.pacientes (saas_mas_id) where saas_mas_id is not null;
create unique index if not exists historia_clinica_saas_hist_id_uniq
  on public.historia_clinica (saas_hist_id) where saas_hist_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Destino para lo que no cabía en ninguna columna.
--    Cada registro clínico de vv_store tiene hasta 47 campos y la tabla cubría
--    18. Sin datos_extra se habrían perdido en silencio el detalle anestésico
--    y las complicaciones de 169 cirugías, los hallazgos del examen físico y
--    los datos de hospitalización.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.historia_clinica add column if not exists datos_extra jsonb;
alter table public.historia_clinica add column if not exists peso numeric;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Trigger roto que impedía actualizar CUALQUIER tutor (error 42703).
--    trg_tutores_updated_at llamaba a update_updated_at(), que escribe en una
--    columna `updated_at` que esta tabla no tiene: aquí se llama
--    `actualizado_en`. Llevaba roto desde antes de la migración.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_actualizado_en()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists trg_tutores_updated_at on public.tutores;
create trigger trg_tutores_actualizado_en
  before update on public.tutores
  for each row execute function public.set_actualizado_en();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Corrección puntual de un dato: la mascota CLOE apuntaba a un propietario
--    inexistente. Se corrige DENTRO del JSON, en una sola operación atómica,
--    sin reescribir el arreglo desde el cliente (que es donde está el riesgo
--    de que dos guardados simultáneos se pisen).
--    Patrón a reutilizar si hace falta editar vv_store puntualmente.
-- ─────────────────────────────────────────────────────────────────────────
-- update public.vv_store
--    set data = (select jsonb_agg(case when elem->>'id' = 'm1785272965450'
--                                      then jsonb_set(elem, '{pid}', '"p1785272920697"')
--                                      else elem end order by idx)
--                  from jsonb_array_elements(data) with ordinality as t(elem, idx)),
--        updated_at = now()
--  where key = 'mas';
