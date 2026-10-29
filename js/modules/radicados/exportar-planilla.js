import { datosRadicados, dependenciaActual } from '../../data/radicados.js';

const RUTA_PLANTILLA = new URL(
  '../../../assets/plantillas/Planilla de Recibido de Comunicaciones Entrantes.xlsx',
  import.meta.url
);
const URL_EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
let cargaExcelJs;

function cargarExcelJs() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (cargaExcelJs) return cargaExcelJs;

  cargaExcelJs = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = URL_EXCELJS;
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
    cargaExcelJs = null;
    throw error;
  });

  return cargaExcelJs;
}

function analizarNumeroRadicado(valor) {
  const coincidencia = String(valor || '').trim().match(/^(.*?)(\d+)$/);
  if (!coincidencia) return null;

  return {
    prefijo: coincidencia[1].toUpperCase(),
    consecutivo: Number(coincidencia[2])
  };
}

function formatearFechaPlanilla(fecha) {
  if (typeof fecha !== 'string') return '';
  const iso = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;

  const colombiana = fecha.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return colombiana ? colombiana[0] : fecha;
}

function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.hidden = false;
}

function crearNombreArchivo(dependencia) {
  const nombre = dependencia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
  return `Planilla_Recibidos_${nombre}_${fecha}.xlsx`;
}

async function descargarPlanilla(dependencia, registros) {
  const [ExcelJS, respuestaPlantilla] = await Promise.all([
    cargarExcelJs(),
    fetch(RUTA_PLANTILLA)
  ]);
  if (!respuestaPlantilla.ok) {
    throw new Error(`No fue posible abrir la plantilla (${respuestaPlantilla.status}).`);
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await respuestaPlantilla.arrayBuffer());
  const hoja = libro.getWorksheet('F002') || libro.worksheets[0];
  if (!hoja) throw new Error('La plantilla no contiene una hoja de cálculo.');

  hoja.getCell('A6').value = `DEPENDENCIA : ${dependencia}`;
  const filaModelo = hoja.getRow(8);

  registros.forEach((registro, indice) => {
    const filaNumero = indice + 8;
    const fila = hoja.getRow(filaNumero);
    if (filaNumero > 247) {
      fila.height = filaModelo.height;
    }
    for (let columna = 1; columna <= 10; columna += 1) {
      fila.getCell(columna).style = { ...filaModelo.getCell(columna).style };
    }

    fila.getCell('A').value = registro.radicado || '';
    fila.getCell('B').value = formatearFechaPlanilla(registro.fechaRadicacion);
    fila.getCell('C').value = registro.remitente || '';
    fila.getCell('D').value = registro.asunto || '';
    fila.getCell('G').value = registro.dependencia || dependencia;
    fila.getCell('H').value = formatearFechaPlanilla(registro.fechaEntregaManual);
  });

  const contenido = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([contenido], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = crearNombreArchivo(dependencia);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function inicializarExportacionPlanilla() {
  const modal = document.getElementById('modalExportarPlanilla');
  const formulario = document.getElementById('formExportarPlanilla');
  const botonAbrir = document.getElementById('abrirExportarPlanilla');
  const botonCerrar = document.getElementById('cerrarModalPlanilla');
  const botonCancelar = document.getElementById('cancelarExportarPlanilla');
  const botonDescargar = document.getElementById('confirmarExportarPlanilla');
  const desdeInput = document.getElementById('radicadoDesdePlanilla');
  const hastaInput = document.getElementById('radicadoHastaPlanilla');
  const dependenciaLabel = document.getElementById('dependenciaPlanilla');
  const error = document.getElementById('errorExportarPlanilla');
  if (!modal || !formulario || !botonAbrir || !desdeInput || !hastaInput) return;

  const cerrar = () => modal.close();
  botonAbrir.addEventListener('click', () => {
    formulario.reset();
    error.hidden = true;
    dependenciaLabel.textContent = dependenciaActual;
    modal.showModal();
    desdeInput.focus();
  });
  botonCerrar?.addEventListener('click', cerrar);
  botonCancelar?.addEventListener('click', cerrar);

  formulario.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    if (!formulario.reportValidity()) return;

    const inicio = analizarNumeroRadicado(desdeInput.value);
    const fin = analizarNumeroRadicado(hastaInput.value);
    if (!inicio || !fin) {
      mostrarError(error, 'Escribe los radicados completos, incluido su consecutivo numérico.');
      return;
    }
    if (inicio.prefijo !== fin.prefijo) {
      mostrarError(error, 'Los radicados Desde y Hasta deben pertenecer a la misma serie.');
      return;
    }
    if (inicio.consecutivo > fin.consecutivo) {
      mostrarError(error, 'El radicado inicial debe ser menor o igual al radicado final.');
      return;
    }

    const registros = (datosRadicados[dependenciaActual] || [])
      .filter(registro => {
        const numero = analizarNumeroRadicado(registro.radicado);
        return numero
          && numero.prefijo === inicio.prefijo
          && numero.consecutivo >= inicio.consecutivo
          && numero.consecutivo <= fin.consecutivo;
      })
      .sort((a, b) => analizarNumeroRadicado(a.radicado).consecutivo
        - analizarNumeroRadicado(b.radicado).consecutivo);

    if (registros.length === 0) {
      mostrarError(error, 'No se encontraron radicados de esta dependencia dentro del rango indicado.');
      return;
    }

    botonDescargar.disabled = true;
    botonDescargar.setAttribute('aria-busy', 'true');
    botonDescargar.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Preparando Excel…';
    try {
      await descargarPlanilla(dependenciaActual, registros);
      cerrar();
    } catch (errorDescarga) {
      console.error('Error al generar la planilla de recibidos:', errorDescarga);
      mostrarError(error, errorDescarga.message || 'No fue posible generar la planilla.');
    } finally {
      botonDescargar.disabled = false;
      botonDescargar.removeAttribute('aria-busy');
      botonDescargar.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i> Descargar Excel';
    }
  });
}
