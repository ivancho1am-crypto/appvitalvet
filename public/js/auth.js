async function doLogin() {
  const email = document.getElementById('lu').value.trim();
  const password = document.getElementById('lp').value;
  const btn = document.querySelector('.lf-btn');

  if (!email || !password) { toast('Ingresa usuario y contraseña', 'err'); return; }

  btn.textContent = 'Verificando…'; btn.disabled = true;

  const sb = getSB();
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    btn.textContent = 'Ingresar al panel →'; btn.disabled = false;
    toast('Credenciales incorrectas', 'err');
    return;
  }

  btn.textContent = 'Sincronizando datos…';
  await DB.loadAll();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  btn.textContent = 'Ingresar al panel →'; btn.disabled = false;
  seed(); boot(); toast('¡Bienvenido Iván! 🐾', 'ok');
}

async function doLogout() {
  const sb = getSB();
  await sb.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

document.getElementById('lp').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
