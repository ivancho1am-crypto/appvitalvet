# VitalVet CRV — Panel de Gestión Clínica (SaaS interno)

**URL producción:** https://appvitalvet-production.up.railway.app/  
**Última actualización:** 2026-06-10  
**Tipo:** Software de gestión interna de la clínica · uso exclusivo del equipo VitalVet CRV  
**Proyecto:** Barbosa, Santander, Colombia

---

## Qué es este sistema

Panel web para uso interno del veterinario. Permite gestionar propietarios, mascotas, historias clínicas, seguimientos, recordatorios y cotizaciones. Funciona offline gracias a `localStorage` y sincroniza los datos en la nube vía Supabase.

---

## Stack

| Capa | Tecnología |
|---|---|
| Servidor | Node.js + Express (sirve archivos estáticos) |
| Frontend | Vanilla JS (sin frameworks) + HTML + CSS |
| Base de datos | Supabase — proyecto `wjzxdevrnzvgklapolve` (mismo que Portal Tutores) |
| Persistencia | `localStorage` (offline-first) + tabla `vv_store` (sync en la nube) |
| Hosting | Railway |
| Segundo dashboard | `/estadisticas.html` — página separada de estadísticas |

---

## Estructura de archivos

```
vitalvet-app/
├── server.js              — Express: inyecta SB_URL + SB_KEY en index.html y sirve /public
├── railway.toml           — Deploy config: node server.js, restart ON_FAILURE
├── rls_vv_store.sql       — Política RLS de vv_store (solo authenticated)
└── public/
    ├── index.html         — SPA principal (~583 líneas)
    ├── estadisticas.html  — Dashboard de estadísticas (~744 líneas)
    ├── css/styles.css
    └── js/
        ├── config.js      — Lee window.__SB_URL y window.__SB_KEY inyectados por server.js
        ├── db.js          — DB: localStorage + sync Supabase (vv_store)
        ├── auth.js        — doLogin() / doLogout() con Supabase Auth
        ├── nav.js         — go(), boot(), rStats() — navegación entre tabs
        ├── propietarios.js — CRUD propietarios + sync al CRM bot
        ├── mascotas.js    — CRUD mascotas (vinculadas a propietario)
        ├── historia.js    — Historias clínicas (~643 líneas, módulo más complejo)
        ├── seguimiento.js — Seguimiento activo: hospitalización / ambulatorio
        ├── recordatorios.js — Recordatorios automáticos (cumpleaños, vacunas, controles)
        ├── cotizacion.js  — Cotizaciones de servicios
        ├── informes.js    — Tablas de propietarios/mascotas + exportar CSV
        ├── helpers.js     — Utilidades: edad(), EI(), avColor(), parseFecha()
        ├── modals.js      — openM(), closeM()
        ├── app.js         — Entry point (1 línea)
        └── seed.js        — Datos de ejemplo para desarrollo
```

---

## Variables de entorno (Railway)

```
SUPABASE_URL=https://wjzxdevrnzvgklapolve.supabase.co
SUPABASE_ANON_KEY=<anon key pública>
PORT=<asignado por Railway>
```

El servidor inyecta estas variables en el HTML como `window.__SB_URL` y `window.__SB_KEY` antes de servir la página.

---

## Cómo funciona la sincronización de datos

```
localStorage (lectura instantánea offline)
      ↕  al login y al guardar
vv_store table en Supabase (backup en la nube)
```

**Claves en `vv_store`:**

| Key | Contenido |
|---|---|
| `props` | Array de propietarios |
| `mas` | Array de mascotas |
| `hist` | Array de historias clínicas |
| `segs` | Array de seguimientos activos |
| `procs` | Procedimientos |
| `cots` | Cotizaciones |
| `recs` | Recordatorios personalizados |

Al hacer login, `DB.loadAll()` compara `localStorage` vs Supabase y usa el que tenga más registros. Siempre escribe en ambos lados al guardar.

---

## Módulos / Tabs

| Tab | Módulo | Descripción |
|---|---|---|
| Propietarios | `propietarios.js` | CRUD dueños: CC, nombre, teléfono, email, dirección. Al guardar → sync a CRM bot |
| Mascotas | `mascotas.js` | CRUD mascotas: especie, raza, género, fecha nacimiento, peso, chip. Al crear → abre historia |
| Historias Clínicas | `historia.js` | Registro médico completo. 16 tipos de eventos (ver abajo) |
| Seguimiento | `seguimiento.js` | Pacientes hospitalizados/ambulatorios con contador de días. Alta médica cierra el seguimiento |
| Recordatorios | `recordatorios.js` | Automático: cumpleaños próximos (30 días), vacunas (60 días), desparasitaciones (60 días), controles (90 días) |
| Cotizaciones | `cotizacion.js` | Generador de presupuestos de servicios |
| Informes | `informes.js` | Tablas filtables + exportar CSV (propietarios, mascotas, historias) |
| Estadísticas | `estadisticas.html` | Dashboard gráfico (página separada) |

### Tipos de eventos en historia clínica

`consulta`, `vacunacion`, `desparasitacion`, `formula`, `cirugia`, `laboratorio`, `imagen`, `hospitalizacion`, `orden`, `peluqueria`, `guarderia`, `seguimiento`, `documento`, `remision`, `cita`, `mensaje`

---

## Servicios externos conectados

| URL | Para qué |
|---|---|
| `https://vitabot-vitalvet-production.up.railway.app/api/crm/sync-patient` | Sync de propietario + mascotas al CRM/bot WhatsApp cuando se guarda un propietario (fire-and-forget) |

---

## Base de datos Supabase

**Proyecto:** `wjzxdevrnzvgklapolve` (compartido con el Portal Tutores)

### Tabla usada por este sistema

| Tabla | RLS | Descripción |
|---|---|---|
| `vv_store` | ✅ solo `authenticated` | Par clave-valor con arrays JSON. Una fila por key (props, mas, hist, etc.) |

**Política RLS aplicada** (`rls_vv_store.sql`):
```sql
ALTER TABLE vv_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo_autenticados" ON vv_store
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## Auth

- Supabase Auth (email/password)
- Usuario único: el veterinario (Iván)
- La `ANON_KEY` se usa desde el cliente para autenticar — el cliente Supabase se crea con `supabase.createClient(SB_URL, SB_KEY)` usando la anon key

---

## Deploy y CI/CD

- Push a `main` → Railway auto-deploy
- `railway.toml`: `startCommand = "node server.js"`, `restartPolicyType = "ON_FAILURE"`, `maxRetries = 3`
- No hay build step — los archivos JS son vanilla, se sirven directamente

```bash
# Desarrollo local
npm install
node server.js
# → http://localhost:3000
```

---

## Integración bidireccional con el Portal Tutores

### Bridge SaaS → Portal

Cada entrada clínica guardada en `historia.js` se escribe también a `historia_clinica` vía `syncHistoriaClinica()`. El `paciente_id` (UUID) se resuelve desde `mas.paciente_id`. La función RPC `create_paciente_from_saas(p_cedula, ...)` (SECURITY DEFINER) crea el paciente en el Portal cuando el vet crea una nueva mascota cuyo propietario tiene cédula vinculada.

Bridge inicial: función `bridge_mas_to_pacientes_function` vinculó 486/487 mascotas existentes con UUIDs.

### Sincronización multi-dispositivo

| Mecanismo | Descripción |
|---|---|
| **Timestamp sync** | `DB.set()` guarda `updated_at` en `vv_meta`; `DB.loadAll()` compara con `vv_store.updated_at` — gana el más reciente |
| **Realtime** | `DB.initRealtime()` suscripción Supabase Realtime a `vv_store` — actualiza localStorage automáticamente desde otro dispositivo |
| **Botón Sincronizar** | 🔄 en topbar — ejecuta `DB.loadAll()` + `boot()` manualmente |

### Tablas Supabase usadas

| Tabla | Operación | Propósito |
|---|---|---|
| `vv_store` | READ/WRITE | Datos principales (props, mas, hist, etc.) |
| `historia_clinica` | WRITE | Bridge: copia de entradas clínicas con `saas_hist_id` UNIQUE |
| `pacientes` | WRITE via RPC | Crear paciente Portal al crear mascota nueva |
| `tutores` | READ (via RPC) | Resolver cédula → app_user_id |

---

## Pendientes / Mejoras conocidas

| Item | Prioridad |
|---|---|
| **Multi-usuario**: hoy `vv_store` no tiene `user_id` — si otro veterinario hace login, ve todos los datos | 🔴 si se abre a más usuarios |
| **Portal→SaaS bidireccional**: vacunas del Portal aún no aparecen en el SaaS (solo SaaS→Portal está completo) | 🟡 próxima fase |
| **Backup automático**: `localStorage` puede perderse si el usuario limpia el navegador | 🟡 |
| **Límite de datos**: `vv_store.data` crece ilimitado. Si `hist` supera ~5MB el upsert puede fallar | 🟡 con clínica grande |
| **Paginación en historias**: `hist` se carga completo en memoria al login | 🟢 cuando haya tiempo |

---

VitalVet CRV © 2026 · Barbosa, Santander, Colombia
