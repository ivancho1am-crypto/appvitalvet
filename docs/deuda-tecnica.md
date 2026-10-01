# Deuda técnica — VitalVet (2026-10-02)

Registro de las 4 deudas técnicas acordadas con Iván tras cerrar Inventario
v1.4. **Ninguna bloquea el desarrollo funcional actual** — se documentan acá
para no perderlas, no para frenar nada.

**Proceso acordado desde acá en adelante:** cerrar el módulo en curso →
validación real controlada → estabilizar → recién ahí avanzar al siguiente
módulo. Cada ciclo: rama chica, migración si hace falta, prueba, commit,
y solo después seguir.

---

## 1. Sincronizar/normalizar el historial de migraciones Git ↔ Supabase

Ya señalado en el Loop 0 (`docs/loop-0-consolidacion.md`): V1.2 de Finanzas y
la migración original de Ventas se aplicaron en Supabase sin un `.sql`
correspondiente versionado en este repo en su momento — el repo y la base
real quedaron desalineados en documentación (no en código; el código sí
coincide con el esquema real, verificado varias veces). Desde entonces
toda migración nueva sí quedó en `db/migraciones/`, pero no existe una
tabla de control de versiones (`schema_migrations` o similar) del lado de
Supabase que registre qué se aplicó, cuándo y quién — así que no hay forma
automática de detectar si el repo y la base se vuelven a desalinear.

## 2. Unificar eventualmente `propietarios`/`pacientes` con `tutores`/`pacientes`

Documentado en detalle en el V1.3 Audit
(`docs/v1.3-audit-flujo-venta-factura-pago.md`): son dos identidades de
cliente separadas, sin FK que las vincule — `tutores`/`pacientes` del lado
clínico/Agenda/Portal, `propietarios` del lado Cotizaciones/Facturas/
Ventas. Esto no bloquea Venta→Factura (comparten `propietarios`), pero sí
bloquea cualquier integración futura que cruce lo comercial con lo
clínico (ej. ver el historial de compras de un paciente en su ficha).

## 3. Hacer Ventas (y la cadena Producto→Lote→Movimiento) más transaccional

`VentasRepo.crearVenta()` e `invGuardarProducto()` (cuando crea un primer
lote) son inserts secuenciales, no una transacción atómica de Postgres. Si
un paso intermedio falla, queda un estado parcial — hoy manejado con
mensajes de error específicos que dicen exactamente qué quedó a medias
(ej. "Producto creado, pero el lote NO se registró"), pero sin reversión
automática. Solución futura: una función RPC de Postgres que envuelva los
inserts en una transacción real (todo o nada).

## 4. Auditar las funciones `SECURITY DEFINER` antes de exponer esto a más usuarios

Pendiente, no iniciado — `is_staff()` es la función de autorización
central ya usada en todo el proyecto, pero no se ha revisado si existen
otras funciones `SECURITY DEFINER` en el esquema, ni si tienen el
`search_path` fijado correctamente (vector clásico de escalación de
privilegios en Postgres si no se configura bien). Mientras el único
usuario real sea Iván, el riesgo práctico es bajo — se vuelve
indispensable antes de dar acceso a más personas.
