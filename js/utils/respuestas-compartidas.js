export function crearMetadatosGrupoRespuesta(registrosDestino) {
  if (!Array.isArray(registrosDestino) || registrosDestino.length < 2) return {};

  const primero = registrosDestino[0];
  return {
    grupoRespuestaId: primero.referencia.id,
    grupoRadicadoIds: registrosDestino.map(({ referencia }) => referencia.id),
    dependenciasParticipantes: registrosDestino.map(({ dependencia }) => dependencia),
    dependenciaLider: primero.dependencia,
    aportesDependencias: [],
    dependenciasAportesEnviados: []
  };
}

export function obtenerCopiasOrdinariasRadicado(datosRadicados, numeroRadicado) {
  return Object.values(datosRadicados || {})
    .flat()
    .filter(registro => registro.radicado === numeroRadicado && !registro.remisionOrigenId);
}

export function esCopiaLiderRespuesta(registro) {
  if (registro.grupoRespuestaId) return registro.id === registro.grupoRespuestaId;
  if (registro.dependenciaResponsable && registro.dependencia) {
    return registro.dependencia === registro.dependenciaResponsable;
  }
  return true;
}
