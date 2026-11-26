export function crearDatosCopiaCompetencia(
  radicadoOriginal,
  dependencia,
  idOrigen,
  coleccionOrigen,
  fechaRemision,
  observacionesDestinatario = ''
) {
  const copiarValor = campo => radicadoOriginal[campo] === undefined
    ? ''
    : radicadoOriginal[campo];
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
    radicado: copiarValor('radicado'),
    estado: 'VIGENTE',
    tipoCanal: copiarValor('tipoCanal'),
    fechaRadicacion: copiarValor('fechaRadicacion'),
    fechaEntregaManual: '',
    diasHabiles: copiarValor('diasHabiles'),
    fechaVencimiento: copiarValor('fechaVencimiento'),
    remitente: copiarValor('remitente'),
    asunto: copiarValor('asunto'),
    folios: radicadoOriginal.folios ?? '',
    anexos: radicadoOriginal.anexos ?? '',
    pdfUrl: copiarValor('pdfUrl'),
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
      ? { observacionesDestinatario }
      : {}),
    dependenciasRecibidas: [],
    dependenciasRechazadas: [],
    dependenciasDestino: [],
    remisionOrigenId: idOrigen,
    remisionOrigenColeccion: coleccionOrigen,
    remisionOrigenDependencia: radicadoOriginal.dependencia || '',
    remisionOrigenRadicado: copiarValor('radicado'),
    fechaRemisionCompetencia: fechaRemision,
    fechaRecepcionCompetencia: ''
  };
}
