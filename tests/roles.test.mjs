import assert from 'node:assert/strict';
import test from 'node:test';
import {
  establecerSesionUsuario,
  esAdministrador,
  esFuncionario,
  esInvitado,
  limpiarSesionUsuario,
  obtenerCredencialLogin,
  obtenerCredencialPorCorreo,
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
  limpiarSesionUsuario();
});

test('Invitado solo obtiene el rol configurado para generación de radicados', () => {
  establecerSesionUsuario({}, { rol: 'invitado', nombre: 'Invitado' });

  assert.equal(obtenerCredencialLogin('Invitado'), null);
  assert.equal(esInvitado(), true);
  assert.equal(esAdministrador(), false);
  assert.equal(esFuncionario(), false);
  assert.equal(puedeConsultarIAS(), false);
  assert.equal(puedeGestionarIAS(), false);
  limpiarSesionUsuario();
});

test('Las credenciales de acceso usan el correo real de cada dependencia', () => {
  assert.deepEqual(obtenerCredencialLogin('gobierno'), {
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
