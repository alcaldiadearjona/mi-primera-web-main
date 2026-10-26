import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmarAccion, inicializarAvisos } from '../js/modules/ui/avisos.js';

function crearElemento(id) {
  const listeners = new Map();
  return {
    id,
    hidden: false,
    className: '',
    classList: { toggle() {} },
    parentElement: null,
    isConnected: true,
    addEventListener(tipo, callback) {
      listeners.set(tipo, callback);
    },
    append() {},
    focus() {},
    replaceChildren() {},
    setAttribute() {},
    click(tipo = 'click') {
      listeners.get(tipo)?.({ target: this, key: '' });
    }
  };
}

test('confirmarAccion devuelve true al aceptar y false al cancelar', async () => {
  const ids = [
    'modalAvisoApp',
    'iconoAvisoApp',
    'tituloAvisoApp',
    'mensajeAvisoApp',
    'cancelarAvisoApp',
    'aceptarAvisoApp'
  ];
  const elementos = Object.fromEntries(ids.map(id => [id, crearElemento(id)]));
  const body = { append() {} };
  elementos.modalAvisoApp.parentElement = body;

  globalThis.document = {
    body,
    activeElement: crearElemento('activeElement'),
    createElement: tag => crearElemento(tag),
    createTextNode: texto => ({ textContent: texto }),
    getElementById: id => elementos[id],
    addEventListener() {}
  };
  globalThis.window = {};

  inicializarAvisos();

  const aceptada = confirmarAccion('¿Anular el radicado?');
  elementos.aceptarAvisoApp.click();
  assert.equal(await aceptada, true);

  const cancelada = confirmarAccion('¿Anular el radicado?');
  elementos.cancelarAvisoApp.click();
  assert.equal(await cancelada, false);

  delete globalThis.document;
  delete globalThis.window;
});
