import {
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { auth, db, GOOGLE_SCRIPT_URL, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { buscarRegistroRadicado, obtenerColeccionRegistro } from '../../data/registros.js';
import { convertirABase64, obtenerUrlHttpsSegura } from '../../utils/helpers.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import { sincronizarConsultaPublicaRadicado } from '../../services/consulta-publica.js';
import { recargarDatosIAS } from '../ias/tablero.js';
import { confirmarAccion } from '../ui/avisos.js';
import {
  esAdministrador,
  puedeGestionarIAS,
  puedeGestionarRadicado,
  obtenerPerfilSesion
} from '../auth/roles.js';
import { actualizarDisponibilidadAccionesRadicado, TIPOS_PETICION } from './tabla.js';
import { enviarNotificacionCorreo } from './notificaciones-correo.js';

const guardadosTipoPeticionPendientes = new Map();
const gruposRespuestaCache = new Map();

async function sincronizarConsultaPublicaSiAplica(radicado) {
  if (obtenerColeccionRegistro(radicado) !== RADICADOS_COLLECTION) return;
  try {
    await sincronizarConsultaPublicaRadicado(radicado.id);
  } catch (error) {
    console.error('No se pudo actualizar la consulta pública del radicado:', error);
    alert('La gestión se guardó, pero la consulta pública no se actualizó. Contacta al administrador.');
  }
}

function buscarRadicado(id, elemento) {
  const coleccion = elemento?.closest('tr')?.dataset.collection || '';
  return buscarRegistroRadicado(id, coleccion);
}

function recargarDatosRegistro(registro) {
  return obtenerColeccionRegistro(registro) === 'radicadosIAS'
    ? recargarDatosIAS()
    : cargarDatosDesdeFirebase();
}

function idsRadicadosCompartidos(radicado) {
  return [...new Set([
    radicado.grupoRespuestaId,
    ...(Array.isArray(radicado.grupoRadicadoIds) ? radicado.grupoRadicadoIds : [])
  ].filter(id => typeof id === 'string' && id))];
}

async function actualizarGrupoRadicado(radicado, campos) {
  const ids = idsRadicadosCompartidos(radicado);
  if (!ids.length || radicado.grupoRespuestaId !== radicado.id) {
    throw new Error('No se pudo identificar el grupo del radicado líder.');
  }
  const lote = writeBatch(db);
  ids.forEach(id => lote.update(doc(db, RADICADOS_COLLECTION, id), campos));
  await lote.commit();
}

async function obtenerGrupoRespuesta(radicado, actualizar = false) {
  const idGrupo = radicado.grupoRespuestaId;
  if (!idGrupo) throw new Error('No se encontró el grupo de respuesta de este radicado.');
  if (actualizar || !gruposRespuestaCache.has(idGrupo)) {
    gruposRespuestaCache.set(idGrupo, getDoc(doc(db, RADICADOS_COLLECTION, idGrupo)));
  }
  let snapshot;
  try {
    snapshot = await gruposRespuestaCache.get(idGrupo);
  } catch (error) {
    gruposRespuestaCache.delete(idGrupo);
    throw error;
  }
  if (!snapshot.exists()) {
    gruposRespuestaCache.delete(idGrupo);
    throw new Error('No se encontró el radicado principal del grupo.');
  }
  return snapshot.data();
}

function mostrarAportesEnModal(radicado, aportes) {
  const modal = document.getElementById('modalDetalleAportes');
  const lista = document.getElementById('listaDetalleAportes');
  document.getElementById('subtituloModalDetalleAportes').textContent =
    `Radicado ${radicado.radicado || radicado.id} · ${radicado.dependencia === radicado.dependenciaLider ? 'Todas las dependencias' : radicado.dependencia}`;
  lista.replaceChildren();

  if (!aportes.length) {
    const vacio = document.createElement('p');
    vacio.className = 'contribution-view-empty';
    vacio.textContent = 'Esta dependencia aún no ha enviado aportes.';
    lista.appendChild(vacio);
  }

  aportes.forEach(aporte => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'contribution-view-item';
    const encabezado = document.createElement('div');
    encabezado.className = 'contribution-view-heading';
    const dependencia = document.createElement('strong');
    dependencia.textContent = aporte.dependencia || 'Dependencia';
    encabezado.appendChild(dependencia);

    const fecha = document.createElement('small');
    const fechaAporte = new Date(aporte.fecha || '');
    fecha.textContent = Number.isNaN(fechaAporte.getTime())
      ? String(aporte.fecha || '')
      : new Intl.DateTimeFormat('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'America/Bogota'
        }).format(fechaAporte);
    encabezado.appendChild(fecha);
    tarjeta.appendChild(encabezado);

    if (aporte.funcionario) {
      const funcionario = document.createElement('p');
      funcionario.className = 'contribution-view-author';
      funcionario.textContent = `Enviado por: ${aporte.funcionario}`;
      tarjeta.appendChild(funcionario);
    }
    if (aporte.texto) {
      const texto = document.createElement('p');
      texto.className = 'contribution-view-text';
      texto.textContent = aporte.texto;
      tarjeta.appendChild(texto);
    }

    const enlaces = (Array.isArray(aporte.archivos) ? aporte.archivos : [])
      .map(obtenerUrlHttpsSegura)
      .filter(Boolean);
    enlaces.forEach((url, indice) => {
      const enlace = document.createElement('a');
      enlace.className = 'contribution-view-file-link';
      enlace.href = url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.innerHTML = `<i class="bi bi-file-earmark-pdf" aria-hidden="true"></i> Ver PDF ${indice + 1}`;
      tarjeta.appendChild(enlace);
    });
    lista.appendChild(tarjeta);
  });

  if (!modal.open) modal.showModal();
}

window.actualizarEstadoAporteDependencia = async function(idRadicado, boton) {
  const radicado = buscarRadicado(idRadicado, boton);
  if (!radicado?.grupoRespuestaId || !boton) return;
  try {
    const grupo = await obtenerGrupoRespuesta(radicado);
    const aportesPropios = (Array.isArray(grupo.aportesDependencias) ? grupo.aportesDependencias : [])
      .filter(aporte => aporte?.dependencia === radicado.dependencia);
    const etiqueta = boton.querySelector('span');
    if (aportesPropios.length) {
      if (etiqueta) etiqueta.textContent = 'Aporte Enviado';
      boton.title = 'Consultar la información enviada por esta dependencia';
    } else if (grupo.estado === 'CERRADO' || radicado.estado === 'CERRADO') {
      if (etiqueta) etiqueta.textContent = 'Aportes cerrados';
      boton.disabled = true;
      boton.title = 'Esta copia ya está cerrada';
    }
  } catch (error) {
    console.error('No se pudo consultar el estado del aporte:', error);
    boton.title = 'No se pudo consultar el aporte. Intenta de nuevo.';
  }
};

window.abrirAporteOConsultar = async function(idRadicado, boton) {
  const radicado = buscarRadicado(idRadicado, boton);
  if (!radicado?.grupoRespuestaId) return;
  try {
    const grupo = await obtenerGrupoRespuesta(radicado, true);
    const aportesPropios = (Array.isArray(grupo.aportesDependencias) ? grupo.aportesDependencias : [])
      .filter(aporte => aporte?.dependencia === radicado.dependencia);
    if (aportesPropios.length) {
      mostrarAportesEnModal(radicado, aportesPropios);
    } else if (grupo.estado === 'CERRADO' || radicado.estado === 'CERRADO') {
      alert(radicado.estado === 'CERRADO'
        ? 'Esta copia ya está cerrada y no admite nuevos aportes.'
        : 'El caso ya tiene respuesta final y no admite nuevos aportes.');
    } else {
      window.abrirModalAporteDependencia(idRadicado, boton);
    }
  } catch (error) {
    console.error('No se pudo consultar el aporte del radicado:', error);
    alert(`No se pudo consultar el aporte: ${error.message}`);
  }
};

window.abrirModalAportesGrupo = async function(idRadicado, boton) {
  const radicado = buscarRadicado(idRadicado, boton);
  if (!radicado?.grupoRespuestaId || radicado.dependencia !== radicado.dependenciaLider) return;
  try {
    const grupo = await obtenerGrupoRespuesta(radicado, true);
    const aportes = (Array.isArray(grupo.aportesDependencias) ? grupo.aportesDependencias : [])
      .filter(aporte => aporte && typeof aporte === 'object');
    mostrarAportesEnModal(radicado, aportes);
  } catch (error) {
    console.error('No se pudieron consultar los aportes del grupo:', error);
    alert(`No se pudieron consultar los aportes: ${error.message}`);
  }
};

window.cerrarModalDetalleAportes = function() {
  const modal = document.getElementById('modalDetalleAportes');
  if (modal?.open) modal.close();
};

function inicializarModalAporteDependencia() {
  const modal = document.getElementById('modalAporteDependencia');
  const formulario = document.getElementById('formAporteDependencia');
  const inputArchivos = document.getElementById('archivosAporteDependencia');
  const resumen = document.getElementById('resumenArchivosAporte');
  if (!modal || !formulario || !inputArchivos || formulario.dataset.initialized === 'true') return;
  formulario.dataset.initialized = 'true';

  inputArchivos.addEventListener('change', () => {
    const archivos = Array.from(inputArchivos.files || []);
    resumen.textContent = archivos.length
      ? `${archivos.length} archivo${archivos.length === 1 ? '' : 's'} seleccionado${archivos.length === 1 ? '' : 's'}`
      : 'Aún no has seleccionado archivos.';
  });
  formulario.addEventListener('submit', guardarAporteDependencia);
  document.getElementById('cerrarModalAporteDependencia')?.addEventListener('click', window.cerrarModalAporteDependencia);
  document.getElementById('cancelarAporteDependencia')?.addEventListener('click', window.cerrarModalAporteDependencia);
  document.getElementById('cerrarModalDetalleAportes')?.addEventListener('click', window.cerrarModalDetalleAportes);
  document.getElementById('cerrarDetalleAportes')?.addEventListener('click', window.cerrarModalDetalleAportes);
}

window.abrirModalAporteDependencia = function(idRadicado, boton) {
  const fila = boton?.closest('tr');
  const radicado = buscarRadicado(idRadicado, fila);
  if (!radicado?.grupoRespuestaId || radicado.dependencia === radicado.dependenciaLider) {
    alert('No se pudo identificar el grupo de respuesta de esta dependencia.');
    return;
  }
  if (!puedeGestionarRadicado(radicado.dependencia)) {
    alert('No tienes permiso para aportar a este radicado.');
    return;
  }

  const modal = document.getElementById('modalAporteDependencia');
  const formulario = document.getElementById('formAporteDependencia');
  formulario.reset();
  document.getElementById('errorAporteDependencia').hidden = true;
  document.getElementById('resumenArchivosAporte').textContent = 'Aún no has seleccionado archivos.';
  modal.dataset.radicadoId = idRadicado;
  modal.dataset.collection = obtenerColeccionRegistro(radicado);
  document.getElementById('subtituloModalAporteDependencia').textContent =
    `Radicado ${radicado.radicado || idRadicado} · ${radicado.dependencia}. La dependencia líder es ${radicado.dependenciaLider}.`;
  modal.showModal();
};

window.cerrarModalAporteDependencia = function() {
  const modal = document.getElementById('modalAporteDependencia');
  if (modal?.open) modal.close();
};

async function guardarAporteDependencia(event) {
  event.preventDefault();
  const modal = document.getElementById('modalAporteDependencia');
  const inputArchivos = document.getElementById('archivosAporteDependencia');
  const texto = document.getElementById('textoAporteDependencia').value.trim();
  const archivos = Array.from(inputArchivos.files || []);
  const error = document.getElementById('errorAporteDependencia');
  const boton = document.getElementById('guardarAporteDependencia');
  const id = modal.dataset.radicadoId;
  const radicado = buscarRegistroRadicado(id, modal.dataset.collection || '');
  if (boton.disabled) return;
  error.hidden = true;

  if (!radicado?.grupoRespuestaId || radicado.dependencia === radicado.dependenciaLider) {
    error.textContent = 'El aporte solo está disponible para las dependencias colaboradoras del grupo.';
    error.hidden = false;
    return;
  }
  if (!puedeGestionarRadicado(radicado.dependencia)) {
    error.textContent = 'No tienes permiso para aportar a este radicado.';
    error.hidden = false;
    return;
  }
  if (!texto && !archivos.length) {
    error.textContent = 'Escribe un concepto o adjunta al menos un PDF.';
    error.hidden = false;
    return;
  }
  if (archivos.length > 10) {
    error.textContent = 'Puedes adjuntar hasta 10 PDF.';
    error.hidden = false;
    return;
  }
  for (const archivo of archivos) {
    if (!/\.pdf$/i.test(archivo.name)
      || (archivo.type && archivo.type.toLowerCase() !== 'application/pdf')
      || archivo.size > 30 * 1024 * 1024
      || await archivo.slice(0, 5).text() !== '%PDF-') {
      error.textContent = 'Cada archivo debe ser un PDF válido de máximo 30 MB.';
      error.hidden = false;
      return;
    }
  }

  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  boton.textContent = 'Guardando aporte...';
  const urls = [];
  let aporteGuardado = false;
  try {
    const referenciaGrupo = doc(db, RADICADOS_COLLECTION, radicado.grupoRespuestaId);
    const snapshotGrupo = await getDoc(referenciaGrupo);
    if (!snapshotGrupo.exists()) throw new Error('No se encontró el radicado principal del grupo.');
    const grupo = snapshotGrupo.data();
    if (!Array.isArray(grupo.dependenciasParticipantes)
      || !grupo.dependenciasParticipantes.includes(radicado.dependencia)
      || grupo.dependenciaLider !== radicado.dependenciaLider) {
      throw new Error('La dependencia no pertenece al grupo de este radicado.');
    }
    if (grupo.estado === 'CERRADO') {
      throw new Error('El radicado ya tiene una respuesta final y está cerrado.');
    }
    const dependenciasAportesEnviados = Array.isArray(grupo.dependenciasAportesEnviados)
      ? grupo.dependenciasAportesEnviados
      : (Array.isArray(grupo.aportesDependencias) ? grupo.aportesDependencias : [])
        .filter(aporte => aporte && typeof aporte === 'object')
        .map(aporte => aporte.dependencia);
    if (dependenciasAportesEnviados.includes(radicado.dependencia)) {
      throw new Error('Esta dependencia ya envió su aporte.');
    }
    if (radicado.id === radicado.grupoRespuestaId) {
      throw new Error('No se puede cerrar la copia de la dependencia líder al enviar un aporte.');
    }

    for (const [indice, archivo] of archivos.entries()) {
      const base64File = await convertirABase64(archivo);
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          archivoBase64: base64File.split(',')[1] || '',
          nombreArchivo: `Aporte_${radicado.radicado}_${radicado.dependencia}_${indice + 1}_${archivo.name}`,
          mimeType: 'application/pdf'
        })
      });
      if (!response.ok) throw new Error(`Google Drive respondió con el estado ${response.status}.`);
      const resultado = await response.json();
      let url;
      try {
        url = new URL(resultado.url);
      } catch {
        throw new Error('Google Drive devolvió una URL de archivo no válida.');
      }
      if (resultado.status !== 'success'
        || url.protocol !== 'https:'
        || url.hostname !== 'drive.google.com') {
        throw new Error(resultado.message || 'No fue posible guardar el PDF de aporte.');
      }
      urls.push(url.href);
    }

    const aporte = {
      id: `${auth.currentUser?.uid || 'usuario'}-${Date.now()}`,
      dependencia: radicado.dependencia,
      funcionario: obtenerPerfilSesion()?.nombre || '',
      texto,
      archivos: urls,
      fecha: new Date().toISOString()
    };
    const fechaCambioEstado = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const loteAporte = writeBatch(db);
    loteAporte.update(referenciaGrupo, {
      aportesDependencias: arrayUnion(aporte),
      dependenciasAportesEnviados: arrayUnion(radicado.dependencia)
    });
    loteAporte.update(doc(db, RADICADOS_COLLECTION, radicado.id), {
      estado: 'CERRADO',
      fechaCambioEstado
    });
    await loteAporte.commit();
    aporteGuardado = true;
    gruposRespuestaCache.delete(radicado.grupoRespuestaId);
    window.cerrarModalAporteDependencia();
    try {
      const recargaExitosa = await recargarDatosRegistro(radicado);
      if (recargaExitosa === false) {
        alert('El aporte se guardó correctamente, pero no se pudo actualizar la vista. Recarga la página para ver los cambios.');
        return;
      }
    } catch (errorRecarga) {
      console.error('El aporte se guardó, pero no se pudo actualizar la vista:', errorRecarga);
      alert('El aporte se guardó correctamente, pero no se pudo actualizar la vista. Recarga la página para ver los cambios.');
      return;
    }
    alert('El aporte se envió correctamente y se cerró la copia de esta dependencia. El caso compartido sigue abierto para la dependencia líder.');
  } catch (saveError) {
    console.error('Error al guardar el aporte de la dependencia:', saveError);
    error.textContent = `No fue posible guardar el aporte: ${saveError.message}`;
    error.hidden = false;
    if (!aporteGuardado) {
      const urlsNoEliminadas = [];
      for (const url of urls) {
        try {
          const respuestaEliminacion = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', pdfUrl: url })
          });
          const resultadoEliminacion = await respuestaEliminacion.json();
          if (!respuestaEliminacion.ok || resultadoEliminacion.status !== 'success') {
            urlsNoEliminadas.push(url);
          }
        } catch (errorLimpieza) {
          console.error('No fue posible limpiar un PDF de aporte no guardado:', errorLimpieza);
          urlsNoEliminadas.push(url);
        }
      }
      if (urlsNoEliminadas.length) {
        console.error('Algunos PDF de aporte no guardados siguen en Drive:', urlsNoEliminadas);
      }
    }
  } finally {
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    boton.innerHTML = '<i class="bi bi-send" aria-hidden="true"></i> Enviar aporte';
  }
}

window.guardarTipoPeticionRadicado = async function(idRadicado, selectElement) {
  const tipoPeticion = selectElement.value;
  const tipoPeticionTexto = selectElement.selectedOptions[0]?.textContent.trim()
    || 'Selecciona un tipo de petición';
  selectElement.title = tipoPeticionTexto;
  const radicado = buscarRadicado(idRadicado, selectElement);
  if (!radicado || (tipoPeticion && !TIPOS_PETICION.includes(tipoPeticion))) {
    alert('No fue posible guardar el tipo de petición seleccionado.');
    return false;
  }

  const tipoAnterior = radicado.tipoPeticion || '';
  const fila = selectElement.closest('tr');
  const indicacionTipoPeticion = fila?.querySelector('.petition-type-hint');
  selectElement.disabled = true;
  if (fila) {
    fila.dataset.guardandoTipoPeticion = 'true';
    actualizarDisponibilidadAccionesRadicado(fila);
  }
  if (indicacionTipoPeticion) indicacionTipoPeticion.textContent = 'Guardando tipo...';
  const guardado = updateDoc(doc(db, obtenerColeccionRegistro(radicado), idRadicado), { tipoPeticion })
    .then(() => {
      radicado.tipoPeticion = tipoPeticion;
      if (indicacionTipoPeticion) {
        indicacionTipoPeticion.textContent = tipoPeticion ? 'Tipo definido' : 'Requerido para gestionar';
      }
      return true;
    })
    .catch(error => {
      console.error("Error al guardar el tipo de petición:", error);
      selectElement.value = tipoAnterior;
      selectElement.title = tipoAnterior || 'Selecciona un tipo de petición';
      if (indicacionTipoPeticion) {
        indicacionTipoPeticion.textContent = tipoAnterior ? 'Tipo definido' : 'Requerido para gestionar';
      }
      alert("No fue posible guardar el tipo de petición: " + error.message);
      return false;
    })
    .finally(() => {
      selectElement.disabled = false;
      if (fila) {
        delete fila.dataset.guardandoTipoPeticion;
        actualizarDisponibilidadAccionesRadicado(fila);
      }
      guardadosTipoPeticionPendientes.delete(idRadicado);
    });

  guardadosTipoPeticionPendientes.set(idRadicado, guardado);
  return guardado;
};

window.abrirModalRespuestaRadicado = function(idRadicado, boton) {
  const modal = document.getElementById('modalRespuestaRadicado');
  const formulario = document.getElementById('formRespuestaRadicado');
  const inputArchivos = document.getElementById('archivosRespuestaRadicado');
  const checkboxEvidencia = document.getElementById('respuestaSoloEvidenciaModal');
  const checkboxCorreo = document.getElementById('respuestaEnviarAlCiudadanoModal');
  const ayuda = document.getElementById('ayudaEntregaRespuesta');
  const error = document.getElementById('errorRespuestaRadicado');
  const resumen = document.getElementById('resumenArchivosRespuesta');
  const lista = document.getElementById('listaArchivosRespuesta');
  if (!modal || !formulario || !inputArchivos) return;

  const fila = boton?.closest('tr');
  const radicado = buscarRadicado(idRadicado, fila);
  if (!radicado) {
    alert('No fue posible abrir la carga de respuesta.');
    return;
  }
  if (radicado.grupoRespuestaId
    && (radicado.dependenciaLider !== radicado.dependencia
      || radicado.grupoRespuestaId !== radicado.id)) {
    alert('La respuesta final solo puede cargarla la dependencia líder del grupo.');
    return;
  }
  modal.dataset.radicadoId = idRadicado;
  modal.dataset.collection = obtenerColeccionRegistro(radicado);
  formulario.reset();
  inputArchivos.value = '';
  resumen.textContent = 'Aún no has seleccionado archivos.';
  lista.replaceChildren();
  error.hidden = true;
  error.textContent = '';
  checkboxEvidencia.checked = true;

  const puedeCorreo = radicado.notificacionRespuestaTipo === 'Correo'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(radicado.notificacionRespuestaContacto || '').trim());
  checkboxCorreo.disabled = !puedeCorreo;
  checkboxCorreo.checked = false;
  ayuda.textContent = puedeCorreo
    ? 'Puedes enviarlos por correo o dejarlos únicamente como evidencia pública.'
    : radicado.notificacionRespuestaTipo === 'Correo'
      ? 'El correo registrado no es válido. La respuesta solo podrá quedar como evidencia.'
      : 'El ciudadano no registró el correo como medio de notificación. La respuesta solo podrá quedar como evidencia.';
  document.getElementById('tituloModalRespuestaRadicado').textContent =
    radicado.grupoRespuestaId ? 'Cargar respuesta final' : 'Cargar respuesta';
  document.getElementById('subtituloModalRespuestaRadicado').textContent =
    radicado.grupoRespuestaId
      ? `Radicado ${radicado.radicado || idRadicado}. Esta respuesta cerrará el caso para todas las dependencias participantes.`
      : `Radicado ${radicado.radicado || idRadicado}`;
  document.getElementById('progresoRespuestaRadicado').hidden = true;
  document.getElementById('porcentajeRespuestaRadicado').textContent = '0%';
  document.getElementById('barraProgresoRespuestaRadicado').style.width = '0%';
  modal.showModal();
};

window.cerrarModalRespuestaRadicado = function() {
  const modal = document.getElementById('modalRespuestaRadicado');
  if (modal?.open) modal.close();
};

window.subirRespuestaRadicado = async function(idRadicado, inputElement) {
  const archivos = Array.from(inputElement.files || []);
  if (!archivos.length) return;
  if (archivos.length > 10) {
    alert('Puedes cargar hasta 10 archivos PDF por respuesta.');
    inputElement.value = '';
    return;
  }

  for (const archivo of archivos) {
    const esPdf = /\.pdf$/i.test(archivo.name)
      && (!archivo.type || archivo.type.toLowerCase() === 'application/pdf');
    if (!esPdf || archivo.size > 30 * 1024 * 1024
      || await archivo.slice(0, 5).text() !== '%PDF-') {
      alert('Cada archivo debe ser un PDF válido de máximo 30 MB.');
      inputElement.value = '';
      return;
    }
  }

  const esModal = inputElement.id === 'archivosRespuestaRadicado';
  const fila = esModal
    ? Array.from(document.querySelectorAll('tr[data-radicado-id]'))
      .find(filaRadicado => filaRadicado.dataset.radicadoId === idRadicado)
    : inputElement.closest('tr');
  const checkboxEvidencia = esModal
    ? document.getElementById('respuestaSoloEvidenciaModal')
    : fila?.querySelector('.response-evidence-only');
  const checkboxEnviarCorreo = esModal
    ? document.getElementById('respuestaEnviarAlCiudadanoModal')
    : fila?.querySelector('.response-send-to-citizen');
  const soloEvidencia = checkboxEvidencia?.checked === true;
  const enviarAlCiudadano = checkboxEnviarCorreo?.checked === true;
  if (soloEvidencia === enviarAlCiudadano) {
    alert('Selecciona una sola opción: Solo evidencia o Enviar al ciudadano.');
    inputElement.value = '';
    return;
  }
  if (enviarAlCiudadano
    && archivos.reduce((total, archivo) => total + archivo.size, 0) > 25 * 1024 * 1024) {
    alert('El tamaño total de los archivos que se enviarán por correo no puede superar 25 MB.');
    inputElement.value = '';
    return;
  }

  const selectTipoPeticion = fila?.querySelector('.tipo-peticion-select');
  if (!esModal && !selectTipoPeticion?.value) {
    alert('Selecciona el tipo de petición antes de cargar la respuesta.');
    inputElement.value = '';
    selectTipoPeticion?.focus();
    return;
  }

  const guardadoPendiente = guardadosTipoPeticionPendientes.get(idRadicado);
  if (guardadoPendiente && !(await guardadoPendiente)) {
    inputElement.value = '';
    return;
  }

  const radicado = buscarRadicado(idRadicado, inputElement);
  if (!radicado?.tipoPeticion) {
    alert('Guarda el tipo de petición antes de cargar la respuesta.');
    inputElement.value = '';
    return;
  }
  if (!radicado.funcionarioAsignado?.trim()) {
    alert('Asigna un funcionario antes de cargar la respuesta.');
    inputElement.value = '';
    return;
  }
  if (enviarAlCiudadano && (
    radicado.notificacionRespuestaTipo !== 'Correo'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(radicado.notificacionRespuestaContacto || '').trim())
  )) {
    alert('Solo puedes enviar la respuesta si el ciudadano registró un correo válido como medio de notificación.');
    inputElement.value = '';
    return;
  }

  const tdCell = esModal
    ? fila?.querySelector('td:nth-child(12)')
    : inputElement.closest('td');
  if (!tdCell) {
    alert('No fue posible identificar la columna de respuesta.');
    inputElement.value = '';
    return;
  }
  const contenidoOriginal = tdCell.innerHTML;

  setTimeout(async () => {
    let timerProgreso;
    const urlsCargadas = [];
    const urlsNoEliminadas = [];
    let guardado = false;
    let mensajeCorreo = '';
    try {
      let txtProgreso;
      let barraProgreso;
      if (esModal) {
        const modalProgreso = document.getElementById('progresoRespuestaRadicado');
        modalProgreso.hidden = false;
        txtProgreso = document.getElementById('porcentajeRespuestaRadicado');
        barraProgreso = document.getElementById('barraProgresoRespuestaRadicado');
        document.getElementById('textoProgresoRespuestaRadicado').textContent = 'Subiendo archivos...';
      } else {
        tdCell.innerHTML = `
          <div class="response-upload-progress">
            <div class="response-upload-progress-label">
              <span>Subiendo archivos...</span>
              <span id="progreso-txt-${idRadicado}">0%</span>
            </div>
            <div class="response-upload-progress-track">
              <div id="barra-progreso-${idRadicado}" class="response-upload-progress-bar"></div>
            </div>
          </div>
        `;
        txtProgreso = document.getElementById(`progreso-txt-${idRadicado}`);
        barraProgreso = document.getElementById(`barra-progreso-${idRadicado}`);
      }

      let porcentajeActual = 10;
      if (txtProgreso && barraProgreso) {
        txtProgreso.textContent = `${porcentajeActual}%`;
        barraProgreso.style.width = `${porcentajeActual}%`;
      }

      timerProgreso = setInterval(() => {
        if (porcentajeActual < 85) {
          porcentajeActual += Math.floor(Math.random() * 10) + 5;
          if (porcentajeActual > 85) porcentajeActual = 85;
          if (txtProgreso && barraProgreso) {
            txtProgreso.textContent = `${porcentajeActual}%`;
            barraProgreso.style.width = `${porcentajeActual}%`;
          }
        }
      }, 200);

      for (let indice = 0; indice < archivos.length; indice += 1) {
        const archivo = archivos[indice];
        const base64File = await convertirABase64(archivo);
        const rawBase64 = base64File.split(',')[1] || '';
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            archivoBase64: rawBase64,
            nombreArchivo: `Respuesta_${idRadicado}_${indice + 1}_${archivo.name}`,
            mimeType: 'application/pdf'
          })
        });
        if (!response.ok) {
          throw new Error(`Google Drive respondió con el estado ${response.status}.`);
        }
        const resData = await response.json();
        if (resData.status !== 'success') {
          throw new Error(`Error en Google Drive: ${resData.message || 'no fue posible guardar el PDF.'}`);
        }
        let urlArchivo;
        try {
          urlArchivo = new URL(resData.url);
        } catch {
          throw new Error('Google Drive devolvió una URL de archivo no válida.');
        }
        if (urlArchivo.protocol !== 'https:' || urlArchivo.hostname !== 'drive.google.com') {
          throw new Error('Google Drive devolvió una URL de archivo no permitida.');
        }
        urlsCargadas.push(urlArchivo.href);

        porcentajeActual = Math.round(((indice + 1) / archivos.length) * 85);
        if (txtProgreso && barraProgreso) {
          txtProgreso.textContent = `${porcentajeActual}%`;
          barraProgreso.style.width = `${porcentajeActual}%`;
        }
      }

      clearInterval(timerProgreso);
      if (txtProgreso && barraProgreso) {
        txtProgreso.textContent = '90%';
        barraProgreso.style.width = '90%';
      }

      const radicadoRef = doc(db, obtenerColeccionRegistro(radicado), idRadicado);
      const fechaCargaRespuesta = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const camposRespuesta = {
        respuestaUrl: urlsCargadas[0],
        respuestaArchivos: urlsCargadas,
        respuestaSoloEvidencia: soloEvidencia,
        respuestaEnviarAlCiudadano: enviarAlCiudadano,
        fechaCargaRespuesta,
        fechaCambioEstado: fechaCargaRespuesta,
        estado: 'CERRADO',
        correoRespuestaEstado: enviarAlCiudadano ? 'pendiente' : 'no-aplica',
        correoRespuestaFecha: '',
        correoRespuestaError: ''
      };
      if (radicado.grupoRespuestaId) {
        await actualizarGrupoRadicado(radicado, camposRespuesta);
      } else {
        await updateDoc(radicadoRef, camposRespuesta);
      }
      guardado = true;
      radicado.respuestaUrl = urlsCargadas[0];
      radicado.respuestaArchivos = urlsCargadas;
      radicado.respuestaSoloEvidencia = soloEvidencia;
      radicado.respuestaEnviarAlCiudadano = enviarAlCiudadano;
      if (txtProgreso && barraProgreso) {
        txtProgreso.textContent = '100%';
        barraProgreso.style.width = '100%';
      }

      if (enviarAlCiudadano) {
        let resultadoCorreo;
        try {
          resultadoCorreo = await enviarNotificacionCorreo('respuesta', {
            id: idRadicado,
            coleccion: obtenerColeccionRegistro(radicado)
          });
        } catch (errorCorreo) {
          console.error('No fue posible enviar la respuesta por correo:', errorCorreo);
          const mensajeErrorCorreo = String(errorCorreo?.message || errorCorreo).slice(0, 500);
          try {
            const camposCorreoError = {
              correoRespuestaEstado: 'error',
              correoRespuestaFecha: '',
              correoRespuestaError: mensajeErrorCorreo
            };
            if (radicado.grupoRespuestaId) {
              await actualizarGrupoRadicado(radicado, camposCorreoError);
            } else {
              await updateDoc(radicadoRef, camposCorreoError);
            }
          } catch (errorRegistroCorreo) {
            console.error('No fue posible registrar el error del correo de respuesta:', errorRegistroCorreo);
          }
          mensajeCorreo = `La respuesta se cargó, pero no se pudo enviar el correo: ${mensajeErrorCorreo}`;
        }

        if (resultadoCorreo) {
          const enviado = Number(resultadoCorreo.sent) > 0 || Number(resultadoCorreo.alreadySent) > 0;
          try {
            const camposResultadoCorreo = {
              correoRespuestaEstado: enviado ? 'enviado' : 'omitido',
              correoRespuestaFecha: enviado ? fechaCargaRespuesta : '',
              correoRespuestaError: ''
            };
            if (radicado.grupoRespuestaId) {
              await actualizarGrupoRadicado(radicado, camposResultadoCorreo);
            } else {
              await updateDoc(radicadoRef, camposResultadoCorreo);
            }
            mensajeCorreo = enviado
                ? `La respuesta se cargó y se envió al ciudadano con ${urlsCargadas.length} PDF adjunto(s).`
              : 'La respuesta se cargó, pero el servicio no confirmó el envío del correo.';
          } catch (errorRegistroCorreo) {
            console.error('No fue posible registrar el resultado del correo de respuesta:', errorRegistroCorreo);
            mensajeCorreo = enviado
              ? 'El correo se envió con el PDF adjunto, pero no se pudo registrar su estado.'
              : 'La respuesta se cargó, pero el servicio no confirmó el envío del correo.';
          }
        }
      } else {
        const nombresArchivos = archivos.map(archivo => archivo.name).join(', ');
        mensajeCorreo = `La evidencia se cargó correctamente: "${nombresArchivos}".\n\nNo se envió correo al ciudadano. Si requiere atención, deberá acudir presencialmente.`;
      }

      await sincronizarConsultaPublicaSiAplica(radicado);
      await recargarDatosRegistro(radicado);
      alert(mensajeCorreo);
      if (esModal) window.cerrarModalRespuestaRadicado();

    } catch (error) {
      if (timerProgreso) clearInterval(timerProgreso);
      console.error("Error al cargar la respuesta:", error);
      if (!guardado && urlsCargadas.length) {
        for (const url of urlsCargadas) {
          try {
            const respuestaEliminacion = await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              body: JSON.stringify({ action: 'delete', pdfUrl: url })
            });
            const resultadoEliminacion = await respuestaEliminacion.json();
            if (!respuestaEliminacion.ok || resultadoEliminacion.status !== 'success') {
              urlsNoEliminadas.push(url);
            }
          } catch (errorLimpieza) {
            console.error('No fue posible limpiar un PDF que no se guardó en el radicado:', errorLimpieza);
            urlsNoEliminadas.push(url);
          }
        }
        if (urlsNoEliminadas.length) {
          console.error('Algunos archivos subidos no pudieron eliminarse de Drive:', urlsNoEliminadas);
        }
      }
      tdCell.innerHTML = contenidoOriginal;
      if (guardado) {
        tdCell.replaceChildren();
        const botonVisualizar = document.createElement('button');
        botonVisualizar.type = 'button';
        botonVisualizar.className = 'response-files-toggle';
        botonVisualizar.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i> Visualizar';
        botonVisualizar.addEventListener('click', () => {
          window.abrirModalVisualizarRespuesta?.(radicado, urlsCargadas);
        });
        tdCell.append(botonVisualizar);
      }
      alert(guardado
        ? `La respuesta quedó guardada, pero ocurrió un error al actualizar la vista: ${error.message}`
        : `Ocurrió un error al cargar los archivos de respuesta: ${error.message}${
          urlsNoEliminadas.length
            ? ` No fue posible limpiar ${urlsNoEliminadas.length} archivo(s) de Drive; contacta al administrador.`
            : ''
        }`);
    }
  }, 0);
};

function inicializarModalRespuestaRadicado() {
  const modal = document.getElementById('modalRespuestaRadicado');
  const formulario = document.getElementById('formRespuestaRadicado');
  const inputArchivos = document.getElementById('archivosRespuestaRadicado');
  const checkboxEvidencia = document.getElementById('respuestaSoloEvidenciaModal');
  const checkboxCorreo = document.getElementById('respuestaEnviarAlCiudadanoModal');
  const resumen = document.getElementById('resumenArchivosRespuesta');
  const lista = document.getElementById('listaArchivosRespuesta');
  const botonCerrar = document.getElementById('cerrarModalRespuestaRadicado');
  const botonCancelar = document.getElementById('cancelarRespuestaRadicado');
  if (!modal || !formulario || !inputArchivos) return;

  checkboxEvidencia?.addEventListener('change', () => {
    if (checkboxEvidencia.checked) checkboxCorreo.checked = false;
  });
  checkboxCorreo?.addEventListener('change', () => {
    if (checkboxCorreo.checked) checkboxEvidencia.checked = false;
  });

  inputArchivos.addEventListener('change', () => {
    const archivos = Array.from(inputArchivos.files || []);
    lista.replaceChildren(...archivos.map(archivo => {
      const item = document.createElement('li');
      item.textContent = `${archivo.name} · ${Math.max(1, Math.round(archivo.size / 1024))} KB`;
      return item;
    }));
    resumen.textContent = archivos.length
      ? `${archivos.length} archivo${archivos.length === 1 ? '' : 's'} seleccionado${archivos.length === 1 ? '' : 's'}`
      : 'Aún no has seleccionado archivos.';
  });

  formulario.addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('errorRespuestaRadicado');
    const idRadicado = modal.dataset.radicadoId;
    if (!idRadicado) return;
    error.hidden = true;
    window.subirRespuestaRadicado(idRadicado, inputArchivos);
  });

  botonCerrar?.addEventListener('click', window.cerrarModalRespuestaRadicado);
  botonCancelar?.addEventListener('click', window.cerrarModalRespuestaRadicado);
  modal.addEventListener('click', event => {
    if (event.target === modal) window.cerrarModalRespuestaRadicado();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarModalRespuestaRadicado);
  document.addEventListener('DOMContentLoaded', inicializarModalAporteDependencia);
} else {
  setTimeout(inicializarModalRespuestaRadicado, 0);
  setTimeout(inicializarModalAporteDependencia, 0);
}

window.eliminarRespuestaRadicado = async function(idRadicado, botonEliminar) {
  const radicado = buscarRadicado(idRadicado, botonEliminar);
  if (!radicado || !radicado.respuestaUrl) {
    alert("No se encontró el archivo de respuesta para eliminar.");
    return;
  }
  const puedeEliminarRespuesta = esAdministrador()
    || (obtenerColeccionRegistro(radicado) === 'radicadosIAS'
      ? puedeGestionarIAS()
      : puedeGestionarRadicado(radicado.dependencia));
  if (!puedeEliminarRespuesta) {
    alert('No tienes permiso para eliminar este archivo de respuesta.');
    return;
  }

  const confirmado = await confirmarAccion(
    '¿Estás seguro de que deseas eliminar el archivo de respuesta de Google Drive?',
    { titulo: 'Eliminar archivo de respuesta', aceptarTexto: 'Eliminar' }
  );
  if (!confirmado) {
    return;
  }

  const botonesAccion = botonEliminar?.parentElement?.querySelectorAll('button') || [];
  botonesAccion.forEach(boton => {
    boton.disabled = true;
  });
  if (botonEliminar) botonEliminar.textContent = "Eliminando...";

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        pdfUrl: radicado.respuestaUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al eliminar el archivo de Google Drive.`);
    }

    const resData = await response.json();
    if (resData.status !== "success") {
      throw new Error("Error en Google Drive: " + (resData.message || "No se pudo eliminar el archivo."));
    }

    await updateDoc(doc(db, obtenerColeccionRegistro(radicado), idRadicado), {
      respuestaUrl: "",
      fechaCargaRespuesta: "",
      fechaCambioEstado: new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date()),
      estado: radicado.funcionarioAsignado ? 'EN TRAMITE' : 'VIGENTE'
    });

    await sincronizarConsultaPublicaSiAplica(radicado);
    await recargarDatosRegistro(radicado);
    alert("El archivo de respuesta se eliminó de Google Drive.");
  } catch (error) {
    console.error("Error al eliminar el archivo de respuesta:", error);
    if (botonEliminar?.isConnected) {
      botonEliminar.textContent = "Eliminar";
      botonesAccion.forEach(boton => {
        boton.disabled = false;
      });
    }
    alert("No se pudo eliminar el archivo de respuesta: " + error.message);
  }
};
