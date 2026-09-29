// Núcleo de estadísticas — compartido por dos pantallas.
//
// Lo usan estadisticas.html (el panel completo con estrategia y marketing) y la
// pestaña Estadísticas dentro del panel clínico. Antes vivía embebido en el
// HTML del primero; se extrajo para que no haya dos copias que se desincronicen.
//
// buildData() es una función pura: recibe propietarios, mascotas e historia, y
// devuelve todos los agregados. No consulta la red ni conoce a Supabase. Por eso
// la pestaña del panel clínico puede calcular las estadísticas con los datos que
// ya tiene en memoria, sin una sola petición extra y sin nada programado que
// esté preguntando cada X segundos si algo cambió.
//
// Los grupos de edad se calculan contra la fecha de HOY en cada llamada, así que
// una mascota cambia de grupo sola al cumplir años: no hace falta ningún proceso
// que recorra la base para actualizarlos.

let DATA = {};

function buildData(props, mas, hist) {
  const now = new Date();
  const cnt = (arr, key) => {
    const c = {};
    arr.forEach(x => { const v = x[key]||'Sin registro'; c[v]=(c[v]||0)+1; });
    return c;
  };
  const topN = (obj, n=10) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n);

  const espRaw = cnt(mas,'esp');
  const especies = { canino:espRaw['canino']||0, felino:espRaw['felino']||0 };
  Object.entries(espRaw).forEach(([k,v])=>{ if(k!=='canino'&&k!=='felino') especies[k]=(especies[k]||0)+v; });

  const generos = { macho:0, hembra:0 };
  mas.forEach(m=>{ if(m.gen==='macho') generos.macho++; else if(m.gen==='hembra') generos.hembra++; });

  const repro = { esterilizado:0, no_esterilizado:0 };
  mas.forEach(m=>{ if(m.repr==='esterilizado') repro.esterilizado++; else if(m.repr==='no_esterilizado') repro.no_esterilizado++; });

  const ge = { '< 1 año':0, '1–3 años':0, '3–7 años':0, '7–12 años':0, '> 12 años':0 };
  mas.forEach(m=>{ if(!m.fn) return; const y=(now-new Date(m.fn))/(365.25*864e5); if(y<1) ge['< 1 año']++; else if(y<3) ge['1–3 años']++; else if(y<7) ge['3–7 años']++; else if(y<12) ge['7–12 años']++; else ge['> 12 años']++; });

  const aliRaw = cnt(mas,'ali'); delete aliRaw['Sin registro']; delete aliRaw[''];
  const alimentos = aliRaw;

  const tipoMap = { laboratorio:'Laboratorio',vacunacion:'Vacunación',consulta:'Consulta',desparasitacion:'Desparasitación',formula:'Fórmula Médica',cirugia:'Cirugía',seguimiento:'Seguimiento',hospitalizacion:'Hospitalización',documento:'Documento',orden:'Orden',imagen:'Imagen',remision:'Remisión',peluqueria:'Peluquería',guarderia:'Guardería',cita:'Cita',mensaje:'Mensaje' };
  const tiposRaw = cnt(hist,'tipo');
  const tipos_hist = Object.fromEntries(Object.entries(tiposRaw).map(([k,v])=>[tipoMap[k]||k,v]));

  const grpBy = (arr, key) => { const c={}; arr.forEach(x=>{ const v=(x[key]||'').trim(); if(v.length>1) c[v]=(c[v]||0)+1; }); return c; };
  const cirugias  = topN(grpBy(hist.filter(h=>h.tipo==='cirugia'),'desc'),10);

  const parseMeds = (arr) => { const c={}; arr.forEach(h=>{ if(!h.med) return; h.med.split(/[,;\n]/).forEach(m=>{ const s=m.trim(); if(s.length>2) c[s]=(c[s]||0)+1; }); }); return c; };
  const medicamentos   = topN(parseMeds(hist),8);
  const vacunas        = topN(parseMeds(hist.filter(h=>h.tipo==='vacunacion')),8);
  const desparasitantes= topN(parseMeds(hist.filter(h=>h.tipo==='desparasitacion')),8);
  const motivos        = topN(grpBy(hist.filter(h=>h.tipo==='consulta'),'desc'),8);

  const ciudades = topN(cnt(props,'ciudad'),10);

  const fMap = { recom:'Referido',google:'Google',redes:'Redes sociales',pub:'Publicidad física',facebook:'Facebook',insta:'Instagram',web:'Página web' };
  const fRaw = {}; props.forEach(p=>{ const f=fMap[p.como]||(p.como?p.como:'Sin registro'); fRaw[f]=(fRaw[f]||0)+1; });
  const fuentes = fRaw;

  const tlRaw = {}; hist.forEach(h=>{ if(!h.fecha) return; const ym=h.fecha.slice(0,7); if(/^\d{4}-\d{2}$/.test(ym)) tlRaw[ym]=(tlRaw[ym]||0)+1; });
  const timeline = Object.fromEntries(Object.entries(tlRaw).sort());

  const pRaw={}, pCnt={}; mas.forEach(m=>{ if(m.raza&&m.peso&&+m.peso>0){ pRaw[m.raza]=(pRaw[m.raza]||0)+ +m.peso; pCnt[m.raza]=(pCnt[m.raza]||0)+1; } });
  const pesos_razas = Object.entries(pRaw).map(([r,s])=>[r,+(s/pCnt[r]).toFixed(1)]).sort((a,b)=>b[1]-a[1]).slice(0,8);

  return {
    mascotas:mas.length, propietarios:props.length, historial:hist.length,
    especies, generos, repro, grupos_edad:ge, razas_top:topN(cnt(mas,'raza'),10),
    alimentos, tipos_hist, cirugias, medicamentos, vacunas, desparasitantes,
    motivos, ciudades, fuentes, timeline, pesos_razas,
    _vacs:hist.filter(h=>h.tipo==='vacunacion').length,
    _desps:hist.filter(h=>h.tipo==='desparasitacion').length,
    _labs:hist.filter(h=>h.tipo==='laboratorio').length,
    _imgs:hist.filter(h=>h.tipo==='imagen').length,
  };
}

function updateKPIs() {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('kpi-mas',   DATA.mascotas.toLocaleString('es-CO'));
  set('kpi-props', DATA.propietarios.toLocaleString('es-CO'));
  set('kpi-hist',  DATA.historial.toLocaleString('es-CO'));
  set('kpi-vacs',  DATA._vacs);
  set('kpi-desps', DATA._desps);
  set('kpi-labs',  DATA._labs);
  set('kpi-imgs',  DATA._imgs);
  set('tb-pacientes', DATA.mascotas + ' pacientes');

  // Los subtítulos venían escritos a mano en el HTML ("392 caninos · 91
  // felinos"), así que mentían en cuanto cambiaba un dato. Se calculan.
  const esp = DATA.especies || {};
  const otros = Object.entries(esp).filter(([k]) => k !== 'canino' && k !== 'felino')
                      .reduce((a, [, v]) => a + v, 0);
  set('kpi-sub-esp', [
    (esp.canino || 0) + ' caninos',
    (esp.felino || 0) + ' felinos',
    otros ? otros + ' otros' : null
  ].filter(Boolean).join(' · '));

  set('kpi-sub-prom', DATA.propietarios
    ? (DATA.mascotas / DATA.propietarios).toFixed(1) + ' mascotas promedio por tutor'
    : 'sin propietarios');

  const pct = DATA.mascotas ? Math.round(DATA._vacs / DATA.mascotas * 100) : 0;
  set('kpi-sub-vac', pct + '% de la población total');
}

// ── COLORES ────────────────────────────────────────────────────────────────
const C = {
  green:'#059669', teal:'#0891b2', orange:'#d97706', purple:'#7c3aed',
  pink:'#db2777', red:'#ef4444', blue:'#3b82f6', yellow:'#eab308',
  palette:['#059669','#0891b2','#d97706','#7c3aed','#db2777','#ef4444','#3b82f6','#eab308','#64748b','#14b8a6','#f97316','#84cc16']
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function fmtN(n){ return n>=1000?(n/1000).toFixed(1)+'k':n.toString() }
const defOpts = (extra={}) => ({
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ display:false }, tooltip:{ callbacks:{} } },
  ...extra
});

function rankList(id, data, color=C.green, maxVal=null){
  const el = document.getElementById(id); if(!el) return;
  const max = maxVal || Math.max(...data.map(d=>d[1]));
  el.innerHTML = data.map(([name,val],i) =>
    `<div class="rank-item">
      <div class="rank-n">${i+1}</div>
      <div class="rank-name" title="${name}">${name}</div>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${(val/max*100).toFixed(1)}%;background:${color}"></div></div>
      <div class="rank-cnt">${val}</div>
    </div>`
  ).join('');
}

// ── CHARTS ────────────────────────────────────────────────────────────────
// Chart.js no deja reutilizar un canvas que ya tiene un gráfico encima: hay que
// destruir el anterior. Sin esto, recalcular tras cada guardado reventaría con
// "Canvas is already in use".
// Se recorre el DOM en vez de llevar una lista de ids, para que agregar o quitar
// un gráfico no obligue a acordarse de actualizar la lista.
function _limpiarGraficos(){
  if (typeof Chart === 'undefined' || !Chart.getChart) return;
  document.querySelectorAll('canvas').forEach(c => {
    const previo = Chart.getChart(c);
    if (previo) previo.destroy();
  });
}

function initCharts(){
  Chart.register(ChartDataLabels);
  _limpiarGraficos();

  // Distribución de tipos de historial (donut)
  new Chart(document.getElementById('ch-tipos'), {
    type:'doughnut',
    data:{ labels:Object.keys(DATA.tipos_hist), datasets:[{ data:Object.values(DATA.tipos_hist), backgroundColor:C.palette, borderWidth:2, borderColor:'#fff' }] },
    options:{ ...defOpts(), plugins:{ legend:{ display:true, position:'right', labels:{ font:{size:10}, boxWidth:10, padding:8 } }, datalabels:{ display:false } } }
  });

  // Timeline consultas
  const tlKeys = Object.keys(DATA.timeline);
  const tlVals = Object.values(DATA.timeline);
  new Chart(document.getElementById('ch-timeline'), {
    type:'line',
    data:{ labels:tlKeys, datasets:[{ data:tlVals, borderColor:C.green, backgroundColor:'rgba(5,150,105,.1)', fill:true, tension:.4, pointRadius:4, pointBackgroundColor:C.green }] },
    options:{ ...defOpts(), plugins:{ legend:{display:false}, datalabels:{display:false} }, scales:{ x:{ ticks:{font:{size:10},maxRotation:45} }, y:{ beginAtZero:true, ticks:{stepSize:5} } } }
  });

  // Especie (donut)
  new Chart(document.getElementById('ch-especie'), {
    type:'doughnut',
    data:{ labels:['Canino','Felino','Lagomorfo'], datasets:[{ data:[392,91,4], backgroundColor:[C.green,C.teal,C.orange], borderWidth:2, borderColor:'#fff' }] },
    options:{ ...defOpts(), cutout:'68%', plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#fff', font:{weight:'bold',size:11}, formatter:(v,ctx)=>{ const tot=ctx.dataset.data.reduce((a,b)=>a+b,0); return (v/tot*100).toFixed(0)+'%'; } } } }
  });

  // Género
  new Chart(document.getElementById('ch-genero'), {
    type:'doughnut',
    data:{ labels:['Macho','Hembra'], datasets:[{ data:[230,257], backgroundColor:[C.blue,C.pink], borderWidth:2, borderColor:'#fff' }] },
    options:{ ...defOpts(), cutout:'68%', plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#fff', font:{weight:'bold',size:11}, formatter:(v,ctx)=>{ const tot=487; return (v/tot*100).toFixed(0)+'%'; } } } }
  });

  // Reproductivo
  new Chart(document.getElementById('ch-repro'), {
    type:'doughnut',
    data:{ labels:['Esterilizado','No Esterilizado'], datasets:[{ data:[178,305], backgroundColor:[C.green,C.orange], borderWidth:2, borderColor:'#fff' }] },
    options:{ ...defOpts(), cutout:'68%', plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#fff', font:{weight:'bold',size:11}, formatter:(v,ctx)=>{ const tot=483; return (v/tot*100).toFixed(0)+'%'; } } } }
  });

  // Grupos edad (bar)
  new Chart(document.getElementById('ch-edad'), {
    type:'bar',
    data:{ labels:Object.keys(DATA.grupos_edad), datasets:[{ data:Object.values(DATA.grupos_edad), backgroundColor:[C.teal,C.green,'#10b981',C.orange,C.red], borderRadius:6 }] },
    options:{ ...defOpts(), plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#fff', font:{weight:'700',size:10}, anchor:'center', align:'center' } }, scales:{ x:{ticks:{font:{size:9}}}, y:{display:false} } }
  });

  // Razas (rank list)
  rankList('rank-razas', DATA.razas_top, C.green);

  // Alimento (donut)
  new Chart(document.getElementById('ch-alimento'), {
    type:'doughnut',
    data:{
      labels:['Dieta Mixta','Sin Dato','Concentrado','Natural','Comercial'],
      datasets:[{ data:[220,130,69,6,5], backgroundColor:[C.green,C.palette[8],C.teal,C.orange,C.yellow], borderWidth:2, borderColor:'#fff' }]
    },
    options:{ ...defOpts(), plugins:{ legend:{ display:true, position:'right', labels:{font:{size:11},boxWidth:12,padding:10} }, datalabels:{ display:true, color:'#fff', font:{weight:'bold',size:11}, formatter:(v,ctx)=>{ const tot=430; return (v/tot*100).toFixed(0)+'%'; } } } }
  });

  // Cirugías y medicamentos (rank lists)
  rankList('rank-cirugia', DATA.cirugias, C.purple);
  rankList('rank-meds', DATA.medicamentos, C.teal);

  // Motivos (bar horizontal)
  const motLabels = DATA.motivos.map(m=>m[0]);
  const motVals   = DATA.motivos.map(m=>m[1]);
  new Chart(document.getElementById('ch-motivos'), {
    type:'bar',
    data:{ labels:motLabels, datasets:[{ data:motVals, backgroundColor:[C.green,...Array(6).fill(C.palette[8])], borderRadius:6 }] },
    options:{ ...defOpts(), indexAxis:'y', plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#374151', font:{size:10}, anchor:'end', align:'right' } }, scales:{ x:{display:false}, y:{ticks:{font:{size:11}}} } }
  });

  // Tipos 2 (bar)
  const t2L = Object.keys(DATA.tipos_hist);
  const t2V = Object.values(DATA.tipos_hist);
  new Chart(document.getElementById('ch-tipos2'), {
    type:'bar',
    data:{ labels:t2L, datasets:[{ data:t2V, backgroundColor:C.palette, borderRadius:5 }] },
    options:{ ...defOpts(), plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#fff', font:{weight:'700',size:10}, anchor:'center', align:'center', formatter:v=>v>10?v:'' } }, scales:{ x:{ticks:{font:{size:9},maxRotation:45}}, y:{beginAtZero:true,display:false} } }
  });

  // Vacunas y desparasitantes (rank lists)
  rankList('rank-vacunas', DATA.vacunas, C.green);
  rankList('rank-desp', DATA.desparasitantes, C.teal);

  // Ciudades (bar horizontal)
  new Chart(document.getElementById('ch-ciudades'), {
    type:'bar',
    data:{
      labels: DATA.ciudades.map(c=>c[0]),
      datasets:[{ data:DATA.ciudades.map(c=>c[1]), backgroundColor:[C.green,...Array(9).fill(C.teal)], borderRadius:5 }]
    },
    options:{ ...defOpts(), indexAxis:'y', plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#374151', font:{size:11,weight:'700'}, anchor:'end', align:'right' } }, scales:{ x:{display:false}, y:{ticks:{font:{size:12}}} } }
  });

  // Fuentes (doughnut)
  new Chart(document.getElementById('ch-fuente'), {
    type:'doughnut',
    data:{
      labels: Object.keys(DATA.fuentes),
      datasets:[{ data:Object.values(DATA.fuentes), backgroundColor:[C.green,C.teal,C.palette[8],C.orange,C.blue,C.purple], borderWidth:2, borderColor:'#fff' }]
    },
    options:{ ...defOpts(), cutout:'60%', plugins:{ legend:{ display:true, position:'right', labels:{font:{size:10},boxWidth:10,padding:6} }, datalabels:{ display:false } } }
  });

  // Timeline grande
  new Chart(document.getElementById('ch-timeline2'), {
    type:'line',
    data:{
      labels: Object.keys(DATA.timeline),
      datasets:[{
        label:'Consultas', data:Object.values(DATA.timeline),
        borderColor:C.green, backgroundColor:'rgba(5,150,105,.08)', fill:true,
        tension:.35, pointRadius:5, pointBackgroundColor:C.green, pointBorderColor:'#fff', pointBorderWidth:2
      }]
    },
    options:{
      ...defOpts(),
      plugins:{ legend:{display:false}, datalabels:{ display:true, color:C.green, font:{weight:'700',size:10}, align:'top', formatter:v=>v>3?v:'' } },
      scales:{ x:{ ticks:{font:{size:11},maxRotation:45}, grid:{display:false} }, y:{ beginAtZero:true, ticks:{stepSize:5}, grid:{color:'rgba(0,0,0,.05)'} } }
    }
  });

  // Peso por raza (bar)
  new Chart(document.getElementById('ch-peso'), {
    type:'bar',
    data:{
      labels: DATA.pesos_razas.map(p=>p[0]),
      datasets:[{ data:DATA.pesos_razas.map(p=>p[1]), backgroundColor:C.palette, borderRadius:6 }]
    },
    options:{ ...defOpts(), plugins:{ legend:{display:false}, datalabels:{ display:true, color:'#fff', font:{weight:'700',size:10}, anchor:'center', align:'center', formatter:v=>v+'kg' } }, scales:{ x:{ticks:{font:{size:10},maxRotation:45}}, y:{beginAtZero:true,ticks:{callback:v=>v+'kg'}} } }
  });

  // KPIs rank
  const kpiData = [
    ['Total pacientes', 485, 500],
    ['Propietarios', 402, 500],
    ['Registros clínicos', 1310, 1500],
    ['Consultas / mes promedio', 11, 30],
    ['% con vacunas', 48, 100],
    ['% esterilizados', 37, 100],
    ['Razas registradas', 42, 100],
    ['Municipios atendidos', 20, 50],
  ];
  rankList('rank-kpis', kpiData, C.green, 1500);
}
