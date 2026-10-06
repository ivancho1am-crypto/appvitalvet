-- Ventas — mascota opcional por venta (para el nuevo centro histórico con
-- filtro por mascota, pedido por Iván el 2026-10-06).
--
-- Aditiva, nullable: las ventas existentes (todas sin mascota_id) siguen
-- funcionando exactamente igual. El código ya maneja con gracia que esta
-- columna todavía no exista (ver ventas-repository.js) — aplicar esto
-- cuando quieras, no bloquea nada mientras tanto.

alter table public.ventas
  add column if not exists mascota_id uuid references public.pacientes(id) on delete set null;

create index if not exists idx_ventas_mascota on public.ventas(mascota_id);

-- ── Actualizar crear_venta_completa para aceptar mascota_id ────────────────
-- DROP + CREATE (no "or replace"): cambiar la lista de parámetros de una
-- función existente requiere recrearla — intentar solo "or replace" con un
-- parámetro nuevo falla en Postgres si no coincide exactamente la firma
-- anterior. Mismo cuerpo que la versión original (2026-10-05_ventas-
-- transaccional.sql) más el campo mascota_id.
--
-- Compatibilidad: ventas-repository.js solo manda p_mascota_id cuando hay
-- una mascota seleccionada — las ventas sin mascota (la mayoría) siguen
-- llamando la función con la firma de 8 parámetros de siempre y por lo
-- tanto siguen usando el camino atómico sin ninguna interrupción, incluso
-- mientras esta migración puntual no se aplique.
drop function if exists public.crear_venta_completa(
  uuid, text, date, text, uuid, numeric, text, jsonb
);

create or replace function public.crear_venta_completa(
  p_propietario_id uuid,
  p_cliente_nombre text,
  p_fecha date,
  p_metodo_pago text,
  p_cuenta_id uuid,
  p_total numeric,
  p_creado_por text,
  p_items jsonb,
  p_mascota_id uuid default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_venta_id uuid;
  v_item     jsonb;
  v_resultado jsonb;
begin
  insert into public.ventas (propietario_id, cliente_nombre, fecha, metodo_pago, cuenta_id, total, creado_por, mascota_id)
  values (p_propietario_id, p_cliente_nombre, p_fecha, p_metodo_pago, p_cuenta_id, p_total, p_creado_por, p_mascota_id)
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.venta_items (venta_id, tipo, producto_id, nombre, cantidad, precio_unitario, subtotal)
    values (
      v_venta_id,
      v_item->>'tipo',
      nullif(v_item->>'producto_id', '')::uuid,
      v_item->>'nombre',
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      (v_item->>'subtotal')::numeric
    );

    if (v_item->>'tipo') = 'producto' and nullif(v_item->>'producto_id', '') is not null then
      insert into public.inventario_movimientos (producto_id, cantidad, motivo, venta_id, nota)
      values (
        (v_item->>'producto_id')::uuid,
        -abs((v_item->>'cantidad')::numeric),
        'venta',
        v_venta_id,
        'Venta #' || v_venta_id::text
      );
    end if;
  end loop;

  select to_jsonb(v) into v_resultado from public.ventas v where v.id = v_venta_id;
  return v_resultado;
end;
$$;

comment on function public.crear_venta_completa is
  'Venta v1.6 (2026-10-06): + mascota_id opcional. Venta + items + movimientos de inventario en UNA transacción atómica. security invoker.';

-- ── Verificación (ejecutar después) ──────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_name = 'ventas' and column_name = 'mascota_id';
-- select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'crear_venta_completa';
-- (debe incluir "p_mascota_id uuid DEFAULT NULL::uuid" al final)
