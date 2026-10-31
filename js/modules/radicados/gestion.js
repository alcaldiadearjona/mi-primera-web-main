import { deleteDoc, doc, runTransaction, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { datosRadicados } from '../../data/radicados.js';
import { buscarRegistroRadicado, obtenerColeccionRegistro, obtenerTodosLosRegistros } from '../../data/registros.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';
import { recargarDatosIAS } from '../ias/tablero.js';
import { abreviarNombreDependencia } from '../../utils/helpers.js';
import {
  esAdministrador,
  puedeGestionarIAS,
  puedeGestionarRadicado
} from '../auth/roles.js';
import { confirmarAccion } from '../ui/avisos.js';
import { actualizarDisponibilidadAccionesRadicado, TIPOS_PETICION } from './tabla.js';

function obtenerFechaActualBogota() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function inicializarAccionesRadicados() {
  document.getElementById('formEditar')?.addEventListener('submit', guardarEdicionRadicado);
  document.getElementById('formFuncionarioAsignado')?.addEventListener('submit', guardarFuncionarioAsignado);
  document.getElementById('txtFuncionarioAsignado')?.addEventListener('input', actualizarEstadoFuncionarioPreview);
  document.getElementById('alternarDependenciasRemision')?.addEventListener('click', alternarDesplegableRemision);
  document.getElementById('dependenciasRemisionCompetencia')?.addEventListener('change', actualizarResumenRemision);
  document.addEventListener('click', cerrarDesplegableRemisionAlClicExterno);
  document.addEventListener('keydown', cerrarDesplegableRemisionConEscape);
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

function generarIdCopiaCompetencia(idOrigen, dependencia) {
  const slug = dependencia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${idOrigen}__competencia__${slug}`;
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
      etiqueta.style.cssText = 'display:flex; align-items:center; gap:7px; padding:6px 7px; border-radius:6px; color:#334155; font-size:12px; cursor:pointer;';
      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.name = 'dependenciaDestinoCompetencia';
      casilla.value = dependencia;
      casilla.id = `dependenciaDestinoCompetencia-${indice}`;
      casilla.checked = destinosYaRemitidos.includes(dependencia);
      casilla.disabled = casilla.checked;
      if (casilla.disabled) etiqueta.style.cssText += 'opacity:.6; cursor:not-allowed;';
      etiqueta.htmlFor = casilla.id;
      etiqueta.append(casilla, document.createTextNode(abreviarNombreDependencia(dependencia)));
      contenedor.append(etiqueta);
    });
  actualizarResumenRemision();
}

function actualizarEstadoFuncionarioPreview(event) {
  const preview = document.getElementById('estadoFuncionarioPreview');
  if (preview) {
    preview.textContent = event.currentTarget.value.trim()
      ? 'Al guardar, el radicado quedará En Trámite y se habilitarán las acciones cuando también tenga tipo de petición.'
      : 'Escribe el nombre del funcionario para asignarlo al radicado.';
  }
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

  const funcionarioAsignado = document.getElementById('txtFuncionarioAsignado').value.trim();
  const estado = radicado.estado === 'R. por C.'
    ? 'R. por C.'
    : funcionarioAsignado ? 'EN TRAMITE' : 'VIGENTE';
  const actualizacionFuncionario = { funcionarioAsignado, estado };
  if (obtenerColeccionRegistro(radicado) === 'radicadosIAS' && funcionarioAsignado) {
    actualizacionFuncionario.fechaEntregaManual = obtenerFechaActualBogota();
  }

  try {
    await updateDoc(doc(db, obtenerColeccionRegistro(radicado), id), actualizacionFuncionario);
    const radicadoEnCache = datosRadicados[radicado.dependencia]
      ?.find(item => item.id === id);
    if (radicadoEnCache) {
      radicadoEnCache.funcionarioAsignado = funcionarioAsignado;
      radicadoEnCache.estado = estado;
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
    const archivosRelacionados = Boolean(
      radicadoAEliminar
      && (
        radicadoAEliminar.remisionOrigenId
        || radicadoAEliminar.dependenciasDestino?.length
      )
    );
    const todosRadicados = obtenerTodosLosRegistros();
    const pdfCompartido = Boolean(
      radicadoAEliminar?.pdfUrl
      && todosRadicados.some(radicado => radicado !== radicadoAEliminar && radicado.pdfUrl === radicadoAEliminar.pdfUrl)
    );
    const respuestaCompartida = Boolean(
      radicadoAEliminar?.respuestaUrl
      && todosRadicados.some(radicado => radicado !== radicadoAEliminar && radicado.respuestaUrl === radicadoAEliminar.respuestaUrl)
    );
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

    if (!archivosRelacionados && !respuestaCompartida && radicadoAEliminar?.respuestaUrl) {
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

    await deleteDoc(doc(db, obtenerColeccionRegistro(radicadoAEliminar), id));
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
  if (!esAdministrador()) return;
  const item = buscarRadicadoPorId(id, coleccion);

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

    document.getElementById('modalEditar').style.display = 'flex';
  }
};

window.cerrarModalEditar = function() {
  document.getElementById('modalEditar').style.display = 'none';
};

async function guardarEdicionRadicado(e) {
  e.preventDefault();
  if (!esAdministrador()) {
    alert('No tienes permiso para editar este radicado.');
    return;
  }
  const id = document.getElementById('editDocId').value;
  const coleccion = document.getElementById('editDocId').dataset.collection || '';
  const radicado = buscarRadicadoPorId(id, coleccion);
  if (!radicado) return;
  const boton = document.getElementById('btnGuardarEditar');
  const spinner = document.getElementById('spinnerGuardarEdicion');
  const texto = document.getElementById('textoGuardarEdicion');
  if (boton?.disabled) return;

  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando...';

  try {
    const docRef = doc(db, obtenerColeccionRegistro(radicado), id);
    await updateDoc(docRef, {
      radicado: document.getElementById('editRadicado').value,
      fechaRadicacion: document.getElementById('editFechaRadicacion').value,
      fechaEntregaManual: document.getElementById('editFechaEntregaManual')?.value || '',
      diasHabiles: document.getElementById('editDiasHabiles').value,
      [obtenerColeccionRegistro(radicado) === 'radicadosIAS' ? 'fechaVencimiento' : 'fechaEntrega']:
        document.getElementById('editFechaEntrega').value,
      remitente: document.getElementById('editRemitente').value,
      asunto: document.getElementById('editAsunto').value
    });

    alert("Radicado actualizado correctamente.");
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
  const input = document.getElementById('txtFuncionarioAsignado');
  input.value = item.funcionarioAsignado || '';
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
    cargarOpcionesRemision(item);
    const seccionRemision = document.getElementById('alternarDependenciasRemision')?.closest('section');
    if (seccionRemision) {
      seccionRemision.hidden = !esAdministrador();
    }
    document.getElementById('modalOtrosEstados').style.display = 'flex';
  }
};

window.cerrarModalOtrosEstados = function() {
  document.getElementById('modalOtrosEstados').style.display = 'none';
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
  if (destinosSeleccionados.length && !esAdministrador()) {
    alert('Solo el administrador puede remitir radicados por competencia.');
    return;
  }

  const boton = document.getElementById('btnGuardarOtrosEstados');
  const spinner = document.getElementById('spinnerGuardarOtrosEstados');
  const texto = document.getElementById('textoGuardarOtrosEstados');
  if (boton?.disabled) return;

  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (texto) texto.textContent = 'Guardando...';

  const otrosEstados = document.getElementById('selectOtrosEstados').value; // <--- Corregido a selectOtrosEstados
  const observaciones = document.getElementById('txtObservaciones').value;
  const fechaGestion = obtenerFechaActualBogota();
  const debeActualizarFechaRespuesta = Boolean(
    otrosEstados && (!radicado.fechaCargaRespuesta || otrosEstados !== radicado.otrosEstados)
  );

  try {
    const docRef = doc(db, obtenerColeccionRegistro(radicado), id);
    const camposGestion = {
      otrosEstados: otrosEstados,
      observaciones: observaciones,
      ...(debeActualizarFechaRespuesta ? { fechaCargaRespuesta: fechaGestion } : {})
    };

    if (destinosSeleccionados.length > 0) {
      const confirmado = await confirmarAccion(
        `La solicitud se remitirá a ${destinosSeleccionados.map(abreviarNombreDependencia).join(', ')}. Se crearán copias VIGENTES con el mismo número de radicado y el original quedará cerrado.`,
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
        const snapshotsCopias = await Promise.all(
          copias.map(copia => transaction.get(copia.referencia))
        );

        copias.forEach((copia, indice) => {
          const copiaExistente = snapshotsCopias[indice];
          if (copiaExistente.exists()) {
            if (copiaExistente.data().remisionOrigenId !== id) {
              throw new Error(`Ya existe un radicado con el identificador de copia para ${copia.dependencia}.`);
            }
            return;
          }
          transaction.set(copia.referencia, {
            ...radicadoOriginal,
            dependencia: copia.dependencia,
            estado: 'VIGENTE',
            funcionarioAsignado: '',
            otrosEstados: '',
            respuestaUrl: '',
            fechaCargaRespuesta: '',
            observaciones: '',
            dependenciasDestino: [],
            remisionOrigenId: id,
            remisionOrigenDependencia: radicadoOriginal.dependencia || '',
            remisionOrigenRadicado: radicadoOriginal.radicado || '',
            fechaRemisionCompetencia: fechaRemision
          });
        });
        transaction.update(docRef, {
          ...camposGestion,
          funcionarioAsignado: '',
          estado: 'R. por C.',
          fechaCargaRespuesta: fechaGestion,
          dependenciasDestino: [...new Set([...destinosPrevios, ...destinosSeleccionados])],
          fechaRemisionCompetencia: fechaRemision
        });
      });
    } else {
      await updateDoc(docRef, camposGestion);
    }

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
  }
};
