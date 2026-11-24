import {
  abreviarNombreDependencia,
  evaluarEstadoAutomatico,
  obtenerEtiquetaCumplimientoCierre,
  obtenerUrlHttpsSegura
} from '../../utils/helpers.js';
import {
  esAdministrador,
  obtenerPerfilSesion,
  puedeEditarRadicado,
  puedeGestionarIAS,
  puedeGestionarRadicado
} from '../auth/roles.js';
import { buscarRegistroRadicado } from '../../data/registros.js';

export const TIPOS_PETICION = [
  'Consulta',
  'Denuncia',
  'Queja',
  'Reclamo',
  'Solicitud de Información',
  'Sugerencia',
  'Derecho de petición',
  'Recurso de reposición',
  'Felicitación',
  'Petición de Copias',
  'Petición'
];

export function actualizarDisponibilidadAccionesRadicado(fila) {
  if (!fila) return;

  const tieneTipoPeticion = TIPOS_PETICION.includes(
    fila.querySelector('.tipo-peticion-select')?.value
  );
  const tieneFuncionario = fila.dataset.hasAssignedOfficial === 'true';
  const disponible = tieneTipoPeticion
    && tieneFuncionario
    && fila.dataset.guardandoTipoPeticion !== 'true';
  const motivoDeshabilitado = !tieneTipoPeticion
    ? 'Selecciona primero el tipo de petición'
    : !tieneFuncionario
      ? 'Asigna primero un funcionario'
      : 'Guardando tipo de petición...';

  fila.querySelectorAll('.other-states-button, .response-upload-trigger')
    .forEach(boton => {
      boton.disabled = !disponible;
      if (!disponible) {
        boton.title = motivoDeshabilitado;
      } else if (boton.classList.contains('other-states-button')) {
        boton.title = 'Gestionar / Agregar Estado';
      } else {
        boton.title = 'Cargar respuesta';
      }
    });
}

// Función auxiliar para convertir textos a formato Título
function aTitulo(texto) {
  if (!texto) return '';
  return texto.toLowerCase().replace(/(?:^|\s|-)\S/g, letra => letra.toUpperCase());
}

function abrirModalVisualizarRespuesta(radicado, archivos) {
  const modal = document.getElementById('modalVisualizarRespuesta');
  const listaArchivos = document.getElementById('listaVisualizarRespuesta');
  const titulo = document.getElementById('tituloModalVisualizarRespuesta');
  if (!modal || !listaArchivos || !titulo) return;

  titulo.textContent = `Archivos de respuesta · ${radicado.radicado || ''}`;
  listaArchivos.replaceChildren(...archivos.map((url, indice) => {
    const enlace = document.createElement('a');
    enlace.className = 'response-view-file-link';
    enlace.href = url;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    const icono = document.createElement('i');
    icono.className = 'bi bi-file-earmark-pdf';
    icono.setAttribute('aria-hidden', 'true');
    const etiqueta = document.createElement('span');
    etiqueta.textContent = `Visualizar PDF ${indice + 1}`;
    enlace.append(icono, etiqueta);
    return enlace;
  }));
  modal.showModal();
}

window.abrirModalVisualizarRespuesta = abrirModalVisualizarRespuesta;

window.abrirInfoRemitente = function(id, coleccion = '') {
  const registro = buscarRegistroRadicado(id, coleccion);
  if (!registro) return;

  const estadoObj = evaluarEstadoAutomatico(
    registro.fechaVencimiento,
    registro.respuestaUrl,
    registro.otrosEstados,
    registro.estado
  );
  const etiquetasEstado = {
    'status-vigente': 'Vigente',
    'status-cerrado': 'Cerrado',
    'status-proximo': 'Próximo a vencer',
    'status-extemporanea': 'Extemporánea',
    'status-tramite': 'En Trámite'
  };
  const estado = etiquetasEstado[estadoObj.clase] || estadoObj.texto;
  const titulo = document.getElementById('tituloInfoRemitente');
  const contenido = document.getElementById('contenidoInfoRemitente');
  const modal = document.getElementById('modalInfoRemitente');
  if (!titulo || !contenido || !modal) return;

  titulo.textContent = aTitulo(registro.remitente) || 'Remitente sin nombre';
  contenido.replaceChildren();
  const agregarDato = (etiqueta, valor, icono = 'bi-info-circle', esEstado = false) => {
    if (valor === undefined || valor === null || valor === '') return;
    const fila = document.createElement('div');
    fila.className = 'remitente-info-row';
    const iconoContenedor = document.createElement('span');
    iconoContenedor.className = 'remitente-info-row-icon';
    iconoContenedor.innerHTML = `<i class="bi ${icono}" aria-hidden="true"></i>`;
    const nombre = document.createElement('strong');
    nombre.textContent = `${etiqueta}:`;
    const dato = document.createElement('span');
    dato.textContent = String(valor);
    dato.style.whiteSpace = 'pre-wrap';
    if (esEstado) {
      dato.className = 'remitente-info-status-badge';
      dato.innerHTML = `<span aria-hidden="true"></span>${String(valor)}`;
    }
    fila.append(iconoContenedor, nombre, dato);
    contenido.append(fila);
  };

  agregarDato('Estado general', estado, 'bi-building', true);
  const canalRespuesta = [
    registro.notificacionRespuestaTipo,
    registro.notificacionRespuestaContacto
  ].filter(Boolean).join(' - ') || '-';
  agregarDato('Canal de Respuesta', canalRespuesta, 'bi-envelope');
  agregarDato('Folios', registro.folios, 'bi-folder2');
  agregarDato('Anexos', registro.anexos, 'bi-paperclip');
  agregarDato('Responsable', aTitulo(registro.funcionarioAsignado), 'bi-person');
  agregarDato('Otros estados', registro.otrosEstados, 'bi-pin-angle');
  agregarDato('Observaciones', registro.observaciones, 'bi-eye');

  modal.style.display = 'flex';
  modal.onclick = event => {
    if (event.target === modal) window.cerrarInfoRemitente();
  };
};

window.cerrarInfoRemitente = function() {
  const modal = document.getElementById('modalInfoRemitente');
  if (modal) modal.style.display = 'none';
};

function expandirTextoSeleccionado() {
  const seleccion = window.getSelection();
  const textoSeleccionado = seleccion?.toString().trim();
  if (!textoSeleccionado || !seleccion.rangeCount) return;

  const rango = seleccion.getRangeAt(0);
  let nodo = rango.commonAncestorContainer;
  if (nodo.nodeType === Node.TEXT_NODE) nodo = nodo.parentElement;
  const contenedor = nodo instanceof Element
    ? nodo.closest('.table-truncated-text')
    : null;
  if (!contenedor) return;

  contenedor.classList.add('is-expanded');
}

window.alternarTextoCompletoTabla = function(elemento, event) {
  if (event?.target instanceof Element && event.target.closest('button, a')) return;
  const contenedor = elemento instanceof Element
    ? elemento.matches('.table-truncated-cell')
      ? elemento.querySelector('.table-truncated-text')
      : elemento.closest('.table-truncated-text')
    : null;
  if (!contenedor) return;
  contenedor.classList.toggle('is-expanded');
};

document.addEventListener('mouseup', () => {
  window.setTimeout(expandirTextoSeleccionado, 0);
});

document.getElementById('modalInfoRemitente')?.addEventListener('click', event => {
  if (event.target.id === 'modalInfoRemitente') window.cerrarInfoRemitente();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const modal = document.getElementById('modalInfoRemitente');
    if (modal?.style.display === 'flex') window.cerrarInfoRemitente();
  }
});

function formatearFechaTabla(fecha) {
  const coincidencia = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  return coincidencia
    ? `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`
    : fecha || '';
}

export function renderizarTablaRadicados(
  lista,
  tbodyId = 'cuerpoTablaExclusiva',
  filtrosActivosExterno = null
) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const filaActiva = tbody.querySelector(
    'tr.month-record-row.is-active-row[data-radicado-id]'
  );
  const radicadoActivoId = filaActiva?.dataset.radicadoId;
  const coleccionActiva = filaActiva?.dataset.collection;
  const mesesDesplegados = new Set(
    Array.from(tbody.querySelectorAll('.month-group-row .month-group-toggle[aria-expanded="true"]'))
      .map(boton => boton.closest('tr')?.nextElementSibling?.dataset.monthGroup)
      .filter(Boolean)
  );
  tbody.innerHTML = '';
  
  // ... resto de tu código normal

  const hayFiltrosActivos = filtrosActivosExterno ?? Boolean(
    document.getElementById('inputBuscar')?.value.trim() ||
    document.getElementById('filtroAno')?.value ||
    document.getElementById('filtroMes')?.value
  );
  const esTablaIAS = tbodyId === 'cuerpoTablaIAS';
  const fechaActual = new Date();
  const mesActualKey = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}`;
  const busquedaActiva = Boolean(document.getElementById(esTablaIAS ? 'buscarRadicadoIAS' : 'inputBuscar')?.value.trim());
  const anoSeleccionado = document.getElementById(esTablaIAS ? 'filtroAnoIAS' : 'filtroAno')?.value;
  const mesSeleccionado = document.getElementById(esTablaIAS ? 'filtroMesIAS' : 'filtroMes')?.value;
  const periodoActualSeleccionado = anoSeleccionado === String(fechaActual.getFullYear())
    && (!mesSeleccionado || mesSeleccionado === String(fechaActual.getMonth() + 1).padStart(2, '0'));

  if (lista.length === 0 && hayFiltrosActivos) {
    if (esTablaIAS) {
      tbody.innerHTML = '<tr class="month-record-row month-empty-row"><td colspan="15">No se encontraron radicados.</td></tr>';
      return;
    }
    const mostrarMesActualVacio = periodoActualSeleccionado && !busquedaActiva && !mesSeleccionado;
    if (mostrarMesActualVacio) {
      tbody.innerHTML = '<tr class="month-record-row month-empty-row"><td colspan="15">No hay radicados para el periodo actual.</td></tr>';
      return;
    }
    const mensaje = periodoActualSeleccionado && !busquedaActiva
      ? 'No hay radicados para el periodo actual.'
      : 'No se encontraron radicados con los filtros seleccionados.';
    tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; color: #94a3b8; padding: 30px;">${mensaje}</td></tr>`;
    return;
  }

  const gruposPorMes = new Map();
  const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
  const nombreMesActual = formatoMes
    .format(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1))
    .replace(/^./, character => character.toLocaleUpperCase('es-CO'));
  const radicadosOrdenados = [...lista].sort((a, b) => {
    const fechaA = String(a.fechaRadicacion || '').slice(0, 10);
    const fechaB = String(b.fechaRadicacion || '').slice(0, 10);
    const ordenFecha = fechaB.localeCompare(fechaA);
    if (ordenFecha) return ordenFecha;

    const instanteA = Date.parse(a.fechaHoraRadicacion || a.fechaRadicacion || '');
    const instanteB = Date.parse(b.fechaHoraRadicacion || b.fechaRadicacion || '');
    return (Number.isFinite(instanteB) ? instanteB : 0)
      - (Number.isFinite(instanteA) ? instanteA : 0);
  });

  if (!hayFiltrosActivos || (periodoActualSeleccionado && !busquedaActiva && !mesSeleccionado)) {
    gruposPorMes.set(mesActualKey, { etiqueta: nombreMesActual, radicados: [] });
  }

  radicadosOrdenados.forEach(reg => {
    const fechaRadicacion = typeof reg.fechaRadicacion === 'string' ? reg.fechaRadicacion : '';
    const coincidenciaMes = fechaRadicacion.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
    const mesKey = coincidenciaMes ? `${coincidenciaMes[1]}-${coincidenciaMes[2]}` : 'sin-fecha';
    const etiquetaMes = coincidenciaMes
      ? formatoMes
        .format(new Date(Number(coincidenciaMes[1]), Number(coincidenciaMes[2]) - 1, 1))
        .replace(/^./, character => character.toLocaleUpperCase('es-CO'))
      : 'Sin fecha de radicación';

    if (!gruposPorMes.has(mesKey)) {
      gruposPorMes.set(mesKey, { etiqueta: etiquetaMes, radicados: [] });
    }
    gruposPorMes.get(mesKey).radicados.push(reg);
  });

  gruposPorMes.forEach((grupo, mesKey) => {
    const esMesActual = mesKey === mesActualKey;
    if (!esMesActual) {
      const filaMes = document.createElement('tr');
      filaMes.className = 'month-group-row';
      filaMes.innerHTML = `
        <th colspan="15">
          <button class="month-group-toggle" type="button" aria-expanded="false" onclick="toggleMonthGroup(this)">
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
            <span>${grupo.etiqueta}</span>
            <span class="month-group-count">${grupo.radicados.length} ${grupo.radicados.length === 1 ? 'radicado' : 'radicados'}</span>
          </button>
        </th>
      `;
      tbody.appendChild(filaMes);
    }

    if (grupo.radicados.length === 0) {
      const filaVacia = document.createElement('tr');
      filaVacia.className = 'month-record-row month-empty-row';
      filaVacia.dataset.monthGroup = mesKey;
      filaVacia.hidden = !esMesActual;
      const mensajeVacio = esTablaIAS
        ? 'No se encontraron radicados.'
        : esMesActual
          ? 'No hay radicados para el periodo actual.'
          : 'No se encontraron radicados.';
      filaVacia.innerHTML = `<td colspan="15">${mensajeVacio}</td>`;
      tbody.appendChild(filaVacia);
      return;
    }

    grupo.radicados.forEach(reg => {
    const estadoBase = reg.estado || 'VIGENTE';
    const dependenciasRechazadas = Array.isArray(reg.dependenciasRechazadas)
      ? reg.dependenciasRechazadas
      : [];
    const estadoObj = dependenciasRechazadas.length && estadoBase === 'VIGENTE'
      ? { texto: 'VIGENTE', clase: 'status-vigente' }
      : evaluarEstadoAutomatico(reg.fechaVencimiento, reg.respuestaUrl, reg.otrosEstados, estadoBase);
    const etiquetasEstado = {
      'status-vigente': 'Vigente',
      'status-cerrado': 'Cerrado',
      'status-proximo': 'Próximo a vencer',
      'status-extemporanea': 'Extemporánea',
      'status-tramite': 'En Trámite'
    };
    const textoEstado = estadoObj.texto === 'R. por C.'
      ? estadoObj.texto
      : etiquetasEstado[estadoObj.clase] || estadoObj.texto;
    const opcionesTipoPeticion = TIPOS_PETICION
      .map(tipo => `<option value="${tipo}"${reg.tipoPeticion === tipo ? ' selected' : ''}>${tipo}</option>`)
      .join('');
    const tieneTipoPeticion = TIPOS_PETICION.includes(reg.tipoPeticion);
    const tieneFuncionario = Boolean(reg.funcionarioAsignado?.trim());
    const accionesHabilitadas = tieneTipoPeticion && tieneFuncionario;
    const coleccion = reg.coleccion === 'radicadosIAS' ? 'radicadosIAS' : 'radicados';
    const puedeGestionarRegistro = coleccion === 'radicadosIAS'
      ? puedeGestionarIAS()
      : puedeGestionarRadicado(reg.dependencia);
    const puedeEditarRegistro = puedeEditarRadicado({ ...reg, coleccion });
    const soloLecturaIAS = coleccion === 'radicadosIAS' && !puedeGestionarRegistro;
    const fechaCargaRespuesta = typeof reg.fechaCargaRespuesta === 'string'
      ? reg.fechaCargaRespuesta
      : '';
    const fechaCargaRespuestaVisible = /^\d{4}-\d{2}-\d{2}$/.test(fechaCargaRespuesta)
      ? formatearFechaTabla(fechaCargaRespuesta)
      : '-';
    const fechaRadicacionVisible = formatearFechaTabla(reg.fechaRadicacion);
    const fechaEntregaManualVisible = formatearFechaTabla(reg.fechaEntregaManual);
    const fechaVencimientoVisible = formatearFechaTabla(reg.fechaVencimiento);
    const etiquetaCumplimientoCierre = estadoObj.texto === 'CERRADO'
      ? obtenerEtiquetaCumplimientoCierre(fechaCargaRespuesta, reg.fechaVencimiento)
      : '';
    const estadoHtml = estadoObj.texto === 'CERRADO'
      ? `<span class="badge-status ${estadoObj.clase}">${etiquetaCumplimientoCierre
        ? `<span class="status-cerrado-labels"><span>Cerrado</span><span>${etiquetaCumplimientoCierre.replace(/^Cerrado\s+/, '')}</span></span>`
        : '-'}</span>`
      : `<span class="badge-status ${estadoObj.clase}">${textoEstado}</span>`;

    const urlPdf = obtenerUrlHttpsSegura(reg.pdfUrl);
    const urlSolicitudCiudadano = obtenerUrlHttpsSegura(reg.pdfCiudadanoUrl);
    const pdfLinks = [
      urlPdf
        ? `<a class="pdf-badge" href="${urlPdf}" target="_blank" rel="noopener noreferrer">📄 Abrir PDF</a>`
        : '',
      urlSolicitudCiudadano && urlSolicitudCiudadano !== urlPdf
        ? `<a class="pdf-badge" href="${urlSolicitudCiudadano}" target="_blank" rel="noopener noreferrer">📄 Solicitud original</a>`
        : ''
    ].filter(Boolean);
    const pdfCellHtml = pdfLinks.length
      ? `<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">${pdfLinks.join('')}</div>`
      : '<span style="color: #9ca3af; font-size: 11px;">Sin PDF</span>';

    const archivosRespuesta = Array.isArray(reg.respuestaArchivos)
      ? reg.respuestaArchivos
        .map(url => obtenerUrlHttpsSegura(url))
        .filter(Boolean)
      : [];
    if (!archivosRespuesta.length && reg.respuestaUrl) {
      const urlRespuesta = obtenerUrlHttpsSegura(reg.respuestaUrl);
      if (urlRespuesta) archivosRespuesta.push(urlRespuesta);
    }
    const tieneRespuesta = archivosRespuesta.length > 0;
    let columnaRespuestaHtml = "";
    if (soloLecturaIAS) {
      columnaRespuestaHtml = tieneRespuesta
        ? '<button class="response-files-toggle" type="button"><i class="bi bi-eye" aria-hidden="true"></i> Visualizar</button>'
        : '<span>-</span>';
    } else if (tieneRespuesta) {
      columnaRespuestaHtml = '<button class="response-files-toggle" type="button"><i class="bi bi-eye" aria-hidden="true"></i> Visualizar</button>';
    } else {
      columnaRespuestaHtml = `
        <button class="response-upload-trigger" type="button" onclick="abrirModalRespuestaRadicado('${reg.id}', this)" title="${accionesHabilitadas ? 'Cargar respuesta' : !tieneTipoPeticion ? 'Selecciona primero el tipo de petición' : 'Asigna primero un funcionario'}" ${accionesHabilitadas ? '' : 'disabled'}>
          <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
          <span>Cargar Respuesta</span>
        </button>
      `;
    }
    const columnaProrrogaHtml = reg.prorroga?.archivoUrl
      ? `<a class="prorroga-view-link" href="${reg.prorroga.archivoUrl}" target="_blank" rel="noopener noreferrer" title="Ver oficio de prórroga" aria-label="Ver oficio de prórroga">
          <i class="bi bi-eye" aria-hidden="true"></i><span>Ver Prorroga</span>
        </a>`
      : !tieneRespuesta && obtenerPerfilSesion()?.rol === 'administrador'
        ? `<button class="prorroga-action-button" onclick="abrirModalProrrogaRadicado('${reg.id}', '${coleccion}')" style="background:#2563eb; color:#ffffff; border:1px solid #2563eb; min-width:76px; height:24px; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:3px; padding:0 5px; font-size:9px;" title="Agregar prórroga" aria-label="Prórroga">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path><path d="M18.5 6.5 20 5"></path></svg>
            <span>Prórroga</span>
          </button>`
        : '';
    const tipoPeticionHtml = soloLecturaIAS
      ? `<span>${reg.tipoPeticion || '-'}</span>`
      : `
        <div class="petition-type-field">
          <select class="tipo-peticion-select" title="${reg.tipoPeticion || 'Selecciona un tipo de petición'}" aria-label="Tipo de petición para el radicado ${reg.radicado || ''}" aria-required="true" required onchange="guardarTipoPeticionRadicado('${reg.id}', this)">
            <option value="">Selecciona un tipo</option>
            ${opcionesTipoPeticion}
          </select>
        </div>
      `;

    const tr = document.createElement('tr');
    tr.className = 'month-record-row';
    tr.dataset.monthGroup = mesKey;
    tr.dataset.radicadoId = reg.id;
    tr.dataset.collection = reg.coleccion === 'radicadosIAS' ? 'radicadosIAS' : 'radicados';
    if (reg.id === radicadoActivoId && tr.dataset.collection === coleccionActiva) {
      tr.classList.add('is-active-row');
    }
    tr.hidden = !esMesActual;
    tr.innerHTML = `
      <td style="text-align: center;">${pdfCellHtml}</td>
      <td title="${reg.radicado || ''}"><strong>${reg.radicado || ''}</strong></td>
      <td>${fechaRadicacionVisible}</td>
      <td class="delivery-date-cell">
        <span class="delivery-date-value">${
          reg.remisionOrigenId && !reg.fechaRecepcionCompetencia
            ? ''
            : fechaEntregaManualVisible || '-'
        }</span>
      </td>
      <td>
        <span class="badge-status ${estadoObj.clase}">${fechaVencimientoVisible}</span>
      </td>
      <td>${estadoHtml}</td>
      <td style="text-align: center;"><strong>${reg.diasHabiles}</strong></td>

      <!-- Remitente con información general -->
      <td class="table-truncated-cell" onclick="alternarTextoCompletoTabla(this, event)">
        <div style="max-width: 220px;">
          <span class="table-truncated-text" style="display:block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 400;" title="${aTitulo(reg.remitente) || ''}">
            ${aTitulo(reg.remitente) || ''}
          </span>
          <button type="button" class="remitente-info-toggle" aria-expanded="false"
            style="border:0; background:#f1f5f4; color:#16804a; font-size:10px; font-style:italic; font-weight:700; padding:3px 7px; margin-top:3px; border-radius:999px; cursor:pointer; transition:background .15s ease, color .15s ease, transform .15s ease;"
            onclick="abrirInfoRemitente('${reg.id}', '${coleccion}')">
            +Info
          </button>
        </div>
      </td>
      
      <td class="table-truncated-cell" title="${aTitulo(reg.asunto) || ''}" onclick="alternarTextoCompletoTabla(this, event)">
        <div class="table-truncated-text" style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${aTitulo(reg.asunto) || ''}
        </div>
      </td>
      
      <td>
  <div class="radicado-actions-main">
  ${puedeEditarRegistro ? `<button onclick="prepararEdicion('${reg.id}', '${coleccion}')" style="background:#2563eb; color:white; border:none; width:30px; height:30px; border-radius:5px; cursor:pointer; margin-right:3px; display:inline-flex; align-items:center; justify-content:center;" title="Editar radicado" aria-label="Editar radicado">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 4 4 4"></path><path d="M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"></path><path d="m14.5 6.5 3 3"></path></svg>
  </button>` : ''}
  ${puedeGestionarRegistro ? `
  <button class="other-states-button" onclick="abrirModalOtrosEstados('${reg.id}', '${coleccion}')" style="background:#00a838; color:white; border:none; width:30px; height:30px; border-radius:5px; cursor:pointer; margin-right:3px; display:inline-flex; align-items:center; justify-content:center;" title="${accionesHabilitadas ? 'Gestionar / Agregar Estado' : !tieneTipoPeticion ? 'Selecciona primero el tipo de petición' : 'Asigna primero un funcionario'}" aria-label="Gestionar / Agregar Estado" ${accionesHabilitadas ? '' : 'disabled'}>
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  </button>` : ''}
  ${obtenerPerfilSesion()?.rol === 'administrador' ? `
  <button onclick="eliminarRadicado('${reg.id}', this)" style="background:#dc2626; color:white; border:none; width:30px; height:30px; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar" aria-label="Eliminar">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
  </button>` : ''}
  </div>
</td>
<td class="response-action-cell">
  <div class="response-action-stack" style="display:flex; flex-direction:column; align-items:center; gap:3px;">
    ${columnaRespuestaHtml}
    ${columnaProrrogaHtml ? `<div class="radicado-actions-prorroga">${columnaProrrogaHtml}</div>` : ''}
  </div>
</td>
<td><span class="delivery-date-value">${fechaCargaRespuestaVisible}</span></td>
<td>${tipoPeticionHtml}</td>
<td>${reg.tipoCanal || '-'}</td>
    `;

    tr.querySelector('.response-files-toggle')?.addEventListener('click', () => (
      abrirModalVisualizarRespuesta(reg, archivosRespuesta)
    ));

    const dependenciasDestino = Array.isArray(reg.dependenciasDestino) ? reg.dependenciasDestino : [];
    const dependenciasRecibidas = Array.isArray(reg.dependenciasRecibidas)
      ? reg.dependenciasRecibidas
      : [];
    const crearDetalleRemision = (etiqueta, texto) => {
      const boton = document.createElement('button');
      boton.className = 'competence-routing-toggle';
      boton.type = 'button';
      boton.textContent = etiqueta;
      boton.setAttribute('aria-expanded', 'false');
      boton.addEventListener('mousedown', event => event.preventDefault());

      const detalle = document.createElement('small');
      detalle.className = 'competence-routing-note';
      detalle.textContent = texto;
      detalle.hidden = true;

      boton.addEventListener('click', () => {
        const mostrarDetalle = detalle.hidden;
        detalle.hidden = !mostrarDetalle;
        boton.setAttribute('aria-expanded', String(mostrarDetalle));
        boton.textContent = mostrarDetalle ? 'Ocultar' : etiqueta;
      });

      tr.cells[5].append(boton, detalle);
    };

    if (dependenciasDestino.length && dependenciasRecibidas.length) {
      crearDetalleRemision(
        'Ver Destino',
        `Aceptado R.C por: "${dependenciasRecibidas.join(', ')}"`
      );
    } else if (dependenciasDestino.length && !dependenciasRechazadas.length) {
      crearDetalleRemision(
        'Ver destino',
        `Remitido a: ${dependenciasDestino.join(', ')}`
      );
    }

    if (dependenciasRechazadas.length) {
      crearDetalleRemision(
        'Ver Rechazo',
        `Rechazada R.C por: "${dependenciasRechazadas.join(', ')}"`
      );
    }

    if (!dependenciasDestino.length && reg.remisionOrigenDependencia) {
      crearDetalleRemision(
        'Ver origen',
        `Recibido de: ${abreviarNombreDependencia(reg.remisionOrigenDependencia)}`
      );
    }

    const funcionarioCell = document.createElement('td');
    funcionarioCell.className = 'assigned-official-cell';
    tr.dataset.hasAssignedOfficial = String(tieneFuncionario);
    const funcionarioLimpio = aTitulo(reg.funcionarioAsignado || '');
    const partesFuncionario = funcionarioLimpio.trim().split(/\s+/).filter(Boolean);
    const nombreFuncionario = document.createElement('span');
    nombreFuncionario.className = 'assigned-official-name';
    nombreFuncionario.textContent = partesFuncionario.length > 1
      ? `${partesFuncionario[0]}\n${partesFuncionario.slice(1).join(' ')}`
      : funcionarioLimpio;
    funcionarioCell.append(nombreFuncionario);
    if (!puedeGestionarRegistro) {
      funcionarioCell.classList.add('is-readonly');
    } else if (tieneFuncionario) {
      const botonEditarFuncionario = document.createElement('button');
      botonEditarFuncionario.type = 'button';
      botonEditarFuncionario.className = 'assigned-official-edit-button';
      botonEditarFuncionario.setAttribute('aria-label', `Cambiar funcionario asignado: ${funcionarioLimpio}`);
      botonEditarFuncionario.title = 'Cambiar funcionario';
      botonEditarFuncionario.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i>';
      botonEditarFuncionario.addEventListener('click', () => window.abrirModalFuncionarioAsignado(reg.id, coleccion));
      funcionarioCell.append(botonEditarFuncionario);
    } else {
      const botonFuncionario = document.createElement('button');
      botonFuncionario.type = 'button';
      botonFuncionario.className = 'assigned-official-button';
      botonFuncionario.setAttribute('aria-label', 'Asignar funcionario');
      botonFuncionario.title = 'Asignar funcionario';
      botonFuncionario.innerHTML = '<i class="bi bi-person-plus-fill" aria-hidden="true"></i>';
      botonFuncionario.addEventListener('click', () => window.abrirModalFuncionarioAsignado(reg.id, coleccion));
      funcionarioCell.append(botonFuncionario);
    }
    tr.insertBefore(funcionarioCell, tr.cells[9]);

    if (reg.remisionOrigenId && !reg.fechaRecepcionCompetencia && puedeGestionarRegistro) {
      const accionesCompetencia = document.createElement('div');
      accionesCompetencia.className = 'competence-decision-actions';

      const botonRecibir = document.createElement('button');
      botonRecibir.type = 'button';
      botonRecibir.className = 'competence-receive-button';
      botonRecibir.textContent = 'Recibir';
      botonRecibir.title = 'Registrar recepción y actualizar la fecha de entrega';
      botonRecibir.setAttribute('aria-label', 'Recibir oficio remitido por competencia');
      botonRecibir.addEventListener('click', () => {
        window.recibirRadicadoCompetencia(reg.id, coleccion);
      });

      const botonRechazar = document.createElement('button');
      botonRechazar.type = 'button';
      botonRechazar.className = 'competence-reject-button';
      botonRechazar.textContent = 'Rechazar';
      botonRechazar.title = 'Rechazar esta remisión sin afectar las demás dependencias';
      botonRechazar.setAttribute('aria-label', 'Rechazar oficio remitido por competencia');
      botonRechazar.addEventListener('click', () => {
        window.rechazarRadicadoCompetencia(reg.id, coleccion);
      });

      accionesCompetencia.append(botonRecibir, botonRechazar);
      tr.querySelector('.delivery-date-cell')?.append(accionesCompetencia);
    }

    // 👇 ¡Importante! Faltaba agregar la fila completa a la tabla
    if (!puedeGestionarRegistro) {
      tr.cells[10]?.replaceChildren();
    } else if (!esAdministrador()) {
      tr.querySelector('button[onclick^="eliminarRadicado"]')?.remove();
    }
    tbody.appendChild(tr);
  }); // Cierra el forEach de reg (radicados)
}); // Cierra el forEach de gruposPorMes

tbody.querySelectorAll('.month-group-row .month-group-toggle').forEach(boton => {
  const filaGrupo = boton.closest('tr');
  const mesKey = filaGrupo?.nextElementSibling?.dataset.monthGroup;
  if (!mesesDesplegados.has(mesKey)) return;

  let filaRadicado = filaGrupo.nextElementSibling;
  while (filaRadicado?.classList.contains('month-record-row')) {
    filaRadicado.hidden = false;
    filaRadicado = filaRadicado.nextElementSibling;
  }
  boton.setAttribute('aria-expanded', 'true');
  const icono = boton.querySelector('i');
  icono?.classList.remove('bi-chevron-right');
  icono?.classList.add('bi-chevron-down');
});
} // Cierra la función renderizarTablaRadicados