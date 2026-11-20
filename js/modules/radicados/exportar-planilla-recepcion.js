import {
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, RADICADOS_COLLECTION } from '../../config/firebase-config.js';
import { asegurarBordesCeldaExcel } from '../../utils/excel.js';
import { formatearMayusculasIniciales } from '../../utils/helpers.js';
import { cargarExcelJs } from './exportar-planilla.js';

const RUTA_PLANTILLA_RECEPCION = new URL(
  '../../../assets/plantillas/Planilla de Recibido de Comunicaciones Entrantes - RECEPCION.xlsx',
  import.meta.url
);
const TIPO_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.hidden = false;
}

function normalizarFecha(fecha) {
  if (typeof fecha !== 'string') return '';
  const valor = fecha.trim();
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const colombiana = valor.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return colombiana ? `${colombiana[3]}-${colombiana[2]}-${colombiana[1]}` : '';
}

function formatearFecha(fecha) {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return '';
  const [, anio, mes, dia] = normalizada.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return `${dia}-${mes}-${anio}`;
}

function formatearHora(registro) {
  if (registro.horaRadicacion) return registro.horaRadicacion;
  const fecha = new Date(registro.fechaHoraRadicacion || '');
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(fecha);
}

function formatearConteo(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const cantidad = Number(valor);
  return Number.isFinite(cantidad) ? cantidad : '';
}

function analizarNumeroRadicado(valor) {
  const coincidencia = String(valor || '').trim().match(/^(.*?)(\d+)$/);
  if (!coincidencia) return null;

  return {
    prefijo: coincidencia[1].toUpperCase(),
    consecutivo: Number(coincidencia[2])
  };
}

function calcularLineasAjustadas(valor, anchoColumna) {
  return String(valor || '').split(/\r?\n/).reduce((total, linea) => {
    const palabras = linea.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return total + 1;

    let lineas = 1;
    let caracteres = 0;
    palabras.forEach(palabra => {
      const longitud = palabra.length;
      if (caracteres > 0 && caracteres + 1 + longitud > anchoColumna) {
        lineas += 1;
        caracteres = 0;
      }
      if (longitud > anchoColumna) {
        lineas += Math.ceil(longitud / anchoColumna) - 1;
        caracteres = longitud % anchoColumna || anchoColumna;
      } else {
        caracteres += (caracteres > 0 ? 1 : 0) + longitud;
      }
    });
    return total + lineas;
  }, 0);
}

function ordenarRecepciones(registros) {
  return registros.sort((a, b) => (
    String(a.fechaRadicacion || '').localeCompare(String(b.fechaRadicacion || ''))
    || String(a.horaRadicacion || '').localeCompare(String(b.horaRadicacion || ''))
    || String(a.radicado || '').localeCompare(String(b.radicado || ''), 'es')
  ));
}

function filtrarRecepciones(registros, filtros) {
  const inicio = filtros.radicadoDesde ? analizarNumeroRadicado(filtros.radicadoDesde) : null;
  const fin = filtros.radicadoHasta ? analizarNumeroRadicado(filtros.radicadoHasta) : null;
  return registros.filter(registro => {
    const numero = inicio && analizarNumeroRadicado(registro.radicado);
    const fecha = normalizarFecha(registro.fechaRadicacion);
    return (!inicio || (numero
        && numero.prefijo === inicio.prefijo
        && numero.consecutivo >= inicio.consecutivo
        && numero.consecutivo <= fin.consecutivo))
      && (!filtros.fechaDesde || fecha >= filtros.fechaDesde)
      && (!filtros.fechaHasta || fecha <= filtros.fechaHasta)
      && (!filtros.mes || fecha.slice(5, 7) === filtros.mes)
      && (!filtros.ano || fecha.slice(0, 4) === filtros.ano);
  });
}

async function consultarRecepciones() {
  const snapshot = await getDocs(query(
    collection(db, RADICADOS_COLLECTION),
    where('fechaRecepcion', '>=', '')
  ));
  const registrosPorRadicado = new Map();
  snapshot.docs.forEach(documento => {
    const registro = documento.data();
    const identificador = registro.radicado || documento.id;
    if (!registrosPorRadicado.has(identificador)) {
      registrosPorRadicado.set(identificador, registro);
    }
  });
  return ordenarRecepciones(Array.from(registrosPorRadicado.values()));
}

async function descargarPlanilla(registros) {
  const [ExcelJS, respuestaPlantilla] = await Promise.all([
    cargarExcelJs(),
    fetch(RUTA_PLANTILLA_RECEPCION)
  ]);
  if (!respuestaPlantilla.ok) {
    throw new Error(`No fue posible abrir la plantilla (${respuestaPlantilla.status}).`);
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await respuestaPlantilla.arrayBuffer());
  const hoja = libro.getWorksheet('F002') || libro.worksheets[0];
  if (!hoja) throw new Error('La planilla de Recepción no contiene una hoja de cálculo.');

  const filaModelo = hoja.getRow(8);
  registros.forEach((registro, indice) => {
    const filaNumero = indice + 8;
    const fila = hoja.getRow(filaNumero);
    if (filaNumero > 247) {
      fila.height = filaModelo.height;
      for (let columna = 1; columna <= 10; columna += 1) {
        const celda = fila.getCell(columna);
        celda.style = { ...filaModelo.getCell(columna).style };
        asegurarBordesCeldaExcel(celda);
      }
    }

    fila.getCell('A').value = registro.radicado || '';
    fila.getCell('B').value = formatearFecha(registro.fechaRadicacion);
    fila.getCell('C').value = formatearHora(registro);
    fila.getCell('D').value = formatearMayusculasIniciales(registro.remitente);
    fila.getCell('E').value = formatearMayusculasIniciales(registro.asunto);
    fila.getCell('F').value = formatearConteo(registro.folios);
    fila.getCell('G').value = formatearConteo(registro.anexos);
    fila.getCell('H').value = formatearMayusculasIniciales(
      registro.dependenciaResponsable
        || (registro.dependencia === 'Ventanilla Única' ? '' : registro.dependencia || '')
    );
    const tiempoRespuesta = fila.getCell('I');
    tiempoRespuesta.numFmt = '0';
    tiempoRespuesta.value = registro.estado === 'PENDIENTE_GESTION'
      ? ''
      : formatearConteo(registro.diasHabiles);
    fila.getCell('J').value = formatearMayusculasIniciales(registro.observaciones);

    let lineasMaximas = 1;
    [['D', 4], ['E', 5], ['H', 8], ['J', 10]].forEach(([letra, numeroColumna]) => {
      const celda = fila.getCell(letra);
      const ancho = hoja.getColumn(numeroColumna).width || 10;
      celda.alignment = {
        ...celda.alignment,
        vertical: 'middle',
        wrapText: true,
        shrinkToFit: false
      };
      lineasMaximas = Math.max(
        lineasMaximas,
        calcularLineasAjustadas(celda.value, Math.max(1, Math.floor(ancho)))
      );
    });
    fila.height = Math.max(fila.height || filaModelo.height || 44.25, lineasMaximas * 15 + 8);
  });

  const contenido = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([contenido], { type: TIPO_EXCEL }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `Planilla_de_Recepcion_(${new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota'
  }).format(new Date())}).xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function inicializarExportacionPlanillaRecepcion() {
  const modal = document.getElementById('modalExportarPlanillaRecepcion');
  const formulario = document.getElementById('formExportarPlanillaRecepcion');
  const botonAbrir = document.getElementById('abrirExportarPlanillaRecepcion');
  const botonCerrar = document.getElementById('cerrarModalPlanillaRecepcion');
  const botonCancelar = document.getElementById('cancelarExportarPlanillaRecepcion');
  const botonDescargar = document.getElementById('confirmarExportarPlanillaRecepcion');
  const radicadoDesdeInput = document.getElementById('radicadoDesdePlanillaRecepcion');
  const radicadoHastaInput = document.getElementById('radicadoHastaPlanillaRecepcion');
  const fechaDesdeInput = document.getElementById('fechaDesdePlanillaRecepcion');
  const fechaHastaInput = document.getElementById('fechaHastaPlanillaRecepcion');
  const mesInput = document.getElementById('mesPlanillaRecepcion');
  const anoInput = document.getElementById('anoPlanillaRecepcion');
  const error = document.getElementById('errorExportarPlanillaRecepcion');
  if (
    !modal
    || !formulario
    || !botonAbrir
    || !botonDescargar
    || !radicadoDesdeInput
    || !radicadoHastaInput
    || !fechaDesdeInput
    || !fechaHastaInput
    || !mesInput
    || !anoInput
    || !error
  ) return;

  const textoOriginal = botonDescargar.innerHTML;
  const cerrar = () => modal.close();
  botonAbrir.addEventListener('click', () => {
    formulario.reset();
    error.hidden = true;
    modal.showModal();
    radicadoDesdeInput.focus();
  });
  botonCerrar?.addEventListener('click', cerrar);
  botonCancelar?.addEventListener('click', cerrar);

  formulario.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;

    const radicadoDesde = radicadoDesdeInput.value.trim();
    const radicadoHasta = radicadoHastaInput.value.trim();
    const fechaDesde = fechaDesdeInput.value;
    const fechaHasta = fechaHastaInput.value;
    const mes = mesInput.value;
    const ano = anoInput.value;

    if (Boolean(radicadoDesde) !== Boolean(radicadoHasta)) {
      mostrarError(error, 'Completa ambos radicados para filtrar por rango.');
      return;
    }

    const inicio = radicadoDesde ? analizarNumeroRadicado(radicadoDesde) : null;
    const fin = radicadoHasta ? analizarNumeroRadicado(radicadoHasta) : null;
    if (radicadoDesde && (!inicio || !fin)) {
      mostrarError(error, 'Escribe los radicados completos, incluido su consecutivo numérico.');
      return;
    }
    if (inicio && fin && inicio.prefijo !== fin.prefijo) {
      mostrarError(error, 'Los radicados Desde y Hasta deben pertenecer a la misma serie.');
      return;
    }
    if (inicio && fin && inicio.consecutivo > fin.consecutivo) {
      mostrarError(error, 'El radicado inicial debe ser menor o igual al radicado final.');
      return;
    }
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      mostrarError(error, 'La fecha inicial debe ser menor o igual a la fecha final.');
      return;
    }
    if (!inicio && !fechaDesde && !fechaHasta && !mes && !ano) {
      mostrarError(error, 'Selecciona al menos un filtro para generar la planilla de Recepción.');
      return;
    }

    botonDescargar.disabled = true;
    botonDescargar.setAttribute('aria-busy', 'true');
    botonDescargar.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Preparando Excel…';
    try {
      const registros = filtrarRecepciones(await consultarRecepciones(), {
        radicadoDesde,
        radicadoHasta,
        fechaDesde,
        fechaHasta,
        mes,
        ano
      });
      if (registros.length === 0) {
        mostrarError(error, 'No se encontraron recepciones con los filtros seleccionados.');
        return;
      }
      await descargarPlanilla(registros);
      cerrar();
    } catch (errorDescarga) {
      console.error('Error al descargar la planilla de Recepción:', errorDescarga);
      const mensaje = errorDescarga?.code === 'permission-denied'
        ? 'No tienes permiso para consultar las recepciones. Verifica el rol de la sesión.'
        : errorDescarga?.message || 'No fue posible generar la planilla de Recepción.';
      mostrarError(error, mensaje);
    } finally {
      botonDescargar.disabled = false;
      botonDescargar.removeAttribute('aria-busy');
      botonDescargar.innerHTML = textoOriginal;
    }
  });
}
