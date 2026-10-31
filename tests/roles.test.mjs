import assert from 'node:assert/strict';
import test from 'node:test';
import {
  establecerSesionUsuario,
  esAdministrador,
  esFuncionario,
  limpiarSesionUsuario,
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
