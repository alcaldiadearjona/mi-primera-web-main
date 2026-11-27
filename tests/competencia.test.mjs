import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { crearDatosCopiaCompetencia } from '../js/utils/competencia.js';

test('Control Interno puede listar radicados como administrador', () => {
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const inicioReglaRadicados = reglas.indexOf('match /radicados/{radicadoId}');
  const reglaLecturaLista = reglas.indexOf('allow list:', inicioReglaRadicados);
  const finReglaLecturaLista = reglas.indexOf(';', reglaLecturaLista);

  assert.ok(inicioReglaRadicados >= 0);
  assert.match(
    reglas.slice(reglaLecturaLista, finReglaLecturaLista),
    /allow list: if isAdmin\(\)\s*\|\|\s*isEmployeeOf\(resource\.data\.dependencia\)/
  );
});

test('los campos de la copia están permitidos por las reglas de creación por competencia', () => {
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const inicioReglaRemision = reglas.indexOf(
    "request.resource.data.remisionOrigenColeccion == 'radicados'"
  );
  const inicioCamposPermitidos = reglas.indexOf(
    'request.resource.data.keys().hasOnly([',
    inicioReglaRemision
  );
  const finCamposPermitidos = reglas.indexOf('])', inicioCamposPermitidos);
  const camposPermitidos = new Set(
    Array.from(
      reglas.slice(inicioCamposPermitidos, finCamposPermitidos).matchAll(/'([^']+)'/g),
      coincidencia => coincidencia[1]
    )
  );
  const copia = crearDatosCopiaCompetencia({
    radicado: 'R-2026-00001',
    origenSolicitud: 'ciudadano',
    fechaHoraRadicacion: '2026-11-26T14:00:00.000Z',
    fechaRecepcion: '2026-11-26T14:00:00.000Z',
    tipoPeticion: 'Petición',
    notificacionRespuestaTipo: 'Correo',
    notificacionRespuestaContacto: 'persona@ejemplo.com',
    pdfNombre: 'solicitud.pdf',
    pdfCiudadanoUrl: 'https://ejemplo.test/solicitud.pdf',
    pdfCiudadanoNombre: 'solicitud.pdf',
    tipoCanal: 'Virtual',
    fechaRadicacion: '2026-11-26',
    diasHabiles: '15',
    fechaVencimiento: '2026-12-17',
    remitente: 'María Pérez',
    asunto: 'Solicitud',
    folios: 1,
    anexos: 0,
    pdfUrl: '',
    dependencia: 'Ventanilla Única'
  }, 'Secretaría de Gobierno', 'radicado-original', 'radicados', '2026-11-26T14:00:00.000Z');

  assert.ok(inicioReglaRemision >= 0);
  assert.ok(inicioCamposPermitidos > inicioReglaRemision);
  assert.equal(copia.vinculadaPorCompetencia, false);
  assert.deepEqual(
    Object.keys(copia).filter(campo => !camposPermitidos.has(campo)),
    []
  );
});

test('las reglas permiten registrar vínculos sin cambiar el estado del radicado original', () => {
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(
    reglas,
    /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[\s*'dependenciasVinculadas'\s*\]\)\s*&& request\.resource\.data\.dependenciasVinculadas is list/
  );
});

test('las copias vinculadas tienen una respuesta independiente', () => {
  const copia = crearDatosCopiaCompetencia(
    {
      radicado: 'R-2026-00001',
      estado: 'EN TRAMITE',
      respuestaUrl: 'respuesta-original.pdf',
      respuestaArchivos: ['respuesta-original.pdf'],
      tipoCanal: 'Virtual',
      fechaRadicacion: '2026-11-26',
      diasHabiles: '15',
      fechaVencimiento: '2026-12-17',
      remitente: 'María Pérez',
      asunto: 'Solicitud original',
      pdfUrl: '',
      dependencia: 'Secretaría de Salud'
    },
    'Secretaría de Gobierno',
    'radicado-original',
    'radicados',
    '2026-11-26T14:00:00.000Z',
    '',
    true
  );

  assert.equal(copia.vinculadaPorCompetencia, true);
  assert.equal(copia.estado, 'VIGENTE');
  assert.equal(copia.respuestaUrl, '');
  assert.deepEqual(copia.respuestaArchivos, []);
});

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
