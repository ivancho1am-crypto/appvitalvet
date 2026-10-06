// Módulo: Agenda — reglas de negocio
//
// Nada de DOM, nada de Supabase. Solo cálculos y decisiones, para que se
// puedan cambiar sin tocar cómo se ve la pantalla ni cómo se guarda el dato.

// Los mismos 5 estados que se acordaron para v1 — recortados de los 8 que se
// propusieron inicialmente. Salas, profesional múltiple y recordatorio
// automático quedan fuera de esta primera versión a propósito.
const AG_ESTADOS = {
  programada:  { label: 'Programada',  badge: 'bg-gray',   siguiente: ['confirmada', 'cancelada'] },
  confirmada:  { label: 'Confirmada',  badge: 'bg-teal',   siguiente: ['atendida', 'no_asistio', 'cancelada'] },
  atendida:    { label: 'Atendida',    badge: 'bg-green',  siguiente: [] },
  cancelada:   { label: 'Cancelada',   badge: 'bg-red',    siguiente: ['programada'] },
  no_asistio:  { label: 'No asistió',  badge: 'bg-yellow', siguiente: ['programada'] },
};

// Mismo vocabulario de servicios que ya usa Cotización — para que "cirugía"
// signifique lo mismo en toda la app.
const AG_SERVICIOS = {
  consulta: 'Consulta general', vacunacion: 'Vacunación', desparasitacion: 'Desparasitación',
  cirugia: 'Cirugía', laboratorio: 'Laboratorio', imagen: 'Imagen diagnóstica',
  hospitalizacion: 'Hospitalización', peluqueria: 'Peluquería', otro: 'Otro',
};

function agEstadoInfo(estado) { return AG_ESTADOS[estado] || AG_ESTADOS.programada; }

// Rango [00:00, 23:59:59] del día dado (o de hoy).
function agRangoDia(fecha) {
  const d = fecha ? new Date(fecha) : new Date();
  const ini = new Date(d); ini.setHours(0, 0, 0, 0);
  const fin = new Date(d); fin.setHours(23, 59, 59, 999);
  return { desde: ini, hasta: fin };
}

// Arma la fila lista para guardar. `pacienteId`/`tutorId` ya vienen resueltos
// (AgendaRepo.resolverEnlace, en agenda-ui.js) porque esa resolución necesita
// una consulta a Supabase y esta capa no toca la red.
//
// Dos modos (2026-10-06, pedido de Iván) — `citas` ya tenía las columnas de
// texto libre (tutor_name/phone/mascota_nombre/mascota_especie) para esto,
// nadie las usaba todavía porque la UI exigía una mascota ya registrada:
//   registrado=true  -> mascotaId apunta a una mascota real de vv_store,
//                       igual que siempre (nombre/teléfono se copian del
//                       propietario real).
//   registrado=false -> "cliente nuevo, no registrado" — tutorNombreLibre/
//                       mascotaNombreLibre/etc. son texto escrito a mano.
//                       paciente_id/tutor_id quedan null (no hay con qué
//                       enlazar todavía): la cita existe igual, sin
//                       historia clínica asociada hasta que se registre.
function agConstruirFila({ registrado, mascotaId, tutorNombreLibre, telefonoLibre, mascotaNombreLibre, especieLibre,
                            servicio, fechaHora, duracion, motivo, pacienteId, tutorId }) {
  if (!fechaHora) return { error: 'Selecciona fecha y hora' };
  if (!servicio) return { error: 'Selecciona un servicio' };

  let mascotaNombre, mascotaEspecie, tutorNombre, telefono, mascotaLocal = null;

  if (registrado) {
    if (!mascotaId) return { error: 'Busca y selecciona una mascota' };
    const mas = DB.get('mas').find(m => m.id === mascotaId);
    if (!mas) return { error: 'Mascota no encontrada' };
    const prop = DB.get('props').find(p => p.id === mas.pid);
    mascotaNombre = mas.nombre; mascotaEspecie = mas.esp;
    tutorNombre = prop ? prop.nombre : null; telefono = prop ? prop.telefono : null;
    mascotaLocal = mas;
  } else {
    if (!(tutorNombreLibre || '').trim()) return { error: 'Escribe el nombre del tutor' };
    if (!(mascotaNombreLibre || '').trim()) return { error: 'Escribe el nombre de la mascota' };
    tutorNombre = tutorNombreLibre.trim();
    telefono = (telefonoLibre || '').trim() || null;
    mascotaNombre = mascotaNombreLibre.trim();
    mascotaEspecie = especieLibre || null;
  }

  return {
    // Ojo: `fila` nunca incluye `estado` a propósito — así, sea cual sea el
    // default real de esa columna en Supabase (cambió más de una vez durante
    // el desarrollo), esta función no lo pisa ni necesita saberlo.
    fila: {
      paciente_id: registrado ? (pacienteId || null) : null,
      tutor_id: registrado ? (tutorId || null) : null,
      mascota_nombre: mascotaNombre, mascota_especie: mascotaEspecie,
      tutor_name: tutorNombre, phone: telefono,
      servicio: AG_SERVICIOS[servicio] || servicio,
      fecha_hora: new Date(fechaHora).toISOString(),
      duracion_min: parseInt(duracion, 10) || 30,
      notas: (motivo || '').trim() || null,
    },
    mascotaLocal,   // para poder enlazar con historia.js sin otra consulta — null si es cliente nuevo
  };
}

// Agrupa una lista de citas por día (clave YYYY-MM-DD), para la vista Lista.
function agAgruparPorDia(citas) {
  const grupos = {};
  citas.forEach(c => {
    const clave = (c.fecha_hora || '').slice(0, 10);
    (grupos[clave] = grupos[clave] || []).push(c);
  });
  return grupos;
}

// "12 sep · viernes" — encabezado legible para cada grupo del día.
function agTituloDia(claveISO) {
  const d = new Date(claveISO + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', weekday: 'long' });
}

// Rango del mes de `fecha` (o de hoy), PADDEADO a semanas completas
// (lunes a domingo) para que la grilla de 7 columnas de la vista Mes no
// tenga huecos al principio/final. `primerDia`/`ultimoDia` (sin padding)
// se devuelven aparte, para saber qué celdas pintar "fuera de mes".
function agRangoMes(fecha) {
  const d = fecha ? new Date(fecha) : new Date();
  const primerDia = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const diaSemanaPrimero = primerDia.getDay();              // 0=domingo..6=sábado
  const offsetInicio = diaSemanaPrimero === 0 ? 6 : diaSemanaPrimero - 1;
  const desde = new Date(primerDia); desde.setDate(desde.getDate() - offsetInicio); desde.setHours(0, 0, 0, 0);

  const diaSemanaUltimo = ultimoDia.getDay();
  const offsetFin = diaSemanaUltimo === 0 ? 0 : 7 - diaSemanaUltimo;
  const hasta = new Date(ultimoDia); hasta.setDate(hasta.getDate() + offsetFin); hasta.setHours(23, 59, 59, 999);

  return { desde, hasta, primerDia, ultimoDia };
}
