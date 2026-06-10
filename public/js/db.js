// localStorage (lectura síncrona) + Supabase (sincronización en la nube)
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem('vv_' + k)) || [] } catch { return [] } },

  set: (k, v) => {
    const now = new Date().toISOString();
    localStorage.setItem('vv_' + k, JSON.stringify(v));
    const meta = JSON.parse(localStorage.getItem('vv_meta') || '{}');
    meta[k] = now;
    localStorage.setItem('vv_meta', JSON.stringify(meta));
    const sb = getSB();
    if (!sb) return Promise.resolve();
    return sb.from('vv_store')
      .upsert({ key: k, data: v, updated_at: now })
      .then(({ error }) => { if (error) console.warn('Supabase sync error [' + k + ']:', error); });
  },

  // Al iniciar sesión: sincroniza usando updated_at — gana el más reciente.
  loadAll: async () => {
    const sb = getSB();
    if (!sb) return;
    const keys = ['props', 'mas', 'hist', 'segs', 'procs', 'cots', 'recs'];
    const meta = JSON.parse(localStorage.getItem('vv_meta') || '{}');
    for (const k of keys) {
      try {
        const { data: row, error } = await sb.from('vv_store')
          .select('data, updated_at').eq('key', k).maybeSingle();
        if (error) { console.warn('Supabase loadAll [' + k + ']:', error); continue; }

        if (!row || row.data === null) continue;

        const sbTs    = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        const localTs = meta[k]        ? new Date(meta[k]).getTime()        : 0;

        if (sbTs >= localTs) {
          // Supabase más reciente o igual → descargar
          localStorage.setItem('vv_' + k, JSON.stringify(row.data));
          meta[k] = row.updated_at;
        } else {
          // localStorage más reciente → subir a Supabase
          const localData = JSON.parse(localStorage.getItem('vv_' + k) || '[]');
          await sb.from('vv_store')
            .upsert({ key: k, data: localData, updated_at: meta[k] || new Date().toISOString() })
            .then(({ error }) => { if (error) console.warn('Supabase push [' + k + ']:', error); });
        }
      } catch (e) { console.warn('Supabase loadAll [' + k + ']:', e); }
    }
    localStorage.setItem('vv_meta', JSON.stringify(meta));
  },

  // Suscripción Realtime — actualiza localStorage automáticamente cuando otro dispositivo guarda
  initRealtime: () => {
    const sb = getSB();
    if (!sb) return;
    sb.channel('vv_store_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vv_store' }, payload => {
        const row = payload.new;
        if (!row || !row.key || row.data === undefined) return;
        const meta    = JSON.parse(localStorage.getItem('vv_meta') || '{}');
        const sbTs    = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        const localTs = meta[row.key]  ? new Date(meta[row.key]).getTime()  : 0;
        if (sbTs > localTs) {
          localStorage.setItem('vv_' + row.key, JSON.stringify(row.data));
          meta[row.key] = row.updated_at;
          localStorage.setItem('vv_meta', JSON.stringify(meta));
          if (typeof boot === 'function') boot();
          if (typeof toast === 'function') toast('🔄 Datos sincronizados desde otro dispositivo', 'info');
        }
      })
      .subscribe();
  }
};

let _sbClient = null;
function getSB() {
  if (!_sbClient && window.supabase) _sbClient = supabase.createClient(SB_URL, SB_KEY);
  return _sbClient;
}
