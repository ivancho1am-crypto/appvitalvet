# Loop 0 — Consolidación VitalVet (2026-10-01)

**Alcance de este ciclo:** NO se agregó funcionalidad nueva. Solo se contrastó
el código de `main`, `v1.2-finanzas-caja-cobros` y `v1.3-ventas-calendario`
contra el estado real de Supabase, se documentó la matriz de abajo, y se
corrieron pruebas de consistencia (sintaxis, duplicados, regresión de UI).

**No se tocó:** `public/js/db.js`, `public/js/espejo.js`, `public/js/auth.js`,
`public/js/historia.js`, ni ninguna fila real de Supabase (todas las lecturas
de este ciclo fueron de solo lectura: esquema vía el endpoint OpenAPI de
PostgREST, y conteos de filas vía `Prefer: count=exact`).

---

## Resumen ejecutivo (hechos verificados hoy)

1. **`v1.3-ventas-calendario` está 14 commits delante de `main`** (verificado:
   `git log --oneline main..v1.3-ventas-calendario | wc -l` → 14).
2. **V1.3 contiene, en orden**: Dashboard/Inicio, Agenda (+ calendario Mes),
   Inventario, Finanzas (+ pagos), Ventas. Ninguno de estos archivos existe
   en `main` (verificado: `git diff --name-status main...v1.3-ventas-calendario`).
3. **Supabase tiene V1.1 y V1.2 aplicadas** — confirmado hoy contra el
   esquema real: `citas` (+tutor_id/paciente_id), `productos`,
   `inventario_movimientos`, `inventario_stock_actual`, `gastos` (+anulado/
   anulado_at/anulado_por), `financial_accounts`, `pagos`,
   `cuentas_por_cobrar`, `finanzas_resumen_facturas`,
   `finanzas_resumen_mensual` existen todas.
4. **`ventas` y `venta_items` YA EXISTEN en Supabase** (confirmado hoy, con
   0 filas en ambas) — pero **su migración V1.3 no aparece registrada en
   ningún control de versión de esquema compartido**: no hay una tabla de
   "migraciones aplicadas" en Supabase, así que no hay forma de confirmar
   con certeza que lo que se ejecutó fue exactamente
   `db/migraciones/2026-10-01_ventas-v1.sql` tal cual está en el repo, y no
   una variante. Ver "Inconsistencias" abajo.
5. **`tutores` y `propietarios` son identidades comerciales distintas**,
   confirmado contra el esquema real — ver sección dedicada abajo. Ningún
   módulo nuevo intenta reconciliarlas todavía.
6. **Los módulos nuevos tienen cero transacciones reales**, confirmado con
   evidencia (no solo de palabra): `ventas`, `venta_items`, `pagos` y
   `cuentas_por_cobrar` devuelven `content-range: */0` (0 filas) al momento
   de este corte.
7. **No se hizo ninguna migración masiva del núcleo clínico** en este ciclo
   ni en los anteriores — `tutores`, `pacientes`, `historia_clinica` no se
   tocaron; las únicas columnas nuevas en tablas clínicas son
   `citas.tutor_id`/`citas.paciente_id` (aditivas, nullable).
8. **Ventas NO está conectado a Finanzas** — a propósito, por la dualidad
   tutores/propietarios sin resolver (punto 5). Una venta no genera factura,
   no afecta FACTURADO/COBRADO/POR COBRAR.
9. **`pagos` necesita protección transaccional** que hoy no tiene: registrar
   un pago es un solo `insert`, pero el flujo completo (`crearVenta` en
   Ventas, por ejemplo) encadena varios inserts secuenciales sin una
   transacción real de Postgres — si el paso 2 falla, el paso 1 ya quedó
   escrito. Está documentado y manejado con mensajes de error específicos
   (ver `ventas-repository.js`), pero no es atómico. Pendiente para un
   ciclo futuro (posiblemente una función RPC de Postgres).
10. **No se debe fusionar `v1.3-ventas-calendario` a `main` todavía** — se
    mantiene como recomendación explícita de este ciclo.

---

## Matriz: módulo → código → tablas → migraciones → RLS → datos → UI → dependencias → estado

| Módulo | Código | Tablas/vistas Supabase | Migración | RLS | Datos reales hoy | UI | Dependencias | Estado |
|---|---|---|---|---|---|---|---|---|
| **Dashboard/Inicio** | `public/js/dashboard.js` | Ninguna (deriva de `DB.get()` local) | — | N/A | N/A | Pestaña "Inicio", KPIs, actividad reciente | `helpers.js`, `db.js`, `nav.js`, `propietarios.js`, `historia.js` (solo lectura, no escribe) | ✅ Verificado, 0 riesgo |
| **Agenda** | `public/js/agenda/{repository,service,ui}.js` | `citas` (existente, extendida) | `2026-09-30_agenda-v1.sql` — aplicada (V1.1) | `is_staff()` (ya existía en `citas`) | `citas`: no recontado en este ciclo puntual (sí confirmado 0 en auditorías previas de esta sesión) | Pestaña Agenda: Lista / Día / **Mes** (nuevo), modal nueva cita | `pacientes.saas_mas_id`/`tutor_id` (lectura), `DB.get('mas'/'props')` local | ✅ Código↔esquema verificado hoy, 0 transacciones reales conocidas, sin fusionar |
| **Inventario** | `public/js/inventario/{repository,service,ui}.js` | `productos`, `inventario_movimientos`, vista `inventario_stock_actual` | `2026-09-30_inventario-v1.sql` — aplicada (V1.1) | `is_staff()` (nuevas) | No recontado puntualmente hoy; sin flujo real que las alimente todavía | Pestaña Inventario: catálogo, alerta bajo stock, modales producto/movimiento/historial | `citas` (enlace opcional en movimiento) | ✅ Código↔esquema verificado hoy, sin fusionar |
| **Finanzas** | `public/js/finanzas/{repository,service,ui}.js` | Nuevas: `gastos` (+anulado*), `financial_accounts`, `pagos`, `cuentas_por_cobrar`. Solo lectura: `facturas`, `finanzas_resumen_facturas`, `finanzas_resumen_mensual` | `2026-09-30_finanzas-v1.sql` (solo `gastos`, V1.1) + **V1.2 aplicada fuera de este repo** (ver inconsistencia #2) | `is_staff()` (declarado por Iván; no verificable el contenido exacto de la policy vía OpenAPI) | `pagos`: 0 filas confirmado hoy. `gastos`/`cuentas_por_cobrar`: no recontadas puntualmente, asumidas en 0 | Pestaña Finanzas: 4 KPIs (Facturado/Cobrado/Por cobrar/Gastos), tabla facturas+pago, tabla gastos | **Depende de `facturas`, que depende de `cotizacion.js`** — y `cotizacion.js` tiene un bug de columnas pre-existente (reportado aparte) que bloquea que se generen facturas reales hoy | ✅ Código↔esquema verificado hoy. ⚠️ Su fuente de ingresos reales (facturas) está bloqueada por un bug ajeno a este módulo |
| **Ventas** | `public/js/ventas/{repository,service,ui}.js` | `ventas`, `venta_items` (**ya existen en Supabase**, 0 filas) | `2026-10-01_ventas-v1.sql` — existe en el repo; **no hay forma de confirmar que es exactamente lo que se ejecutó** (ver inconsistencia #1) | Asumida `is_staff()`, no verificable hoy | 0 filas confirmado con evidencia (`content-range: */0`) | Pestaña Ventas: registro diario, modal nueva venta (producto de Inventario o servicio de Cotizaciones, + nuevo servicio inline) | `productos` (Inventario), `DB.get('procs')` (vv_store, Cotizaciones), `inventario_movimientos` (motivo `'venta'` — **no verificado si el constraint ya se actualizó**) | ⚠️ Tablas ya en Supabase pero sin transacciones reales; código probado solo con datos sintéticos; **NO integrado a Finanzas a propósito** (dualidad tutores/propietarios) |

\* Confirmado hoy contra el esquema real que `gastos` tiene `anulado`/`anulado_at`/`anulado_por`, que mi migración original no incluía — fueron agregadas por fuera de este repo (mismo patrón que la inconsistencia #2).

---

## `tutores` vs. `propietarios` — identidades comerciales distintas

Confirmado hoy contra el esquema real (no es una suposición):

| | `tutores` | `propietarios` |
|---|---|---|
| Columnas | `id, nombre, identificacion, celular, telefono, email, ciudad, direccion, contacto_emergencia, activo, saas_prop_id, creado_en, actualizado_en, como` | `id, nombre, email, telefono, created_at` |
| Quién lo usa | `pacientes.tutor_id`, `citas.tutor_id` (Agenda) | `cotizaciones.propietario_id`, `facturas.propietario_id`, `ventas.propietario_id` |
| Origen | Lado Portal Tutores / espejo relacional de vv_store (`saas_prop_id` apunta de vuelta al `props` local) | Lado Cotizaciones/Facturación (más simple, sin enlace a vv_store) |

**No existe ningún FK ni columna que vincule una fila de `tutores` con su
fila equivalente en `propietarios`.** Un mismo cliente real puede existir en
una tabla, en la otra, en ambas con ids distintos, o en ninguna (venta de
mostrador). Esto es precisamente por lo que Ventas no se conectó a Finanzas
en este ciclo: hacerlo hoy significaría construir sobre una identidad de
cliente que no está resuelta, y cualquier intento de "adivinar" el enlace
(por nombre, por teléfono) arrastraría el mismo riesgo que ya se evitó en
Agenda (mascotas/tutores homónimos).

---

## Inconsistencias encontradas

1. **La migración de Ventas no está "registrada"** — las tablas `ventas`/
   `venta_items` ya existen en Supabase, pero no hay ninguna tabla de control
   de versiones de esquema (tipo `schema_migrations`) que diga qué script
   exacto se corrió, cuándo, ni quién. El archivo del repo
   (`2026-10-01_ventas-v1.sql`) es la única fuente de verdad disponible, pero
   es un documento, no un registro verificable contra la base. Mismo problema
   de fondo que el punto 2.

2. **V1.2 (financial_accounts/pagos/cuentas_por_cobrar/las 2 vistas/columnas
   nuevas de gastos) se aplicó directo en Supabase, sin pasar por un archivo
   `.sql` versionado en este repo.** Existe en Supabase, se confirmó hoy, pero
   el repo no tiene el script que la creó — solo mi migración original de
   `gastos` (sin esas 3 columnas) y nada para las 3 tablas/2 vistas nuevas.
   Esto ya se señaló al empezar el Ciclo 3 de Finanzas; sigue sin resolverse
   y conviene que quede como tarea explícita: escribir un `.sql` que
   documente (no que re-ejecute) lo que ya existe, para que el repo deje de
   estar desincronizado de la base real.

3. **No se pudo verificar si el constraint de `inventario_movimientos.motivo`
   ya incluye `'venta'`** — `pg_constraint` no se expone vía el endpoint
   OpenAPI de PostgREST (solo tablas/vistas/columnas), y no se intentó un
   insert real para no escribir en producción. Si alguien intenta vender un
   producto desde Ventas antes de confirmar esto, el insert a
   `inventario_movimientos` puede fallar — ya está manejado con gracia
   (mensaje de error específico, ver `ventas-repository.js`), pero el dato en
   sí queda sin confirmar.

4. **El bug de `cotizacion.js`** (reportado en un ciclo anterior: envía
   columnas que no existen en `cotizaciones`/`cotizacion_items`/
   `factura_items` reales) sigue sin resolver. No se tocó en este ciclo
   (fuera de alcance), pero bloquea indirectamente que Finanzas tenga
   facturas reales para mostrar.

---

## Riesgos

- **Deuda de trazabilidad de esquema**: con dos personas (Iván + ChatGPT)
  aplicando SQL directo en Supabase y un repo que solo versiona lo que yo
  preparo, el repo y la base real pueden desalinearse sin que nadie lo note
  hasta que un `insert` falla en producción. Mitigación sugerida para el
  próximo ciclo: un archivo único `db/ESQUEMA-REAL.md` que se actualice cada
  vez que alguien confirme el esquema real (como se hizo hoy), en vez de
  reconstruirlo cada vez desde cero.
- **`pagos`/`ventas` sin transacción atómica real** (punto 9 del resumen):
  bajo volumen bajo hoy (0 filas), pero si el uso crece, un fallo a mitad de
  un `crearVenta` puede dejar una venta sin sus ítems, o ítems sin su
  movimiento de inventario. Los mensajes de error ya dicen qué paso falló,
  pero no revierten lo ya guardado.
- **Identidad de cliente dividida** (tutores vs. propietarios): si se
  integra Ventas↔Finanzas↔Agenda sin resolver esto primero, el riesgo real
  es generar reportes financieros o de historial que cuenten al mismo
  cliente dos veces, o le atribuyan compras a la persona equivocada.

---

## Pruebas ejecutadas (solo consistencia, nada nuevo)

- `node -c` en los 15 archivos de `agenda/`, `inventario/`, `finanzas/`,
  `ventas/`, más `dashboard.js`, `nav.js`, `modals.js` — todos válidos.
- `index.html`: 0 ids duplicados, 723 `<div>` / 723 `</div>` (balanceado).
- Esquema real de Supabase recontrastado hoy contra las 4 capas de
  repository (13 tablas/vistas, confirmado 1-a-1 con el OpenAPI de
  PostgREST) — ver auditoría del ciclo anterior, repetida hoy para este
  consolidado.
- Conteo real de filas (`Prefer: count=exact`) en `ventas`, `venta_items`,
  `pagos`, `cuentas_por_cobrar` → las 4 en 0.
- Regresión de UI con Playwright y datos sintéticos (sin tocar Supabase
  real): las 13 pestañas navegan, los 9 modales (nuevos y existentes) abren
  y cierran, sin errores de consola nuevos fuera del ya conocido
  "supabaseUrl is required" (falta de config local, no es un bug).

---

## Siguiente ciclo propuesto: V1.3 Audit

Tal como lo planteó Iván: revisar específicamente el flujo

```
Venta → Inventario → Factura → Pago → Caja/Banco
```

porque ahí es donde estos módulos separados se convierten en un SaaS
coherente — y donde la dualidad tutores/propietarios va a tener que
resolverse antes de conectar nada, no después.
