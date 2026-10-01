-- Inventario — Fase 1: datos maestros del producto.
--
-- Aditivo sobre `productos`, que ya existe en producción con filas reales.
-- Todas las columnas nuevas son NULLABLE — ningún producto existente deja
-- de funcionar por no tener estos datos todavía.
--
-- NO se tocan categoria/unidad/costo_unitario/precio_venta/proveedor: ya
-- existen, no se duplican.

alter table public.productos
  add column if not exists codigo        text,
  add column if not exists presentacion  text,
  add column if not exists codigo_barras text,
  add column if not exists stock_maximo  numeric,
  add column if not exists punto_reorden numeric,
  add column if not exists ubicacion     text;

-- Único pero NULLABLE: Postgres permite múltiples filas con codigo=NULL en
-- un índice único parcial — los productos sin código (todos, hoy) no
-- generan ningún conflicto entre sí.
create unique index if not exists idx_productos_codigo_unico
  on public.productos(codigo) where codigo is not null;

-- Verificación: debe listar las 6 columnas nuevas.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'productos'
   and column_name in ('codigo','presentacion','codigo_barras','stock_maximo','punto_reorden','ubicacion')
 order by column_name;
