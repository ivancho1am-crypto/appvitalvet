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

**Supabase es la fuente de verdad.** Al hacer login, `DB.loadAll()` siempre descarga de Supabase. `DB.set()` escribe en Supabase primero (y en localStorage como caché). Así cualquier dispositivo que entre al SaaS ve los mismos datos.

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
- **Dos usuarios admin** (ambos ven los mismos datos en `vv_store`):
  - Iván: `ivancho1am@gmail.com`
  - Mónica: `monica@vitalvetcrv.com.co` / `Monica2026!`
- La `ANON_KEY` se usa desde el cliente — el cliente Supabase se crea con `supabase.createClient(SB_URL, SB_KEY)` usando la anon key
- RLS de `vv_store`: `auth.role() = 'authenticated'` → cualquier usuario autenticado accede a todos los datos (diseño intencional — es un sistema de un solo equipo)

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

## Pendientes / Mejoras conocidas

| Item | Prioridad |
|---|---|
| **Multi-usuario**: hoy `vv_store` no tiene `user_id` — si otro veterinario hace login, ve todos los datos | 🔴 si se abre a más usuarios |
| **Backup automático**: `localStorage` puede perderse si el usuario limpia el navegador. La sync con Supabase es el respaldo, pero no hay schedule automático | 🟡 |
| **Límite de datos**: `vv_store.data` es un JSON array — crece ilimitado. Si `hist` supera ~5MB, el upsert puede fallar | 🟡 con clínica grande |
| **Paginación en historias**: `hist` se carga completo en memoria al login | 🟢 cuando haya tiempo |

---

VitalVet CRV © 2026 · Barbosa, Santander, Colombia
