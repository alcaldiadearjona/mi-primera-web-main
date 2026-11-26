import assert from 'node:assert/strict';
import test from 'node:test';
import { crearDatosCopiaCompetencia } from '../js/utils/competencia.js';

test('crea una copia de competencia sin campos de origen ajenos a la remisión', () => {
  const original = {
    radicado: 'R-2026-00001',
    tipoCanal: 'Virtual',
    fechaRadicacion: '2026-11-26',
    diasHabiles: '15',
    fechaVencimiento: '2026-12-17',
    remitente: 'MARÍA PÉREZ',
    asunto: 'SOLICITUD ORIGINAL',
    folios: 2,
    anexos: 0,
    pdfUrl: '',
    pdfNombre: 'solicitud.pdf',
    pdfCiudadanoUrl: 'https://ejemplo.test/solicitud.pdf',
    pdfCiudadanoNombre: 'solicitud.pdf',
    fechaRecepcion: '2026-11-26T14:00:00.000Z',
    dependenciaResponsable: 'Secretaría de Planeación',
    ciudadanoUid: 'uid-privado',
    anio: 2026,
    numeroSecuencia: 1
  };

  const copia = crearDatosCopiaCompetencia(
    original,
    'Secretaría de Gobierno',
    'radicado-original',
    'radicados',
    '2026-11-26T14:00:00.000Z'
  );

  assert.equal(copia.dependencia, 'Secretaría de Gobierno');
  assert.equal(copia.remitente, original.remitente);
  assert.equal(copia.asunto, original.asunto);
  assert.equal(copia.pdfUrl, original.pdfUrl);
  assert.equal(copia.pdfNombre, original.pdfNombre);
  assert.equal(copia.pdfCiudadanoUrl, original.pdfCiudadanoUrl);
  assert.equal(copia.pdfCiudadanoNombre, original.pdfCiudadanoNombre);
  assert.equal(copia.fechaRecepcion, original.fechaRecepcion);
  assert.equal(copia.fechaRecepcionCompetencia, '');
  [
    'dependenciaResponsable',
    'ciudadanoUid',
    'anio',
    'numeroSecuencia'
  ].forEach(campo => assert.equal(Object.hasOwn(copia, campo), false));
  assert.equal(Object.hasOwn(copia, 'observacionesDestinatario'), false);
});

test('incluye la observación autorizada solo cuando se proporciona', () => {
  const copia = crearDatosCopiaCompetencia(
    { radicado: 'R-2026-00001', dependencia: 'Ventanilla Única' },
    'Secretaría de Planeación',
    'radicado-original',
    'radicados',
    '2026-11-26T14:00:00.000Z',
    'Revisar el documento adjunto.'
  );

  assert.equal(copia.observacionesDestinatario, 'Revisar el documento adjunto.');
});
