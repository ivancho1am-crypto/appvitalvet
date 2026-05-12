// Login / Logout
function doLogin() {
  if (document.getElementById('lu').value === 'admin@vitalvet.com' &&
      document.getElementById('lp').value === 'vitalvet2024') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
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
