import { datosRadicados } from '../../data/radicados.js';
import { abreviarNombreDependencia, evaluarEstadoAutomatico } from '../../utils/helpers.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/+esm';
const COLORES_GRAFICA = [
  '#078c4b', '#24ad6a', '#53c78a', '#82d8a8', '#b0e8c4', '#e3b341',
  '#ee9850', '#e97868', '#8e81d5', '#6193d3', '#48aab0', '#91aa65'
];
let registrosIAS = [];
let origen = 'dependencias';
let estadoCargaIAS = 'loading';
let estadoCargaDependencias = 'loading';
let ChartClass = null;
let estadoChart = 'loading';
let promesaChart = null;
const graficas = { ranking: null, grupos: null, tendencia: null };

function obtenerFechaIAS(registro) {
  return String(
    registro.fechaRadicacion
    || registro.fechaGeneracion
    || registro.fecha
    || registro.creadoEn
    || ''
  ).slice(0, 10);
}

function obtenerEstadoDependencia(registro) {
  return evaluarEstadoAutomatico(
    registro.fechaVencimiento,
    registro.respuestaUrl,
    registro.otrosEstados,
    registro.estado
  );
}

function estaResueltoIAS(registro) {
  const estado = String(registro.estado || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO');
  return /\b(cerrado|cerrada|resuelto|resuelta|finalizado|finalizada)\b/.test(estado);
}

function obtenerRegistros(origenSeleccionado = origen) {
  if (origenSeleccionado === 'ias') {
    return registrosIAS.map(registro => ({
      registro,
      fecha: obtenerFechaIAS(registro),
      grupo: String(registro.entidadIAS || registro.entidad || registro.ente || 'Entidad sin clasificar'),
      resuelto: estaResueltoIAS(registro),
      vencido: false
    }));
  }

  return Object.values(datosRadicados).flat().map(registro => {
    const estado = obtenerEstadoDependencia(registro);
    return {
      registro,
      fecha: String(registro.fechaRadicacion || '').slice(0, 10),
      grupo: String(registro.dependencia || 'Dependencia sin clasificar'),
      resuelto: estado.clase === 'status-cerrado',
      vencido: estado.clase === 'status-extemporanea'
    };
  });
}

function leerPeriodo() {
  return {
    ano: document.getElementById('filtroAnoInformes')?.value || String(new Date().getFullYear()),
    mes: document.getElementById('filtroMesInformes')?.value || ''
  };
}

function coincidePeriodo(registro, { ano, mes }) {
  return /^\d{4}-\d{2}-\d{2}$/.test(registro.fecha)
    && registro.fecha.slice(0, 4) === ano
    && (!mes || registro.fecha.slice(5, 7) === mes);
}

function crearCelda(texto, etiqueta = 'td') {
  const celda = document.createElement(etiqueta);
  celda.textContent = texto;
  return celda;
}

function actualizarFiltroAnios() {
  const selector = document.getElementById('filtroAnoInformes');
  if (!selector) return;
  const seleccionado = selector.value;
  const anos = new Set([String(new Date().getFullYear())]);
  [...obtenerRegistros('dependencias'), ...obtenerRegistros('ias')].forEach(registro => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(registro.fecha)) anos.add(registro.fecha.slice(0, 4));
  });
  selector.replaceChildren(
    ...[...anos].sort((a, b) => b.localeCompare(a)).map(ano => new Option(ano, ano))
  );
  selector.value = anos.has(seleccionado) ? seleccionado : String(new Date().getFullYear());
}

function renderizarIndicadores(registros, periodo) {
  const resueltos = registros.filter(registro => registro.resuelto).length;
  const pendientes = registros.length - resueltos;
  const porcentaje = cantidad => registros.length
    ? Math.round(cantidad / registros.length * 100)
    : 0;
  const actualizarProgreso = (id, cantidad) => {
    const progreso = document.getElementById(id);
    const valor = porcentaje(cantidad);
    progreso.setAttribute('aria-valuenow', String(valor));
    progreso.setAttribute('aria-valuetext', `${valor}% del total`);
    progreso.firstElementChild.style.width = `${valor}%`;
  };
  document.getElementById('informeTotal').textContent = String(registros.length);
  document.getElementById('informePendientes').textContent = String(pendientes);
  document.getElementById('informeResueltos').textContent = String(resueltos);
  document.getElementById('informePendientesDetalle').textContent =
    `${porcentaje(pendientes)}% del total · Sin respuesta`;
  document.getElementById('informeResueltosDetalle').textContent =
    `${porcentaje(resueltos)}% del total · Con respuesta`;
  actualizarProgreso('informePendientesProgreso', pendientes);
  actualizarProgreso('informeResueltosProgreso', resueltos);
  document.getElementById('informePeriodo').textContent = periodo.mes
    ? `${new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(2000, Number(periodo.mes) - 1, 1))} de ${periodo.ano}`
    : `Todo ${periodo.ano}`;

  const tituloExtra = document.getElementById('informeExtraTitulo');
  const descripcionExtra = document.getElementById('informeExtraDescripcion');
  const iconoExtra = document.getElementById('informeExtraIcono');
  const columnaExtra = document.getElementById('informeColumnaExtra');
  const valorExtra = origen === 'ias'
    ? new Set(registros.map(registro => registro.grupo)).size
    : registros.filter(registro => registro.vencido).length;

  tituloExtra.textContent = origen === 'ias' ? 'Entidades' : 'Vencidos';
  descripcionExtra.textContent = origen === 'ias' ? 'Entidades con radicados' : 'Radicados extemporáneos';
  iconoExtra.className = `bi ${origen === 'ias' ? 'bi-bank' : 'bi-exclamation-circle'}`;
  columnaExtra.textContent = origen === 'ias' ? 'Entidades' : 'Vencidos';
  document.getElementById('informeExtra').textContent = String(valorExtra);
  const progresoExtra = document.getElementById('informeExtraProgreso');
  progresoExtra.hidden = origen === 'ias';
  progresoExtra.setAttribute('aria-label', 'Porcentaje de radicados vencidos');
  actualizarProgreso('informeExtraProgreso', origen === 'ias' ? 0 : valorExtra);
}

function actualizarAvisoGraficas() {
  const aviso = document.getElementById('informeGraficasAviso');
  if (!aviso) return;
  aviso.hidden = estadoChart === 'loaded';
  aviso.textContent = estadoChart === 'error'
    ? 'No fue posible cargar las gráficas. Comprueba tu conexión e inténtalo de nuevo.'
    : 'Cargando gráficas…';
}

function cargarChartJs() {
  if (promesaChart) return promesaChart;
  promesaChart = import(CHART_JS_URL)
    .then(modulo => {
      if (typeof modulo.Chart !== 'function' || !Array.isArray(modulo.registerables)) {
        throw new TypeError('Chart.js no expuso su constructor Chart.');
      }
      modulo.Chart.register(...modulo.registerables);
      return modulo.Chart;
    })
    .catch(error => {
      estadoChart = 'error';
      console.error('No fue posible cargar Chart.js para los informes.', error);
      actualizarAvisoGraficas();
      return null;
    });
  promesaChart.then(Chart => {
    if (!Chart) return;
    ChartClass = Chart;
    ChartClass.defaults.font.family = 'Inter, sans-serif';
    ChartClass.defaults.color = '#728196';
    estadoChart = 'loaded';
    actualizarInformes();
    if (document.getElementById('pantallaInformes')?.style.display !== 'none') {
      redimensionarGraficasInformes();
    }
  });
  return promesaChart;
}

function actualizarAvisoIAS() {
  const aviso = document.getElementById('informeIASAviso');
  if (!aviso) return;
  const estadoCarga = origen === 'ias' ? estadoCargaIAS : estadoCargaDependencias;
  const totalRegistros = origen === 'ias' ? registrosIAS.length : obtenerRegistros('dependencias').length;
  const mostrarAviso = estadoCarga === 'loading'
    || estadoCarga === 'error'
    || (estadoCarga === 'loaded' && origen === 'ias' && totalRegistros === 0);
  aviso.hidden = !mostrarAviso;
  if (!mostrarAviso) return;
  aviso.textContent = estadoCarga === 'loading'
    ? `Cargando radicados de ${origen === 'ias' ? 'IAS' : 'Dependencias'}…`
    : estadoCarga === 'error'
      ? `No fue posible cargar los radicados de ${origen === 'ias' ? 'IAS' : 'Dependencias'}. Revisa la conexión e inténtalo de nuevo.`
      : 'Aún no hay radicados IAS disponibles para generar informes.';
}

function agruparRegistros(registros) {
  const grupos = new Map();
  registros.forEach(({ grupo }) => grupos.set(grupo, (grupos.get(grupo) || 0) + 1));
  return [...grupos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
}

function informesVisibles() {
  return document.getElementById('pantallaInformes')?.style.display !== 'none';
}

function dividirEtiqueta(etiqueta, limite = 9) {
  const lineas = [];
  let linea = '';
  String(etiqueta).split(/\s+/).forEach(palabra => {
    if (linea && `${linea} ${palabra}`.length > limite) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = linea ? `${linea} ${palabra}` : palabra;
    }
  });
  if (linea) lineas.push(linea);
  return lineas;
}

function renderizarRanking(registros) {
  const canvas = document.getElementById('informeRanking');
  const lista = agruparRegistros(registros);
  const hayDatos = lista.length > 0;
  const puedeMostrar = hayDatos && ChartClass && informesVisibles();
  canvas.hidden = !puedeMostrar;
  canvas.parentElement.style.height = `${Math.min(360, Math.max(270, lista.length * 18 + 130))}px`;
  document.getElementById('informeRankingVacio').hidden = hayDatos;
  canvas.setAttribute('aria-label', `Radicados por ${origen === 'ias' ? 'IAS' : 'Dependencia'}`);
  if (!puedeMostrar) return;

  const labels = lista.map(([nombre]) => (
    origen === 'dependencias' ? abreviarNombreDependencia(nombre) : nombre
  ));
  const valores = lista.map(([, total]) => total);
  const maximo = Math.max(...valores);
  if (!graficas.ranking) {
    graficas.ranking = new ChartClass(canvas, {
      type: 'bar',
      data: { labels, datasets: [{
        label: 'Radicados',
        data: valores,
        backgroundColor: valores.map((_, indice) => COLORES_GRAFICA[indice % COLORES_GRAFICA.length]),
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 34,
        categoryPercentage: 0.72,
        barPercentage: 0.78
      }] },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: contexto => `${contexto.parsed.y} radicados` } }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              padding: 5,
              font: { size: 9 },
              callback(valor) {
                return dividirEtiqueta(this.getLabelForValue(valor));
              }
            }
          },
          y: {
            beginAtZero: true,
            max: maximo + Math.max(1, Math.ceil(maximo * 0.12)),
            ticks: { precision: 0, stepSize: 1 },
            grid: { color: '#edf2ef', drawBorder: false }
          }
        },
        layout: {
          padding: { top: 9, bottom: 1 }
        }
      },
      plugins: [{
        id: 'report-bar-values',
        afterDatasetsDraw(chart) {
          const contexto = chart.ctx;
          contexto.save();
          contexto.font = '600 10px Inter, sans-serif';
          contexto.fillStyle = '#344b60';
          contexto.textAlign = 'center';
          contexto.textBaseline = 'bottom';
          chart.getDatasetMeta(0).data.forEach((barra, indice) => {
            contexto.fillText(String(chart.data.datasets[0].data[indice]), barra.x, barra.y - 5);
          });
          contexto.restore();
        }
      }]
    });
  } else {
    graficas.ranking.data.labels = labels;
    graficas.ranking.data.datasets[0].data = valores;
    graficas.ranking.data.datasets[0].backgroundColor =
      valores.map((_, indice) => COLORES_GRAFICA[indice % COLORES_GRAFICA.length]);
    graficas.ranking.options.scales.y.max = maximo + Math.max(1, Math.ceil(maximo * 0.12));
    graficas.ranking.update();
  }
}

function renderizarGraficaIAS() {
  const canvas = document.getElementById('informeIASGrafica');
  const leyenda = document.getElementById('informeIASLeyenda');
  const periodo = leerPeriodo();
  const registros = obtenerRegistros('ias').filter(registro => coincidePeriodo(registro, periodo));
  const lista = agruparRegistros(registros);
  const hayDatos = lista.length > 0;
  const puedeMostrar = hayDatos && ChartClass && informesVisibles();
  canvas.hidden = !puedeMostrar;
  leyenda.hidden = !puedeMostrar;
  const avisoVacio = document.getElementById('informeIASVacio');
  avisoVacio.hidden = hayDatos;
  avisoVacio.textContent = estadoCargaIAS === 'loading'
    ? 'Cargando radicados IAS…'
    : estadoCargaIAS === 'error'
      ? 'No fue posible cargar los radicados IAS.'
      : 'No hay radicados IAS para mostrar en este periodo.';
  canvas.setAttribute('aria-label', 'Participación de radicados por IAS');

  if (!puedeMostrar) {
    leyenda.replaceChildren();
    return;
  }

  const labels = lista.map(([nombre]) => nombre);
  const valores = lista.map(([, total]) => total);
  const colores = valores.map((_, indice) => COLORES_GRAFICA[indice % COLORES_GRAFICA.length]);
  leyenda.replaceChildren(...lista.map(([nombre, total], indice) => {
    const item = document.createElement('li');
    item.title = `${nombre}: ${total} radicados`;
    const muestra = document.createElement('span');
    muestra.className = 'report-donut-swatch';
    muestra.style.backgroundColor = colores[indice];
    const etiqueta = document.createElement('span');
    etiqueta.className = 'report-donut-label';
    etiqueta.textContent = nombre;
    const valor = document.createElement('strong');
    valor.textContent = String(total);
    item.append(muestra, etiqueta, valor);
    return item;
  }));

  if (!graficas.grupos) {
    graficas.grupos = new ChartClass(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: colores,
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 5
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        cutout: '68%',
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: contexto => `${contexto.label}: ${contexto.parsed} radicados` } }
        }
      },
      plugins: [{
        id: 'report-donut-total',
        afterDraw(chart) {
          const area = chart.chartArea;
          if (!area) return;
          const total = chart.data.datasets[0].data.reduce((suma, valor) => suma + valor, 0);
          const contexto = chart.ctx;
          const centroX = (area.left + area.right) / 2;
          const centroY = (area.top + area.bottom) / 2;
          contexto.save();
          contexto.textAlign = 'center';
          contexto.fillStyle = '#829187';
          contexto.font = '500 10px Inter, sans-serif';
          contexto.fillText('Total', centroX, centroY - 5);
          contexto.fillStyle = '#20374e';
          contexto.font = '700 17px Inter, sans-serif';
          contexto.fillText(String(total), centroX, centroY + 16);
          contexto.restore();
        }
      }]
    });
  } else {
    graficas.grupos.data.labels = labels;
    graficas.grupos.data.datasets[0].data = valores;
    graficas.grupos.data.datasets[0].backgroundColor = colores;
    graficas.grupos.update();
  }
}

function renderizarTendencia(ano) {
  const contenedor = document.getElementById('informeTendencia');
  const puedeMostrar = ChartClass && informesVisibles();
  contenedor.hidden = !puedeMostrar;
  const datos = obtenerRegistros().filter(registro =>
    /^\d{4}-\d{2}-\d{2}$/.test(registro.fecha) && registro.fecha.slice(0, 4) === ano
  );
  const conteos = Array(12).fill(0);
  datos.forEach(registro => { conteos[Number(registro.fecha.slice(5, 7)) - 1]++; });
  contenedor.setAttribute('aria-label', `Evolución mensual de radicados durante ${ano}`);
  document.getElementById('informeTendenciaSubtitulo').textContent =
    `${datos.length} radicados registrados en ${ano}`;
  if (!puedeMostrar) return;

  if (!graficas.tendencia) {
    graficas.tendencia = new ChartClass(contenedor, {
      type: 'line',
      data: {
        labels: MESES,
        datasets: [{
          label: 'Radicados',
          data: conteos,
          borderColor: '#078c4b',
          backgroundColor: 'rgba(7, 140, 75, 0.1)',
          pointBackgroundColor: '#078c4b',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: contexto => `${contexto.parsed.y} radicados` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, font: { size: 10 } } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: '#edf2ef', drawBorder: false }
          }
        }
      }
    });
  } else {
    graficas.tendencia.data.datasets[0].data = conteos;
    graficas.tendencia.update();
  }
}

function renderizarHistorico(registros, periodo) {
  const tbody = document.getElementById('informeHistorico');
  const periodos = new Map();
  registros.forEach(registro => {
    if (!coincidePeriodo(registro, periodo)) return;
    const clave = registro.fecha.slice(0, 7);
    if (!periodos.has(clave)) periodos.set(clave, []);
    periodos.get(clave).push(registro);
  });

  const filas = [...periodos].sort((a, b) => b[0].localeCompare(a[0])).map(([clave, radicados]) => {
    const fila = document.createElement('tr');
    const [ano, mes] = clave.split('-');
    const periodoTexto = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
      .format(new Date(Number(ano), Number(mes) - 1, 1))
      .replace(/^./, caracter => caracter.toLocaleUpperCase('es-CO'));
    const resueltos = radicados.filter(registro => registro.resuelto).length;
    const extra = origen === 'ias'
      ? String(new Set(radicados.map(registro => registro.grupo)).size)
      : String(radicados.filter(registro => registro.vencido).length);
    fila.append(
      crearCelda(periodoTexto, 'th'),
      crearCelda(String(radicados.length)),
      crearCelda(String(radicados.length - resueltos)),
      crearCelda(String(resueltos)),
      crearCelda(extra)
    );
    return fila;
  });

  tbody.replaceChildren(...filas);
  document.getElementById('informeHistoricoVacio').hidden = filas.length > 0;
}

export function actualizarInformes() {
  const raiz = document.getElementById('pantallaInformes');
  if (!raiz) return;
  actualizarFiltroAnios();
  const periodo = leerPeriodo();
  const registros = obtenerRegistros().filter(registro => coincidePeriodo(registro, periodo));
  const nombreGrupo = origen === 'ias' ? 'IAS' : 'Dependencia';
  actualizarAvisoIAS();
  actualizarAvisoGraficas();
  document.getElementById('informeRankingTitulo').textContent =
    `PQRS por ${nombreGrupo}`;
  document.getElementById('informeRankingIcono').className =
    `bi ${origen === 'ias' ? 'bi-bank' : 'bi-file-earmark-bar-graph'}`;
  renderizarIndicadores(registros, periodo);
  renderizarRanking(registros);
  renderizarGraficaIAS();
  renderizarTendencia(periodo.ano);
  renderizarHistorico(obtenerRegistros(), periodo);
}

export function establecerRegistrosIASInforme(registros) {
  registrosIAS = registros;
  estadoCargaIAS = 'loaded';
  actualizarFiltroAnios();
  actualizarInformes();
}

export function establecerDependenciasInforme() {
  estadoCargaDependencias = 'loaded';
  actualizarInformes();
}

export function establecerErrorDependenciasInforme() {
  estadoCargaDependencias = 'error';
  actualizarInformes();
}

export function establecerErrorIASInforme() {
  estadoCargaIAS = 'error';
  actualizarInformes();
}

export function redimensionarGraficasInformes() {
  if (!ChartClass) return;
  document.querySelectorAll('#pantallaInformes canvas').forEach(canvas => {
    ChartClass.getChart(canvas)?.resize();
  });
}

export function inicializarInformes() {
  actualizarFiltroAnios();
  document.querySelectorAll('[data-report-source]').forEach(boton => {
    boton.addEventListener('click', () => {
      origen = boton.dataset.reportSource;
      document.querySelectorAll('[data-report-source]').forEach(opcion => {
        const activo = opcion === boton;
        opcion.classList.toggle('active', activo);
        opcion.setAttribute('aria-pressed', String(activo));
      });
      actualizarInformes();
    });
  });
  document.getElementById('filtroAnoInformes')?.addEventListener('change', actualizarInformes);
  document.getElementById('filtroMesInformes')?.addEventListener('change', actualizarInformes);
  window.addEventListener('resize', redimensionarGraficasInformes);
  actualizarInformes();
  cargarChartJs();
}
