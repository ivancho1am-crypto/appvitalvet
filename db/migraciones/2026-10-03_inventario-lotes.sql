-- Inventario — Fase 2 + parte de Fase 3: lotes y su enlace con movimientos.
--
-- El stock NUNCA vive en `lotes`: `cantidad_inicial` es un dato histórico
-- fijo (lo que entró ese día, nunca se actualiza). El stock VIVO de un lote
-- sale de inventario_stock_por_lote (SUM de movimientos, mismo criterio que
-- ya usa inventario_stock_actual para el producto completo) — no hay un
-- segundo sistema de stock paralelo.

create table if not exists public.lotes (
  id               uuid primary key default gen_random_uuid(),
  producto_id      uuid not null references public.productos(id),
  numero_lote      text not null,
  fecha_vencimiento date,
  -- Dato histórico: lo que entró al crear el lote. No se actualiza después
  -- — el stock real del lote se calcula de los movimientos, no de acá.
  cantidad_inicial numeric not null check (cantidad_inicial > 0),
  costo_unitario   numeric,
  proveedor        text,
  fecha_ingreso    date not null default current_date,
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  creado_por       text
);

-- Enlace opcional con lote (compatibilidad: movimientos históricos y
-- productos que no manejan lote siguen con lote_id = null, sin romper nada)
-- y con venta (reemplaza el enlace por texto libre en `nota` que usaba
-- Ventas hasta ahora — ver ventas-repository.js, que se actualiza en este
-- mismo ciclo para usar esta columna).
alter table public.inventario_movimientos
  add column if not exists lote_id  uuid references public.lotes(id),
  add column if not exists venta_id uuid references public.ventas(id);

create index if not exists idx_lotes_producto   on public.lotes(producto_id);
create index if not exists idx_inv_mov_lote     on public.inventario_movimientos(lote_id);
create index if not exists idx_inv_mov_venta    on public.inventario_movimientos(venta_id);

alter table public.lotes enable row level security;
drop policy if exists lotes_staff on public.lotes;
create policy lotes_staff on public.lotes
  for all using (is_staff()) with check (is_staff());

-- Vista aparte de inventario_stock_actual (que sigue intacta, por
-- producto) — misma lógica aplicada a nivel de lote.
create or replace view public.inventario_stock_por_lote
  with (security_invoker = true) as
select
  l.id as lote_id, l.producto_id, l.numero_lote, l.fecha_vencimiento,
  l.cantidad_inicial, l.activo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from public.lotes l
left join public.inventario_movimientos m on m.lote_id = l.id
where l.activo
group by l.id;

-- Verificación.
select table_name, table_type
  from information_schema.tables
 where table_schema = 'public' and table_name in ('lotes', 'inventario_stock_por_lote')
 order by table_name;

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'inventario_movimientos'
   and column_name in ('lote_id', 'venta_id');
