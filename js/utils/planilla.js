const CANALES_PLANILLA = ['Virtual', 'Presencial'];

export function filtrarRegistrosPorCanales(registros, canalesSeleccionados) {
  const canales = new Set(canalesSeleccionados);
  const todosLosCanalesSeleccionados = CANALES_PLANILLA.every(canal => canales.has(canal));

  return registros.filter(registro => (
    todosLosCanalesSeleccionados || canales.has(registro.tipoCanal)
  ));
}
