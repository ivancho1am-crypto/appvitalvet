// Al cargar la página: si ya hay sesión activa, sincronizar y mostrar el panel.
// Así funciona al abrir desde un acceso directo sin pasar por el login.
(async () => {
  const sb = getSB();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await DB.loadAll();
  DB.initRealtime();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  seed(); boot(); toast('Datos actualizados ✓', 'ok');
})();
