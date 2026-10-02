-- Ventas — arreglar la venta a propietario registrado.
--
-- EL PROBLEMA (diagnosticado el 2026-10-02):
-- `ventas.propietario_id` es uuid con FK a `propietarios(id)`, pero esa tabla
-- quedó VACÍA (0 filas) cuando se migró el modelo relacional a
-- `tutores`/`pacientes` el 2026-09-24. Resultado: toda venta con propietario
-- registrado fallaba siempre — primero porque el panel manda el id de
-- vv_store (texto tipo 'p1738...', que ni siquiera es uuid), y aunque
-- mandara un uuid válido, la FK apuntaba a una tabla sin filas.
-- Las ventas de mostrador sí funcionaban porque ahí propietario_id va NULL
-- y la FK no se valida.
--
-- LA CORRECCIÓN: repuntar la FK a `tutores`, que es la tabla viva (506
-- filas). El panel resuelve el id de vv_store al uuid real del tutor usando
-- `tutores.saas_prop_id` (el mismo enlace que usa js/espejo.js), y guarda ese
-- uuid en propietario_id.
--
-- SEGURO DE APLICAR: `ventas` tiene 1 fila y su propietario_id es NULL (fue
-- una venta de mostrador), así que no hay ningún dato que pueda violar la FK
-- nueva. Verificado por lectura el 2026-10-02.
--
-- NOTA sobre el nombre: la columna sigue llamándose `propietario_id` para no
-- romper el código que ya la usa. Apunta a `tutores`. Renombrarla a
-- `tutor_id` queda para la migración grande de vv_store → relacional
-- (ver el mapa de dependencia de la Etapa 2A), no para este arreglo puntual.

-- 1) Quitar la FK vieja. Se busca por catálogo en vez de por nombre fijo,
--    porque el nombre lo generó Postgres y no está documentado en el repo.
do $$
declare
  nombre_constraint text;
begin
  select con.conname into nombre_constraint
  from pg_constraint con
  join pg_class    rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'ventas'
    and con.contype = 'f'
    and con.conkey = array[
      (select attnum from pg_attribute
        where attrelid = 'public.ventas'::regclass and attname = 'propietario_id')
    ]::smallint[];

  if nombre_constraint is not null then
    execute format('alter table public.ventas drop constraint %I', nombre_constraint);
    raise notice 'FK anterior eliminada: %', nombre_constraint;
  else
    raise notice 'No había FK sobre ventas.propietario_id (nada que quitar)';
  end if;
end $$;

-- 2) Apuntar a la tabla viva. on delete set null: si algún día se borra un
--    tutor, la venta NO se borra — pierde el enlace pero conserva el importe,
--    que es lo que importa para la caja.
alter table public.ventas
  add constraint ventas_propietario_id_fkey
  foreign key (propietario_id) references public.tutores(id) on delete set null;

-- 3) Índice para buscar las ventas de un tutor (no existía).
create index if not exists idx_ventas_propietario on public.ventas(propietario_id);

-- ── Verificación (ejecutar después, debe devolver tutores) ──────────────
-- select con.conname, rel_ref.relname as tabla_referenciada
--   from pg_constraint con
--   join pg_class rel      on rel.oid = con.conrelid
--   join pg_class rel_ref  on rel_ref.oid = con.confrelid
--  where rel.relname = 'ventas' and con.contype = 'f';
