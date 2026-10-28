import { collection, doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { abreviarNombreDependencia, convertirABase64, sumarDiasHabilesColombia } from '../../utils/helpers.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';

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
  boton.setAttribute('aria-expanded', 'false');
  boton.querySelector('i')?.classList.replace('bi-chevron-up', 'bi-chevron-down');
}

function inicializarSelectorDependenciasPqrs() {
  const select = document.getElementById('dependencia');
  const opciones = document.getElementById('opcionesDependenciasPqrs');
  const boton = document.getElementById('alternarDependenciasPqrs');
  const selector = document.getElementById('selectorDependenciasPqrs');
  if (!select || !opciones || !boton || !selector || opciones.childElementCount > 0) return;

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
      casilla.addEventListener('change', actualizarResumenDependenciasPqrs);
      const nombre = document.createElement('span');
      nombre.textContent = abreviarNombreDependencia(option.value);
      etiqueta.htmlFor = casilla.id;
      etiqueta.title = option.value;
      etiqueta.append(casilla, nombre);
      opciones.append(etiqueta);
    });

  boton.addEventListener('click', () => {
    const expandido = boton.getAttribute('aria-expanded') === 'true';
    boton.setAttribute('aria-expanded', String(!expandido));
    opciones.hidden = expandido;
    boton.querySelector('i')?.classList.toggle('bi-chevron-down', expandido);
    boton.querySelector('i')?.classList.toggle('bi-chevron-up', !expandido);
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
  const dependenciasSeleccionadas = actualizarResumenDependenciasPqrs();
  if (dependenciasSeleccionadas.length === 0) {
    alert('Selecciona al menos una dependencia destino.');
    document.getElementById('alternarDependenciasPqrs')?.focus();
    return;
  }

  // Captura flexible de los elementos del botón y el spinner
  const btn = document.getElementById('btnGuardarRadicado') || document.getElementById('btnGuardar');
  const spinner = document.getElementById('spinnerGuardarRadicado');
  const icono = document.getElementById('iconoBtnGuardar');
  const texto = document.getElementById('textoBtnGuardar');

  // Mostrar Spinner SVG y deshabilitar botón
  if (spinner) spinner.style.display = 'inline-block';
  if (icono) icono.style.display = 'none';
  if (texto) texto.textContent = 'Subiendo PDF...';
  if (btn) btn.disabled = true;

  const fileInput = document.getElementById('solicitudPdf');
  const archivoPdf = fileInput?.files[0];
  let driveUrl = "";

  try {
    // 1. Subida del archivo PDF a Google Drive si existe
    if (archivoPdf) {
      const base64Pdf = await convertirABase64(archivoPdf);
      const rawBase64 = base64Pdf.split(',')[1] || "";

      const payload = {
        archivoBase64: rawBase64,
        nombreArchivo: `Radicado_${document.getElementById('radicado').value}_${archivoPdf.name}`
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
    if (texto) texto.textContent = 'Guardando datos...';

    // 2. Estructuración de los datos del nuevo radicado
    const nuevoRadicado = {
      radicado: document.getElementById('radicado').value.trim(),
      estado: 'VIGENTE',
      fechaRadicacion: document.getElementById('fechaRadicacion').value,
      fechaEntregaManual: document.getElementById('fechaEntregaManual').value,
      diasHabiles: document.getElementById('diasHabiles').value,
      fechaVencimiento: document.getElementById('fechaEntrega').value,
      remitente: document.getElementById('remitente').value.trim(),
      asunto: document.getElementById('asunto').value.trim(),
      pdfUrl: driveUrl || ''
    };

    const registrosDestino = dependenciasSeleccionadas.map(dependencia => ({
      dependencia,
      referencia: doc(collection(db, RADICADOS_COLLECTION))
    }));
    const lote = writeBatch(db);
    registrosDestino.forEach(({ dependencia, referencia }) => {
      lote.set(referencia, {
        ...nuevoRadicado,
        dependencia
      });
    });
    await lote.commit();

    alert(
      `La PQRS ${nuevoRadicado.radicado} se envió a las siguientes dependencias:\n\n`
      + dependenciasSeleccionadas.map(dependencia => `• ${dependencia}`).join('\n')
    );
    document.getElementById('pqrsForm')?.reset();
    document.querySelectorAll('input[name="dependenciasDestinoPqrs"]').forEach(casilla => {
      casilla.checked = false;
    });
    actualizarResumenDependenciasPqrs();
    cerrarDesplegableDependenciasPqrs();

    // Resetear valores por defecto de fechas
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('fechaRadicacion')) document.getElementById('fechaRadicacion').value = hoy;
    if (document.getElementById('fechaEntregaManual')) document.getElementById('fechaEntregaManual').value = hoy;
    if (document.getElementById('diasHabiles')) document.getElementById('diasHabiles').value = 15;
    if (typeof calcularFechaVencimiento === 'function') calcularFechaVencimiento();

    await cargarDatosDesdeFirebase();

  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Ocurrió un error al procesar el registro: " + error.message);
  } finally {
  if (spinner) spinner.style.display = 'none';
  if (texto) texto.textContent = 'Guardar Radicado';
  if (btn) btn.disabled = false;
}
}

window.toggleFormulario = function() {
  const formCard = document.getElementById('contenedorFormulario');
  if (formCard) {
    establecerFormularioVisible(formCard.style.display === 'none' || formCard.style.display === '');
  }
};

export function establecerFormularioVisible(visible) {
  const formCard = document.getElementById('contenedorFormulario');
  const toggle = document.querySelector('.dashboard-form-toggle');
  if (!formCard) return;

  formCard.style.display = visible ? 'block' : 'none';
  toggle?.setAttribute('aria-expanded', String(visible));
  toggle?.classList.toggle('is-collapsed', !visible);
}

export function inicializarFormulario() {
  const hoy = new Date().toISOString().split('T')[0];
  const inputFechaRadicacion = document.getElementById('fechaRadicacion');
  const inputFechaEntregaManual = document.getElementById('fechaEntregaManual');

  if (inputFechaRadicacion) inputFechaRadicacion.value = hoy;
  if (inputFechaEntregaManual) inputFechaEntregaManual.value = hoy;

  inicializarSelectorDependenciasPqrs();
  calcularFechaVencimiento();
  document.getElementById('fechaRadicacion')?.addEventListener('input', calcularFechaVencimiento);
  document.getElementById('diasHabiles')?.addEventListener('input', calcularFechaVencimiento);
  document.getElementById('editFechaRadicacion')?.addEventListener('input', calcularFechaVencimientoEdicion);
  document.getElementById('editDiasHabiles')?.addEventListener('input', calcularFechaVencimientoEdicion);
  document.getElementById('pqrsForm')?.addEventListener('submit', guardarRadicado);
}
