import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { auth, db, GOOGLE_SCRIPT_URL, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import {
  abreviarNombreDependencia,
  compararRadicadosPendientes,
  convertirABase64,
  formatearMayusculasIniciales,
  formatearRadicadoEntrada,
  obtenerUrlHttpsSegura,
  evaluarEstadoAutomatico,
  sumarDiasHabilesColombia
} from '../../utils/helpers.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import {
  detenerPresenciaPQRS,
  obtenerTokenPresenciaPQRS,
  observarPresenciaPQRS
} from '../../services/presencia.js';
import {
  COLECCION_CONSULTA_PUBLICA,
  sincronizarConsultaPublicaRadicado
} from '../../services/consulta-publica.js';
import {
  esAdministrador,
  esCiudadano,
  esFuncionario,
  obtenerCanalPendientesSesion,
  obtenerDependenciaSesion,
  obtenerPerfilSesion
} from '../auth/roles.js';
import { mostrarAviso } from '../ui/avisos.js';
import { informarResultadoNotificacionCorreo } from './notificaciones-correo.js';

const COLECCION_SECUENCIAS_ENTRADA = 'radicadosEntradaSecuencias';
const MINIMO_SECUENCIA_ENTRADA_2026 = 4380;
const MAX_PDFS_POR_CARGA_GESTION = 20;
const MAX_TAMANO_PDF_GESTION = 10 * 1024 * 1024;
const pdfsBibliotecaGestion = [];
let cargaPdfGestionEnCurso = false;
let cargaBibliotecaPdfGestionEnCurso = false;
let bibliotecaPdfGestionCargada = false;
function obtenerUltimoSecuenciaEntrada(anio, secuencia) {
  const ultimoActual = secuencia?.exists() ? Number(secuencia.data().ultimo) : 0;
  return anio === 2026
    ? Math.max(Number.isSafeInteger(ultimoActual) && ultimoActual >= 0 ? ultimoActual : 0, MINIMO_SECUENCIA_ENTRADA_2026)
    : ultimoActual;
}
let modoFormularioPQRSF = 'directo';
let radicadoPendienteGestion = '';
let datosPendienteGestion = null;
let cantidadVisiblePendientes = 6;
let seleccionPQRSFPendienteEnCurso = false;
const observadoresPresenciaPQRS = new Map();
const reservasPQRSEnLiberacion = new Set();

function tieneDocumentoAdjuntoSolicitud(registro) {
  return ['ciudadano', 'recepcion'].includes(registro?.origenSolicitud)
    && Boolean(obtenerUrlHttpsSegura(
      registro.pdfCiudadanoUrl || registro.pdfUrl || ''
    ));
}

function actualizarCampoNotificacionRespuesta(tipoSelectId, campoId, etiquetaId) {
  const select = document.getElementById(tipoSelectId);
  const campo = document.getElementById(campoId);
  const etiqueta = document.getElementById(etiquetaId);
  if (!select || !campo) return;
  const tipo = select.value;
  const requiereDato = tipo === 'Correo' || tipo === 'Celular';
  campo.disabled = !requiereDato;
  campo.required = tipo === 'Correo' || tipo === 'Celular';
  campo.setAttribute('aria-disabled', String(campo.disabled));
  const grupoContacto = campo.closest('.form-group');
  if (grupoContacto) {
    grupoContacto.hidden = tipo === 'Presencial';
    grupoContacto.style.display = tipo === 'Presencial' ? 'none' : '';
    grupoContacto.classList.toggle('notification-contact-disabled', campo.disabled);
    grupoContacto.setAttribute('aria-hidden', String(tipo === 'Presencial'));
  }
  if (!tipo || tipo === 'Presencial') campo.value = '';
  if (tipo === 'Correo') {
    campo.type = 'email';
    campo.placeholder = 'correo@ejemplo.com';
    if (etiqueta) etiqueta.textContent = 'Correo electrónico';
  } else if (tipo === 'Celular') {
    campo.type = 'tel';
    campo.inputMode = 'tel';
    campo.placeholder = 'Número de celular';
    if (etiqueta) etiqueta.textContent = 'Número de celular';
  } else if (tipo === 'Presencial') {
    campo.type = 'text';
    campo.placeholder = 'No requiere dato';
    if (etiqueta) etiqueta.textContent = 'Dato de Notificación';
  } else {
    campo.type = 'text';
    campo.placeholder = '';
    if (etiqueta) etiqueta.textContent = 'Dato de Notificación';
  }
}

function establecerModoFormularioPQRSF(modo) {
  modoFormularioPQRSF = modo;
  const esRadicacionCiudadana = (esCiudadano() || esAdministrador()) && modo === 'directo';
  const formulario = document.getElementById('pqrsForm');
  if (formulario) {
    formulario.classList.toggle('citizen-direct-form', esRadicacionCiudadana);
  }
  const radicado = document.getElementById('radicado');
  if (radicado) {
    const radicadoAutomaticoCiudadano = esRadicacionCiudadana;
    const radicadoSinNumeroEnGestion = modo === 'gestion'
      && datosPendienteGestion?.sinNumeroRadicado === true;
    radicado.readOnly = modo === 'gestion' || radicadoAutomaticoCiudadano;
    radicado.required = !radicadoAutomaticoCiudadano && !radicadoSinNumeroEnGestion;
    radicado.placeholder = radicadoAutomaticoCiudadano
      ? 'Se asignará automáticamente al guardar'
      : radicadoSinNumeroEnGestion
        ? 'No requiere número de radicado'
        : '';
    if (radicadoAutomaticoCiudadano) radicado.value = '';
  }
  [
    ['grupoRadicado', !esRadicacionCiudadana],
    ['grupoTipoCanal', true],
    ['grupoEstadoSolicitud', esRadicacionCiudadana],
    ['grupoRemitente', true],
    ['grupoAsunto', true],
    ['grupoSolicitudPdf', true],
    ['grupoAceptacionDatosCiudadano', esRadicacionCiudadana]
  ].forEach(([id, visible]) => {
    const grupo = document.getElementById(id);
    if (grupo) {
      grupo.hidden = !visible;
      grupo.style.display = visible ? '' : 'none';
    }
  });
  const tipoCanal = document.getElementById('tipoCanal');
  if (tipoCanal) {
    const valorTipoCanal = tipoCanal.value;
    if (esRadicacionCiudadana) {
      tipoCanal.innerHTML = [
        '<option value="Virtual">Virtual</option>',
      ].join('');
    } else {
      tipoCanal.innerHTML = [
        '<option value="">Seleccionar Tipo de Canal</option>',
        '<option value="Virtual">Virtual</option>',
        '<option value="Presencial">Presencial</option>'
      ].join('');
    }
    tipoCanal.value = esRadicacionCiudadana ? 'Virtual' : valorTipoCanal;
    tipoCanal.disabled = false;
    tipoCanal.required = true;
  }
  const estadoSolicitud = document.getElementById('estadoSolicitud');
  if (estadoSolicitud) {
    estadoSolicitud.value = 'VIGENTE';
    estadoSolicitud.disabled = esRadicacionCiudadana;
  }
  const tipoNotificacionCiudadano = document.getElementById('tipoNotificacionCiudadano');
  if (tipoNotificacionCiudadano) {
    tipoNotificacionCiudadano.required = esRadicacionCiudadana;
  }
  const grupoTipoNotificacionCiudadano = document.getElementById('grupoTipoNotificacionCiudadano');
  const grupoContactoNotificacionCiudadano = document.getElementById('grupoContactoNotificacionCiudadano');
  [grupoTipoNotificacionCiudadano, grupoContactoNotificacionCiudadano].forEach(grupo => {
    if (!grupo) return;
    if (modo === 'gestion') {
      grupo.hidden = false;
      grupo.style.display = '';
    } else {
      grupo.hidden = !esRadicacionCiudadana;
      grupo.style.display = esRadicacionCiudadana ? '' : 'none';
    }
  });
  const remitente = document.getElementById('remitente');
  if (remitente) remitente.required = true;
  const asunto = document.getElementById('asunto');
  if (asunto) asunto.required = true;
  const etiquetaRemitente = document.querySelector('label[for="remitente"]');
  if (etiquetaRemitente) {
    etiquetaRemitente.textContent = 'Nombre Completo del Remitente';
  }
  const solicitudPdf = document.getElementById('solicitudPdf');
  if (solicitudPdf) {
    solicitudPdf.accept = '.pdf';
    solicitudPdf.required = esRadicacionCiudadana;
    solicitudPdf.hidden = modo === 'gestion';
  }
  const esGestionPendienteActiva = modo === 'gestion' && Boolean(radicadoPendienteGestion);
  const grupoSolicitudPdf = document.getElementById('grupoSolicitudPdf');
  if (grupoSolicitudPdf) {
    grupoSolicitudPdf.hidden = modo === 'gestion' && !esGestionPendienteActiva;
    grupoSolicitudPdf.style.display = grupoSolicitudPdf.hidden ? 'none' : '';
  }
  const selectorPdfGestion = document.getElementById('selectorPdfGestion');
  if (selectorPdfGestion) {
    selectorPdfGestion.hidden = !esGestionPendienteActiva;
    selectorPdfGestion.style.display = selectorPdfGestion.hidden ? 'none' : '';
  }
  const pdfGestionSeleccionado = document.getElementById('pdfGestionSeleccionado');
  if (pdfGestionSeleccionado) {
    pdfGestionSeleccionado.disabled = !esGestionPendienteActiva;
  }
  const abrirSelectorPdfGestion = document.getElementById('abrirSelectorPdfGestion');
  const pdfGestionOpcional = esGestionPendienteActiva
    && tieneDocumentoAdjuntoSolicitud(datosPendienteGestion);
  const etiquetaPdfGestion = document.getElementById('etiquetaPdfGestion');
  if (etiquetaPdfGestion) {
    etiquetaPdfGestion.textContent = pdfGestionOpcional
      ? 'Oficio de gestión (PDF opcional)'
      : 'Oficio de gestión (PDF obligatorio)';
  }
  const ayudaPdfGestion = document.getElementById('ayudaPdfGestion');
  if (ayudaPdfGestion) {
    ayudaPdfGestion.textContent = pdfGestionOpcional
      ? 'La solicitud original adjunta se enviará a la dependencia. Puedes seleccionar otro oficio si corresponde.'
      : 'Selecciona el oficio que se asociará al radicado y se enviará a la dependencia.';
  }
  if (abrirSelectorPdfGestion) {
    abrirSelectorPdfGestion.disabled = !esGestionPendienteActiva;
    abrirSelectorPdfGestion.setAttribute(
      'aria-required',
      String(esGestionPendienteActiva && !pdfGestionOpcional)
    );
  }
  const aceptacion = document.getElementById('aceptaTratamientoDatos');
  if (aceptacion) aceptacion.required = esRadicacionCiudadana;
  const grupoDependencia = document.getElementById('grupoDependenciaDestino');
  if (grupoDependencia) {
    grupoDependencia.hidden = esRadicacionCiudadana;
    grupoDependencia.style.display = grupoDependencia.hidden ? 'none' : '';
  }
  [
    ['grupoFechaRadicacion', 'fechaRadicacion'],
    ['grupoFechaEntregaManual', 'fechaEntregaManual'],
    ['grupoDiasHabiles', 'diasHabiles'],
    ['grupoFechaEntrega', 'fechaEntrega']
  ].forEach(([grupoId, campoId]) => {
    const grupo = document.getElementById(grupoId);
    const campo = document.getElementById(campoId);
    if (grupo) {
      grupo.hidden = esRadicacionCiudadana;
      grupo.style.display = grupo.hidden ? 'none' : '';
    }
    if (campo) campo.required = !esRadicacionCiudadana;
  });
  if (esRadicacionCiudadana) {
    const fechaRadicacion = document.getElementById('fechaRadicacion');
    if (fechaRadicacion) {
      fechaRadicacion.value = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    }
    const fechaEntregaManual = document.getElementById('fechaEntregaManual');
    if (fechaEntregaManual) fechaEntregaManual.value = '';
    const diasHabiles = document.getElementById('diasHabiles');
    if (diasHabiles) diasHabiles.value = '';
    const fechaEntrega = document.getElementById('fechaEntrega');
    if (fechaEntrega) fechaEntrega.value = '';
  }
  const grupoSolicitudOriginal = document.getElementById('grupoSolicitudOriginalCiudadano');
  if (grupoSolicitudOriginal) {
    grupoSolicitudOriginal.hidden = true;
    grupoSolicitudOriginal.style.display = 'none';
  }
  const etiquetaSolicitudPdf = document.querySelector('label[for="solicitudPdf"]');
  if (etiquetaSolicitudPdf) {
    etiquetaSolicitudPdf.hidden = modo === 'gestion';
    etiquetaSolicitudPdf.textContent = modo === 'gestion'
      ? 'Oficio de gestión (PDF obligatorio)'
      : esRadicacionCiudadana
        ? 'Adjuntar Oficio (Archivo PDF obligatorio)'
        : 'Solicitud Escaneada (Archivo PDF)';
  }
  const ayudaSolicitudArchivo = document.getElementById('ayudaSolicitudArchivo');
  if (ayudaSolicitudArchivo) {
    ayudaSolicitudArchivo.hidden = !esRadicacionCiudadana;
    ayudaSolicitudArchivo.textContent = esRadicacionCiudadana ? 'Solo se admite PDF.' : '';
  }
  const titulo = document.getElementById('tituloFormularioRadicado');
  if (titulo) {
    titulo.textContent = esRadicacionCiudadana
      ? 'Formulario de Atención al Ciudadano'
      : 'Formulario de Radicación de Solicitud / PQRS';
  }
  const textoGuardar = document.getElementById('textoBtnGuardar');
  if (textoGuardar) textoGuardar.textContent = esRadicacionCiudadana ? 'Guardar' : 'Guardar Radicado';
  const ayuda = document.getElementById('ayudaFormulario');
  if (ayuda) {
    ayuda.textContent = modo === 'gestion'
      ? 'Selecciona una PQRS pendiente a la derecha para cargarla en este formulario.'
      : 'Registra tu solicitud para que sea atendida por la dependencia correspondiente.';
  }
  const botonGuardar = document.getElementById('btnGuardarRadicado');
  if (botonGuardar) {
    botonGuardar.disabled = modo === 'gestion' && !radicadoPendienteGestion;
  }
}

function obtenerFechaBogota(fecha) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric'
  }).format(fecha);
}

function actualizarFechaHoraRecepcion(fecha) {
  const fechaIso = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(fecha);
  const fechaVisible = fechaIso.split('-').reverse().join('-');
  const horaVisible = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(fecha);
  const fechaInput = document.getElementById('fechaRadicacionRecepcion');
  const horaInput = document.getElementById('horaRadicacionRecepcion');
  if (fechaInput) fechaInput.value = fechaVisible;
  if (horaInput) horaInput.value = horaVisible;
}

function actualizarCampoRadicadoRecepcion() {
  const sinNumeroRadicado = document.getElementById('sinNumeroRadicadoRecepcion')?.checked === true;
  const radicado = document.getElementById('radicadoRecepcion');
  if (radicado) {
    radicado.value = '';
    radicado.placeholder = sinNumeroRadicado
      ? 'No requiere número de radicado'
      : 'Se asignará automáticamente al guardar';
  }
}

function actualizarEstadoBotonGestion(abierto) {
  const boton = document.getElementById('toggleGestionPQRSF');
  if (!boton) return;
  boton.setAttribute('aria-expanded', String(abierto));
  boton.classList.toggle('is-collapsed', !abierto);
}

function actualizarEstadoBotonRecepcion(abierto) {
  const boton = document.getElementById('toggleRecepcionPQRSF');
  if (!boton) return;
  boton.setAttribute('aria-expanded', String(abierto));
  boton.classList.toggle('is-collapsed', !abierto);
}

function mostrarMensajePendientes(mensaje, esError = false) {
  const lista = document.getElementById('listaPQRSFpendientes');
  if (!lista) return;
  const estado = document.createElement('p');
  estado.className = 'pqrs-pending-empty';
  estado.setAttribute('role', esError ? 'alert' : 'status');
  estado.textContent = mensaje;
  lista.replaceChildren(estado);
}

function actualizarEstadoBibliotecaPdfGestion(mensaje = '', esError = false) {
  const estado = document.getElementById('estadoPdfGestion');
  if (!estado) return;
  estado.textContent = mensaje;
  estado.hidden = !mensaje;
  estado.classList.toggle('is-error', esError);
}

function actualizarContadorBibliotecaPdfGestion() {
  const contador = document.getElementById('contadorPdfGestion');
  if (contador) {
    contador.hidden = true;
    contador.textContent = '';
  }
  const boton = document.getElementById('btnSubirPdfGestion');
  if (boton) {
    const esAdministradorSesion = obtenerPerfilSesion()?.rol === 'administrador';
    boton.hidden = !esAdministradorSesion;
    boton.disabled = !esAdministradorSesion || cargaPdfGestionEnCurso;
    boton.textContent = cargaPdfGestionEnCurso ? 'Subiendo…' : 'Subir PDF';
  }
  const entrada = document.getElementById('archivosPdfGestion');
  if (entrada) entrada.disabled = cargaPdfGestionEnCurso;
}

function actualizarEtiquetaPdfGestion(nombre = '') {
  const etiqueta = document.getElementById('nombrePdfGestionSeleccionado');
  if (etiqueta) etiqueta.textContent = nombre || 'Buscar PDF en Google Drive';
  const boton = document.getElementById('abrirSelectorPdfGestion');
  if (boton) {
    boton.setAttribute(
      'aria-label',
      nombre ? `PDF seleccionado: ${nombre}. Cambiar PDF.` : 'Buscar PDF en Google Drive'
    );
  }
}

function renderizarResultadosBibliotecaPdfGestion() {
  const lista = document.getElementById('resultadosPdfGestion');
  const estado = document.getElementById('estadoBusquedaPdfGestion');
  if (!lista || !estado) return;

  const busqueda = String(document.getElementById('buscarPdfGestion')?.value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO');
  const normalizar = texto => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO');
  lista.replaceChildren();

  if (!busqueda) {
    estado.textContent = 'Escribe el nombre del PDF para ver coincidencias.';
    return;
  }

  if (!bibliotecaPdfGestionCargada) {
    estado.textContent = cargaBibliotecaPdfGestionEnCurso
      ? 'Consultando los PDF guardados en Google Drive…'
      : 'Se consultará Google Drive al buscar.';
    return;
  }

  const coincidencias = pdfsBibliotecaGestion.filter(pdf => (
    normalizar(pdf.nombre).includes(busqueda)
  ));

  if (!pdfsBibliotecaGestion.length) {
    estado.textContent = 'No hay PDF guardados. Usa “Subir PDF” para añadirlos a la biblioteca.';
    return;
  }
  if (!coincidencias.length) {
    estado.textContent = 'No se encontraron coincidencias.';
    return;
  }

  estado.textContent = `${coincidencias.length} resultado${coincidencias.length === 1 ? '' : 's'}`;
  coincidencias.forEach(pdf => {
    const elemento = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pqrs-pdf-picker-option';
    boton.textContent = pdf.nombre;
    boton.addEventListener('click', () => {
      document.getElementById('pdfGestionSeleccionado').value = pdf.url;
      actualizarEtiquetaPdfGestion(pdf.nombre);
      document.getElementById('modalSeleccionarPdfGestion')?.close();
    });
    elemento.append(boton);
    lista.append(elemento);
  });
}

function abrirDialogoSeleccionPdfGestion() {
  const dialogo = document.getElementById('modalSeleccionarPdfGestion');
  const busqueda = document.getElementById('buscarPdfGestion');
  if (!dialogo || dialogo.open) return;
  if (busqueda) busqueda.value = '';
  renderizarResultadosBibliotecaPdfGestion();
  dialogo.showModal();
  busqueda?.focus();
}

async function cargarPdfBibliotecaGestion(event) {
  const entrada = event.currentTarget;
  const archivos = Array.from(entrada.files || []);
  entrada.value = '';
  if (!archivos.length || cargaPdfGestionEnCurso) return;

  if (obtenerPerfilSesion()?.rol !== 'administrador') {
    actualizarEstadoBibliotecaPdfGestion('Solo el rol Administrador puede subir PDF de gestión.', true);
    return;
  }
  if (archivos.length > MAX_PDFS_POR_CARGA_GESTION) {
    actualizarEstadoBibliotecaPdfGestion(
      `Puedes seleccionar hasta ${MAX_PDFS_POR_CARGA_GESTION} PDF por cada carga.`,
      true
    );
    return;
  }

  cargaPdfGestionEnCurso = true;
  actualizarContadorBibliotecaPdfGestion();
  let cantidadCargada = 0;
  let nombreEnCarga = '';
  try {
    for (const archivo of archivos) {
      nombreEnCarga = archivo.name;
      actualizarEstadoBibliotecaPdfGestion(`Validando ${archivo.name}…`);
      const esPdf = /\.pdf$/i.test(archivo.name)
        && (!archivo.type || archivo.type.toLowerCase() === 'application/pdf');
      if (!esPdf || archivo.size > MAX_TAMANO_PDF_GESTION
        || await archivo.slice(0, 5).text() !== '%PDF-') {
        throw new Error(`“${archivo.name}” no es un PDF válido de máximo 10 MB.`);
      }
    }

    for (let indice = 0; indice < archivos.length; indice += 1) {
      const archivo = archivos[indice];
      nombreEnCarga = archivo.name;
      actualizarEstadoBibliotecaPdfGestion(
        `Subiendo PDF ${indice + 1} de ${archivos.length}: ${archivo.name}`
      );
      const usuario = auth.currentUser;
      if (!usuario?.uid) throw new Error('Debes iniciar sesión para subir PDF de gestión.');
      const idToken = await usuario.getIdToken();
      const base64 = await convertirABase64(archivo);
      const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadManagementPdf',
          uid: usuario.uid,
          idToken,
          archivoBase64: base64.split(',')[1] || '',
          mimeType: 'application/pdf',
          nombreArchivo: archivo.name
        })
      });
      const resultado = await respuesta.json();
      const url = obtenerUrlHttpsSegura(resultado?.url || '');
      if (!respuesta.ok || resultado?.status !== 'success' || !url) {
        throw new Error(resultado?.message || 'Google Drive no confirmó el archivo.');
      }
      pdfsBibliotecaGestion.push({ nombre: archivo.name, url });
      cantidadCargada += 1;
      actualizarContadorBibliotecaPdfGestion();
      renderizarResultadosBibliotecaPdfGestion();
    }
    actualizarEstadoBibliotecaPdfGestion();
  } catch (error) {
    console.error('No fue posible subir un PDF de gestión:', nombreEnCarga, error);
    const resumenCarga = cantidadCargada
      ? `Se cargaron ${cantidadCargada} de ${archivos.length}. `
      : 'No se cargó ningún archivo. ';
    actualizarEstadoBibliotecaPdfGestion(
      `${resumenCarga}No se pudo cargar “${nombreEnCarga}”: ${error.message}`,
      true
    );
  } finally {
    cargaPdfGestionEnCurso = false;
    actualizarContadorBibliotecaPdfGestion();
  }
}

async function cargarBibliotecaPdfGestion() {
  if (
    obtenerPerfilSesion()?.rol !== 'administrador'
    || bibliotecaPdfGestionCargada
    || cargaBibliotecaPdfGestionEnCurso
  ) return;
  cargaBibliotecaPdfGestionEnCurso = true;
  actualizarEstadoBibliotecaPdfGestion('Consultando los PDF guardados en Google Drive…');
  try {
    const usuario = auth.currentUser;
    if (!usuario?.uid) throw new Error('Debes iniciar sesión para consultar la biblioteca.');
    const idToken = await usuario.getIdToken();
    const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'listManagementPdfs',
        uid: usuario.uid,
        idToken
      })
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok || resultado?.status !== 'success' || !Array.isArray(resultado.files)) {
      throw new Error(resultado?.message || 'Google Drive no devolvió la biblioteca de PDF.');
    }
    const archivos = resultado.files.map(archivo => {
      const nombre = String(archivo?.name || '').trim();
      const url = obtenerUrlHttpsSegura(archivo?.url || '');
      if (!nombre || !url) {
        throw new Error('Google Drive devolvió un PDF sin nombre o con enlace no válido.');
      }
      return { nombre, url };
    });
    pdfsBibliotecaGestion.splice(0, pdfsBibliotecaGestion.length, ...archivos);
    bibliotecaPdfGestionCargada = true;
    const selector = document.getElementById('pdfGestionSeleccionado');
    const pdfSeleccionado = archivos.find(pdf => pdf.url === selector?.value);
    if (selector?.value && !pdfSeleccionado) {
      selector.value = '';
      actualizarEtiquetaPdfGestion();
    } else if (pdfSeleccionado) {
      actualizarEtiquetaPdfGestion(pdfSeleccionado.nombre);
    }
    actualizarContadorBibliotecaPdfGestion();
    renderizarResultadosBibliotecaPdfGestion();
    actualizarEstadoBibliotecaPdfGestion();
  } catch (error) {
    console.error('No fue posible consultar los PDF de gestión en Google Drive:', error);
    actualizarEstadoBibliotecaPdfGestion(
      `No fue posible cargar la biblioteca de PDF: ${error.message}`,
      true
    );
    const estadoModal = document.getElementById('estadoBusquedaPdfGestion');
    if (estadoModal && document.getElementById('modalSeleccionarPdfGestion')?.open) {
      estadoModal.textContent = `No fue posible consultar los PDF: ${error.message}`;
    }
  } finally {
    cargaBibliotecaPdfGestionEnCurso = false;
  }
}

function establecerDependenciasGestion(registro) {
  const seleccionadas = new Set(
    Array.isArray(registro.dependenciasDestino)
      ? registro.dependenciasDestino
      : registro.dependencia && registro.dependencia !== 'Ventanilla Única'
        ? [registro.dependencia]
        : []
  );
  document.querySelectorAll('input[name="dependenciasDestinoPqrs"]').forEach(casilla => {
    casilla.checked = seleccionadas.has(casilla.value);
  });
  actualizarResumenDependenciasPqrs();
}

async function seleccionarPQRSFPendiente(id, registro, botonSeleccion) {
  if (seleccionPQRSFPendienteEnCurso) return;
  if (obtenerPerfilSesion()?.rol !== 'administrador') {
    alert('Solo el rol Administrador puede gestionar PQRS.');
    return;
  }
  seleccionPQRSFPendienteEnCurso = true;
  const inicioCarga = Date.now();
  const botonesDisponibles = Array.from(
    document.querySelectorAll('.pqrs-pending-item:not(:disabled)')
  );
  botonesDisponibles.forEach(boton => {
    boton.disabled = true;
  });
  const indicadorCarga = document.createElement('span');
  indicadorCarga.className = 'pqrs-pending-spinner';
  indicadorCarga.setAttribute('aria-hidden', 'true');
  if (botonSeleccion) {
    botonSeleccion.setAttribute('aria-busy', 'true');
    botonSeleccion.append(indicadorCarga);
  }
  const esperarCargaMinima = async () => {
    const tiempoRestante = 2000 - (Date.now() - inicioCarga);
    if (tiempoRestante > 0) {
      await new Promise(resolve => window.setTimeout(resolve, tiempoRestante));
    }
  };

  try {
    const usuario = auth.currentUser;
    if (!usuario?.uid) {
      await esperarCargaMinima();
      alert('No se pudo identificar la cuenta que reservará esta PQRS.');
      return;
    }

    const referencia = doc(db, RADICADOS_COLLECTION, id);
    const consultaReservasUsuario = query(
      collection(db, RADICADOS_COLLECTION),
      where('gestionAsignadaUid', '==', usuario.uid)
    );
    const nombreGestor = String(
      obtenerPerfilSesion()?.nombre || usuario.email || 'Administrador'
    );
    let tokenPresencia = '';
    try {
      tokenPresencia = await obtenerTokenPresenciaPQRS(usuario.uid);
      const reservasUsuario = await getDocs(consultaReservasUsuario);
      const referenciasReservasUsuario = reservasUsuario.docs
        .filter(reserva => reserva.id !== id)
        .map(reserva => reserva.ref);
      await runTransaction(db, async transaccion => {
        const [pendiente, ...reservas] = await Promise.all([
          transaccion.get(referencia),
          ...referenciasReservasUsuario.map(reservaRef => transaccion.get(reservaRef))
        ]);
        if (!pendiente.exists() || pendiente.data().estado !== 'PENDIENTE_GESTION') {
          throw new Error('Esta PQRS ya no está pendiente por gestionar.');
        }
        const asignadoUid = pendiente.data().gestionAsignadaUid || '';
        if (asignadoUid && asignadoUid !== usuario.uid) {
          throw new Error(
            `Esta PQRS ya está reservada por ${pendiente.data().gestionAsignadaNombre || 'otra persona'}.`
          );
        }
        reservas.forEach(reserva => {
          if (
            reserva.exists()
            && reserva.data().estado === 'PENDIENTE_GESTION'
            && reserva.data().gestionAsignadaUid === usuario.uid
          ) {
            transaccion.update(reserva.ref, {
              gestionAsignadaUid: '',
              gestionAsignadaNombre: '',
              gestionAsignadaEn: '',
              gestionAsignadaPresenciaToken: ''
            });
          }
        });
        transaccion.update(referencia, {
          gestionAsignadaUid: usuario.uid,
          gestionAsignadaNombre: nombreGestor,
          gestionAsignadaEn: new Date().toISOString(),
          gestionAsignadaPresenciaToken: tokenPresencia
        });
      });
    } catch (error) {
      await esperarCargaMinima();
      console.error('No fue posible reservar la PQRS pendiente:', error);
      alert(error.message || 'No fue posible reservar la PQRS.');
      await cargarPQRSFPendientes();
      return;
    }

    await esperarCargaMinima();
    radicadoPendienteGestion = id;
    datosPendienteGestion = {
      ...registro,
      gestionAsignadaUid: usuario.uid,
      gestionAsignadaNombre: nombreGestor,
      gestionAsignadaPresenciaToken: tokenPresencia
    };
    document.getElementById('pqrsForm')?.reset();
    actualizarEtiquetaPdfGestion();
    establecerModoFormularioPQRSF('gestion');
    document.getElementById('radicado').value = registro.radicado || '';
    document.getElementById('tipoCanal').value = registro.tipoCanal || '';
    document.getElementById('estadoSolicitud').value = 'VIGENTE';
    document.getElementById('fechaRadicacion').value = registro.fechaRadicacion || '';
    document.getElementById('fechaEntregaManual').value = registro.fechaEntregaManual || '';
    document.getElementById('diasHabiles').value = registro.diasHabiles || '';
    document.getElementById('remitente').value = registro.remitente || '';
    document.getElementById('asunto').value = registro.asunto || '';
    document.getElementById('folios').value = registro.folios ?? '';
    document.getElementById('anexos').value = registro.anexos ?? '';
    document.getElementById('tipoNotificacionCiudadano').value = registro.notificacionRespuestaTipo || '';
    document.getElementById('contactoNotificacionCiudadano').value = registro.notificacionRespuestaContacto || '';
    actualizarCampoNotificacionRespuesta(
      'tipoNotificacionCiudadano',
      'contactoNotificacionCiudadano',
      'etiquetaContactoNotificacionCiudadano'
    );
    const formularioRecepcion = document.getElementById('contenedorFormularioRecepcion');
    if (formularioRecepcion) formularioRecepcion.style.display = 'none';
    actualizarEstadoBotonRecepcion(false);
    const grupoSolicitudOriginal = document.getElementById('grupoSolicitudOriginalCiudadano');
    const enlaceSolicitudOriginal = document.getElementById('enlaceSolicitudOriginalCiudadano');
    const esSolicitudConDocumentoAdjunto = ['ciudadano', 'recepcion'].includes(registro.origenSolicitud);
    const urlSolicitudOriginal = obtenerUrlHttpsSegura(
      registro.pdfCiudadanoUrl || (esSolicitudConDocumentoAdjunto ? registro.pdfUrl : '')
    );
    if (grupoSolicitudOriginal && enlaceSolicitudOriginal && urlSolicitudOriginal) {
      enlaceSolicitudOriginal.href = urlSolicitudOriginal;
      enlaceSolicitudOriginal.textContent = registro.pdfCiudadanoNombre
        || (registro.origenSolicitud === 'recepcion'
          ? 'Abrir documento adjunto en Recepción'
          : 'Abrir solicitud original del ciudadano');
      grupoSolicitudOriginal.hidden = false;
      grupoSolicitudOriginal.style.display = '';
    }
    establecerDependenciasGestion(registro);
    calcularFechaVencimiento();
    establecerFormularioVisible(true);
    await cargarPQRSFPendientes();
  } finally {
    botonesDisponibles.forEach(boton => {
      if (boton.isConnected) boton.disabled = false;
    });
    if (botonSeleccion?.isConnected) {
      botonSeleccion.removeAttribute('aria-busy');
      indicadorCarga.remove();
    }
    seleccionPQRSFPendienteEnCurso = false;
  }
}

export async function liberarReservasPQRSFGestionUsuario() {
  if (obtenerPerfilSesion()?.rol !== 'administrador') return;
  const usuarioUid = auth.currentUser?.uid || '';
  if (!usuarioUid) return;

  const consultaReservasUsuario = query(
    collection(db, RADICADOS_COLLECTION),
    where('gestionAsignadaUid', '==', usuarioUid)
  );
  const reservasUsuario = await getDocs(consultaReservasUsuario);
  const referenciasReservasUsuario = reservasUsuario.docs.map(reserva => reserva.ref);
  await runTransaction(db, async transaccion => {
    const reservas = await Promise.all(
      referenciasReservasUsuario.map(referencia => transaccion.get(referencia))
    );
    reservas.forEach(reserva => {
      if (
        reserva.exists()
        && reserva.data().estado === 'PENDIENTE_GESTION'
        && reserva.data().gestionAsignadaUid === usuarioUid
      ) {
        transaccion.update(reserva.ref, {
          gestionAsignadaUid: '',
          gestionAsignadaNombre: '',
          gestionAsignadaEn: '',
          gestionAsignadaPresenciaToken: ''
        });
      }
    });
  });
  radicadoPendienteGestion = '';
  datosPendienteGestion = null;
  observadoresPresenciaPQRS.forEach(desuscribir => desuscribir());
  observadoresPresenciaPQRS.clear();
  await detenerPresenciaPQRS();
}

async function liberarReservaPorDesconexion(id, usuarioUid, tokenEsperado) {
  const referencia = doc(db, RADICADOS_COLLECTION, id);
  return runTransaction(db, async transaccion => {
    const pendiente = await transaccion.get(referencia);
    if (!pendiente.exists()) return false;
    const datos = pendiente.data();
    if (
      datos.estado !== 'PENDIENTE_GESTION'
      || datos.gestionAsignadaUid !== usuarioUid
      || (datos.gestionAsignadaPresenciaToken || '') !== tokenEsperado
    ) return false;

    transaccion.update(referencia, {
      gestionAsignadaUid: '',
      gestionAsignadaNombre: '',
      gestionAsignadaEn: '',
      gestionAsignadaPresenciaToken: ''
    });
    return true;
  });
}

async function procesarDesconexionPQRS(id, usuarioUid, token) {
  const clave = `${id}:${token}`;
  if (reservasPQRSEnLiberacion.has(clave)) return;
  reservasPQRSEnLiberacion.add(clave);
  try {
    if (await liberarReservaPorDesconexion(id, usuarioUid, token)) {
      await cargarPQRSFPendientes();
    }
  } catch (error) {
    console.error('No fue posible liberar la PQRS después de una desconexión:', error);
  } finally {
    reservasPQRSEnLiberacion.delete(clave);
  }
}

function sincronizarObservadoresPresencia(registros) {
  const asignacionesActivas = new Map(
    registros
      .filter(registro => registro.gestionAsignadaUid && registro.gestionAsignadaPresenciaToken)
      .map(registro => [
        `${registro.id}:${registro.gestionAsignadaPresenciaToken}`,
        registro
      ])
  );
  observadoresPresenciaPQRS.forEach((desuscribir, clave) => {
    if (!asignacionesActivas.has(clave)) {
      desuscribir();
      observadoresPresenciaPQRS.delete(clave);
    }
  });
  asignacionesActivas.forEach((registro, clave) => {
    if (observadoresPresenciaPQRS.has(clave)) return;
    const desuscribir = observarPresenciaPQRS(
      registro.gestionAsignadaPresenciaToken,
      presencia => {
        if (presencia?.uid !== registro.gestionAsignadaUid) {
          void procesarDesconexionPQRS(
            registro.id,
            registro.gestionAsignadaUid,
            registro.gestionAsignadaPresenciaToken
          );
        }
      },
      error => console.error('No fue posible observar la conexión de quien gestiona la PQRS:', error)
    );
    observadoresPresenciaPQRS.set(clave, desuscribir);
  });
}

function obtenerEstadoVisibleCiudadano(registro) {
  const respuestaCargada = typeof registro.respuestaUrl === 'string'
    && registro.respuestaUrl.trim().startsWith('http');
  if (respuestaCargada) return 'Respondida';
  if (
    registro.estado === 'R. por C.'
    || (Array.isArray(registro.dependenciasDestino) && registro.dependenciasDestino.length > 0)
  ) {
    return 'Remitida por competencia';
  }
  if (registro.estado === 'PENDIENTE_GESTION') return 'Pendiente por gestionar';

  const estadoAutomatico = evaluarEstadoAutomatico(
    registro.fechaVencimiento || '',
    registro.respuestaUrl || '',
    registro.otrosEstados || '',
    registro.estado || 'VIGENTE'
  );

  if (estadoAutomatico.texto === 'CERRADO') return 'Respondida';
  if (estadoAutomatico.texto === 'EN TRÁMITE') return 'En trámite';
  if (estadoAutomatico.texto === 'EXTEMPORÁNEA') return 'Extemporánea';
  if (estadoAutomatico.texto === 'PRÓXIMO A VENCER') return 'Próxima a vencer';
  return 'Vigente';
}

function obtenerDetalleEstadoCiudadano(registro) {
  const respuestaCargada = Boolean(
    typeof registro.respuestaUrl === 'string'
    && registro.respuestaUrl.trim().startsWith('http')
  );
  const dependenciaAsignada = String(registro.dependencia || '').trim();
  if (respuestaCargada) {
    const asignacion = dependenciaAsignada
      ? ` Fue gestionada por la dependencia ${dependenciaAsignada}.`
      : '';
    return `Tu solicitud fue respondida y el documento de respuesta ya fue cargado. Se encuentra cerrada.${asignacion}`;
  }

  if (
    registro.estado === 'R. por C.'
    || (Array.isArray(registro.dependenciasDestino) && registro.dependenciasDestino.length > 0)
  ) {
    const dependenciasDestino = Array.isArray(registro.dependenciasDestino)
      ? registro.dependenciasDestino.filter(dependencia => typeof dependencia === 'string' && dependencia.trim())
      : [];
    const narrativas = [];
    narrativas.push(dependenciasDestino.length
      ? `Tu solicitud fue remitida por competencia a: ${dependenciasDestino.join(', ')}.`
      : 'Tu solicitud fue remitida por competencia a otra dependencia para su trámite.');
    if (dependenciaAsignada) {
      narrativas.push(`Dependencia asignada: ${dependenciaAsignada}.`);
    }
    return narrativas.join(' ');
  }
  if (registro.estado === 'PENDIENTE_GESTION') {
    return dependenciaAsignada
      ? `Tu solicitud fue recibida y está pendiente de revisión. Dependencia asignada: ${dependenciaAsignada}.`
      : 'Tu solicitud fue recibida y está pendiente de revisión y asignación a la dependencia correspondiente.';
  }

  const otrosEstados = String(registro.otrosEstados || '').toLowerCase();
  if (otrosEstados.includes('para conocimiento') || otrosEstados.includes('no requiere respuesta')) {
    return 'Tu solicitud fue gestionada y se encuentra cerrada según la opción registrada por la dependencia.';
  }

  if (registro.enTramite || String(registro.funcionarioAsignado || '').trim()) {
    return 'Tu solicitud fue asignada y se encuentra en trámite.';
  }

  const estadoAutomatico = evaluarEstadoAutomatico(
    registro.fechaVencimiento || '',
    registro.respuestaUrl || '',
    registro.otrosEstados || '',
    registro.estado || 'VIGENTE'
  );
  if (estadoAutomatico.texto === 'EXTEMPORÁNEA') {
    return 'El plazo de respuesta ya venció y tu solicitud continúa pendiente de atención.';
  }
  if (estadoAutomatico.texto === 'PRÓXIMO A VENCER') {
    return 'Tu solicitud está próxima a vencer y continúa en trámite.';
  }
  return dependenciaAsignada
    ? `Tu solicitud fue asignada a la dependencia ${dependenciaAsignada} y se encuentra vigente mientras continúa su gestión.`
    : 'Tu solicitud fue asignada a una dependencia y se encuentra vigente mientras continúa su gestión.';
}

function formatearFechaEstadoCiudadano(fecha) {
  const coincidencia = typeof fecha === 'string'
    && fecha.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : '';
}

function obtenerFechaEstadoCiudadano(registro) {
  const respuestaCargada = typeof registro.respuestaUrl === 'string'
    && registro.respuestaUrl.trim().startsWith('http');
  if (respuestaCargada) {
    return { etiqueta: 'Fecha de respuesta', fecha: registro.fechaCargaRespuesta };
  }
  if (
    registro.estado === 'R. por C.'
    || (Array.isArray(registro.dependenciasDestino) && registro.dependenciasDestino.length > 0)
  ) {
    return {
      etiqueta: 'Fecha de remisión',
      fecha: registro.fechaRemisionCompetencia || registro.fechaRecepcionCompetencia
    };
  }
  if (registro.estado === 'PENDIENTE_GESTION') {
    return {
      etiqueta: 'Fecha de recepción',
      fecha: registro.fechaRecepcion || registro.fechaHoraRadicacion || registro.fechaRadicacion
    };
  }
  const otrosEstados = String(registro.otrosEstados || '').toLowerCase();
  if (otrosEstados.includes('para conocimiento') || otrosEstados.includes('no requiere respuesta')) {
    return { etiqueta: 'Fecha de gestión', fecha: registro.fechaCargaRespuesta };
  }
  if (registro.enTramite || String(registro.funcionarioAsignado || '').trim()) {
    return {
      etiqueta: 'Fecha de asignación',
      fecha: registro.fechaCambioEstado || registro.fechaAsignacion
    };
  }
  const estadoAutomatico = evaluarEstadoAutomatico(
    registro.fechaVencimiento || '',
    registro.respuestaUrl || '',
    registro.otrosEstados || '',
    registro.estado || 'VIGENTE'
  );
  if (estadoAutomatico.texto === 'EXTEMPORÁNEA' || estadoAutomatico.texto === 'PRÓXIMO A VENCER') {
    return { etiqueta: 'Fecha de vencimiento', fecha: registro.fechaVencimiento };
  }
  return {
    etiqueta: registro.fechaCambioEstado ? 'Fecha de actualización del estado' : 'Fecha de radicación',
    fecha: registro.fechaCambioEstado || registro.fechaRadicacion
  };
}

function obtenerUrlDescargaPdfCiudadano(url) {
  const urlSegura = obtenerUrlHttpsSegura(url);
  if (!urlSegura) return '';
  const idDrive = urlSegura.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    || urlSegura.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idDrive) return urlSegura;
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(idDrive[1])}`;
}

function crearEnlaceDescargaPdfCiudadano(etiqueta, url) {
  const href = obtenerUrlDescargaPdfCiudadano(url);
  if (!href) return null;
  const enlace = document.createElement('a');
  enlace.href = href;
  enlace.textContent = etiqueta;
  enlace.target = '_blank';
  enlace.rel = 'noopener noreferrer';
  enlace.download = '';
  return enlace;
}

async function consultarEstadoCiudadano(event) {
  event.preventDefault();
  const input = document.getElementById('radicadoConsultaCiudadano');
  const resultado = document.getElementById('resultadoConsultaCiudadano');
  if (!input || !resultado) return;

  const radicado = input.value.trim().toUpperCase();
  resultado.className = 'citizen-status-result';
  if (!radicado) {
    resultado.textContent = 'Ingresa el número de radicado.';
    input.focus();
    return;
  }

  resultado.textContent = 'Consultando...';
  try {
    const referencia = doc(db, COLECCION_CONSULTA_PUBLICA, radicado);
    const snapshot = await getDoc(referencia);
    if (!snapshot.exists()) {
      resultado.textContent = 'No encontramos una solicitud con ese número de radicado.';
      return;
    }

    const registro = snapshot.data();

    const estado = obtenerEstadoVisibleCiudadano(registro);
    resultado.classList.add('is-found');
    resultado.replaceChildren();
    const numero = document.createElement('strong');
    numero.textContent = radicado;
    const estadoTexto = document.createElement('span');
    estadoTexto.textContent = `Estado actual: ${estado}`;
    const detalle = document.createElement('span');
    detalle.textContent = obtenerDetalleEstadoCiudadano(registro);
    resultado.append(numero, estadoTexto, detalle);

    const fechaEstado = obtenerFechaEstadoCiudadano(registro);
    const fechaVisible = formatearFechaEstadoCiudadano(fechaEstado.fecha);
    if (fechaVisible) {
      const fechaTexto = document.createElement('span');
      fechaTexto.textContent = `${fechaEstado.etiqueta}: ${fechaVisible}`;
      resultado.append(fechaTexto);
    }

    const archivosRespuesta = Array.isArray(registro.respuestaArchivos)
      ? registro.respuestaArchivos.filter(url => (
        typeof url === 'string' && url.trim().startsWith('https://')
      )).slice(0, 10)
      : [];
    if (!archivosRespuesta.length
      && typeof registro.respuestaUrl === 'string'
      && registro.respuestaUrl.trim().startsWith('https://')) {
      archivosRespuesta.push(registro.respuestaUrl);
    }
    const respuestaCargada = archivosRespuesta.length > 0;
    const enlacesPdf = document.createElement('div');
    enlacesPdf.className = 'citizen-status-files';
    archivosRespuesta.forEach((url, indice) => {
      const descargaRespuesta = crearEnlaceDescargaPdfCiudadano(
        `Descargar PDF de respuesta ${indice + 1}`,
        url
      );
      if (descargaRespuesta) enlacesPdf.append(descargaRespuesta);
    });
    if (registro.respuestaSoloEvidencia === true) {
      const indicacionEvidencia = document.createElement('span');
      indicacionEvidencia.className = 'citizen-status-extension';
      indicacionEvidencia.textContent = 'Los documentos se cargaron como evidencia y no se enviaron por correo. Están disponibles para consulta; para recibir atención presencial, acude a la dependencia responsable.';
      resultado.append(indicacionEvidencia);
    }

    const prorroga = !respuestaCargada && registro.prorroga && typeof registro.prorroga === 'object'
      ? registro.prorroga
      : null;
    if (prorroga) {
      const informacionProrroga = document.createElement('span');
      informacionProrroga.className = 'citizen-status-extension';
      const fechaAnterior = formatearFechaEstadoCiudadano(prorroga.fechaAnterior);
      const nuevaFecha = formatearFechaEstadoCiudadano(prorroga.nuevaFecha);
      const fechaRegistroProrroga = formatearFechaEstadoCiudadano(prorroga.registradoEn);
      const diasAdicionales = Number(prorroga.diasHabilesAdicionales);
      const datosProrroga = [];
      if (Number.isFinite(diasAdicionales) && diasAdicionales > 0) {
        datosProrroga.push(`${diasAdicionales} días hábiles adicionales`);
      }
      if (fechaAnterior) datosProrroga.push(`fecha anterior: ${fechaAnterior}`);
      if (nuevaFecha) datosProrroga.push(`nueva fecha de vencimiento: ${nuevaFecha}`);
      if (fechaRegistroProrroga) datosProrroga.push(`registrada el: ${fechaRegistroProrroga}`);
      informacionProrroga.textContent = datosProrroga.length
        ? `Se otorgó una prórroga (${datosProrroga.join('; ')}).`
        : 'Se otorgó una prórroga a tu solicitud.';
      resultado.append(informacionProrroga);
      const descargaProrroga = crearEnlaceDescargaPdfCiudadano('Descargar oficio de prórroga', prorroga.archivoUrl);
      if (descargaProrroga) enlacesPdf.append(descargaProrroga);
    }

    if (enlacesPdf.childElementCount) resultado.append(enlacesPdf);
  } catch (error) {
    console.error('No fue posible consultar el estado del radicado:', error);
    resultado.textContent = 'No fue posible realizar la consulta. Dirígete a la Ventanilla Única de la Alcaldía Municipal.';
  }
}

async function cargarPQRSFPendientes() {
  mostrarMensajePendientes('Cargando PQRS pendientes…');
  try {
    const pendientes = await getDocs(query(
      collection(db, RADICADOS_COLLECTION),
      where('estado', '==', 'PENDIENTE_GESTION')
    ));
    const registros = pendientes.docs
      .map(documento => ({ id: documento.id, ...documento.data() }))
      .sort(compararRadicadosPendientes);
    const lista = document.getElementById('listaPQRSFpendientes');
    if (!lista) {
      sincronizarObservadoresPresencia([]);
      return;
    }
    let seLiberaronReservasAntiguas = false;
    for (const registro of registros) {
      if (registro.gestionAsignadaUid && !registro.gestionAsignadaPresenciaToken) {
        try {
          seLiberaronReservasAntiguas = await liberarReservaPorDesconexion(
            registro.id,
            registro.gestionAsignadaUid,
            ''
          ) || seLiberaronReservasAntiguas;
        } catch (error) {
          console.error('No fue posible limpiar una reserva antigua de PQRS:', error);
        }
      }
    }
    if (seLiberaronReservasAntiguas) {
      await cargarPQRSFPendientes();
      return;
    }
    sincronizarObservadoresPresencia(registros);
    const canalPendientes = obtenerCanalPendientesSesion();
    const registrosVisibles = canalPendientes
      ? registros.filter(registro => registro.tipoCanal === canalPendientes)
      : registros;
    if (!registrosVisibles.length) {
      const mensajeVacio = canalPendientes === 'Presencial'
        ? 'No hay PQRS presenciales pendientes por gestionar.'
        : canalPendientes === 'Virtual'
          ? 'No hay PQRS virtuales pendientes por gestionar.'
          : 'No hay PQRS pendientes por gestionar.';
      mostrarMensajePendientes(mensajeVacio);
      return;
    }

    cantidadVisiblePendientes = 6;
    lista.replaceChildren();
    const renderizarPendientes = () => {
      lista.replaceChildren();
      registrosVisibles.slice(0, cantidadVisiblePendientes).forEach(registro => {
        const entrada = document.createElement('div');
        entrada.className = 'pqrs-pending-entry';
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'pqrs-pending-item';
        const usuarioUid = auth.currentUser?.uid || '';
        const asignadoUid = registro.gestionAsignadaUid || '';
        const asignadoPorOtraPersona = Boolean(asignadoUid && asignadoUid !== usuarioUid);
        boton.disabled = asignadoPorOtraPersona
          || obtenerPerfilSesion()?.rol !== 'administrador';
        const numero = document.createElement('span');
        numero.className = 'pqrs-pending-number';
        numero.textContent = registro.sinNumeroRadicado
          ? 'No requiere número de radicado'
          : registro.radicado || 'Sin radicado';
        const detalle = document.createElement('span');
        detalle.className = 'pqrs-pending-details';
        const detalles = [
          registro.remitente || 'Remitente por completar',
          registro.asunto || 'Asunto por completar'
        ];
        if (asignadoUid) {
          detalles.push(asignadoPorOtraPersona
            ? `En gestión por ${registro.gestionAsignadaNombre || 'otra persona'}`
            : 'Reservada por ti');
        }
        detalle.textContent = detalles.join(' · ');
        boton.append(numero, detalle);
        if (!asignadoPorOtraPersona) {
          boton.addEventListener('click', () => seleccionarPQRSFPendiente(registro.id, registro, boton));
        }
        entrada.append(boton);
        lista.append(entrada);
      });

      if (cantidadVisiblePendientes < registrosVisibles.length) {
        const verMas = document.createElement('button');
        verMas.type = 'button';
        verMas.className = 'pqrs-pending-show-more';
        verMas.textContent = 'Ver más...';
        verMas.addEventListener('click', () => {
          cantidadVisiblePendientes += 6;
          renderizarPendientes();
        });
        lista.append(verMas);
      }
    };
    renderizarPendientes();
  } catch (error) {
    console.error('No fue posible consultar las PQRS pendientes:', error);
    mostrarMensajePendientes(`No fue posible cargar las PQRS pendientes: ${error.message}`, true);
  }
}

async function guardarRecepcionPQRSF(ahora, archivoPdf) {
  const anio = Number(obtenerFechaBogota(ahora));
  const fechaRadicacion = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(ahora);
  const horaRadicacion = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(ahora);
  const secuenciaRef = doc(db, COLECCION_SECUENCIAS_ENTRADA, String(anio));
  const radicadoRef = doc(collection(db, RADICADOS_COLLECTION));
  const tipoCanal = document.getElementById('tipoCanalRecepcion').value;
  const remitente = formatearMayusculasIniciales(document.getElementById('remitenteRecepcion').value.trim());
  const asunto = formatearMayusculasIniciales(document.getElementById('asuntoRecepcion').value.trim());
  const foliosValue = document.getElementById('foliosRecepcion').value;
  const anexosValue = document.getElementById('anexosRecepcion').value;
  const dependencia = document.getElementById('dependenciaResponsableRecepcion').value;
  const diasHabiles = document.getElementById('tiempoRespuestaRecepcion').value;
  const observaciones = formatearMayusculasIniciales(
    document.getElementById('observacionesRecepcion').value.trim()
  );
  const notificacionRespuestaTipo = document.getElementById('tipoNotificacionRecepcion').value;
  const notificacionRespuestaContacto = document.getElementById('contactoNotificacionRecepcion')?.value.trim() || '';
  const sinNumeroRadicado = document.getElementById('sinNumeroRadicadoRecepcion')?.checked === true;
  const textoBoton = document.getElementById('textoBtnGuardarRecepcion');
  let pdfUrl = '';
  const datosRecepcion = {
    origenSolicitud: 'recepcion',
    estado: 'PENDIENTE_GESTION',
    tipoCanal,
    fechaRadicacion,
    fechaHoraRadicacion: ahora.toISOString(),
    horaRadicacion,
    fechaRecepcion: ahora.toISOString(),
    fechaEntregaManual: '',
    diasHabiles,
    fechaVencimiento: '',
    remitente,
    asunto,
    folios: foliosValue === '' ? '' : Number(foliosValue),
    anexos: anexosValue === '' ? '' : Number(anexosValue),
    observaciones,
    notificacionRespuestaTipo,
    notificacionRespuestaContacto,
    dependenciaResponsable: dependencia,
    pdfUrl: '',
    dependencia: dependencia || 'Ventanilla Única'
  };

  try {
    if (archivoPdf) {
      if (textoBoton) textoBoton.textContent = 'Subiendo PDF...';
      const base64Pdf = await convertirABase64(archivoPdf);
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          archivoBase64: base64Pdf.split(',')[1] || '',
          mimeType: 'application/pdf',
          nombreArchivo: `Solicitud_${radicadoRef.id}_${archivoPdf.name}`
        })
      });
      const resultadoSubida = await response.json();
      if (!response.ok || resultadoSubida.status !== 'success' || !resultadoSubida.url) {
        throw new Error(`No fue posible subir el PDF: ${resultadoSubida.message || 'respuesta inválida de Google Drive.'}`);
      }
      pdfUrl = resultadoSubida.url;
      if (!obtenerUrlHttpsSegura(pdfUrl)) {
        throw new Error('Google Drive devolvió una URL no válida para el PDF.');
      }
    }

    if (textoBoton) textoBoton.textContent = 'Guardando recepción...';
    const numeroRadicado = await runTransaction(db, async transaccion => {
      if (sinNumeroRadicado) {
        transaccion.set(radicadoRef, {
          ...datosRecepcion,
          pdfUrl,
          radicado: '',
          sinNumeroRadicado: true,
          numeroSecuencia: 0,
          anio
        });
        return '';
      }

      const secuencia = await transaccion.get(secuenciaRef);
      const ultimo = obtenerUltimoSecuenciaEntrada(anio, secuencia);
      if (!Number.isSafeInteger(ultimo) || ultimo < 0 || ultimo >= 99999) {
        throw new Error(`La secuencia de radicados de entrada para ${anio} no es válida o se agotó.`);
      }
      const numero = ultimo + 1;
      const radicado = formatearRadicadoEntrada(anio, numero);
      transaccion.set(secuenciaRef, {
        anio,
        ultimo: numero,
        ultimoRadicado: radicado
      });
      transaccion.set(radicadoRef, {
        ...datosRecepcion,
        pdfUrl,
        radicado,
        numeroSecuencia: numero,
        anio
      });
      return radicado;
    });

    return { id: radicadoRef.id, radicado: numeroRadicado };
  } catch (error) {
    if (pdfUrl) {
      try {
        const respuestaEliminacion = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'delete', pdfUrl })
        });
        const resultadoEliminacion = await respuestaEliminacion.json();
        if (!respuestaEliminacion.ok || resultadoEliminacion.status !== 'success') {
          throw new Error(resultadoEliminacion.message || 'respuesta inválida de Google Drive.');
        }
      } catch (errorLimpieza) {
        console.error('No fue posible limpiar el PDF de recepción que no se guardó:', pdfUrl, errorLimpieza);
        throw new Error(`${error.message} Además, no se pudo eliminar de Drive el PDF que no quedó guardado.`);
      }
    }
    throw error;
  }
}

async function procesarFormularioRecepcionPQRSF(event) {
  event.preventDefault();
  const tipoNotificacion = document.getElementById('tipoNotificacionRecepcion')?.value || '';
  const contactoNotificacion = document.getElementById('contactoNotificacionRecepcion');
  if (!tipoNotificacion) {
    alert('Selecciona el medio de Notificación de Respuesta.');
    document.getElementById('tipoNotificacionRecepcion')?.focus();
    return;
  }
  if (tipoNotificacion !== 'Presencial' && !contactoNotificacion?.value.trim()) {
    alert('Ingresa el dato correspondiente al medio de notificación.');
    contactoNotificacion?.focus();
    return;
  }
  if (tipoNotificacion === 'Presencial' && contactoNotificacion) {
    contactoNotificacion.value = '';
  }
  const inputArchivoPdf = document.getElementById('archivoPdfRecepcion');
  const archivoPdf = inputArchivoPdf?.files?.[0] || null;
  if (archivoPdf) {
    const esPdf = /\.pdf$/i.test(archivoPdf.name)
      && (!archivoPdf.type || archivoPdf.type.toLowerCase() === 'application/pdf');
    if (!esPdf || archivoPdf.size > 10 * 1024 * 1024
      || await archivoPdf.slice(0, 5).text() !== '%PDF-') {
      alert('El archivo adjunto debe ser un PDF válido de máximo 10 MB.');
      inputArchivoPdf.value = '';
      inputArchivoPdf.focus();
      return;
    }
  }
  const boton = document.getElementById('btnGuardarRecepcion');
  const spinner = document.getElementById('spinnerGuardarRecepcion');
  const texto = document.getElementById('textoBtnGuardarRecepcion');
  if (boton) boton.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando recepción...';

  try {
    const ahora = new Date();
    actualizarFechaHoraRecepcion(ahora);
    const resultado = await guardarRecepcionPQRSF(ahora, archivoPdf);
    await mostrarAviso(
      resultado.radicado
        ? 'Quedó pendiente por gestionar.'
        : 'La petición se registró sin número de radicado y quedó pendiente por gestionar.',
      {
        tipo: 'success',
        titulo: 'PQRSF recibida',
        radicado: resultado.radicado,
        etiquetaRadicado: 'Número de radicado de entrada:'
      }
    );
    document.getElementById('formRecepcionPQRSF')?.reset();
    actualizarCampoRadicadoRecepcion();
    actualizarCampoNotificacionRespuesta(
      'tipoNotificacionRecepcion',
      'contactoNotificacionRecepcion',
      'etiquetaContactoNotificacionRecepcion'
    );
    const formulario = document.getElementById('contenedorFormularioRecepcion');
    if (formulario) formulario.style.display = 'block';
    actualizarEstadoBotonRecepcion(true);
    actualizarFechaHoraRecepcion(new Date());
    await cargarPQRSFPendientes();
  } catch (error) {
    console.error('Error al guardar la recepción de PQRSF:', error);
    const ayudaPermisos = error?.code === 'permission-denied'
      ? ' Verifica que estén publicadas las reglas de Firestore para radicadosEntradaSecuencias y que la sesión sea Administrador o Control Interno.'
      : '';
    alert(`No fue posible guardar la recepción: ${error.message}${ayudaPermisos}`);
  } finally {
    if (boton) boton.disabled = false;
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = 'Guardar Recepción';
  }
}

export function calcularFechaVencimiento() {
  const inputFechaRad = document.getElementById('fechaRadicacion');
  const inputDias = document.getElementById('diasHabiles');
  const inputEntrega = document.getElementById('fechaEntrega');

  if (inputFechaRad && inputDias && inputEntrega) {
    if (inputFechaRad.value && inputDias.value) {
      inputEntrega.value = sumarDiasHabilesColombia(inputFechaRad.value, inputDias.value);
    }
  }
}

export function calcularFechaVencimientoEdicion() {
  const editFechaRad = document.getElementById('editFechaRadicacion');
  const editDias = document.getElementById('editDiasHabiles');
  const editEntrega = document.getElementById('editFechaEntrega');

  if (editFechaRad && editDias && editEntrega) {
    if (editFechaRad.value && editDias.value) {
      editEntrega.value = sumarDiasHabilesColombia(editFechaRad.value, editDias.value);
    }
  }
}

function actualizarResumenDependenciasPqrs() {
  const resumen = document.getElementById('resumenDependenciasPqrs');
  const seleccionadas = Array.from(
    document.querySelectorAll('input[name="dependenciasDestinoPqrs"]:checked')
  ).map(casilla => casilla.value);
  if (!resumen) return seleccionadas;

  resumen.textContent = seleccionadas.length
    ? seleccionadas.map(abreviarNombreDependencia).join(', ')
    : '-- Seleccionar Dependencias --';
  return seleccionadas;
}

function cerrarDesplegableDependenciasPqrs() {
  const boton = document.getElementById('alternarDependenciasPqrs');
  const opciones = document.getElementById('opcionesDependenciasPqrs');
  if (!boton || !opciones) return;
  opciones.hidden = true;
  const busqueda = document.getElementById('buscarDependenciaPqrs');
  if (busqueda) {
    busqueda.value = '';
    filtrarDependenciasPqrs('');
  }
  boton.setAttribute('aria-expanded', 'false');
  boton.querySelector('i')?.classList.replace('bi-chevron-up', 'bi-chevron-down');
}

function filtrarDependenciasPqrs(consulta) {
  const lista = document.getElementById('listaOpcionesDependenciasPqrs');
  const sinResultados = document.getElementById('sinResultadosDependenciasPqrs');
  if (!lista) return;

  const textoBusqueda = consulta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CO');
  let resultadosVisibles = 0;
  lista.querySelectorAll('.pqrs-dependency-option').forEach(etiqueta => {
    const coincide = etiqueta.dataset.nombreDependencia
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-CO')
      .includes(textoBusqueda);
    etiqueta.hidden = !coincide;
    if (coincide) resultadosVisibles++;
  });
  if (sinResultados) sinResultados.hidden = resultadosVisibles > 0;
}

function inicializarSelectorDependenciasPqrs() {
  const select = document.getElementById('dependencia');
  const opciones = document.getElementById('opcionesDependenciasPqrs');
  const lista = document.getElementById('listaOpcionesDependenciasPqrs');
  const boton = document.getElementById('alternarDependenciasPqrs');
  const busqueda = document.getElementById('buscarDependenciaPqrs');
  const selector = document.getElementById('selectorDependenciasPqrs');
  if (!select || !opciones || !lista || !boton || !busqueda || !selector || lista.childElementCount > 0) return;

  Array.from(select.options)
    .filter(option => option.value)
    .forEach((option, indice) => {
      const etiqueta = document.createElement('label');
      etiqueta.className = 'pqrs-dependency-option';
      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.name = 'dependenciasDestinoPqrs';
      casilla.value = option.value;
      casilla.id = `dependenciaDestinoPqrs-${indice}`;
      if (esFuncionario()) {
        casilla.checked = option.value === obtenerDependenciaSesion();
        casilla.disabled = !casilla.checked;
      }
      const nombre = document.createElement('span');
      nombre.textContent = abreviarNombreDependencia(option.value);
      etiqueta.dataset.nombreDependencia = option.value;
      etiqueta.htmlFor = casilla.id;
      etiqueta.title = option.value;
      etiqueta.append(casilla, nombre);
      lista.append(etiqueta);
    });
    if (esFuncionario()) {
      boton.disabled = true;
      boton.title = `Destino asignado a ${obtenerDependenciaSesion()}`;
    }

  boton.addEventListener('click', () => {
    const expandido = boton.getAttribute('aria-expanded') === 'true';
    boton.setAttribute('aria-expanded', String(!expandido));
    opciones.hidden = expandido;
    boton.querySelector('i')?.classList.toggle('bi-chevron-down', expandido);
    boton.querySelector('i')?.classList.toggle('bi-chevron-up', !expandido);
    if (!expandido) busqueda.focus();
  });
  busqueda.addEventListener('input', () => filtrarDependenciasPqrs(busqueda.value));
  lista.addEventListener('change', event => {
    if (!event.target.matches('input[name="dependenciasDestinoPqrs"]')) return;
    actualizarResumenDependenciasPqrs();
    busqueda.value = '';
    filtrarDependenciasPqrs('');
    busqueda.focus();
  });
  opciones.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', event => {
    if (!selector.contains(event.target)) cerrarDesplegableDependenciasPqrs();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !opciones.hidden) {
      cerrarDesplegableDependenciasPqrs();
      boton.focus();
    }
  });
  actualizarResumenDependenciasPqrs();
}

async function guardarRadicado(e) {
  e.preventDefault();
  const esRadicacionCiudadana = (esCiudadano() || esAdministrador()) && modoFormularioPQRSF === 'directo';
  const esGestionPendiente = modoFormularioPQRSF === 'gestion';
  if (esRadicacionCiudadana) {
    const tipoNotificacion = document.getElementById('tipoNotificacionCiudadano')?.value || '';
    const contactoNotificacion = document.getElementById('contactoNotificacionCiudadano');
    if (!tipoNotificacion) {
      alert('Selecciona el medio de Notificación de Respuesta.');
      document.getElementById('tipoNotificacionCiudadano')?.focus();
      return;
    }
    if (tipoNotificacion !== 'Presencial' && !contactoNotificacion?.value.trim()) {
      alert('Ingresa el dato correspondiente al medio de notificación.');
      contactoNotificacion?.focus();
      return;
    }
    if (tipoNotificacion === 'Presencial' && contactoNotificacion) {
      contactoNotificacion.value = '';
    }
  }
  const dependenciasSeleccionadas = esRadicacionCiudadana
    ? []
    : actualizarResumenDependenciasPqrs();
  if (!esRadicacionCiudadana && dependenciasSeleccionadas.length === 0) {
    alert('Selecciona al menos una dependencia destino.');
    document.getElementById('alternarDependenciasPqrs')?.focus();
    return;
  }
  if (modoFormularioPQRSF === 'gestion' && !radicadoPendienteGestion) {
    alert('Selecciona una PQRS pendiente antes de guardar su gestión.');
    return;
  }
  if (esFuncionario() && (
    dependenciasSeleccionadas.length !== 1
    || dependenciasSeleccionadas[0] !== obtenerDependenciaSesion()
  )) {
    alert('Solo puedes registrar PQRS para tu dependencia.');
    return;
  }

  const fileInput = document.getElementById('solicitudPdf');
  const selectorPdfGestion = document.getElementById('pdfGestionSeleccionado');
  const pdfGestion = esGestionPendiente
    ? pdfsBibliotecaGestion.find(pdf => pdf.url === selectorPdfGestion?.value)
    : null;
  const pdfGestionOpcional = esGestionPendiente
    && tieneDocumentoAdjuntoSolicitud(datosPendienteGestion);
  if (esGestionPendiente && !pdfGestion && !pdfGestionOpcional) {
    alert(pdfsBibliotecaGestion.length
      ? 'Busca y selecciona el oficio de gestión que se enviará a la dependencia.'
      : 'Sube primero el PDF del oficio de gestión y luego selecciónalo.');
    document.getElementById('abrirSelectorPdfGestion')?.focus();
    if (pdfsBibliotecaGestion.length) abrirDialogoSeleccionPdfGestion();
    return;
  }
  const archivoPdf = esGestionPendiente ? null : fileInput?.files[0];
  if (esRadicacionCiudadana) {
    if (!document.getElementById('aceptaTratamientoDatos')?.checked) {
      alert('Debes aceptar el tratamiento de datos personales.');
      document.getElementById('aceptaTratamientoDatos')?.focus();
      return;
    }
    if (!archivoPdf) {
      alert('Adjunta el oficio en formato PDF.');
      fileInput?.focus();
      return;
    }
    if (archivoPdf.type !== 'application/pdf' && !archivoPdf.name.toLowerCase().endsWith('.pdf')) {
      alert('El oficio debe adjuntarse en formato PDF.');
      fileInput?.focus();
      return;
    }
  }

  // Captura flexible de los elementos del botón y el spinner
  const btn = document.getElementById('btnGuardarRadicado') || document.getElementById('btnGuardar');
  const spinner = document.getElementById('spinnerGuardarRadicado');
  const icono = document.getElementById('iconoBtnGuardar');
  const texto = document.getElementById('textoBtnGuardar');

  // Mostrar Spinner SVG y deshabilitar botón
  if (spinner) spinner.style.display = 'inline-block';
  if (icono) icono.style.display = 'none';
  if (btn) btn.disabled = true;

  if (texto) texto.textContent = archivoPdf
    ? esRadicacionCiudadana ? 'Subiendo documento...' : 'Subiendo PDF...'
    : 'Guardando...';
  let driveUrl = pdfGestion?.url || '';

  try {
    // 1. Subida del archivo PDF a Google Drive si existe
    if (archivoPdf) {
      const base64Pdf = await convertirABase64(archivoPdf);
      const rawBase64 = base64Pdf.split(',')[1] || "";

      const payload = {
        archivoBase64: rawBase64,
        mimeType: archivoPdf.type || 'application/octet-stream',
        nombreArchivo: `Radicado_${document.getElementById('radicado').value.trim() || 'Ciudadano'}_${archivoPdf.name}`
      };

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (resData.status === "success") {
        driveUrl = resData.url;
      } else {
        throw new Error("Error en Google Drive: " + resData.message);
      }
    }

    // Actualizar texto del botón al guardar en la BD
    if (texto) texto.textContent = esRadicacionCiudadana ? 'Guardando...' : 'Guardando datos...';

    // 2. Estructuración de los datos del nuevo radicado
    const ahora = new Date();
    const notificacionRespuestaTipo = document.getElementById('tipoNotificacionCiudadano')?.value || '';
    const notificacionRespuestaContacto = document.getElementById('contactoNotificacionCiudadano')?.value.trim() || '';
    const nuevoRadicado = {
      radicado: esRadicacionCiudadana ? '' : document.getElementById('radicado').value.trim(),
      origenSolicitud: esRadicacionCiudadana ? 'ciudadano' : 'ventanilla',
      estado: esRadicacionCiudadana ? 'PENDIENTE_GESTION' : 'VIGENTE',
      tipoCanal: document.getElementById('tipoCanal').value,
      fechaRadicacion: document.getElementById('fechaRadicacion').value,
      fechaHoraRadicacion: esGestionPendiente && datosPendienteGestion?.fechaHoraRadicacion
        ? datosPendienteGestion.fechaHoraRadicacion
        : ahora.toISOString(),
      ...(esRadicacionCiudadana ? { fechaRecepcion: ahora.toISOString() } : {}),
      fechaEntregaManual: document.getElementById('fechaEntregaManual').value,
      diasHabiles: document.getElementById('diasHabiles').value,
      fechaVencimiento: document.getElementById('fechaEntrega').value,
      remitente: formatearMayusculasIniciales(document.getElementById('remitente').value.trim()),
      asunto: formatearMayusculasIniciales(document.getElementById('asunto').value.trim()),
      folios: Number(document.getElementById('folios').value),
      anexos: Number(document.getElementById('anexos').value),
      notificacionRespuestaTipo,
      notificacionRespuestaContacto,
      pdfUrl: esGestionPendiente
        ? driveUrl || datosPendienteGestion?.pdfUrl || ''
        : esRadicacionCiudadana
          ? ''
          : driveUrl || '',
      pdfNombre: esGestionPendiente
        ? pdfGestion?.nombre || datosPendienteGestion?.pdfNombre || ''
        : archivoPdf?.name || '',
      ...(esRadicacionCiudadana ? {
        pdfCiudadanoUrl: driveUrl || '',
        pdfCiudadanoNombre: archivoPdf?.name || '',
        aceptaTratamientoDatos: true
      } : {}),
      ...(esGestionPendiente ? {
        horaRadicacion: datosPendienteGestion?.horaRadicacion || '',
        fechaRecepcion: datosPendienteGestion?.fechaRecepcion || '',
        observaciones: datosPendienteGestion?.observaciones || '',
        dependenciaResponsable: dependenciasSeleccionadas[0] || '',
        numeroSecuencia: datosPendienteGestion?.numeroSecuencia ?? 0,
        anio: datosPendienteGestion?.anio ?? 0,
        ...(datosPendienteGestion?.sinNumeroRadicado === true ? { sinNumeroRadicado: true } : {})
      } : {}),
      ...(esGestionPendiente && datosPendienteGestion?.origenSolicitud === 'ciudadano' ? {
        pdfCiudadanoUrl: datosPendienteGestion?.pdfCiudadanoUrl || datosPendienteGestion?.pdfUrl || '',
        pdfCiudadanoNombre: datosPendienteGestion?.pdfCiudadanoNombre || 'Solicitud original del ciudadano',
        aceptaTratamientoDatos: datosPendienteGestion?.aceptaTratamientoDatos === true
      } : {}),
      ...(esRadicacionCiudadana ? { ciudadanoUid: auth.currentUser.uid } : {})
    };

    let registrosDestino;
    if (esRadicacionCiudadana) {
      const anio = Number(obtenerFechaBogota(ahora));
      const secuenciaRef = doc(db, COLECCION_SECUENCIAS_ENTRADA, String(anio));
      const resultadoTransaccion = await runTransaction(db, async transaccion => {
        const secuencia = await transaccion.get(secuenciaRef);
        const ultimo = obtenerUltimoSecuenciaEntrada(anio, secuencia);
        if (!Number.isSafeInteger(ultimo) || ultimo < 0 || ultimo >= 99999) {
          throw new Error(`La secuencia de radicados de entrada para ${anio} no es válida o se agotó.`);
        }

        const numero = ultimo + 1;
        const radicado = formatearRadicadoEntrada(anio, numero);
        const dependencia = 'Ventanilla Única';
        const referencia = doc(db, RADICADOS_COLLECTION, radicado);
        transaccion.set(secuenciaRef, {
          anio,
          ultimo: numero,
          ultimoRadicado: radicado
        });
        transaccion.set(referencia, {
          ...nuevoRadicado,
          radicado,
          anio,
          numeroSecuencia: numero,
          dependencia
        });
        return { radicado, registros: [{ dependencia, referencia }] };
      });

      nuevoRadicado.radicado = resultadoTransaccion.radicado;
      registrosDestino = resultadoTransaccion.registros;
    } else {
      registrosDestino = dependenciasSeleccionadas.map((dependencia, indice) => ({
        dependencia,
        referencia: esGestionPendiente && indice === 0
          ? doc(db, RADICADOS_COLLECTION, radicadoPendienteGestion)
          : doc(collection(db, RADICADOS_COLLECTION)),
        actualizarPendiente: esGestionPendiente && indice === 0
      }));
      if (esGestionPendiente) {
        const referenciaPendiente = doc(db, RADICADOS_COLLECTION, radicadoPendienteGestion);
        const usuarioUid = auth.currentUser?.uid || '';
        await runTransaction(db, async transaccion => {
          const pendiente = await transaccion.get(referenciaPendiente);
          if (!pendiente.exists() || pendiente.data().estado !== 'PENDIENTE_GESTION') {
            const error = new Error('Esta PQRS ya no está pendiente por gestionar.');
            error.name = 'AsignacionRadicadoError';
            throw error;
          }
          if (
            !usuarioUid
            || pendiente.data().gestionAsignadaUid !== usuarioUid
            || pendiente.data().gestionAsignadaPresenciaToken
              !== datosPendienteGestion?.gestionAsignadaPresenciaToken
          ) {
            const error = new Error('La reserva de esta PQRS ya no está asignada a tu cuenta.');
            error.name = 'AsignacionRadicadoError';
            throw error;
          }
          registrosDestino.forEach(({ dependencia, referencia, actualizarPendiente }) => {
            const registro = {
              ...nuevoRadicado,
              dependencia,
              gestionAsignadaUid: '',
              gestionAsignadaNombre: '',
              gestionAsignadaEn: '',
              gestionAsignadaPresenciaToken: ''
            };
            if (actualizarPendiente) {
              transaccion.update(referencia, registro);
            } else {
              transaccion.set(referencia, registro);
            }
          });
        });
      } else {
        const lote = writeBatch(db);
        registrosDestino.forEach(({ dependencia, referencia }) => {
          lote.set(referencia, { ...nuevoRadicado, dependencia });
        });
        await lote.commit();
      }
    }

    if (!esRadicacionCiudadana) {
      await informarResultadoNotificacionCorreo(
        'nueva-solicitud',
        { ids: registrosDestino.map(({ referencia }) => referencia.id) }
      );
    }
    if (esRadicacionCiudadana) {
      try {
        await sincronizarConsultaPublicaRadicado(nuevoRadicado.radicado);
      } catch (error) {
        console.error('La solicitud se guardó, pero no se publicó su consulta:', error);
        alert('La solicitud se guardó, pero su consulta pública aún no está disponible. Contacta a la Ventanilla Única.');
      }
    } else if (
      esGestionPendiente
      && datosPendienteGestion?.origenSolicitud === 'ciudadano'
    ) {
      try {
        await sincronizarConsultaPublicaRadicado(radicadoPendienteGestion);
      } catch (error) {
        console.error('La gestión se guardó, pero no se actualizó la consulta pública:', error);
        alert('La gestión se guardó, pero la consulta pública no se actualizó. Contacta al administrador.');
      }
    }

    await mostrarAviso(
      esRadicacionCiudadana
        ? 'Para consultar el estado de su solicitud, ingrese su número de radicado en este mismo apartado. Si tiene más dudas, diríjase a la Ventanilla Única de la Alcaldía.'
        : `Se envió a las siguientes dependencias:\n${dependenciasSeleccionadas.map(dependencia => `• ${dependencia}`).join('\n')}`,
      {
        tipo: 'success',
        titulo: esRadicacionCiudadana ? 'PQRSF recibida' : 'Radicado guardado',
        radicado: nuevoRadicado.radicado,
        etiquetaRadicado: esRadicacionCiudadana
          ? 'Tu número de radicado asignado es:'
          : 'Número de radicado:'
      }
    );
    document.getElementById('pqrsForm')?.reset();
    actualizarEtiquetaPdfGestion();
    actualizarCampoNotificacionRespuesta(
      'tipoNotificacionCiudadano',
      'contactoNotificacionCiudadano',
      'etiquetaContactoNotificacionCiudadano'
    );
    document.querySelectorAll('input[name="dependenciasDestinoPqrs"]').forEach(casilla => {
      casilla.checked = esFuncionario()
        && casilla.value === obtenerDependenciaSesion();
    });
    actualizarResumenDependenciasPqrs();
    cerrarDesplegableDependenciasPqrs();
    if (esRadicacionCiudadana) {
      establecerModoFormularioPQRSF('directo');
      establecerFormularioVisible(true);
    }
    if (esGestionPendiente) {
      radicadoPendienteGestion = '';
      datosPendienteGestion = null;
      establecerModoFormularioPQRSF('gestion');
      establecerFormularioVisible(true);
      const pendientes = document.getElementById('pqrsPendientesGestion');
      if (pendientes) pendientes.hidden = false;
      actualizarEstadoBotonGestion(false);
    }

    // Resetear valores por defecto de fechas
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('fechaRadicacion')) document.getElementById('fechaRadicacion').value = hoy;
    if (document.getElementById('fechaEntregaManual')) document.getElementById('fechaEntregaManual').value = hoy;
    if (document.getElementById('diasHabiles')) document.getElementById('diasHabiles').value = 15;
    if (typeof calcularFechaVencimiento === 'function') calcularFechaVencimiento();

    if (!esCiudadano()) {
      await cargarDatosDesdeFirebase();
      if (esGestionPendiente) await cargarPQRSFPendientes();
    }

  } catch (error) {
    console.error("Error al guardar:", error);
    if (error?.name === 'AsignacionRadicadoError') {
      radicadoPendienteGestion = '';
      datosPendienteGestion = null;
      await cargarPQRSFPendientes();
      alert(`${error.message}\nNo se guardaron los cambios.`);
      return;
    }
    const mensajeError = error?.code === 'permission-denied'
      && ((esCiudadano() || esAdministrador()) && modoFormularioPQRSF === 'directo')
      ? 'Firestore no permitió generar el radicado ciudadano. Publica las reglas actualizadas e inténtalo de nuevo.'
      : `Ocurrió un error al procesar el registro: ${error.message}`;
    alert(mensajeError);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (texto) texto.textContent = esRadicacionCiudadana ? 'Guardar' : 'Guardar Radicado';
    if (btn) btn.disabled = modoFormularioPQRSF === 'gestion' && !radicadoPendienteGestion;
  }
}

window.toggleFormulario = async function() {
  const pendientes = document.getElementById('pqrsPendientesGestion');
  if (!pendientes) return;
  if (modoFormularioPQRSF === 'directo' && (esCiudadano() || esAdministrador())) {
    const formCard = document.getElementById('contenedorFormulario');
    const visible = formCard?.style.display === 'none' || formCard?.style.display === '';
    if (visible) establecerModoFormularioPQRSF('directo');
    establecerFormularioVisible(visible);
    return;
  }
  if (!esAdministrador()) {
    await mostrarAviso('Solo el administrador o un ciudadano pueden ingresar una nueva solicitud.', {
      tipo: 'warning',
      titulo: 'Acceso restringido'
    });
    return;
  }

  const formulario = document.getElementById('contenedorFormulario');
  const formularioVisible = formulario?.style.display !== 'none';
  if (modoFormularioPQRSF === 'gestion' && formularioVisible) {
    establecerFormularioVisible(false);
    return;
  }
  if (modoFormularioPQRSF !== 'gestion') {
    radicadoPendienteGestion = '';
    datosPendienteGestion = null;
    establecerModoFormularioPQRSF('gestion');
  }
  establecerFormularioVisible(true);
  await cargarPQRSFPendientes();
};

window.abrirRecepcionPQRSF = function() {
  if (!esAdministrador()) return;
  const formulario = document.getElementById('contenedorFormularioRecepcion');
  if (!formulario) return;
  const visible = formulario.style.display !== 'none';
  formulario.style.display = visible ? 'none' : 'block';
  actualizarEstadoBotonRecepcion(!visible);
  if (!visible) {
    actualizarFechaHoraRecepcion(new Date());
  }
};

export function prepararVistaPQRSF(esVistaCiudadano = false) {
  radicadoPendienteGestion = '';
  datosPendienteGestion = null;
  document.getElementById('pqrsForm')?.reset();
  actualizarEtiquetaPdfGestion();
  actualizarCampoNotificacionRespuesta(
    'tipoNotificacionCiudadano',
    'contactoNotificacionCiudadano',
    'etiquetaContactoNotificacionCiudadano'
  );
  actualizarResumenDependenciasPqrs();
  const enlaceSolicitudOriginal = document.getElementById('enlaceSolicitudOriginalCiudadano');
  if (enlaceSolicitudOriginal) {
    enlaceSolicitudOriginal.removeAttribute('href');
    enlaceSolicitudOriginal.textContent = '';
  }
  establecerModoFormularioPQRSF(esVistaCiudadano ? 'directo' : 'gestion');
  const pendientes = document.getElementById('pqrsPendientesGestion');
  const puedeConsultarPendientes = !esVistaCiudadano && esAdministrador();
  if (pendientes) pendientes.hidden = !puedeConsultarPendientes;
  actualizarContadorBibliotecaPdfGestion();
  actualizarEstadoBotonGestion(false);
  const formularioRecepcion = document.getElementById('contenedorFormularioRecepcion');
  if (formularioRecepcion) formularioRecepcion.style.display = 'none';
  const botonRecepcion = document.getElementById('toggleRecepcionPQRSF');
  if (botonRecepcion) {
    botonRecepcion.hidden = esVistaCiudadano || !esAdministrador();
    actualizarEstadoBotonRecepcion(false);
  }
  establecerFormularioVisible(false);
  if (puedeConsultarPendientes) void cargarPQRSFPendientes();
}

export function establecerFormularioVisible(visible) {
  const formCard = document.getElementById('contenedorFormulario');
  const toggle = document.getElementById('toggleGestionPQRSF');
  if (!formCard) return;
  if (visible && !esAdministrador() && !esCiudadano()) return;

  formCard.style.display = visible ? 'block' : 'none';
  toggle?.setAttribute('aria-expanded', String(visible));
  toggle?.classList.toggle('is-collapsed', !visible);
}

export function configurarSelectoresFechaModernos() {
  if (!window.flatpickr) return;

  const sincronizarSelectores = instancia => {
    const calendario = instancia.calendarContainer;
    const selectorMes = calendario.querySelector('.flatpickr-custom-month');
    const selectorAnio = calendario.querySelector('.flatpickr-custom-year');
    if (selectorMes) selectorMes.value = String(instancia.currentMonth);
    if (selectorAnio) selectorAnio.value = String(instancia.currentYear);
  };

  const ajustarPosicionCalendarioEnDialogo = instancia => {
    const dialogo = instancia.input.closest('dialog');
    if (!dialogo) return;

    const calendario = instancia.calendarContainer;
    const rectDialogo = dialogo.getBoundingClientRect();
    const left = Number.parseFloat(calendario.style.left);
    const top = Number.parseFloat(calendario.style.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;

    calendario.style.left = `${left - rectDialogo.left - dialogo.clientLeft + dialogo.scrollLeft}px`;
    calendario.style.top = `${top - rectDialogo.top - dialogo.clientTop + dialogo.scrollTop}px`;
  };

  const crearSelectores = instancia => {
    const meses = instancia.l10n.months.longhand;
    const encabezadoNativo = instancia.calendarContainer.querySelector('.flatpickr-current-month');
    const contenedorMeses = instancia.calendarContainer.querySelector('.flatpickr-months');
    if (!encabezadoNativo || !contenedorMeses) return;

    instancia.calendarContainer.classList.add('has-custom-date-header');
    const encabezado = document.createElement('div');
    encabezado.className = 'flatpickr-custom-header';

    const selectorMes = document.createElement('select');
    selectorMes.className = 'flatpickr-custom-month';
    selectorMes.setAttribute('aria-label', 'Seleccionar mes');
    meses.forEach((mes, indice) => {
      const opcion = document.createElement('option');
      opcion.value = String(indice);
      opcion.textContent = mes.charAt(0).toLocaleUpperCase('es') + mes.slice(1);
      selectorMes.appendChild(opcion);
    });
    selectorMes.addEventListener('change', () => {
      instancia.changeMonth(Number(selectorMes.value), false);
      sincronizarSelectores(instancia);
    });

    const selectorAnio = document.createElement('select');
    selectorAnio.className = 'flatpickr-custom-year';
    selectorAnio.setAttribute('aria-label', 'Seleccionar año');
    for (let anio = 1900; anio <= 2100; anio += 1) {
      const opcion = document.createElement('option');
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selectorAnio.appendChild(opcion);
    }
    selectorAnio.addEventListener('change', () => {
      instancia.changeYear(Number(selectorAnio.value));
      sincronizarSelectores(instancia);
    });

    encabezado.append(selectorMes, selectorAnio);
    contenedorMeses.appendChild(encabezado);
    sincronizarSelectores(instancia);
  };

  const configurarRangosFecha = () => {
    document.querySelectorAll('input[id^="fechaDesde"]').forEach(desde => {
      if (desde.dataset.rangoFechaConfigurado === 'true' || !desde._flatpickr) return;
      const idHasta = desde.id.replace('fechaDesde', 'fechaHasta');
      const hasta = document.getElementById(idHasta);
      if (!hasta?._flatpickr) return;

      const actualizarLimiteHasta = () => {
        const fechaDesde = desde.value;
        const fechaHasta = hasta.value;
        hasta.min = fechaDesde;
        hasta._flatpickr.set('minDate', fechaDesde || null);
        if (fechaDesde && fechaHasta && fechaHasta < fechaDesde) {
          hasta._flatpickr.clear();
        }
      };

      desde.addEventListener('change', actualizarLimiteHasta);
      hasta.addEventListener('change', actualizarLimiteHasta);
      desde.dataset.rangoFechaConfigurado = 'true';
      actualizarLimiteHasta();
    });
  };

  const inicializar = input => {
    if (input.dataset.calendarModerno === 'true' || input.disabled || input.readOnly) return;
    input.dataset.calendarModerno = 'true';
    const instancia = window.flatpickr(input, {
      locale: 'es',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      allowInput: false,
      monthSelectorType: 'dropdown',
      disableMobile: true,
      appendTo: input.closest('dialog') || document.body,
      onReady: (_, __, instancia) => crearSelectores(instancia),
      onMonthChange: (_, __, instancia) => sincronizarSelectores(instancia),
      onYearChange: (_, __, instancia) => sincronizarSelectores(instancia),
      onOpen: (_, __, instancia) => {
        instancia.input.closest('dialog')?.classList.add('flatpickr-calendar-open');
        window.requestAnimationFrame(() => {
          ajustarPosicionCalendarioEnDialogo(instancia);
        });
      },
      onClose: (_, __, instancia) => {
        instancia.input.closest('dialog')?.classList.remove('flatpickr-calendar-open');
      }
    });
    instancia.altInput?.classList.add('flatpickr-date-display');
  };

  document.querySelectorAll('input[type="date"]').forEach(inicializar);
  configurarRangosFecha();

  if (document.documentElement.dataset.selectoresFechaObserverConfigurado) return;
  document.documentElement.dataset.selectoresFechaObserverConfigurado = 'true';
  const observer = new MutationObserver(mutations => {
    let seAgregaronCamposFecha = false;
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(nodo => {
        if (!(nodo instanceof Element)) return;
        if (nodo.matches?.('input[type="date"]')) {
          inicializar(nodo);
          seAgregaronCamposFecha = true;
        }
        const camposFecha = nodo.querySelectorAll?.('input[type="date"]');
        camposFecha?.forEach(inicializar);
        if (camposFecha?.length) seAgregaronCamposFecha = true;
      });
    });
    if (seAgregaronCamposFecha) configurarRangosFecha();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function inicializarFormulario() {
  const hoy = new Date().toISOString().split('T')[0];
  const inputFechaRadicacion = document.getElementById('fechaRadicacion');
  const inputFechaEntregaManual = document.getElementById('fechaEntregaManual');
  const form = document.getElementById('pqrsForm');
  const formularioRecepcion = document.getElementById('formRecepcionPQRSF');

  configurarSelectoresFechaModernos();
  if (inputFechaRadicacion) inputFechaRadicacion.value = hoy;
  if (inputFechaEntregaManual) inputFechaEntregaManual.value = hoy;

  inicializarSelectorDependenciasPqrs();
  const botonSubirPdfGestion = document.getElementById('btnSubirPdfGestion');
  const entradaPdfGestion = document.getElementById('archivosPdfGestion');
  botonSubirPdfGestion?.addEventListener('click', () => {
    if (obtenerPerfilSesion()?.rol === 'administrador') entradaPdfGestion?.click();
  });
  entradaPdfGestion?.addEventListener('change', cargarPdfBibliotecaGestion);
  document.getElementById('abrirSelectorPdfGestion')?.addEventListener(
    'click',
    abrirDialogoSeleccionPdfGestion
  );
  document.getElementById('buscarPdfGestion')?.addEventListener(
    'input',
    () => {
      renderizarResultadosBibliotecaPdfGestion();
      const busqueda = document.getElementById('buscarPdfGestion')?.value.trim();
      if (busqueda && !bibliotecaPdfGestionCargada) {
        void cargarBibliotecaPdfGestion();
      }
    }
  );
  const modalPdfGestion = document.getElementById('modalSeleccionarPdfGestion');
  document.getElementById('cerrarModalPdfGestion')?.addEventListener(
    'click',
    () => modalPdfGestion?.close()
  );
  document.getElementById('cancelarModalPdfGestion')?.addEventListener(
    'click',
    () => modalPdfGestion?.close()
  );
  modalPdfGestion?.addEventListener('click', event => {
    if (event.target === modalPdfGestion) modalPdfGestion.close();
  });
  actualizarContadorBibliotecaPdfGestion();
  renderizarResultadosBibliotecaPdfGestion();
  calcularFechaVencimiento();
  document.getElementById('fechaRadicacion')?.addEventListener('input', calcularFechaVencimiento);
  document.getElementById('diasHabiles')?.addEventListener('input', calcularFechaVencimiento);
  document.getElementById('editFechaRadicacion')?.addEventListener('input', calcularFechaVencimientoEdicion);
  document.getElementById('editDiasHabiles')?.addEventListener('input', calcularFechaVencimientoEdicion);
  document.getElementById('tipoNotificacionRecepcion')?.addEventListener('change', () => {
    actualizarCampoNotificacionRespuesta(
      'tipoNotificacionRecepcion',
      'contactoNotificacionRecepcion',
      'etiquetaContactoNotificacionRecepcion'
    );
  });
  document.getElementById('sinNumeroRadicadoRecepcion')?.addEventListener('change', actualizarCampoRadicadoRecepcion);
  document.getElementById('tipoNotificacionCiudadano')?.addEventListener('change', () => {
    actualizarCampoNotificacionRespuesta(
      'tipoNotificacionCiudadano',
      'contactoNotificacionCiudadano',
      'etiquetaContactoNotificacionCiudadano'
    );
  });
  actualizarCampoNotificacionRespuesta(
    'tipoNotificacionRecepcion',
    'contactoNotificacionRecepcion',
    'etiquetaContactoNotificacionRecepcion'
  );
  actualizarCampoRadicadoRecepcion();
  actualizarCampoNotificacionRespuesta(
    'tipoNotificacionCiudadano',
    'contactoNotificacionCiudadano',
    'etiquetaContactoNotificacionCiudadano'
  );
  form?.addEventListener('submit', guardarRadicado);
  formularioRecepcion?.addEventListener('submit', procesarFormularioRecepcionPQRSF);
  document.getElementById('formConsultaEstadoCiudadano')?.addEventListener('submit', consultarEstadoCiudadano);
  document.getElementById('radicadoConsultaCiudadano')?.addEventListener('input', event => {
    event.target.value = event.target.value.toUpperCase();
  });
  establecerModoFormularioPQRSF(esCiudadano() ? 'directo' : 'gestion');
}
