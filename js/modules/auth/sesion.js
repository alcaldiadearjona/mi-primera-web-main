window.iniciarSesion = function(event) {
    event.preventDefault();

    const btn = document.getElementById('btnIngresarLogin');
    const spinner = document.getElementById('spinnerLogin');
    const texto = document.getElementById('textoBtnLogin');

    const usuarioInput = document.getElementById('loginUsuario')?.value.trim();
    const claveInput = document.getElementById('loginClave')?.value.trim();

    // Activar ruedita cargando en el botón
    if (spinner) spinner.style.display = 'inline-block';
    if (texto) texto.textContent = 'Ingresando...';
    if (btn) btn.disabled = true;

    // Pequeño retardo de 1 segundo para mostrar el efecto cargando
    setTimeout(() => {
        if (usuarioInput === "admin" && claveInput === "admin123") {
            sessionStorage.setItem('sesionIniciada', 'true');
            mostrarPantallaDespuesDeLogin();
        } else {
            alert("Usuario o contraseña incorrectos. Por favor verifique sus datos.");
            document.getElementById('loginClave').value = '';
        }

        // Restablecer botón a su estado normal
        if (spinner) spinner.style.display = 'none';
        if (texto) texto.textContent = 'Ingresar';
        if (btn) btn.disabled = false;
    }, 1000);
};

window.togglePasswordVisibility = function() {
  const input = document.getElementById('loginClave');
  const button = document.querySelector('.login-password-toggle');
  const icon = button?.querySelector('i');
  if (!input || !button || !icon) return;

  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  button.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
  button.setAttribute('aria-pressed', String(mostrar));
  icon.classList.toggle('bi-eye', !mostrar);
  icon.classList.toggle('bi-eye-slash', mostrar);
};

// Función para controlar qué se ve tras ingresar (Te lleva directo a PQRS / Inicio)

function mostrarPantallaDespuesDeLogin() {
  const pantallaLogin = document.getElementById('pantalla-login');
  if (pantallaLogin) pantallaLogin.style.display = 'none';

  // Mostrar la pantalla de PQRS / Inicio y ocultar dependencias
  const pantallaInicio = document.getElementById('pantallaInicio');
  if (pantallaInicio) pantallaInicio.style.display = 'block';

  const vistaDependencias = document.getElementById('vista-dependencias');
  if (vistaDependencias) vistaDependencias.style.display = 'none';

  // Actualizar menú activo en la barra lateral (selecciona PQRS)
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  const btnPQRS = document.querySelector('.menu-item[onclick*="mostrarPantallaInicio"]');
  if (btnPQRS) btnPQRS.classList.add('active');
}

// Comprobar sesión guardada al recargar la página (F5)

window.cerrarSesion = function() {
  sessionStorage.removeItem('sesionIniciada');
  location.reload(); // Recarga la página y muestra de nuevo el login limpio
};

export function inicializarSesion() {
  if (sessionStorage.getItem('sesionIniciada') === 'true') {
    mostrarPantallaDespuesDeLogin();
  } else {
    const pantallaLogin = document.getElementById('pantalla-login');
    if (pantallaLogin) pantallaLogin.style.display = 'flex';
  }
}
