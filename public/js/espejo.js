// Módulo: Espejo relacional
//
// La clínica sigue guardando en `vv_store` (un JSON por colección) y esa sigue
// siendo la fuente de verdad. Este módulo replica cada guardado a las tablas
// relacionales — tutores / pacientes / historia_clinica — que son las que
// consulta el portal de tutores, los flujos de n8n y cualquier reporte en SQL.
//
// Sin esto, la copia que se hizo el 2026-09-24 se queda congelada: cada
// paciente nuevo entraría al JSON y nunca llegaría a las tablas.
//
// Reglas de diseño:
//  · NUNCA bloquea ni rompe el guardado. Si el espejo falla, la app funciona
//    igual y el dato queda a salvo en vv_store. Se reintenta al siguiente
//    guardado del mismo registro.
//  · Idempotente: el enlace con el origen vive en saas_prop_id / saas_mas_id /
//    saas_hist_id, no dentro de vv_store. Repetir un espejo no duplica nada.
//  · Mismo mapeo de campos que usó la migración inicial, para que una fila
//    creada hoy sea indistinguible de una migrada ayer.

const ESPEJO_DEBUG = false;  // poner en true para ver cada operación en consola

function _eLog(...args) { if (ESPEJO_DEBUG) console.log('[espejo]', ...args); }
function _eWarn(donde, e) {
  // Se registra pero no se muestra al usuario: el guardado real ya tuvo éxito.
  console.warn('[espejo] ' + donde + ':', e && e.message ? e.message : e);
}

// Texto vacío → null, para no llenar la base de cadenas en blanco. Colapsa
// espacios repetidos y descarta los marcadores de "sin dato" que el panel
// guarda como texto ("N/D", "-"), que en la tabla no son un dato sino ruido.
const _SIN_DATO = ['n/d', 'nd', 'n.d.', '-', '--', 'na', 'n/a', 'sin registro', 'sin dato'];
const _txt = v => {
  const s = (v === 0 ? '0' : (v || '')).toString().trim().replace(/\s+/g, ' ');
  return (!s || _SIN_DATO.indexOf(s.toLowerCase()) !== -1) ? null : s;
};
const _num = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : null; };
const _fecha = v => { const m = /^(\d{4}-\d{2}-\d{2})/.exec((v || '').toString()); return m ? m[1] : null; };

// ── Mapeos ────────────────────────────────────────────────────────────────
// Un propietario de vv_store visto como fila de `tutores`.
function _filaTutor(p) {
  return {
    nombre: _txt(p.nombre) || '(sin nombre)',
    identificacion: _txt(p.cedula),
    celular: _txt(p.telefono),
    telefono: _txt(p.talt),
    email: _txt(p.email),
    direccion: _txt(p.direccion),
    ciudad: _txt(p.ciudad),
    contacto_emergencia: _txt(p.contacto),
    como: _txt(p.como),
    saas_prop_id: p.id
  };
}

// Una mascota de vv_store vista como fila de `pacientes`.
function _filaPaciente(m, tutorId) {
  return {
    tutor_id: tutorId,
    nombre: _txt(m.nombre) || '(sin nombre)',
    especie: _txt(m.esp),
    raza: _txt(m.raza),
    genero: _txt(m.gen),
    fecha_nacimiento: _fecha(m.fn),
    color: _txt(m.color),
    talla: _txt(m.talla),
    peso_actual: _num(m.peso),
    estado_reproductivo: _txt(m.repr),
    chip: _txt(m.chip),
    alimento: _txt(m.ali),
    animal_servicio: !!m.serv,
    apoyo_emocional: !!m.emoc,
    registrado_por: 'Panel clínico',
    saas_mas_id: m.id
  };
}

// Un registro clínico de vv_store visto como fila de `historia_clinica`.
// Los 18 campos con columna propia se mapean; el registro ORIGINAL completo
// va en datos_extra, así que ningún campo se pierde aunque no tenga columna.
function _filaHistoria(h, pacienteId) {
  return {
    paciente_id: pacienteId,
    saas_hist_id: h.id,
    fuente: 'saas',
    tipo: _txt(h.tipo) || 'consulta',
    fecha: _fecha(h.fecha),
    proxima_fecha: _fecha(h.prox),
    peso: _num(h.peso),
    descripcion: _txt(h.desc),
    diagnostico: _txt(h.diag),
    tratamiento: _txt(h.trat),
    medicamentos: _txt(h.med),
    notas: _txt(h.not),
    veterinario: _txt(h.vet),
    observaciones: _txt(h.exam),
    vacuna: _txt(h.vacuna),
    laboratorio: _txt(h.lab),
    lote: _txt(h.lote),
    via_administracion: _txt(h.via),
    producto: _txt(h.producto),
    dosis: _txt(h.dosis),
    datos_extra: h
  };
}

// Campos que solo tienen sentido al crear la fila: al actualizar no se tocan.
const _SOLO_AL_CREAR = ['registrado_por', 'fuente'];
// Campos que son reflejo literal del origen y se refrescan siempre, aunque la
// tabla ya tenga algo: nadie los edita a mano.
const _SIEMPRE = ['datos_extra', 'saas_prop_id', 'saas_mas_id', 'saas_hist_id',
                  'tutor_id', 'paciente_id'];

// ── Utilidad: insertar o actualizar según el enlace con el origen ─────────
//
// `autoritario` decide qué pasa al actualizar una fila que ya existe:
//   true  → el panel manda y refresca todos los campos. Se usa en
//           historia_clinica, que solo escribe la clínica: si el veterinario
//           corrige un diagnóstico, esa corrección debe llegar.
//   false → solo se rellenan los campos VACÍOS, nunca se reemplaza un dato por
//           otro distinto. Se usa en tutores y pacientes, que comparte el
//           portal: el tutor puede haber corregido ahí su teléfono o su
//           dirección, y se comprobó que en varios casos el portal tiene mejor
//           dato que el panel (un teléfono alterno con basura, una cédula que
//           en realidad era un celular, ciudades más completas).
async function _guardar(sb, tabla, columnaEnlace, valorEnlace, fila, autoritario) {
  const { data: existente, error: eSel } = await sb
    .from(tabla).select('*').eq(columnaEnlace, valorEnlace).maybeSingle();
  if (eSel) throw eSel;

  if (existente) {
    const cambios = {};
    for (const clave in fila) {
      const v = fila[clave];
      if (v === null || v === undefined) continue;          // nunca borrar con vacíos
      if (_SOLO_AL_CREAR.indexOf(clave) !== -1) continue;
      const actual = existente[clave];
      const vacio = actual === null || actual === undefined || actual === '';
      if (vacio || autoritario || _SIEMPRE.indexOf(clave) !== -1) cambios[clave] = v;
    }
    if (!Object.keys(cambios).length) { _eLog('sin cambios', tabla, existente.id); return existente.id; }
    const { error } = await sb.from(tabla).update(cambios).eq('id', existente.id);
    if (error) throw error;
    _eLog('actualizado', tabla, existente.id, Object.keys(cambios).length + ' campos');
    return existente.id;
  }
  const { data, error } = await sb.from(tabla).insert(fila).select('id').single();
  if (error) throw error;
  _eLog('creado', tabla, data.id);
  return data.id;
}

// ── API pública ───────────────────────────────────────────────────────────

// Propietario → tutores. Devuelve el id del tutor, o null si no se pudo.
async function espejoProp(prop) {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb || !prop || !prop.id) return null;
  try {
    return await _guardar(sb, 'tutores', 'saas_prop_id', prop.id, _filaTutor(prop), false);
  } catch (e) { _eWarn('propietario', e); return null; }
}

// Mascota → pacientes. Si su dueño todavía no existe como tutor, lo crea antes.
async function espejoMas(mas) {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb || !mas || !mas.id) return null;
  try {
    const prop = DB.get('props').find(p => p.id === mas.pid);
    if (!prop) { _eWarn('mascota', 'no encontré al propietario ' + mas.pid); return null; }

    let { data: tutor } = await sb.from('tutores').select('id').eq('saas_prop_id', prop.id).maybeSingle();
    const tutorId = tutor ? tutor.id : await espejoProp(prop);
    if (!tutorId) return null;

    return await _guardar(sb, 'pacientes', 'saas_mas_id', mas.id, _filaPaciente(mas, tutorId), false);
  } catch (e) { _eWarn('mascota', e); return null; }
}

// Registro clínico → historia_clinica. Si la mascota todavía no existe como
// paciente, la crea antes (y de paso a su dueño).
async function espejoHist(h) {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb || !h || !h.id) return null;
  try {
    const mas = DB.get('mas').find(m => m.id === h.mid);
    if (!mas) { _eWarn('historia', 'no encontré la mascota ' + h.mid); return null; }

    let { data: pac } = await sb.from('pacientes').select('id').eq('saas_mas_id', mas.id).maybeSingle();
    const pacienteId = pac ? pac.id : await espejoMas(mas);
    if (!pacienteId) return null;

    return await _guardar(sb, 'historia_clinica', 'saas_hist_id', h.id, _filaHistoria(h, pacienteId), true);
  } catch (e) { _eWarn('historia', e); return null; }
}

// Borrado de una mascota. Ojo con el orden: primero su historia, porque
// historia_clinica referencia a pacientes y la base rechazaría el borrado.
async function espejoBorrarMas(masId) {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb || !masId) return;
  try {
    const { data: pac } = await sb.from('pacientes').select('id').eq('saas_mas_id', masId).maybeSingle();
    if (!pac) return;
    await sb.from('historia_clinica').delete().eq('paciente_id', pac.id);
    const { error } = await sb.from('pacientes').delete().eq('id', pac.id);
    if (error) throw error;
    _eLog('borrado paciente', pac.id);
  } catch (e) { _eWarn('borrar mascota', e); }
}

// Borrado de un propietario. Igual: sus pacientes primero.
async function espejoBorrarProp(propId) {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb || !propId) return;
  try {
    const { data: tutor } = await sb.from('tutores').select('id').eq('saas_prop_id', propId).maybeSingle();
    if (!tutor) return;
    const { data: pacs } = await sb.from('pacientes').select('id').eq('tutor_id', tutor.id);
    for (const p of (pacs || [])) {
      await sb.from('historia_clinica').delete().eq('paciente_id', p.id);
      await sb.from('pacientes').delete().eq('id', p.id);
    }
    const { error } = await sb.from('tutores').delete().eq('id', tutor.id);
    if (error) throw error;
    _eLog('borrado tutor', tutor.id);
  } catch (e) { _eWarn('borrar propietario', e); }
}

// Borrado de un registro clínico: se refleja también en la tabla relacional.
async function espejoBorrarHist(histId) {
  let sb; try { sb = getSB(); } catch { return null; }
  if (!sb || !histId) return;
  try {
    const { error } = await sb.from('historia_clinica').delete().eq('saas_hist_id', histId);
    if (error) throw error;
    _eLog('borrado historia', histId);
  } catch (e) { _eWarn('borrar historia', e); }
}
