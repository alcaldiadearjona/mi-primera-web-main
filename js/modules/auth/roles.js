const CUENTAS_FUNCIONARIO = {
  gobierno: 'Secretaría de Gobierno',
  planeacion: 'Secretaría de Planeación',
  gestionriesgo: 'Oficina de Gestion del Riesgo y Desastres',
  desarrollosocial: 'Oficina de Desarrollo Social',
  salud: 'Secretaría de Salud',
  controlinterno: 'Control Interno',
  juridica: 'Oficina Juridica',
  despachoalcalde: 'Despacho del Alcalde',
  umata: 'Secretaría de Umata',
  educacion: 'Secretaría de Educación',
  hacienda: 'Secretaría de Hacienda',
  sisben: 'Sisben',
  talentohumano: 'Talento Humano',
  transito: 'Secretaría de Transito y Transporte',
  gestionsocial: 'Gestion Social'
};

const DOMINIO_CUENTAS = 'usuarios.pqrsalcaldiaarjona.invalid';
let perfilSesion = null;
let usuarioSesion = null;

export function obtenerCredencialLogin(usuario) {
  const nombreUsuario = String(usuario || '').trim().toLowerCase();
  if (nombreUsuario === 'admin') {
    return {
      email: `admin@${DOMINIO_CUENTAS}`,
      rol: 'administrador',
      dependencia: ''
    };
  }
  if (!Object.prototype.hasOwnProperty.call(CUENTAS_FUNCIONARIO, nombreUsuario)) return null;
  return {
    email: `${nombreUsuario}@${DOMINIO_CUENTAS}`,
    rol: 'funcionario',
    dependencia: CUENTAS_FUNCIONARIO[nombreUsuario]
  };
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

export function esAdministrador() {
  return perfilSesion?.rol === 'administrador';
}

export function esFuncionario() {
  return perfilSesion?.rol === 'funcionario';
}

export function puedeGestionarIAS() {
  return esAdministrador();
}

export function puedeConsultarIAS() {
  return esAdministrador() || esFuncionario();
}

export function puedeGestionarRadicado(dependencia) {
  return esAdministrador()
    || (esFuncionario() && dependencia === obtenerDependenciaSesion());
}

export function obtenerDependenciaSesion() {
  return esFuncionario() ? perfilSesion.dependencia : '';
}
