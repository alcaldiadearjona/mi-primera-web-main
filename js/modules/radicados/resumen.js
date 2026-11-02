import { datosRadicados } from '../../data/radicados.js';
import { esFuncionario, obtenerDependenciaSesion } from '../auth/roles.js';
import { evaluarEstadoAutomatico, obtenerRadicadosProximosAVencer } from '../../utils/helpers.js';

let anoInicialDisponible = Number(obtenerAnoActual());

function obtenerAnoActual() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric'
  }).format(new Date());
}

function radicadosDelAno(registros) {
  const anoActual = obtenerAnoActual();
  return registros.filter(radicado => String(radicado.fechaRadicacion || '').startsWith(anoActual));
}

export function actualizarResumenRadicados() {
  const dependenciaSesion = obtenerDependenciaSesion();
  const radicados = radicadosDelAno(esFuncionario()
    ? datosRadicados[dependenciaSesion] || []
    : Object.values(datosRadicados).flat())
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

  const subtitulo = document.getElementById('subtituloRecientes');
  if (subtitulo) {
    const anoActual = obtenerAnoActual();
    subtitulo.textContent = esFuncionario()
      ? `En ${dependenciaSesion} · ${anoActual}`
      : `En todas las dependencias · ${anoActual}`;
  }

  const proximosAVencer = obtenerRadicadosProximosAVencer(radicados)
    .slice(0, 4);
  contenedor.replaceChildren();

  if (proximosAVencer.length === 0) {
    const mensaje = document.createElement('p');
    mensaje.className = 'recent-empty';
    mensaje.textContent = 'No hay radicados próximos a vencer.';
    contenedor.appendChild(mensaje);
    return;
  }

  proximosAVencer.forEach(({ radicado, estado }) => {
    const fila = document.createElement('article');
    fila.className = 'recent-item';

    const detalles = document.createElement('div');
    detalles.className = 'recent-item-details';

    const remitente = document.createElement('strong');
    remitente.className = 'recent-item-name';
    remitente.textContent = radicado.remitente || 'Remitente sin nombre';

    const numero = document.createElement('span');
    numero.className = 'recent-item-number';
    numero.textContent = `${radicado.radicado || 'Sin número de radicado'} · Vence ${radicado.fechaVencimiento}`;

    detalles.append(remitente, numero);

    const estadoBadge = document.createElement('span');
    estadoBadge.className = `recent-status ${estado.clase}`;
    estadoBadge.textContent = estado.texto;

    const abrir = document.createElement('button');
    abrir.className = 'recent-open';
    abrir.type = 'button';
    abrir.setAttribute('aria-label', `Abrir radicados de ${radicado.dependencia || dependenciaSesion}`);
    abrir.innerHTML = '<i class="bi bi-arrow-up-right" aria-hidden="true"></i>';
    abrir.addEventListener('click', () => window.abrirDependencia(radicado.dependencia));

    fila.append(detalles, estadoBadge, abrir);
    contenedor.appendChild(fila);
  });
}

export function actualizarContadores() {
  actualizarFiltroDeAno();

  for (const dep in datosRadicados) {
    const count = radicadosDelAno(datosRadicados[dep]).length;
    const elem = document.getElementById(`cant-${dep}`);
    if (!elem) continue;
    elem.textContent = esFuncionario() && dep !== obtenerDependenciaSesion()
      ? 'Acceso restringido'
      : `${count} radicados`;
  }
}

export function establecerAnoInicialDisponible(ano) {
  const anoNumerico = Number(ano);
  if (!Number.isInteger(anoNumerico) || anoNumerico > Number(obtenerAnoActual())) {
    throw new Error(`El año inicial de radicados no es válido: ${ano}.`);
  }
  anoInicialDisponible = anoNumerico;
  actualizarFiltroDeAno();
}

function actualizarFiltroDeAno() {
  const filtroAno = document.getElementById('filtroAno');
  if (!filtroAno) return;

  const anoSeleccionado = filtroAno.value;
  const anoActual = Number(obtenerAnoActual());
  const anosDisponibles = new Set();
  for (let ano = anoInicialDisponible; ano <= anoActual; ano += 1) {
    anosDisponibles.add(String(ano));
  }

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
