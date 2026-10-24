import { deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL } from '../../config/firebase-config.js';
import { datosRadicados } from '../../data/radicados.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';

export function inicializarAccionesRadicados() {
  document.getElementById('formEditar')?.addEventListener('submit', guardarEdicionRadicado);
  document.getElementById('txtFuncionarioAsignado')?.addEventListener('input', actualizarEstadoFuncionarioPreview);
}

function actualizarEstadoFuncionarioPreview(event) {
  const preview = document.getElementById('estadoFuncionarioPreview');
  if (preview) {
    preview.textContent = event.currentTarget.value.trim()
      ? 'El radicado quedará En Trámite cuando guardes los cambios.'
      : 'Al escribir un nombre, el estado cambiará a En Trámite al guardar.';
  }
}

window.eliminarRadicado = async function(id, botonEliminar) {
  if (!confirm("¿Estás seguro de que deseas eliminar este radicado y sus archivos?")) {
    return;
  }

  if (botonEliminar) {
    botonEliminar.disabled = true;
    botonEliminar.innerHTML = '<span class="action-delete-spinner" aria-label="Eliminando"></span>';
    botonEliminar.title = "Eliminando...";
  }

  let radicadoAEliminar = null;
  for (const dep in datosRadicados) {
    const encontrado = datosRadicados[dep].find(r => r.id === id);
    if (encontrado) {
      radicadoAEliminar = encontrado;
      break;
    }
  }

  try {
    if (radicadoAEliminar && radicadoAEliminar.pdfUrl) {
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

    if (radicadoAEliminar && radicadoAEliminar.respuestaUrl) {
      try {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "delete",
            pdfUrl: radicadoAEliminar.respuestaUrl
          })
        });
      } catch (driveErr) {
        console.warn("No se pudo eliminar la respuesta de Drive:", driveErr);
      }
    }

    await deleteDoc(doc(db, "radicados", id));
    await cargarDatosDesdeFirebase();
    alert("El radicado y sus archivos se eliminaron correctamente.");

  } catch (error) {
    console.error("Error al eliminar:", error);
    if (botonEliminar?.isConnected) {
      botonEliminar.disabled = false;
      botonEliminar.textContent = "🗑️";
      botonEliminar.title = "Eliminar";
    }
    alert("No se pudo eliminar el radicado: " + error.message);
  }
};

window.prepararEdicion = function(id) {
  let item = null;
  for (const dep in datosRadicados) {
    const encontrado = datosRadicados[dep].find(r => r.id === id);
    if (encontrado) {
      item = encontrado;
      break;
    }
  }

  if (item) {
    if (document.getElementById('editDocId')) document.getElementById('editDocId').value = item.id;
    if (document.getElementById('editRadicado')) document.getElementById('editRadicado').value = item.radicado;
    if (document.getElementById('editFechaRadicacion')) document.getElementById('editFechaRadicacion').value = item.fechaRadicacion;
    if (document.getElementById('editFechaEntregaManual')) document.getElementById('editFechaEntregaManual').value = item.fechaEntregaManual || '';
    if (document.getElementById('editDiasHabiles')) document.getElementById('editDiasHabiles').value = item.diasHabiles;
    if (document.getElementById('editFechaEntrega')) document.getElementById('editFechaEntrega').value = item.fechaVencimiento;
    if (document.getElementById('editRemitente')) document.getElementById('editRemitente').value = item.remitente;
    if (document.getElementById('editAsunto')) document.getElementById('editAsunto').value = item.asunto;

    document.getElementById('modalEditar').style.display = 'flex';
  }
};

window.cerrarModalEditar = function() {
  document.getElementById('modalEditar').style.display = 'none';
};

async function guardarEdicionRadicado(e) {
  e.preventDefault();
  const id = document.getElementById('editDocId').value;

  try {
    const docRef = doc(db, "radicados", id);
    await updateDoc(docRef, {
      radicado: document.getElementById('editRadicado').value,
      fechaRadicacion: document.getElementById('editFechaRadicacion').value,
      fechaEntregaManual: document.getElementById('editFechaEntregaManual')?.value || '',
      diasHabiles: document.getElementById('editDiasHabiles').value,
      fechaEntrega: document.getElementById('editFechaEntrega').value,
      remitente: document.getElementById('editRemitente').value,
      asunto: document.getElementById('editAsunto').value
    });

    alert("Radicado actualizado correctamente.");
    cerrarModalEditar();
    await cargarDatosDesdeFirebase();
  } catch (error) {
    console.error("Error al actualizar:", error);
    alert("Ocurrió un error al actualizar los datos.");
  }
}

// ==========================================
// FUNCIONES GLOBALES PARA EL MODAL DE OTROS ESTADOS
// ==========================================

window.abrirModalOtrosEstados = function(id) {
  let item = null;
  for (const dep in datosRadicados) {
    const encontrado = datosRadicados[dep].find(r => r.id === id);
    if (encontrado) {
      item = encontrado;
      break;
    }
  }

  if (item) {
    document.getElementById('modalEstadoDocId').value = item.id;
    document.getElementById('txtFuncionarioAsignado').value = item.funcionarioAsignado || '';
    actualizarEstadoFuncionarioPreview({ currentTarget: document.getElementById('txtFuncionarioAsignado') });
    document.getElementById('selectOtrosEstados').value = item.otrosEstados || ''; // <--- Corregido a selectOtrosEstados
    document.getElementById('txtObservaciones').value = item.observaciones || '';
    document.getElementById('modalOtrosEstados').style.display = 'flex';
  }
};

window.cerrarModalOtrosEstados = function() {
  document.getElementById('modalOtrosEstados').style.display = 'none';
};

window.guardarOtrosEstados = async function() {
  const id = document.getElementById('modalEstadoDocId').value;
  const funcionarioAsignado = document.getElementById('txtFuncionarioAsignado').value.trim();
  const otrosEstados = document.getElementById('selectOtrosEstados').value; // <--- Corregido a selectOtrosEstados
  const observaciones = document.getElementById('txtObservaciones').value;

  try {
    const docRef = doc(db, "radicados", id);
    await updateDoc(docRef, {
      funcionarioAsignado,
      estado: funcionarioAsignado ? 'EN TRAMITE' : 'VIGENTE',
      otrosEstados: otrosEstados,
      observaciones: observaciones
    });

    alert("Gestión guardada correctamente.");
    cerrarModalOtrosEstados();
    await cargarDatosDesdeFirebase();
  } catch (error) {
    console.error("Error al guardar estado/observaciones:", error);
    alert("Ocurrió un error al guardar los datos.");
  }
};
