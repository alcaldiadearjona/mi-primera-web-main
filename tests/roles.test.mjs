import assert from 'node:assert/strict';
import test from 'node:test';
import {
  establecerSesionUsuario,
  esAdministrador,
  esCiudadano,
  esFuncionario,
  esInvitado,
  limpiarSesionUsuario,
  obtenerCanalPendientesSesion,
  obtenerCredencialLogin,
  obtenerCredencialPorCorreo,
  perfilCoincideCredencial,
  puedeAgregarObservacionesDestinatario,
  puedeConsultarIAS,
  puedeEditarRadicado,
  puedeGestionarIAS
} from '../js/modules/auth/roles.js';

test('Control Interno tiene acceso equivalente al administrador', () => {
  establecerSesionUsuario({}, { rol: 'funcionario', dependencia: 'Control Interno' });

  assert.equal(esAdministrador(), true);
  assert.equal(esFuncionario(), false);
  assert.equal(puedeConsultarIAS(), true);
  assert.equal(puedeGestionarIAS(), true);
  assert.equal(puedeEditarRadicado({ coleccion: 'radicados' }), true);
  limpiarSesionUsuario();
});

test('Jurídica puede gestionar y editar IAS, pero no obtiene permisos administrativos generales', () => {
  establecerSesionUsuario({}, { rol: 'funcionario', dependencia: 'Oficina Juridica' });

  assert.equal(esAdministrador(), false);
  assert.equal(esFuncionario(), true);
  assert.equal(puedeConsultarIAS(), true);
  assert.equal(puedeGestionarIAS(), true);
  assert.equal(puedeEditarRadicado({ coleccion: 'radicadosIAS' }), true);
  assert.equal(puedeEditarRadicado({ coleccion: 'radicados' }), false);
  limpiarSesionUsuario();
});

test('Los demás funcionarios no pueden gestionar ni editar IAS', () => {
  establecerSesionUsuario({}, { rol: 'funcionario', dependencia: 'Secretaría de Salud' });

  assert.equal(puedeConsultarIAS(), true);
  assert.equal(puedeGestionarIAS(), false);
  assert.equal(puedeEditarRadicado({ coleccion: 'radicadosIAS' }), false);
  assert.equal(puedeAgregarObservacionesDestinatario(), false);
  limpiarSesionUsuario();
});

test('Solo funcionarios de Planeación pueden agregar observaciones al destinatario', () => {
  establecerSesionUsuario({}, {
    rol: 'funcionario',
    dependencia: 'Secretaría de Planeación'
  });
  assert.equal(puedeAgregarObservacionesDestinatario(), true);

  establecerSesionUsuario({}, {
    rol: 'administrador',
    dependencia: 'Secretaría de Planeación'
  });
  assert.equal(puedeAgregarObservacionesDestinatario(), false);
  limpiarSesionUsuario();
});

test('Invitado solo obtiene el rol configurado para generación de radicados', () => {
  establecerSesionUsuario({}, { rol: 'invitado', nombre: 'Invitado' });

  assert.deepEqual(obtenerCredencialLogin('Invitado'), {
    email: 'invitado@pqrsalcaldiaarjona.firebaseapp.com',
    rol: 'invitado',
    dependencia: ''
  });
  assert.equal(esInvitado(), true);
  assert.equal(esAdministrador(), false);
  assert.equal(esFuncionario(), false);
  assert.equal(puedeConsultarIAS(), false);
  assert.equal(puedeGestionarIAS(), false);
  limpiarSesionUsuario();
});

test('Ciudadano es un rol anónimo separado de Invitado y de los funcionarios', () => {
  establecerSesionUsuario({}, { rol: 'ciudadano', nombre: 'Ciudadano' });

  assert.equal(esCiudadano(), true);
  assert.equal(esInvitado(), false);
  assert.equal(esAdministrador(), false);
  assert.equal(esFuncionario(), false);
  assert.equal(puedeConsultarIAS(), false);
  limpiarSesionUsuario();
});

test('Las credenciales de acceso usan el correo real de cada dependencia', () => {
  assert.deepEqual(obtenerCredencialLogin('gobierno'), {
    email: 'gobierno@arjona-bolivar.gov.co',
    rol: 'funcionario',
    dependencia: 'Secretaría de Gobierno'
  });
  assert.deepEqual(obtenerCredencialLogin('gobierno@arjona-bolivar.gov.co'), {
    email: 'gobierno@arjona-bolivar.gov.co',
    rol: 'funcionario',
    dependencia: 'Secretaría de Gobierno'
  });
  assert.deepEqual(obtenerCredencialLogin('admin'), {
    email: 'majodabel19@gmail.com',
    rol: 'administrador',
    dependencia: ''
  });
  assert.equal(
    obtenerCredencialPorCorreo('alcaldia@arjona-bolivar.gov.co').dependencia,
    'Despacho del Alcalde'
  );
  assert.equal(obtenerCredencialPorCorreo('no-es-cuenta@example.com'), null);
});

test('Las cuentas administradoras adicionales ingresan con correo y perfil autorizado', () => {
  const correo = 'funcionaria2@arjona-bolivar.gov.co';
  const credencial = obtenerCredencialLogin(correo);

  assert.deepEqual(credencial, {
    email: correo,
    rol: 'administrador',
    dependencia: ''
  });
  assert.equal(perfilCoincideCredencial(
    { rol: 'administrador', nombre: 'Funcionaria 2' },
    obtenerCredencialPorCorreo(correo),
    'administrador'
  ), true);
  assert.equal(perfilCoincideCredencial(
    { rol: 'funcionario', dependencia: 'Secretaría de Salud' },
    obtenerCredencialPorCorreo(correo),
    'administrador'
  ), false);
  assert.equal(perfilCoincideCredencial(
    { rol: 'administrador' },
    null,
    'funcionario'
  ), false);
});

test('Bridis, Licth y Marcela inician sesión con usuarios propios de administrador', () => {
  assert.deepEqual(obtenerCredencialLogin('bridis'), {
    email: 'bridis@usuarios.pqrsalcaldiaarjona.invalid',
    rol: 'administrador',
    dependencia: ''
  });
  assert.deepEqual(obtenerCredencialLogin('licth'), {
    email: 'licth@usuarios.pqrsalcaldiaarjona.invalid',
    rol: 'administrador',
    dependencia: ''
  });
  assert.deepEqual(obtenerCredencialLogin('marcela'), {
    email: 'marcela@usuarios.pqrsalcaldiaarjona.invalid',
    rol: 'administrador',
    dependencia: ''
  });
  assert.equal(
    obtenerCredencialPorCorreo('licth@usuarios.pqrsalcaldiaarjona.invalid').rol,
    'administrador'
  );
  assert.equal(
    obtenerCredencialPorCorreo('marcela@usuarios.pqrsalcaldiaarjona.invalid').rol,
    'administrador'
  );
});

test('La lista de pendientes asigna presencial a Bridis y Licth, y virtual a Marcela', () => {
  establecerSesionUsuario(
    { email: 'bridis@usuarios.pqrsalcaldiaarjona.invalid' },
    { rol: 'administrador' }
  );
  assert.equal(obtenerCanalPendientesSesion(), 'Presencial');

  establecerSesionUsuario(
    { email: 'licth@usuarios.pqrsalcaldiaarjona.invalid' },
    { rol: 'administrador' }
  );
  assert.equal(obtenerCanalPendientesSesion(), 'Presencial');

  establecerSesionUsuario(
    { email: 'marcela@usuarios.pqrsalcaldiaarjona.invalid' },
    { rol: 'administrador' }
  );
  assert.equal(obtenerCanalPendientesSesion(), 'Virtual');

  establecerSesionUsuario({ email: 'majodabel19@gmail.com' }, { rol: 'administrador' });
  assert.equal(obtenerCanalPendientesSesion(), '');
  limpiarSesionUsuario();
});
