import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL } from '../../config/firebase-config.js';
import { datosRadicados } from '../../data/radicados.js';
import { convertirABase64 } from '../../utils/helpers.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import { confirmarAccion } from '../ui/avisos.js';
import { TIPOS_PETICION } from './tabla.js';

const guardadosTipoPeticionPendientes = new Map();

window.guardarTipoPeticionRadicado = async function(idRadicado, selectElement) {
  const tipoPeticion = selectElement.value;
  const radicado = Object.values(datosRadicados)
    .flat()
    .find(reg => reg.id === idRadicado);
  if (!radicado || (tipoPeticion && !TIPOS_PETICION.includes(tipoPeticion))) {
    alert('No fue posible guardar el tipo de petición seleccionado.');
    return false;
  }

  const tipoAnterior = radicado.tipoPeticion || '';
  const fila = selectElement.closest('tr');
  const botonOtrosEstados = fila?.querySelector('.other-states-button');
  const indicacionTipoPeticion = fila?.querySelector('.petition-type-hint');
  selectElement.disabled = true;
  if (botonOtrosEstados) botonOtrosEstados.disabled = true;
  if (indicacionTipoPeticion) indicacionTipoPeticion.textContent = 'Guardando tipo...';
  const guardado = updateDoc(doc(db, "radicados", idRadicado), { tipoPeticion })
    .then(() => {
      radicado.tipoPeticion = tipoPeticion;
      if (botonOtrosEstados) {
        botonOtrosEstados.disabled = !TIPOS_PETICION.includes(tipoPeticion);
        botonOtrosEstados.title = tipoPeticion
          ? 'Gestionar / Agregar Estado'
          : 'Selecciona primero el tipo de petición';
      }
      if (indicacionTipoPeticion) {
        indicacionTipoPeticion.textContent = tipoPeticion ? 'Tipo definido' : 'Requerido para gestionar';
      }
      return true;
    })
    .catch(error => {
      console.error("Error al guardar el tipo de petición:", error);
      selectElement.value = tipoAnterior;
      if (botonOtrosEstados) botonOtrosEstados.disabled = !TIPOS_PETICION.includes(tipoAnterior);
      if (indicacionTipoPeticion) {
        indicacionTipoPeticion.textContent = tipoAnterior ? 'Tipo definido' : 'Requerido para gestionar';
      }
      alert("No fue posible guardar el tipo de petición: " + error.message);
      return false;
    })
    .finally(() => {
      selectElement.disabled = false;
      guardadosTipoPeticionPendientes.delete(idRadicado);
    });

  guardadosTipoPeticionPendientes.set(idRadicado, guardado);
  return guardado;
};

window.subirRespuestaRadicado = async function(idRadicado, inputElement) {
  const file = inputElement.files ? inputElement.files[0] : null;
  if (!file) return;

  const selectTipoPeticion = inputElement.closest('tr')?.querySelector('.tipo-peticion-select');
  if (!selectTipoPeticion?.value) {
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

  const radicado = Object.values(datosRadicados)
    .flat()
    .find(reg => reg.id === idRadicado);
  if (!radicado?.tipoPeticion) {
    alert('Guarda el tipo de petición antes de cargar la respuesta.');
    inputElement.value = '';
    return;
  }

  const tdCell = inputElement.closest('td');
  const contenidoOriginal = tdCell.innerHTML;

  // Se envuelve el cambio de HTML en setTimeout para evitar romper el hilo de procesamiento del navegador
  setTimeout(async () => {
    try {
      // Inyectar la barra de progreso inicial
      tdCell.innerHTML = `
        <div class="response-upload-progress">
          <div class="response-upload-progress-label">
            <span>Subiendo...</span>
            <span id="progreso-txt-${idRadicado}">0%</span>
          </div>
          <div class="response-upload-progress-track">
            <div id="barra-progreso-${idRadicado}" class="response-upload-progress-bar"></div>
          </div>
        </div>
      `;

      const txtProgreso = document.getElementById(`progreso-txt-${idRadicado}`);
      const barraProgreso = document.getElementById(`barra-progreso-${idRadicado}`);

      let porcentajeActual = 10;
      if (txtProgreso && barraProgreso) {
        txtProgreso.textContent = `${porcentajeActual}%`;
        barraProgreso.style.width = `${porcentajeActual}%`;
      }

      const timerProgreso = setInterval(() => {
        if (porcentajeActual < 85) {
          porcentajeActual += Math.floor(Math.random() * 10) + 5;
          if (porcentajeActual > 85) porcentajeActual = 85;
          if (txtProgreso && barraProgreso) {
            txtProgreso.textContent = `${porcentajeActual}%`;
            barraProgreso.style.width = `${porcentajeActual}%`;
          }
        }
      }, 200);

      const base64File = await convertirABase64(file);
      const rawBase64 = base64File.split(',')[1] || "";

      const payload = {
        archivoBase64: rawBase64,
        nombreArchivo: `Respuesta_${idRadicado}_${file.name}`
      };

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      clearInterval(timerProgreso);

      if (resData.status !== "success") {
        throw new Error("Error en Google Drive: " + resData.message);
      }

      if (txtProgreso && barraProgreso) {
        txtProgreso.textContent = `100%`;
        barraProgreso.style.width = `100%`;
      }

      const respuestaUrl = resData.url;
      const radicadoRef = doc(db, "radicados", idRadicado);
      await updateDoc(radicadoRef, {
        respuestaUrl,
        fechaCargaRespuesta: new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date()),
        estado: 'CERRADO'
      });

      await cargarDatosDesdeFirebase();

    } catch (error) {
      console.error("Error al cargar la respuesta:", error);
      alert("Ocurrió un error al subir el archivo de respuesta: " + error.message);
      tdCell.innerHTML = contenidoOriginal;
    }
  }, 0);
};

window.eliminarRespuestaRadicado = async function(idRadicado, botonEliminar) {
  const confirmado = await confirmarAccion(
    '¿Estás seguro de que deseas eliminar el archivo de respuesta de Google Drive?',
    { titulo: 'Eliminar archivo de respuesta', aceptarTexto: 'Eliminar' }
  );
  if (!confirmado) {
    return;
  }

  const radicado = Object.values(datosRadicados)
    .flat()
    .find(reg => reg.id === idRadicado);

  if (!radicado || !radicado.respuestaUrl) {
    alert("No se encontró el archivo de respuesta para eliminar.");
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

    await updateDoc(doc(db, "radicados", idRadicado), {
      respuestaUrl: "",
      fechaCargaRespuesta: "",
      estado: radicado.funcionarioAsignado ? 'EN TRAMITE' : 'VIGENTE'
    });

    await cargarDatosDesdeFirebase();
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
