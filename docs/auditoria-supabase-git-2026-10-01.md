# Auditoría Supabase ↔ Git — Panorama completo del ecosistema VitalVet

**Fecha:** 2026-10-01
**Alcance:** el proyecto Supabase `wjzxdevrnzvgklapolve` (73 tablas/vistas) contrastado contra el historial de Git de los repos que lo usan. Hecho con lecturas de solo lectura (OpenAPI del esquema + `count=exact` por tabla) — ninguna escritura.

---

## 1. Resumen ejecutivo

1. **Este Supabase no es exclusivo de VitalVet.** Es el backend compartido de varios proyectos personales de Iván (VitalVet, VitaBot, Jarvis, OpenClaw/Obsidian, y herramientas de contenido). Eso significa que cualquier problema de seguridad o RLS acá tiene radio de explosión sobre TODOS esos proyectos, no solo VitalVet.
2. **Tres apps distintas leen/escriben el mismo Supabase:** `appvitalvet` (este dashboard), `agente-whatsapp-vitabot` (VitaBot, el bot de WhatsApp) y `vitalvet-app-tutores` (portal de tutores). Comparten algunas tablas (`tutores`, `citas`) y tienen áreas propias.
3. **Lo clínico está vivo; lo operativo/financiero está construido pero sin estrenar.** `tutores` (514), `pacientes` (632) e `historia_clinica` (1.636) tienen datos reales y crecen. En cambio **Finanzas, Ventas, Inventario, Cotizaciones y Facturas — todo lo construido en v1.x este año — tiene CERO filas reales en Supabase.** Se probó exhaustivamente con datos sintéticos (Playwright) y quedó desplegado, pero Iván todavía no lo ha usado para una operación real de la clínica.
4. **Hay tablas duplicadas/muertas de intentos anteriores**: `propietarios` (0 filas, reemplazada por `tutores`), `mascotas` (0 filas, reemplazada por `pacientes`), `historias_clinicas` (0 filas, con "s", duplicado muerto de `historia_clinica`), `appointments` y `consultas` (0 filas, reemplazadas por `citas`). Ninguna está en uso — son candidatas a limpieza, no urgente.
5. **La tabla `citas` existe pero tiene 0 filas** — la Agenda de `appvitalvet` todavía guarda sus datos en `vv_store` (JSON), no se migró a relacional como sí se hizo con tutores/pacientes/historia_clinica. Mismo patrón de la deuda técnica ya documentada.
6. **Varias tablas financieras (`facturas`, `pagos`, `cotizaciones`, `cuentas_por_cobrar`, etc.) no tienen ninguna migración `.sql` en el repo** — se crearon directo en Supabase antes de que existiera la disciplina de `db/migraciones/`. No es un problema activo, pero es deuda técnica #1 en su forma más antigua.
7. **`agente-whatsapp-vitabot` (el bot que corre en producción) tiene cambios sin commitear** (8 archivos modificados, 4 nuevos sin trackear) — el código que realmente está corriendo no coincide exactamente con lo último que hay en su Git.

---

## 2. El ecosistema — quién es quién

| Repo / carpeta | Qué es | Supabase | Estado del Git |
|---|---|---|---|
| `~/repos/appvitalvet` | Dashboard clínico (este proyecto) — Node/Express + JS vanilla, Railway | `wjzxdevrnzvgklapolve` | Al día, disciplina de migraciones desde 2026-09-24 |
| `~/repos/appvitalvet-guias-clinicas` | Worktree de `appvitalvet` (rama `feature/guias-clinicas-legales`) | misma | Commit hecho, sin pushear (ver `docs/` de esa rama) |
| `/private/tmp/vv-grupoB` | Worktree de `appvitalvet` (rama `feature/doble-escritura-relacional`) | misma | En curso |
| `~/IA-VitalVet/agente-whatsapp-vitabot` | VitaBot — backend real que corre en Railway (`vitabot-backend.git`), agente de WhatsApp con IA, campañas automáticas por edad/esterilización | misma | **8 modificados + 4 sin trackear, no commiteados** |
| `~/repos/vitaboot` | Clon del mismo código, pero remoto Git distinto (`vitaboot.git`) y **desactualizado** (último commit 2026-08-25, sin `routes/campanas-edades.js` que sí existe en el que corre de verdad) | misma | Desincronizado — parece un clon viejo, no el que se despliega |
| `~/repos/vitalvet-app-tutores` | Portal web para que los tutores vean historia de su mascota | misma | Su propio `supabase/schema.sql` ya no coincide con lo real (ver §4) |

**Recomendación:** aclarar con Iván si `vitaboot` (repos/) todavía sirve para algo o es un clon abandonado — hoy puede confundir a cualquiera (incluido un asistente IA) sobre cuál es "la fuente de verdad" del bot.

---

## 3. Inventario completo — las 73 tablas/vistas de Supabase

### 3.1 Núcleo clínico (activo, con datos reales)

| Tabla | Filas | Dueño | Migración en Git |
|---|---:|---|---|
| `tutores` | 514 | appvitalvet + vitalvet-app-tutores (compartida) | `2026-09-24_migracion-a-tablas.sql` |
| `pacientes` | 632 | appvitalvet + vitalvet-app-tutores (compartida) | `2026-09-24_migracion-a-tablas.sql` |
| `historia_clinica` | 1.636 | appvitalvet | `2026-09-24_migracion-a-tablas.sql` |
| `vv_store` | 10 claves | appvitalvet (espejo JSON legado — props/mas/hist/segs/procs/cots/recs/papelera) | predata migraciones; `rls_vv_store.sql` en la raíz |

### 3.2 Operativo/financiero — construido, desplegado, **sin usar todavía** (0 filas)

| Tabla | Filas | Migración en Git |
|---|---:|---|
| `productos` | 0 | `2026-09-30_inventario-v1.sql` (+datos maestros, +lotes, +fecha fabricación) |
| `lotes` | 0 | `2026-10-03_inventario-lotes.sql` |
| `inventario_movimientos` | 0 | `2026-09-30_inventario-v1.sql` |
| `ventas` / `venta_items` | 0 / 0 | `2026-10-01_ventas-v1.sql` (+método de pago) |
| `gastos` | 0 | `2026-09-30_finanzas-v1.sql` |
| `financial_accounts` | 0 | `2026-10-01_seed-cuentas-opcional.sql` |
| `facturas` / `factura_items` | 0 / 0 | **sin migración en el repo** (anterior a la disciplina de `db/migraciones/`) |
| `pagos` | 0 | **sin migración en el repo** |
| `cuentas_por_cobrar` | 0 | **sin migración en el repo** |
| `cotizaciones` / `cotizacion_items` / `cotizacion_items_manual` | 0 | **sin migración en el repo** |
| `finanzas_resumen_facturas` / `finanzas_resumen_mensual` | vistas | **sin migración en el repo** |
| `reglas_precio` | 0 | **sin migración en el repo** |

Vistas de solo cálculo (sin filas propias, correcto que estén vacías de por sí): `inventario_stock_actual`, `inventario_stock_por_lote`.

### 3.3 VitaBot (WhatsApp, automático, activo)

| Tabla | Filas | Migración |
|---|---:|---|
| `whatsapp_leads` | 587 | `agente-whatsapp-vitabot/sql/migrations.sql` |
| `marketing_campaigns` | 60 | **solo ALTER en migrations.sql — el CREATE original no está trackeado** |
| `broadcast_campaign_deliveries` | 27 (+ las de prueba synthetic nunca tocaron esto) | `agente-whatsapp-vitabot/sql/migrations.sql`; ampliada por `appvitalvet/db/migraciones/2026-10-01_marketing_v1_1_manual_tracking.sql` (Marketing v1.1 del dashboard, hoy) |
| `campaign_events`, `assets`, `content_generated`, `daily_reports`, `media_library`, `marketing_chat_sessions`, `marketing_audit`, `marketing_errors` | — | `agente-whatsapp-vitabot/sql/migrations.sql` |
| `citas` | **0** | Creada en `migrations.sql` de VitaBot. Compartida con appvitalvet (la Agenda la referencia desde `2026-09-30_agenda-v1.sql`), pero **ninguna de las dos apps la está usando de verdad todavía** — Agenda de appvitalvet sigue en `vv_store`. |
| `appointments`, `consultas` | 0, 0 | Sin uso — probablemente intentos anteriores de nombrar lo mismo que `citas`. |

### 3.4 Portal de Tutores (`vitalvet-app-tutores`)

| Tabla | Filas | Nota |
|---|---:|---|
| `registro_peso` | 16 | El repo define `registro_pesos` (plural) en su `schema.sql` — **el nombre real en Supabase es singular**. El schema.sql del repo está desactualizado/no coincide con lo desplegado. |
| `vacunas` | 2 | Uso mínimo real |
| `recordatorios` | 1 | Uso mínimo real |
| `mascotas` | **0** | Tabla propia del portal, nunca se usó — los datos reales de mascotas viven en `pacientes` (compartida con appvitalvet), no acá. |
| `tutores` | (514, compartida) | Confirmado: usa la MISMA tabla que appvitalvet, no una propia. |

### 3.5 Tablas "muertas" (0 filas, sin consumidor activo detectado)

`propietarios`, `mascotas`, `historias_clinicas` (con s), `appointments`, `consultas`, `app_errors`, `app_users`, `rate_limit_log`, `workflow_logs`, `desparasitaciones`, `formulas`, `laboratorios`, `medicamentos`, `procedimientos`, `procedimiento_detalle`, `pruebas_laboratorio`, `eventos`, `journeys`, `engagement_events`, `lead_tags`, `leads`, `administradores`, `system_settings`.

No se tocó ninguna — es un inventario para que Iván decida qué archivar algún día, no una recomendación de borrado ahora mismo (fuera del alcance de esta auditoría, y potencialmente riesgoso sin confirmar con él tabla por tabla).

### 3.6 Fuera del alcance de VitalVet (mismo Supabase, otros proyectos de Iván)

`jarvis_config` (Jarvis Voice Assistant), `obsidian_chunks`/`obsidian_documents` (vault/OpenClaw), `capcut_projects`, `cs_jobs`/`cs_proyectos`/`cs_uploads`, `self_chat_inbox`, `conversaciones`, `mensajes`, `guias_clinicas`/`guias_clinicas_versiones` (25 filas — SÍ pertenece a VitalVet, rama `feature/guias-clinicas-legales`, ver nota abajo).

**Nota sobre `guias_clinicas`:** tiene 25 filas reales en Supabase, pero el memory de esta sesión dice que esa rama "commit hecho, sin pushear" — es decir, **el contenido ya se insertó en Supabase, pero el código para mostrarlo en el dashboard todavía no se fusionó a main.** Otro caso del mismo patrón: Supabase adelantado, Git atrás.

---

## 4. Hallazgos — ordenados por qué tan accionable es cada uno

| # | Hallazgo | Riesgo | Acción sugerida |
|---|---|---|---|
| 1 | `agente-whatsapp-vitabot` corriendo en producción tiene 8 archivos modificados y 4 sin commitear | Medio — si el servidor se reinicia desde una copia limpia del repo, se pierden esos cambios silenciosamente | Que Iván (o quien mantenga el bot) revise y commitee esos cambios cuanto antes |
| 2 | `~/repos/vitaboot` es un clon desactualizado con remoto Git distinto al que realmente se despliega | Bajo, pero confuso | Aclarar si sigue sirviendo para algo; si no, archivarlo o borrarlo para no confundir a futuros agentes/colaboradores |
| 3 | `facturas/pagos/cotizaciones/cuentas_por_cobrar/reglas_precio` sin migración `.sql` en el repo | Bajo (ya están estables, nadie las está alterando activamente) | Si algún día hay que tocar su esquema, documentar su estructura ANTES de tocarla (ya que no hay `.sql` de referencia) |
| 4 | `citas` existe en Supabase pero Agenda de appvitalvet sigue usando `vv_store` | Bajo hoy, crece con el tiempo | Mismo patrón que la deuda técnica #2 ya aceptada (unificar legado JSON con relacional) — se puede sumar Agenda a esa misma tarea futura |
| 5 | `vitalvet-app-tutores/supabase/schema.sql` no coincide con lo desplegado (`registro_pesos` vs `registro_peso`, y `mascotas` nunca usada) | Bajo | Actualizar ese schema.sql para que describa la realidad, o archivarlo si ya no se mantiene ese repo |
| 6 | Módulos Finanzas/Ventas/Inventario/Cotizaciones: 0 filas reales pese a estar desplegados | Ninguno (es solo un dato de adopción, no un bug) | Ninguna acción técnica — es información para priorizar: ¿vale la pena seguir sumando funciones a estos módulos antes de que se usen por primera vez en la clínica real? |

---

## 5. Relación con la deuda técnica ya documentada (`docs/deuda-tecnica.md`)

- **Debt #1** (sincronizar historial Git↔Supabase) — esta auditoría confirma que es más profunda de lo que parecía: no son solo migraciones sueltas, son **tablas enteras** (`facturas`, `pagos`, `cotizaciones`, etc.) creadas antes de que existiera `db/migraciones/`, más el caso de VitaBot con cambios reales sin commitear.
- **Debt #2** (unificar propietarios/mascotas con tutores/pacientes) — se confirma que `propietarios`/`mascotas` ya están en 0 filas (la migración de hace unos días ya las vació de uso real); lo que falta es solo el cierre simbólico (archivarlas) y extender el mismo criterio a `citas`/Agenda.
- **Debt #3 y #4** (transaccionalidad de ventas, auditoría de SECURITY DEFINER) — sin cambios, siguen abiertas; no se investigaron en esta auditoría (requiere ver el código SQL de las funciones, no solo el esquema de tablas).

---

## 6. Qué NO cubre esta auditoría (limitaciones conocidas)

- **RLS y políticas de seguridad**: el método de lectura (OpenAPI del esquema) no expone políticas RLS ni funciones `SECURITY DEFINER` — eso sigue siendo la deuda #4, pendiente.
- **Contenido real de los datos**: solo se contaron filas (`count=exact`), no se leyó ningún dato real de ningún tutor/paciente/campaña.
- **vitalvet-app-tutores y VitaBot en profundidad**: se revisó lo suficiente para ubicar sus tablas y detectar el desfase Git↔Supabase, pero no se auditó su código interno con el mismo detalle que `appvitalvet` (fuera del alcance de esta sesión).
