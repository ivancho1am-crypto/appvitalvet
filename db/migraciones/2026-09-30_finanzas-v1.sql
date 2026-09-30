-- Finanzas v1 — resumen de caja (ingresos - gastos).
--
-- IMPORTANTE: los INGRESOS *no* se guardan en una tabla nueva. Ya existen
-- `facturas`/`factura_items`, creadas por Cotizaciones al emitir una factura
-- (ver public/js/cotizacion.js, generarFactura()). Finanzas solo LEE de ahí
-- — crear una segunda tabla de "ingresos" habría duplicado ese número y
-- tarde o temprano se habría desincronizado, el mismo error que ya
-- corregimos entre vv_store y las tablas relacionales.
--
-- Lo único nuevo es GASTOS: no existía ningún registro de gastos en todo
-- el proyecto (arriendo, insumos, nómina, servicios...), así que esta sí es
-- una tabla nueva de verdad.
--
-- Mismo patrón de seguridad que el resto: solo personal (is_staff()).

create table if not exists public.gastos (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null default 'otro'
                  check (categoria in ('insumos','arriendo','servicios_publicos','nomina','impuestos','mantenimiento','otro')),
  monto         numeric not null check (monto > 0),
  descripcion   text,
  fecha         date not null default current_date,
  -- Opcional: si el gasto fue comprar un insumo del inventario, queda
  -- referenciado aquí (sin crear automáticamente el movimiento de entrada
  -- en inventario_movimientos — eso lo registra el usuario aparte, en
  -- Inventario, si corresponde).
  producto_id   uuid references public.productos(id),
  creado_por    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_gastos_fecha    on public.gastos(fecha);
create index if not exists idx_gastos_producto on public.gastos(producto_id);

alter table public.gastos enable row level security;

drop policy if exists gastos_staff on public.gastos;
create policy gastos_staff on public.gastos
  for all using (is_staff()) with check (is_staff());

-- Verificación: debe listar la tabla nueva.
select table_name, table_type
  from information_schema.tables
 where table_schema = 'public' and table_name = 'gastos';
