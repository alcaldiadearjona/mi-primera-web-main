import { datosRadicados } from '../../data/radicados.js';
import { evaluarEstadoAutomatico } from '../../utils/helpers.js';

const PLANTILLAS = {
  auditoria: new URL('../../../assets/plantillas/Informe_PQRS_Auditoria.xlsx', import.meta.url),
  general: new URL('../../../assets/plantillas/Informe_PQRS_General.xlsx', import.meta.url)
};
const URL_EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const DIAS_EN_MILISEGUNDOS = 24 * 60 * 60 * 1000;
const PALABRAS_COMUNES = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por',
  'que', 'se', 'solicitud', 'sobre', 'un', 'una', 'y'
]);
const CONECTORES_TITULO = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'los', 'o',
  'para', 'por', 'u', 'y'
]);
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
        reject(new Error('La biblioteca para generar el Excel no quedó disponible.'));
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

function normalizarFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  if (valor && typeof valor.toDate === 'function') return normalizarFecha(valor.toDate());
  if (valor && Number.isFinite(valor.seconds)) {
    return normalizarFecha(new Date(valor.seconds * 1000));
  }
  if (typeof valor !== 'string') return '';

  const fecha = valor.trim();
  const iso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = fecha.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  return local ? `${local[3]}-${local[2]}-${local[1]}` : '';
}

function fechaExcel(fecha) {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return null;
  const [anio, mes, dia] = normalizada.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12);
}

function convertirAFechaUtc(fecha) {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return null;
  const [anio, mes, dia] = normalizada.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizarTexto(valor) {
  const palabras = String(valor || '').trim().toLocaleLowerCase('es-CO').split(/(\s+|[-/]+)/u);
  let esPrimeraPalabra = true;

  return palabras.map(palabra => {
    if (!palabra || /^[\s/-]+$/u.test(palabra)) return palabra;
    const esConector = CONECTORES_TITULO.has(palabra);
    const resultado = !esPrimeraPalabra && esConector
      ? palabra
      : `${palabra.charAt(0).toLocaleUpperCase('es-CO')}${palabra.slice(1)}`;
    esPrimeraPalabra = false;
    return resultado;
  }).join('');
}

function obtenerEstado(registro) {
  return evaluarEstadoAutomatico(
    normalizarFecha(registro.fechaVencimiento),
    registro.respuestaUrl,
    registro.otrosEstados,
    registro.estado
  );
}

function obtenerRegistros() {
  return Object.entries(datosRadicados).flatMap(([dependencia, lista]) => (
    lista.map(registro => ({
      ...registro,
      dependencia: registro.dependencia || dependencia
    }))
  ));
}

function obtenerParametrosPeriodo(tipoInforme, modo, anio, mes, fechaDesde, fechaHasta) {
  if (modo === 'month' || modo === 'year') {
    const inicio = modo === 'month'
      ? `${anio}-${mes}-01`
      : `${anio}-01-01`;
    const fechaFin = modo === 'month'
      ? new Date(Number(anio), Number(mes), 0)
      : new Date(Number(anio), 11, 31);
    const fin = `${fechaFin.getFullYear()}-${String(fechaFin.getMonth() + 1).padStart(2, '0')}-${String(fechaFin.getDate()).padStart(2, '0')}`;
    return { inicio, fin };
  }

  if (tipoInforme === 'auditoria') {
    throw new Error('El informe de auditoría permite filtrar por mes o año.');
  }
  return { inicio: fechaDesde, fin: fechaHasta };
}

function filtrarRegistros({ tipoInforme, modo, anio, mes, fechaDesde, fechaHasta, dependencias }) {
  const periodo = obtenerParametrosPeriodo(tipoInforme, modo, anio, mes, fechaDesde, fechaHasta);
  return obtenerRegistros()
    .filter(registro => {
      const fecha = normalizarFecha(registro.fechaRadicacion);
      return fecha && fecha >= periodo.inicio && fecha <= periodo.fin
        && (dependencias.length === 0 || dependencias.includes(registro.dependencia));
    })
    .sort((a, b) => (
      normalizarFecha(a.fechaRadicacion).localeCompare(normalizarFecha(b.fechaRadicacion))
      || String(a.radicado || '').localeCompare(String(b.radicado || ''), 'es')
    ));
}

function obtenerNombreDependencias(registros, todasDependencias) {
  if (todasDependencias) return 'Todas las dependencias';
  return [...new Set(registros.map(registro => registro.dependencia))].join(', ');
}

function seleccionarMuestraAleatoria(registros, cantidad) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('El navegador no permite seleccionar una muestra aleatoria segura.');
  }

  const seleccionables = [...registros];
  for (let indice = 0; indice < cantidad; indice += 1) {
    const limite = 0x100000000 - (0x100000000 % (seleccionables.length - indice));
    const valorAleatorio = new Uint32Array(1);
    do {
      globalThis.crypto.getRandomValues(valorAleatorio);
    } while (valorAleatorio[0] >= limite);
    const indiceAleatorio = indice + (valorAleatorio[0] % (seleccionables.length - indice));
    [seleccionables[indice], seleccionables[indiceAleatorio]] =
      [seleccionables[indiceAleatorio], seleccionables[indice]];
  }

  return seleccionables.slice(0, cantidad);
}

function respuestaEnFecha(registro) {
  return normalizarFecha(registro.fechaCargaRespuesta);
}

function fechaActualBogota() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function esRespuestaOportuna(registro) {
  const respuesta = respuestaEnFecha(registro);
  const limite = normalizarFecha(registro.fechaVencimiento);
  if (!limite) return false;
  if (respuesta) return respuesta <= limite;

  const estado = obtenerEstado(registro).clase;
  const sigueEnGestion = ['status-tramite', 'status-vigente', 'status-proximo'].includes(estado);
  return sigueEnGestion && fechaActualBogota() <= limite;
}

function textoOportunidad(registro) {
  const respuesta = respuestaEnFecha(registro);
  const limite = normalizarFecha(registro.fechaVencimiento);
  if (!limite) return respuesta ? 'Sin fecha límite' : 'Vencido/Pendiente';
  if (!respuesta) return esRespuestaOportuna(registro) ? 'A Tiempo' : 'Vencido/Pendiente';
  return respuesta <= limite ? 'A Tiempo' : 'Extemporáneo';
}

function esQueja(registro) {
  return normalizarTexto(registro.tipoPeticion) === 'queja';
}

function asuntoReiterativo(registro) {
  return /reiterativ|reiteraci|reincidente|recurrente/.test(
    normalizarTexto(`${registro.asunto || ''} ${registro.observaciones || ''} ${registro.otrosEstados || ''}`)
  );
}

function tokensAsunto(registro) {
  return new Set(
    normalizarTexto(registro.asunto)
      .split(' ')
      .filter(token => token.length > 2 && !PALABRAS_COMUNES.has(token))
  );
}

function sonAsuntosSimilares(asuntoA, asuntoB, tokensA, tokensB) {
  if (asuntoA && asuntoA === asuntoB) return true;
  if (tokensA.size < 2 || tokensB.size < 2) return false;
  const coincidencias = [...tokensA].filter(token => tokensB.has(token)).length;
  const union = tokensA.size + tokensB.size - coincidencias;
  return union > 0 && coincidencias / union >= 0.7;
}

function cantidadQuejasReincidentes(registros) {
  const quejas = registros.filter(esQueja);
  const asuntos = quejas.map(registro => normalizarTexto(registro.asunto));
  const tokens = quejas.map(tokensAsunto);
  const visitadas = new Set();
  const adyacencias = quejas.map((_, indice) => (
    asuntoReiterativo(quejas[indice]) ? [indice] : []
  ));

  for (let indice = 0; indice < quejas.length; indice += 1) {
    for (let otro = indice + 1; otro < quejas.length; otro += 1) {
      if (sonAsuntosSimilares(asuntos[indice], asuntos[otro], tokens[indice], tokens[otro])) {
        adyacencias[indice].push(otro);
        adyacencias[otro].push(indice);
      }
    }
  }

  adyacencias.forEach((vecinos, inicial) => {
    if (visitadas.has(inicial) || vecinos.length === 0) return;
    const grupo = [];
    const pendientes = [inicial];
    visitadas.add(inicial);
    while (pendientes.length) {
      const actual = pendientes.pop();
      grupo.push(actual);
      adyacencias[actual].forEach(vecino => {
        if (!visitadas.has(vecino)) {
          visitadas.add(vecino);
          pendientes.push(vecino);
        }
      });
    }
    if (grupo.length > 1 || asuntoReiterativo(quejas[inicial])) {
      grupo.forEach(indice => visitadas.add(indice));
    } else {
      visitadas.delete(inicial);
    }
  });

  return visitadas.size;
}

function esRequiereRespuesta(registro) {
  const otrosEstados = normalizarTexto(registro.otrosEstados);
  return !otrosEstados.includes('para conocimiento')
    && !otrosEstados.includes('no requiere respuesta')
    && !(Array.isArray(registro.dependenciasDestino) && registro.dependenciasDestino.length > 0)
    && normalizarTexto(registro.estado) !== 'r por c';
}

function esResuelto(registro) {
  return obtenerEstado(registro).clase === 'status-cerrado' && esRequiereRespuesta(registro);
}

function calcularIndicadoresAuditoria(registros, dependenciasInforme) {
  const respondidasATiempo = registros.filter(esRespuestaOportuna).length;
  const quejas = registros.filter(esQueja).length;
  const quejasReincidentes = cantidadQuejasReincidentes(registros);
  const respuestasConFechas = registros
    .map(registro => {
      const recepcion = convertirAFechaUtc(registro.fechaRadicacion);
      const respuesta = convertirAFechaUtc(registro.fechaCargaRespuesta);
      return recepcion === null || respuesta === null ? null : (respuesta - recepcion) / DIAS_EN_MILISEGUNDOS;
    })
    .filter(dias => dias !== null && dias >= 0);
  const eficaciaPorDependencia = dependenciasInforme.map(dependencia => {
    const asignadas = registros.filter(registro => registro.dependencia === dependencia);
    return {
      dependencia,
      eficacia: asignadas.length ? asignadas.filter(esResuelto).length / asignadas.length : null
    };
  });

  return {
    oportunidad: respondidasATiempo / registros.length,
    reincidencia: quejas ? quejasReincidentes / quejas : 0,
    quejas,
    quejasReincidentes,
    eficaciaPorDependencia,
    tiempoPromedio: respuestasConFechas.length
      ? respuestasConFechas.reduce((total, dias) => total + dias, 0) / respuestasConFechas.length
      : null
  };
}

function clonarEstilo(estilo) {
  return JSON.parse(JSON.stringify(estilo || {}));
}

function establecerFuenteNormal(celda) {
  celda.font = { ...(celda.font || {}), bold: false };
}

function prepararFila(hoja, numeroFila, filaModelo, columnas, columnasTexto = []) {
  const fila = hoja.getRow(numeroFila);
  columnas.forEach(columna => {
    const celda = fila.getCell(columna);
    celda.style = clonarEstilo(filaModelo.getCell(columna).style);
    establecerFuenteNormal(celda);
    if (columnasTexto.includes(columna)) {
      celda.alignment = {
        ...celda.alignment,
        vertical: 'middle',
        wrapText: true,
        shrinkToFit: false
      };
    }
  });
  if (filaModelo.height) fila.height = filaModelo.height;
  return fila;
}

function ajustarAlturaFila(fila, columnasTexto) {
  const maxLineas = columnasTexto.reduce((lineasMaximas, columna) => {
    const texto = String(fila.getCell(columna).value || '').trim();
    if (!texto) return lineasMaximas;

    const ancho = Math.max(1, Math.floor(fila.worksheet.getColumn(columna).width || 10));
    const lineasTexto = texto.split('\n').reduce((total, linea) => {
      let lineas = 1;
      let anchoLinea = 0;
      linea.split(/\s+/).forEach(palabra => {
        const anchoPalabra = Array.from(palabra).length;
        if (anchoPalabra > ancho) {
          if (anchoLinea) {
            lineas += 1;
            anchoLinea = 0;
          }
          const lineasPalabra = Math.ceil(anchoPalabra / ancho);
          lineas += lineasPalabra - 1;
          anchoLinea = anchoPalabra % ancho;
          return;
        }
        if (anchoLinea && anchoLinea + 1 + anchoPalabra > ancho) {
          lineas += 1;
          anchoLinea = anchoPalabra;
        } else {
          anchoLinea += (anchoLinea ? 1 : 0) + anchoPalabra;
        }
      });
      return total + lineas;
    }, 0);

    return Math.max(lineasMaximas, lineasTexto);
  }, 1);
  const altoMinimo = fila.height || 15;
  fila.height = Math.max(altoMinimo, maxLineas * 15 + 4);
}

function establecerFechaCelda(celda, fecha) {
  celda.value = fechaExcel(fecha);
  celda.numFmt = 'dd-mm-yyyy';
}

function resumenDependencias(dependencias) {
  return dependencias.length ? dependencias.join('\n') : 'Sin PQRS en la muestra';
}

async function cargarPlantilla(tipo) {
  const [ExcelJS, respuestaPlantilla] = await Promise.all([
    cargarExcelJs(),
    fetch(PLANTILLAS[tipo])
  ]);
  if (!respuestaPlantilla.ok) {
    throw new Error(`No fue posible abrir la plantilla (${respuestaPlantilla.status}).`);
  }
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await respuestaPlantilla.arrayBuffer());
  return libro;
}

function descargarLibro(libro, nombreArchivo) {
  return libro.xlsx.writeBuffer().then(contenido => {
    const url = URL.createObjectURL(new Blob([contenido], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function generarInformeAuditoria(registros, registrosPeriodo, dependencias, todasDependencias) {
  const libro = await cargarPlantilla('auditoria');
  const matriz = libro.getWorksheet('MATRIZ DE SEGUIMIENTO');
  const indicadores = libro.getWorksheet('INDICADORES DE GESTION');
  if (!matriz || !indicadores) {
    throw new Error('La plantilla de auditoría debe contener la matriz y la hoja de indicadores.');
  }

  matriz.getCell('C5').value = capitalizarTexto(obtenerNombreDependencias(registros, todasDependencias));
  establecerFuenteNormal(matriz.getCell('C5'));
  const filaModelo = matriz.getRow(7);
  registros.forEach((registro, indice) => {
    const columnasTexto = ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L', 'M'];
    const fila = prepararFila(matriz, indice + 7, filaModelo, Array.from({ length: 13 }, (_, col) => col + 1), columnasTexto);
    fila.getCell('A').value = registro.radicado || '';
    establecerFechaCelda(fila.getCell('B'), registro.fechaRadicacion);
    fila.getCell('C').value = capitalizarTexto(registro.tipoPeticion);
    fila.getCell('D').value = capitalizarTexto(registro.tipoCanal);
    fila.getCell('E').value = capitalizarTexto(registro.remitente);
    fila.getCell('F').value = capitalizarTexto(registro.asunto);
    fila.getCell('G').value = capitalizarTexto(registro.dependencia);
    fila.getCell('H').value = capitalizarTexto(registro.funcionarioAsignado);
    establecerFechaCelda(fila.getCell('I'), registro.fechaVencimiento);
    establecerFechaCelda(fila.getCell('J'), registro.fechaCargaRespuesta);
    fila.getCell('K').value = capitalizarTexto(obtenerEstado(registro).texto);
    fila.getCell('L').value = textoOportunidad(registro);
    fila.getCell('M').value = '';
    ajustarAlturaFila(fila, columnasTexto);
  });

  const dependenciasInforme = todasDependencias
    ? Object.keys(datosRadicados)
    : dependencias;
  const metricas = calcularIndicadoresAuditoria(registrosPeriodo, dependenciasInforme);
  indicadores.getCell('E4').value = metricas.oportunidad;
  establecerFuenteNormal(indicadores.getCell('E4'));
  indicadores.getCell('E4').numFmt = '0.00%';
  indicadores.getCell('E5').value = metricas.reincidencia;
  establecerFuenteNormal(indicadores.getCell('E5'));
  indicadores.getCell('E5').numFmt = '0.00%';
  const celdaEficacia = indicadores.getCell('E6');
  celdaEficacia.value = resumenDependencias(metricas.eficaciaPorDependencia.map(({ dependencia, eficacia }) => (
    `${capitalizarTexto(dependencia)}: ${eficacia === null ? 'No evaluada (sin muestra)' : `${(eficacia * 100).toFixed(2)}%`}`
  )));
  establecerFuenteNormal(celdaEficacia);
  celdaEficacia.alignment = {
    ...celdaEficacia.alignment,
    vertical: 'middle',
    wrapText: true
  };
  indicadores.getRow(6).height = Math.max(30, metricas.eficaciaPorDependencia.length * 18);
  const celdaTiempo = indicadores.getCell('E7');
  celdaTiempo.value = metricas.tiempoPromedio;
  establecerFuenteNormal(celdaTiempo);
  celdaTiempo.numFmt = metricas.tiempoPromedio === null ? 'General' : '0.00 "días"';
  const fechaArchivo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
  return descargarLibro(libro, `Informe_PQRS_Auditoria_${fechaArchivo}.xlsx`);
}

function obtenerConteoGeneral(registros) {
  return registros.reduce((conteo, registro) => {
    const otrosEstados = normalizarTexto(registro.otrosEstados);
    const estado = obtenerEstado(registro).clase;
    const esConocimiento = otrosEstados.includes('para conocimiento');
    const esSinRespuesta = otrosEstados.includes('no requiere respuesta');
    const esRemitido = normalizarTexto(registro.estado) === 'r por c'
      || (Array.isArray(registro.dependenciasDestino) && registro.dependenciasDestino.length > 0);
    const esEspecial = esConocimiento || esSinRespuesta || esRemitido;

    if (estado === 'status-cerrado' && !esEspecial) conteo.cerrados += 1;
    if (['status-vigente', 'status-proximo', 'status-extemporanea'].includes(estado) && !esEspecial) {
      conteo.vigentes += 1;
    }
    if (estado === 'status-tramite' && !esEspecial) conteo.enTramite += 1;
    if (esConocimiento) conteo.paraConocimiento += 1;
    if (esRemitido) conteo.remitidos += 1;
    if (esSinRespuesta) conteo.noRequierenRespuesta += 1;
    conteo.recibidos += 1;
    return conteo;
  }, {
    cerrados: 0,
    vigentes: 0,
    enTramite: 0,
    paraConocimiento: 0,
    remitidos: 0,
    noRequierenRespuesta: 0,
    recibidos: 0
  });
}

async function generarInformeGeneral(registros, dependencias, todasDependencias) {
  const libro = await cargarPlantilla('general');
  const hoja = libro.getWorksheet('INFORME GENERAL');
  if (!hoja) throw new Error('La plantilla general no contiene la hoja “INFORME GENERAL”.');

  hoja.getCell('C5').value = capitalizarTexto(obtenerNombreDependencias(registros, todasDependencias));
  establecerFuenteNormal(hoja.getCell('C5'));
  const filaModelo = hoja.getRow(7);
  const dependenciasInforme = todasDependencias
    ? Object.keys(datosRadicados)
    : dependencias;
  const datosPorDependencia = dependenciasInforme.map(dependencia => [
        dependencia,
        obtenerConteoGeneral(registros.filter(registro => registro.dependencia === dependencia))
      ]);

  datosPorDependencia.forEach(([dependencia, totales], indice) => {
    const columnasTexto = ['A'];
    const fila = prepararFila(hoja, indice + 7, filaModelo, 'ABCDEFGH'.split(''), columnasTexto);
    fila.getCell('A').value = capitalizarTexto(dependencia);
    fila.getCell('B').value = totales.cerrados;
    fila.getCell('C').value = totales.vigentes;
    fila.getCell('D').value = totales.enTramite;
    fila.getCell('E').value = totales.paraConocimiento;
    fila.getCell('F').value = totales.remitidos;
    fila.getCell('G').value = totales.noRequierenRespuesta;
    fila.getCell('H').value = totales.recibidos;
    ajustarAlturaFila(fila, columnasTexto);
    'BCDEFGH'.split('').forEach(columna => {
      fila.getCell(columna).numFmt = '0';
    });
  });

  const ultimaFilaTotal = Math.max(6 + datosPorDependencia.length, hoja.rowCount);
  for (let numeroFila = 6; numeroFila <= ultimaFilaTotal; numeroFila += 1) {
    const celdaTotalRecibidos = hoja.getCell(`H${numeroFila}`);
    celdaTotalRecibidos.font = {
      ...celdaTotalRecibidos.font,
      bold: true,
      size: 12
    };
  }

  const fechaArchivo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
  return descargarLibro(libro, `Informe_PQRS_General_${fechaArchivo}.xlsx`);
}

export function inicializarExportacionInformes() {
  const modal = document.getElementById('modalInformePqrs');
  const formulario = document.getElementById('formInformePqrs');
  const botonAbrir = document.getElementById('abrirInformesPqrs');
  const botonCerrar = document.getElementById('cerrarModalInformePqrs');
  const botonCancelar = document.getElementById('cancelarInformePqrs');
  const botonGenerar = document.getElementById('confirmarInformePqrs');
  const tipoInforme = document.getElementById('tipoInformePqrs');
  const periodo = document.getElementById('periodoTipoInformePqrs');
  const mes = document.getElementById('mesInformePqrs');
  const anio = document.getElementById('anioInformePqrs');
  const fechaDesde = document.getElementById('fechaDesdeInformePqrs');
  const fechaHasta = document.getElementById('fechaHastaInformePqrs');
  const todasDependencias = document.getElementById('todasDependenciasInformePqrs');
  const contenedorDependencias = document.getElementById('dependenciasInformePqrs');
  const campoMes = document.getElementById('campoMesInformePqrs');
  const camposMesAnio = document.getElementById('periodoMesAnioPqrs');
  const camposRango = document.getElementById('periodoRangoPqrs');
  const seccionMuestra = document.getElementById('muestraAuditoriaPqrs');
  const cantidadMuestra = document.getElementById('cantidadMuestraAuditoriaPqrs');
  const totalMuestra = document.getElementById('totalMuestraAuditoriaPqrs');
  const error = document.getElementById('errorInformePqrs');
  if (!modal || !formulario || !botonAbrir || !tipoInforme || !periodo) return;

  const controlesDependencias = Object.keys(datosRadicados).map((dependencia, indice) => {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'received-register-dependency-option';
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.value = dependencia;
    casilla.id = `dependenciaInformePqrs${indice}`;
    casilla.disabled = true;
    const nombre = document.createElement('span');
    nombre.textContent = dependencia;
    etiqueta.append(casilla, nombre);
    contenedorDependencias.append(etiqueta);
    return casilla;
  });

  function leerSeleccion() {
    return {
      tipoInforme: tipoInforme.value,
      modo: periodo.value,
      anio: anio.value,
      mes: mes.value,
      fechaDesde: fechaDesde.value,
      fechaHasta: fechaHasta.value,
      todas: todasDependencias.checked,
      dependencias: todasDependencias.checked
        ? []
        : controlesDependencias.filter(casilla => casilla.checked).map(casilla => casilla.value)
    };
  }

  function actualizarEstadoDependencias() {
    controlesDependencias.forEach(casilla => {
      casilla.disabled = todasDependencias.checked;
      if (todasDependencias.checked) casilla.checked = false;
      casilla.parentElement.classList.toggle('is-disabled', casilla.disabled);
    });
  }

  function actualizarCamposPeriodo() {
    const esAuditoria = tipoInforme.value === 'auditoria';
    Array.from(periodo.options).forEach(opcion => {
      const permitida = !esAuditoria || ['year', 'month'].includes(opcion.value);
      opcion.disabled = !permitida;
      opcion.hidden = !permitida;
    });
    if (esAuditoria && !['year', 'month'].includes(periodo.value)) periodo.value = 'year';
    const esMes = periodo.value === 'month';
    const esRango = ['quarter', 'semester', 'range'].includes(periodo.value);
    campoMes.hidden = !esMes;
    mes.required = esMes;
    anio.required = !esRango;
    camposMesAnio.hidden = esRango;
    camposRango.hidden = !esRango;
    fechaDesde.required = esRango;
    fechaHasta.required = esRango;
    seccionMuestra.hidden = !esAuditoria;
    cantidadMuestra.required = esAuditoria;
    actualizarConteoMuestra();
  }

  function actualizarConteoMuestra() {
    if (!totalMuestra) return;
    const seleccion = leerSeleccion();
    if (seleccion.modo !== 'year' && seleccion.modo !== 'month'
      && (!seleccion.fechaDesde || !seleccion.fechaHasta || seleccion.fechaDesde > seleccion.fechaHasta)) {
      totalMuestra.textContent = 'Indica un rango de fechas válido para calcular las PQRS disponibles.';
      cantidadMuestra.max = '';
      return;
    }

    try {
      const registros = filtrarRegistros(seleccion);
      totalMuestra.textContent = `${registros.length} PQRS disponibles. La matriz usará la muestra seleccionada y los indicadores se calcularán con todas las PQRS del periodo y las dependencias elegidas.`;
      cantidadMuestra.max = String(Math.max(1, registros.length));
    } catch (errorPeriodo) {
      totalMuestra.textContent = errorPeriodo.message;
    }
  }

  function cerrar() {
    modal.close();
  }

  todasDependencias.addEventListener('change', () => {
    actualizarEstadoDependencias();
    actualizarConteoMuestra();
  });
  controlesDependencias.forEach(casilla => casilla.addEventListener('change', actualizarConteoMuestra));
  tipoInforme.addEventListener('change', actualizarCamposPeriodo);
  periodo.addEventListener('change', actualizarCamposPeriodo);
  [mes, anio, fechaDesde, fechaHasta].forEach(control => {
    control.addEventListener('change', actualizarConteoMuestra);
    control.addEventListener('input', actualizarConteoMuestra);
  });
  botonAbrir.addEventListener('click', () => {
    formulario.reset();
    tipoInforme.value = 'auditoria';
    periodo.value = 'year';
    mes.value = String(new Date().getMonth() + 1).padStart(2, '0');
    anio.value = String(new Date().getFullYear());
    todasDependencias.checked = true;
    cantidadMuestra.value = '1';
    actualizarEstadoDependencias();
    actualizarCamposPeriodo();
    error.hidden = true;
    modal.showModal();
    tipoInforme.focus();
  });
  botonCerrar?.addEventListener('click', cerrar);
  botonCancelar?.addEventListener('click', cerrar);

  formulario.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    if (!formulario.reportValidity()) return;

    const seleccion = leerSeleccion();
    if (!seleccion.todas && seleccion.dependencias.length === 0) {
      error.textContent = 'Selecciona al menos una dependencia o marca “Todas las dependencias”.';
      error.hidden = false;
      return;
    }
    if (['quarter', 'semester', 'range'].includes(seleccion.modo)
      && seleccion.fechaDesde > seleccion.fechaHasta) {
      error.textContent = 'La fecha inicial debe ser menor o igual a la fecha final.';
      error.hidden = false;
      return;
    }

    let registros;
    try {
      registros = filtrarRegistros(seleccion);
    } catch (errorPeriodo) {
      error.textContent = errorPeriodo.message;
      error.hidden = false;
      return;
    }
    if (registros.length === 0 && seleccion.tipoInforme === 'auditoria') {
      error.textContent = 'No se encontraron PQRS para el periodo y las dependencias seleccionadas.';
      error.hidden = false;
      return;
    }

    if (seleccion.tipoInforme === 'auditoria'
      && (!Number.isInteger(Number(cantidadMuestra.value))
        || Number(cantidadMuestra.value) < 1
        || Number(cantidadMuestra.value) > registros.length)) {
      error.textContent = `La cantidad de la muestra debe estar entre 1 y ${registros.length}.`;
      error.hidden = false;
      return;
    }

    let registrosInforme = registros;
    if (seleccion.tipoInforme === 'auditoria') {
      try {
        registrosInforme = seleccionarMuestraAleatoria(registros, Number(cantidadMuestra.value));
      } catch (errorMuestra) {
        error.textContent = errorMuestra.message || 'No fue posible seleccionar una muestra aleatoria.';
        error.hidden = false;
        return;
      }
    }

    botonGenerar.disabled = true;
    botonGenerar.setAttribute('aria-busy', 'true');
    botonGenerar.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Preparando informe…';
    try {
      if (seleccion.tipoInforme === 'auditoria') {
        await generarInformeAuditoria(
          registrosInforme,
          registros,
          seleccion.dependencias,
          seleccion.todas
        );
      } else {
        await generarInformeGeneral(registrosInforme, seleccion.dependencias, seleccion.todas);
      }
      cerrar();
    } catch (errorGeneracion) {
      console.error('Error al generar el informe PQRS:', errorGeneracion);
      error.textContent = errorGeneracion.message || 'No fue posible generar el informe.';
      error.hidden = false;
    } finally {
      botonGenerar.disabled = false;
      botonGenerar.removeAttribute('aria-busy');
      botonGenerar.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i> Descargar informe Excel';
    }
  });
}
