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
  convertirABase64,
  formatearMayusculasIniciales,
  formatearRadicadoEntrada,
  obtenerUrlHttpsSegura,
  evaluarEstadoAutomatico,
  sumarDiasHabilesColombia
} from '../../utils/helpers.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import {
  COLECCION_CONSULTA_PUBLICA,
  sincronizarConsultaPublicaRadicado
} from '../../services/consulta-publica.js';
import { esAdministrador, esCiudadano, esFuncionario, obtenerDependenciaSesion, obtenerPerfilSesion } from '../auth/roles.js';
import { mostrarAviso } from '../ui/avisos.js';
import { informarResultadoNotificacionCorreo } from './notificaciones-correo.js';

const COLECCION_SECUENCIAS_ENTRADA = 'radicadosEntradaSecuencias';
let modoFormularioPQRSF = 'directo';
let radicadoPendienteGestion = '';
let datosPendienteGestion = null;
let cantidadVisiblePendientes = 6;

function establecerModoFormularioPQRSF(modo) {
  modoFormularioPQRSF = modo;
  const esRadicacionCiudadana = (esCiudadano() || esAdministrador()) && modo === 'directo';
  const radicado = document.getElementById('radicado');
  if (radicado) {
    const radicadoAutomaticoCiudadano = esRadicacionCiudadana;
    radicado.readOnly = modo === 'gestion' || radicadoAutomaticoCiudadano;
    radicado.required = !radicadoAutomaticoCiudadano;
    radicado.placeholder = radicadoAutomaticoCiudadano
      ? 'Se asignará automáticamente al guardar'
      : '';
    if (radicadoAutomaticoCiudadano) radicado.value = '';
  }
  [
    ['grupoRadicado', true],
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
    tipoCanal.value = esRadicacionCiudadana ? 'Virtual' : tipoCanal.value;
    tipoCanal.disabled = esRadicacionCiudadana;
    tipoCanal.required = !esRadicacionCiudadana;
  }
  const estadoSolicitud = document.getElementById('estadoSolicitud');
  if (estadoSolicitud) {
    estadoSolicitud.value = 'VIGENTE';
    estadoSolicitud.disabled = esRadicacionCiudadana;
  }
  const remitente = document.getElementById('remitente');
  if (remitente) remitente.required = true;
  const asunto = document.getElementById('asunto');
  if (asunto) asunto.required = true;
  const etiquetaRemitente = document.querySelector('label[for="remitente"]');
  if (etiquetaRemitente) {
    etiquetaRemitente.textContent = esRadicacionCiudadana
      ? 'Nombre y Datos del Destinatario'
      : 'Nombre y Datos del Remitente';
  }
  const solicitudPdf = document.getElementById('solicitudPdf');
  if (solicitudPdf) {
    solicitudPdf.accept = '.pdf';
    solicitudPdf.required = esRadicacionCiudadana;
  }
  const esGestionCiudadanoPendiente = modo === 'gestion'
    && datosPendienteGestion?.origenSolicitud === 'ciudadano';
  const grupoSolicitudPdf = document.getElementById('grupoSolicitudPdf');
  if (grupoSolicitudPdf) {
    grupoSolicitudPdf.hidden = esGestionCiudadanoPendiente;
    grupoSolicitudPdf.style.display = esGestionCiudadanoPendiente ? 'none' : '';
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
    etiquetaSolicitudPdf.textContent = esGestionCiudadanoPendiente
      ? 'Documento ciudadano adjunto'
      : modo === 'gestion'
      ? 'Oficio de gestión (PDF opcional)'
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

function seleccionarPQRSFPendiente(id, registro) {
  radicadoPendienteGestion = id;
  datosPendienteGestion = registro;
  document.getElementById('pqrsForm')?.reset();
  establecerModoFormularioPQRSF('gestion');
  document.getElementById('radicado').value = registro.radicado || '';
  document.getElementById('tipoCanal').value = registro.tipoCanal || '';
  document.getElementById('estadoSolicitud').value = 'VIGENTE';
  document.getElementById('fechaRadicacion').value = registro.fechaRadicacion || '';
  document.getElementById('fechaEntregaManual').value = registro.fechaEntregaManual || '';
  document.getElementById('diasHabiles').value = registro.diasHabiles || '';
  document.getElementById('remitente').value = registro.remitente || '';
  document.getElementById('asunto').value = registro.asunto || '';
  const grupoSolicitudOriginal = document.getElementById('grupoSolicitudOriginalCiudadano');
  const enlaceSolicitudOriginal = document.getElementById('enlaceSolicitudOriginalCiudadano');
  const urlSolicitudOriginal = obtenerUrlHttpsSegura(registro.pdfCiudadanoUrl
    || (registro.origenSolicitud === 'ciudadano' ? registro.pdfUrl : ''));
  if (grupoSolicitudOriginal && enlaceSolicitudOriginal && urlSolicitudOriginal) {
    enlaceSolicitudOriginal.href = urlSolicitudOriginal;
    enlaceSolicitudOriginal.textContent = registro.pdfCiudadanoNombre || 'Abrir solicitud original del ciudadano';
    grupoSolicitudOriginal.hidden = false;
    grupoSolicitudOriginal.style.display = '';
  }
  establecerDependenciasGestion(registro);
  calcularFechaVencimiento();
  establecerFormularioVisible(true);
  document.getElementById('contenedorFormulario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const respuestaCargada = Boolean(
      typeof registro.respuestaUrl === 'string'
      && registro.respuestaUrl.trim().startsWith('http')
    );
    const enlacesPdf = document.createElement('div');
    enlacesPdf.className = 'citizen-status-files';
    const descargaRespuesta = respuestaCargada
      ? crearEnlaceDescargaPdfCiudadano('Descargar PDF de respuesta', registro.respuestaUrl)
      : null;
    if (descargaRespuesta) enlacesPdf.append(descargaRespuesta);

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
      .sort((a, b) => String(a.fechaRecepcion || '').localeCompare(String(b.fechaRecepcion || '')));
    const lista = document.getElementById('listaPQRSFpendientes');
    if (!lista) return;
    if (!registros.length) {
      mostrarMensajePendientes('No hay PQRS pendientes por gestionar.');
      return;
    }

    cantidadVisiblePendientes = 6;
    lista.replaceChildren();
    const renderizarPendientes = () => {
      lista.replaceChildren();
      registros.slice(0, cantidadVisiblePendientes).forEach(registro => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'pqrs-pending-item';
        const numero = document.createElement('span');
        numero.className = 'pqrs-pending-number';
        numero.textContent = registro.radicado || 'Sin radicado';
        const detalle = document.createElement('span');
        detalle.className = 'pqrs-pending-details';
        detalle.textContent = [
          registro.remitente || 'Remitente por completar',
          registro.asunto || 'Asunto por completar'
        ].join(' · ');
        boton.append(numero, detalle);
        boton.addEventListener('click', () => seleccionarPQRSFPendiente(registro.id, registro));
        lista.append(boton);
      });

      if (cantidadVisiblePendientes < registros.length) {
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

async function guardarRecepcionPQRSF(ahora) {
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

  const numeroRadicado = await runTransaction(db, async transaccion => {
    const secuencia = await transaccion.get(secuenciaRef);
    const ultimo = secuencia.exists() ? Number(secuencia.data().ultimo) : 0;
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
      radicado,
      numeroSecuencia: numero,
      anio,
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
      dependenciaResponsable: dependencia,
      pdfUrl: '',
      dependencia: dependencia || 'Ventanilla Única'
    });
    return radicado;
  });

  return { id: radicadoRef.id, radicado: numeroRadicado };
}

async function procesarFormularioRecepcionPQRSF(event) {
  event.preventDefault();
  const boton = document.getElementById('btnGuardarRecepcion');
  const spinner = document.getElementById('spinnerGuardarRecepcion');
  const texto = document.getElementById('textoBtnGuardarRecepcion');
  if (boton) boton.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando recepción...';

  try {
    const ahora = new Date();
    actualizarFechaHoraRecepcion(ahora);
    const resultado = await guardarRecepcionPQRSF(ahora);
    await mostrarAviso('Quedó pendiente por gestionar.', {
      tipo: 'success',
      titulo: 'PQRSF recibida',
      radicado: resultado.radicado,
      etiquetaRadicado: 'Número de radicado de entrada:'
    });
    document.getElementById('formRecepcionPQRSF')?.reset();
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
  const archivoPdf = fileInput?.files[0];
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
  let driveUrl = "";

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
    const esGestionPendiente = modoFormularioPQRSF === 'gestion';
    const ahora = new Date();
    const nuevoRadicado = {
      radicado: esRadicacionCiudadana ? '' : document.getElementById('radicado').value.trim(),
      origenSolicitud: esRadicacionCiudadana ? 'ciudadano' : 'ventanilla',
      estado: esRadicacionCiudadana ? 'PENDIENTE_GESTION' : 'VIGENTE',
      tipoCanal: esRadicacionCiudadana ? 'Virtual' : document.getElementById('tipoCanal').value,
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
      pdfUrl: esGestionPendiente
        ? driveUrl || ''
        : esRadicacionCiudadana
          ? ''
          : driveUrl || '',
      ...(esRadicacionCiudadana ? {
        pdfCiudadanoUrl: driveUrl || '',
        pdfCiudadanoNombre: archivoPdf?.name || '',
        aceptaTratamientoDatos: true
      } : {}),
      ...(esGestionPendiente ? {
        horaRadicacion: datosPendienteGestion?.horaRadicacion || '',
        fechaRecepcion: datosPendienteGestion?.fechaRecepcion || '',
        folios: datosPendienteGestion?.folios ?? '',
        anexos: datosPendienteGestion?.anexos ?? '',
        observaciones: datosPendienteGestion?.observaciones || '',
        dependenciaResponsable: dependenciasSeleccionadas[0] || '',
        numeroSecuencia: datosPendienteGestion?.numeroSecuencia ?? 0,
        anio: datosPendienteGestion?.anio ?? 0
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
        const ultimo = secuencia.exists() ? Number(secuencia.data().ultimo) : 0;
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
      const lote = writeBatch(db);
      registrosDestino.forEach(({ dependencia, referencia, actualizarPendiente }) => {
        const registro = { ...nuevoRadicado, dependencia };
        if (actualizarPendiente) {
          lote.update(referencia, registro);
        } else {
          lote.set(referencia, registro);
        }
      });
      await lote.commit();
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
        ? 'Para conocer su respuesta, diríjase a la Ventanilla Única de la Alcaldía dentro de los siguientes 15 días hábiles.'
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
  formulario?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    formulario.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

export function prepararVistaPQRSF(esVistaCiudadano = false) {
  radicadoPendienteGestion = '';
  datosPendienteGestion = null;
  establecerModoFormularioPQRSF(esVistaCiudadano ? 'directo' : 'gestion');
  const pendientes = document.getElementById('pqrsPendientesGestion');
  const puedeConsultarPendientes = !esVistaCiudadano && esAdministrador();
  if (pendientes) pendientes.hidden = !puedeConsultarPendientes;
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

export function inicializarFormulario() {
  const hoy = new Date().toISOString().split('T')[0];
  const inputFechaRadicacion = document.getElementById('fechaRadicacion');
  const inputFechaEntregaManual = document.getElementById('fechaEntregaManual');
  const form = document.getElementById('pqrsForm');
  const formularioRecepcion = document.getElementById('formRecepcionPQRSF');

  if (inputFechaRadicacion) inputFechaRadicacion.value = hoy;
  if (inputFechaEntregaManual) inputFechaEntregaManual.value = hoy;

  inicializarSelectorDependenciasPqrs();
  calcularFechaVencimiento();
  document.getElementById('fechaRadicacion')?.addEventListener('input', calcularFechaVencimiento);
  document.getElementById('diasHabiles')?.addEventListener('input', calcularFechaVencimiento);
  document.getElementById('editFechaRadicacion')?.addEventListener('input', calcularFechaVencimientoEdicion);
  document.getElementById('editDiasHabiles')?.addEventListener('input', calcularFechaVencimientoEdicion);
  form?.addEventListener('submit', guardarRadicado);
  formularioRecepcion?.addEventListener('submit', procesarFormularioRecepcionPQRSF);
  document.getElementById('formConsultaEstadoCiudadano')?.addEventListener('submit', consultarEstadoCiudadano);
  document.getElementById('radicadoConsultaCiudadano')?.addEventListener('input', event => {
    event.target.value = event.target.value.toUpperCase();
  });
  establecerModoFormularioPQRSF(esCiudadano() ? 'directo' : 'gestion');
}
