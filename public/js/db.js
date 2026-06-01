// localStorage (lectura síncrona) + Supabase (sincronización en la nube)
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem('vv_' + k)) || [] } catch { return [] } },

  // Escribe localmente y sube a Supabase. Retorna la promise para poder awaitarla.
  set: (k, v) => {
    localStorage.setItem('vv_' + k, JSON.stringify(v));
    const sb = getSB();
    if (!sb) return Promise.resolve();
    return sb.from('vv_store')
      .upsert({ key: k, data: v, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.warn('Supabase sync error [' + k + ']:', error); });
  },

  // Al iniciar sesión: sincroniza — fetcha cada key por separado para manejar
  // respuestas grandes (hist ~1MB) sin riesgo de timeout global.
  loadAll: async () => {
    const sb = getSB();
    if (!sb) return;
    const keys = ['props', 'mas', 'hist', 'segs', 'procs', 'cots', 'recs'];
    for (const k of keys) {
      try {
        const { data: row, error } = await sb.from('vv_store')
          .select('data').eq('key', k).maybeSingle();
        if (error) { console.warn('Supabase loadAll [' + k + ']:', error); continue; }

        const sbData   = (row && Array.isArray(row.data)) ? row.data : null;
        const localRaw = localStorage.getItem('vv_' + k);
        const localData = localRaw ? JSON.parse(localRaw) : [];

        const sbLen    = sbData ? sbData.length : -1;
        const localLen = Array.isArray(localData) ? localData.length : 0;

        if (sbData !== null && sbLen >= localLen) {
          // Supabase tiene datos válidos e igual o más completo → usar Supabase
          localStorage.setItem('vv_' + k, JSON.stringify(sbData));
        } else if (sbData !== null && localLen > sbLen) {
          // localStorage más completo → subir a Supabase
          await sb.from('vv_store')
            .upsert({ key: k, data: localData, updated_at: new Date().toISOString() })
            .then(({ error }) => { if (error) console.warn('Supabase push [' + k + ']:', error); });
        }
        // Si sbData === null (sin acceso o key no existe), conserva localStorage sin tocar Supabase
      } catch (e) { console.warn('Supabase loadAll [' + k + ']:', e); }
    }
  }
};

let _sbClient = null;
function getSB() {
  if (!_sbClient && window.supabase) _sbClient = supabase.createClient(SB_URL, SB_KEY);
  return _sbClient;
}
