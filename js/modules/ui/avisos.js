let pendientes = [];
let avisoActual = null;
let elementoEnfoqueAnterior = null;
let inicializado = false;

const iconosPorTipo = {
  info: 'bi bi-info-lg',
  success: 'bi bi-check-lg',
  warning: 'bi bi-exclamation-lg',
  error: 'bi bi-x-lg',
  confirm: 'bi bi-question-lg'
};

function obtenerTipoAviso(mensaje) {
  if (/no se pudo|ocurri[oó] un error|error al|no se encontr[oó]|verifica/i.test(mensaje)) {
    return 'error';
  }
  if (/correctamente|con [ée]xito|generado:|actualiz[oó] correctamente/i.test(mensaje)) {
    return 'success';
  }
  return 'info';
}

function procesarCola() {
  if (avisoActual || pendientes.length === 0) return;
  const modal = document.getElementById('modalAvisoApp');
  if (!modal) {
    const pendientesSinModal = pendientes.splice(0);
    pendientesSinModal.forEach(aviso => aviso.resolve(aviso.tipo === 'confirm' ? false : undefined));
    console.error('No se encontró el contenedor de avisos de la aplicación.');
    return;
  }

  avisoActual = pendientes.shift();
  elementoEnfoqueAnterior = document.activeElement;
  const tipoVisual = avisoActual.tipo === 'confirm'
    ? 'confirm'
    : avisoActual.tipo;
  const icono = document.createElement('i');
  icono.className = iconosPorTipo[tipoVisual] || iconosPorTipo.info;
  document.getElementById('iconoAvisoApp').replaceChildren(icono);
  const titulo = document.getElementById('tituloAvisoApp');
  const mensaje = document.getElementById('mensajeAvisoApp');
  titulo.textContent = avisoActual.titulo;
  titulo.hidden = Boolean(avisoActual.radicadoSalida);
  mensaje.classList.toggle('app-notice-radicado', Boolean(avisoActual.radicadoSalida));
  if (avisoActual.radicadoSalida) {
    const numero = document.createElement('strong');
    numero.className = 'app-notice-radicado-number';
    numero.textContent = avisoActual.radicadoSalida;
    mensaje.replaceChildren(
      document.createTextNode('Su número de radicado de salida es'),
      numero
    );
  } else {
    mensaje.textContent = avisoActual.mensaje;
  }
  modal.className = `app-notice-overlay is-${tipoVisual}`;
  modal.hidden = false;

  const cancelar = document.getElementById('cancelarAvisoApp');
  const aceptar = document.getElementById('aceptarAvisoApp');
  cancelar.hidden = avisoActual.tipo !== 'confirm';
  cancelar.textContent = avisoActual.cancelarTexto || 'Cancelar';
  aceptar.textContent = avisoActual.aceptarTexto || (avisoActual.tipo === 'confirm' ? 'Confirmar' : 'Entendido');
  aceptar.focus();
}

function cerrarAviso(resultado) {
  if (!avisoActual) return;
  const modal = document.getElementById('modalAvisoApp');
  const avisoCerrado = avisoActual;
  avisoActual = null;
  modal.hidden = true;
  avisoCerrado.resolve(resultado);
  if (elementoEnfoqueAnterior?.isConnected) elementoEnfoqueAnterior.focus();
  elementoEnfoqueAnterior = null;
  procesarCola();
}

function encolarAviso(aviso) {
  return new Promise(resolve => {
    pendientes.push({ ...aviso, resolve });
    procesarCola();
  });
}

export function mostrarAviso(mensaje, opciones = {}) {
  const texto = String(mensaje);
  const tipo = opciones.tipo || obtenerTipoAviso(texto);
  return encolarAviso({
    tipo,
    titulo: opciones.titulo || ({
      success: 'Operación completada',
      warning: 'Atención',
      error: 'No se pudo completar',
      info: 'Aviso'
    }[tipo] || 'Aviso'),
    mensaje: texto,
    aceptarTexto: opciones.aceptarTexto,
    radicadoSalida: opciones.radicadoSalida
  });
}

export function confirmarAccion(mensaje, opciones = {}) {
  return encolarAviso({
    tipo: 'confirm',
    titulo: opciones.titulo || 'Confirmar acción',
    mensaje: String(mensaje),
    aceptarTexto: opciones.aceptarTexto || 'Confirmar',
    cancelarTexto: opciones.cancelarTexto || 'Cancelar'
  });
}

export function inicializarAvisos() {
  if (inicializado) return;
  inicializado = true;

  const modal = document.getElementById('modalAvisoApp');
  if (modal && modal.parentElement !== document.body) {
    document.body.append(modal);
  }

  document.getElementById('aceptarAvisoApp')?.addEventListener('click', () => {
    cerrarAviso(true);
  });
  document.getElementById('cancelarAvisoApp')?.addEventListener('click', () => cerrarAviso(false));
  document.getElementById('modalAvisoApp')?.addEventListener('click', event => {
    if (event.target.id === 'modalAvisoApp') cerrarAviso(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && avisoActual) cerrarAviso(false);
  });

  window.alert = mensaje => {
    void mostrarAviso(mensaje);
  };
}
