// Módulo: Agenda — capa de datos
//
// Único archivo de Agenda que habla con Supabase. Todo lo demás (reglas,
// pantalla) pasa por aquí — así, si mañana cambia cómo se guarda una cita,
// se cambia en un solo lugar.
//
// Trabaja sobre la tabla `citas`, que YA existía en Supabase con 0 filas y
// sin ningún código que la usara (ver db/migraciones/2026-09-30_agenda-v1.sql).
// No es parte de vv_store/DB: es una tabla relacional normal, protegida por
// la misma política is_staff() que ya usa el resto del sistema — por eso
// basta con getSB() (la misma conexión que usa espejo.js), sin nada extra.
//
// A diferencia de vv_store, aquí NO hay copia local: cada función consulta
// Supabase directo. Con unas pocas citas por día, no hace falta cachear nada.

const AgendaRepo = {
  // Citas en un rango de fechas (inclusive), la más próxima primero.
  async listar(desdeISO, hastaISO) {
    const sb = getSB(); if (!sb) return [];
    const { data, error } = await sb.from('citas').select('*')
      .gte('fecha_hora', desdeISO).lte('fecha_hora', hastaISO)
      .order('fecha_hora', { ascending: true });
    if (error) { console.warn('[agenda] listar:', error.message); return []; }
    return data || [];
  },

  // Todas las citas de una mascota (para "última consulta" y el historial).
  async porPaciente(pacienteId) {
    const sb = getSB(); if (!sb || !pacienteId) return [];
    const { data, error } = await sb.from('citas').select('*')
      .eq('paciente_id', pacienteId).order('fecha_hora', { ascending: false });
    if (error) { console.warn('[agenda] porPaciente:', error.message); return []; }
    return data || [];
  },

  // El enlace de una mascota local (DB.get('mas'), id tipo 'm1790...') hacia
  // su fila real en `pacientes` vive AL REVÉS de lo que uno esperaría: es
  // `pacientes.saas_mas_id` el que apunta de vuelta al id local, no al
  // contrario (la mascota local no sabe su propio uuid de `pacientes`).
  // `pacientes.tutor_id` ya es el uuid real de `tutores`, así que una sola
  // consulta resuelve los dos enlaces que necesita la cita.
  // Si el espejo aún no alcanzó a crear esa fila (guardado muy reciente, o
  // falló), devuelve nulls — la cita igual se guarda, con el nombre y
  // teléfono como texto (las columnas que ya traía `citas` para ese caso).
  async resolverEnlace(mascotaLocalId) {
    const sb = getSB(); if (!sb || !mascotaLocalId) return { pacienteId: null, tutorId: null };
    const { data, error } = await sb.from('pacientes').select('id, tutor_id')
      .eq('saas_mas_id', mascotaLocalId).maybeSingle();
    if (error || !data) return { pacienteId: null, tutorId: null };
    return { pacienteId: data.id, tutorId: data.tutor_id || null };
  },

  async crear(fila) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('citas').insert(fila).select().single();
    if (error) throw error;
    return data;
  },

  async actualizar(id, cambios) {
    const sb = getSB(); if (!sb) throw new Error('Sin conexión');
    const { data, error } = await sb.from('citas').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Inverso de resolverEnlace: de un id de `pacientes` (uuid) devuelve el id
  // LOCAL de la mascota (DB.get('mas')). Necesario para "Ir a Historia" desde
  // una cita — buscar por nombre sería ambiguo: en los datos reales ya hay
  // más de una mascota con el mismo nombre (ej. dos "Pancho" de dueños
  // distintos), así que emparejar por texto abriría la historia equivocada.
  async idLocalDeMascota(pacienteIdSupabase) {
    const sb = getSB(); if (!sb || !pacienteIdSupabase) return null;
    const { data, error } = await sb.from('pacientes').select('saas_mas_id')
      .eq('id', pacienteIdSupabase).maybeSingle();
    if (error || !data) return null;
    return data.saas_mas_id || null;
  },

  // Cuántas citas hay hoy (para el contador del sidebar). Cuenta liviana,
  // sin traer las filas completas.
  async contarHoy() {
    const sb = getSB(); if (!sb) return 0;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
    const { count, error } = await sb.from('citas').select('id', { count: 'exact', head: true })
      .gte('fecha_hora', hoy.toISOString()).lt('fecha_hora', manana.toISOString())
      .not('estado', 'in', '(cancelada,no_asistio)');
    if (error) { console.warn('[agenda] contarHoy:', error.message); return 0; }
    return count || 0;
  }
};
