import { formatearMayusculasIniciales } from './helpers.js';

export function crearDatosCopiaCompetencia(
  radicadoOriginal,
  dependencia,
  idOrigen,
  coleccionOrigen,
  fechaRemision,
  observacionesDestinatario = ''
) {
  const normalizarTexto = coleccionOrigen === 'radicados'
    ? formatearMayusculasIniciales
    : valor => valor;
  const camposOpcionales = {};

  [
    'origenSolicitud',
    'fechaHoraRadicacion',
    'fechaRecepcion',
    'tipoPeticion',
    'notificacionRespuestaTipo',
    'notificacionRespuestaContacto',
    'pdfNombre',
    'pdfCiudadanoUrl',
    'pdfCiudadanoNombre'
  ].forEach(campo => {
    if (typeof radicadoOriginal[campo] === 'string') {
      camposOpcionales[campo] = radicadoOriginal[campo];
    }
  });

  return {
    ...camposOpcionales,
    radicado: radicadoOriginal.radicado || '',
    estado: 'VIGENTE',
    tipoCanal: radicadoOriginal.tipoCanal || '',
    fechaRadicacion: radicadoOriginal.fechaRadicacion || '',
    fechaEntregaManual: '',
    diasHabiles: radicadoOriginal.diasHabiles ?? '',
    fechaVencimiento: radicadoOriginal.fechaVencimiento || '',
    remitente: normalizarTexto(radicadoOriginal.remitente || ''),
    asunto: normalizarTexto(radicadoOriginal.asunto || ''),
    folios: radicadoOriginal.folios ?? '',
    anexos: radicadoOriginal.anexos ?? '',
    pdfUrl: radicadoOriginal.pdfUrl || '',
    dependencia,
    funcionarioAsignado: '',
    otrosEstados: '',
    respuestaUrl: '',
    respuestaArchivos: [],
    respuestaSoloEvidencia: false,
    respuestaEnviarAlCiudadano: false,
    fechaCargaRespuesta: '',
    correoRespuestaEstado: '',
    correoRespuestaFecha: '',
    correoRespuestaError: '',
    observaciones: '',
    ...(observacionesDestinatario.trim()
      ? { observacionesDestinatario: normalizarTexto(observacionesDestinatario) }
      : {}),
    dependenciasRecibidas: [],
    dependenciasRechazadas: [],
    dependenciasDestino: [],
    remisionOrigenId: idOrigen,
    remisionOrigenColeccion: coleccionOrigen,
    remisionOrigenDependencia: radicadoOriginal.dependencia || '',
    remisionOrigenRadicado: radicadoOriginal.radicado || '',
    fechaRemisionCompetencia: fechaRemision,
    fechaRecepcionCompetencia: ''
  };
}
