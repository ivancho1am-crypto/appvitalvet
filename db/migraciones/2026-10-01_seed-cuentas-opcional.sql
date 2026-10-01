-- OPCIONAL — no es una migración de esquema, son datos iniciales.
-- `financial_accounts` existe pero tiene 0 filas; sin al menos una cuenta,
-- el modal "Registrar pago" no tiene nada para seleccionar. Correlo solo si
-- querés tener Caja/Banco listos para probar — podés editarlos o agregar
-- más después, a mano, desde Supabase (no hay UI de cuentas todavía, a
-- propósito: no hacía falta para este ciclo).
--
-- No hay restricción UNIQUE en `nombre`, así que correr esto dos veces
-- crea cuentas duplicadas — está pensado para correrse una sola vez. Si ya
-- tenés cuentas creadas (por vos o por ChatGPT), no hace falta correrlo.

insert into public.financial_accounts (nombre, tipo, activo)
values
  ('Caja', 'caja', true),
  ('Banco principal', 'banco', true);

select id, nombre, tipo, activo from public.financial_accounts order by nombre;
