// Utilidades globales
const EI = e => ({ canino: '🐶', felino: '🐱', equino: '🐴', exotico: '🦎', otro: '🐾' }[e] || '🐾');

function edad(fn) {
  if (!fn) return 'N/D';
  const n = new Date(), b = new Date(fn);
  let a = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth();
  if (m < 0) { a--; m += 12 }
  if (a > 0) return a + 'a' + (m > 0 ? ' ' + m + 'm' : '');
  return m > 0 ? m + 'm' : '<1m';
}

function avColor(s) {
  const c = ['#22aa86', '#0071e2', '#c434d1', '#ff9800', '#e53935', '#7e57c2', '#26c6da'];
  let h = 0; for (let x of s) h = (h << 5) - h + x.charCodeAt(0);
  return c[Math.abs(h) % c.length];
}

function ini(n) { return n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() }

function nowDt() {
  const n = new Date(), p = x => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
}

// Parsea fechas en formato 'yyyy-mm-dd HH:MM' o 'dd/mm/yyyy HH:MM'
function parseFecha(f) {
  if (!f) return new Date(0);
  if (/^\d{4}-\d{2}-\d{2}/.test(f)) return new Date(f.replace(' ', 'T'));
  const [d, m, y] = f.split(/[\/ ]/);
  return new Date(`${y}-${m}-${d}T${f.split(' ')[1] || '00:00'}`);
}

function fmt$(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
}

function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'ok' ? '✓ ' : type === 'err' ? '✕ ' : 'ℹ ') + msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3500);
}
