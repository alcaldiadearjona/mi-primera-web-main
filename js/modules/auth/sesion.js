import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth, db } from '../../config/firebase-config.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import {
  establecerSesionUsuario,
  esAdministrador,
  esFuncionario,
  limpiarSesionUsuario,
  obtenerCredencialLogin,
  obtenerDependenciaSesion,
  puedeConsultarIAS,
  puedeGestionarIAS
} from './roles.js';
import { inicializarFormulario } from '../radicados/formulario.js';
import { inicializarFormularioGeneracionSalida } from '../radicados/generacion-salida.js';
import { inicializarExportacionPlanilla } from '../radicados/exportar-planilla.js';
import { inicializarExportacionInformes } from '../radicados/exportar-informes.js';
import { inicializarAccionesRadicados } from '../radicados/gestion.js';
import { inicializarTableroIAS } from '../ias/tablero.js';
import { inicializarInformes } from '../informes/tablero.js';

let rolSolicitado = '';
let usuarioConfigurado = '';
let configuracionEnCurso = null;
let modulosInicializados = false;

function mostrarErrorLogin(mensaje) {
  const error = document.getElementById('errorLogin');
  if (!error) return;
  error.textContent = mensaje;
  error.hidden = false;
}

function obtenerMensajeErrorAutenticacion(error) {
  const mensajes = {
    'auth/invalid-email': 'El correo interno de esta cuenta no es válido. Verifica cómo fue creada en Firebase Authentication.',
    'auth/invalid-credential': 'Firebase no encontró una cuenta con ese usuario o la contraseña no coincide. La cuenta debe existir en Firebase Authentication con el correo interno configurado para ese usuario.',
    'auth/user-not-found': 'No existe esa cuenta en Firebase Authentication. Créala con el correo interno indicado en la guía de configuración.',
    'auth/wrong-password': 'La contraseña no coincide con la registrada para esa cuenta en Firebase Authentication.',
    'auth/too-many-requests': 'Firebase bloqueó temporalmente los intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexión a Internet e inténtalo de nuevo.',
    'auth/operation-not-allowed': 'Falta habilitar el proveedor: en Firebase Console abre Authentication > Sign-in method, activa Correo electrónico/Contraseña y guarda los cambios.',
    'auth/unauthorized-domain': 'El dominio de esta aplicación no está autorizado en Firebase Authentication.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La clave de Firebase no es válida para este proyecto. Revisa la configuración de Firebase de la aplicación.',
    'permission-denied': 'Firebase aceptó la cuenta, pero denegó la lectura de su perfil. Verifica que exista usuarios/{uid} y que las reglas de Firestore estén desplegadas.',
    'unavailable': 'No se pudo conectar con Firestore para validar el perfil. Revisa tu conexión e inténtalo de nuevo.'
  };
  return mensajes[error?.code]
    || error?.message
    || 'No fue posible verificar el acceso. Contacta al administrador del sistema.';
}

function configurarTarjetasDependenciasFuncionario() {
  if (!esFuncionario()) return;
  document.querySelectorAll('#contenedorDependencias .dep-card').forEach(tarjeta => {
    const dependencia = tarjeta.querySelector('h3')?.textContent.trim() || '';
    const perteneceAlFuncionario = dependencia === obtenerDependenciaSesion();
    tarjeta.classList.toggle('is-restricted', !perteneceAlFuncionario);
    tarjeta.setAttribute('aria-disabled', String(!perteneceAlFuncionario));
    tarjeta.setAttribute('aria-label', perteneceAlFuncionario
      ? `${dependencia}. Abrir dependencia.`
      : `${dependencia}. Acceso restringido.`);
  });
}

function mostrarPantallaDespuesDeLogin() {
  const pantallaLogin = document.getElementById('pantalla-login');
  if (pantallaLogin) pantallaLogin.style.display = 'none';
  document.getElementById('pantallaInicio').style.display = 'block';
  document.getElementById('vista-dependencias').style.display = 'none';

  const nombre = esAdministrador()
    ? 'Administrador'
    : obtenerDependenciaSesion();
  const saludo = document.getElementById('saludoSesion');
  const nombreSaludo = document.getElementById('nombreSaludoSesion');
  if (nombreSaludo) nombreSaludo.textContent = nombre;
  if (saludo) saludo.hidden = !esFuncionario();
  const saludoDetalle = document.getElementById('saludoDependenciaDetalle');
  const nombreSaludoDetalle = document.getElementById('nombreSaludoDependenciaDetalle');
  if (nombreSaludoDetalle) nombreSaludoDetalle.textContent = nombre;
  if (saludoDetalle) saludoDetalle.hidden = !esFuncionario();

  const rolMenu = document.getElementById('rolSesionMenu');
  const nombreMenu = document.getElementById('nombreSesionMenu');
  if (rolMenu) rolMenu.textContent = esAdministrador() ? 'Administrador' : 'Funcionario';
  if (nombreMenu) nombreMenu.textContent = nombre;

  document.querySelectorAll('.admin-only').forEach(elemento => {
    elemento.hidden = !esAdministrador();
  });
  document.querySelectorAll('.ias-access').forEach(elemento => {
    elemento.hidden = !puedeConsultarIAS();
  });
  document.querySelectorAll('.ias-manage-only').forEach(elemento => {
    elemento.hidden = !puedeGestionarIAS();
  });
  configurarTarjetasDependenciasFuncionario();
}

function inicializarModulosAutorizados() {
  if (modulosInicializados) return;
  inicializarAccionesRadicados();
  inicializarFormulario();
  inicializarFormularioGeneracionSalida();
  inicializarExportacionPlanilla();
  inicializarExportacionInformes();
  modulosInicializados = true;
}

async function configurarUsuario(usuario, rolElegido = '') {
  if (usuarioConfigurado === usuario.uid) return;
  if (configuracionEnCurso?.uid === usuario.uid) return configuracionEnCurso.promesa;
  if (configuracionEnCurso) await configuracionEnCurso.promesa;

  const promesa = (async () => {
    const snapshotPerfil = await getDoc(doc(db, 'usuarios', usuario.uid));
    if (!snapshotPerfil.exists()) {
      throw new Error('La cuenta no tiene un perfil de acceso configurado. Contacta al administrador.');
    }

    const perfil = snapshotPerfil.data();
    const usuarioEsperado = obtenerCredencialLogin(usuario.email?.split('@')[0]);
    if (!usuarioEsperado
      || perfil.rol !== usuarioEsperado.rol
      || (usuarioEsperado.dependencia && perfil.dependencia !== usuarioEsperado.dependencia)
      || (rolElegido && perfil.rol !== rolElegido)) {
      throw new Error('El rol o la dependencia de la cuenta no coincide con su perfil.');
    }

    establecerSesionUsuario(usuario, perfil);
    mostrarPantallaDespuesDeLogin();
    inicializarModulosAutorizados();
    await cargarDatosDesdeFirebase();

    await inicializarTableroIAS();
    inicializarInformes();
    window.mostrarPantallaInicio();
    usuarioConfigurado = usuario.uid;
  })();

  configuracionEnCurso = { uid: usuario.uid, promesa };
  try {
    await promesa;
  } finally {
    if (configuracionEnCurso?.promesa === promesa) configuracionEnCurso = null;
  }
}

async function procesarCambioAutenticacion(usuario) {
  if (!usuario) {
    usuarioConfigurado = '';
    limpiarSesionUsuario();
    const login = document.getElementById('pantalla-login');
    if (login) login.style.display = 'flex';
    const saludo = document.getElementById('saludoSesion');
    if (saludo) saludo.hidden = true;
    return;
  }

  try {
    await configurarUsuario(usuario, rolSolicitado);
    rolSolicitado = '';
  } catch (error) {
    console.error('No fue posible cargar el perfil de usuario:', error);
    mostrarErrorLogin(error.message || 'No fue posible verificar el perfil de acceso.');
    await signOut(auth);
  }
}

window.iniciarSesion = async function(event) {
  event.preventDefault();
  const boton = document.getElementById('btnIngresarLogin');
  const spinner = document.getElementById('spinnerLogin');
  const texto = document.getElementById('textoBtnLogin');
  const usuario = document.getElementById('loginUsuario')?.value.trim().toLowerCase() || '';
  const clave = document.getElementById('loginClave')?.value || '';
  const rol = document.getElementById('loginRol')?.value || '';
  const credencial = obtenerCredencialLogin(usuario);
  const error = document.getElementById('errorLogin');
  if (error) error.hidden = true;

  if (!credencial || credencial.rol !== rol) {
    mostrarErrorLogin('El usuario no corresponde al rol seleccionado.');
    return;
  }

  if (boton) boton.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Verificando acceso...';
  rolSolicitado = rol;

  try {
    const resultado = await signInWithEmailAndPassword(auth, credencial.email, clave);
    try {
      await configurarUsuario(resultado.user, rol);
      rolSolicitado = '';
    } catch (errorPerfil) {
      console.error('La cuenta inició sesión, pero no se pudo validar su perfil:', errorPerfil);
      mostrarErrorLogin(obtenerMensajeErrorAutenticacion(errorPerfil));
      if (auth.currentUser) await signOut(auth);
    }
  } catch (errorAutenticacion) {
    console.error('Error de Firebase Authentication:', errorAutenticacion);
    mostrarErrorLogin(obtenerMensajeErrorAutenticacion(errorAutenticacion));
    document.getElementById('loginClave').value = '';
  } finally {
    rolSolicitado = '';
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = 'Ingresar';
    if (boton) boton.disabled = false;
  }
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

window.cerrarSesion = async function(event) {
  event?.preventDefault();
  try {
    await signOut(auth);
    location.reload();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    alert(`No fue posible cerrar sesión: ${error.message}`);
  }
};

export function inicializarSesion() {
  const login = document.getElementById('pantalla-login');
  if (login) login.style.display = 'flex';
  document.querySelectorAll('.admin-only').forEach(elemento => {
    elemento.hidden = true;
  });
  document.querySelectorAll('.ias-access').forEach(elemento => {
    elemento.hidden = true;
  });
  document.querySelectorAll('.ias-manage-only').forEach(elemento => {
    elemento.hidden = true;
  });
  onAuthStateChanged(auth, usuario => {
    void procesarCambioAutenticacion(usuario);
  });
}
