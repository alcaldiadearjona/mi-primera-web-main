import {
  collection,
  doc,
  getDocs,
  runTransaction,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, GOOGLE_SCRIPT_URL } from '../../config/firebase-config.js';
import { asegurarBordesCeldaExcel } from '../../utils/excel.js';
import { convertirABase64 } from '../../utils/helpers.js';
import { completarClaveIdempotencia, obtenerClaveIdempotencia } from '../../utils/idempotencia.js';
import { confirmarAccion, mostrarAviso } from '../ui/avisos.js';

const MAX_ARCHIVOS = 10;
const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024;
const MAX_RADICADOS_POR_LOTE = 400;
const COLECCION_SALIDA = 'radicadosSalida';
const COLECCION_SECUENCIAS_SALIDA = 'radicadosSalidaSecuencias';
const STORAGE_SOLICITUDES_PENDIENTES = 'radicadosSalida:solicitudesPendientes';
const RUTA_PLANTILLA_SALIDA = new URL(
  '../../../assets/plantillas/Registro de Radicación de Comunicaciones Oficiales Salientes.xlsx',
  import.meta.url
);
const URL_EXCELJS_SALIDA = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const TIPOS_ARCHIVO_COMPATIBLES = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'
]);

let radicadosSalida = [];
let mesAbierto = '';
let filtroGeneracion = '';
let solicitudGeneracionEnCurso = false;
let cargaExcelJsSalida;
const solicitudesGeneracionCompletadas = new Set();

window.toggleFormularioGeneracion = function() {
  const formulario = document.getElementById('contenedorFormularioGeneracion');
  const boton = document.getElementById('toggleFormularioGeneracion');
  if (!formulario || !boton) return;

  const visible = formulario.style.display === 'none';
  formulario.style.display = visible ? 'block' : 'none';
  boton.setAttribute('aria-expanded', String(visible));
  boton.classList.toggle('is-collapsed', !visible);
};

function formatearTamano(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function obtenerMes(fecha) {
  const coincidencia = typeof fecha === 'string' ? fecha.match(/^(\d{4})-(\d{2})/) : null;
  return coincidencia ? `${coincidencia[1]}-${coincidencia[2]}` : '';
}

function obtenerFechaBogota(fecha) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota'
  }).format(fecha);
}

function obtenerHoraBogota(fecha) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(fecha);
}

function obtenerFechaRegistro(registro) {
  return registro.fechaGeneracion || (registro.creadoEn ? obtenerFechaBogota(new Date(registro.creadoEn)) : '');
}

function obtenerHoraRegistro(registro) {
  return registro.horaGeneracion || (registro.creadoEn ? obtenerHoraBogota(new Date(registro.creadoEn)) : '');
}

function formatearConteoAnexos(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const cantidad = Number(valor);
  return Number.isInteger(cantidad) && cantidad >= 0 ? cantidad : '';
}

function formatearMayusculasIniciales(valor) {
  return String(valor || '')
    .toLocaleLowerCase('es-CO')
    .replace(/(^|[\s-])(\p{L})/gu, (coincidencia, separador, letra) => (
      `${separador}${letra.toLocaleUpperCase('es-CO')}`
    ));
}

function obtenerEtiquetaMes(mesKey) {
  const [ano, mes] = mesKey.split('-').map(Number);
  const nombreMes = new Intl.DateTimeFormat('es-CO', { month: 'long' })
    .format(new Date(ano, mes - 1, 1));
  return `${nombreMes.charAt(0).toLocaleUpperCase('es-CO')}${nombreMes.slice(1)} ${ano}`;
}

function validarArchivos(archivos, limite = MAX_ARCHIVOS) {
  if (archivos.length > limite) {
    return `Puedes seleccionar máximo ${limite} archivos.`;
  }

  const incompatibles = archivos.filter(archivo => {
    const extension = archivo.name.split('.').pop()?.toLowerCase();
    return !extension || !TIPOS_ARCHIVO_COMPATIBLES.has(extension);
  });
  if (incompatibles.length > 0) {
    return `Tipo de archivo no compatible: ${incompatibles.map(archivo => archivo.name).join(', ')}.`;
  }

  const excedidos = archivos.filter(archivo => archivo.size > MAX_TAMANO_ARCHIVO);
  if (excedidos.length > 0) {
    return `Cada archivo debe pesar máximo 10 MB: ${excedidos.map(archivo => archivo.name).join(', ')}.`;
  }

  return '';
}

function actualizarListaArchivos(input, ayuda, lista, limite = MAX_ARCHIVOS) {
  const archivos = Array.from(input.files || []);
  const error = validarArchivos(archivos, limite);

  if (error) {
    input.value = '';
    lista?.replaceChildren();
    if (ayuda) {
      ayuda.textContent = error;
      ayuda.classList.add('generation-file-error');
    }
    return false;
  }

  if (ayuda) {
    ayuda.textContent = `Sube hasta ${limite} archivos compatibles. Tamaño máximo por archivo: 10 MB.`;
    ayuda.classList.remove('generation-file-error');
  }
  if (lista) {
    lista.replaceChildren(...archivos.map(archivo => {
      const elemento = document.createElement('li');
      const nombre = document.createElement('span');
      const tamano = document.createElement('span');
      nombre.textContent = archivo.name;
      tamano.textContent = formatearTamano(archivo.size);
      elemento.append(nombre, tamano);
      return elemento;
    }));
  }
  return true;
}

function enlazarDependenciaOtra(selector, grupo, input) {
  const actualizar = () => {
    const requiereOtra = selector.value === 'Otro';
    grupo.hidden = !requiereOtra;
    input.required = requiereOtra;
    if (!requiereOtra) input.value = '';
  };

  selector.addEventListener('change', actualizar);
  actualizar();
}

function actualizarModoGeneracion() {
  const modoSeleccionado = document.querySelector('input[name="modoRadicado"]:checked')?.value || 'individual';
  const esGeneracionMasiva = modoSeleccionado === 'masivo';
  const grupoCantidadMasiva = document.getElementById('grupoCantidadMasiva');
  const cantidadMasivaInput = document.getElementById('cantidadRadicadosSalida');
  const grupoDatos = document.getElementById('grupoDatosRadicadoSalida');
  const inputArchivos = document.getElementById('archivosSalida');
  const grupoArchivos = document.getElementById('grupoArchivosSalida');
  const avisoAdjuntosMasivos = document.getElementById('avisoAdjuntosMasivos');

  if (grupoCantidadMasiva) grupoCantidadMasiva.hidden = modoSeleccionado === 'individual';
  if (cantidadMasivaInput) {
    cantidadMasivaInput.disabled = modoSeleccionado === 'individual';
    cantidadMasivaInput.required = modoSeleccionado !== 'individual';
    cantidadMasivaInput.placeholder = esGeneracionMasiva
      ? 'Indica cuántos consecutivos incluye el rango'
      : 'Indica cuántos radicados generar';
  }
  if (grupoDatos) {
    grupoDatos.hidden = false;
    grupoDatos.querySelectorAll('input, select, textarea').forEach(control => {
      control.disabled = false;
    });
  }
  if (inputArchivos) inputArchivos.disabled = esGeneracionMasiva;
  if (grupoArchivos) {
    const selectorArchivo = grupoArchivos.querySelector('label[for="archivosSalida"]');
    const selectorVisual = grupoArchivos.querySelector('.generation-file-picker');
    const listaVisual = grupoArchivos.querySelector('#listaArchivosSalida');
    if (selectorArchivo) selectorArchivo.hidden = esGeneracionMasiva;
    if (selectorVisual) selectorVisual.hidden = esGeneracionMasiva;
    if (listaVisual) listaVisual.hidden = esGeneracionMasiva;
  }
  if (avisoAdjuntosMasivos) {
    avisoAdjuntosMasivos.hidden = !esGeneracionMasiva;
    avisoAdjuntosMasivos.textContent = esGeneracionMasiva
      ? 'Se guardarán solo dos filas con la misma información: el primer y el último consecutivo del rango. Los números intermedios quedarán incluidos en la secuencia, sin crear filas individuales. No se permiten archivos adjuntos.'
      : '';
  }
  const etiquetaBoton = document.querySelector('#textoGenerarSalida strong');
  if (etiquetaBoton && !solicitudGeneracionEnCurso) {
    etiquetaBoton.textContent = esGeneracionMasiva ? 'Generar Radicados Masivos' : 'Generar Radicado';
  }
}

function mostrarResultadoGeneracion(tipo, titulo, mensaje, radicado = '', opciones = {}) {
  const mensajeCompleto = radicado ? `${mensaje}\n${radicado}` : mensaje;
  void mostrarAviso(mensajeCompleto, { tipo, titulo, ...opciones });
}

export function inicializarFormularioGeneracionSalida() {
  const formulario = document.getElementById('formGeneracionSalida');
  const selectorDependencia = document.getElementById('dependenciaSalida');
  const grupoOtraDependencia = document.getElementById('dependenciaOtraGroup');
  const inputOtraDependencia = document.getElementById('dependenciaOtra');
  const inputArchivos = document.getElementById('archivosSalida');
  const ayudaArchivos = document.getElementById('archivosSalidaAyuda');
  const listaArchivos = document.getElementById('listaArchivosSalida');
  const inputArchivosEditar = document.getElementById('archivosEditarSalida');
  const ayudaArchivosEditar = document.getElementById('archivosEditarSalidaAyuda');
  const listaArchivosEditar = document.getElementById('listaArchivosEditarSalida');
  formulario?.querySelectorAll('input[name="modoRadicado"]').forEach(opcion => {
    opcion.addEventListener('change', actualizarModoGeneracion);
  });
  actualizarModoGeneracion();

  if (selectorDependencia && grupoOtraDependencia && inputOtraDependencia) {
    enlazarDependenciaOtra(selectorDependencia, grupoOtraDependencia, inputOtraDependencia);
  }

  const selectorEditar = document.getElementById('dependenciaEditarSalida');
  const grupoOtraEditar = document.getElementById('dependenciaOtraEditarGroup');
  const inputOtraEditar = document.getElementById('dependenciaOtraEditar');
  if (selectorEditar && grupoOtraEditar && inputOtraEditar) {
    enlazarDependenciaOtra(selectorEditar, grupoOtraEditar, inputOtraEditar);
  }

  inputArchivos?.addEventListener('change', () => {
    actualizarListaArchivos(inputArchivos, ayudaArchivos, listaArchivos);
  });

  inputArchivosEditar?.addEventListener('change', () => {
    const existentes = Number(inputArchivosEditar.dataset.existingCount || 0);
    const limite = Math.max(0, MAX_ARCHIVOS - existentes);
    actualizarListaArchivos(inputArchivosEditar, ayudaArchivosEditar, listaArchivosEditar, limite);
  });

  formulario?.addEventListener('submit', guardarRadicadoSalida);
  document.getElementById('formEditarSalida')?.addEventListener('submit', guardarEdicionRadicadoSalida);
  document.getElementById('volverCarpetasGeneracion')?.addEventListener('click', cerrarCarpetaGeneracion);
  document.getElementById('cancelarEditarSalida')?.addEventListener('click', cerrarModalEdicionSalida);
  document.getElementById('modalEditarSalida')?.addEventListener('click', event => {
    if (event.target.id === 'modalEditarSalida') cerrarModalEdicionSalida();
  });
  document.getElementById('buscarRadicadosGeneracion')?.addEventListener('input', event => {
    filtroGeneracion = event.currentTarget.value.toLocaleLowerCase('es-CO').trim();
    if (mesAbierto) renderizarDetalleCarpeta(mesAbierto);
  });
  document.getElementById('filtrarRadicadosGeneracion')?.addEventListener('click', () => {
    const buscador = document.getElementById('buscarRadicadosGeneracion');
    filtroGeneracion = buscador.value.toLocaleLowerCase('es-CO').trim();
    if (mesAbierto) renderizarDetalleCarpeta(mesAbierto);
  });

  inicializarExportacionGeneracion();
  cargarRadicadosSalida();
}

function cargarExcelJsSalida() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (cargaExcelJsSalida) return cargaExcelJsSalida;

  cargaExcelJsSalida = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = URL_EXCELJS_SALIDA;
    script.async = true;
    script.onload = () => {
      if (window.ExcelJS) {
        resolve(window.ExcelJS);
      } else {
        reject(new Error('La biblioteca de Excel no quedó disponible.'));
      }
    };
    script.onerror = () => reject(new Error('No fue posible cargar la biblioteca para generar el Excel.'));
    document.head.appendChild(script);
  }).catch(error => {
    cargaExcelJsSalida = null;
    throw error;
  });

  return cargaExcelJsSalida;
}

function obtenerConsecutivoRadicado(registro) {
  const coincidencia = String(registro.radicado || '').match(/(\d+)$/);
  return coincidencia ? Number(coincidencia[1]) : Number(registro.numeroSecuencia) || 0;
}

function ordenarRadicadosParaPlanilla(registros) {
  return [...registros].sort((a, b) => {
    const diferenciaAnio = Number(a.anio || obtenerFechaRegistro(a).slice(0, 4))
      - Number(b.anio || obtenerFechaRegistro(b).slice(0, 4));
    if (diferenciaAnio) return diferenciaAnio;
    const diferenciaNumero = obtenerConsecutivoRadicado(a) - obtenerConsecutivoRadicado(b);
    if (diferenciaNumero) return diferenciaNumero;
    return `${obtenerFechaRegistro(a)} ${obtenerHoraRegistro(a)}`
      .localeCompare(`${obtenerFechaRegistro(b)} ${obtenerHoraRegistro(b)}`);
  });
}

async function descargarPlanillaGeneracion(registros) {
  const [ExcelJS, respuestaPlantilla] = await Promise.all([
    cargarExcelJsSalida(),
    fetch(RUTA_PLANTILLA_SALIDA)
  ]);
  if (!respuestaPlantilla.ok) {
    throw new Error(`No fue posible abrir la plantilla (${respuestaPlantilla.status}).`);
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await respuestaPlantilla.arrayBuffer());
  const hoja = libro.getWorksheet('F03') || libro.worksheets[0];
  if (!hoja) throw new Error('La plantilla no contiene una hoja de cálculo.');
  const filaModelo = hoja.getRow(8);

  registros.forEach((registro, indice) => {
    const filaNumero = indice + 8;
    const fila = hoja.getRow(filaNumero);
    if (filaNumero > 247) fila.height = filaModelo.height;
    for (let columna = 1; columna <= 9; columna += 1) {
      const celda = fila.getCell(columna);
      celda.style = { ...filaModelo.getCell(columna).style };
      asegurarBordesCeldaExcel(celda);
      celda.value = null;
    }

    fila.getCell('A').value = registro.radicado || '';
    const fechaGeneracion = obtenerFechaRegistro(registro);
    fila.getCell('B').value = fechaGeneracion
      ? new Date(`${fechaGeneracion}T00:00:00.000Z`)
      : '';
    fila.getCell('C').value = obtenerHoraRegistro(registro);
    fila.getCell('D').value = formatearMayusculasIniciales(registro.destinatario);
    fila.getCell('E').value = formatearMayusculasIniciales(registro.asunto);
    const celdaFolios = fila.getCell('F');
    celdaFolios.value = registro.folios ?? '';
    celdaFolios.alignment = {
      ...celdaFolios.alignment,
      horizontal: 'center',
      vertical: 'middle'
    };
    const celdaAnexos = fila.getCell('G');
    celdaAnexos.value = formatearConteoAnexos(registro.anexos);
    celdaAnexos.numFmt = '0';
    celdaAnexos.alignment = {
      ...celdaAnexos.alignment,
      horizontal: 'center',
      vertical: 'middle'
    };
    fila.getCell('H').value = formatearMayusculasIniciales(
      registro.dependencia === 'Otro'
        ? registro.dependenciaOtra || 'Otro'
        : registro.dependencia
    );
    const celdaDependencia = fila.getCell('H');
    celdaDependencia.alignment = {
      ...celdaDependencia.alignment,
      vertical: 'middle',
      wrapText: true,
      shrinkToFit: false
    };
    const anchoDependencia = Math.max(1, Math.floor(hoja.getColumn(8).width || 30));
    const palabrasDependencia = String(celdaDependencia.value || '').split(/\s+/).filter(Boolean);
    let lineasDependencia = 1;
    let caracteresEnLinea = 0;
    palabrasDependencia.forEach(palabra => {
      if (caracteresEnLinea && caracteresEnLinea + palabra.length + 1 > anchoDependencia) {
        lineasDependencia += 1;
        caracteresEnLinea = 0;
      }
      if (palabra.length > anchoDependencia) {
        lineasDependencia += Math.ceil(palabra.length / anchoDependencia) - 1;
        caracteresEnLinea = palabra.length % anchoDependencia || anchoDependencia;
      } else {
        caracteresEnLinea += (caracteresEnLinea ? 1 : 0) + palabra.length;
      }
    });
    fila.height = Math.max(fila.height || filaModelo.height || 44.25, lineasDependencia * 15 + 8);

    if (registro.estado === 'ANULADO') {
      for (let columna = 1; columna <= 8; columna += 1) {
        const celda = fila.getCell(columna);
        celda.font = {
          ...celda.font,
          color: { argb: 'FFFF0000' }
        };
      }
    }
  });

  const contenido = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([contenido], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `Registro_de_Radicacion_de_Comunicaciones_Oficiales_Salientes_(${obtenerFechaBogota(new Date())}).xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function inicializarExportacionGeneracion() {
  const modal = document.getElementById('modalExportarGeneracion');
  const formulario = document.getElementById('formExportarGeneracion');
  const botonAbrir = document.getElementById('abrirExportarGeneracion');
  const botonCerrar = document.getElementById('cerrarModalExportarGeneracion');
  const botonCancelar = document.getElementById('cancelarExportarGeneracion');
  const botonDescargar = document.getElementById('confirmarExportarGeneracion');
  const tipoPeriodo = document.getElementById('tipoPeriodoExportarGeneracion');
  const grupoFecha = document.getElementById('grupoFechaExportarGeneracion');
  const grupoMes = document.getElementById('grupoMesExportarGeneracion');
  const grupoAno = document.getElementById('grupoAnoExportarGeneracion');
  const fechaInput = document.getElementById('fechaExportarGeneracion');
  const mesInput = document.getElementById('mesExportarGeneracion');
  const anoInput = document.getElementById('anoExportarGeneracion');
  const error = document.getElementById('errorExportarGeneracion');
  if (!modal || !formulario || !botonAbrir || !tipoPeriodo || !fechaInput || !mesInput || !anoInput || !error) return;

  const actualizarPeriodo = () => {
    const esFecha = tipoPeriodo.value === 'fecha';
    const esMes = tipoPeriodo.value === 'mes';
    grupoFecha.hidden = !esFecha;
    fechaInput.disabled = !esFecha;
    fechaInput.required = esFecha;
    grupoMes.hidden = !esMes;
    mesInput.disabled = !esMes;
    mesInput.required = esMes;
    grupoAno.hidden = tipoPeriodo.value !== 'ano';
    anoInput.disabled = tipoPeriodo.value !== 'ano';
    anoInput.required = tipoPeriodo.value === 'ano';
  };
  tipoPeriodo.addEventListener('change', actualizarPeriodo);

  botonAbrir.addEventListener('click', () => {
    formulario.reset();
    tipoPeriodo.value = 'fecha';
    fechaInput.value = obtenerFechaBogota(new Date());
    mesInput.value = obtenerFechaBogota(new Date()).slice(0, 7);
    actualizarPeriodo();
    error.hidden = true;
    modal.showModal();
    fechaInput.focus();
  });
  const cerrar = () => modal.close();
  botonCerrar?.addEventListener('click', cerrar);
  botonCancelar?.addEventListener('click', cerrar);

  formulario.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    if (!formulario.reportValidity()) return;

    const seleccion = tipoPeriodo.value === 'fecha'
      ? fechaInput.value
      : tipoPeriodo.value === 'mes'
        ? mesInput.value
        : anoInput.value.trim();
    const registros = ordenarRadicadosParaPlanilla(radicadosSalida.filter(registro => {
      const fecha = obtenerFechaRegistro(registro);
      return tipoPeriodo.value === 'fecha'
        ? fecha === seleccion
        : fecha.startsWith(seleccion);
    }));

    if (registros.length === 0) {
      error.textContent = 'No se encontraron radicados para el periodo seleccionado.';
      error.hidden = false;
      return;
    }

    botonDescargar.disabled = true;
    botonDescargar.setAttribute('aria-busy', 'true');
    botonDescargar.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Preparando Excel…';
    try {
      await descargarPlanillaGeneracion(registros);
      cerrar();
    } catch (errorDescarga) {
      console.error('Error al generar la planilla de radicados salientes:', errorDescarga);
      error.textContent = errorDescarga.message || 'No fue posible generar la planilla.';
      error.hidden = false;
    } finally {
      botonDescargar.disabled = false;
      botonDescargar.removeAttribute('aria-busy');
      botonDescargar.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i> Descargar Excel';
    }
  });
}

async function subirArchivosSalida(archivos) {
  const subidos = [];
  let indice = 0;
  try {
    for (const archivo of archivos) {
      const base64 = await convertirABase64(archivo);
      const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          archivoBase64: base64.split(',')[1] || '',
          nombreArchivo: `RadicadoSalida_${Date.now()}_${indice++}_${archivo.name}`
        })
      });

      if (!respuesta.ok) {
        throw new Error(`Error HTTP ${respuesta.status} al subir "${archivo.name}".`);
      }
      const resultado = await respuesta.json();
      if (resultado.status !== 'success' || !resultado.url) {
        throw new Error(`No se pudo subir "${archivo.name}" a Google Drive: ${resultado.message || 'respuesta no válida'}`);
      }
      subidos.push({ nombre: archivo.name, url: resultado.url });
    }
    return subidos;
  } catch (error) {
    if (subidos.length > 0) {
      const erroresLimpieza = await eliminarArchivosDrive(subidos);
      if (erroresLimpieza.length > 0) {
        console.error('No fue posible limpiar todos los archivos subidos:', erroresLimpieza);
      }
    }
    throw error;
  }
}

async function eliminarArchivosDrive(archivos) {
  const errores = [];
  for (const archivo of archivos) {
    try {
      const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', pdfUrl: archivo.url })
      });
      if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}.`);
      const resultado = await respuesta.json();
      if (resultado.status !== 'success') {
        throw new Error(resultado.message || 'Google Drive no confirmó la eliminación.');
      }
    } catch (error) {
      errores.push(`${archivo.nombre}: ${error.message}`);
    }
  }
  return errores;
}

async function calcularHuellaSolicitud(datos, archivos) {
  const archivosConHuella = [];
  for (const archivo of archivos) {
    const resumenArchivo = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
    const huellaArchivo = Array.from(
      new Uint8Array(resumenArchivo),
      byte => byte.toString(16).padStart(2, '0')
    ).join('');
    archivosConHuella.push({
      nombre: archivo.name,
      tamano: archivo.size,
      tipo: archivo.type,
      contenido: huellaArchivo
    });
  }
  const contenido = JSON.stringify({
    datos,
    archivos: archivosConHuella
  });
  const bytes = new TextEncoder().encode(contenido);
  const resumen = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(resumen), byte => byte.toString(16).padStart(2, '0')).join('');
}

function obtenerClaveSolicitud(huella) {
  if (solicitudesGeneracionCompletadas.has(huella)) return crypto.randomUUID();
  return obtenerClaveIdempotencia(
    huella,
    sessionStorage,
    STORAGE_SOLICITUDES_PENDIENTES,
    () => crypto.randomUUID()
  );
}

function marcarSolicitudCompletada(huella, clave) {
  solicitudesGeneracionCompletadas.add(huella);
  completarClaveIdempotencia(
    huella,
    clave,
    sessionStorage,
    STORAGE_SOLICITUDES_PENDIENTES
  );
}

async function asignarNumeroYGuardar(datos, claveIdempotencia) {
  const ahora = new Date();
  const fechaGeneracion = obtenerFechaBogota(ahora);
  const horaGeneracion = obtenerHoraBogota(ahora);
  const anio = Number(fechaGeneracion.slice(0, 4));
  const secuenciaRef = doc(db, COLECCION_SECUENCIAS_SALIDA, String(anio));
  const radicadoRef = doc(db, COLECCION_SALIDA, claveIdempotencia);

  return runTransaction(db, async transaccion => {
    const radicadoExistente = await transaccion.get(radicadoRef);
    if (radicadoExistente.exists()) {
      const datosExistentes = radicadoExistente.data();
      if (datosExistentes.claveIdempotencia !== claveIdempotencia) {
        throw new Error('La clave de seguridad del envío ya está asociada a otro registro.');
      }
      return {
        id: radicadoRef.id,
        ...datosExistentes,
        esReintento: true
      };
    }

    const secuenciaActual = await transaccion.get(secuenciaRef);
    const ultimoNumero = secuenciaActual.exists() ? Number(secuenciaActual.data().ultimo) : 0;
    if (!Number.isSafeInteger(ultimoNumero) || ultimoNumero < 0
      || !Number.isSafeInteger(ultimoNumero + 1)) {
      throw new Error(`La secuencia de radicados de ${anio} no es válida.`);
    }
    const numero = ultimoNumero + 1;
    const radicado = `R-${anio}-${String(numero).padStart(5, '0')}`;
    const registro = {
      ...datos,
      claveIdempotencia,
      radicado,
      numeroSecuencia: numero,
      anio,
      mes: obtenerMes(fechaGeneracion),
      fechaGeneracion,
      horaGeneracion,
      creadoEn: ahora.toISOString(),
      actualizadoEn: ahora.toISOString()
    };
    transaccion.set(secuenciaRef, { anio, ultimo: numero }, { merge: true });
    transaccion.set(radicadoRef, registro);
    return { id: radicadoRef.id, ...registro, esReintento: false };
  });
}

async function asignarRadicadosMasivosYGuardar(datos, claveIdempotencia, cantidad) {
  const ahora = new Date();
  const fechaGeneracion = obtenerFechaBogota(ahora);
  const horaGeneracion = obtenerHoraBogota(ahora);
  const anio = Number(fechaGeneracion.slice(0, 4));
  const secuenciaRef = doc(db, COLECCION_SECUENCIAS_SALIDA, String(anio));
  const inicioRef = doc(db, COLECCION_SALIDA, `${claveIdempotencia}-inicio`);
  const finRef = doc(db, COLECCION_SALIDA, `${claveIdempotencia}-fin`);

  return runTransaction(db, async transaccion => {
    const [secuenciaSnapshot, inicioSnapshot, finSnapshot] = await Promise.all([
      transaccion.get(secuenciaRef),
      transaccion.get(inicioRef),
      transaccion.get(finRef)
    ]);

    if (inicioSnapshot.exists() || finSnapshot.exists()) {
      const registroInicioExistente = inicioSnapshot.data();
      const registroFinExistente = finSnapshot.data();
      const loteCompleto = inicioSnapshot.exists()
        && finSnapshot.exists()
        && registroInicioExistente.claveIdempotencia === claveIdempotencia
        && registroFinExistente.claveIdempotencia === claveIdempotencia
        && registroInicioExistente.tipoLoteRadicados === 'extremos'
        && registroFinExistente.tipoLoteRadicados === 'extremos'
        && registroInicioExistente.extremoLote === 'inicio'
        && registroFinExistente.extremoLote === 'fin'
        && registroInicioExistente.cantidadLote === cantidad
        && registroFinExistente.cantidadLote === cantidad
        && registroInicioExistente.anio === registroFinExistente.anio
        && Number.isSafeInteger(registroInicioExistente.numeroSecuencia)
        && registroFinExistente.numeroSecuencia === registroInicioExistente.numeroSecuencia + cantidad - 1
        && registroInicioExistente.radicado === `R-${registroInicioExistente.anio}-${String(registroInicioExistente.numeroSecuencia).padStart(5, '0')}`
        && registroFinExistente.radicado === `R-${registroFinExistente.anio}-${String(registroFinExistente.numeroSecuencia).padStart(5, '0')}`;
      if (!loteCompleto) {
        throw new Error('El lote masivo ya existe de forma incompleta o con datos diferentes. Verifica los radicados antes de reintentar.');
      }
      return [
        { id: inicioSnapshot.id, ...inicioSnapshot.data(), esReintento: true },
        { id: finSnapshot.id, ...finSnapshot.data(), esReintento: true }
      ];
    }

    const ultimoNumero = secuenciaSnapshot.exists()
      ? Number(secuenciaSnapshot.data().ultimo)
      : 0;
    const numeroFinal = ultimoNumero + cantidad;
    if (!Number.isSafeInteger(ultimoNumero) || ultimoNumero < 0
      || !Number.isSafeInteger(numeroFinal + 1)) {
      throw new Error(`La secuencia de radicados de ${anio} no es válida para generar ${cantidad} consecutivos.`);
    }

    const numeroInicial = ultimoNumero + 1;
    const crearRegistroExtremo = (numero, extremo) => ({
      ...datos,
      archivos: [],
      claveIdempotencia,
      cantidadLote: cantidad,
      tipoLoteRadicados: 'extremos',
      extremoLote: extremo,
      radicado: `R-${anio}-${String(numero).padStart(5, '0')}`,
      numeroSecuencia: numero,
      anio,
      mes: obtenerMes(fechaGeneracion),
      fechaGeneracion,
      horaGeneracion,
      creadoEn: ahora.toISOString(),
      actualizadoEn: ahora.toISOString()
    });
    const registroInicio = crearRegistroExtremo(numeroInicial, 'inicio');
    const registroFin = crearRegistroExtremo(numeroFinal, 'fin');

    transaccion.set(secuenciaRef, { anio, ultimo: numeroFinal }, { merge: true });
    transaccion.set(inicioRef, registroInicio);
    transaccion.set(finRef, registroFin);
    return [
      { id: inicioRef.id, ...registroInicio, esReintento: false },
      { id: finRef.id, ...registroFin, esReintento: false }
    ];
  });
}

function establecerEstadoBoton(boton, spinner, texto, cargando, textoCargando, textoNormal) {
  boton.disabled = cargando;
  spinner.style.display = cargando ? 'inline-block' : 'none';
  const etiqueta = texto.querySelector('strong') || texto;
  etiqueta.textContent = cargando ? textoCargando : textoNormal;
}

function limpiarFormularioGeneracion(formulario) {
  formulario.reset();
  actualizarModoGeneracion();
  document.getElementById('dependenciaOtraGroup').hidden = true;
  document.getElementById('dependenciaOtra').required = false;
  document.getElementById('listaArchivosSalida').replaceChildren();
  document.getElementById('archivosSalidaAyuda').textContent =
    'Sube hasta 10 archivos compatibles. Tamaño máximo por archivo: 10 MB.';
  document.getElementById('archivosSalidaAyuda').classList.remove('generation-file-error');
}

async function guardarRadicadoSalida(event) {
  event.preventDefault();
  if (solicitudGeneracionEnCurso) return;
  const formulario = event.currentTarget;
  const modoSeleccionado = formulario.querySelector('input[name="modoRadicado"]:checked')?.value || 'individual';
  const esGeneracionMasiva = modoSeleccionado === 'masivo';
  const requiereCantidad = esGeneracionMasiva;
  const cantidadRadicados = requiereCantidad
    ? Number(document.getElementById('cantidadRadicadosSalida').value)
    : 1;
  if (requiereCantidad
    && (!Number.isInteger(cantidadRadicados)
      || cantidadRadicados < 2
      || cantidadRadicados > MAX_RADICADOS_POR_LOTE)) {
    mostrarResultadoGeneracion(
      'warning',
      'Cantidad no válida',
      `Indica una cantidad entera entre 2 y ${MAX_RADICADOS_POR_LOTE} radicados.`
    );
    return;
  }
  if (!navigator.onLine) {
    mostrarResultadoGeneracion(
      'warning',
      'Sin conexión',
      'Conéctate a internet antes de generar el radicado. El formulario conserva los datos ingresados.'
    );
    return;
  }

  const inputArchivos = document.getElementById('archivosSalida');
  const archivos = esGeneracionMasiva ? [] : Array.from(inputArchivos.files || []);
  const errorArchivos = validarArchivos(archivos);
  if (errorArchivos) {
    mostrarResultadoGeneracion('error', 'Revisa los archivos', errorArchivos);
    return;
  }

  const boton = document.querySelector('#formGeneracionSalida .generation-submit');
  const spinner = document.getElementById('spinnerGenerarSalida');
  const texto = document.getElementById('textoGenerarSalida');
  const archivosSubidos = [];
  let registroGuardado = null;
  let registrosGuardados = [];
  let claveIdempotencia = '';
  let huellaSolicitud = '';
  let intentoGuardarFirestore = false;
  let errorAlCerrarProteccion = null;
  const nombreAccion = esGeneracionMasiva
    ? `Generando lote de ${cantidadRadicados} radicados...`
    : 'Generando...';
  solicitudGeneracionEnCurso = true;
  const estadoControles = Array.from(formulario.elements, control => ({
    control,
    deshabilitado: control.disabled
  }));
  estadoControles.forEach(({ control }) => {
    control.disabled = true;
  });
  establecerEstadoBoton(
    boton,
    spinner,
    texto,
    true,
    nombreAccion,
    esGeneracionMasiva ? 'Generar Radicados Masivos' : 'Generar Radicado'
  );

  try {
    const dependenciaSeleccionada = document.getElementById('dependenciaSalida').value;
    const datos = {
      destinatario: formatearMayusculasIniciales(document.getElementById('destinatarioSalida').value.trim()),
      asunto: formatearMayusculasIniciales(document.getElementById('asuntoSalida').value.trim()),
      folios: Number(document.getElementById('foliosSalida').value),
      anexos: Number(document.getElementById('anexosSalida').value),
      dependencia: dependenciaSeleccionada === 'Otro'
        ? dependenciaSeleccionada
        : formatearMayusculasIniciales(dependenciaSeleccionada),
      dependenciaOtra: dependenciaSeleccionada === 'Otro'
        ? formatearMayusculasIniciales(document.getElementById('dependenciaOtra').value.trim())
        : ''
    };
    const datosParaHuella = esGeneracionMasiva
      ? { tipo: 'generacion-masiva-extremos', cantidadRadicados, ...datos }
      : datos;
    huellaSolicitud = await calcularHuellaSolicitud(datosParaHuella, archivos);
    claveIdempotencia = obtenerClaveSolicitud(huellaSolicitud);

    const adjuntos = esGeneracionMasiva ? [] : await subirArchivosSalida(archivos);
    archivosSubidos.push(...adjuntos);
    intentoGuardarFirestore = true;
    if (esGeneracionMasiva) {
      registrosGuardados = await asignarRadicadosMasivosYGuardar(
        datos,
        claveIdempotencia,
        cantidadRadicados
      );
      registroGuardado = registrosGuardados[0];
    } else {
      registroGuardado = await asignarNumeroYGuardar({
        ...datos,
        archivos: adjuntos
      }, claveIdempotencia);
      registrosGuardados = [registroGuardado];
    }

    try {
      marcarSolicitudCompletada(huellaSolicitud, claveIdempotencia);
    } catch (error) {
      errorAlCerrarProteccion = error;
      console.error('El radicado se guardó, pero no se pudo cerrar el estado local de idempotencia:', error);
    }

    if (registroGuardado.esReintento && adjuntos.length > 0) {
      const erroresLimpieza = await eliminarArchivosDrive(adjuntos);
      if (erroresLimpieza.length > 0) {
        console.error('No fue posible limpiar todos los archivos duplicados del reintento:', erroresLimpieza);
      }
    }

    const idsGuardados = new Set(registrosGuardados.map(registro => registro.id));
    radicadosSalida = [
      ...registrosGuardados,
      ...radicadosSalida.filter(registro => !idsGuardados.has(registro.id))
    ];
    renderizarCarpetasMes(radicadosSalida);
    renderizarRecientesSalida(radicadosSalida);
    if (mesAbierto) renderizarDetalleCarpeta(mesAbierto);

    limpiarFormularioGeneracion(formulario);
    const recargaExitosa = await cargarRadicadosSalida();
    if (!recargaExitosa) {
      renderizarCarpetasMes(radicadosSalida);
      renderizarRecientesSalida(radicadosSalida);
      if (mesAbierto) renderizarDetalleCarpeta(mesAbierto);
      mostrarResultadoGeneracion(
        'warning',
        esGeneracionMasiva ? 'Lote masivo guardado' : 'Radicado guardado',
        esGeneracionMasiva
          ? `Se guardó el lote masivo desde ${registrosGuardados[0].radicado} hasta ${registrosGuardados[1].radicado}, pero no fue posible actualizar la lista desde Firestore. Recarga la página o revisa los permisos de lectura.`
          : 'Se guardó correctamente, pero no fue posible actualizar la lista desde Firestore. Recarga la página o revisa los permisos de lectura.',
        esGeneracionMasiva ? '' : registroGuardado.radicado
      );
      return;
    }
    const primerRadicadoLote = esGeneracionMasiva ? registrosGuardados[0].radicado : '';
    const ultimoRadicadoLote = esGeneracionMasiva ? registrosGuardados[1].radicado : '';
    const siguienteNumeroLote = esGeneracionMasiva
      ? `R-${registrosGuardados[1].anio}-${String(registrosGuardados[1].numeroSecuencia + 1).padStart(5, '0')}`
      : '';
    mostrarResultadoGeneracion(
      errorAlCerrarProteccion ? 'warning' : 'success',
      esGeneracionMasiva
        ? errorAlCerrarProteccion ? 'Lote masivo guardado' : '¡Lote masivo generado!'
        : errorAlCerrarProteccion ? 'Radicado guardado' : '¡Radicado generado!',
      esGeneracionMasiva
        ? `${registrosGuardados.every(registro => registro.esReintento) ? 'Se recuperó el lote solicitado' : 'Se generaron sus radicados masivos'}. En la tabla quedan dos filas, desde ${primerRadicadoLote} hasta ${ultimoRadicadoLote}, con la misma información (${cantidadRadicados} consecutivos en total). El siguiente número disponible será ${siguienteNumeroLote}.${errorAlCerrarProteccion ? ' Verifica la tabla antes de volver a enviar.' : ''}`
        : errorAlCerrarProteccion
          ? 'El radicado se guardó, pero no se pudo actualizar la protección local contra envíos repetidos. Verifica la lista antes de volver a enviar.'
          : registroGuardado.esReintento
            ? 'Se recuperó el radicado creado por el envío anterior. No se generó un número nuevo.'
            : 'La comunicación se guardó correctamente y ya está organizada en la carpeta del mes correspondiente.',
      esGeneracionMasiva ? '' : registroGuardado.radicado,
      errorAlCerrarProteccion || esGeneracionMasiva ? {} : { radicadoSalida: registroGuardado.radicado }
    );
  } catch (error) {
    console.error('Error al generar el radicado de salida:', error);
    if (registroGuardado) {
      mostrarResultadoGeneracion(
        'warning',
        esGeneracionMasiva ? 'Lote masivo guardado' : 'Radicado guardado',
        esGeneracionMasiva
          ? `El lote se guardó desde ${registrosGuardados[0].radicado} hasta ${registrosGuardados[1].radicado}, pero ocurrió un error al actualizar la pantalla. Recarga la vista para ver las dos filas. Detalle: ${error.message}`
          : `Se guardó correctamente, pero ocurrió un error al actualizar la pantalla: ${error.message}`,
        esGeneracionMasiva ? '' : registroGuardado.radicado
      );
      return;
    }
    if (!intentoGuardarFirestore && archivosSubidos.length > 0) {
      const erroresLimpieza = await eliminarArchivosDrive(archivosSubidos);
      if (erroresLimpieza.length > 0) {
        console.error('No fue posible limpiar todos los archivos subidos:', erroresLimpieza);
      }
    }
    let detalle = error.code === 'permission-denied'
      ? esGeneracionMasiva
        ? `${error.message} Verifica que las reglas de Firestore permitan leer y actualizar "${COLECCION_SECUENCIAS_SALIDA}" y crear documentos en "${COLECCION_SALIDA}".`
        : `${error.message} Verifica que las reglas de Firestore permitan crear documentos en "${COLECCION_SALIDA}" y leer/escribir en "${COLECCION_SECUENCIAS_SALIDA}".`
      : error.message;
    if (intentoGuardarFirestore && !registroGuardado) {
      detalle += esGeneracionMasiva
        ? ' Conservamos este lote como pendiente de confirmación. Reintenta con los mismos datos y cantidad; si Firestore ya lo guardó, se recuperarán las mismas dos filas y no se consumirán consecutivos adicionales.'
        : ' Conservamos este envío como pendiente de confirmación. Reintenta con el mismo formulario; usará la misma clave para no crear otro radicado si Firestore alcanzó a guardar el primero.';
    }
    mostrarResultadoGeneracion(
      'error',
      esGeneracionMasiva ? 'No se pudo generar el lote' : 'No se pudo generar',
      detalle
    );
  } finally {
    estadoControles.forEach(({ control, deshabilitado }) => {
      control.disabled = deshabilitado;
    });
    actualizarModoGeneracion();
    const textoNormal = formulario.querySelector('input[name="modoRadicado"]:checked')?.value === 'masivo'
      ? 'Generar Radicados Masivos'
      : 'Generar Radicado';
    establecerEstadoBoton(boton, spinner, texto, false, '', textoNormal);
    solicitudGeneracionEnCurso = false;
  }
}

async function cargarRadicadosSalida() {
  const contenedorMeses = document.getElementById('generacionMeses');
  const contenedorRecientes = document.getElementById('generacionRecientes');
  try {
    const snapshot = await getDocs(collection(db, COLECCION_SALIDA));
    radicadosSalida = snapshot.docs
      .filter(documento => documento.data().tipoRegistro !== 'reserva-consecutivos')
      .map(documento => ({
        id: documento.id,
        ...documento.data(),
        archivos: Array.isArray(documento.data().archivos) ? documento.data().archivos : []
      }))
      .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
    renderizarCarpetasMes(radicadosSalida);
    renderizarRecientesSalida(radicadosSalida);
    if (mesAbierto) renderizarDetalleCarpeta(mesAbierto);
    return true;
  } catch (error) {
    console.error('Error al cargar los radicados de salida:', error);
    [contenedorMeses, contenedorRecientes].filter(Boolean).forEach(contenedor => {
      const mensaje = document.createElement('p');
      mensaje.className = 'recent-empty generation-load-error';
      mensaje.textContent = 'No fue posible cargar los radicados de salida. Intenta recargar la página.';
      contenedor.replaceChildren(mensaje);
    });
    return false;
  }
}

function crearEstadoVacio(icono, titulo, descripcion) {
  const estado = document.createElement('div');
  estado.className = 'generation-empty-state';
  estado.setAttribute('role', 'status');
  const imagen = document.createElement('i');
  imagen.className = `bi ${icono}`;
  imagen.setAttribute('aria-hidden', 'true');
  const textos = document.createElement('div');
  const encabezado = document.createElement('strong');
  encabezado.textContent = titulo;
  const detalle = document.createElement('span');
  detalle.textContent = descripcion;
  textos.append(encabezado, detalle);
  estado.append(imagen, textos);
  return estado;
}

function renderizarCarpetasMes(registros) {
  const contenedor = document.getElementById('generacionMeses');
  if (!contenedor) return;
  const conteo = new Map();
  registros.forEach(registro => {
    const mes = registro.mes || obtenerMes(registro.fechaGeneracion);
    if (mes) conteo.set(mes, (conteo.get(mes) || 0) + 1);
  });

  const meses = [...conteo.entries()].sort(([a], [b]) => b.localeCompare(a));
  contenedor.replaceChildren();
  if (meses.length === 0) {
    contenedor.append(crearEstadoVacio(
      'bi-folder2-open',
      'Aún no hay radicados por mes',
      'Las comunicaciones que generes aparecerán aquí.'
    ));
    return;
  }

  meses.forEach(([mes, cantidad], indice) => {
    const carpeta = document.createElement('button');
    carpeta.type = 'button';
    carpeta.className = `generation-month-item${indice === 0 ? ' is-current' : ''}`;
    carpeta.setAttribute('aria-label', `Abrir ${obtenerEtiquetaMes(mes)}, ${cantidad} radicados`);
    const icono = document.createElement('i');
    icono.className = 'bi bi-folder-fill';
    icono.setAttribute('aria-hidden', 'true');
    const detalle = document.createElement('span');
    detalle.className = 'generation-month-details';
    const titulo = document.createElement('strong');
    titulo.textContent = obtenerEtiquetaMes(mes);
    const total = document.createElement('span');
    total.textContent = `${cantidad} ${cantidad === 1 ? 'radicado' : 'radicados'}`;
    detalle.append(titulo, total);
    const flecha = document.createElement('i');
    flecha.className = 'bi bi-chevron-right';
    flecha.setAttribute('aria-hidden', 'true');
    carpeta.append(icono, detalle, flecha);
    carpeta.addEventListener('click', () => abrirCarpetaGeneracion(mes));
    contenedor.append(carpeta);
  });
}

function renderizarRecientesSalida(registros) {
  const contenedor = document.getElementById('generacionRecientes');
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (registros.length === 0) {
    contenedor.append(crearEstadoVacio(
      'bi-send',
      'Aún no hay radicados recientes',
      'Cuando generes una comunicación, la verás en esta lista.'
    ));
    return;
  }

  registros.slice(0, 4).forEach(registro => {
    const fila = document.createElement('article');
    fila.className = 'recent-item';
    const detalles = document.createElement('div');
    detalles.className = 'recent-item-details';
    const destinatario = document.createElement('strong');
    destinatario.className = 'recent-item-name';
    destinatario.textContent = registro.destinatario || 'Destinatario sin nombre';
    const numero = document.createElement('span');
    numero.className = 'recent-item-number';
    numero.textContent = registro.radicado || 'Sin número de radicado';
    detalles.append(destinatario, numero);

    const abrir = document.createElement('button');
    abrir.className = 'recent-open';
    abrir.type = 'button';
    abrir.setAttribute('aria-label', `Abrir ${registro.radicado}`);
    abrir.innerHTML = '<i class="bi bi-arrow-up-right" aria-hidden="true"></i>';
    abrir.addEventListener('click', () => abrirCarpetaGeneracion(registro.mes || obtenerMes(registro.fechaGeneracion)));
    fila.append(detalles, abrir);
    contenedor.append(fila);
  });
}

function abrirCarpetaGeneracion(mes) {
  if (!mes) return;
  mesAbierto = mes;
  filtroGeneracion = '';
  const buscador = document.getElementById('buscarRadicadosGeneracion');
  if (buscador) buscador.value = '';
  document.querySelector('.generation-dashboard').hidden = true;
  document.getElementById('detalleCarpetaGeneracion').hidden = false;
  renderizarDetalleCarpeta(mes);
}

function cerrarCarpetaGeneracion() {
  mesAbierto = '';
  document.getElementById('detalleCarpetaGeneracion').hidden = true;
  document.querySelector('.generation-dashboard').hidden = false;
}

function renderizarDetalleCarpeta(mes) {
  const todosLosRegistros = ordenarRadicadosParaPlanilla(radicadosSalida
    .filter(registro => (registro.mes || obtenerMes(obtenerFechaRegistro(registro))) === mes))
    .reverse();
  const registros = filtroGeneracion
    ? todosLosRegistros.filter(registro => [
        registro.radicado,
        obtenerFechaRegistro(registro),
        obtenerHoraRegistro(registro),
        registro.destinatario,
        registro.asunto,
        registro.folios,
        registro.anexos,
        registro.dependencia === 'Otro' ? registro.dependenciaOtra : registro.dependencia,
        ...(registro.archivos || []).map(archivo => archivo.nombre)
      ].join(' ').toLocaleLowerCase('es-CO').includes(filtroGeneracion))
    : todosLosRegistros;
  const titulo = document.getElementById('tituloCarpetaGeneracion');
  titulo.querySelector('span').textContent = obtenerEtiquetaMes(mes);
  const periodo = document.getElementById('periodoCarpetaGeneracion');
  periodo.dateTime = `${mes}-01`;
  periodo.textContent = obtenerEtiquetaMes(mes);
  document.getElementById('conteoCarpetaGeneracion').textContent =
    `${registros.length} de ${todosLosRegistros.length} ${todosLosRegistros.length === 1 ? 'radicado' : 'radicados'}`;
  const tbody = document.getElementById('cuerpoTablaGeneracion');
  tbody.replaceChildren();

  if (registros.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 11;
    celda.textContent = 'Esta carpeta no tiene radicados.';
    fila.append(celda);
    tbody.append(fila);
    return;
  }

  registros.forEach(registro => tbody.append(crearFilaTabla(registro)));
}

function crearFilaTabla(registro) {
  const fila = document.createElement('tr');
  if (registro.estado === 'ANULADO') fila.classList.add('is-annulled-row');
  const valores = [
    registro.radicado || '',
    obtenerFechaRegistro(registro),
    obtenerHoraRegistro(registro),
    registro.destinatario || '',
    registro.asunto || '',
    String(registro.folios ?? ''),
    String(registro.anexos ?? ''),
    registro.dependencia === 'Otro' ? registro.dependenciaOtra || 'Otro' : registro.dependencia || '',
    registro.estado === 'ANULADO' ? 'ANULADO' : 'VIGENTE'
  ];
  valores.forEach((valor, indice) => {
    const celda = document.createElement('td');
    celda.textContent = valor;
    if (indice === 0) {
      const numero = document.createElement('strong');
      numero.textContent = valor;
      celda.replaceChildren(numero);
    }
    if (indice === 8) {
      const estado = document.createElement('span');
      estado.className = `generation-status-badge${valor === 'ANULADO' ? ' is-annulled' : ''}`;
      estado.textContent = valor;
      celda.replaceChildren(estado);
    }
    fila.append(celda);
  });

  const celdaArchivos = document.createElement('td');
  const archivos = Array.isArray(registro.archivos) ? registro.archivos : [];
  if (archivos.length === 0) {
    celdaArchivos.textContent = 'Sin archivos';
  } else {
    const lista = document.createElement('div');
    lista.className = 'generation-table-files';
    archivos.forEach(archivo => {
      const enlace = document.createElement('a');
      enlace.href = archivo.url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = archivo.nombre || 'Abrir archivo';
      enlace.title = archivo.nombre || 'Abrir archivo';
      lista.append(enlace);
    });
    celdaArchivos.append(lista);
  }
  fila.append(celdaArchivos);

  const celdaAcciones = document.createElement('td');
  const acciones = document.createElement('div');
  acciones.className = 'generation-table-actions';
  const editar = document.createElement('button');
  editar.type = 'button';
  editar.className = 'generation-action-edit';
  editar.title = 'Editar radicado';
  editar.setAttribute('aria-label', `Editar ${registro.radicado}`);
  editar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';
  editar.disabled = registro.estado === 'ANULADO';
  editar.addEventListener('click', () => abrirModalEdicionSalida(registro));
  if (registro.estado !== 'ANULADO') {
    const anular = document.createElement('button');
    anular.type = 'button';
    anular.className = 'generation-action-annul';
    anular.title = 'Anular radicado';
    anular.setAttribute('aria-label', `Anular ${registro.radicado}`);
    anular.innerHTML = '<i class="bi bi-ban" aria-hidden="true"></i><span>Anular</span>';
    anular.addEventListener('click', () => anularRadicadoSalida(registro, anular));
    acciones.append(editar, anular);
  } else {
    acciones.append(editar);
  }
  celdaAcciones.append(acciones);
  fila.append(celdaAcciones);
  return fila;
}

function abrirModalEdicionSalida(registro) {
  document.getElementById('idEditarSalida').value = registro.id;
  document.getElementById('destinatarioEditarSalida').value = registro.destinatario || '';
  document.getElementById('asuntoEditarSalida').value = registro.asunto || '';
  document.getElementById('foliosEditarSalida').value = registro.folios ?? '';
  document.getElementById('anexosEditarSalida').value = registro.anexos ?? '';
  const selector = document.getElementById('dependenciaEditarSalida');
  const valorDependencia = registro.dependencia === 'Otro'
    ? 'Otro'
    : registro.dependencia || '';
  const opcionDependencia = Array.from(selector.options).find(opcion => (
    opcion.value.toLocaleLowerCase('es-CO') === valorDependencia.toLocaleLowerCase('es-CO')
  ));
  selector.value = opcionDependencia?.value || valorDependencia;
  const inputOtra = document.getElementById('dependenciaOtraEditar');
  inputOtra.value = registro.dependenciaOtra || '';
  inputOtra.required = valorDependencia === 'Otro';
  document.getElementById('dependenciaOtraEditarGroup').hidden = valorDependencia !== 'Otro';

  const archivosExistentes = document.getElementById('archivosExistentesSalida');
  archivosExistentes.replaceChildren();
  (registro.archivos || []).forEach(archivo => {
    const enlace = document.createElement('a');
    enlace.href = archivo.url;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.textContent = archivo.nombre || 'Abrir archivo';
    archivosExistentes.append(enlace);
  });
  const inputArchivos = document.getElementById('archivosEditarSalida');
  inputArchivos.value = '';
  inputArchivos.dataset.existingCount = String((registro.archivos || []).length);
  const ayudaArchivos = document.getElementById('archivosEditarSalidaAyuda');
  document.getElementById('listaArchivosEditarSalida').replaceChildren();
  ayudaArchivos.textContent = `Puedes agregar hasta ${MAX_ARCHIVOS - (registro.archivos || []).length} archivos más.`;
  document.getElementById('modalEditarSalida').style.display = 'flex';
}

function cerrarModalEdicionSalida() {
  document.getElementById('modalEditarSalida').style.display = 'none';
}

async function guardarEdicionRadicadoSalida(event) {
  event.preventDefault();
  const boton = document.getElementById('guardarEditarSalida');
  const spinner = document.getElementById('spinnerEditarSalida');
  const texto = document.getElementById('textoEditarSalida');
  const id = document.getElementById('idEditarSalida').value;
  const registro = radicadosSalida.find(item => item.id === id);
  if (!registro) {
    alert('No se encontró el radicado de salida que deseas editar.');
    return;
  }
  if (registro.estado === 'ANULADO') {
    mostrarResultadoGeneracion('warning', 'Radicado anulado', 'Los radicados anulados se conservan en el historial y no se pueden editar.');
    return;
  }

  const inputArchivos = document.getElementById('archivosEditarSalida');
  const archivosNuevos = Array.from(inputArchivos.files || []);
  const limiteArchivosNuevos = Math.max(0, MAX_ARCHIVOS - (registro.archivos || []).length);
  const errorArchivos = validarArchivos(archivosNuevos, limiteArchivosNuevos);
  if (errorArchivos) {
    alert(errorArchivos);
    return;
  }

  const archivosSubidos = [];
  establecerEstadoBoton(boton, spinner, texto, true, 'Guardando...', 'Guardar Cambios');
  try {
    const adjuntosNuevos = await subirArchivosSalida(archivosNuevos);
    archivosSubidos.push(...adjuntosNuevos);
    const dependenciaSeleccionada = document.getElementById('dependenciaEditarSalida').value;
    await updateDoc(doc(db, COLECCION_SALIDA, id), {
      destinatario: formatearMayusculasIniciales(document.getElementById('destinatarioEditarSalida').value.trim()),
      asunto: formatearMayusculasIniciales(document.getElementById('asuntoEditarSalida').value.trim()),
      folios: Number(document.getElementById('foliosEditarSalida').value),
      anexos: Number(document.getElementById('anexosEditarSalida').value),
      dependencia: dependenciaSeleccionada === 'Otro'
        ? dependenciaSeleccionada
        : formatearMayusculasIniciales(dependenciaSeleccionada),
      dependenciaOtra: dependenciaSeleccionada === 'Otro'
        ? formatearMayusculasIniciales(document.getElementById('dependenciaOtraEditar').value.trim())
        : '',
      archivos: [...(registro.archivos || []), ...adjuntosNuevos],
      actualizadoEn: new Date().toISOString()
    });
    cerrarModalEdicionSalida();
    await cargarRadicadosSalida();
    alert('El radicado de salida se actualizó correctamente.');
  } catch (error) {
    console.error('Error al editar el radicado de salida:', error);
    if (archivosSubidos.length > 0) {
      const erroresLimpieza = await eliminarArchivosDrive(archivosSubidos);
      if (erroresLimpieza.length > 0) {
        console.error('No fue posible limpiar todos los archivos subidos:', erroresLimpieza);
      }
    }
    alert(`No se pudo actualizar el radicado de salida: ${error.message}`);
  } finally {
    establecerEstadoBoton(boton, spinner, texto, false, '', 'Guardar Cambios');
  }
}

async function anularRadicadoSalida(registro, boton) {
  const confirmado = await confirmarAccion(
    `¿Deseas anular el radicado ${registro.radicado}? El registro y sus archivos se conservarán en el historial.`,
    { titulo: 'Anular radicado', aceptarTexto: 'Anular' }
  );
  if (!confirmado) return;
  boton.disabled = true;
  boton.replaceChildren();
  const spinner = document.createElement('span');
  spinner.className = 'action-delete-spinner';
  spinner.setAttribute('aria-label', 'Anulando radicado');
  boton.append(spinner);
  let anulacionGuardada = false;
  try {
    const instanteAnulacion = new Date().toISOString();
    await updateDoc(doc(db, COLECCION_SALIDA, registro.id), {
      estado: 'ANULADO',
      anuladoEn: instanteAnulacion,
      actualizadoEn: instanteAnulacion
    });
    anulacionGuardada = true;
    mostrarResultadoGeneracion(
      'success',
      'Radicado anulado',
      `El radicado ${registro.radicado} fue anulado correctamente. El registro y sus archivos se conservaron en el historial.`
    );

    radicadosSalida = radicadosSalida.map(item =>
      item.id === registro.id
        ? { ...item, estado: 'ANULADO', anuladoEn: instanteAnulacion }
        : item
    );
    try {
      renderizarCarpetasMes(radicadosSalida);
      renderizarRecientesSalida(radicadosSalida);
      if (mesAbierto) renderizarDetalleCarpeta(mesAbierto);
    } catch (error) {
      console.error('El radicado fue anulado, pero no se pudo actualizar la vista:', error);
    }
  } catch (error) {
    console.error('Error al anular el radicado de salida:', error);
    mostrarResultadoGeneracion(
      'error',
      'No se pudo anular',
      `No se guardó la anulación del radicado ${registro.radicado}. ${error.message}`
    );
  } finally {
    if (boton.isConnected && !anulacionGuardada) {
      boton.disabled = false;
      boton.innerHTML = '<i class="bi bi-ban" aria-hidden="true"></i><span>Anular</span>';
    }
  }
}
