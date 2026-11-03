import { addDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL } from '../../config/firebase-config.js';
import { establecerRegistrosIAS } from '../../data/ias.js';
import { esFuncionario, puedeConsultarIAS, puedeGestionarIAS } from '../auth/roles.js';
import { convertirABase64, sumarDiasHabilesColombia } from '../../utils/helpers.js';
import { renderizarTablaRadicados } from '../radicados/tabla.js';
import { mostrarAviso } from '../ui/avisos.js';
import {
  establecerCargaIASInforme,
  establecerErrorIASInforme,
  establecerRegistrosIASInforme
} from '../informes/tablero.js';

const COLECCION_IAS = 'radicadosIAS';
export const ENTIDADES_IAS = [
  {
    id: 'fiscalia',
    nombre: 'Fiscalía General de la Nación',
    icono: 'bi-puzzle-fill',
    logo: 'assets/images/fiscalia-general-nacion.png',
    coincidencias: ['fiscalia', 'fiscalia general de la nacion']
  },
  {
    id: 'procuraduria',
    nombre: 'Procuraduría General de la Nación',
    icono: 'bi-bullseye',
    logo: 'assets/images/procuraduria-general-nacion.png',
    coincidencias: ['procuraduria', 'procuraduria general de la nacion']
  },
  {
    id: 'contraloria',
    nombre: 'Contraloría General de la República',
    icono: 'bi-record-circle',
    logo: 'assets/images/contraloria-general-republica.png',
    coincidencias: ['contraloria', 'contraloria general de la republica']
  },
  {
    id: 'defensoria',
    nombre: 'Defensoría del Pueblo',
    icono: 'bi-shield-check',
    logo: 'assets/images/defensoria-del-pueblo.png',
    coincidencias: ['defensoria', 'defensoria del pueblo']
  },
  {
    id: 'gobernacion',
    nombre: 'Gobernación de Bolívar',
    icono: 'bi-bank',
    logo: 'assets/images/gobernacion-bolivar.png',
    coincidencias: ['gobernacion', 'gobernacion de bolivar', 'gobernacion bolivar']
  }
];

let registrosIAS = [];
let entidadSeleccionada = '';
let busquedaEntidadIAS = '';
let filtroTexto = '';
let filtroAno = '';
let filtroMes = '';
let cargaDatosIAS;
let datosIASCargados = false;

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
    const puedeAbrir = !esFuncionario() || puedeGestionarIAS();
    tarjeta.disabled = !puedeAbrir;
    tarjeta.setAttribute('aria-label', puedeAbrir
      ? `${entidad.nombre}, ${cantidad} radicados. Abrir entidad.`
      : `${entidad.nombre}. Acceso restringido.`);

    const informacion = document.createElement('span');
    informacion.className = 'ias-entity-info';
    const encabezado = document.createElement('span');
    encabezado.className = 'ias-entity-card-heading';
    const nombre = document.createElement('strong');
    nombre.textContent = entidad.nombre;
    const conteo = document.createElement('span');
    conteo.className = 'ias-entity-count';
    conteo.textContent = puedeAbrir
      ? `${cantidad} ${cantidad === 1 ? 'radicado' : 'radicados'}`
      : 'Acceso restringido';

    const contenedorIcono = document.createElement('span');
    contenedorIcono.className = 'ias-entity-icon';
    contenedorIcono.setAttribute('aria-hidden', 'true');
    if (entidad.id === 'procuraduria') {
      contenedorIcono.classList.add('ias-entity-icon--procuraduria');
    } else if (entidad.id === 'contraloria') {
      contenedorIcono.classList.add('ias-entity-icon--contraloria');
    } else if (entidad.id === 'defensoria') {
      contenedorIcono.classList.add('ias-entity-icon--defensoria');
    } else if (entidad.id === 'gobernacion') {
      contenedorIcono.classList.add('ias-entity-icon--gobernacion');
    }
    if (entidad.logo) {
      contenedorIcono.classList.add('ias-entity-icon--logo');
      const logo = document.createElement('img');
      logo.className = 'ias-entity-logo';
      logo.src = entidad.logo;
      logo.alt = '';
      contenedorIcono.append(logo);
    } else {
      const icono = document.createElement('i');
      icono.className = `bi ${entidad.icono}`;
      contenedorIcono.append(icono);
    }

    encabezado.append(nombre, contenedorIcono);
    informacion.append(encabezado, conteo);
    tarjeta.append(informacion);
    if (puedeAbrir) tarjeta.addEventListener('click', () => abrirEntidad(entidad.id));
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
  if (esFuncionario() && !puedeGestionarIAS()) {
    void mostrarAviso('Los funcionarios pueden ver las entidades IAS, pero no ingresar a sus radicados.', {
      tipo: 'warning',
      titulo: 'Acceso restringido'
    });
    return;
  }
  const entidad = ENTIDADES_IAS.find(item => item.id === id);
  if (!entidad) return;
  entidadSeleccionada = id;
  filtroTexto = '';
  const ahora = new Date();
  filtroAno = String(ahora.getFullYear());
  filtroMes = '';
  document.getElementById('buscarRadicadoIAS').value = '';
  document.getElementById('filtroAnoIAS').value = filtroAno;
  document.getElementById('filtroMesIAS').value = filtroMes;
  document.body.classList.add('detail-view-open');
  document.getElementById('pantallaIAS').classList.add('ias-detail-open');
  document.getElementById('tarjetasEntidadesIAS').hidden = true;
  const titulo = document.getElementById('tituloDetalleIAS');
  titulo.textContent = entidad.nombre;
  const iconoTitulo = document.createElement('i');
  iconoTitulo.className = 'detail-dependency-icon bi bi-bank';
  iconoTitulo.setAttribute('aria-hidden', 'true');
  titulo.prepend(iconoTitulo);
  document.getElementById('detalleEntidadIAS').hidden = false;
  renderizarTabla();
}

function volverATarjetas() {
  entidadSeleccionada = '';
  filtroTexto = '';
  filtroAno = '';
  filtroMes = '';
  document.body.classList.remove('detail-view-open');
  document.getElementById('pantallaIAS').classList.remove('ias-detail-open');
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
  const ahora = new Date();
  const mostrarPeriodoActual = filtroAno === String(ahora.getFullYear()) && !filtroMes;
  const fechaPeriodo = filtroAno && filtroMes
    ? `${filtroAno}-${filtroMes}-01`
    : mostrarPeriodoActual
      ? `${filtroAno}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`
      : '';
  periodo.dateTime = fechaPeriodo;
  periodo.textContent = filtroAno && filtroMes
    ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
        .format(new Date(Number(filtroAno), Number(filtroMes) - 1, 1))
        .replace(/^./, caracter => caracter.toLocaleUpperCase('es-CO'))
    : mostrarPeriodoActual
      ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
          .format(ahora)
          .replace(/^./, caracter => caracter.toLocaleUpperCase('es-CO'))
      : filtroAno || (filtroMes
      ? new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(2000, Number(filtroMes) - 1, 1))
      : 'Todos los periodos');

  document.getElementById('conteoDetalleIAS').textContent =
    `${registrosFiltrados.length} de ${registrosEntidad.length} ${registrosEntidad.length === 1 ? 'radicado' : 'radicados'}`;
  renderizarTablaRadicados(
    registrosFiltrados,
    'cuerpoTablaIAS',
    Boolean(filtroTexto || filtroAno || filtroMes)
  );
  if (filtroTexto) {
    document.querySelectorAll('#cuerpoTablaIAS .month-group-toggle').forEach(boton => {
      window.toggleMonthGroup(boton);
    });
  }
}

function actualizarFechaVencimientoIA() {
  const fecha = document.getElementById('fechaRadicacionIA')?.value;
  const dias = document.getElementById('diasHabilesIA')?.value;
  const vencimiento = document.getElementById('fechaVencimientoIA');
  if (fecha && dias && vencimiento) {
    vencimiento.value = sumarDiasHabilesColombia(fecha, dias);
  }
}

function actualizarFormularioIA() {
  const contenedor = document.getElementById('contenedorFormularioIA');
  const boton = document.getElementById('toggleFormularioIA');
  if (!contenedor || !boton) return;
  const expandido = boton.getAttribute('aria-expanded') === 'true';
  contenedor.style.display = expandido ? 'none' : 'block';
  boton.setAttribute('aria-expanded', String(!expandido));
  boton.classList.toggle('is-collapsed', expandido);
}

async function guardarNuevaIA(event) {
  event.preventDefault();
  if (!puedeGestionarIAS()) {
    alert('No tienes permiso para registrar comunicaciones IAS.');
    return;
  }
  const formulario = document.getElementById('formNuevaIA');
  if (!formulario.reportValidity()) return;

  const boton = document.getElementById('btnGuardarIA');
  const texto = document.getElementById('textoBtnGuardarIA');
  const archivo = document.getElementById('solicitudPdfIA').files[0];
  if (archivo && !/\.pdf$/i.test(archivo.name)) {
    alert('La solicitud escaneada debe ser un archivo PDF.');
    return;
  }
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  texto.textContent = archivo ? 'Subiendo PDF...' : 'Guardando IA...';
  let guardada = false;

  try {
    let pdfUrl = '';
    if (archivo) {
      const base64 = await convertirABase64(archivo);
      const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          archivoBase64: base64.split(',')[1] || '',
          nombreArchivo: `IA_${document.getElementById('radicadoIA').value.trim()}_${archivo.name}`
        })
      });
      const datosArchivo = await respuesta.json();
      if (!respuesta.ok || datosArchivo.status !== 'success') {
        throw new Error(datosArchivo.message || `Error HTTP ${respuesta.status} al subir el PDF.`);
      }
      pdfUrl = datosArchivo.url;
    }

    texto.textContent = 'Guardando IA...';
    const destino = document.getElementById('destinoIA').value;
    const nuevoRegistro = {
      radicado: document.getElementById('radicadoIA').value.trim(),
      entidadIAS: destino,
      destino,
      tipoCanal: document.getElementById('tipoCanalIA').value,
      estado: document.getElementById('estadoInicialIA').value,
      fechaRadicacion: document.getElementById('fechaRadicacionIA').value,
      fechaHoraRadicacion: new Date().toISOString(),
      diasHabiles: document.getElementById('diasHabilesIA').value,
      fechaVencimiento: document.getElementById('fechaVencimientoIA').value,
      remitente: document.getElementById('remitenteIA').value.trim(),
      asunto: document.getElementById('asuntoIA').value.trim(),
      pdfUrl,
      funcionarioAsignado: '',
      tipoPeticion: '',
      otrosEstados: '',
      observaciones: '',
      respuestaUrl: '',
      fechaCargaRespuesta: ''
    };
    await addDoc(collection(db, COLECCION_IAS), nuevoRegistro);
    guardada = true;
    formulario.reset();
    const hoy = new Date().toISOString().slice(0, 10);
    document.getElementById('fechaRadicacionIA').value = hoy;
    document.getElementById('diasHabilesIA').value = '15';
    actualizarFechaVencimientoIA();
    await recargarDatosIAS();
    alert(`La IA ${nuevoRegistro.radicado} se guardó en ${destino}.`);
  } catch (error) {
    console.error('Error al guardar la IA:', error);
    alert(guardada
      ? `La IA se guardó en Firestore, pero no se pudo actualizar la tabla: ${error.message}`
      : `No fue posible guardar la IA: ${error.message}`);
  } finally {
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    texto.textContent = 'Guardar IA';
  }
}

export async function recargarDatosIAS() {
  if (!puedeConsultarIAS()) {
    throw new Error('No tienes permiso para consultar los registros IAS.');
  }
  if (cargaDatosIAS) return cargaDatosIAS;

  cargaDatosIAS = (async () => {
    const snapshot = await getDocs(collection(db, COLECCION_IAS));
    registrosIAS = snapshot.docs.map(documento => {
      const datos = documento.data();
      return {
        ...datos,
        id: documento.id,
        radicado: datos.radicado || datos.numeroRadicado || '',
        entidadIAS: datos.entidadIAS || datos.entidad || datos.ente || '',
        fechaRadicacion: obtenerFecha(datos),
        fechaVencimiento: datos.fechaVencimiento
          || datos.fechaEntrega
          || sumarDiasHabilesColombia(obtenerFecha(datos), datos.diasHabiles || 15),
        tipoCanal: datos.tipoCanal || '',
        remitente: datos.remitente || datos.destinatario || '',
        asunto: datos.asunto || '',
        estado: datos.estado || 'VIGENTE',
        diasHabiles: datos.diasHabiles || 15,
        coleccion: COLECCION_IAS
      };
    });
    establecerRegistrosIAS(registrosIAS);
    establecerRegistrosIASInforme(registrosIAS);
    actualizarFiltroAnios(registrosIAS);
    renderizarTarjetas();
    if (entidadSeleccionada) renderizarTabla();
    datosIASCargados = true;
  })();

  try {
    await cargaDatosIAS;
  } finally {
    cargaDatosIAS = null;
  }
}

function mostrarErrorCargaIAS(error) {
  console.error('Error al cargar los radicados IAS:', error);
  establecerErrorIASInforme();
  const contenedor = document.getElementById('tarjetasEntidadesIAS');
  if (!contenedor) return;
  const mensaje = document.createElement('p');
  mensaje.className = 'ias-empty-state ias-load-error';
  mensaje.setAttribute('role', 'alert');
  mensaje.textContent = 'No se pudieron cargar las entidades IAS. Revisa los permisos de lectura de la colección radicadosIAS.';
  contenedor.replaceChildren(mensaje);
  void mostrarAviso(mensaje.textContent, { tipo: 'error', titulo: 'Error al cargar IAS' });
}

export async function asegurarDatosIAS() {
  if (!puedeConsultarIAS()) return false;
  if (esFuncionario() && !puedeGestionarIAS()) {
    renderizarTarjetas();
    return true;
  }
  if (datosIASCargados) return true;
  if (!cargaDatosIAS) {
    const contenedor = document.getElementById('tarjetasEntidadesIAS');
    const mensaje = document.createElement('p');
    mensaje.className = 'ias-empty-state';
    mensaje.setAttribute('role', 'status');
    mensaje.textContent = 'Cargando radicados IAS…';
    contenedor?.replaceChildren(mensaje);
    establecerCargaIASInforme();
  }
  try {
    await recargarDatosIAS();
    return true;
  } catch (error) {
    mostrarErrorCargaIAS(error);
    return false;
  }
}

export async function inicializarTableroIAS() {
  if (!puedeConsultarIAS()) return;
  if (esFuncionario() && !puedeGestionarIAS()) {
    renderizarTarjetas();
    return;
  }
  const selectorDestino = document.getElementById('destinoIA');
  if (puedeGestionarIAS()) {
    ENTIDADES_IAS.forEach(entidad => {
      selectorDestino.add(new Option(entidad.nombre, entidad.nombre));
    });
    document.getElementById('toggleFormularioIA')?.addEventListener('click', actualizarFormularioIA);
    document.getElementById('formNuevaIA')?.addEventListener('submit', guardarNuevaIA);
    document.getElementById('fechaRadicacionIA')?.addEventListener('input', actualizarFechaVencimientoIA);
    document.getElementById('diasHabilesIA')?.addEventListener('input', actualizarFechaVencimientoIA);
    const hoy = new Date().toISOString().slice(0, 10);
    document.getElementById('fechaRadicacionIA').value = hoy;
    actualizarFechaVencimientoIA();
  }
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

}
