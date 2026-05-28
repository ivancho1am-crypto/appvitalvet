// localStorage (lectura síncrona) + Supabase (sincronización en la nube)
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem('vv_' + k)) || [] } catch { return [] } },

  // Escribe localmente y sincroniza con Supabase en segundo plano
  set: (k, v) => {
    localStorage.setItem('vv_' + k, JSON.stringify(v));
    const sb = getSB();
    if (sb) sb.from('vv_store').upsert({ key: k, data: v, updated_at: new Date().toISOString() }).catch(() => {});
  },

  // Al iniciar sesión: carga todos los datos de Supabase al localStorage
  // Si Supabase está vacío y hay datos locales, los sube (migración primer uso)
  loadAll: async () => {
    const sb = getSB();
    if (!sb) return;
    try {
      const { data, error } = await sb.from('vv_store').select('key,data');
      if (error) throw error;
      if (data && data.length) {
        data.forEach(r => localStorage.setItem('vv_' + r.key, JSON.stringify(r.data)));
      } else {
        // Supabase vacío → subir datos locales existentes (primer computador)
        const keys = ['props', 'mas', 'hist', 'segs', 'procs', 'cots', 'recs'];
        for (const k of keys) {
          try {
            const raw = localStorage.getItem('vv_' + k);
            if (!raw) continue;
            const v = JSON.parse(raw);
            if (Array.isArray(v) && v.length > 0)
              await sb.from('vv_store').upsert({ key: k, data: v, updated_at: new Date().toISOString() });
          } catch (_) {}
        }
      }
    } catch (e) { console.warn('Supabase sync:', e); }
  }
};

let _sbClient = null;
function getSB() {
  if (!_sbClient && window.supabase) _sbClient = supabase.createClient(SB_URL, SB_KEY);
  return _sbClient;
}
