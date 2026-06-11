# VitalVet CRV — Dashboard de Estadísticas Clínicas

**Archivo:** `public/estadisticas.html`  
**URL producción:** https://appvitalvet-production.up.railway.app/estadisticas.html  
**URL local:** http://localhost:3000/estadisticas.html (con `node server.js`)  
**Última actualización de datos:** 2026-06-10  

---

## Qué es

Panel de análisis clínico con visualizaciones de los datos registrados en el SaaS interno. Página HTML independiente servida por el mismo servidor Express que el panel principal. No requiere login.

---

## Stack

| Capa | Tecnología |
|---|---|
| Base | HTML vanilla · sin framework |
| Gráficas | Chart.js 4.4.0 + chartjs-plugin-datalabels 2.2.0 (CDN) |
| Servidor | Express (mismo `server.js` del SaaS) |
| Auth | Ninguna — página pública dentro del servidor |

---

## Cómo funciona

Los datos **no se leen en tiempo real** de Supabase ni de localStorage. Están hardcodeados en el objeto `DATA` dentro del propio HTML (línea ~478). Para actualizar los números hay que editar ese objeto manualmente.

```javascript
const DATA = {
  mascotas: 485, propietarios: 402, historial: 1310,
  especies: { canino:392, felino:91, lagomorfo:4 },
  // ... más datos
};
```

**Pendiente:** conectar `DATA` a `vv_store` de Supabase para que los KPIs se actualicen automáticamente al cargar la página.

---

## Secciones del dashboard

| # | Sección | Contenido |
|---|---|---|
| 1 | **Resumen General** | KPIs totales + gráfica de tipos de historial + timeline 18 meses |
| 2 | **Distribución de Pacientes** | Especie · Género · Estado reproductivo · Edad · Top 10 razas · Alimentación |
| 3 | **Epidemiología Clínica** | Top cirugías · Top medicamentos · Motivos de consulta |
| 4 | **Medicina Preventiva** | Top vacunas · Top desparasitantes |
| 5 | **Geografía y Captación** | Distribución por municipio · Fuente de captación de clientes |
| 6 | **Actividad Clínica** | Evolución histórica de consultas · Peso promedio por raza · KPIs de gestión |

---

## KPIs actuales (corte 2026-06-10)

| KPI | Valor |
|---|---|
| Mascotas registradas | 485 |
| Propietarios activos | 402 |
| Registros clínicos totales | 1,310 |
| Tipos de atención | 12 |
| Caninos | 392 (80.8%) |
| Felinos | 91 (18.8%) |
| No esterilizados | 63.2% |
| Raza más frecuente | Criollo(a) — 114 pacientes |
| Municipio principal | Barbosa — 277 pacientes (69%) |
| Top procedimiento | OVH — 48 cirugías |
| Top medicamento | Diciclin — 51 prescripciones |
| Top vacuna | Nobivac DHPPi — 53 dosis |
| Top desparasitante | Endogard — 80 aplicaciones |

---

## Insights clave (para decisiones clínicas)

- **63% sin esterilizar** → oportunidad para campañas de medicina preventiva reproductiva
- **Ratio consulta:cirugía = 1.4:1** → perfil de clínica de nivel 2–3 (alta complejidad)
- **234 laboratorios vs 10 imágenes** → oportunidad de ecógrafo/Rx para reducir derivaciones
- **Barbosa = 69% de pacientes** → posicionamiento local sólido; Puente Nacional + Moniquirá = mercado de expansión
- **Crecimiento Feb–Mar 2026: 22–24 consultas/mes** → base para proyección 300+ consultas anuales

---

## Cómo actualizar los datos

1. Abrir `public/estadisticas.html`
2. Buscar el objeto `const DATA = {` (~línea 478)
3. Editar los valores con los conteos actuales del sistema
4. Guardar → commit → push → Railway actualiza automáticamente

**Fuente para obtener los conteos actuales:**  
En el SaaS panel → Informes → Exportar CSV, o consultando `vv_store` en Supabase:

```sql
SELECT key, jsonb_array_length(data) AS total
FROM vv_store
ORDER BY key;
```

---

## Sidebar — Links

| Link | Destino |
|---|---|
| App Clínica | https://appvitalvet-production.up.railway.app/ |
| VitaCore IA | file:///Users/macbookpro/vitalcore-ia/index.html (local) |

---

VitalVet CRV © 2026 · Barbosa, Santander, Colombia
