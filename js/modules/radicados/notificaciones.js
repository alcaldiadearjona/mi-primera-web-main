import {
  collection,
  onSnapshot,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { esAdministrador, esFuncionario, obtenerDependenciaSesion } from '../auth/roles.js';
import { abreviarNombreDependencia } from '../../utils/helpers.js';
import { abrirDependencia } from './detalle.js';

let cancelarSuscripcionRemisiones = null;
const notificacionesDescartadas = new Set();
let claveAlmacenamientoDescartadas = '';

function cargarNotificacionesDescartadas() {
  notificacionesDescartadas.clear();
  claveAlmacenamientoDescartadas = esFuncionario()
    ? `pqrs-notificaciones-descartadas:funcionario:${obtenerDependenciaSesion()}`
    : esAdministrador()
      ? 'pqrs-notificaciones-descartadas:administrador'
      : '';
  if (!claveAlmacenamientoDescartadas) return;

  try {
    const guardadas = JSON.parse(localStorage.getItem(claveAlmacenamientoDescartadas) || '[]');
    if (!Array.isArray(guardadas) || !guardadas.every(id => typeof id === 'string')) {
      throw new TypeError('El formato de las notificaciones descartadas no es válido.');
    }
    guardadas.forEach(id => notificacionesDescartadas.add(id));
  } catch (error) {
    console.error('No fue posible cargar las notificaciones descartadas:', error);
    notificacionesDescartadas.clear();
  }
}

function guardarNotificacionesDescartadas() {
  if (!claveAlmacenamientoDescartadas) {
    throw new Error('No se pudo determinar el usuario para guardar las notificaciones.');
  }
  try {
    localStorage.setItem(
      claveAlmacenamientoDescartadas,
      JSON.stringify([...notificacionesDescartadas])
    );
  } catch (error) {
    throw new Error(`No fue posible guardar el estado de la notificación: ${error.message}`);
  }
}

function mostrarEstadoNotificaciones(contenedor, mensaje, esError = false) {
  const estado = document.createElement('p');
  estado.className = `pqrs-notification-empty${esError ? ' is-error' : ''}`;
  estado.textContent = mensaje;
  contenedor.replaceChildren(estado);
}

function actualizarContadorNotificaciones(cantidad) {
  const boton = document.getElementById('alternarNotificacionesPqrs');
  const contador = document.getElementById('contadorNotificacionesPqrs');
  if (!boton || !contador) return;

  contador.textContent = cantidad > 99 ? '99+' : String(cantidad);
  contador.hidden = cantidad === 0;
  contador.setAttribute(
    'aria-label',
    `${cantidad} ${cantidad === 1 ? 'notificación nueva' : 'notificaciones nuevas'}`
  );
  boton.setAttribute(
    'aria-label',
    cantidad
      ? `Notificaciones, ${cantidad} ${cantidad === 1 ? 'nueva' : 'nuevas'}`
      : 'Notificaciones'
  );
}

function alternarListaNotificaciones() {
  const boton = document.getElementById('alternarNotificacionesPqrs');
  const lista = document.getElementById('listaNotificacionesPqrs');
  if (!boton || !lista) return;

  const expandido = boton.getAttribute('aria-expanded') === 'true';
  boton.setAttribute('aria-expanded', String(!expandido));
  lista.hidden = expandido;
}

function crearIndicadorBoton() {
  const spinner = document.createElement('span');
  spinner.className = 'pqrs-notification-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  spinner.hidden = true;
  return spinner;
}

function formatearFechaRemision(fecha) {
  const instante = Date.parse(fecha || '');
  if (!Number.isFinite(instante)) return 'fecha no disponible';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(instante);
}

async function irARadicado(registro) {
  abrirDependencia(registro.dependencia);

  const inputBuscar = document.getElementById('inputBuscar');
  const filtroAno = document.getElementById('filtroAno');
  const filtroMes = document.getElementById('filtroMes');
  const anoRadicacion = String(registro.fechaRadicacion || '').slice(0, 4);
  if (!inputBuscar || !filtroAno || !filtroMes || typeof window.aplicarFiltrosRadicados !== 'function') {
    throw new Error('No fue posible abrir los filtros de radicados.');
  }

  if (/^\d{4}$/.test(anoRadicacion)) {
    if (!Array.from(filtroAno.options).some(opcion => opcion.value === anoRadicacion)) {
      filtroAno.add(new Option(anoRadicacion, anoRadicacion));
    }
    filtroAno.value = anoRadicacion;
  } else {
    filtroAno.value = '';
  }
  filtroMes.value = '';
  inputBuscar.value = String(registro.radicado || registro.id);

  await window.aplicarFiltrosRadicados();

  const fila = Array.from(
    document.querySelectorAll('#cuerpoTablaExclusiva tr[data-radicado-id]')
  ).find(elemento => elemento.dataset.radicadoId === registro.id);
  if (!fila) {
    alert(`No se encontró el radicado ${registro.radicado || registro.id} en la tabla de su dependencia.`);
    return false;
  }

  document.querySelectorAll('#cuerpoTablaExclusiva tr.is-active-row')
    .forEach(elemento => elemento.classList.remove('is-active-row'));
  fila.classList.add('is-active-row');
  fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

function crearNotificacionRemision(registro, tipo, contenedor) {
  const esEntrante = tipo === 'entrante';
  const tarjeta = document.createElement('article');
  tarjeta.className = `pqrs-notification-item ${esEntrante ? 'is-incoming' : 'is-rejected'}`;
  tarjeta.dataset.radicadoId = registro.id;

  const icono = document.createElement('i');
  icono.className = esEntrante ? 'bi bi-send' : 'bi bi-arrow-return-left';
  icono.setAttribute('aria-hidden', 'true');

  const contenido = document.createElement('div');
  contenido.className = 'pqrs-notification-content';

  const titulo = document.createElement('h3');
  titulo.textContent = esEntrante
    ? `Oficio remitido · Radicado ${registro.radicado || registro.id}`
    : `Remisión rechazada · Radicado ${registro.radicado || registro.id}`;

  const detalle = document.createElement('p');
  detalle.textContent = esEntrante
    ? `Te remitieron este oficio desde ${abreviarNombreDependencia(registro.remisionOrigenDependencia || 'una dependencia')} el ${formatearFechaRemision(registro.fechaRemisionCompetencia)}.`
    : `Rechazada por: ${registro.dependenciasRechazadas
      .map(abreviarNombreDependencia)
      .join(', ')}.`;

  if (!esEntrante && registro.asunto) {
    const asunto = document.createElement('p');
    asunto.textContent = `Asunto: ${registro.asunto}`;
    contenido.append(titulo, detalle, asunto);
  } else {
    contenido.append(titulo, detalle);
  }

  if (!esEntrante) {
    const dependencia = document.createElement('p');
    dependencia.textContent = `Dependencia: ${abreviarNombreDependencia(registro.dependencia || '')}.`;
    contenido.append(dependencia);

    const ayuda = document.createElement('p');
    ayuda.className = 'pqrs-notification-help';
    ayuda.textContent = 'El sistema no registra el motivo del rechazo.';
    contenido.append(ayuda);
  }

  const botonVer = document.createElement('button');
  botonVer.type = 'button';
  botonVer.className = 'pqrs-notification-open';
  const textoBoton = document.createElement('span');
  textoBoton.textContent = 'Ver petición';
  const spinner = crearIndicadorBoton();
  botonVer.append(textoBoton, spinner);
  botonVer.addEventListener('click', async () => {
    botonVer.disabled = true;
    botonVer.setAttribute('aria-busy', 'true');
    spinner.hidden = false;
    let errorNavegacion = null;
    try {
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      const abierta = await irARadicado(registro);
      if (abierta) {
        notificacionesDescartadas.add(registro.id);
        try {
          guardarNotificacionesDescartadas();
        } catch (error) {
          notificacionesDescartadas.delete(registro.id);
          throw error;
        }
        contenedor.querySelectorAll('.pqrs-notification-item').forEach(notificacion => {
          if (notificacion.dataset.radicadoId === registro.id) notificacion.remove();
        });
        const notificacionesRestantes = contenedor.querySelectorAll('.pqrs-notification-item').length;
        actualizarContadorNotificaciones(notificacionesRestantes);
        if (notificacionesRestantes === 0) {
          mostrarEstadoNotificaciones(
            contenedor,
            'No hay notificaciones pendientes sobre remisiones por competencia.'
          );
        }
      }
    } catch (error) {
      console.error('Error al abrir el radicado desde una notificación:', error);
      errorNavegacion = error;
    } finally {
      botonVer.disabled = false;
      botonVer.removeAttribute('aria-busy');
      spinner.hidden = true;
    }
    if (errorNavegacion) alert(`No fue posible abrir la petición: ${errorNavegacion.message}`);
  });

  contenido.append(botonVer);
  tarjeta.append(icono, contenido);
  return tarjeta;
}

function procesarNotificaciones(snapshot, contenedor) {
  const notificaciones = snapshot.docs
    .map(documento => ({
      ...documento.data(),
      id: documento.id
    }))
    .filter(registro => !notificacionesDescartadas.has(registro.id))
    .flatMap(registro => {
      const resultado = [];
      if (Array.isArray(registro.dependenciasRechazadas)
        && registro.dependenciasRechazadas.length > 0) {
        resultado.push({ registro, tipo: 'rechazada' });
      }
      if (registro.remisionOrigenId && !registro.fechaRecepcionCompetencia) {
        resultado.push({ registro, tipo: 'entrante' });
      }
      return resultado;
    })
    .sort((a, b) => String(b.registro.fechaRadicacion || '')
      .localeCompare(String(a.registro.fechaRadicacion || '')));

  if (!notificaciones.length) {
    mostrarEstadoNotificaciones(contenedor, 'No hay novedades sobre remisiones por competencia.');
    actualizarContadorNotificaciones(0);
    return;
  }

  const fragmento = document.createDocumentFragment();
  notificaciones.forEach(({ registro, tipo }) => (
    fragmento.append(crearNotificacionRemision(registro, tipo, contenedor))
  ));
  contenedor.replaceChildren(fragmento);
  actualizarContadorNotificaciones(notificaciones.length);
}

export function suscribirNotificacionesRemisionesFuncionario() {
  cancelarSuscripcionRemisiones?.();
  cancelarSuscripcionRemisiones = null;

  const panel = document.getElementById('notificacionesPqrsFuncionario');
  const contenedor = document.getElementById('listaNotificacionesPqrs');
  if (!panel || !contenedor) return;
  const botonAlternar = document.getElementById('alternarNotificacionesPqrs');
  if (botonAlternar) {
    botonAlternar.onclick = alternarListaNotificaciones;
    botonAlternar.setAttribute('aria-expanded', 'false');
    contenedor.hidden = true;
  }

  const funcionario = esFuncionario();
  const administrador = esAdministrador();
  if (!funcionario && !administrador) {
    notificacionesDescartadas.clear();
    claveAlmacenamientoDescartadas = '';
    panel.hidden = true;
    contenedor.replaceChildren();
    return;
  }

  cargarNotificacionesDescartadas();
  panel.hidden = false;
  actualizarContadorNotificaciones(0);
  mostrarEstadoNotificaciones(contenedor, 'Cargando notificaciones...');

  let consultaNotificaciones;
  if (funcionario) {
    const dependencia = obtenerDependenciaSesion();
    if (!dependencia) {
      mostrarEstadoNotificaciones(contenedor, 'No se pudo determinar tu dependencia.', true);
      return;
    }
    consultaNotificaciones = query(
      collection(db, RADICADOS_COLLECTION),
      where('dependencia', '==', dependencia)
    );
  } else {
    consultaNotificaciones = query(collection(db, RADICADOS_COLLECTION));
  }

  cancelarSuscripcionRemisiones = onSnapshot(
    consultaNotificaciones,
    snapshot => procesarNotificaciones(snapshot, contenedor),
    error => {
      console.error('Error al cargar las notificaciones de remisiones:', error);
      mostrarEstadoNotificaciones(
        contenedor,
        'No fue posible cargar las notificaciones. Intenta actualizar la página.',
        true
      );
    }
  );
}
