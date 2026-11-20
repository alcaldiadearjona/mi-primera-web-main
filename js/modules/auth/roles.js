const CUENTAS_FUNCIONARIO = {
  gobierno: { dependencia: 'Secretaría de Gobierno', email: 'gobierno@arjona-bolivar.gov.co' },
  planeacion: { dependencia: 'Secretaría de Planeación', email: 'planeacion@arjona-bolivar.gov.co' },
  gestionriesgo: { dependencia: 'Oficina de Gestion del Riesgo y Desastres', email: 'riesgos@arjona-bolivar.gov.co' },
  desarrollosocial: { dependencia: 'Oficina de Desarrollo Social', email: 'desarrollosocial@arjona-bolivar.gov.co' },
  salud: { dependencia: 'Secretaría de Salud', email: 'salud@arjona-bolivar.gov.co' },
  controlinterno: { dependencia: 'Control Interno', email: 'controlinterno@arjona-bolivar.gov.co' },
  juridica: { dependencia: 'Oficina Juridica', email: 'juridica@arjona-bolivar.gov.co' },
  despachoalcalde: { dependencia: 'Despacho del Alcalde', email: 'alcaldia@arjona-bolivar.gov.co' },
  umata: { dependencia: 'Secretaría de Umata', email: 'umata@arjona-bolivar.gov.co' },
  educacion: { dependencia: 'Secretaría de Educación', email: 'educacion@arjona-bolivar.gov.co' },
  hacienda: { dependencia: 'Secretaría de Hacienda', email: 'hacienda@arjona-bolivar.gov.co' },
  sisben: { dependencia: 'Sisben', email: 'sisben@arjona-bolivar.gov.co' },
  talentohumano: { dependencia: 'Talento Humano', email: 'talentohumano@arjona-bolivar.gov.co' },
  transito: { dependencia: 'Secretaría de Transito y Transporte', email: 'direcciondetransito@arjona-bolivar.gov.co' },
  gestionsocial: { dependencia: 'Gestion Social', email: 'gestionsocialalcaldiaarjona@gmail.com' }
};

const CORREO_ADMINISTRADOR = 'majodabel19@gmail.com';
const CORREO_INVITADO = 'invitado@pqrsalcaldiaarjona.firebaseapp.com';
let perfilSesion = null;
let usuarioSesion = null;

export function obtenerCredencialLogin(usuario) {
  const nombreUsuario = String(usuario || '').trim().toLowerCase();
  if (nombreUsuario === 'admin') {
    return {
      email: CORREO_ADMINISTRADOR,
      rol: 'administrador',
      dependencia: ''
    };
  }
  if (nombreUsuario === 'invitado') {
    return {
      email: CORREO_INVITADO,
      rol: 'invitado',
      dependencia: ''
    };
  }
  if (!Object.prototype.hasOwnProperty.call(CUENTAS_FUNCIONARIO, nombreUsuario)) return null;
  const cuenta = CUENTAS_FUNCIONARIO[nombreUsuario];
  return {
    email: cuenta.email,
    rol: 'funcionario',
    dependencia: cuenta.dependencia
  };
}

export function obtenerCredencialPorCorreo(correo) {
  const correoNormalizado = String(correo || '').trim().toLowerCase();
  if (correoNormalizado === CORREO_ADMINISTRADOR) {
    return { email: CORREO_ADMINISTRADOR, rol: 'administrador', dependencia: '' };
  }
  if (correoNormalizado === CORREO_INVITADO) {
    return { email: CORREO_INVITADO, rol: 'invitado', dependencia: '' };
  }
  const usuario = Object.keys(CUENTAS_FUNCIONARIO).find(
    nombre => CUENTAS_FUNCIONARIO[nombre].email === correoNormalizado
  );
  return usuario ? obtenerCredencialLogin(usuario) : null;
}

export function establecerSesionUsuario(usuario, perfil) {
  usuarioSesion = usuario;
  perfilSesion = perfil;
}

export function limpiarSesionUsuario() {
  usuarioSesion = null;
  perfilSesion = null;
}

export function obtenerPerfilSesion() {
  return perfilSesion;
}

export function obtenerUsuarioSesion() {
  return usuarioSesion;
}

export function esControlInterno() {
  return perfilSesion?.rol === 'funcionario'
    && perfilSesion.dependencia === 'Control Interno';
}

export function esJuridica() {
  return perfilSesion?.rol === 'funcionario'
    && perfilSesion.dependencia === 'Oficina Juridica';
}

export function esAdministrador() {
  return perfilSesion?.rol === 'administrador' || esControlInterno();
}

export function esFuncionario() {
  return perfilSesion?.rol === 'funcionario' && !esControlInterno();
}

export function esInvitado() {
  return perfilSesion?.rol === 'invitado';
}

export function esCiudadano() {
  return perfilSesion?.rol === 'ciudadano';
}

export function puedeGestionarIAS() {
  return esAdministrador() || esJuridica();
}

export function puedeConsultarIAS() {
  return esAdministrador() || esFuncionario();
}

export function puedeEditarRadicado(registro) {
  return esAdministrador()
    || (registro?.coleccion === 'radicadosIAS' && puedeGestionarIAS());
}

export function puedeGestionarRadicado(dependencia) {
  return esAdministrador()
    || (esFuncionario() && dependencia === obtenerDependenciaSesion());
}

export function obtenerDependenciaSesion() {
  return esFuncionario() ? perfilSesion.dependencia : '';
}
