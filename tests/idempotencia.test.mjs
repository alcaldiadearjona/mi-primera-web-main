import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completarClaveIdempotencia,
  obtenerClaveIdempotencia
} from '../js/utils/idempotencia.js';

function crearStorage() {
  const valores = new Map();
  return {
    getItem: clave => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, valor),
    removeItem: clave => valores.delete(clave)
  };
}

test('obtenerClaveIdempotencia reutiliza la clave cuando se reintenta el mismo envío', () => {
  const storage = crearStorage();
  const crearId = () => 'solicitud-1';

  assert.equal(obtenerClaveIdempotencia('huella-a', storage, 'pendientes', crearId), 'solicitud-1');
  assert.equal(obtenerClaveIdempotencia('huella-a', storage, 'pendientes', () => 'solicitud-2'), 'solicitud-1');
});

test('completarClaveIdempotencia elimina solo el envío que se confirmó', () => {
  const storage = crearStorage();
  const storageKey = 'pendientes';
  obtenerClaveIdempotencia('huella-a', storage, storageKey, () => 'solicitud-1');
  obtenerClaveIdempotencia('huella-b', storage, storageKey, () => 'solicitud-2');

  assert.equal(completarClaveIdempotencia('huella-a', 'solicitud-1', storage, storageKey), true);
  assert.equal(obtenerClaveIdempotencia('huella-b', storage, storageKey, () => 'solicitud-3'), 'solicitud-2');
  assert.equal(completarClaveIdempotencia('huella-b', 'clave-incorrecta', storage, storageKey), false);
  assert.equal(completarClaveIdempotencia('huella-b', 'solicitud-2', storage, storageKey), true);
  assert.equal(storage.getItem(storageKey), null);
});
