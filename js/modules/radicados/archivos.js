import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { buscarRegistroRadicado, obtenerColeccionRegistro } from '../../data/registros.js';
import { convertirABase64 } from '../../utils/helpers.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import { sincronizarConsultaPublicaRadicado } from '../../services/consulta-publica.js';
import { recargarDatosIAS } from '../ias/tablero.js';
import { confirmarAccion } from '../ui/avisos.js';
import {
  esAdministrador,
  puedeGestionarIAS,
  puedeGestionarRadicado
} from '../auth/roles.js';
import { actualizarDisponibilidadAccionesRadicado, TIPOS_PETICION } from './tabla.js';
import { enviarNotificacionCorreo } from './notificaciones-correo.js';

const guardadosTipoPeticionPendientes = new Map();

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
  document.getElementById('subtituloModalRespuestaRadicado').textContent =
    `Radicado ${radicado.radicado || idRadicado}`;
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
    if (!esPdf || archivo.size > 10 * 1024 * 1024
      || await archivo.slice(0, 5).text() !== '%PDF-') {
      alert('Cada archivo debe ser un PDF válido de máximo 10 MB.');
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
      await updateDoc(radicadoRef, {
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
      });
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
            await updateDoc(radicadoRef, {
              correoRespuestaEstado: 'error',
              correoRespuestaFecha: '',
              correoRespuestaError: mensajeErrorCorreo
            });
          } catch (errorRegistroCorreo) {
            console.error('No fue posible registrar el error del correo de respuesta:', errorRegistroCorreo);
          }
          mensajeCorreo = `La respuesta se cargó, pero no se pudo enviar el correo: ${mensajeErrorCorreo}`;
        }

        if (resultadoCorreo) {
          const enviado = Number(resultadoCorreo.sent) > 0 || Number(resultadoCorreo.alreadySent) > 0;
          try {
            await updateDoc(radicadoRef, {
              correoRespuestaEstado: enviado ? 'enviado' : 'omitido',
              correoRespuestaFecha: enviado ? fechaCargaRespuesta : '',
              correoRespuestaError: ''
            });
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
} else {
  setTimeout(inicializarModalRespuestaRadicado, 0);
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
