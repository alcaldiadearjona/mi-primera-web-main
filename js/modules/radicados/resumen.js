import { datosRadicados } from '../../data/radicados.js';
import { evaluarEstadoAutomatico } from '../../utils/helpers.js';

export function actualizarResumenRadicados() {
  const radicados = Object.values(datosRadicados)
    .flat()
    .filter(radicado => !radicado.remisionOrigenId);
  const radicadosConEstado = radicados.map((radicado) => ({
    radicado,
    estado: evaluarEstadoAutomatico(
      radicado.fechaVencimiento,
      radicado.respuestaUrl,
      radicado.otrosEstados,
      radicado.estado
    )
  }));
  const resueltas = radicadosConEstado.filter(({ estado }) => estado.clase === 'status-cerrado').length;

  document.getElementById('resumenTotal').textContent = String(radicados.length);
  document.getElementById('resumenEnTramite').textContent = String(radicados.length - resueltas);
  document.getElementById('resumenResueltas').textContent = String(resueltas);

  const contenedor = document.getElementById('resumenRecientes');
  if (!contenedor) return;

  const recientes = radicadosConEstado
    .sort((a, b) => (b.radicado.fechaRadicacion || '').localeCompare(a.radicado.fechaRadicacion || ''))
    .slice(0, 4);
  contenedor.replaceChildren();

  if (recientes.length === 0) {
    const mensaje = document.createElement('p');
    mensaje.className = 'recent-empty';
    mensaje.textContent = 'Aún no hay PQRS registradas.';
    contenedor.appendChild(mensaje);
    return;
  }

  recientes.forEach(({ radicado, estado }) => {
    const fila = document.createElement('article');
    fila.className = 'recent-item';

    const detalles = document.createElement('div');
    detalles.className = 'recent-item-details';

    const remitente = document.createElement('strong');
    remitente.className = 'recent-item-name';
    remitente.textContent = radicado.remitente || 'Remitente sin nombre';

    const numero = document.createElement('span');
    numero.className = 'recent-item-number';
    numero.textContent = radicado.radicado || 'Sin número de radicado';

    detalles.append(remitente, numero);

    const estadoBadge = document.createElement('span');
    estadoBadge.className = `recent-status ${estado.clase}`;
    estadoBadge.textContent = estado.texto;

    const abrir = document.createElement('button');
    abrir.className = 'recent-open';
    abrir.type = 'button';
    abrir.setAttribute('aria-label', `Abrir radicados de ${radicado.dependencia}`);
    abrir.innerHTML = '<i class="bi bi-arrow-up-right" aria-hidden="true"></i>';
    abrir.addEventListener('click', () => window.abrirDependencia(radicado.dependencia));

    fila.append(detalles, estadoBadge, abrir);
    contenedor.appendChild(fila);
  });
}

export function actualizarContadores() {
  actualizarFiltroDeAno();

  for (const dep in datosRadicados) {
    const count = datosRadicados[dep].length;
    const elem = document.getElementById(`cant-${dep}`);
    if (elem) elem.textContent = `${count} radicados`;
  }
}

function actualizarFiltroDeAno() {
  const filtroAno = document.getElementById('filtroAno');
  if (!filtroAno) return;

  const anoSeleccionado = filtroAno.value;
  const anoActual = new Date().getFullYear();
  const anosDisponibles = new Set(
    Array.from({ length: 3 }, (_, indice) => String(anoActual - indice))
  );

  Object.values(datosRadicados).flat().forEach(({ fechaRadicacion }) => {
    const coincidencia = typeof fechaRadicacion === 'string'
      ? fechaRadicacion.match(/^(\d{4})-/)
      : null;
    if (coincidencia) anosDisponibles.add(coincidencia[1]);
  });

  const opciones = [
    new Option('Todos los Años', ''),
    ...[...anosDisponibles]
      .sort((a, b) => Number(b) - Number(a))
      .map(ano => new Option(ano, ano))
  ];

  filtroAno.replaceChildren(...opciones);
  filtroAno.value = anosDisponibles.has(anoSeleccionado) ? anoSeleccionado : '';
}
