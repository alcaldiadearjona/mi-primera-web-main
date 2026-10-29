import { datosRadicados } from '../../data/radicados.js';
import { asegurarBordesCeldaExcel } from '../../utils/excel.js';

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

function normalizarFecha(fecha) {
  if (typeof fecha !== 'string') return '';
  const valor = fecha.trim();
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const colombiana = valor.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return colombiana ? `${colombiana[3]}-${colombiana[2]}-${colombiana[1]}` : '';
}

function formatearFechaPlanilla(fecha) {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return typeof fecha === 'string' ? fecha : '';
  const [, anio, mes, dia] = normalizada.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return `${dia}-${mes}-${anio}`;
}

function formatearMayusculasIniciales(valor) {
  return String(valor || '')
    .toLocaleLowerCase('es-CO')
    .replace(/(^|[\s-])(\p{L})/gu, (coincidencia, separador, letra) => (
      `${separador}${letra.toLocaleUpperCase('es-CO')}`
    ));
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
        const adicionales = Math.ceil(longitud / anchoColumna) - 1;
        lineas += adicionales;
        caracteres = longitud % anchoColumna || anchoColumna;
      } else {
        caracteres += (caracteres > 0 ? 1 : 0) + longitud;
      }
    });
    return total + lineas;
  }, 0);
}

function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.hidden = false;
}

function crearNombreArchivo() {
  const fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
  return `Registro_de_Distribucion_de_Comunicaciones_Oficiales_Recibidas_(${fecha}).xlsx`;
}

async function descargarPlanilla(registros) {
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

  const filaModelo = hoja.getRow(8);

  registros.forEach((registro, indice) => {
    const filaNumero = indice + 8;
    const fila = hoja.getRow(filaNumero);
    if (filaNumero > 247) {
      fila.height = filaModelo.height;
    }
    for (let columna = 1; columna <= 10; columna += 1) {
      const celda = fila.getCell(columna);
      celda.style = { ...filaModelo.getCell(columna).style };
      asegurarBordesCeldaExcel(celda);
    }

    fila.getCell('A').value = registro.radicado || '';
    fila.getCell('B').value = formatearFechaPlanilla(registro.fechaRadicacion);
    fila.getCell('C').value = formatearMayusculasIniciales(registro.remitente);
    fila.getCell('D').value = formatearMayusculasIniciales(registro.asunto);
    fila.getCell('G').value = formatearMayusculasIniciales(registro.dependencia);
    fila.getCell('H').value = formatearFechaPlanilla(registro.fechaEntregaManual);

    let lineasMaximas = 1;
    [['C', 3], ['D', 4], ['G', 7]].forEach(([letra, numeroColumna]) => {
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
  const url = URL.createObjectURL(new Blob([contenido], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = crearNombreArchivo();
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
  const fechaDesdeInput = document.getElementById('fechaDesdePlanilla');
  const fechaHastaInput = document.getElementById('fechaHastaPlanilla');
  const mesInput = document.getElementById('mesPlanilla');
  const anoInput = document.getElementById('anoPlanilla');
  const todasDependencias = document.getElementById('todasDependenciasPlanilla');
  const contenedorDependencias = document.getElementById('dependenciasPlanilla');
  const error = document.getElementById('errorExportarPlanilla');
  if (!modal || !formulario || !botonAbrir || !desdeInput || !hastaInput) return;

  const controlesDependencias = Object.keys(datosRadicados).map((dependencia, indice) => {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'received-register-dependency-option';
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.value = dependencia;
    casilla.id = `dependenciaPlanilla${indice}`;
    casilla.disabled = true;
    const nombre = document.createElement('span');
    nombre.textContent = dependencia;
    etiqueta.append(casilla, nombre);
    contenedorDependencias.append(etiqueta);
    return casilla;
  });

  const actualizarEstadoDependencias = () => {
    controlesDependencias.forEach(casilla => {
      casilla.disabled = todasDependencias.checked;
      if (todasDependencias.checked) casilla.checked = false;
      casilla.parentElement.classList.toggle('is-disabled', casilla.disabled);
    });
  };
  todasDependencias.addEventListener('change', actualizarEstadoDependencias);

  const cerrar = () => modal.close();
  botonAbrir.addEventListener('click', () => {
    formulario.reset();
    todasDependencias.checked = true;
    actualizarEstadoDependencias();
    error.hidden = true;
    modal.showModal();
    desdeInput.focus();
  });
  botonCerrar?.addEventListener('click', cerrar);
  botonCancelar?.addEventListener('click', cerrar);

  formulario.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    if (!formulario.reportValidity()) return;

    const radicadoDesde = desdeInput.value.trim();
    const radicadoHasta = hastaInput.value.trim();
    const fechaDesde = fechaDesdeInput.value;
    const fechaHasta = fechaHastaInput.value;
    const mes = mesInput.value;
    const ano = anoInput.value;
    const dependenciasSeleccionadas = todasDependencias.checked
      ? []
      : controlesDependencias.filter(casilla => casilla.checked).map(casilla => casilla.value);

    if (Boolean(radicadoDesde) !== Boolean(radicadoHasta)) {
      mostrarError(error, 'Completa ambos radicados para filtrar por rango.');
      return;
    }
    if (radicadoDesde && radicadoHasta) {
      const inicio = analizarNumeroRadicado(radicadoDesde);
      const fin = analizarNumeroRadicado(radicadoHasta);
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
    }

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      mostrarError(error, 'La fecha inicial debe ser menor o igual a la fecha final.');
      return;
    }
    if (!todasDependencias.checked && dependenciasSeleccionadas.length === 0) {
      mostrarError(error, 'Selecciona al menos una dependencia o marca “Todas las dependencias”.');
      return;
    }

    const inicio = radicadoDesde ? analizarNumeroRadicado(radicadoDesde) : null;
    const fin = radicadoHasta ? analizarNumeroRadicado(radicadoHasta) : null;
    if (!inicio && !fechaDesde && !fechaHasta && !mes && !ano && todasDependencias.checked) {
      mostrarError(error, 'Selecciona al menos un filtro para generar la planilla.');
      return;
    }

    const registros = Object.entries(datosRadicados)
      .flatMap(([dependencia, lista]) => lista.map(registro => ({
        ...registro,
        dependencia: registro.dependencia || dependencia
      })))
      .filter(registro => {
        const numero = inicio && analizarNumeroRadicado(registro.radicado);
        const fecha = normalizarFecha(registro.fechaRadicacion);
        return (!inicio || (numero
            && numero.prefijo === inicio.prefijo
            && numero.consecutivo >= inicio.consecutivo
            && numero.consecutivo <= fin.consecutivo))
          && (!fechaDesde || fecha >= fechaDesde)
          && (!fechaHasta || fecha <= fechaHasta)
          && (!mes || fecha.slice(5, 7) === mes)
          && (!ano || fecha.slice(0, 4) === ano)
          && (todasDependencias.checked || dependenciasSeleccionadas.includes(registro.dependencia));
      })
      .sort((a, b) => {
        const numeroA = analizarNumeroRadicado(a.radicado);
        const numeroB = analizarNumeroRadicado(b.radicado);
        const diferencia = (numeroA?.consecutivo || 0) - (numeroB?.consecutivo || 0);
        return diferencia || a.dependencia.localeCompare(b.dependencia, 'es');
      });

    if (registros.length === 0) {
      mostrarError(error, 'No se encontraron radicados dentro del rango indicado.');
      return;
    }

    botonDescargar.disabled = true;
    botonDescargar.setAttribute('aria-busy', 'true');
    botonDescargar.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Preparando Excel…';
    try {
      await descargarPlanilla(registros);
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
