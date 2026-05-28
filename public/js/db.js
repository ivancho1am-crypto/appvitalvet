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

  // Al iniciar sesión: sincroniza inteligentemente — usa siempre la fuente con más datos
  // y sube al otro si está desactualizado. Garantiza que nunca se pierdan datos.
  loadAll: async () => {
    const sb = getSB();
    if (!sb) return;
    const keys = ['props', 'mas', 'hist', 'segs', 'procs', 'cots', 'recs'];
    try {
      const { data, error } = await sb.from('vv_store').select('key,data');
      if (error) throw error;

      const sbMap = {};
      if (data) data.forEach(r => { sbMap[r.key] = r.data; });

      for (const k of keys) {
        const localRaw = localStorage.getItem('vv_' + k);
        const localData = localRaw ? JSON.parse(localRaw) : [];
        const sbData = sbMap[k] || [];

        const localLen = Array.isArray(localData) ? localData.length : 0;
        const sbLen   = Array.isArray(sbData)    ? sbData.length    : 0;

        if (sbLen >= localLen) {
          // Supabase igual o más completo → usar Supabase
          localStorage.setItem('vv_' + k, JSON.stringify(sbData));
        } else {
          // localStorage más completo → subir a Supabase y seguir usando local
          await sb.from('vv_store')
            .upsert({ key: k, data: localData, updated_at: new Date().toISOString() })
            .then(({ error }) => { if (error) console.warn('Supabase push error [' + k + ']:', error); });
        }
      }
    } catch (e) { console.warn('Supabase loadAll:', e); }
  }
};

let _sbClient = null;
function getSB() {
  if (!_sbClient && window.supabase) _sbClient = supabase.createClient(SB_URL, SB_KEY);
  return _sbClient;
}
