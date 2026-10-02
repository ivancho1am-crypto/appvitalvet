// Módulo: Marketing — reglas de negocio
//
// Nada de DOM, nada de Supabase — a propósito: Marketing v1 es 100%
// frontend sobre datos que ya están cargados (DB.get('props')/DB.get('mas'),
// vv_store), igual criterio que estadisticas-core.js. No hay repository
// porque no hay nada que pedirle a Supabase todavía.

// Mismos 5 cortes y la MISMA fórmula que ya usa estadisticas-core.js (buildData)
// — no se reinventa el cálculo de edad, se iguala a propósito.
const MKT_GRUPOS_ETARIOS = ['< 1 año', '1–3 años', '3–7 años', '7–12 años', '> 12 años'];

function mktGrupoEtario(fn) {
  if (!fn) return null;
  const anios = (new Date() - new Date(fn)) / (365.25 * 864e5);
  if (anios < 1) return '< 1 año';
  if (anios < 3) return '1–3 años';
  if (anios < 7) return '3–7 años';
  if (anios < 12) return '7–12 años';
  return '> 12 años';
}

// Texto natural para el mensaje ("4 años", "8 meses") — distinto del edad()
// compacto de helpers.js ("4a 2m"), que sigue usándose tal cual en la tabla.
function mktEdadTexto(fn) {
  if (!fn) return 'edad no registrada';
  const n = new Date(), b = new Date(fn);
  let a = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth();
  if (m < 0) { a--; m += 12 }
  if (a > 0) return a + (a === 1 ? ' año' : ' años');
  return m > 0 ? m + (m === 1 ? ' mes' : ' meses') : 'menos de 1 mes';
}

const MKT_REPRO = { esterilizado: 'Esterilizado', no_esterilizado: 'No esterilizado' };
// 'castrado' es el mismo concepto que 'esterilizado' (término usado para
// machos en mascotas.js) — se agrupa junto para el filtro, pero la tabla
// sigue mostrando el valor real tal cual está guardado.
function mktEsEsterilizado(repr) { return repr === 'esterilizado' || repr === 'castrado' }

// Une mascota + su tutor en una sola fila "paciente", lista para filtrar y
// para armar el mensaje. Mascotas sin tutor encontrado (dato huérfano) se
// excluyen — no se puede contactar a un tutor que no existe.
function mktConstruirPacientes(props, mascotas) {
  const propsPorId = {}; props.forEach(p => { propsPorId[p.id] = p });
  return mascotas
    .map(m => {
      const tutor = propsPorId[m.pid];
      if (!tutor) return null;
      return {
        mascotaId: m.id,
        mascotaNombre: m.nombre,
        especie: m.esp,
        raza: (m.raza || '').trim(),
        fn: m.fn || null,
        grupoEtario: mktGrupoEtario(m.fn),
        repr: m.repr || '',
        sexo: m.gen || '',
        tutorId: tutor.id,
        tutorNombre: tutor.nombre || '',
        tutorPrimerNombre: (tutor.nombre || '').trim().split(/\s+/)[0] || '',
        telefono: (tutor.telefono || '').trim(),
        ciudad: (tutor.ciudad || '').trim(),
      };
    })
    .filter(Boolean);
}

// Listas de opciones para los <select> dinámicos (Raza/Ciudad) — ordenadas,
// sin vacíos ni duplicados.
function mktListaRazas(pacientes) {
  return [...new Set(pacientes.map(p => p.raza).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}
function mktListaCiudades(pacientes) {
  return [...new Set(pacientes.map(p => p.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

// Filtro combinado — cada campo en 'todos' no filtra nada.
function mktFiltrarPacientes(pacientes, filtros) {
  return pacientes.filter(p => {
    if (filtros.especie !== 'todos' && p.especie !== filtros.especie) return false;
    if (filtros.raza !== 'todos' && p.raza !== filtros.raza) return false;
    if (filtros.grupoEtario !== 'todos' && p.grupoEtario !== filtros.grupoEtario) return false;
    if (filtros.sexo !== 'todos' && p.sexo !== filtros.sexo) return false;
    if (filtros.ciudad !== 'todos' && p.ciudad !== filtros.ciudad) return false;
    if (filtros.reproduccion === 'esterilizado' && !mktEsEsterilizado(p.repr)) return false;
    if (filtros.reproduccion === 'no_esterilizado' && p.repr !== 'no_esterilizado') return false;
    return true;
  });
}

// Normaliza un teléfono guardado (ej. "+573103314665" o "3103314665") al
// formato que pide wa.me: solo dígitos, con indicativo de país. Si ya trae
// indicativo (57 + 10 dígitos = 12), se deja igual; si son 10 dígitos
// sueltos (celular colombiano sin indicativo), se le antepone 57; en
// cualquier otro caso se devuelven los dígitos tal cual (mejor esfuerzo,
// sin inventar un indicativo que podría estar mal).
function mktNumeroWhatsapp(telefono) {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (digitos.length === 12 && digitos.startsWith('57')) return digitos;
  if (digitos.length === 10) return '57' + digitos;
  return digitos;
}

// Reemplaza las 4 variables soportadas. Si falta un dato (ej. sin raza),
// queda un string vacío en su lugar — nunca se inventa un valor.
function mktAplicarPlantilla(mensaje, paciente) {
  return (mensaje || '')
    .replace(/\{tutor\}/g, paciente.tutorPrimerNombre || '')
    .replace(/\{mascota\}/g, paciente.mascotaNombre || '')
    .replace(/\{raza\}/g, paciente.raza || '')
    .replace(/\{edad\}/g, mktEdadTexto(paciente.fn));
}

function mktLinkWhatsapp(telefono, mensaje) {
  const numero = mktNumeroWhatsapp(telefono);
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
