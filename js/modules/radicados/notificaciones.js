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
    ? `pqrs-notificaciones-descartadas:v2:funcionario:${obtenerDependenciaSesion()}`
    : esAdministrador()
      ? 'pqrs-notificaciones-descartadas:v2:administrador'
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
  const fechaTexto = String(fecha || '');
  const instante = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)
    ? Date.UTC(
        Number(fechaTexto.slice(0, 4)),
        Number(fechaTexto.slice(5, 7)) - 1,
        Number(fechaTexto.slice(8, 10)),
        12
      )
    : Date.parse(fechaTexto);
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

function crearNotificacionRemision(notificacion, contenedor) {
  const { registro, tipo, rechazo, recepcion, destinos, notificationId } = notificacion;
  const esEntrante = tipo === 'entrante';
  const esRechazada = tipo === 'rechazada';
  const esRecibida = tipo === 'recibida';
  const esNuevaSolicitud = tipo === 'nueva-solicitud';
  const tarjeta = document.createElement('article');
  tarjeta.className = `pqrs-notification-item ${
    esRechazada ? 'is-rejected' : esRecibida ? 'is-received' : 'is-incoming'
  }`;
  tarjeta.dataset.radicadoId = registro.id;
  tarjeta.dataset.notificationId = notificationId;

  const icono = document.createElement('i');
  icono.className = esRechazada
    ? 'bi bi-arrow-return-left'
    : esRecibida
      ? 'bi bi-check2-circle'
      : esNuevaSolicitud
        ? 'bi bi-inbox'
        : 'bi bi-send';
  icono.setAttribute('aria-hidden', 'true');

  const contenido = document.createElement('div');
  contenido.className = 'pqrs-notification-content';

  const titulo = document.createElement('h3');
  titulo.textContent = esNuevaSolicitud
    ? `Ventanilla cargó una nueva solicitud${registro.radicado ? ` (${registro.radicado})` : ''}.`
    : esRecibida
      ? `${abreviarNombreDependencia(recepcion?.dependencia || 'Una dependencia')} recibió una Remisión por Competencia.`
      : esEntrante
        ? `${abreviarNombreDependencia(registro.remisionOrigenDependencia || 'Una dependencia')} te remitió por Competencia un oficio.`
        : `${abreviarNombreDependencia(rechazo?.dependencia || 'Una dependencia')} te rechazó tu Remisión por Competencia.`;
  const fecha = document.createElement('p');
  fecha.textContent = `Fecha: ${formatearFechaRemision(
    esNuevaSolicitud
      ? registro.fechaHoraRadicacion || registro.fechaRadicacion
      : esRecibida
        ? recepcion?.fechaRecepcion
        : esEntrante
          ? registro.fechaRemisionCompetencia
          : rechazo?.fechaRechazo
  )}`;
  contenido.append(titulo, fecha);
  if (esNuevaSolicitud && destinos.length) {
    const destino = document.createElement('p');
    destino.textContent = `Dependencia${destinos.length === 1 ? '' : 's'}: ${destinos.join(', ')}`;
    contenido.append(destino);
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
        notificacionesDescartadas.add(notificationId);
        try {
          guardarNotificacionesDescartadas();
        } catch (error) {
          notificacionesDescartadas.delete(notificationId);
          throw error;
        }
        contenedor.querySelectorAll('.pqrs-notification-item').forEach(notificacion => {
          if (notificacion.dataset.notificationId === notificationId) notificacion.remove();
        });
        const notificacionesRestantes = contenedor.querySelectorAll('.pqrs-notification-item').length;
        actualizarContadorNotificaciones(notificacionesRestantes);
        if (notificacionesRestantes === 0) {
          mostrarEstadoNotificaciones(
            contenedor,
            'No hay notificaciones pendientes.'
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

function obtenerFechaNotificacion(notificacion) {
  const { registro, tipo, rechazo, recepcion } = notificacion;
  if (tipo === 'rechazada') return rechazo?.fechaHoraRechazo || rechazo?.fechaRechazo;
  if (tipo === 'recibida') return recepcion?.fechaHoraRecepcion || recepcion?.fechaRecepcion;
  if (tipo === 'entrante') return registro.fechaRemisionCompetencia;
  return registro.fechaHoraRadicacion || registro.fechaRadicacion;
}

function obtenerPrioridadTipoNotificacion(tipo) {
  if (tipo === 'rechazada') return 3;
  if (tipo === 'recibida') return 2;
  if (tipo === 'entrante') return 1;
  return 0;
}

function compararNotificacionesRecientes(a, b) {
  const valorFechaA = String(obtenerFechaNotificacion(a) || '');
  const valorFechaB = String(obtenerFechaNotificacion(b) || '');
  const fechaA = Date.parse(valorFechaA);
  const fechaB = Date.parse(valorFechaB);
  if (!Number.isFinite(fechaA)) return Number.isFinite(fechaB) ? 1 : 0;
  if (!Number.isFinite(fechaB)) return -1;
  const diferenciaFecha = fechaB - fechaA;
  return diferenciaFecha || obtenerPrioridadTipoNotificacion(b.tipo)
    - obtenerPrioridadTipoNotificacion(a.tipo);
}

function procesarNotificaciones(snapshot, contenedor) {
  const registros = snapshot.docs.map(documento => ({
      ...documento.data(),
      id: documento.id
    }));
  const notificaciones = [];
  const solicitudesVentanilla = new Map();
  const agregarNotificacion = notificacion => {
    if (
      !notificacionesDescartadas.has(notificacion.notificationId)
    ) {
      notificaciones.push(notificacion);
    }
  };

  registros.forEach(registro => {
    const rechazosGuardados = Array.isArray(registro.rechazosCompetencia)
      ? registro.rechazosCompetencia.filter(rechazo => (
          rechazo && typeof rechazo.dependencia === 'string'
        ))
      : [];
    const rechazos = rechazosGuardados.length
      ? rechazosGuardados
      : (Array.isArray(registro.dependenciasRechazadas)
        ? registro.dependenciasRechazadas.map(dependencia => ({
            dependencia,
            fechaRechazo: ''
          }))
        : []);
    rechazos.forEach((rechazo, indice) => {
      const notificationId = `${registro.id}:rechazada:${rechazo.dependencia}:${rechazo.fechaRechazo || indice}`;
      agregarNotificacion({ registro, tipo: 'rechazada', rechazo, notificationId });
    });

    const recepciones = Array.isArray(registro.recepcionesCompetencia)
      ? registro.recepcionesCompetencia.filter(recepcion => (
          recepcion && typeof recepcion.dependencia === 'string'
        ))
      : [];
    recepciones.forEach((recepcion, indice) => {
      const notificationId = `${registro.id}:recibida:${recepcion.dependencia}:${recepcion.fechaRecepcion || indice}`;
      agregarNotificacion({ registro, tipo: 'recibida', recepcion, notificationId });
    });

    if (registro.remisionOrigenId && !registro.fechaRecepcionCompetencia) {
      agregarNotificacion({
        registro,
        tipo: 'entrante',
        notificationId: `${registro.id}:entrante`
      });
    }

    if (registro.origenSolicitud === 'ventanilla' && !registro.remisionOrigenId) {
      const fechaEvento = registro.fechaHoraRadicacion || registro.fechaRadicacion || '';
      const solicitudId = `${registro.radicado || registro.id}:${fechaEvento}`;
      const notificacion = solicitudesVentanilla.get(solicitudId) || {
        registro,
        tipo: 'nueva-solicitud',
        notificationId: `ventanilla:${solicitudId}`,
        destinos: []
      };
      if (registro.dependencia && !notificacion.destinos.includes(registro.dependencia)) {
        notificacion.destinos.push(registro.dependencia);
      }
      solicitudesVentanilla.set(solicitudId, notificacion);
    }
  });

  solicitudesVentanilla.forEach(agregarNotificacion);
  notificaciones.sort(compararNotificacionesRecientes);

  if (!notificaciones.length) {
    mostrarEstadoNotificaciones(contenedor, 'No hay notificaciones pendientes.');
    actualizarContadorNotificaciones(0);
    return;
  }

  const fragmento = document.createDocumentFragment();
  notificaciones.forEach(notificacion => (
    fragmento.append(crearNotificacionRemision(notificacion, contenedor))
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
