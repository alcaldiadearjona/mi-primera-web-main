import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crearMetadatosGrupoRespuesta,
  esCopiaLiderRespuesta,
  obtenerCopiasOrdinariasRadicado
} from '../js/utils/respuestas-compartidas.js';

test('la primera dependencia seleccionada queda como líder del grupo', () => {
  const metadatos = crearMetadatosGrupoRespuesta([
    { dependencia: 'Gestión del Riesgo', referencia: { id: 'radicado-riesgo' } },
    { dependencia: 'Despacho del Alcalde', referencia: { id: 'radicado-despacho' } }
  ]);

  assert.equal(metadatos.grupoRespuestaId, 'radicado-riesgo');
  assert.equal(metadatos.dependenciaLider, 'Gestión del Riesgo');
  assert.deepEqual(metadatos.grupoRadicadoIds, ['radicado-riesgo', 'radicado-despacho']);
  assert.deepEqual(metadatos.dependenciasParticipantes, [
    'Gestión del Riesgo',
    'Despacho del Alcalde'
  ]);
  assert.deepEqual(metadatos.dependenciasAportesEnviados, []);
});

test('no crea un grupo compartido cuando el radicado tiene una sola dependencia', () => {
  assert.deepEqual(
    crearMetadatosGrupoRespuesta([
      { dependencia: 'Despacho del Alcalde', referencia: { id: 'radicado-unico' } }
    ]),
    {}
  );
});

test('la migración solo encuentra copias del mismo radicado y omite remisiones por competencia', () => {
  const registros = {
    'Gestión del Riesgo': [
      { id: 'uno', radicado: 'R-2026-00001', dependencia: 'Gestión del Riesgo' },
      {
        id: 'remision',
        radicado: 'R-2026-00001',
        dependencia: 'Oficina Jurídica',
        remisionOrigenId: 'uno'
      }
    ],
    'Despacho del Alcalde': [
      { id: 'dos', radicado: 'R-2026-00001', dependencia: 'Despacho del Alcalde' },
      { id: 'otro', radicado: 'R-2026-00002', dependencia: 'Despacho del Alcalde' }
    ]
  };

  assert.deepEqual(
    obtenerCopiasOrdinariasRadicado(registros, 'R-2026-00001').map(registro => registro.id),
    ['uno', 'dos']
  );
});

test('los informes incluyen solo la copia líder y conservan los radicados independientes', () => {
  assert.equal(esCopiaLiderRespuesta({
    id: 'lider',
    grupoRespuestaId: 'lider',
    dependencia: 'Despacho del Alcalde'
  }), true);
  assert.equal(esCopiaLiderRespuesta({
    id: 'colaborador',
    grupoRespuestaId: 'lider',
    dependencia: 'Secretaría de Salud'
  }), false);
  assert.equal(esCopiaLiderRespuesta({
    id: 'copia-antigua',
    dependencia: 'Secretaría de Salud',
    dependenciaResponsable: 'Despacho del Alcalde'
  }), false);
  assert.equal(esCopiaLiderRespuesta({ id: 'unico', dependencia: 'Secretaría de Salud' }), true);
});
