-- Lotes — agrega fecha de fabricación (pedida por Iván, no estaba en la
-- especificación original: solo pedía vencimiento). Aditiva, nullable — los
-- lotes ya creados (sin este dato) siguen funcionando igual.

alter table public.lotes
  add column if not exists fecha_fabricacion date;

-- Verificación.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'lotes' and column_name = 'fecha_fabricacion';
