// Módulo: Mascotas
let masFilter = 'todos';

function updRaza() {
  // placeholder — el campo raza es texto libre, la especie solo filtra en cotización
}

async function saveMas() {
  const pid = document.getElementById('m-prop-sel').value, nom = document.getElementById('m-nom').value.trim(), esp = document.getElementById('m-esp').value;
  if (!pid || !nom || !esp) { toast('Propietario, nombre y especie son obligatorios', 'err'); return }
  const pesoRaw = document.getElementById('m-peso').value;
  if (pesoRaw && parseFloat(pesoRaw) < 0) { toast('El peso no puede ser negativo', 'err'); return }
  const nm = {
    id: 'm' + Date.now(), pid, nombre: nom, chip: document.getElementById('m-chip').value.trim(), esp,
    raza: document.getElementById('m-raza').value.trim(), gen: document.getElementById('m-gen').value,
    color: document.getElementById('m-col').value.trim(), fn: document.getElementById('m-fn').value,
    peso: parseFloat(document.getElementById('m-peso').value) || null, talla: document.getElementById('m-tall').value,
    repr: document.getElementById('m-repr').value, ali: document.getElementById('m-ali').value.trim(),
    serv: document.getElementById('m-serv').checked, emoc: document.getElementById('m-emoc').checked,
    created: new Date().toLocaleDateString('es-CO')
  };

  const mas = DB.get('mas'); mas.push(nm); DB.set('mas', mas);
  // Espejo a la tabla `pacientes` (ver js/espejo.js). Reemplaza a la antigua
  // llamada a create_paciente_from_saas, que devolvía null y por eso ninguna
  // de las 611 mascotas llegó a tener paciente_id. El enlace ahora vive en
  // pacientes.saas_mas_id, no dentro de vv_store.
  espejoMas(nm);
  updSelects(); rMas(); rHistList(); rStats(); closeM('m-mas');
  toast('Mascota guardada ✓ — Abriendo historia clínica...', 'ok');
  setTimeout(() => { go('historia', document.querySelectorAll('.tab-btn')[2]); setTimeout(() => openHist(nm.id), 200) }, 1200);
}

function rMas(f) {
  f = f || masFilter;
  let data = DB.get('mas'); if (f !== 'todos') data = data.filter(m => m.esp === f);
  const props = DB.get('props'), tb = document.getElementById('tb-mas'); if (!tb) return;
  tb.innerHTML = data.map(m => {
    const p = props.find(x => x.id === m.pid);
    return `<tr>
      <td><div class="ac"><div style="font-size:22px">${EI(m.esp)}</div><div class="cn">${m.nombre}</div></div></td>
      <td style="text-transform:capitalize;font-size:11px">${m.esp} · ${m.raza || 'Mestizo'}</td>
      <td style="text-transform:capitalize">${m.gen || '—'}</td>
      <td>${edad(m.fn)}</td>
      <td>${m.peso ? m.peso + ' kg' : '—'}</td>
      <td>${p ? `<div class="cn">${p.nombre}</div><div class="cs">${p.telefono || ''}</div>` : '—'}</td>
      <td style="font-size:11px;text-transform:capitalize">${(m.repr || '').replace('_', ' ') || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-green btn-xs" onclick="openHist('${m.id}')">📋 Historia</button>
        <button class="btn btn-outline btn-xs" onclick="borrarMas('${m.id}')" title="Eliminar (va a la papelera)">🗑️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--g500)">Sin mascotas</td></tr>';
}

function fMas(f, btn) {
  masFilter = f;
  document.querySelectorAll('#page-mascota .ftab').forEach(t => t.classList.remove('on'));
  if (btn) btn.classList.add('on');
  rMas(f);
}
