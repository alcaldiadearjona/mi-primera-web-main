import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth, db } from '../../config/firebase-config.js';
import {
  cargarDatosDesdeFirebase,
  obtenerAnoInicialRadicados
} from '../../services/radicados.js';
import {
  establecerSesionUsuario,
  esAdministrador,
  esControlInterno,
  esFuncionario,
  esInvitado,
  limpiarSesionUsuario,
  obtenerCredencialLogin,
  obtenerCredencialPorCorreo,
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
import { establecerAnoInicialDisponible } from '../radicados/resumen.js';
import { suscribirNotificacionesRemisionesFuncionario } from '../radicados/notificaciones.js';

let rolSolicitado = '';
let usuarioConfigurado = '';
let configuracionEnCurso = null;
let modulosInicializados = false;
let modulosGeneracionInicializados = false;
let ordenOriginalTarjetasDependencias = null;

function mostrarErrorLogin(mensaje) {
  const error = document.getElementById('errorLogin');
  if (!error) return;
  error.textContent = mensaje;
  error.hidden = false;
}

function obtenerMensajeErrorAutenticacion(error) {
  const mensajes = {
    'auth/invalid-email': 'Usuario o Contraseña Incorrecta.',
    'auth/invalid-credential': 'Usuario o Contraseña Incorrecta.',
    'auth/invalid-login-credentials': 'Usuario o Contraseña Incorrecta.',
    'auth/user-not-found': 'Usuario o Contraseña Incorrecta.',
    'auth/wrong-password': 'Usuario o Contraseña Incorrecta.',
    'auth/too-many-requests': 'Firebase bloqueó temporalmente los intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexión a Internet e inténtalo de nuevo.',
    'auth/operation-not-allowed': 'El método de acceso no está habilitado. En Firebase Console abre Authentication > Sign-in method y activa el proveedor necesario.',
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
  const contenedor = document.getElementById('contenedorDependencias');
  const dependenciaSesion = esControlInterno()
    ? 'Control Interno'
    : obtenerDependenciaSesion();
  const tarjetas = Array.from(contenedor?.querySelectorAll('.dep-card') || []);
  if (!ordenOriginalTarjetasDependencias && tarjetas.length) {
    ordenOriginalTarjetasDependencias = tarjetas;
  }
  ordenOriginalTarjetasDependencias?.forEach(tarjeta => contenedor?.append(tarjeta));

  const tarjetaDependenciaSesion = tarjetas.find(tarjeta =>
    tarjeta.querySelector('h3')?.textContent.trim() === dependenciaSesion
  );

  if (tarjetaDependenciaSesion) contenedor.prepend(tarjetaDependenciaSesion);
  if (!esFuncionario()) return;

  tarjetas.forEach(tarjeta => {
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

  const nombre = esControlInterno()
    ? 'Control Interno'
    : esAdministrador()
      ? 'Administrador'
      : esInvitado()
        ? 'Invitado'
        : obtenerDependenciaSesion();
  const saludo = document.getElementById('saludoSesion');
  const nombreSaludo = document.getElementById('nombreSaludoSesion');
  if (nombreSaludo) nombreSaludo.textContent = nombre;
  if (saludo) saludo.hidden = !esFuncionario() && !esControlInterno();
  const rolMenu = document.getElementById('rolSesionMenu');
  const nombreMenu = document.getElementById('nombreSesionMenu');
  if (rolMenu) {
    rolMenu.textContent = esAdministrador() && !esControlInterno()
      ? 'Administrador'
      : esInvitado()
        ? 'Invitado'
        : 'Funcionario';
  }
  if (nombreMenu) nombreMenu.textContent = nombre;

  document.querySelectorAll('.menu-item').forEach(elemento => {
    const ocultar = esInvitado() && elemento.dataset.menuView !== 'generacion';
    elemento.hidden = ocultar;
    elemento.style.display = ocultar ? 'none' : '';
  });
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
  suscribirNotificacionesRemisionesFuncionario();
}

function inicializarModulosAutorizados() {
  if (!modulosGeneracionInicializados) {
    inicializarFormularioGeneracionSalida();
    modulosGeneracionInicializados = true;
  }
  if (esInvitado() || modulosInicializados) return;
  inicializarAccionesRadicados();
  inicializarFormulario();
  inicializarExportacionPlanilla();
  inicializarExportacionInformes();
  modulosInicializados = true;
}

async function configurarUsuario(usuario, rolElegido = '') {
  if (usuarioConfigurado === usuario.uid) return;
  if (configuracionEnCurso?.uid === usuario.uid) return configuracionEnCurso.promesa;
  if (configuracionEnCurso) await configuracionEnCurso.promesa;

  const promesa = (async () => {
    let perfil;
    if (usuario.isAnonymous) {
      if (rolElegido && rolElegido !== 'invitado') {
        throw new Error('La sesión anónima solo puede usar el rol Invitado.');
      }
      perfil = { rol: 'invitado', nombre: 'Invitado' };
    } else {
      const snapshotPerfil = await getDoc(doc(db, 'usuarios', usuario.uid));
      if (!snapshotPerfil.exists()) {
        throw new Error('La cuenta no tiene un perfil de acceso configurado. Contacta al administrador.');
      }

      perfil = snapshotPerfil.data();
      const usuarioEsperado = obtenerCredencialPorCorreo(usuario.email);
      if (!usuarioEsperado
        || perfil.rol !== usuarioEsperado.rol
        || (usuarioEsperado.dependencia && perfil.dependencia !== usuarioEsperado.dependencia)
        || (rolElegido && perfil.rol !== rolElegido)) {
        throw new Error('El rol o la dependencia de la cuenta no coincide con su perfil.');
      }
    }

    establecerSesionUsuario(usuario, perfil);
    mostrarPantallaDespuesDeLogin();
    inicializarModulosAutorizados();
    if (esInvitado()) {
      window.mostrarGeneracionRadicados();
      usuarioConfigurado = usuario.uid;
      return;
    }

    const anoActual = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric'
    }).format(new Date());
    await cargarDatosDesdeFirebase({ ano: anoActual, mes: '' });
    try {
      establecerAnoInicialDisponible(await obtenerAnoInicialRadicados());
    } catch (error) {
      console.error('No fue posible consultar los años históricos disponibles:', error);
    }

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
    suscribirNotificacionesRemisionesFuncionario();
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
  const rol = document.getElementById('loginRol')?.value || '';
  const usuario = document.getElementById('loginUsuario')?.value.trim().toLowerCase() || '';
  const clave = document.getElementById('loginClave')?.value || '';
  const credencial = rol === 'invitado' ? null : obtenerCredencialLogin(usuario);
  const error = document.getElementById('errorLogin');
  if (error) error.hidden = true;

  if (rol !== 'invitado' && (!credencial || credencial.rol !== rol)) {
    mostrarErrorLogin('El usuario no corresponde al rol seleccionado.');
    return;
  }

  if (boton) boton.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Verificando acceso...';
  rolSolicitado = rol;

  try {
    const resultado = rol === 'invitado'
      ? await signInAnonymously(auth)
      : await signInWithEmailAndPassword(auth, credencial.email, clave);
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
    const campoClave = document.getElementById('loginClave');
    if (campoClave) campoClave.value = '';
  } finally {
    rolSolicitado = '';
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = 'Ingresar';
    if (boton) boton.disabled = false;
  }
};

async function recuperarContrasena(event) {
  event.preventDefault();
  const rol = document.getElementById('loginRol')?.value || '';
  const usuario = document.getElementById('loginUsuario')?.value.trim().toLowerCase() || '';
  const estado = document.getElementById('estadoRecuperacionLogin');
  const errorLogin = document.getElementById('errorLogin');
  if (errorLogin) errorLogin.hidden = true;
  if (estado) {
    estado.hidden = true;
    estado.textContent = '';
  }

  if (rol === 'invitado') {
    mostrarErrorLogin('El rol Invitado no usa contraseña.');
    return;
  }

  const credencial = obtenerCredencialLogin(usuario);
  if (!credencial || credencial.rol !== rol) {
    mostrarErrorLogin('Selecciona el rol e ingresa un usuario válido para recuperar la contraseña.');
    return;
  }

  const boton = event.currentTarget;
  boton.setAttribute('aria-disabled', 'true');
  try {
    auth.languageCode = 'es';
    await sendPasswordResetEmail(auth, credencial.email);
    if (estado) {
      estado.textContent = `Si la cuenta existe, Firebase enviará un enlace de recuperación a ${credencial.email}.`;
      estado.hidden = false;
    }
  } catch (error) {
    console.error('No fue posible solicitar la recuperación de contraseña:', error);
    const erroresDeCuenta = new Set([
      'auth/user-not-found',
      'auth/invalid-email',
      'auth/invalid-credential'
    ]);
    if (erroresDeCuenta.has(error?.code)) {
      if (estado) {
        estado.textContent = `Si la cuenta existe, Firebase enviará un enlace de recuperación a ${credencial.email}.`;
        estado.hidden = false;
      }
    } else {
      mostrarErrorLogin(`No fue posible enviar el enlace de recuperación: ${obtenerMensajeErrorAutenticacion(error)}`);
    }
  } finally {
    boton.removeAttribute('aria-disabled');
  }
}

window.recuperarContrasena = recuperarContrasena;

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
  const boton = event?.currentTarget;
  if (boton?.getAttribute('aria-busy') === 'true') return;
  const spinner = boton?.querySelector('.spinner');
  const texto = boton?.querySelector('.btn-logout-text');

  if (boton) {
    boton.setAttribute('aria-busy', 'true');
    boton.setAttribute('aria-disabled', 'true');
    boton.style.pointerEvents = 'none';
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.hidden = true;

  try {
    await new Promise(resolve => window.setTimeout(resolve, 500));
    await signOut(auth);
    location.reload();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    if (boton) {
      boton.setAttribute('aria-busy', 'false');
      boton.removeAttribute('aria-disabled');
      boton.style.pointerEvents = '';
    }
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.hidden = false;
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
  const selectorRol = document.getElementById('loginRol');
  const grupoUsuario = document.getElementById('grupoUsuarioLogin');
  const grupoClave = document.getElementById('grupoClaveLogin');
  const campoUsuario = document.getElementById('loginUsuario');
  const campoClave = document.getElementById('loginClave');
  const actualizarCamposLogin = () => {
    const esInvitadoSeleccionado = selectorRol?.value === 'invitado';
    if (grupoUsuario) grupoUsuario.hidden = esInvitadoSeleccionado;
    if (grupoClave) grupoClave.hidden = esInvitadoSeleccionado;
    if (campoUsuario) {
      campoUsuario.required = !esInvitadoSeleccionado;
      campoUsuario.disabled = esInvitadoSeleccionado;
      if (esInvitadoSeleccionado) campoUsuario.value = '';
    }
    if (campoClave) {
      campoClave.required = !esInvitadoSeleccionado;
      campoClave.disabled = esInvitadoSeleccionado;
      if (esInvitadoSeleccionado) campoClave.value = '';
    }
    const enlaceRecuperacion = document.getElementById('enlaceRecuperarContrasena');
    if (enlaceRecuperacion) enlaceRecuperacion.hidden = esInvitadoSeleccionado;
  };
  selectorRol?.addEventListener('change', actualizarCamposLogin);
  actualizarCamposLogin();
  document.getElementById('enlaceRecuperarContrasena')
    ?.addEventListener('click', recuperarContrasena);
  onAuthStateChanged(auth, usuario => {
    void procesarCambioAutenticacion(usuario);
  });
}
