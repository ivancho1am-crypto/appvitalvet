// Módulo: Historias Clínicas
let currentPet = null;

const HICO = {
  consulta: '🔬', vacunacion: '💉', desparasitacion: '🦟', formula: '💊', cirugia: '🔪',
  laboratorio: '🧪', imagen: '📡', hospitalizacion: '🏥', orden: '📄', peluqueria: '✂️',
  guarderia: '🏠', seguimiento: '📊', documento: '📁', remision: '🚑', cita: '📅', mensaje: '💬'
};
const HLBL = {
  consulta: 'Consultas', vacunacion: 'Vacunaciones', desparasitacion: 'Desparasitaciones',
  formula: 'Fórmulas médicas', cirugia: 'Cirugías/Procedimientos', laboratorio: 'Exámenes laboratorio',
  imagen: 'Imágenes diagnósticas', hospitalizacion: 'Hosp./Ambulatorio', orden: 'Órdenes',
  peluqueria: 'Peluquería y Spa', guarderia: 'Guardería', seguimiento: 'Seguimientos',
  documento: 'Documentos', remision: 'Remisiones', cita: 'Citas', mensaje: 'Mensajes propietario'
};

function rHistList(q) {
  q = (q || '').toLowerCase();
  const mas = DB.get('mas'), props = DB.get('props'), hist = DB.get('hist');
  let data = mas;
  if (q) data = mas.filter(m => { const p = props.find(x => x.id === m.pid); return m.nombre.toLowerCase().includes(q) || (p && (p.nombre.toLowerCase().includes(q) || p.cedula.includes(q))); });
  const tb = document.getElementById('tb-hist-list'); if (!tb) return;
  tb.innerHTML = data.map(m => {
    const mHist = hist.filter(h => h.mid === m.id).sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
    const p = props.find(x => x.id === m.pid), cnt = mHist.length, ult = mHist[0];
    return `<tr>
      <td><div class="ac"><div style="font-size:22px">${EI(m.esp)}</div>
      <div><div class="cn">${m.nombre}</div><div class="cs">${m.raza || ''}</div></div></div></td>
      <td style="text-transform:capitalize;font-size:11px">${m.esp} · ${m.raza || 'Mestizo'}</td>
      <td>${p ? `<div class="cn">${p.nombre}</div><div class="cs">${p.cedula}</div>` : '—'}</td>
      <td>${edad(m.fn)}</td>
      <td><span class="badge bg-teal">${cnt} entradas</span></td>
      <td class="cs">${ult ? ult.fecha : '—'}</td>
      <td><button class="btn btn-green btn-sm" onclick="openHist('${m.id}')">📋 Ver / Editar</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--g500)">Sin mascotas registradas</td></tr>';
}

function openHist(mid) {
  const mas = DB.get('mas'), props = DB.get('props');
  const m = mas.find(x => x.id === mid); if (!m) return;
  const p = props.find(x => x.id === m.pid);
  currentPet = mid;
  document.getElementById('hist-list-view').style.display = 'none';
  document.getElementById('hist-detail-view').style.display = 'block';
  document.getElementById('hist-title').textContent = `Historia clínica — ${m.nombre}`;
  document.getElementById('phd-wrap').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--navy-m),var(--navy-l));border-radius:var(--r);
      padding:16px 20px;display:flex;align-items:center;gap:14px;margin-bottom:14px;color:#fff">
      <div style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.1);
        display:flex;align-items:center;justify-content:center;font-size:26px;border:2px solid rgba(255,255,255,.2)">${EI(m.esp)}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700">${m.nombre}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:2px">${p ? p.nombre : ''} · ${m.raza || ''} · ${edad(m.fn)} · ${m.peso ? m.peso + ' kg' : ''}</div>
        <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">
          ${m.chip ? `<span style="padding:2px 9px;background:rgba(255,255,255,.1);border-radius:20px;font-size:10px">🔖 ${m.chip}</span>` : ''}
          <span style="padding:2px 9px;background:rgba(255,255,255,.1);border-radius:20px;font-size:10px;text-transform:capitalize">${m.gen || ''}</span>
          <span style="padding:2px 9px;background:rgba(255,255,255,.1);border-radius:20px;font-size:10px;text-transform:capitalize">${(m.repr || '').replace('_', ' ')}</span>
          ${m.ali ? `<span style="padding:2px 9px;background:rgba(255,255,255,.1);border-radius:20px;font-size:10px">🍖 ${m.ali}</span>` : ''}
        </div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="backHist()" style="color:#fff;border-color:rgba(255,255,255,.3)">← Volver</button>
    </div>`;
  buildHistNav(); showHT('historia_general');
}

function buildHistNav() {
  const hist = DB.get('hist'), tipos = Object.keys(HICO);
  const total = hist.filter(h => h.mid === currentPet).length;
  document.getElementById('hn').innerHTML = `
    <div class="hn-hdr">📋 Historia clínica</div>
    <div class="hn-item on" onclick="showHT('historia_general',this)">
      <span>📋 Historia</span>
      <span class="hn-cnt ${total === 0 ? 'zero' : ''}">${total}</span>
    </div>
    ${tipos.map(k => { const cnt = hist.filter(h => h.mid === currentPet && h.tipo === k).length;
      return `<div class="hn-item" onclick="showHT('${k}',this)">
        <span>${HICO[k]} ${HLBL[k]}</span>
        <span class="hn-cnt ${cnt === 0 ? 'zero' : ''}">${cnt}</span>
      </div>`}).join('')}`;
}

function showHT(tipo, btn) {
  document.querySelectorAll('.hn-item').forEach(x => x.classList.remove('on'));
  if (btn) btn.classList.add('on'); else { const first = document.querySelector('.hn-item'); if (first) first.classList.add('on') }

  if (tipo === 'historia_general') {
    const all = DB.get('hist').filter(h => h.mid === currentPet).sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
    document.getElementById('hc').innerHTML = `
      <div class="card">
        <div class="card-hdr">
          <div class="card-title">📋 Historia clínica completa</div>
          <button class="btn btn-green btn-sm" onclick="openHistModal()">+ Nueva entrada</button>
        </div>
        <div class="card-body">
          ${all.length ? all.map(h => renderHistCard(h)).join('')
          : `<div class="empty-state"><div class="empty-ic">📋</div>
            <div class="empty-t">Sin registros clínicos</div>
            <div class="empty-s">Agrega la primera entrada usando "+ Nueva entrada"</div></div>`}
        </div>
      </div>`;
    return;
  }

  const hist = DB.get('hist').filter(h => h.mid === currentPet && h.tipo === tipo);
  document.getElementById('hc').innerHTML = `
    <div class="card">
      <div class="card-hdr">
        <div class="card-title">${HICO[tipo]} ${HLBL[tipo]}</div>
        <button class="btn btn-green btn-sm" onclick="openHistModal('${tipo}')">+ Registrar</button>
      </div>
      <div class="card-body">
        ${hist.length ? [...hist].reverse().map(h => renderHistCard(h)).join('')
        : `<div class="empty-state"><div class="empty-ic">${HICO[tipo]}</div><div class="empty-t">Sin registros de ${HLBL[tipo].toLowerCase()}</div><div class="empty-s">Agrega la primera entrada</div></div>`}
      </div>
    </div>`;
}

function renderHistCard(h) {
  const tipo = h.tipo;
  const row = (lbl, val) => val ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px"><span style="font-size:11px;font-weight:700;color:var(--g700);min-width:90px">${lbl}:</span><span style="font-size:12px;color:var(--text);flex:1">${val}</span></div>` : '';
  let fields = '';
  const title = h.cirugia || h.vacuna || h.nom_doc || h.destino ||
    (h.tipo_cita ? 'Cita: ' + h.tipo_cita : '') ||
    (h.tipo_desp ? 'Desparasitación ' + h.tipo_desp : '') ||
    h.desc || HLBL[tipo] || tipo;

  if (tipo === 'consulta') { fields += row('Motivo', h.desc); fields += row('Examen físico', h.exam); fields += row('Diagnóstico', h.diag); fields += row('Tratamiento', h.trat); fields += row('Medicamentos', h.med); fields += row('Peso', h.peso ? h.peso + ' kg' : ''); fields += row('Observaciones', h.not); fields += row('Próxima cita', h.prox); }
  else if (tipo === 'vacunacion') { fields += row('Vacuna', h.vacuna); fields += row('Laboratorio', h.lab); fields += row('Lote', h.lote); fields += row('Vía', h.via); fields += row('Próxima vacunación', h.prox); fields += row('Observaciones', h.not); }
  else if (tipo === 'desparasitacion') { fields += row('Tipo', h.tipo_desp); fields += row('Producto', h.producto); fields += row('Dosis', h.dosis); fields += row('Última desparasitación', h.ult_desp); fields += row('Próximo control', h.prox); fields += row('Observaciones', h.not); }
  else if (tipo === 'formula') { fields += row('Diagnóstico presuntivo/final', h.diag); fields += row('Medicamentos', h.med); fields += row('Observaciones', h.not); }
  else if (tipo === 'cirugia') { fields += row('Procedimiento', h.cirugia); fields += row('Descripción', h.desc); fields += row('Preanestésico', h.prean); fields += row('Anestésico', h.anest); fields += row('Medicamentos', h.med); fields += row('Postoperatorio', h.trat); fields += row('Complicaciones', h.complic); fields += row('Próxima revisión', h.prox); fields += row('Observaciones', h.not); }
  else if (tipo === 'laboratorio') { fields += row('Exámenes', h.desc); fields += row('Diagnóstico presuntivo', h.diag); fields += row('Observaciones', h.not); }
  else if (tipo === 'imagen') { fields += row('Ayuda diagnóstica', h.ayuda); fields += row('Signos clínicos', h.desc); fields += row('Diagnóstico presuntivo', h.diag); fields += row('Hallazgos/Estudio', h.estudio); fields += row('Observaciones', h.not); }
  else if (tipo === 'hospitalizacion') { fields += row('Tipo', h.tipo_hosp); fields += row('Ingreso', h.ingreso); fields += row('Salida', h.salida); fields += row('Motivo de salida', h.motivo_salida); fields += row('Razón', h.desc); fields += row('Evolución', h.not); }
  else if (tipo === 'orden') { fields += row('Órdenes', h.desc); fields += row('Motivo', h.not); }
  else if (tipo === 'peluqueria') { fields += row('Servicios', h.desc); fields += row('Próxima cita', h.prox); fields += row('Antirrábica vigente', h.rabia); fields += row('Observaciones', h.not); }
  else if (tipo === 'guarderia') { fields += row('Ingreso', h.ingreso); fields += row('Salida', h.salida); fields += row('Tipo', h.tipo_guard); fields += row('Comida', h.comida ? h.comida + (h.cant_comida ? ' — ' + h.cant_comida : '') : ''); fields += row('Objetos', h.objetos); fields += row('Observaciones', h.not); }
  else if (tipo === 'seguimiento') { fields += row('Tipo', h.tipo_seg); fields += row('Motivo', h.motivo_seg); fields += row('Descripción', h.desc); fields += row('Actitud', h.actitud); fields += row('Hidratación', h.hidrat); fields += row('Mucosas', h.mucosas); fields += row('Cardiovascular', h.cardio); fields += row('Respiratorio', h.resp); fields += row('Digestivo', h.digest); fields += row('Próximo control', h.prox); fields += row('Mensaje', h.not); }
  else if (tipo === 'documento') { fields += row('Tipo', h.tipo_doc); fields += row('Documento', h.nom_doc); fields += row('Requiere firma', h.firma); fields += row('Contenido', h.desc); fields += row('Observaciones', h.not); }
  else if (tipo === 'remision') { fields += row('Centro destino', h.destino); fields += row('Razón', h.desc); fields += row('Observaciones', h.not); }
  else if (tipo === 'cita') { fields += row('Tipo', h.tipo_cita); fields += row('Fecha cita', h.fecha_cita); fields += row('Estado', h.estado_cita); fields += row('Comentarios', h.not); }
  else if (tipo === 'mensaje') { fields += row('Mensaje', h.desc); fields += row('Vías de notificación', h.vias); fields += row('Observaciones', h.not); }
  else { fields += row('Descripción', h.desc); fields += row('Diagnóstico', h.diag); fields += row('Tratamiento', h.trat); fields += row('Observaciones', h.not); }

  const archivosHtml = (h.archivos && h.archivos.length)
    ? `<div style="margin-top:6px;display:flex;align-items:center;gap:5px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:var(--g700)">📎 Archivos:</span>
        ${h.archivos.map(f => `<span style="display:inline-flex;align-items:center;gap:2px;background:var(--green-lt);border:1px solid var(--green);border-radius:20px;padding:2px 4px 2px 8px">
          <a href="${f.url}" target="_blank" rel="noopener" style="font-size:11px;color:var(--green);text-decoration:none">${f.name}</a>
          <button onclick="deleteArchivoHist('${h.id}','${f.url}')" title="Eliminar archivo"
            style="background:none;border:none;cursor:pointer;color:var(--g500);font-size:12px;padding:0 3px;line-height:1">✕</button>
        </span>`).join('')}
      </div>` : '';

  return `<div class="tl-item">
    <div class="tl-dot" style="background:var(--green-lt);border:2px solid var(--green)">${HICO[h.tipo] || '📌'}</div>
    <div class="tl-box">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div>
          <span class="badge bg-teal" style="margin-right:6px;font-size:10px">${HLBL[h.tipo] || h.tipo}</span>
          <span style="font-size:11px;color:var(--g500)">${h.fecha} · ${h.vet || ''}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-xs" onclick="editHist('${h.id}')">✏️ Editar</button>
          <button class="btn btn-xs" style="background:#fee2e2;color:#7f1d1d;border:none" onclick="delHist('${h.id}','${h.tipo}')">🗑</button>
        </div>
      </div>
      <div class="tl-title" style="margin-top:6px">${title}</div>
      ${fields}
      ${archivosHtml}
    </div>
  </div>`;
}

// ── Formularios dinámicos por tipo ──
const HIST_FORMS = {
  consulta: `<div class="fg"><div class="fdiv">Consulta clínica</div>
    <div class="fi ff"><label>Motivo de consulta *</label><textarea id="h-desc" placeholder="Motivo principal de la consulta..."></textarea></div>
    <div class="fi ff"><label>Examen físico / Hallazgos</label><textarea id="h-exam" placeholder="Signos clínicos, hallazgos al examen físico..."></textarea></div>
    <div class="fi"><label>Diagnóstico presuntivo</label><input type="text" id="h-diag" placeholder="Diagnóstico presuntivo"></div>
    <div class="fi"><label>Diagnóstico definitivo</label><input type="text" id="h-diag2" placeholder="Diagnóstico definitivo"></div>
    <div class="fi ff"><label>Tratamiento / Indicaciones</label><textarea id="h-trat" placeholder="Tratamiento indicado, dosis, frecuencia..."></textarea></div>
    <div class="fi ff"><label>Medicamentos recetados</label><textarea id="h-med" placeholder="Ej: MELOXICAM 5 gotas c/24h x 6 días..." style="min-height:55px"></textarea></div>
    <div class="fi"><label>Peso en consulta (kg)</label><input type="number" id="h-peso" step="0.1" placeholder="0.0"></div>
    <div class="fi"><label>Próxima cita / control</label><input type="date" id="h-prox"></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones adicionales..." style="min-height:50px"></textarea></div>
    <div class="fi ff"><label>Adjuntos</label><input type="file" multiple id="h-files" style="font-size:12px"></div></div>`,
  vacunacion: `<div class="fg"><div class="fdiv">Registro de Vacunación</div>
    <div class="fi"><label>Vacuna aplicada *</label><input type="text" id="h-vacuna" placeholder="Ej: Nobivac DA2PP, Rabia, etc."></div>
    <div class="fi"><label>Laboratorio fabricante</label><input type="text" id="h-lab" placeholder="Ej: MSD Animal Health"></div>
    <div class="fi"><label>Número de lote</label><input type="text" id="h-lote" placeholder="Lote del vial"></div>
    <div class="fi"><label>Vía de administración</label>
      <select id="h-via"><option value="subcutanea">Subcutánea</option><option value="intramuscular">Intramuscular</option><option value="intranasal">Intranasal</option><option value="oral">Oral</option></select></div>
    <div class="fi"><label>Próxima vacunación *</label><input type="date" id="h-prox"></div>
    <div class="fi ff"><label>Observaciones / Reacciones</label><textarea id="h-not" placeholder="Observaciones o reacciones post-vacunación..." style="min-height:55px"></textarea></div>
    <div class="fi ff"><label>Adjuntos (carnet, etc.)</label><input type="file" multiple id="h-files" style="font-size:12px"></div></div>`,
  desparasitacion: `<div class="fg"><div class="fdiv">Registro de Desparasitación</div>
    <div class="fi"><label>Tipo</label>
      <select id="h-tipo-desp"><option value="interna">Interna</option><option value="externa">Externa</option><option value="ambas">Interna y Externa</option></select></div>
    <div class="fi"><label>Última desparasitación</label><input type="date" id="h-ult-desp"></div>
    <div class="fi"><label>Producto aplicado *</label><input type="text" id="h-producto" placeholder="Nombre del producto"></div>
    <div class="fi"><label>Dosis</label><input type="text" id="h-dosis" placeholder="Dosis administrada"></div>
    <div class="fi"><label>Próximo control *</label><input type="date" id="h-prox"></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones..." style="min-height:55px"></textarea></div>
    <div class="fi ff"><label>Adjunto</label><input type="file" multiple id="h-files" style="font-size:12px"></div></div>`,
  formula: `<div class="fg"><div class="fdiv">Fórmula Médica</div>
    <div class="fi ff"><label>Diagnóstico presuntivo y/o final *</label><textarea id="h-diag" placeholder="DIAGNÓSTICO PRESUNTIVO: ..."></textarea></div>
    <div class="fdiv">Medicamentos</div>
    <div id="med-list">
      <div class="med-item fg" style="border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px">
        <div class="fi"><label>Nombre medicamento *</label><input type="text" class="med-nom" placeholder="Nombre"></div>
        <div class="fi"><label>Presentación</label><input type="text" class="med-pres" placeholder="Gotas, tabletas, mg..."></div>
        <div class="fi"><label>Cantidad</label><input type="number" class="med-cant" placeholder="1" value="1" min="1"></div>
        <div class="fi ff"><label>Posología (forma de administración)</label><input type="text" class="med-pos" placeholder="Ej: 5 gotas cada 24h durante 6 días"></div>
      </div>
    </div>
    <div class="fi ff"><button type="button" class="btn btn-outline btn-sm" onclick="addMed()">+ Agregar medicamento</button></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Recomendaciones adicionales..." style="min-height:55px"></textarea></div>
    <div class="fi ff"><label>Adjuntos</label><input type="file" multiple id="h-files" style="font-size:12px"></div></div>`,
  cirugia: `<div class="fg"><div class="fdiv">Cirugía / Procedimiento</div>
    <div class="fi"><label>Cirugía / Procedimiento *</label><input type="text" id="h-cirugia" placeholder="Ej: Ovariohisterectomía, TPLO, Sutura..."></div>
    <div class="fi ff"><label>Descripción quirúrgica</label><textarea id="h-desc" placeholder="Descripción detallada del procedimiento..."></textarea></div>
    <div class="fi"><label>Preanestésico</label><input type="text" id="h-prean" placeholder="Medicamento preanestésico, dosis"></div>
    <div class="fi"><label>Anestésico</label><input type="text" id="h-anest" placeholder="Protocolo anestésico"></div>
    <div class="fi ff"><label>Otros medicamentos</label><textarea id="h-med" placeholder="Antibióticos, analgésicos, sueros..." style="min-height:55px"></textarea></div>
    <div class="fi ff"><label>Tratamiento postoperatorio</label><textarea id="h-trat" placeholder="Indicaciones posoperatorias..."></textarea></div>
    <div class="fi ff"><label>Complicaciones</label><textarea id="h-complic" placeholder="Complicaciones intra o postoperatorias..." style="min-height:55px"></textarea></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones..." style="min-height:50px"></textarea></div>
    <div class="fi"><label>Próxima revisión</label><input type="date" id="h-prox"></div>
    <div class="fi ff"><label>Adjuntos (imágenes, consentimiento)</label><input type="file" multiple id="h-files" style="font-size:12px"></div></div>`,
  laboratorio: `<div class="fg"><div class="fdiv">Examen de Laboratorio</div>
    <div id="lab-list">
      <div class="lab-item fg" style="border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px">
        <div class="fi"><label>Prueba / Examen *</label><input type="text" class="lab-exam" placeholder="Ej: Hemograma, Química sanguínea..."></div>
        <div class="fi"><label>Cantidad</label><input type="number" class="lab-cant" value="1" min="1"></div>
        <div class="fi ff"><label>Resultados (puedes subir varios archivos)</label><input type="file" class="lab-result" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style="font-size:12px"></div>
      </div>
    </div>
    <div class="fi ff"><button type="button" class="btn btn-outline btn-sm" onclick="addLab()">+ Agregar prueba</button></div>
    <div class="fi ff"><label>Diagnóstico presuntivo</label><textarea id="h-diag" placeholder="Diagnóstico presuntivo basado en resultados..." style="min-height:60px"></textarea></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones..." style="min-height:50px"></textarea></div></div>`,
  imagen: `<div class="fg"><div class="fdiv">Imagen Diagnóstica</div>
    <div class="fi"><label>Tipo de ayuda diagnóstica *</label>
      <select id="h-ayuda"><option value="">Selecciona</option><option value="ecografia">Ecografía</option><option value="radiografia">Radiografía digital</option><option value="estudio_rx">Estudio radiográfico</option><option value="otro">Otro</option></select></div>
    <div class="fi ff"><label>Signos clínicos</label><textarea id="h-desc" placeholder="Signos clínicos que motivaron el estudio..."></textarea></div>
    <div class="fi ff"><label>Diagnóstico presuntivo</label><textarea id="h-diag" placeholder="Diagnóstico presuntivo..."></textarea></div>
    <div class="fi ff"><label>Tipo de estudio / Hallazgos</label><textarea id="h-estudio" placeholder="Región evaluada, hallazgos, interpretación..."></textarea></div>
    <div class="fi ff"><label>Adjuntos / Resultados</label><input type="file" multiple id="h-files" style="font-size:12px"></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones..." style="min-height:50px"></textarea></div></div>`,
  hospitalizacion: `<div class="fg"><div class="fdiv">Hospitalización / Ambulatorio</div>
    <div class="fi"><label>Tipo *</label>
      <select id="h-tipo-hosp"><option value="hospitalizacion">Hospitalización</option><option value="ambulatorio">Ambulatorio</option></select></div>
    <div class="fi"><label>Fecha de ingreso</label><input type="datetime-local" id="h-ingreso"></div>
    <div class="fi"><label>Fecha de salida</label><input type="datetime-local" id="h-salida"></div>
    <div class="fi"><label>Motivo de salida</label>
      <select id="h-motivo-salida"><option value="">Indica la finalización...</option><option value="alta_medica">Alta médica</option><option value="mejoria">Mejoría</option><option value="referido">Referido</option><option value="voluntaria">Alta voluntaria</option><option value="fallecimiento">Fallecimiento</option></select></div>
    <div class="fi ff"><label>Razón de ingreso *</label><textarea id="h-desc" placeholder="Motivo de hospitalización..."></textarea></div>
    <div class="fi ff"><label>Observaciones / evolución</label><textarea id="h-not" placeholder="Evolución del paciente..." style="min-height:60px"></textarea></div></div>`,
  orden: `<div class="fg"><div class="fdiv">Registro de Orden</div>
    <div id="orden-list">
      <div class="orden-item" style="border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px">
        <div class="fg">
          <div class="fi"><label>Tipo de orden *</label>
            <select class="orden-tipo"><option value="">Selecciona</option><option value="laboratorio">Laboratorio</option><option value="imagen">Imagen diagnóstica</option><option value="consulta">Consulta especialista</option><option value="cirugia">Cirugía</option><option value="medicamento">Medicamento</option><option value="otro">Otro</option></select></div>
          <div class="fi"><label>Especificación</label><input type="text" class="orden-esp" placeholder="Detalle de la orden"></div>
          <div class="fi"><label>Cantidad</label><input type="number" class="orden-cant" value="1" min="1"></div>
          <div class="fi"><label>Prioridad</label>
            <select class="orden-prior"><option value="">Normal</option><option value="urgente">Urgente</option><option value="alta">Alta</option></select></div>
          <div class="fi ff"><label>Notas</label><input type="text" class="orden-notas" placeholder="Notas u observaciones"></div>
        </div>
      </div>
    </div>
    <div class="fi ff"><button type="button" class="btn btn-outline btn-sm" onclick="addOrden()">+ Agregar orden</button></div>
    <div class="fi ff"><label>Motivo de la orden</label><textarea id="h-not" placeholder="Motivo general de las órdenes..." style="min-height:55px"></textarea></div></div>`,
  peluqueria: `<div class="fg"><div class="fdiv">Peluquería y Spa</div>
    <div id="serv-list">
      <div class="serv-item fg" style="border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px">
        <div class="fi"><label>Tipo de servicio *</label>
          <select class="serv-tipo"><option value="">Selecciona</option><option value="bano">Baño</option><option value="corte">Corte</option><option value="bano_corte">Baño y corte</option><option value="bano_medicado">Baño medicado</option><option value="deslanado">Deslanado</option><option value="spa">Spa completo</option><option value="otro">Otro</option></select></div>
        <div class="fi"><label>Motivo / Especificación</label><input type="text" class="serv-motivo" placeholder="Opcional"></div>
        <div class="fi"><label>Encargado</label><input type="text" class="serv-enc" placeholder="Nombre del peluquero"></div>
        <div class="fi ff"><label>Detalles y observaciones</label><input type="text" class="serv-det" placeholder="Detalles del servicio"></div>
      </div>
    </div>
    <div class="fi ff"><button type="button" class="btn btn-outline btn-sm" onclick="addServ()">+ Agregar servicio</button></div>
    <div class="fi ff"><label>Observaciones generales</label><textarea id="h-not" placeholder="Observaciones generales..." style="min-height:50px"></textarea></div>
    <div class="fi"><label>Foto antes</label><input type="file" id="h-foto-antes" accept="image/*" style="font-size:12px"></div>
    <div class="fi"><label>Foto después</label><input type="file" id="h-foto-desp" accept="image/*" style="font-size:12px"></div>
    <div class="fi"><label>Próxima cita</label><input type="date" id="h-prox"></div>
    <div class="fi"><label>Vacunación antirrábica vigente</label>
      <select id="h-rabia"><option value="">Selecciona</option><option value="si">Sí vigente</option><option value="no">No vigente</option><option value="desconoce">Desconoce</option></select></div></div>`,
  guarderia: `<div class="fg"><div class="fdiv">Guardería</div>
    <div class="fi"><label>Fecha de ingreso *</label><input type="datetime-local" id="h-ingreso"></div>
    <div class="fi"><label>Fecha de salida</label><input type="datetime-local" id="h-salida"></div>
    <div class="fi"><label>Tipo de servicio</label>
      <select id="h-tipo-guard"><option value="">Selecciona</option><option value="diurna">Diurna</option><option value="nocturna">Nocturna</option><option value="fin_semana">Fin de semana</option><option value="larga_estadia">Larga estadía</option></select></div>
    <div class="fi"><label>Tipo de comida</label><input type="text" id="h-comida" placeholder="Tipo de alimento del tutor"></div>
    <div class="fi"><label>Cantidad de comida</label><input type="text" id="h-cant-comida" placeholder="Cantidad o dosificación"></div>
    <div class="fi ff"><label>Objetos dejados por el propietario</label><textarea id="h-objetos" placeholder="Cama, juguetes, correa..." style="min-height:55px"></textarea></div>
    <div class="fi ff"><label>Observaciones / Recomendaciones</label><textarea id="h-not" placeholder="Detalles sobre la estadía..." style="min-height:55px"></textarea></div></div>`,
  seguimiento: `<div class="fg"><div class="fdiv">Seguimiento</div>
    <div class="fi"><label>Tipo de seguimiento *</label>
      <select id="h-tipo-seg"><option value="postoperatorio">Postoperatorio</option><option value="tratamiento">Tratamiento en curso</option><option value="control">Control rutinario</option><option value="enfermedad_cronica">Enfermedad crónica</option><option value="otro">Otro</option></select></div>
    <div class="fi"><label>Motivo</label>
      <select id="h-motivo-seg"><option value="no_especificado">No especificado</option><option value="revision_herida">Revisión herida</option><option value="retiro_puntos">Retiro de puntos</option><option value="control_medicacion">Control medicación</option><option value="evolucion">Evaluación evolución</option></select></div>
    <div class="fi ff"><label>Detalles del seguimiento *</label><textarea id="h-desc" placeholder="Estado actual del paciente, evolución..."></textarea></div>
    <div class="fi ff"><label>Adjuntos (fotos, exámenes)</label><input type="file" multiple id="h-files" style="font-size:12px"></div>
    <div class="fi"><label>Próximo control</label><input type="date" id="h-prox"></div>
    <div class="fdiv">Examen físico general</div>
    <div class="fi"><label>Actitud</label>
      <select id="h-actitud"><option value="">No evaluado</option><option value="alerta">Alerta</option><option value="deprimido">Deprimido</option><option value="estupor">Estupor</option></select></div>
    <div class="fi"><label>Hidratación</label>
      <select id="h-hidrat"><option value="">No evaluado</option><option value="normal">Normal</option><option value="deshidratacion_leve">Deshidratación leve</option><option value="deshidratacion_moderada">Deshidratación moderada</option><option value="deshidratacion_severa">Severa</option></select></div>
    <div class="fi"><label>Mucosas</label>
      <select id="h-mucosas"><option value="">No evaluado</option><option value="rosadas">Rosadas</option><option value="palidas">Pálidas</option><option value="cianoticas">Cianóticas</option><option value="ictéricas">Ictéricas</option></select></div>
    <div class="fi"><label>Sistema cardiovascular</label>
      <select id="h-cardio"><option value="">No evaluado</option><option value="normal">Normal</option><option value="taquicardia">Taquicardia</option><option value="bradicardia">Bradicardia</option><option value="arritmia">Arritmia</option></select></div>
    <div class="fi"><label>Sistema respiratorio</label>
      <select id="h-resp"><option value="">No evaluado</option><option value="normal">Normal</option><option value="taquipnea">Taquipnea</option><option value="disnea">Disnea</option><option value="bradipnea">Bradipnea</option></select></div>
    <div class="fi"><label>Sistema digestivo</label>
      <select id="h-digest"><option value="">No evaluado</option><option value="normal">Normal</option><option value="vomito">Vómito</option><option value="diarrea">Diarrea</option><option value="estreñimiento">Estreñimiento</option></select></div>
    <div class="fi ff"><label>Mensaje al propietario</label><textarea id="h-not" placeholder="Mensaje o indicaciones para el propietario..." style="min-height:50px"></textarea></div></div>`,
  documento: `<div class="fg"><div class="fdiv">Documento</div>
    <div class="fi"><label>Tipo de documento *</label>
      <select id="h-tipo-doc"><option value="">Selecciona</option><option value="consentimiento">Consentimiento informado</option><option value="certificado">Certificado médico</option><option value="carnet_vacunas">Carnet de vacunas</option><option value="historia_resumida">Historia clínica resumida</option><option value="remision">Carta de remisión</option><option value="receta">Receta médica</option><option value="otro">Otro</option></select></div>
    <div class="fi"><label>Nombre del documento *</label><input type="text" id="h-nom-doc" placeholder="Nombre del documento"></div>
    <div class="fi"><label>¿Requiere firma?</label>
      <select id="h-firma"><option value="si">Sí requiere</option><option value="no">No requiere</option></select></div>
    <div class="fi ff"><label>Contenido / Descripción</label><textarea id="h-desc" placeholder="Contenido del documento o descripción..." style="min-height:100px"></textarea></div>
    <div class="fi ff"><label>Adjunto (PDF, imagen del documento)</label><input type="file" multiple id="h-files" style="font-size:12px"></div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones..." style="min-height:50px"></textarea></div></div>`,
  remision: `<div class="fg"><div class="fdiv">Remisión</div>
    <div class="fi"><label>Centro veterinario destino *</label><input type="text" id="h-destino" placeholder="Clínica, laboratorio o centro destino"></div>
    <div class="fi ff"><label>Procedimiento / Razón de remisión *</label><textarea id="h-desc" placeholder="Procedimientos a remitir, exámenes, hospitalización..."></textarea></div>
    <div class="fi ff"><label>Observaciones / Recomendaciones</label><textarea id="h-not" placeholder="Detalles, recomendaciones al centro de destino..." style="min-height:60px"></textarea></div>
    <div class="fi ff"><label>Adjuntos (historia clínica, exámenes)</label><input type="file" multiple id="h-files" style="font-size:12px"></div></div>`,
  cita: `<div class="fg"><div class="fdiv">Registro de Cita</div>
    <div class="fi"><label>Tipo de cita *</label>
      <select id="h-tipo-cita"><option value="consulta">Consulta</option><option value="vacunacion">Vacunación</option><option value="desparasitacion">Desparasitación</option><option value="cirugia">Cirugía</option><option value="control">Control</option><option value="peluqueria">Peluquería</option><option value="otro">Otro</option></select></div>
    <div class="fi"><label>Fecha de la cita *</label><input type="datetime-local" id="h-fecha-cita"></div>
    <div class="fi"><label>Estado</label>
      <select id="h-estado-cita"><option value="pre_registro">Pre-registro</option><option value="confirmada">Confirmada</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option><option value="no_asistio">No asistió</option></select></div>
    <div class="fi ff"><label>Motivo / Comentarios</label><textarea id="h-not" placeholder="Motivo de la cita u observaciones..." style="min-height:60px"></textarea></div></div>`,
  mensaje: `<div class="fg"><div class="fdiv">Mensaje al Propietario</div>
    <div class="fi ff"><label>Texto del mensaje / notificación *</label><textarea id="h-desc" placeholder="Texto de la notificación..." style="min-height:80px"></textarea></div>
    <div class="fi ff"><label>Método de notificación</label>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="h-via-email"> 📧 Email</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="h-via-wa" checked> 📱 WhatsApp</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="h-via-sms"> 💬 SMS</label>
      </div>
    </div>
    <div class="fi ff"><label>Observaciones</label><textarea id="h-not" placeholder="Observaciones internas..." style="min-height:50px"></textarea></div></div>`
};

function renderHistForm() {
  const tipo = document.getElementById('h-tipo').value;
  const container = document.getElementById('h-dynamic-fields');
  if (container) container.innerHTML = HIST_FORMS[tipo] || HIST_FORMS['consulta'];
  const t = document.getElementById('mh-title');
  if (t) t.textContent = (HICO[tipo] || '📋') + ' ' + (HLBL[tipo] || 'Nueva entrada');
}

function addMed() {
  const list = document.getElementById('med-list'); if (!list) return;
  const div = document.createElement('div'); div.className = 'med-item fg';
  div.style = 'border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px;position:relative';
  div.innerHTML = `<button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:var(--g500);font-size:14px">✕</button>
    <div class="fi"><label>Nombre medicamento *</label><input type="text" class="med-nom" placeholder="Nombre"></div>
    <div class="fi"><label>Presentación</label><input type="text" class="med-pres" placeholder="Gotas, tabletas..."></div>
    <div class="fi"><label>Cantidad</label><input type="number" class="med-cant" placeholder="1" value="1" min="1"></div>
    <div class="fi ff"><label>Posología</label><input type="text" class="med-pos" placeholder="Ej: 5 gotas cada 24h durante 6 días"></div>`;
  list.appendChild(div);
}
function addLab() {
  const list = document.getElementById('lab-list'); if (!list) return;
  const div = document.createElement('div'); div.className = 'lab-item fg';
  div.style = 'border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px;position:relative';
  div.innerHTML = `<button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:var(--g500);font-size:14px">✕</button>
    <div class="fi"><label>Prueba / Examen *</label><input type="text" class="lab-exam" placeholder="Ej: Hemograma..."></div>
    <div class="fi"><label>Cantidad</label><input type="number" class="lab-cant" value="1" min="1"></div>
    <div class="fi ff"><label>Resultados (puedes subir varios archivos)</label><input type="file" class="lab-result" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style="font-size:12px"></div>`;
  list.appendChild(div);
}
function addServ() {
  const list = document.getElementById('serv-list'); if (!list) return;
  const div = document.createElement('div'); div.className = 'serv-item fg';
  div.style = 'border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px;position:relative';
  div.innerHTML = `<button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:var(--g500);font-size:14px">✕</button>
    <div class="fi"><label>Tipo de servicio *</label>
      <select class="serv-tipo"><option value="">Selecciona</option><option value="bano">Baño</option><option value="corte">Corte</option><option value="bano_corte">Baño y corte</option><option value="bano_medicado">Baño medicado</option><option value="spa">Spa completo</option></select></div>
    <div class="fi"><label>Motivo</label><input type="text" class="serv-motivo" placeholder="Opcional"></div>
    <div class="fi"><label>Encargado</label><input type="text" class="serv-enc" placeholder="Nombre"></div>
    <div class="fi ff"><label>Detalles</label><input type="text" class="serv-det" placeholder="Detalles del servicio"></div>`;
  list.appendChild(div);
}
function addOrden() {
  const list = document.getElementById('orden-list'); if (!list) return;
  const div = document.createElement('div'); div.className = 'orden-item';
  div.style = 'border:1px solid var(--g200);border-radius:8px;padding:10px;margin-bottom:8px;position:relative';
  div.innerHTML = `<button type="button" onclick="this.parentElement.remove()" style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:var(--g500);font-size:14px">✕</button>
    <div class="fg">
      <div class="fi"><label>Tipo de orden *</label>
        <select class="orden-tipo"><option value="">Selecciona</option><option value="laboratorio">Laboratorio</option><option value="imagen">Imagen diagnóstica</option><option value="cirugia">Cirugía</option><option value="medicamento">Medicamento</option><option value="otro">Otro</option></select></div>
      <div class="fi"><label>Especificación</label><input type="text" class="orden-esp" placeholder="Detalle"></div>
      <div class="fi"><label>Cantidad</label><input type="number" class="orden-cant" value="1" min="1"></div>
      <div class="fi ff"><label>Notas</label><input type="text" class="orden-notas" placeholder="Notas"></div>
    </div>`;
  list.appendChild(div);
}

function collectHistFields() {
  const tipo = document.getElementById('h-tipo').value;
  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : '' };
  const base = { tipo, fecha: document.getElementById('h-fecha').value.replace('T', ' '), vet: document.getElementById('h-vet').value.trim() };
  const extra = {};
  if (tipo === 'consulta') { extra.desc = gv('h-desc'); extra.diag = gv('h-diag') + (gv('h-diag2') ? ' | Def: ' + gv('h-diag2') : ''); extra.trat = gv('h-trat'); extra.med = gv('h-med'); extra.not = gv('h-not'); extra.prox = gv('h-prox'); extra.exam = gv('h-exam'); extra.peso = gv('h-peso'); }
  else if (tipo === 'vacunacion') { extra.vacuna = gv('h-vacuna'); extra.lab = gv('h-lab'); extra.lote = gv('h-lote'); extra.via = gv('h-via'); extra.not = gv('h-not'); extra.prox = gv('h-prox'); extra.desc = 'Vacunación: ' + gv('h-vacuna'); extra.diag = ''; }
  else if (tipo === 'desparasitacion') { extra.tipo_desp = gv('h-tipo-desp'); extra.producto = gv('h-producto'); extra.dosis = gv('h-dosis'); extra.ult_desp = gv('h-ult-desp'); extra.not = gv('h-not'); extra.prox = gv('h-prox'); extra.desc = 'Desparasitación (' + gv('h-tipo-desp') + '): ' + gv('h-producto'); extra.diag = ''; }
  else if (tipo === 'formula') {
    const meds = [...document.querySelectorAll('.med-item')].map(el => ({ nom: el.querySelector('.med-nom')?.value || '', pres: el.querySelector('.med-pres')?.value || '', cant: el.querySelector('.med-cant')?.value || '', pos: el.querySelector('.med-pos')?.value || '' }));
    extra.diag = gv('h-diag'); extra.med = meds.map(m => `${m.nom} ${m.pres} #${m.cant}. ${m.pos}`).join('\n'); extra.not = gv('h-not'); extra.desc = 'Fórmula médica'; extra.trat = '';
  }
  else if (tipo === 'cirugia') { extra.cirugia = gv('h-cirugia'); extra.desc = gv('h-desc'); extra.prean = gv('h-prean'); extra.anest = gv('h-anest'); extra.med = gv('h-med'); extra.trat = gv('h-trat'); extra.complic = gv('h-complic'); extra.not = gv('h-not'); extra.prox = gv('h-prox'); extra.diag = gv('h-cirugia'); }
  else if (tipo === 'laboratorio') {
    const labs = [...document.querySelectorAll('.lab-item')].map(el => el.querySelector('.lab-exam')?.value || '');
    extra.desc = 'Laboratorio: ' + labs.join(', '); extra.diag = gv('h-diag'); extra.not = gv('h-not');
  }
  else if (tipo === 'imagen') { extra.ayuda = gv('h-ayuda'); extra.desc = gv('h-desc'); extra.diag = gv('h-diag'); extra.estudio = gv('h-estudio'); extra.not = gv('h-not'); }
  else if (tipo === 'hospitalizacion') { extra.tipo_hosp = gv('h-tipo-hosp'); extra.ingreso = gv('h-ingreso'); extra.salida = gv('h-salida'); extra.motivo_salida = gv('h-motivo-salida'); extra.desc = gv('h-desc'); extra.not = gv('h-not'); }
  else if (tipo === 'orden') {
    const ords = [...document.querySelectorAll('.orden-item')].map(el => ({ tipo: el.querySelector('.orden-tipo')?.value || '', esp: el.querySelector('.orden-esp')?.value || '' }));
    extra.desc = 'Órdenes: ' + ords.map(o => o.tipo + ' - ' + o.esp).join('; '); extra.not = gv('h-not');
  }
  else if (tipo === 'peluqueria') {
    const servs = [...document.querySelectorAll('.serv-item')].map(el => ({
      tipo: el.querySelector('.serv-tipo')?.value || '',
      enc: el.querySelector('.serv-enc')?.value || '',
      det: el.querySelector('.serv-det')?.value || ''
    }));
    extra.desc = 'Peluquería: ' + servs.map(s => s.tipo + (s.enc ? ' (enc: ' + s.enc + ')' : '') + (s.det ? ' — ' + s.det : '')).join('; ');
    extra.not = gv('h-not'); extra.prox = gv('h-prox'); extra.rabia = gv('h-rabia');
  }
  else if (tipo === 'guarderia') { extra.ingreso = gv('h-ingreso'); extra.salida = gv('h-salida'); extra.tipo_guard = gv('h-tipo-guard'); extra.comida = gv('h-comida'); extra.cant_comida = gv('h-cant-comida'); extra.objetos = gv('h-objetos'); extra.not = gv('h-not'); extra.desc = 'Guardería'; }
  else if (tipo === 'seguimiento') { extra.tipo_seg = gv('h-tipo-seg'); extra.motivo_seg = gv('h-motivo-seg'); extra.desc = gv('h-desc'); extra.not = gv('h-not'); extra.prox = gv('h-prox'); extra.actitud = gv('h-actitud'); extra.hidrat = gv('h-hidrat'); extra.mucosas = gv('h-mucosas'); extra.cardio = gv('h-cardio'); extra.resp = gv('h-resp'); extra.digest = gv('h-digest'); }
  else if (tipo === 'documento') { extra.tipo_doc = gv('h-tipo-doc'); extra.nom_doc = gv('h-nom-doc'); extra.firma = gv('h-firma'); extra.desc = gv('h-desc'); extra.not = gv('h-not'); }
  else if (tipo === 'remision') { extra.destino = gv('h-destino'); extra.desc = gv('h-desc'); extra.not = gv('h-not'); }
  else if (tipo === 'cita') { extra.tipo_cita = gv('h-tipo-cita'); extra.fecha_cita = gv('h-fecha-cita'); extra.estado_cita = gv('h-estado-cita'); extra.not = gv('h-not'); extra.desc = 'Cita: ' + gv('h-tipo-cita'); }
  else if (tipo === 'mensaje') {
    extra.desc = gv('h-desc'); extra.not = gv('h-not');
    const vias = [];
    if (document.getElementById('h-via-email')?.checked) vias.push('email');
    if (document.getElementById('h-via-wa')?.checked) vias.push('whatsapp');
    if (document.getElementById('h-via-sms')?.checked) vias.push('sms');
    extra.vias = vias.join(', ');
  }
  return { ...base, ...extra, files: [] };
}

function openHistModal(tipo) {
  openM('m-hist');
  if (tipo) { setTimeout(() => { const sel = document.getElementById('h-tipo'); if (sel) { sel.value = tipo; renderHistForm(); } }, 60); }
  else { setTimeout(() => renderHistForm(), 60); }
  document.getElementById('h-fecha').value = nowDt();
}

// Sube archivos al bucket de Supabase Storage y devuelve array de {name, url}
async function uploadFiles(files, folder) {
  const sb = getSB();
  if (!sb || !files.length) return [];
  const archivos = [];
  for (const f of files) {
    const safeName = f.name.replace(/\s+/g, '_');
    const path = `${folder}/${Date.now()}_${safeName}`;
    const { error } = await sb.storage.from('vitalvet-files').upload(path, f, { upsert: true });
    if (!error) {
      const { data: urlData } = sb.storage.from('vitalvet-files').getPublicUrl(path);
      archivos.push({ name: f.name, url: urlData.publicUrl });
    }
  }
  return archivos;
}

// Recolecta archivos del formulario activo según tipo de entrada
async function collectAndUploadFiles(tipo) {
  const files = [];
  if (tipo === 'laboratorio') {
    document.querySelectorAll('.lab-result').forEach(input => {
      if (input.files) [...input.files].forEach(f => files.push(f));
    });
  } else {
    const hFiles = document.getElementById('h-files');
    if (hFiles && hFiles.files) [...hFiles.files].forEach(f => files.push(f));
    const antes = document.getElementById('h-foto-antes');
    if (antes && antes.files) [...antes.files].forEach(f => files.push(f));
    const desp = document.getElementById('h-foto-desp');
    if (desp && desp.files) [...desp.files].forEach(f => files.push(f));
  }
  if (!files.length) return [];
  toast('Subiendo archivos…', 'info');
  return await uploadFiles(files, `${currentPet}/${tipo}`);
}

async function saveHist() {
  if (!currentPet) { toast('Selecciona una mascota', 'err'); return }
  const h = { id: 'h' + Date.now(), mid: currentPet, ...collectHistFields() };
  const archivos = await collectAndUploadFiles(h.tipo);
  if (archivos.length) h.archivos = archivos;
  const hist = DB.get('hist'); hist.push(h);
  await DB.set('hist', hist);
  closeM('m-hist'); toast('Entrada guardada ✓', 'ok');
  showHT(h.tipo); buildHistNav(); rHistList(); rStats();
}

function editHist(id) {
  const h = DB.get('hist').find(x => x.id === id); if (!h) return;
  openM('m-hist');
  setTimeout(() => {
    const sel = document.getElementById('h-tipo'); if (sel) { sel.value = h.tipo; renderHistForm(); }
    setTimeout(() => {
      document.getElementById('h-fecha').value = (h.fecha || '').replace(' ', 'T');
      document.getElementById('h-vet').value = h.vet || '';
      const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      setV('h-desc', h.desc); setV('h-diag', h.diag); setV('h-trat', h.trat); setV('h-med', h.med);
      setV('h-not', h.not); setV('h-prox', h.prox); setV('h-exam', h.exam);
      setV('h-vacuna', h.vacuna); setV('h-lab', h.lab); setV('h-lote', h.lote); setV('h-via', h.via);
      setV('h-producto', h.producto); setV('h-dosis', h.dosis);
      setV('h-cirugia', h.cirugia); setV('h-prean', h.prean); setV('h-anest', h.anest); setV('h-complic', h.complic);
      setV('h-destino', h.destino); setV('h-estudio', h.estudio);
      setV('h-ayuda', h.ayuda); setV('h-tipo-hosp', h.tipo_hosp);
      setV('h-tipo-doc', h.tipo_doc); setV('h-nom-doc', h.nom_doc);
    }, 80);
  }, 60);
  document.getElementById('h-save-btn').onclick = async function () {
    const hist = DB.get('hist'), idx = hist.findIndex(x => x.id === id);
    if (idx >= 0) {
      const updated = { ...hist[idx], ...collectHistFields() };
      const newFiles = await collectAndUploadFiles(updated.tipo);
      if (newFiles.length) updated.archivos = [...(hist[idx].archivos || []), ...newFiles];
      hist[idx] = updated;
      await DB.set('hist', hist);
    }
    closeM('m-hist'); toast('Entrada actualizada ✓', 'ok');
    showHT(hist[idx]?.tipo); buildHistNav();
    document.getElementById('h-save-btn').onclick = saveHist;
  };
}

function delHist(id, tipo) {
  if (!confirm('¿Eliminar este registro?')) return;
  const hist = DB.get('hist').filter(x => x.id !== id); DB.set('hist', hist);
  const firstItem = document.querySelector('.hn-item');
  if (firstItem && firstItem.classList.contains('on')) { showHT('historia_general'); }
  else { showHT(tipo); }
  buildHistNav(); rStats(); toast('Registro eliminado', 'ok');
}

async function deleteArchivoHist(histId, fileUrl) {
  if (!confirm('¿Eliminar este archivo?')) return;
  const sb = getSB();
  if (sb) {
    const match = fileUrl.match(/vitalvet-files\/(.+)$/);
    if (match) await sb.storage.from('vitalvet-files').remove([decodeURIComponent(match[1])]).catch(() => {});
  }
  const hist = DB.get('hist'), h = hist.find(x => x.id === histId);
  if (!h) return;
  h.archivos = (h.archivos || []).filter(f => f.url !== fileUrl);
  await DB.set('hist', hist);
  showHT(h.tipo); buildHistNav();
  toast('Archivo eliminado ✓', 'ok');
}

function backHist() {
  document.getElementById('hist-list-view').style.display = 'block';
  document.getElementById('hist-detail-view').style.display = 'none';
  currentPet = null;
}

function exportHistPDF() {
  if (!window.jspdf) { toast('jsPDF no disponible', 'err'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  const teal = [11, 124, 122], dark = [48, 61, 58], gray = [122, 146, 168], light = [232, 247, 243];
  const mas = DB.get('mas'), props = DB.get('props');
  const m = mas.find(x => x.id === currentPet); if (!m) return;
  const p = props.find(x => x.id === m.pid);
  const hist = DB.get('hist').filter(h => h.mid === currentPet).sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));

  doc.setFillColor(...dark); doc.rect(0, 0, W, 36, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('VitalVet', M, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 200, 196);
  doc.text('Centro de Cirugía Compleja y Medicina Avanzada · Barbosa, Santander', M, 21);
  doc.text('Historia Clínica · Dr. Iván Durán MV', M, 26);
  doc.setTextColor(...teal); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('HISTORIA CLÍNICA', W - M, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 200, 196);
  doc.text(new Date().toLocaleDateString('es-CO'), W - M, 21, { align: 'right' });

  let y = 44;
  doc.setFillColor(...light); doc.roundedRect(M, y, W - M * 2, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...teal);
  doc.text('PACIENTE', M + 4, y + 7); doc.text('PROPIETARIO / TUTOR', M + 92, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark);
  doc.text(EI(m.esp).replace(/\p{Emoji}/u, '') + ' ' + m.nombre, M + 4, y + 15);
  doc.text(p ? p.nombre : '—', M + 92, y + 15);
  doc.setFontSize(7.5); doc.setTextColor(...gray);
  doc.text((m.esp || '') + (m.raza ? ' · ' + m.raza : '') + (m.fn ? ' · ' + edad(m.fn) : '') + (m.peso ? ' · ' + m.peso + ' kg' : ''), M + 4, y + 20);
  if (p && p.telefono) doc.text(p.telefono, M + 92, y + 20);
  y += 30;

  if (!hist.length) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...gray); doc.text('Sin registros clínicos.', M, y); }
  hist.forEach((h, i) => {
    if (y > 255) { doc.addPage(); y = 20; }
    const bg = i % 2 === 0 ? [248, 252, 251] : [255, 255, 255];
    doc.setFillColor(...bg); doc.rect(M, y, W - M * 2, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...teal);
    doc.text((HLBL[h.tipo] || h.tipo).toUpperCase(), M + 2, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...gray);
    doc.text(h.fecha + (h.vet ? '  ·  ' + h.vet : ''), W - M - 2, y + 5.5, { align: 'right' });
    y += 8;
    const lines = [];
    if (h.desc) lines.push('Descripción: ' + h.desc);
    if (h.diag) lines.push('Dx: ' + h.diag);
    if (h.trat) lines.push('Tx: ' + h.trat);
    if (h.med) lines.push('Medicamentos: ' + h.med);
    if (h.prox) lines.push('Próximo: ' + h.prox);
    if (h.not) lines.push('Obs: ' + h.not);
    lines.forEach(ln => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...dark);
      const wrapped = doc.splitTextToSize(ln, W - M * 2 - 4);
      doc.text(wrapped, M + 4, y);
      y += wrapped.length * 4.5;
    });
    y += 3;
    doc.setDrawColor(...gray); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 4;
  });

  doc.save('VitalVet_Historia_' + m.nombre.replace(/\s+/g, '_') + '.pdf');
  toast('📥 PDF historia descargado', 'ok');
}
