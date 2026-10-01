-- Ventas — registra su propio cobro (decisión de Iván, 2026-10-02):
--
-- 1) Por ahora Venta NO genera factura — la factura real sigue siendo
--    manual/Cotizaciones. Facturación formal y electrónica se trabajan
--    más adelante, aparte.
-- 2) Si se paga en el momento (efectivo, transferencia, cualquier medio),
--    se registra directo en `ventas` — simple, sin pasar por `pagos` (esa
--    tabla sigue siendo solo para facturas con cuenta por cobrar).
--
-- Por eso esta migración NO toca `pagos`/`facturas`/`cuentas_por_cobrar`:
-- solo agrega 2 columnas a `ventas`, aditivas, sin romper nada de lo que
-- ya existe (la tabla está en 0 filas reales hoy).

alter table public.ventas
  add column if not exists metodo_pago text not null default 'efectivo'
    check (metodo_pago in ('efectivo','transferencia','tarjeta','otro'));

-- Opcional: a qué caja/banco entró la plata de esta venta. Nullable a
-- propósito — registrar la venta nunca debe bloquearse por no tener
-- todavía una cuenta creada en financial_accounts.
alter table public.ventas
  add column if not exists cuenta_id uuid references public.financial_accounts(id);

create index if not exists idx_ventas_cuenta on public.ventas(cuenta_id);

-- Verificación.
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'ventas'
   and column_name in ('metodo_pago', 'cuenta_id')
 order by column_name;
