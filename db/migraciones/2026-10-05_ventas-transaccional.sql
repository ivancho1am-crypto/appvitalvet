-- Ventas — hacer crearVenta() realmente atómica (deuda técnica #3,
-- docs/deuda-tecnica.md: "hacer las ventas más transaccionales para evitar
-- estados parciales si falla una operación intermedia").
--
-- EL PROBLEMA: VentasRepo.crearVenta() hoy hace 3 inserts SECUENCIALES
-- (ventas → venta_items → inventario_movimientos), cada uno un viaje de red
-- aparte. Si el segundo o tercero falla, queda una venta real con sus items
-- a medias o sin descontar el inventario — el código ya detecta y avisa
-- exactamente en qué paso se quedó (mensajes específicos en
-- ventas-repository.js), pero el estado parcial en la base sigue ahí hasta
-- que alguien lo corrija a mano.
--
-- LA SOLUCIÓN: una función de Postgres que hace los 3 inserts dentro de UNA
-- sola transacción de base de datos — si cualquiera falla, Postgres revierte
-- TODO automáticamente (no hay estado parcial posible, ni que detectar).
--
-- security invoker (no definer, a propósito): la función corre con los
-- permisos del usuario que la llama, exactamente igual que si hiciera los 3
-- inserts por separado como hoy — no se amplía ningún privilegio, no suma
-- superficie a la deuda #4 (auditoría de SECURITY DEFINER).
--
-- COMPATIBILIDAD: ventas-repository.js intenta llamar esta función primero,
-- y si todavía no existe (porque esta migración no se ha aplicado), usa el
-- camino secuencial de siempre sin romper nada — ver el comentario en
-- VentasRepo.crearVenta(). Aplicar esta migración es lo que activa el modo
-- atómico; no aplicarla deja todo funcionando exactamente como hasta hoy.

create or replace function public.crear_venta_completa(
  p_propietario_id uuid,
  p_cliente_nombre text,
  p_fecha date,
  p_metodo_pago text,
  p_cuenta_id uuid,
  p_total numeric,
  p_creado_por text,
  p_items jsonb   -- [{tipo, producto_id, nombre, cantidad, precio_unitario, subtotal}, ...]
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
  insert into public.ventas (propietario_id, cliente_nombre, fecha, metodo_pago, cuenta_id, total, creado_por)
  values (p_propietario_id, p_cliente_nombre, p_fecha, p_metodo_pago, p_cuenta_id, p_total, p_creado_por)
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

    -- Mismo criterio que hoy: solo los ítems de tipo 'producto' con
    -- producto_id generan movimiento de inventario; los servicios no.
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
  'Venta v1.5 (2026-10-05): venta + items + movimientos de inventario en UNA transacción atómica. security invoker — corre con los permisos del usuario que llama, mismo criterio que los inserts directos que reemplaza.';

-- ── Verificación (ejecutar después) ──────────────────────────────────────
-- select proname, prosecdef from pg_proc where proname = 'crear_venta_completa';
-- prosecdef debe ser 'f' (false = security invoker, no definer).
