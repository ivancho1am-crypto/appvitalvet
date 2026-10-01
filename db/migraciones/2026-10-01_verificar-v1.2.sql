-- Verificación de solo lectura — no modifica nada.
-- Confirma qué de lo descrito en el "contexto de continuación" (V1.1/V1.2)
-- existe de verdad en Supabase antes de adaptar public/js/finanzas/.

-- 1) ¿Cuáles de las tablas/vistas nuevas existen realmente?
select table_name, table_type
  from information_schema.tables
 where table_schema = 'public'
   and table_name in (
     'gastos','productos','inventario_movimientos','inventario_stock_actual',
     'financial_accounts','pagos','cuentas_por_cobrar',
     'finanzas_resumen_facturas','finanzas_resumen_mensual'
   )
 order by table_name;

-- 2) Columnas reales de `gastos` (¿tiene anulado/anulado_at/anulado_por?)
select column_name, data_type, column_default, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'gastos'
 order by ordinal_position;

-- 3) Si existen, columnas reales de las 3 tablas nuevas de V1.2
select table_name, column_name, data_type, column_default, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('financial_accounts','pagos','cuentas_por_cobrar')
 order by table_name, ordinal_position;

-- 4) Si existen, definición de las 2 vistas de resumen financiero
select table_name, view_definition
  from information_schema.views
 where table_schema = 'public'
   and table_name in ('finanzas_resumen_facturas','finanzas_resumen_mensual');

-- 5) El contexto dice que se PRESERVÓ el default 'confirmada' de citas.estado
--    (mi migración original lo cambiaba a 'programada' — confirmemos cuál quedó)
select column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'citas' and column_name = 'estado';

-- 6) ¿Hay protección contra stock negativo? (constraint o trigger)
select conname, pg_get_constraintdef(oid) as definicion
  from pg_constraint
 where conrelid = 'public.inventario_movimientos'::regclass;

select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.inventario_movimientos'::regclass and not tgisinternal;

-- 7) Índices reales en cotizaciones/cotizacion_items/facturas/factura_items
select tablename, indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('cotizaciones','cotizacion_items','facturas','factura_items')
 order by tablename, indexname;
