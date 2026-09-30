-- Inventario v1 — catálogo de productos (insumos/medicamentos) + movimientos.
--
-- Distinto de `procs` (que son SERVICIOS facturables, ej. "Consulta general"):
-- esto es stock FÍSICO real, con existencias que suben y bajan.
--
-- El stock NUNCA se guarda como columna: se calcula siempre como la suma de
-- los movimientos (vista inventario_stock_actual). Una sola fuente de verdad,
-- para no repetir el problema de datos que se desincronizan que ya tuvimos
-- entre vv_store y las tablas relacionales.
--
-- Mismo patrón de seguridad que citas/tutores/pacientes: solo personal
-- (is_staff()) puede leer o escribir.

create table if not exists public.productos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  categoria      text not null default 'otro'
                   check (categoria in ('medicamento','vacuna','insumo_quirurgico','alimento','otro')),
  unidad         text not null default 'unidad',
  stock_minimo   numeric not null default 0,
  costo_unitario numeric,
  precio_venta   numeric,
  proveedor      text,
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     text
);

create table if not exists public.inventario_movimientos (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id),
  -- Con signo: positivo = entrada, negativo = salida/ajuste a la baja.
  -- Así el stock es un único SUM(cantidad), sin casos especiales por tipo.
  cantidad    numeric not null check (cantidad <> 0),
  motivo      text not null default 'otro'
                check (motivo in ('compra','uso_clinico','merma','ajuste','devolucion','otro')),
  -- Opcional: permite (sin obligar) anotar que un insumo se usó en una cita puntual.
  cita_id     uuid references public.citas(id),
  nota        text,
  creado_por  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_inv_mov_producto on public.inventario_movimientos(producto_id);
create index if not exists idx_inv_mov_cita      on public.inventario_movimientos(cita_id);

-- security_invoker: la vista respeta el RLS de quien consulta (no el del dueño
-- de la vista) — mismo criterio de seguridad que las tablas base.
create or replace view public.inventario_stock_actual
  with (security_invoker = true) as
select
  p.id as producto_id,
  p.nombre, p.categoria, p.unidad, p.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from public.productos p
left join public.inventario_movimientos m on m.producto_id = p.id
where p.activo
group by p.id;

alter table public.productos              enable row level security;
alter table public.inventario_movimientos enable row level security;

drop policy if exists productos_staff             on public.productos;
drop policy if exists inventario_movimientos_staff on public.inventario_movimientos;

create policy productos_staff on public.productos
  for all using (is_staff()) with check (is_staff());

create policy inventario_movimientos_staff on public.inventario_movimientos
  for all using (is_staff()) with check (is_staff());

-- Verificación: debe listar las 2 tablas + la vista.
select table_name, table_type
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('productos', 'inventario_movimientos', 'inventario_stock_actual')
 order by table_name;
