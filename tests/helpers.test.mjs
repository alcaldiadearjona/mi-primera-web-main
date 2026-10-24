import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularPascua,
  evaluarEstadoAutomatico,
  formatearIso,
  obtenerFestivosColombia,
  siguienteLunes,
  sumarDiasHabilesColombia
} from '../js/utils/helpers.js';

test('calcularPascua devuelve la fecha de Pascua para años conocidos', () => {
  assert.equal(formatearIso(calcularPascua(2025)), '2025-04-20');
  assert.equal(formatearIso(calcularPascua(2026)), '2026-04-05');
});

test('siguienteLunes conserva los lunes y mueve los demás días al lunes siguiente', () => {
  assert.equal(formatearIso(siguienteLunes(new Date(2026, 9, 19))), '2026-10-19');
  assert.equal(formatearIso(siguienteLunes(new Date(2026, 9, 23))), '2026-10-26');
  assert.equal(formatearIso(siguienteLunes(new Date(2026, 9, 25))), '2026-10-26');
});

test('formatearIso rellena con ceros mes y día', () => {
  assert.equal(formatearIso(new Date(2026, 0, 5)), '2026-01-05');
});

test('obtenerFestivosColombia incluye festivos fijos, trasladados y de Semana Santa', () => {
  const festivos = obtenerFestivosColombia(2026);
  assert.ok(festivos.includes('2026-01-01'));
  assert.ok(festivos.includes('2026-01-12'));
  assert.ok(festivos.includes('2026-04-02'));
  assert.ok(festivos.includes('2026-04-03'));
  assert.ok(festivos.includes('2026-12-25'));
});

test('sumarDiasHabilesColombia omite fines de semana y festivos, incluso al cambiar de año', () => {
  assert.equal(sumarDiasHabilesColombia('2026-10-23', 1), '2026-10-26');
  assert.equal(sumarDiasHabilesColombia('2026-05-01', 1), '2026-05-04');
  assert.equal(sumarDiasHabilesColombia('2026-12-31', 1), '2027-01-04');
  assert.equal(sumarDiasHabilesColombia('', 5), '');
});

test('evaluarEstadoAutomatico prioriza respuesta y estados sin respuesta', () => {
  assert.deepEqual(
    evaluarEstadoAutomatico('', 'https://drive.google.com/file'),
    { texto: 'CERRADO', clase: 'status-cerrado' }
  );
  assert.equal(evaluarEstadoAutomatico('', '', 'Para Conocimiento').texto, 'CERRADO');
  assert.equal(evaluarEstadoAutomatico('', '', 'No Requiere Respuesta').texto, 'CERRADO');
});

test('evaluarEstadoAutomatico da prioridad al cierre sobre En Trámite', () => {
  assert.deepEqual(evaluarEstadoAutomatico('', null, '', 'EN TRAMITE'), {
    texto: 'EN TRÁMITE',
    clase: 'status-tramite'
  });
  assert.equal(evaluarEstadoAutomatico('', 'https://drive.google.com/file', '', 'EN TRAMITE').texto, 'CERRADO');
  assert.equal(evaluarEstadoAutomatico('', null, 'No Requiere Respuesta', 'EN TRAMITE').texto, 'CERRADO');
  assert.equal(evaluarEstadoAutomatico('', 'https://drive.google.com/file', '', 'VIGENTE').texto, 'CERRADO');
});

test('evaluarEstadoAutomatico clasifica fechas vencidas, próximas y vigentes', () => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = dias => {
    const resultado = new Date(hoy);
    resultado.setDate(resultado.getDate() + dias);
    return formatearIso(resultado);
  };

  assert.deepEqual(evaluarEstadoAutomatico('', null), {
    texto: 'VIGENTE',
    clase: 'status-vigente'
  });
  assert.equal(evaluarEstadoAutomatico(fecha(-1)).clase, 'status-extemporanea');
  assert.equal(evaluarEstadoAutomatico(fecha(0)).clase, 'status-proximo');
  assert.equal(evaluarEstadoAutomatico(fecha(2)).clase, 'status-proximo');
  assert.equal(evaluarEstadoAutomatico(fecha(3)).clase, 'status-vigente');
});
