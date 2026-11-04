import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularPascua,
  evaluarEstadoAutomatico,
  formatearIso,
  obtenerFestivosColombia,
  obtenerEtiquetaCumplimientoCierre,
  obtenerRadicadosProximosAVencer,
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

test('clasifica cierres a tiempo o extemporáneos comparando sus fechas', () => {
  assert.equal(obtenerEtiquetaCumplimientoCierre('2026-11-04', '2026-11-04'), 'Cerrado a Tiempo');
  assert.equal(obtenerEtiquetaCumplimientoCierre('2026-11-03', '2026-11-04'), 'Cerrado a Tiempo');
  assert.equal(obtenerEtiquetaCumplimientoCierre('2026-11-05', '2026-11-04'), 'Cerrado Extemporaneo');
  assert.equal(obtenerEtiquetaCumplimientoCierre('', '2026-11-04'), '');
  assert.equal(obtenerEtiquetaCumplimientoCierre('2026-02-30', '2026-11-04'), '');
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

test('obtenerRadicadosProximosAVencer filtra y ordena los radicados por fecha', () => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = dias => {
    const resultado = new Date(hoy);
    resultado.setDate(resultado.getDate() + dias);
    return formatearIso(resultado);
  };
  const radicados = [
    { radicado: 'vence-en-dos', fechaVencimiento: fecha(2) },
    { radicado: 'vence-manana', fechaVencimiento: fecha(1) },
    { radicado: 'vence-hoy', fechaVencimiento: fecha(0) },
    { radicado: 'en-tramite', fechaVencimiento: fecha(1), estado: 'EN TRAMITE' },
    { radicado: 'fuera-del-plazo', fechaVencimiento: fecha(3) },
    { radicado: 'cerrado', fechaVencimiento: fecha(1), respuestaUrl: 'https://example.com/respuesta' }
  ];

  assert.deepEqual(
    obtenerRadicadosProximosAVencer(radicados).map(({ radicado }) => radicado.radicado),
    ['vence-hoy', 'vence-manana', 'en-tramite', 'vence-en-dos']
  );
});
