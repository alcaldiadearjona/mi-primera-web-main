import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db } from '../../config/firebase-config.js';
import { mostrarAviso } from '../ui/avisos.js';

const COLECCION_IAS = 'radicadosIAS';
const ENTIDADES_IAS = [
  {
    id: 'fiscalia',
    nombre: 'Fiscalía General de la Nación',
    icono: 'bi-puzzle-fill',
    coincidencias: ['fiscalia', 'fiscalia general de la nacion']
  },
  {
    id: 'procuraduria',
    nombre: 'Procuraduría General de la Nación',
    icono: 'bi-bullseye',
    coincidencias: ['procuraduria', 'procuraduria general de la nacion']
  },
  {
    id: 'contraloria',
    nombre: 'Contraloría General de la República',
    icono: 'bi-record-circle',
    coincidencias: ['contraloria', 'contraloria general de la republica']
  },
  {
    id: 'defensoria',
    nombre: 'Defensoría del Pueblo',
    icono: 'bi-shield-check',
    coincidencias: ['defensoria', 'defensoria del pueblo']
  },
  {
    id: 'gobernacion',
    nombre: 'Gobernación de Bolívar',
    icono: 'bi-bank',
    coincidencias: ['gobernacion', 'gobernacion de bolivar', 'gobernacion bolivar']
  }
];

let registrosIAS = [];
let entidadSeleccionada = '';
let busquedaEntidadIAS = '';
let filtroTexto = '';
let filtroAno = '';
let filtroMes = '';

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .trim();
}

function obtenerFecha(registro) {
  return String(
    registro.fechaRadicacion
    || registro.fechaGeneracion
    || registro.fecha
    || registro.creadoEn
    || ''
  ).slice(0, 10);
}

function obtenerEntidadRegistro(registro) {
  return normalizar(registro.entidadIAS || registro.entidad || registro.ente || '');
}

function coincideEntidad(registro, entidad) {
  const valor = obtenerEntidadRegistro(registro);
  return valor === entidad.id || entidad.coincidencias.includes(valor);
}

function obtenerRegistrosEntidad(entidad) {
  return registrosIAS.filter(registro => coincideEntidad(registro, entidad));
}

function coincideBusquedaEntidad(entidad) {
  if (!busquedaEntidadIAS) return true;
  const coincideNombre = normalizar(entidad.nombre).includes(busquedaEntidadIAS);
  if (coincideNombre) return true;

  return obtenerRegistrosEntidad(entidad).some(registro => normalizar([
    registro.radicado,
    registro.numeroRadicado,
    registro.remitente,
    registro.destinatario
  ].join(' ')).includes(busquedaEntidadIAS));
}

function renderizarTarjetas() {
  const contenedor = document.getElementById('tarjetasEntidadesIAS');
  if (!contenedor) return;
  const entidadesVisibles = ENTIDADES_IAS.filter(coincideBusquedaEntidad);
  if (entidadesVisibles.length === 0) {
    const mensaje = document.createElement('p');
    mensaje.className = 'ias-empty-state';
    mensaje.textContent = 'No se encontraron entidades o radicados con esa búsqueda.';
    contenedor.replaceChildren(mensaje);
    return;
  }

  contenedor.replaceChildren(...entidadesVisibles.map(entidad => {
    const cantidad = obtenerRegistrosEntidad(entidad).length;
    const tarjeta = document.createElement('button');
    tarjeta.type = 'button';
    tarjeta.className = 'ias-entity-card';
    tarjeta.setAttribute('aria-label', `${entidad.nombre}, ${cantidad} radicados. Abrir entidad.`);

    const informacion = document.createElement('span');
    informacion.className = 'ias-entity-info';
    const encabezado = document.createElement('span');
    encabezado.className = 'ias-entity-card-heading';
    const nombre = document.createElement('strong');
    nombre.textContent = entidad.nombre;
    const conteo = document.createElement('span');
    conteo.className = 'ias-entity-count';
    conteo.textContent = `${cantidad} ${cantidad === 1 ? 'radicado' : 'radicados'}`;

    const contenedorIcono = document.createElement('span');
    contenedorIcono.className = 'ias-entity-icon';
    contenedorIcono.setAttribute('aria-hidden', 'true');
    const icono = document.createElement('i');
    icono.className = `bi ${entidad.icono}`;
    contenedorIcono.append(icono);

    encabezado.append(nombre, contenedorIcono);
    informacion.append(encabezado, conteo);
    tarjeta.append(informacion);
    tarjeta.addEventListener('click', () => abrirEntidad(entidad.id));
    return tarjeta;
  }));
}

function actualizarFiltroAnios(registros) {
  const selector = document.getElementById('filtroAnoIAS');
  const seleccionado = selector.value;
  const anos = new Set([String(new Date().getFullYear())]);
  registros.forEach(registro => {
    const fecha = obtenerFecha(registro);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) anos.add(fecha.slice(0, 4));
  });
  selector.replaceChildren(new Option('Todos los Años', ''));
  [...anos].sort((a, b) => b.localeCompare(a)).forEach(ano => {
    selector.add(new Option(ano, ano));
  });
  if (anos.has(seleccionado)) selector.value = seleccionado;
}

function abrirEntidad(id) {
  const entidad = ENTIDADES_IAS.find(item => item.id === id);
  if (!entidad) return;
  entidadSeleccionada = id;
  filtroTexto = '';
  filtroAno = '';
  filtroMes = '';
  document.getElementById('buscarRadicadoIAS').value = '';
  document.getElementById('filtroAnoIAS').value = '';
  document.getElementById('filtroMesIAS').value = '';
  document.getElementById('tarjetasEntidadesIAS').hidden = true;
  document.getElementById('tituloDetalleIAS').textContent = entidad.nombre;
  document.getElementById('detalleEntidadIAS').hidden = false;
  renderizarTabla();
}

function volverATarjetas() {
  entidadSeleccionada = '';
  filtroTexto = '';
  filtroAno = '';
  filtroMes = '';
  document.getElementById('detalleEntidadIAS').hidden = true;
  document.getElementById('tarjetasEntidadesIAS').hidden = false;
}

function renderizarTabla() {
  const entidad = ENTIDADES_IAS.find(item => item.id === entidadSeleccionada);
  if (!entidad) return;
  const registrosEntidad = obtenerRegistrosEntidad(entidad)
    .slice()
    .sort((a, b) => obtenerFecha(b).localeCompare(obtenerFecha(a)));
  const registrosFiltrados = registrosEntidad.filter(registro => {
    const fecha = obtenerFecha(registro);
    const coincideAno = !filtroAno || fecha.slice(0, 4) === filtroAno;
    const coincideMes = !filtroMes || fecha.slice(5, 7) === filtroMes;
    const texto = normalizar([
      registro.radicado,
      registro.remitente,
      registro.destinatario,
      registro.asunto,
      registro.estado,
      registro.funcionarioAsignado
    ].join(' '));
    return coincideAno && coincideMes && (!filtroTexto || texto.includes(filtroTexto));
  });

  const periodo = document.getElementById('periodoDetalleIAS');
  const fechaPeriodo = filtroAno && filtroMes ? `${filtroAno}-${filtroMes}-01` : '';
  periodo.dateTime = fechaPeriodo;
  periodo.textContent = filtroAno && filtroMes
    ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
        .format(new Date(Number(filtroAno), Number(filtroMes) - 1, 1))
        .replace(/^./, caracter => caracter.toLocaleUpperCase('es-CO'))
    : filtroAno || (filtroMes
      ? new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(2000, Number(filtroMes) - 1, 1))
      : 'Todos los periodos');

  document.getElementById('conteoDetalleIAS').textContent =
    `${registrosFiltrados.length} de ${registrosEntidad.length} ${registrosEntidad.length === 1 ? 'radicado' : 'radicados'}`;
  const cuerpo = document.getElementById('cuerpoTablaIAS');
  cuerpo.replaceChildren();

  if (registrosFiltrados.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 5;
    celda.textContent = registrosEntidad.length
      ? 'No se encontraron radicados con los filtros seleccionados.'
      : 'Esta entidad aún no tiene radicados registrados.';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  registrosFiltrados.forEach(registro => {
    const fila = document.createElement('tr');
    const valores = [
      registro.radicado || registro.numeroRadicado || '',
      obtenerFecha(registro),
      registro.remitente || registro.destinatario || '',
      registro.asunto || '',
      registro.estado || 'VIGENTE'
    ];
    valores.forEach((valor, indice) => {
      const celda = document.createElement('td');
      celda.textContent = String(valor);
      if (indice === 0 && valor) {
        const numero = document.createElement('strong');
        numero.textContent = String(valor);
        celda.replaceChildren(numero);
      }
      fila.append(celda);
    });
    cuerpo.append(fila);
  });
}

export async function inicializarTableroIAS() {
  document.getElementById('volverEntidadesIAS')?.addEventListener('click', volverATarjetas);
  document.getElementById('buscarEntidadIAS')?.addEventListener('input', event => {
    busquedaEntidadIAS = normalizar(event.currentTarget.value);
    renderizarTarjetas();
  });
  document.getElementById('limpiarBusquedaIAS')?.addEventListener('click', () => {
    const input = document.getElementById('buscarEntidadIAS');
    input.value = '';
    busquedaEntidadIAS = '';
    renderizarTarjetas();
    input.focus();
  });
  document.getElementById('buscarRadicadoIAS')?.addEventListener('input', event => {
    filtroTexto = normalizar(event.currentTarget.value);
    renderizarTabla();
  });
  document.getElementById('aplicarFiltrosIAS')?.addEventListener('click', () => {
    filtroAno = document.getElementById('filtroAnoIAS').value;
    filtroMes = document.getElementById('filtroMesIAS').value;
    filtroTexto = normalizar(document.getElementById('buscarRadicadoIAS').value);
    renderizarTabla();
  });

  try {
    const snapshot = await getDocs(collection(db, COLECCION_IAS));
    registrosIAS = snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
    actualizarFiltroAnios(registrosIAS);
    renderizarTarjetas();
  } catch (error) {
    console.error('Error al cargar los radicados IAS:', error);
    const contenedor = document.getElementById('tarjetasEntidadesIAS');
    const mensaje = document.createElement('p');
    mensaje.className = 'ias-empty-state ias-load-error';
    mensaje.setAttribute('role', 'alert');
    mensaje.textContent = 'No se pudieron cargar las entidades IAS. Revisa los permisos de lectura de la colección radicadosIAS.';
    contenedor.replaceChildren(mensaje);
    void mostrarAviso(mensaje.textContent, { tipo: 'error', titulo: 'Error al cargar IAS' });
  }
}
