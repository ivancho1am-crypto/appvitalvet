-- Ventas v1 (Opción B — registro propio, todavía NO conectado a
-- facturas/cotizaciones; eso queda para un ciclo futuro, a propósito).
--
-- Por qué tablas propias y no reusar cotizacion_items/factura_items: esas
-- tablas reales solo tienen (nombre, valor) — sin `cantidad` — así que no
-- alcanzan para "vendí 4 tabletas de una caja a tal precio c/u". Agregarles
-- `cantidad` hoy tocaría tablas que Cotizaciones ya usa en producción, y
-- además cotizacion.js tiene un bug de columnas pre-existente (reportado
-- aparte) que conviene resolver antes de construir más encima. Ventas con
-- tablas propias no depende de nada de eso.

create table if not exists public.ventas (
  id              uuid primary key default gen_random_uuid(),
  propietario_id  uuid references public.propietarios(id),
  -- Venta de mostrador sin cliente registrado: mismo criterio que
  -- citas.tutor_name (texto libre cuando no hay registro real).
  cliente_nombre  text,
  fecha           date not null default current_date,
  total           numeric not null default 0,
  anulado         boolean not null default false,
  anulado_at      timestamptz,
  anulado_por     text,
  creado_por      text,
  created_at      timestamptz not null default now()
);

create table if not exists public.venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references public.ventas(id),
  tipo            text not null check (tipo in ('producto','servicio')),
  -- Solo aplica si tipo='producto'; un ítem de servicio no toca inventario.
  producto_id     uuid references public.productos(id),
  nombre          text not null,
  cantidad        numeric not null check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  subtotal        numeric not null
);

create index if not exists idx_ventas_propietario     on public.ventas(propietario_id);
create index if not exists idx_ventas_fecha           on public.ventas(fecha);
create index if not exists idx_venta_items_venta      on public.venta_items(venta_id);
create index if not exists idx_venta_items_producto   on public.venta_items(producto_id);

alter table public.ventas       enable row level security;
alter table public.venta_items  enable row level security;

drop policy if exists ventas_staff       on public.ventas;
drop policy if exists venta_items_staff  on public.venta_items;

create policy ventas_staff on public.ventas
  for all using (is_staff()) with check (is_staff());
create policy venta_items_staff on public.venta_items
  for all using (is_staff()) with check (is_staff());

-- Agrega 'venta' al motivo de inventario_movimientos (hoy solo permite
-- compra/uso_clinico/merma/ajuste/devolucion/otro) — distingue "se usó en
-- una consulta" de "se vendió en mostrador", que son eventos de negocio
-- distintos aunque los dos bajen el stock.
--
-- El constraint no se nombró explícito en la migración original
-- (2026-09-30_inventario-v1.sql), así que Postgres lo autonombró. Si el
-- nombre real no es inventario_movimientos_motivo_check, confirmalo con:
--   select conname from pg_constraint
--    where conrelid = 'public.inventario_movimientos'::regclass;
-- y ajustá el nombre de abajo antes de correr esta migración.
alter table public.inventario_movimientos
  drop constraint if exists inventario_movimientos_motivo_check;
alter table public.inventario_movimientos
  add constraint inventario_movimientos_motivo_check
  check (motivo in ('compra','uso_clinico','merma','ajuste','devolucion','venta','otro'));

-- Verificación: debe listar las 2 tablas nuevas + el constraint actualizado.
select table_name, table_type
  from information_schema.tables
 where table_schema = 'public' and table_name in ('ventas','venta_items')
 order by table_name;

select conname, pg_get_constraintdef(oid) as definicion
  from pg_constraint
 where conrelid = 'public.inventario_movimientos'::regclass
   and conname = 'inventario_movimientos_motivo_check';
