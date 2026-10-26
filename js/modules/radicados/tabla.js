import { evaluarEstadoAutomatico } from '../../utils/helpers.js';

// Función auxiliar para convertir textos a formato Título
function aTitulo(texto) {
  if (!texto) return '';
  return texto.toLowerCase().replace(/(?:^|\s|-)\S/g, letra => letra.toUpperCase());
}

export function renderizarTablaRadicados(lista) {
  const tbody = document.getElementById('cuerpoTablaExclusiva');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // ... resto de tu código normal

  const hayFiltrosActivos = Boolean(
    document.getElementById('inputBuscar')?.value.trim() ||
    document.getElementById('filtroAno')?.value ||
    document.getElementById('filtroMes')?.value
  );

  if (lista.length === 0 && hayFiltrosActivos) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: #94a3b8; padding: 30px;">No se encontraron radicados con los filtros seleccionados.</td></tr>`;
    return;
  }

  const fechaActual = new Date();
  const mesActualKey = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}`;
  const gruposPorMes = new Map();
  const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
  const nombreMesActual = formatoMes
    .format(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1))
    .replace(/^./, character => character.toLocaleUpperCase('es-CO'));

  if (!hayFiltrosActivos) {
    gruposPorMes.set(mesActualKey, { etiqueta: nombreMesActual, radicados: [] });
  }

  lista.forEach(reg => {
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
        <th colspan="12">
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
      filaVacia.innerHTML = '<td colspan="12">No se encontraron radicados.</td>';
      tbody.appendChild(filaVacia);
      return;
    }

    grupo.radicados.forEach(reg => {
    const estadoBase = reg.estado || 'VIGENTE';
    const estadoObj = evaluarEstadoAutomatico(reg.fechaVencimiento, reg.respuestaUrl, reg.otrosEstados, estadoBase);
    const etiquetasEstado = {
      'status-vigente': 'Vigente',
      'status-cerrado': 'Cerrado',
      'status-proximo': 'Próximo a vencer',
      'status-extemporanea': 'Extemporánea',
      'status-tramite': 'En Trámite'
    };
    const textoEstado = etiquetasEstado[estadoObj.clase] || estadoObj.texto;

    // Validacion para ti PDF
    const tienePdf = reg.pdfUrl && reg.pdfUrl.trim() !== '' && reg.pdfUrl.startsWith('http');
    const pdfCellHtml = tienePdf 
      ? `<a class="pdf-badge" href="${reg.pdfUrl}" target="_blank">📄 Abrir PDF</a>` 
      : '<span style="color: #9ca3af; font-size: 11px;">Sin PDF</span>';

    let columnaRespuestaHtml = "";
if (reg.respuestaUrl) {
  columnaRespuestaHtml = `
    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
      <a class="response-file-link" href="${reg.respuestaUrl}" target="_blank" rel="noopener noreferrer">
        Visualizar
      </a>
      <div class="response-file-actions">
        <button class="response-replace-button" type="button" onclick="document.getElementById('file-resp-${reg.id}').click()" title="Reemplazar archivo de respuesta">Reemplazar</button>
        <button class="response-delete-button" type="button" onclick="eliminarRespuestaRadicado('${reg.id}', this)" title="Eliminar archivo de respuesta">Eliminar</button>
      </div>
      <input type="file" id="file-resp-${reg.id}" style="display: none;" onchange="subirRespuestaRadicado('${reg.id}', this)">
    </div>
  `;
} else {
  columnaRespuestaHtml = `
    <button type="button" onclick="document.getElementById('file-resp-${reg.id}').click()" style="cursor: pointer; background-color: #2563eb; color: white; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; display: inline-block;">
      Cargar Respuesta
    </button>
    <input type="file" id="file-resp-${reg.id}" style="display: none;" onchange="subirRespuestaRadicado('${reg.id}', this)">
  `;
}

    // Texto completo para el tooltip del asunto
// Texto completo para el tooltip del asunto
    const textoAsuntoTooltip = `${reg.asunto || ''}${reg.otrosEstados ? ' | Estado: ' + reg.otrosEstados : ''}${reg.observaciones ? ' | Obs: ' + reg.observaciones : ''}`;

    const tr = document.createElement('tr');
    tr.className = 'month-record-row';
    tr.dataset.monthGroup = mesKey;
    tr.hidden = !esMesActual;
    tr.innerHTML = `
      <td style="text-align: center;">${pdfCellHtml}</td>
      <td title="${reg.radicado || ''}"><strong>${reg.radicado || ''}</strong></td>
      <td>${reg.fechaRadicacion || ''}</td>
      <td>${reg.fechaEntregaManual || '-'}</td>
      <td><span class="badge-status ${estadoObj.clase}">${reg.fechaVencimiento || ''}</span></td>
      <td><span class="badge-status ${estadoObj.clase}">${textoEstado}</span></td>
      <td style="text-align: center;"><strong>${reg.diasHabiles}</strong></td>

      <!-- Remitente con formato Título -->
      <td title="${aTitulo(reg.remitente) || ''}" 
          style="cursor: pointer; user-select: none; -webkit-user-select: none;" 
          onmousedown="event.preventDefault();"
          onclick="const div = this.querySelector('div'); div.style.whiteSpace = div.style.whiteSpace === 'normal' ? 'nowrap' : 'normal'; div.style.overflow = div.style.overflow === 'visible' ? 'hidden' : 'visible';">
          <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">
            ${aTitulo(reg.remitente) || ''}
          </div>
      </td>
      
      <!-- Asunto con indicadores compactos (alfiler y ojito verde) y vista expandida limpia -->
      <td title="${reg.asunto || ''}${reg.otrosEstados ? ' - ' + reg.otrosEstados : ''}${reg.observaciones ? ' - ' + reg.observaciones : ''}" 
          style="cursor: pointer; user-select: none; -webkit-user-select: none;" 
          onmousedown="event.preventDefault();"
          onclick="const c = this.querySelector('.vista-compacta'); const e = this.querySelector('.vista-expandida'); const isExp = e.style.display === 'block'; e.style.display = isExp ? 'none' : 'block'; c.style.display = isExp ? 'flex' : 'none';">
          <div style="max-width: 220px;">
            <!-- Vista Compacta: Texto con puntos suspensivos + Íconos indicadores -->
            <div class="vista-compacta" style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${aTitulo(reg.asunto) || ''}</span>
              <span style="flex-shrink: 0; font-size: 12px; display: flex; align-items: center; gap: 3px;">
                ${reg.otrosEstados ? '<span title="Tiene Estado adicional">📌</span>' : ''}
                ${reg.observaciones ? '<span title="Tiene Observación" style="display: inline-flex; align-items: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16804a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></span>' : ''}
              </span>
            </div>
            <!-- Vista Expandida: Muestra todo limpio -->
            <div class="vista-expandida" style="display: none; white-space: normal; word-break: break-word;">
              <div>${aTitulo(reg.asunto) || ''}</div>
              ${reg.otrosEstados ? `<div style="font-size: 11px; font-weight: 600; color: #0284c7; margin-top: 2px;">📌 ${reg.otrosEstados}</div>` : ''}
              ${reg.observaciones ? `<div style="font-size: 11px; font-style: italic; color: #16804a; margin-top: 2px; font-weight: 600;">Obs: ${reg.observaciones}</div>` : ''}
            </div>
          </div>
      </td>
      
      <td>
        <button onclick="prepararEdicion('${reg.id}')" style="background:#2563eb; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; margin-right:2px; display:inline-flex; align-items:center; justify-content:center;" title="Editar radicado" aria-label="Editar radicado">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 4 4 4"></path><path d="M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"></path><path d="m14.5 6.5 3 3"></path></svg>
        </button>
        <button onclick="abrirModalOtrosEstados('${reg.id}')" style="background:#00a838; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; margin-right:2px; display:inline-flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; line-height:1;" title="Gestionar / Agregar Estado">+</button>
        <button onclick="eliminarRadicado('${reg.id}', this)" style="background:#dc2626; color:white; border:none; width:32px; height:32px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar">🗑️</button>
      </td>
      <td>${columnaRespuestaHtml}</td>
    `;

    const funcionarioCell = document.createElement('td');
    funcionarioCell.className = 'assigned-official-cell';
    
    // Aplicamos el formato Título al texto del funcionario
    const funcionarioLimpio = aTitulo(reg.funcionarioAsignado || '');
    const partesFuncionario = funcionarioLimpio.trim().split(/\s+/).filter(Boolean);
    
    if (partesFuncionario.length > 1) {
      const nombre = partesFuncionario[0];
      const apellido = partesFuncionario.slice(1).join(' ');
      funcionarioCell.append(nombre, document.createElement('br'), apellido);
    } else {
      funcionarioCell.textContent = funcionarioLimpio;
    }
    funcionarioCell.title = funcionarioLimpio;
    tr.insertBefore(funcionarioCell, tr.cells[9]);

    // 👇 ¡Importante! Faltaba agregar la fila completa a la tabla
    tbody.appendChild(tr);
  }); // Cierra el forEach de reg (radicados)
}); // Cierra el forEach de gruposPorMes
} // Cierra la función renderizarTablaRadicados