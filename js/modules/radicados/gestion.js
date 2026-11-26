import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { datosRadicados } from '../../data/radicados.js';
import { buscarRegistroRadicado, obtenerColeccionRegistro } from '../../data/registros.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import {
  eliminarConsultaPublicaRadicado,
  sincronizarConsultaPublicaRadicado
} from '../../services/consulta-publica.js';
import { recargarDatosIAS } from '../ias/tablero.js';
import {
  abreviarNombreDependencia,
  formatearMayusculasIniciales,
  sumarDiasHabilesColombia
} from '../../utils/helpers.js';
import { crearDatosCopiaCompetencia } from '../../utils/competencia.js';
import {
  esAdministrador,
  obtenerPerfilSesion,
  puedeEditarRadicado,
  puedeAgregarObservacionesDestinatario,
  puedeGestionarIAS,
  puedeGestionarRadicado
} from '../auth/roles.js';
import { confirmarAccion } from '../ui/avisos.js';
import { actualizarDisponibilidadAccionesRadicado, TIPOS_PETICION } from './tabla.js';
import { informarResultadoNotificacionCorreo } from './notificaciones-correo.js';
import { convertirABase64 } from '../../utils/helpers.js';

function obtenerFechaActualBogota() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

async function actualizarConsultaPublicaSiAplica(id, coleccion = RADICADOS_COLLECTION) {
  if (coleccion !== RADICADOS_COLLECTION) return;
  try {
    await sincronizarConsultaPublicaRadicado(id);
  } catch (error) {
    console.error('No se pudo actualizar la consulta pública del radicado:', error);
    alert('La gestión se guardó, pero la consulta pública no se actualizó. Contacta al administrador.');
  }
}

export function inicializarAccionesRadicados() {
  document.getElementById('formEditar')?.addEventListener('submit', guardarEdicionRadicado);
  document.getElementById('formProrrogaRadicado')?.addEventListener('submit', guardarProrrogaRadicado);
  document.getElementById('prorrogaDias')?.addEventListener('input', actualizarFechaProrroga);
  document.getElementById('formFuncionarioAsignado')?.addEventListener('submit', guardarFuncionarioAsignado);
  inicializarBuscadorFuncionarios();
  inicializarBuscadorDependenciasEdicion();
  document.getElementById('txtFuncionarioAsignado')?.addEventListener('input', event => {
    if (event.currentTarget.value.trim() !== funcionarioAsignadoSeleccionado) {
      funcionarioAsignadoSeleccionado = '';
    }
    actualizarEstadoFuncionarioPreview(event);
    filtrarSugerenciasFuncionarios();
  });
  document.getElementById('alternarDependenciasRemision')?.addEventListener('click', alternarDesplegableRemision);
  document.getElementById('dependenciasRemisionCompetencia')?.addEventListener('change', actualizarResumenRemision);
  document.addEventListener('pointerdown', seleccionarFilaRadicadoActiva, true);
  document.addEventListener('click', seleccionarFilaRadicadoActiva, true);
  document.addEventListener('click', cerrarDesplegableRemisionAlClicExterno);
  document.addEventListener('keydown', cerrarDesplegableRemisionConEscape);
}

function seleccionarFilaRadicadoActiva(event) {
  if (!(event.target instanceof Element)) return;

  const filaActiva = event.target.closest(
    '#cuerpoTablaExclusiva tr.month-record-row[data-radicado-id], #cuerpoTablaIAS tr.month-record-row[data-radicado-id]'
  );
  if (!filaActiva) return;

  document.querySelectorAll(
    '#cuerpoTablaExclusiva tr.month-record-row.is-active-row, #cuerpoTablaIAS tr.month-record-row.is-active-row'
  ).forEach(fila => fila.classList.toggle('is-active-row', fila === filaActiva));
  filaActiva.classList.add('is-active-row');
}

function alternarDesplegableRemision() {
  const boton = document.getElementById('alternarDependenciasRemision');
  const lista = document.getElementById('dependenciasRemisionCompetencia');
  if (!boton || !lista) return;
  const expandido = boton.getAttribute('aria-expanded') === 'true';
  boton.setAttribute('aria-expanded', String(!expandido));
  lista.hidden = expandido;
  boton.querySelector('i')?.classList.toggle('bi-chevron-down', expandido);
  boton.querySelector('i')?.classList.toggle('bi-chevron-up', !expandido);
}

function cerrarDesplegableRemisionAlClicExterno(event) {
  const boton = document.getElementById('alternarDependenciasRemision');
  const lista = document.getElementById('dependenciasRemisionCompetencia');
  if (!boton || !lista || lista.hidden) return;
  if (boton.parentElement.contains(event.target)) return;
  lista.hidden = true;
  boton.setAttribute('aria-expanded', 'false');
  boton.querySelector('i')?.classList.replace('bi-chevron-up', 'bi-chevron-down');
}

function cerrarDesplegableRemisionConEscape(event) {
  if (event.key !== 'Escape') return;
  const boton = document.getElementById('alternarDependenciasRemision');
  const lista = document.getElementById('dependenciasRemisionCompetencia');
  if (!boton || !lista || lista.hidden) return;
  lista.hidden = true;
  boton.setAttribute('aria-expanded', 'false');
  boton.querySelector('i')?.classList.replace('bi-chevron-up', 'bi-chevron-down');
  boton.focus();
}

function actualizarResumenRemision() {
  const resumen = document.getElementById('resumenDependenciasRemision');
  const selecciones = Array.from(
    document.querySelectorAll('input[name="dependenciaDestinoCompetencia"]:checked')
  );
  const botonRemitir = document.getElementById('btnRemitirPorCompetencia');
  if (botonRemitir) {
    botonRemitir.disabled = !selecciones.some(casilla => !casilla.disabled);
  }
  const campoObservaciones = document.getElementById('campoObservacionesRemision');
  if (campoObservaciones) {
    const tieneNuevoDestino = selecciones.some(casilla => !casilla.disabled);
    campoObservaciones.hidden = !puedeAgregarObservacionesDestinatario() || !tieneNuevoDestino;
  }
  if (!resumen) return;
  resumen.textContent = selecciones.length
    ? selecciones.map(casilla => abreviarNombreDependencia(casilla.value)).join(', ')
    : 'Seleccionar dependencias destino';
}

function buscarRadicadoPorId(id, coleccion = '') {
  return buscarRegistroRadicado(id, coleccion);
}

function puedeGestionarRegistro(registro) {
  return Boolean(registro) && (
    obtenerColeccionRegistro(registro) === 'radicadosIAS'
      ? puedeGestionarIAS()
      : puedeGestionarRadicado(registro.dependencia)
  );
}

function recargarDatosRegistro(registro) {
  return obtenerColeccionRegistro(registro) === 'radicadosIAS'
    ? recargarDatosIAS()
    : cargarDatosDesdeFirebase();
}

async function existeOtroRadicadoConArchivo(campo, url, id, coleccionActual) {
  const colecciones = ['radicados', 'radicadosIAS'];
  const resultados = await Promise.all(colecciones.map(nombreColeccion => (
    getDocs(query(
      collection(db, nombreColeccion),
      where(campo, '==', url)
    ))
  )));
  const rutaActual = `${coleccionActual}/${id}`;
  return resultados.some(resultado => resultado.docs.some(documento => (
    `${documento.ref.parent.id}/${documento.id}` !== rutaActual
  )));
}

async function existeOtroRadicadoConRespuesta(url, id, coleccionActual) {
  const colecciones = ['radicados', 'radicadosIAS'];
  const resultados = await Promise.all(colecciones.map(async nombreColeccion => {
    const [respuestasAntiguas, respuestasMultiples] = await Promise.all([
      getDocs(query(
        collection(db, nombreColeccion),
        where('respuestaUrl', '==', url)
      )),
      getDocs(query(
        collection(db, nombreColeccion),
        where('respuestaArchivos', 'array-contains', url)
      ))
    ]);
    return [...respuestasAntiguas.docs, ...respuestasMultiples.docs];
  }));
  const rutaActual = `${coleccionActual}/${id}`;
  return resultados.some(documentos => documentos.some(documento => (
    `${documento.ref.parent.id}/${documento.id}` !== rutaActual
  )));
}

function generarIdCopiaCompetencia(idOrigen, dependencia) {
  const slug = dependencia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${idOrigen}__competencia__${slug}`;
}

function generarIdDistribucionAdicional(idOrigen, dependencia) {
  const slug = dependencia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${idOrigen}__distribucion__${slug}`;
}

function crearDatosDistribucionAdicional(radicadoOriginal, dependencia, camposEditados) {
  const datosCopia = { ...radicadoOriginal };
  [
    'dependenciasDestino',
    'dependenciasRecibidas',
    'dependenciasRechazadas',
    'rechazosCompetencia',
    'recepcionesCompetencia',
    'remisionOrigenId',
    'remisionOrigenColeccion',
    'remisionOrigenDependencia',
    'remisionOrigenRadicado',
    'fechaRemisionCompetencia',
    'fechaRecepcionCompetencia',
    'dependenciasAgregadasManualmente'
  ].forEach(campo => delete datosCopia[campo]);

  return {
    ...datosCopia,
    ...camposEditados,
    dependencia,
    ...(Object.prototype.hasOwnProperty.call(datosCopia, 'dependenciaResponsable')
      ? { dependenciaResponsable: dependencia }
      : {}),
    estado: 'VIGENTE',
    funcionarioAsignado: '',
    fechaAsignacion: '',
    fechaCambioEstado: '',
    gestionAsignadaUid: '',
    gestionAsignadaNombre: '',
    gestionAsignadaEn: '',
    gestionAsignadaPresenciaToken: '',
    otrosEstados: '',
    observaciones: '',
    respuestaUrl: '',
    respuestaArchivos: [],
    respuestaSoloEvidencia: false,
    respuestaEnviarAlCiudadano: false,
    fechaCargaRespuesta: '',
    correoRespuestaEstado: '',
    correoRespuestaFecha: '',
    correoRespuestaError: ''
  };
}

function cargarOpcionesRemision(registro) {
  const contenedor = document.getElementById('dependenciasRemisionCompetencia');
  if (!contenedor) return;
  contenedor.replaceChildren();
  contenedor.scrollTop = 0;
  const boton = document.getElementById('alternarDependenciasRemision');
  if (boton) {
    boton.setAttribute('aria-expanded', 'false');
    boton.querySelector('i')?.classList.replace('bi-chevron-up', 'bi-chevron-down');
  }
  contenedor.hidden = true;

  const destinosYaRemitidos = Array.isArray(registro.dependenciasDestino)
    ? registro.dependenciasDestino
    : [];
  Object.keys(datosRadicados)
    .filter(dependencia => dependencia !== registro.dependencia)
    .forEach((dependencia, indice) => {
      const etiqueta = document.createElement('label');
      etiqueta.className = 'dependency-dropdown-option';
      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.name = 'dependenciaDestinoCompetencia';
      casilla.value = dependencia;
      casilla.id = `dependenciaDestinoCompetencia-${indice}`;
      casilla.checked = destinosYaRemitidos.includes(dependencia);
      casilla.disabled = casilla.checked;
      etiqueta.classList.toggle('is-disabled', casilla.disabled);
      etiqueta.htmlFor = casilla.id;
      etiqueta.append(casilla, document.createTextNode(abreviarNombreDependencia(dependencia)));
      contenedor.append(etiqueta);
    });
  actualizarResumenRemision();
}

function cargarOpcionesEdicionRemision(registro) {
  const grupo = document.getElementById('grupoEdicionDependenciasDestino');
  const seleccionadas = document.getElementById('destinosSeleccionadosEdicion');
  const input = document.getElementById('buscarDependenciaDestinoEdicion');
  if (!grupo || !seleccionadas || !input) return;

  const esRadicadoPqrs = obtenerColeccionRegistro(registro) === RADICADOS_COLLECTION;
  grupo.hidden = !esRadicadoPqrs;
  grupo.style.display = esRadicadoPqrs ? '' : 'none';
  seleccionadas.replaceChildren();
  input.value = '';
  input.dataset.dependenciaOrigen = registro.dependencia || '';
  cerrarSugerenciasDependenciasEdicion();
  if (!esRadicadoPqrs) return;

  const destinosYaAgregados = Array.isArray(registro.dependenciasAgregadasManualmente)
    ? registro.dependenciasAgregadasManualmente
    : [];
  destinosYaAgregados.forEach(dependencia => agregarChipDependenciaEdicion(dependencia, true));
}

function agregarChipDependenciaEdicion(dependencia, yaRemitida = false) {
  const seleccionadas = document.getElementById('destinosSeleccionadosEdicion');
  if (!seleccionadas) return;
  const yaAgregada = Array.from(seleccionadas.querySelectorAll('[data-dependencia]'))
    .some(chip => chip.dataset.dependencia === dependencia);
  if (yaAgregada) return;

  const chip = document.createElement('span');
  chip.className = 'edit-destination-chip';
  chip.dataset.dependencia = dependencia;
  chip.setAttribute('role', 'listitem');
  const nombre = document.createElement('span');
  nombre.textContent = dependencia;
  chip.appendChild(nombre);

  if (yaRemitida) {
    chip.classList.add('is-existing');
  } else {
    const valor = document.createElement('input');
    valor.type = 'hidden';
    valor.name = 'dependenciaDestinoEdicion';
    valor.value = dependencia;

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'edit-destination-remove';
    quitar.setAttribute('aria-label', `Quitar ${dependencia}`);
    quitar.textContent = '×';
    quitar.addEventListener('click', () => {
      chip.remove();
      const input = document.getElementById('buscarDependenciaDestinoEdicion');
      input?.focus();
    });

    chip.append(valor, quitar);
  }
  seleccionadas.appendChild(chip);
}

function cerrarSugerenciasDependenciasEdicion() {
  const input = document.getElementById('buscarDependenciaDestinoEdicion');
  const lista = document.getElementById('opcionesDependenciasDestinoEdicion');
  if (!input || !lista) return;
  lista.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

function posicionarSugerenciasDependenciasEdicion() {
  const input = document.getElementById('buscarDependenciaDestinoEdicion');
  const lista = document.getElementById('opcionesDependenciasDestinoEdicion');
  if (!input || !lista || lista.hidden) return;
  const rectangulo = input.getBoundingClientRect();
  lista.style.left = `${Math.max(8, Math.min(rectangulo.left, window.innerWidth - rectangulo.width - 8))}px`;
  lista.style.top = `${rectangulo.bottom + 6}px`;
  lista.style.width = `${Math.min(rectangulo.width, window.innerWidth - 16)}px`;
  lista.style.maxHeight = '180px';
}

function filtrarSugerenciasDependenciasEdicion() {
  const input = document.getElementById('buscarDependenciaDestinoEdicion');
  const lista = document.getElementById('opcionesDependenciasDestinoEdicion');
  const seleccionadas = document.getElementById('destinosSeleccionadosEdicion');
  if (!input || !lista || !seleccionadas) return;

  const consulta = normalizarTextoBusqueda(input.value);
  const actuales = new Set(Array.from(
    seleccionadas.querySelectorAll('[data-dependencia]')
  ).map(chip => chip.dataset.dependencia));
  const coincidencias = consulta
    ? Object.keys(datosRadicados).filter(dependencia => (
      dependencia !== input.dataset.dependenciaOrigen
      && !actuales.has(dependencia)
      && normalizarTextoBusqueda(dependencia).includes(consulta)
    ))
    : [];

  lista.replaceChildren(...coincidencias.map((dependencia, indice) => {
    const opcion = document.createElement('button');
    opcion.type = 'button';
    opcion.id = `${lista.id}-opcion-${indice}`;
    opcion.className = 'custom-select-option';
    opcion.setAttribute('role', 'option');
    opcion.setAttribute('aria-selected', 'false');
    opcion.textContent = dependencia;
    opcion.addEventListener('click', () => {
      agregarChipDependenciaEdicion(dependencia);
      input.value = '';
      cerrarSugerenciasDependenciasEdicion();
      input.focus();
    });
    return opcion;
  }));

  const mostrar = consulta.length > 0 && coincidencias.length > 0;
  lista.hidden = !mostrar;
  input.setAttribute('aria-expanded', String(mostrar));
  input.removeAttribute('aria-activedescendant');
  if (mostrar) posicionarSugerenciasDependenciasEdicion();
}

function inicializarBuscadorDependenciasEdicion() {
  const input = document.getElementById('buscarDependenciaDestinoEdicion');
  const lista = document.getElementById('opcionesDependenciasDestinoEdicion');
  if (!input || !lista) return;

  input.addEventListener('input', filtrarSugerenciasDependenciasEdicion);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      cerrarSugerenciasDependenciasEdicion();
    } else if (event.key === 'ArrowDown' && !lista.hidden) {
      event.preventDefault();
      lista.querySelector('button')?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!lista.hidden) lista.querySelector('button')?.click();
    }
  });
  lista.addEventListener('keydown', event => {
    const opciones = Array.from(lista.querySelectorAll('button'));
    const indice = opciones.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      cerrarSugerenciasDependenciasEdicion();
      input.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direccion = event.key === 'ArrowDown' ? 1 : -1;
      opciones[(indice + direccion + opciones.length) % opciones.length]?.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!input.contains(event.target) && !lista.contains(event.target)) {
      cerrarSugerenciasDependenciasEdicion();
    }
  });
  window.addEventListener('resize', posicionarSugerenciasDependenciasEdicion);
}

function actualizarEstadoFuncionarioPreview(event) {
  const preview = document.getElementById('estadoFuncionarioPreview');
  if (preview) {
    preview.textContent = event.currentTarget.value.trim()
      ? 'Al guardar, el radicado quedará En Trámite y se habilitarán las acciones cuando también tenga tipo de petición.'
      : 'Escribe el nombre del funcionario para asignarlo al radicado.';
  }
}

const FUNCIONARIOS_POR_DEPENDENCIA = {
  'Secretaría de Gobierno': [
    'Juan Ramos',
    'Jenesis Acevedo',
    'Alvaro Castro',
    'Angie Martinez',
    'Maricela Martinez',
    'Katherine Rodriguez',
    'Jhonatan Montero'
  ],
  'Secretaría de Hacienda': [
    'Jhon Torres',
    'Angelica Esalas',
    'Camila Feria'
  ],
  'Secretaría de Educación': [
    'Sonia Márquez'
  ],
  'Oficina Juridica': [
    'Marco Tovar',
    'Maria J. Santiago',
    'Santiago Herrera',
    'Daniela Marin',
    'Rosa Espitia',
    'Armando Del Villar',
    'Julian Gonzalez',
    'Yoice Castro',
    'Delanis Salas'
  ],
  'Secretaría de Umata': [
    'Yeraldin Blanco Bossio'
  ],
  'Secretaría de Planeación': [
    'Juan Castilla',
    'Oscar Torres',
    'Juan Ortiz',
    'Jennifer Villarreal',
    'María A. Santos',
    'Danilsa Acevedo',
    'Heiner Perez',
    'Luis Tinoco',
    'Diego Tinoco',
    'Matthews Guardo'
  ],
  'Secretaría de Salud': [
    'Carmen Carreño',
    'Arleidis Teran',
    'Angela Avila',
    'Amelis Castilla',
    'Alida Garizao',
    'Vianeys Ortega',
    'Angie Mendivil',
    'Adriana Pinedo'
  ],
  'Despacho del Alcalde': [
    'Kelly Garcia',
    'Maria Davila'
  ],
  'Oficina de Gestion del Riesgo y Desastres': [
    'Juan Tijera',
    'Catherine Esalas'
  ]
};
let funcionarioAsignadoSeleccionado = '';
let nombresFuncionariosActivos = [];

function normalizarTextoBusqueda(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .trim();
}

function obtenerNombresFuncionarios(radicado) {
  if (!radicado) return [];
  const dependenciaNormalizada = normalizarTextoBusqueda(radicado.dependencia);
  const coincidencia = Object.keys(FUNCIONARIOS_POR_DEPENDENCIA).find(dependencia =>
    normalizarTextoBusqueda(dependencia) === dependenciaNormalizada
  );
  return coincidencia ? FUNCIONARIOS_POR_DEPENDENCIA[coincidencia] : [];
}

function cerrarSugerenciasFuncionarios() {
  const input = document.getElementById('txtFuncionarioAsignado');
  const lista = document.getElementById('opcionesFuncionariosAsignados');
  if (!input || !lista) return;
  lista.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

function filtrarSugerenciasFuncionarios() {
  const input = document.getElementById('txtFuncionarioAsignado');
  const lista = document.getElementById('opcionesFuncionariosAsignados');
  if (!input || !lista) return;

  const consulta = normalizarTextoBusqueda(input.value);
  const coincidencias = consulta
    ? nombresFuncionariosActivos.filter(nombre => normalizarTextoBusqueda(nombre).includes(consulta))
    : [];
  lista.replaceChildren(...coincidencias.map((nombre, indice) => {
    const opcion = document.createElement('button');
    opcion.type = 'button';
    opcion.id = `${lista.id}-opcion-${indice}`;
    opcion.className = 'custom-select-option';
    opcion.setAttribute('role', 'option');
    opcion.setAttribute('aria-selected', 'false');
    opcion.textContent = nombre;
    opcion.addEventListener('click', () => {
      input.value = nombre;
      funcionarioAsignadoSeleccionado = nombre;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      cerrarSugerenciasFuncionarios();
      input.focus();
    });
    return opcion;
  }));

  const mostrar = consulta.length > 0 && coincidencias.length > 0;
  lista.hidden = !mostrar;
  input.setAttribute('aria-expanded', String(mostrar));
  input.removeAttribute('aria-activedescendant');
  if (mostrar) {
    const rectangulo = input.getBoundingClientRect();
    lista.style.left = `${Math.max(8, Math.min(rectangulo.left, window.innerWidth - rectangulo.width - 8))}px`;
    lista.style.top = `${rectangulo.bottom + 6}px`;
    lista.style.width = `${Math.min(rectangulo.width, window.innerWidth - 16)}px`;
    lista.style.maxHeight = '180px';
  }
}

function inicializarBuscadorFuncionarios() {
  const input = document.getElementById('txtFuncionarioAsignado');
  const lista = document.getElementById('opcionesFuncionariosAsignados');
  if (!input || !lista) return;

  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      cerrarSugerenciasFuncionarios();
    } else if (event.key === 'ArrowDown' && !lista.hidden) {
      event.preventDefault();
      lista.querySelector('button')?.focus();
    }
  });
  lista.addEventListener('keydown', event => {
    const opciones = Array.from(lista.querySelectorAll('button'));
    const indice = opciones.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      cerrarSugerenciasFuncionarios();
      input.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direccion = event.key === 'ArrowDown' ? 1 : -1;
      opciones[(indice + direccion + opciones.length) % opciones.length]?.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!input.contains(event.target) && !lista.contains(event.target)) {
      cerrarSugerenciasFuncionarios();
    }
  });
  window.addEventListener('resize', () => {
    if (!lista.hidden) filtrarSugerenciasFuncionarios();
  });
}

async function guardarFuncionarioAsignado(event) {
  event.preventDefault();

  const id = document.getElementById('funcionarioAsignadoDocId').value;
  const coleccion = document.getElementById('funcionarioAsignadoDocId').dataset.collection || '';
  const radicado = buscarRadicadoPorId(id, coleccion);
  if (!radicado) {
    alert('No se encontró el radicado para asignar el funcionario.');
    return;
  }
  if (!puedeGestionarRegistro(radicado)) {
    alert('No tienes permiso para asignar funcionarios a este radicado.');
    return;
  }

  const inputFuncionario = document.getElementById('txtFuncionarioAsignado');
  const funcionarioAsignado = inputFuncionario.value.trim();
  if (
    !nombresFuncionariosActivos.includes(funcionarioAsignado)
    || funcionarioAsignado !== funcionarioAsignadoSeleccionado
  ) {
    alert('Escribe y selecciona un funcionario de la lista antes de guardar.');
    inputFuncionario.focus();
    filtrarSugerenciasFuncionarios();
    return;
  }

  const boton = document.getElementById('btnGuardarFuncionarioAsignado');
  const spinner = document.getElementById('spinnerGuardarFuncionario');
  const texto = document.getElementById('textoGuardarFuncionario');
  if (boton?.disabled) return;

  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando...';

  const estado = radicado.estado === 'R. por C.'
    ? 'R. por C.'
    : funcionarioAsignado ? 'EN TRAMITE' : 'VIGENTE';
  const actualizacionFuncionario = { funcionarioAsignado, estado };
  if (
    funcionarioAsignado
    && (
      funcionarioAsignado !== String(radicado.funcionarioAsignado || '').trim()
      || !radicado.fechaAsignacion
    )
  ) {
    actualizacionFuncionario.fechaAsignacion = obtenerFechaActualBogota();
  }
  if (estado !== radicado.estado) {
    actualizacionFuncionario.fechaCambioEstado = obtenerFechaActualBogota();
  }
  if (obtenerColeccionRegistro(radicado) === 'radicadosIAS' && funcionarioAsignado) {
    actualizacionFuncionario.fechaEntregaManual = obtenerFechaActualBogota();
  }

  try {
    await updateDoc(doc(db, obtenerColeccionRegistro(radicado), id), actualizacionFuncionario);
    await actualizarConsultaPublicaSiAplica(id, obtenerColeccionRegistro(radicado));
    const radicadoEnCache = datosRadicados[radicado.dependencia]
      ?.find(item => item.id === id);
    if (radicadoEnCache) {
      radicadoEnCache.funcionarioAsignado = funcionarioAsignado;
      radicadoEnCache.estado = estado;
      if (actualizacionFuncionario.fechaAsignacion) {
        radicadoEnCache.fechaAsignacion = actualizacionFuncionario.fechaAsignacion;
      }
      if (actualizacionFuncionario.fechaCambioEstado) {
        radicadoEnCache.fechaCambioEstado = actualizacionFuncionario.fechaCambioEstado;
      }
    }
    const fila = Array.from(
      document.querySelectorAll('#cuerpoTablaExclusiva tr[data-radicado-id], #cuerpoTablaIAS tr[data-radicado-id]')
    ).find(elemento => (
      elemento.dataset.radicadoId === id
      && elemento.dataset.collection === obtenerColeccionRegistro(radicado)
    ));
    if (fila) {
      fila.dataset.hasAssignedOfficial = String(Boolean(funcionarioAsignado));
      const nombreFuncionario = fila.querySelector('.assigned-official-name');
      if (nombreFuncionario) {
        const partesFuncionario = funcionarioAsignado.trim().split(/\s+/).filter(Boolean);
        nombreFuncionario.textContent = partesFuncionario.length > 1
          ? `${partesFuncionario[0]}\n${partesFuncionario.slice(1).join(' ')}`
          : funcionarioAsignado;
      }
      const botonFuncionario = fila.querySelector('.assigned-official-button');
      if (funcionarioAsignado) {
        botonFuncionario?.remove();
      }
      actualizarDisponibilidadAccionesRadicado(fila);
    }

    cerrarModalFuncionarioAsignado();
    await recargarDatosRegistro(radicado);
    alert('Funcionario asignado correctamente.');
  } catch (error) {
    console.error('Error al asignar el funcionario:', error);
    alert(`No fue posible asignar el funcionario: ${error.message}`);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = 'Guardar';
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
  }
}

window.recibirRadicadoCompetencia = async function(id, coleccion = '') {
  const radicado = buscarRadicadoPorId(id, coleccion);
  if (!radicado?.remisionOrigenId) {
    alert('Este radicado no fue remitido por competencia.');
    return;
  }
  if (!puedeGestionarRegistro(radicado)) {
    alert('No tienes permiso para recibir este radicado.');
    return;
  }
  if (radicado.fechaRecepcionCompetencia) {
    alert(`Este radicado ya fue recibido el ${radicado.fechaRecepcionCompetencia}.`);
    return;
  }

  const fechaRecepcion = obtenerFechaActualBogota();
  const fechaHoraRecepcion = new Date().toISOString();
  try {
    const recibido = await runTransaction(db, async transaction => {
      const docRef = doc(db, obtenerColeccionRegistro(radicado), id);
      const coleccionOrigen = radicado.remisionOrigenColeccion || RADICADOS_COLLECTION;
      const origenRef = doc(db, coleccionOrigen, radicado.remisionOrigenId);
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists()) throw new Error('No se encontró el radicado remitido.');

      const datosRadicado = snapshot.data();
      if (!datosRadicado.remisionOrigenId) {
        throw new Error('El radicado ya no está identificado como una remisión por competencia.');
      }
      if (datosRadicado.fechaRecepcionCompetencia) return false;
      if (datosRadicado.remisionOrigenId !== radicado.remisionOrigenId) {
        throw new Error('La copia no corresponde al oficio de origen esperado.');
      }

      transaction.update(docRef, {
        fechaEntregaManual: fechaRecepcion,
        fechaRecepcionCompetencia: fechaRecepcion
      });
      transaction.update(origenRef, {
        dependenciasRecibidas: arrayUnion(datosRadicado.dependencia),
        recepcionesCompetencia: arrayUnion({
          dependencia: datosRadicado.dependencia,
          fechaRecepcion,
          fechaHoraRecepcion
        }),
        estado: 'R. por C.'
      });
      return true;
    });

    if (!recibido) {
      alert('Este radicado ya fue recibido por la dependencia.');
      await recargarDatosRegistro(radicado);
      return;
    }

    await actualizarConsultaPublicaSiAplica(
      radicado.remisionOrigenId,
      radicado.remisionOrigenColeccion || RADICADOS_COLLECTION
    );
    await recargarDatosRegistro(radicado);
    await informarResultadoNotificacionCorreo('recibida', {
      id: radicado.remisionOrigenId,
      dependencia: radicado.dependencia
    });
    alert(`Radicado recibido. La fecha de entrega se actualizó al ${fechaRecepcion}.`);
  } catch (error) {
    console.error('Error al recibir el radicado por competencia:', error);
    alert(`No fue posible recibir el radicado: ${error.message}`);
  }
};

window.rechazarRadicadoCompetencia = async function(id, coleccion = '') {
  const radicado = buscarRadicadoPorId(id, coleccion);
  if (!radicado?.remisionOrigenId) {
    alert('Este radicado no fue remitido por competencia.');
    return;
  }
  if (!puedeGestionarRegistro(radicado)) {
    alert('No tienes permiso para rechazar este radicado.');
    return;
  }
  if (radicado.fechaRecepcionCompetencia) {
    alert('No se puede rechazar un radicado que ya fue recibido.');
    return;
  }

  const confirmado = await confirmarAccion(
    `Se eliminará únicamente la copia de ${abreviarNombreDependencia(radicado.dependencia)} y se registrará el rechazo en la dependencia de origen. Las demás dependencias no se modificarán.`,
    { titulo: 'Rechazar remisión por competencia', aceptarTexto: 'Rechazar' }
  );
  if (!confirmado) return;

  try {
    const copiaRef = doc(db, RADICADOS_COLLECTION, id);
    const coleccionOrigen = radicado.remisionOrigenColeccion || RADICADOS_COLLECTION;
    const origenRef = doc(db, coleccionOrigen, radicado.remisionOrigenId);
    const fechaRechazo = obtenerFechaActualBogota();
    const fechaHoraRechazo = new Date().toISOString();
    await runTransaction(db, async transaction => {
      const copiaSnapshot = await transaction.get(copiaRef);
      if (!copiaSnapshot.exists()) throw new Error('La copia remitida ya no existe.');

      const copia = copiaSnapshot.data();
      if (copia.remisionOrigenId !== radicado.remisionOrigenId) {
        throw new Error('La copia no corresponde al oficio de origen esperado.');
      }
      if (copia.fechaRecepcionCompetencia) {
        throw new Error('No se puede rechazar un radicado que ya fue recibido.');
      }

      transaction.update(origenRef, {
        dependenciasRechazadas: arrayUnion(radicado.dependencia),
        rechazosCompetencia: arrayUnion({
          dependencia: radicado.dependencia,
          fechaRechazo,
          fechaHoraRechazo
        })
      });
      transaction.delete(copiaRef);
    });

    await recargarDatosRegistro(radicado);
    await actualizarConsultaPublicaSiAplica(
      radicado.remisionOrigenId,
      radicado.remisionOrigenColeccion || RADICADOS_COLLECTION
    );
    await informarResultadoNotificacionCorreo('rechazo', {
      id: radicado.remisionOrigenId,
      dependencia: radicado.dependencia
    });
    alert('Se rechazó la remisión. Las demás dependencias conservan sus copias pendientes.');
  } catch (error) {
    console.error('Error al rechazar el radicado por competencia:', error);
    alert(`No fue posible rechazar el radicado: ${error.message}`);
  }
};

window.eliminarRadicado = async function(id, elementoClick) {
  if (!esAdministrador()) {
    alert('Solo el administrador puede eliminar radicados.');
    return;
  }
  const confirmado = await confirmarAccion(
    '¿Estás seguro de que deseas eliminar este radicado y sus archivos?',
    { titulo: 'Eliminar radicado', aceptarTexto: 'Eliminar' }
  );
  if (!confirmado) {
    return;
  }

  const botonEliminar = elementoClick ? (elementoClick.closest('button') || elementoClick) : null;
  const coleccion = botonEliminar?.closest('tr')?.dataset.collection || '';
  const radicadoAEliminar = buscarRadicadoPorId(id, coleccion);
  if (!radicadoAEliminar) {
    alert('No se encontró el radicado que deseas eliminar.');
    return;
  }

  if (botonEliminar) {
    botonEliminar.disabled = true;
    botonEliminar.classList.add('btn-loading-active');
    botonEliminar.innerHTML = '<span class="action-delete-spinner"></span>';
    botonEliminar.title = "Eliminando...";
  }

  try {
    const coleccionActual = obtenerColeccionRegistro(radicadoAEliminar);
    const archivosRelacionados = Boolean(
      radicadoAEliminar
      && (
        radicadoAEliminar.remisionOrigenId
        || radicadoAEliminar.dependenciasDestino?.length
      )
    );
    const archivosRespuesta = [...new Set([
      radicadoAEliminar?.respuestaUrl,
      ...(Array.isArray(radicadoAEliminar?.respuestaArchivos)
        ? radicadoAEliminar.respuestaArchivos
        : [])
    ].filter(url => typeof url === 'string' && url.trim()))];
    const [pdfCompartido, respuestasCompartidas] = archivosRelacionados
      ? [false, []]
      : await Promise.all([
          radicadoAEliminar?.pdfUrl
            ? existeOtroRadicadoConArchivo('pdfUrl', radicadoAEliminar.pdfUrl, id, coleccionActual)
            : false,
          Promise.all(archivosRespuesta.map(url => (
            existeOtroRadicadoConRespuesta(url, id, coleccionActual)
          )))
        ]);
    if (!archivosRelacionados && !pdfCompartido && radicadoAEliminar?.pdfUrl) {
      try {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "delete",
            pdfUrl: radicadoAEliminar.pdfUrl
          })
        });
      } catch (driveErr) {
        console.warn("No se pudo eliminar de Drive:", driveErr);
      }
    }

    if (!archivosRelacionados) {
      for (const [indice, url] of archivosRespuesta.entries()) {
        if (respuestasCompartidas[indice]) continue;
        try {
          await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
              action: "delete",
              pdfUrl: url
            })
          });
        } catch (driveErr) {
          console.warn("No se pudo eliminar un archivo de respuesta de Drive:", driveErr);
        }
      }
    }

    await deleteDoc(doc(db, obtenerColeccionRegistro(radicadoAEliminar), id));
    if (
      coleccionActual === RADICADOS_COLLECTION
      && radicadoAEliminar.radicado === id
    ) {
      await eliminarConsultaPublicaRadicado(id);
    }
    await recargarDatosRegistro(radicadoAEliminar);
    alert("El radicado y sus archivos se eliminaron correctamente.");

  } catch (error) {
    console.error("Error al eliminar:", error);
    if (botonEliminar?.isConnected) {
      botonEliminar.disabled = false;
      botonEliminar.classList.remove('btn-loading-active');
      botonEliminar.textContent = "🗑️";
      botonEliminar.title = "Eliminar";
    }
    alert("No se pudo eliminar el radicado: " + error.message);
  }
};

window.prepararEdicion = function(id, coleccion = '') {
  const item = buscarRadicadoPorId(id, coleccion);
  if (!puedeEditarRadicado(item)) return;

  if (item) {
    if (document.getElementById('editDocId')) {
      document.getElementById('editDocId').value = item.id;
      document.getElementById('editDocId').dataset.collection = obtenerColeccionRegistro(item);
    }
    if (document.getElementById('editRadicado')) document.getElementById('editRadicado').value = item.radicado;
    if (document.getElementById('editFechaRadicacion')) document.getElementById('editFechaRadicacion').value = item.fechaRadicacion;
    if (document.getElementById('editFechaEntregaManual')) {
      document.getElementById('editFechaEntregaManual').value =
        item.fechaEntregaManual || (item.coleccion === 'radicadosIAS' ? item.fechaVencimiento : '');
    }
    if (document.getElementById('editDiasHabiles')) document.getElementById('editDiasHabiles').value = item.diasHabiles;
    if (document.getElementById('editFechaEntrega')) document.getElementById('editFechaEntrega').value = item.fechaVencimiento;
    if (document.getElementById('editRemitente')) document.getElementById('editRemitente').value = item.remitente;
    if (document.getElementById('editAsunto')) document.getElementById('editAsunto').value = item.asunto;
    const esRadicadoPqrs = obtenerColeccionRegistro(item) === RADICADOS_COLLECTION;
    [
      ['grupoEdicionFolios', 'editFolios', item.folios, 1],
      ['grupoEdicionAnexos', 'editAnexos', item.anexos, 0]
    ].forEach(([grupoId, campoId, valor, minimo]) => {
      const grupo = document.getElementById(grupoId);
      const campo = document.getElementById(campoId);
      if (grupo) {
        grupo.hidden = !esRadicadoPqrs;
        grupo.style.display = esRadicadoPqrs ? '' : 'none';
      }
      if (campo) {
        campo.value = valor ?? '';
        campo.required = esRadicadoPqrs;
        campo.min = String(minimo);
        campo.step = '1';
      }
    });
    cargarOpcionesEdicionRemision(item);

    document.getElementById('modalEditar').style.display = 'flex';
  }
};

window.cerrarModalEditar = function() {
  document.getElementById('modalEditar').style.display = 'none';
};

window.abrirModalProrrogaRadicado = function(id, coleccion = '') {
  const radicado = buscarRadicadoPorId(id, coleccion);
  if (!radicado) return;
  if (obtenerPerfilSesion()?.rol !== 'administrador') return;
  document.getElementById('prorrogaRadicadoId').value = id;
  document.getElementById('prorrogaRadicadoColeccion').value = obtenerColeccionRegistro(radicado);
  document.getElementById('prorrogaDias').value = '';
  document.getElementById('prorrogaNuevaFecha').value = radicado.fechaVencimiento || '';
  document.getElementById('prorrogaNuevaFecha').dataset.iso = radicado.fechaVencimiento || '';
  document.getElementById('prorrogaArchivo').value = '';
  document.getElementById('textoProrrogaRadicado').textContent =
    `Radicado ${radicado.radicado || ''}. Fecha vigente: ${radicado.fechaVencimiento || 'sin definir'}.`;
  document.getElementById('modalProrrogaRadicado').style.display = 'flex';
};

window.cerrarModalProrrogaRadicado = function() {
  document.getElementById('modalProrrogaRadicado').style.display = 'none';
};

function actualizarFechaProrroga() {
  const id = document.getElementById('prorrogaRadicadoId').value;
  const coleccion = document.getElementById('prorrogaRadicadoColeccion').value;
  const radicado = buscarRadicadoPorId(id, coleccion);
  const dias = Number(document.getElementById('prorrogaDias').value);
  const campoFecha = document.getElementById('prorrogaNuevaFecha');
  if (!radicado || !Number.isInteger(dias) || dias < 1) {
    campoFecha.value = radicado?.fechaVencimiento || '';
    return;
  }
  const fechaCalculada = sumarDiasHabilesColombia(radicado.fechaVencimiento, dias);
  campoFecha.value = fechaCalculada
    ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(`${fechaCalculada}T12:00:00`))
    : radicado.fechaVencimiento || '';
  campoFecha.dataset.iso = fechaCalculada;
}

async function guardarProrrogaRadicado(event) {
  event.preventDefault();
  const id = document.getElementById('prorrogaRadicadoId').value;
  const coleccion = document.getElementById('prorrogaRadicadoColeccion').value;
  const radicado = buscarRadicadoPorId(id, coleccion);
  const dias = Number(document.getElementById('prorrogaDias').value);
  const nuevaFecha = document.getElementById('prorrogaNuevaFecha').dataset.iso
    || sumarDiasHabilesColombia(radicado?.fechaVencimiento || '', dias);
  const archivo = document.getElementById('prorrogaArchivo').files?.[0];
  if (!radicado || !Number.isInteger(dias) || dias < 1 || !nuevaFecha || !archivo) {
    alert('Debes indicar los días hábiles adicionales y cargar el oficio de prórroga.');
    return;
  }
  if (archivo.size > 30 * 1024 * 1024) {
    alert('El oficio de prórroga no puede superar 30 MB.');
    return;
  }
  const encabezadoPdf = new TextDecoder().decode(await archivo.slice(0, 5).arrayBuffer());
  if (!archivo.name.toLocaleLowerCase('es-CO').endsWith('.pdf') || encabezadoPdf !== '%PDF-') {
    alert('El oficio de prórroga debe ser un archivo PDF válido.');
    return;
  }
  if (nuevaFecha <= (radicado.fechaVencimiento || '')) {
    alert('La nueva fecha de vencimiento debe ser posterior a la fecha vigente.');
    return;
  }
  const boton = document.getElementById('guardarProrrogaRadicado');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    const base64 = await convertirABase64(archivo);
    const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        archivoBase64: base64.split(',')[1] || '',
        nombreArchivo: `Prorroga_${radicado.radicado || id}_${archivo.name}`,
        mimeType: 'application/pdf'
      })
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok || resultado.status !== 'success' || !resultado.url) {
      throw new Error(resultado.message || 'No fue posible cargar el oficio en Google Drive.');
    }
    const instante = new Date().toISOString();
    await updateDoc(doc(db, obtenerColeccionRegistro(radicado), id), {
      fechaVencimiento: nuevaFecha,
      fechaEntrega: nuevaFecha,
      prorroga: {
        fechaAnterior: radicado.fechaVencimiento || '',
        nuevaFecha,
        diasHabilesAdicionales: dias,
        archivoNombre: archivo.name,
        archivoUrl: resultado.url,
        registradoEn: instante
      },
      actualizadoEn: instante
    });
    await actualizarConsultaPublicaSiAplica(id, obtenerColeccionRegistro(radicado));
    radicado.fechaVencimiento = nuevaFecha;
    radicado.fechaEntrega = nuevaFecha;
    radicado.prorroga = {
      fechaAnterior: radicado.prorroga?.fechaAnterior || '',
      nuevaFecha,
      diasHabilesAdicionales: dias,
      archivoNombre: archivo.name,
      archivoUrl: resultado.url,
      registradoEn: instante
    };
    window.cerrarModalProrrogaRadicado();
    alert('Prórroga registrada y fecha de vencimiento actualizada.');
    await recargarDatosRegistro(radicado);
  } catch (error) {
    console.error('Error al registrar la prórroga:', error);
    alert(`No se pudo registrar la prórroga: ${error.message}`);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar prórroga';
  }
}

async function guardarEdicionRadicado(e) {
  e.preventDefault();
  const id = document.getElementById('editDocId').value;
  const coleccionSolicitada = document.getElementById('editDocId').dataset.collection || '';
  const radicado = buscarRadicadoPorId(id, coleccionSolicitada);
  if (!puedeEditarRadicado(radicado)) {
    alert('No tienes permiso para editar este radicado.');
    return;
  }
  if (!radicado) return;
  const boton = document.getElementById('btnGuardarEditar');
  const spinner = document.getElementById('spinnerGuardarEdicion');
  const texto = document.getElementById('textoGuardarEdicion');
  if (boton?.disabled) return;

  const coleccion = obtenerColeccionRegistro(radicado);
  const destinosSeleccionados = coleccion === RADICADOS_COLLECTION
    ? Array.from(document.querySelectorAll(
      '#destinosSeleccionadosEdicion input[name="dependenciaDestinoEdicion"]'
    )).map(casilla => casilla.value)
    : [];

  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando...';

  try {
    const docRef = doc(db, coleccion, id);
    const normalizarTextoPQRSF = coleccion === RADICADOS_COLLECTION
      ? formatearMayusculasIniciales
      : valor => valor;
    const fechaVencimiento = document.getElementById('editFechaEntrega').value;
    const camposEditados = {
      radicado: document.getElementById('editRadicado').value,
      fechaRadicacion: document.getElementById('editFechaRadicacion').value,
      fechaEntregaManual: document.getElementById('editFechaEntregaManual')?.value || '',
      diasHabiles: document.getElementById('editDiasHabiles').value,
      fechaVencimiento,
      fechaEntrega: fechaVencimiento,
      remitente: normalizarTextoPQRSF(document.getElementById('editRemitente').value),
      asunto: normalizarTextoPQRSF(document.getElementById('editAsunto').value),
      ...(obtenerColeccionRegistro(radicado) === RADICADOS_COLLECTION ? {
        folios: Number(document.getElementById('editFolios').value),
        anexos: Number(document.getElementById('editAnexos').value)
      } : {})
    };

    let idsDistribucionCreados = [];
    if (destinosSeleccionados.length) {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists()) throw new Error('No se encontró el radicado para agregar la dependencia.');
        const radicadoOriginal = snapshot.data();
        const destinosPrevios = Array.isArray(radicadoOriginal.dependenciasAgregadasManualmente)
          ? radicadoOriginal.dependenciasAgregadasManualmente
          : [];
        const destinosAAgregar = destinosSeleccionados.filter(
          dependencia => !destinosPrevios.includes(dependencia)
        );
        const copias = destinosAAgregar.map(dependencia => ({
          dependencia,
          referencia: doc(
            db, RADICADOS_COLLECTION, generarIdDistribucionAdicional(id, dependencia)
          )
        }));
        const copiasExistentes = await Promise.all(
          copias.map(copia => transaction.get(copia.referencia))
        );
        idsDistribucionCreados = [];
        copias.forEach((copia, indice) => {
          if (copiasExistentes[indice].exists()) return;
          transaction.set(
            copia.referencia,
            crearDatosDistribucionAdicional(radicadoOriginal, copia.dependencia, camposEditados)
          );
          idsDistribucionCreados.push(copia.referencia.id);
        });
        transaction.update(docRef, {
          ...camposEditados,
          dependenciasAgregadasManualmente: [...new Set([
            ...destinosPrevios,
            ...destinosAAgregar
          ])]
        });
      });
      if (idsDistribucionCreados.length) {
        await informarResultadoNotificacionCorreo('nueva-solicitud', {
          ids: idsDistribucionCreados
        });
      }
    } else {
      await updateDoc(docRef, camposEditados);
    }

    await actualizarConsultaPublicaSiAplica(id, coleccion);

    alert(idsDistribucionCreados.length
      ? `Radicado actualizado y enviado a ${idsDistribucionCreados.length === 1 ? 'la dependencia agregada' : 'las dependencias agregadas'}.`
      : 'Radicado actualizado correctamente.');
    cerrarModalEditar();
    await recargarDatosRegistro(radicado);
  } catch (error) {
    console.error("Error al actualizar:", error);
    alert("Ocurrió un error al actualizar los datos.");
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = 'Guardar Cambios';
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
  }
}

window.abrirModalFuncionarioAsignado = function(id, coleccion = '') {
  const item = buscarRadicadoPorId(id, coleccion);
  if (!item) {
    alert('No se encontró el radicado para asignar el funcionario.');
    return;
  }
  if (!puedeGestionarRegistro(item)) {
    alert('No tienes permiso para asignar funcionarios a este radicado.');
    return;
  }

  document.getElementById('funcionarioAsignadoDocId').value = item.id;
  document.getElementById('funcionarioAsignadoDocId').dataset.collection = obtenerColeccionRegistro(item);
  nombresFuncionariosActivos = obtenerNombresFuncionarios(item);
  const input = document.getElementById('txtFuncionarioAsignado');
  input.value = nombresFuncionariosActivos.includes(item.funcionarioAsignado)
    ? item.funcionarioAsignado
    : '';
  funcionarioAsignadoSeleccionado = input.value;
  cerrarSugerenciasFuncionarios();
  actualizarEstadoFuncionarioPreview({ currentTarget: input });
  document.getElementById('modalFuncionarioAsignado').style.display = 'flex';
  input.focus();
};

window.cerrarModalFuncionarioAsignado = function() {
  document.getElementById('modalFuncionarioAsignado').style.display = 'none';
};

// ==========================================
// FUNCIONES GLOBALES PARA EL MODAL DE OTROS ESTADOS
// ==========================================

window.abrirModalOtrosEstados = function(id, coleccion = '') {
  const item = buscarRadicadoPorId(id, coleccion);
  if (!puedeGestionarRegistro(item)) return;

  if (item) {
    if (!item.funcionarioAsignado?.trim()) {
      alert('Asigna un funcionario antes de gestionar otros estados.');
      return;
    }
    if (!TIPOS_PETICION.includes(item.tipoPeticion)) {
      alert('Selecciona el tipo de petición antes de gestionar otros estados.');
      return;
    }
    document.getElementById('modalEstadoDocId').value = item.id;
    document.getElementById('modalEstadoDocId').dataset.collection = obtenerColeccionRegistro(item);
    document.getElementById('selectOtrosEstados').value = item.otrosEstados || ''; // <--- Corregido a selectOtrosEstados
    document.getElementById('txtObservaciones').value = item.observaciones || '';
    document.getElementById('txtObservacionesRemision').value = '';
    cargarOpcionesRemision(item);
    const seccionRemision = document.getElementById('alternarDependenciasRemision')?.closest('section');
    if (seccionRemision) {
      seccionRemision.hidden = obtenerColeccionRegistro(item) === 'radicadosIAS' && !esAdministrador();
    }
    document.getElementById('modalOtrosEstados').style.display = 'flex';
  }
};

window.cerrarModalOtrosEstados = function() {
  document.getElementById('modalOtrosEstados').style.display = 'none';
};

window.remitirPorCompetencia = async function() {
  if (document.getElementById('btnRemitirPorCompetencia')?.disabled) return;
  await window.guardarOtrosEstados();
};

window.guardarOtrosEstados = async function() {
  const id = document.getElementById('modalEstadoDocId').value;
  const coleccion = document.getElementById('modalEstadoDocId').dataset.collection || '';
  const radicado = buscarRadicadoPorId(id, coleccion);
  if (!puedeGestionarRegistro(radicado)) {
    alert('No tienes permiso para gestionar este radicado.');
    return;
  }
  if (!radicado?.funcionarioAsignado?.trim()) {
    alert('Asigna un funcionario antes de gestionar otros estados.');
    return;
  }
  if (!TIPOS_PETICION.includes(radicado?.tipoPeticion)) {
    alert('Selecciona el tipo de petición antes de guardar otros estados.');
    return;
  }
  const destinosSeleccionados = Array.from(
    document.querySelectorAll('input[name="dependenciaDestinoCompetencia"]:checked:not(:disabled)')
  ).map(casilla => casilla.value);
  if (
    destinosSeleccionados.length
    && obtenerColeccionRegistro(radicado) === 'radicadosIAS'
    && !esAdministrador()
  ) {
    alert('Solo el administrador puede remitir radicados IAS por competencia.');
    return;
  }

  const otrosEstados = document.getElementById('selectOtrosEstados').value;
  const observaciones = document.getElementById('txtObservaciones').value;
  const observacionesDestinatario = destinosSeleccionados.length
    && puedeAgregarObservacionesDestinatario()
    ? document.getElementById('txtObservacionesRemision').value.trim()
    : '';
  if (observacionesDestinatario.length > 4000) {
    alert('Las observaciones para la dependencia destinataria no pueden superar 4000 caracteres.');
    return;
  }

  const boton = document.getElementById('btnGuardarOtrosEstados');
  const botonRemitir = document.getElementById('btnRemitirPorCompetencia');
  const spinner = document.getElementById('spinnerGuardarOtrosEstados');
  const texto = document.getElementById('textoGuardarOtrosEstados');
  if (boton?.disabled) return;

  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  if (botonRemitir) {
    botonRemitir.disabled = true;
    botonRemitir.setAttribute('aria-busy', 'true');
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando...';

  const fechaGestion = obtenerFechaActualBogota();
  const normalizarTextoPQRSF = obtenerColeccionRegistro(radicado) === RADICADOS_COLLECTION
    ? formatearMayusculasIniciales
    : valor => valor;
  const observacionesGuardadas = normalizarTextoPQRSF(observaciones);
  const debeActualizarFechaRespuesta = Boolean(
    otrosEstados && (!radicado.fechaCargaRespuesta || otrosEstados !== radicado.otrosEstados)
  );

  try {
    const docRef = doc(db, obtenerColeccionRegistro(radicado), id);
    const camposGestion = {
      otrosEstados: otrosEstados,
      observaciones: observacionesGuardadas,
      ...(debeActualizarFechaRespuesta ? { fechaCargaRespuesta: fechaGestion } : {})
    };

    if (destinosSeleccionados.length > 0) {
      const confirmado = await confirmarAccion(
        `La solicitud se remitirá a ${destinosSeleccionados.map(abreviarNombreDependencia).join(', ')}. Se crearán copias VIGENTES con el mismo número de radicado. El oficio de origen conservará su estado hasta que una dependencia lo acepte.`,
        { titulo: 'Remitir por Competencia', aceptarTexto: 'Remitir' }
      );
      if (!confirmado) return;

      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists()) throw new Error('No se encontró el radicado original para remitir.');
        const radicadoOriginal = snapshot.data();
        const destinosPrevios = Array.isArray(radicadoOriginal.dependenciasDestino)
          ? radicadoOriginal.dependenciasDestino
          : [];
        const destinosNuevos = destinosSeleccionados.filter(
          dependencia => !destinosPrevios.includes(dependencia)
        );
        const fechaRemision = new Date().toISOString();

        const copias = destinosNuevos.map(dependencia => ({
          dependencia,
          referencia: doc(
            db, RADICADOS_COLLECTION, generarIdCopiaCompetencia(id, dependencia)
          )
        }));

        copias.forEach(copia => {
          transaction.set(
            copia.referencia,
            crearDatosCopiaCompetencia(
              radicadoOriginal,
              copia.dependencia,
              id,
              obtenerColeccionRegistro(radicado),
              fechaRemision,
              observacionesDestinatario
            )
          );
        });
        transaction.update(docRef, {
          dependenciasDestino: [...new Set([...destinosPrevios, ...destinosSeleccionados])],
          fechaRemisionCompetencia: fechaRemision
        });
      });
      await informarResultadoNotificacionCorreo('remision', { id });
    } else {
      await updateDoc(docRef, camposGestion);
    }

    await actualizarConsultaPublicaSiAplica(id, obtenerColeccionRegistro(radicado));
    alert(destinosSeleccionados.length > 0
      ? 'La PQRS fue remitida a las dependencias seleccionadas.'
      : 'Gestión guardada correctamente.');
    cerrarModalOtrosEstados();
    await recargarDatosRegistro(radicado);
  } catch (error) {
    console.error("Error al guardar estado/observaciones:", error);
    alert(`No se pudo guardar la gestión: ${error.message}`);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = 'Guardar';
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
    if (botonRemitir) botonRemitir.removeAttribute('aria-busy');
    actualizarResumenRemision();
  }
};
