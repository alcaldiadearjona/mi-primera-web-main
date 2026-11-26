import assert from 'node:assert/strict';
import test from 'node:test';
import { filtrarRegistrosPorCanales } from '../js/utils/planilla.js';

const registros = [
  { radicado: 'V-1', tipoCanal: 'Virtual' },
  { radicado: 'P-1', tipoCanal: 'Presencial' },
  { radicado: 'S-1' }
];

test('filtra los registros al seleccionar un solo canal', () => {
  assert.deepEqual(
    filtrarRegistrosPorCanales(registros, ['Virtual']),
    [registros[0]]
  );
  assert.deepEqual(
    filtrarRegistrosPorCanales(registros, ['Presencial']),
    [registros[1]]
  );
});

test('mantiene todos los registros al seleccionar ambos canales', () => {
  assert.deepEqual(
    filtrarRegistrosPorCanales(registros, ['Virtual', 'Presencial']),
    registros
  );
});

test('no devuelve registros si no se selecciona ningún canal', () => {
  assert.deepEqual(filtrarRegistrosPorCanales(registros, []), []);
});
