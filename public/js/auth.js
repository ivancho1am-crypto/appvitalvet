// Login / Logout
async function doLogin() {
  if (document.getElementById('lu').value === 'admin@vitalvet.com' &&
      document.getElementById('lp').value === 'vitalvet2024') {
    const btn = document.querySelector('.lf-btn');
    btn.textContent = 'Sincronizando datos…'; btn.disabled = true;
    await DB.loadAll();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    btn.textContent = 'Ingresar al panel →'; btn.disabled = false;
    seed(); boot(); toast('¡Bienvenido Iván! 🐾', 'ok');
  } else {
    toast('Credenciales incorrectas', 'err');
  }
}

function doLogout() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

document.getElementById('lp').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() });
