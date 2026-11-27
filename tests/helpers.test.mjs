import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularPascua,
  compararRadicadosPorConfirmacionYFecha,
  compararRadicadosPendientes,
  evaluarEstadoAutomatico,
  formatearMayusculasIniciales,
  formatearIso,
  formatearRadicadoEntrada,
  obtenerUrlHttpsSegura,
  obtenerFestivosColombia,
  obtenerEtiquetaCumplimientoCierre,
  obtenerRadicadosProximosAVencer,
  requiereConfirmacionCompetencia,
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

test('formatearMayusculasIniciales normaliza el texto y conserva correos y enlaces', () => {
  assert.equal(
    formatearMayusculasIniciales('  MARÍA pÉREZ, ASUNTO PQRSF  '),
    '  María Pérez, Asunto Pqrsf  '
  );
  assert.equal(
    formatearMayusculasIniciales('MARÍA PÉREZ maria.perez@ejemplo.com https://Ejemplo.com/Path'),
    'María Pérez maria.perez@ejemplo.com https://Ejemplo.com/Path'
  );
});

test('formatearRadicadoEntrada completa el consecutivo anual con cinco cifras', () => {
  assert.equal(formatearRadicadoEntrada(2026, 1), 'R-2026-00001');
  assert.equal(formatearRadicadoEntrada(2026, 12345), 'R-2026-12345');
});

test('compararRadicadosPendientes ordena por año y consecutivo numérico', () => {
  const registros = [
    { id: 'diez', radicado: 'R-2025-00010' },
    { id: 'dos', radicado: 'R-2025-00002' },
    { id: 'siguiente-anio', radicado: 'R-2026-00001' }
  ];

  assert.deepEqual(
    registros.sort(compararRadicadosPendientes).map(registro => registro.id),
    ['dos', 'diez', 'siguiente-anio']
  );
});

test('compararRadicadosPendientes ubica solicitudes sin número según su fecha de recepción', () => {
  const registros = [
    { id: 'dos', radicado: 'R-2026-00002', fechaRadicacion: '2026-11-23' },
    {
      id: 'sin-numero',
      radicado: '',
      sinNumeroRadicado: true,
      fechaRadicacion: '2026-11-22',
      fechaHoraRadicacion: '2026-11-22T14:00:00.000Z'
    },
    { id: 'uno', radicado: 'R-2026-00001', fechaRadicacion: '2026-11-21' }
  ];

  assert.deepEqual(
    registros.sort(compararRadicadosPendientes).map(registro => registro.id),
    ['uno', 'sin-numero', 'dos']
  );
});

test('prioriza confirmaciones pendientes y luego ordena por fecha de radicación', () => {
  const registros = [
    { id: 'normal-reciente', fechaRadicacion: '2026-11-27' },
    {
      id: 'confirmacion-antigua',
      fechaRadicacion: '2026-11-20',
      remisionOrigenId: 'origen-antiguo'
    },
    {
      id: 'confirmacion-reciente',
      fechaRadicacion: '2026-11-25',
      remisionOrigenId: 'origen-reciente'
    },
    {
      id: 'confirmada',
      fechaRadicacion: '2026-11-26',
      remisionOrigenId: 'origen-confirmado',
      fechaRecepcionCompetencia: '2026-11-26'
    }
  ];

  assert.deepEqual(
    registros.sort(compararRadicadosPorConfirmacionYFecha).map(registro => registro.id),
    ['confirmacion-reciente', 'confirmacion-antigua', 'normal-reciente', 'confirmada']
  );
  assert.equal(requiereConfirmacionCompetencia(registros[0]), true);
  assert.equal(requiereConfirmacionCompetencia(registros[3]), false);
});

test('obtenerUrlHttpsSegura solo acepta enlaces HTTPS válidos', () => {
  assert.equal(obtenerUrlHttpsSegura('https://drive.google.com/file/d/123'), 'https://drive.google.com/file/d/123');
  assert.equal(obtenerUrlHttpsSegura('javascript:alert(1)'), '');
  assert.ok(!obtenerUrlHttpsSegura('https://ejemplo.com/" onclick="alert(1)').includes('"'));
  assert.equal(obtenerUrlHttpsSegura(''), '');
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
