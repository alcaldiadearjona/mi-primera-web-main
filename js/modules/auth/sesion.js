import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth, db } from '../../config/firebase-config.js';
import {
  cargarDatosDesdeFirebase,
  obtenerAnoInicialRadicados
} from '../../services/radicados.js';
import { publicarConsultasPublicasCiudadanasFaltantes } from '../../services/consulta-publica.js';
import {
  establecerSesionUsuario,
  esAdministrador,
  esControlInterno,
  esCiudadano,
  esFuncionario,
  esInvitado,
  limpiarSesionUsuario,
  obtenerCredencialLogin,
  obtenerCredencialPorCorreo,
  obtenerDependenciaSesion,
  obtenerPerfilSesion,
  perfilCoincideCredencial,
  puedeConsultarIAS,
  puedeGestionarIAS
} from './roles.js';
import {
  inicializarFormulario,
  liberarReservasPQRSFGestionUsuario
} from '../radicados/formulario.js';
import { inicializarFormularioGeneracionSalida } from '../radicados/generacion-salida.js';
import { inicializarExportacionPlanilla } from '../radicados/exportar-planilla.js';
import { inicializarExportacionPlanillaRecepcion } from '../radicados/exportar-planilla-recepcion.js';
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
let temporizadorExpiracion = null;
let primeraVerificacionAutenticacion = true;
let sesionTemporalRestauradaTrasRecarga = false;
let cierrePorExpiracionEnCurso = false;

const CLAVE_SESION_ADMINISTRADOR = 'ventanilla:sesion:administrador';
const CLAVE_SESION_INVITADO = 'ventanilla:sesion:invitado';
const CLAVE_SESION_CIUDADANO = 'ventanilla:sesion:ciudadano';

function obtenerDuracionSesion(perfil) {
  if (perfil?.rol === 'administrador') return 24 * 60 * 60 * 1000;
  if (perfil?.rol === 'invitado') return 60 * 60 * 1000;
  if (perfil?.rol === 'ciudadano') return 30 * 60 * 1000;
  return null;
}

function obtenerClaveSesion(perfil) {
  if (perfil?.rol === 'administrador') return CLAVE_SESION_ADMINISTRADOR;
  if (perfil?.rol === 'invitado') return CLAVE_SESION_INVITADO;
  if (perfil?.rol === 'ciudadano') return CLAVE_SESION_CIUDADANO;
  return null;
}

function obtenerAlmacenSesion(perfil) {
  return perfil?.rol === 'ciudadano' ? sessionStorage : localStorage;
}

function limpiarTemporizadorSesion() {
  if (temporizadorExpiracion !== null) {
    window.clearTimeout(temporizadorExpiracion);
    temporizadorExpiracion = null;
  }
}

async function cerrarSesionPorExpiracion(perfil) {
  if (cierrePorExpiracionEnCurso) return;
  cierrePorExpiracionEnCurso = true;
  limpiarDatosExpiracionSesion(perfil);
  limpiarTemporizadorSesion();
  try {
    await liberarReservasPQRSFGestionUsuario();
  } catch (error) {
    console.error('No fue posible cerrar la sesión al alcanzar su tiempo de expiración:', error);
  } finally {
    try {
      await signOut(auth);
    } catch (error) {
      cierrePorExpiracionEnCurso = false;
      console.error('No fue posible finalizar el cierre de la sesión:', error);
    }
  }
}

function limpiarDatosExpiracionSesion(perfil) {
  const clave = obtenerClaveSesion(perfil);
  if (!clave) return;
  obtenerAlmacenSesion(perfil).removeItem(clave);
}

function limpiarSesionExpiradaActual() {
  limpiarTemporizadorSesion();
  limpiarDatosExpiracionSesion(obtenerPerfilSesion());
}

function iniciarControlExpiracionSesion(usuario, perfil) {
  const clave = obtenerClaveSesion(perfil);
  const duracion = obtenerDuracionSesion(perfil);
  if (!clave || !duracion) return true;

  limpiarTemporizadorSesion();
  const almacen = obtenerAlmacenSesion(perfil);
  let datosSesion = null;

  try {
    datosSesion = JSON.parse(almacen.getItem(clave) || 'null');
  } catch (error) {
    almacen.removeItem(clave);
  }

  if (!datosSesion
    || datosSesion.uid !== usuario.uid
    || !Number.isFinite(datosSesion.iniciadaEn)) {
    datosSesion = { uid: usuario.uid, iniciadaEn: Date.now() };
    almacen.setItem(clave, JSON.stringify(datosSesion));
  }

  const restante = datosSesion.iniciadaEn + duracion - Date.now();
  if (restante <= 0) {
    limpiarDatosExpiracionSesion(perfil);
    return false;
  }

  temporizadorExpiracion = window.setTimeout(() => {
    const tiempoRestante = datosSesion.iniciadaEn + duracion - Date.now();
    if (tiempoRestante > 0) {
      iniciarControlExpiracionSesion(usuario, perfil);
      return;
    }
    void cerrarSesionPorExpiracion(perfil);
  }, Math.min(restante, 2147483647));

  return true;
}

function verificarExpiracionSesionActual() {
  const usuario = auth.currentUser;
  if (!usuario) return;
  const perfil = obtenerPerfilSesion();
  const duracion = obtenerDuracionSesion(perfil);
  const clave = obtenerClaveSesion(perfil);
  if (!duracion || !clave) return;

  let datosSesion;
  try {
    datosSesion = JSON.parse(obtenerAlmacenSesion(perfil).getItem(clave) || 'null');
  } catch (error) {
    console.error('No fue posible leer la fecha de expiración de la sesión:', error);
    void cerrarSesionPorExpiracion(perfil);
    return;
  }

  if (!datosSesion
    || datosSesion.uid !== usuario.uid
    || !Number.isFinite(datosSesion.iniciadaEn)
    || Date.now() >= datosSesion.iniciadaEn + duracion) {
    void cerrarSesionPorExpiracion(perfil);
  }
}

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
      : esCiudadano()
        ? 'Ciudadano'
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
      : esCiudadano()
        ? 'Ciudadano'
        : esInvitado()
          ? 'Invitado'
          : 'Funcionario';
  }
  if (nombreMenu) nombreMenu.textContent = nombre;

  document.querySelectorAll('.menu-item').forEach(elemento => {
    const ocultar = esInvitado()
      ? elemento.dataset.menuView !== 'generacion'
      : esCiudadano() && elemento.dataset.menuView !== 'ciudadano';
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
  if (esCiudadano()) {
    if (!modulosInicializados) {
      inicializarFormulario();
      modulosInicializados = true;
    }
    return;
  }
  if (!modulosGeneracionInicializados) {
    inicializarFormularioGeneracionSalida();
    modulosGeneracionInicializados = true;
  }
  if (esInvitado() || modulosInicializados) return;
  inicializarAccionesRadicados();
  inicializarFormulario();
  inicializarExportacionPlanilla();
  inicializarExportacionPlanillaRecepcion();
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
      const referenciaPerfil = doc(db, 'usuarios', usuario.uid);
      const snapshotPerfil = await getDoc(referenciaPerfil);
      if (snapshotPerfil.exists()) {
        perfil = snapshotPerfil.data();
        if (perfil.rol === 'invitado') {
          throw new Error('El rol Invitado requiere ingresar con su contraseña.');
        }
        if (perfil.rol !== 'ciudadano'
          || (rolElegido && perfil.rol !== rolElegido)) {
          throw new Error('El rol de la sesión anónima no coincide con su perfil.');
        }
      } else {
        const rolAnonimo = rolElegido || 'ciudadano';
        if (rolAnonimo !== 'ciudadano') {
          throw new Error('La sesión anónima solo puede usar el rol Ciudadano.');
        }
        perfil = {
          rol: rolAnonimo,
          nombre: 'Ciudadano'
        };
        await setDoc(referenciaPerfil, perfil);
      }
    } else {
      const referenciaPerfil = doc(db, 'usuarios', usuario.uid);
      const snapshotPerfil = await getDoc(referenciaPerfil);
      const usuarioEsperado = obtenerCredencialPorCorreo(usuario.email);
      if (!snapshotPerfil.exists()) {
        if (usuarioEsperado?.rol !== 'invitado') {
          throw new Error('La cuenta no tiene un perfil de acceso configurado. Contacta al administrador.');
        }
        perfil = { rol: 'invitado', nombre: 'Invitado' };
        await setDoc(referenciaPerfil, perfil);
      } else {
        perfil = snapshotPerfil.data();
      }

      if (!perfilCoincideCredencial(perfil, usuarioEsperado, rolElegido)) {
        throw new Error('El rol o la dependencia de la cuenta no coincide con su perfil.');
      }
    }

    if (['ciudadano', 'invitado'].includes(perfil.rol)
      && sesionTemporalRestauradaTrasRecarga) {
      sesionTemporalRestauradaTrasRecarga = false;
      limpiarDatosExpiracionSesion(perfil);
      await signOut(auth);
      return;
    }

    await setPersistence(
      auth,
      perfil.rol === 'ciudadano' ? browserSessionPersistence : browserLocalPersistence
    );
    establecerSesionUsuario(usuario, perfil);
    if (!iniciarControlExpiracionSesion(usuario, perfil)) {
      await signOut(auth);
      return;
    }
    mostrarPantallaDespuesDeLogin();
    inicializarModulosAutorizados();
    if (esInvitado()) {
      window.mostrarGeneracionRadicados();
      usuarioConfigurado = usuario.uid;
      return;
    }
    if (esCiudadano()) {
      window.mostrarAtencionCiudadano();
      usuarioConfigurado = usuario.uid;
      return;
    }

    if (esAdministrador()) {
      try {
        const cantidadPublicada = await publicarConsultasPublicasCiudadanasFaltantes();
        if (cantidadPublicada) {
          console.info(`Se publicaron ${cantidadPublicada} consultas ciudadanas.`);
        }
      } catch (error) {
        console.error('No fue posible preparar las consultas ciudadanas públicas:', error);
        const detalle = error?.code === 'permission-denied'
          ? 'Firestore denegó el acceso. Publica las reglas actualizadas de Firestore y vuelve a ingresar como administrador.'
          : `Motivo: ${error?.message || 'error desconocido'}.`;
        alert(`No fue posible preparar las consultas públicas existentes. ${detalle} Los radicados originales no se modificaron.`);
      }
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
    if (rolSolicitado || auth.currentUser) return;
    usuarioConfigurado = '';
    cierrePorExpiracionEnCurso = false;
    limpiarTemporizadorSesion();
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
  const rolAnonimo = rol === 'ciudadano';
  const credencial = rolAnonimo
    ? null
    : obtenerCredencialLogin(rol === 'invitado' ? 'invitado' : usuario);
  const error = document.getElementById('errorLogin');
  if (error) error.hidden = true;

  if (!rolAnonimo && (!credencial || credencial.rol !== rol)) {
    mostrarErrorLogin('El usuario no corresponde al rol seleccionado.');
    return;
  }

  if (boton) boton.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Verificando acceso...';
  rolSolicitado = rol;

  try {
    await setPersistence(
      auth,
      rolAnonimo ? browserSessionPersistence : browserLocalPersistence
    );
    const resultado = rolAnonimo
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

  if (rol === 'ciudadano') {
    mostrarErrorLogin('El rol Ciudadano no usa contraseña.');
    return;
  }

  const credencial = obtenerCredencialLogin(usuario);
  if (!credencial || credencial.rol !== rol) {
    mostrarErrorLogin('Selecciona el rol e ingresa un usuario válido para recuperar la contraseña.');
    return;
  }
  if (credencial.email.endsWith('.invalid')) {
    mostrarErrorLogin('Esta cuenta no puede recibir correos de recuperación. Solicita el restablecimiento de la contraseña en Firebase Console.');
    return;
  }

  const boton = event.currentTarget;
  boton.setAttribute('aria-disabled', 'true');
  try {
    auth.languageCode = 'es';
    await sendPasswordResetEmail(auth, credencial.email);
    if (estado) {
      estado.textContent = `Si la cuenta existe, se enviará un enlace de recuperación a ${credencial.email}.`;
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
        estado.textContent = `Si la cuenta existe, se enviará un enlace de recuperación a ${credencial.email}.`;
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
    try {
      await liberarReservasPQRSFGestionUsuario();
    } catch (error) {
      console.error('No fue posible liberar las reservas antes de cerrar sesión:', error);
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }

  limpiarSesionExpiradaActual();
  try {
    await signOut(auth);
    location.reload();
  } catch (error) {
    console.error('Error al finalizar el cierre de sesión:', error);
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
  if (selectorRol) selectorRol.value = 'ciudadano';
  const actualizarCamposLogin = () => {
    const esInvitadoSeleccionado = selectorRol?.value === 'invitado';
    const esCiudadanoSeleccionado = selectorRol?.value === 'ciudadano';
    const ocultarUsuario = esInvitadoSeleccionado || esCiudadanoSeleccionado;
    if (grupoUsuario) grupoUsuario.hidden = ocultarUsuario;
    if (grupoClave) grupoClave.hidden = esCiudadanoSeleccionado;
    if (campoUsuario) {
      campoUsuario.required = !ocultarUsuario;
      campoUsuario.disabled = ocultarUsuario;
      if (ocultarUsuario) campoUsuario.value = '';
    }
    if (campoClave) {
      campoClave.required = !esCiudadanoSeleccionado;
      campoClave.disabled = esCiudadanoSeleccionado;
      if (esCiudadanoSeleccionado) campoClave.value = '';
    }
    const enlaceRecuperacion = document.getElementById('enlaceRecuperarContrasena');
    if (enlaceRecuperacion) enlaceRecuperacion.hidden = ocultarUsuario;
    const enlaceRegistro = document.getElementById('enlaceRegistrarse');
    if (enlaceRegistro) enlaceRegistro.hidden = ocultarUsuario;
  };
  selectorRol?.addEventListener('change', actualizarCamposLogin);
  actualizarCamposLogin();
  document.getElementById('enlaceRecuperarContrasena')
    ?.addEventListener('click', recuperarContrasena);
  onAuthStateChanged(auth, usuario => {
    if (primeraVerificacionAutenticacion) {
      primeraVerificacionAutenticacion = false;
      sesionTemporalRestauradaTrasRecarga = Boolean(
        usuario
        && window.performance?.getEntriesByType('navigation')[0]?.type === 'reload'
      );
    }
    void procesarCambioAutenticacion(usuario);
  });
  window.addEventListener('focus', verificarExpiracionSesionActual);
  window.addEventListener('pageshow', verificarExpiracionSesionActual);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verificarExpiracionSesionActual();
  });
}
