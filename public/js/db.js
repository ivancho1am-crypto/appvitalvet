// localStorage wrapper + Supabase client singleton
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem('vv_' + k)) || [] } catch { return [] } },
  set: (k, v) => localStorage.setItem('vv_' + k, JSON.stringify(v))
};

let _sbClient = null;
function getSB() {
  if (!_sbClient && window.supabase) _sbClient = supabase.createClient(SB_URL, SB_KEY);
  return _sbClient;
}
