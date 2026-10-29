export const detalleMarkup = String.raw`<div id="pantallaDependencia" style="display: none;">
      <button class="btn-back" onclick="mostrarMenuPrincipal()"><i class="bi bi-arrow-left" aria-hidden="true"></i> Volver a Dependencias</button>
      
      <div class="view-card">
        <div class="detail-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
          <div>
            <h2 id="tituloDependenciaDetalle" class="section-title" style="margin: 0; font-size: 22px; color: #0f172a;">-</h2>
            
            <!-- CONTROLES ESTÉTICOS DE FILTRO Y BÚSQUEDA -->
            <div class="detail-filters" style="display: flex; gap: 10px; margin-top: 10px; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap;">
              <span style="font-size: 12px; font-weight: 700; color: #475569;">🔍 Filtrar por:</span>
              
              <!-- Buscador por Radicado o Remitente -->
              <input type="text" id="inputBuscar" oninput="aplicarFiltrosRadicados()" placeholder="Buscar radicado, remitente o funcionario..." style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; width: 230px; outline: none; background: white;">

              <!-- Selector de Año -->
              <select id="filtroAno" onchange="aplicarFiltrosRadicados()" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155; font-weight: 600; cursor: pointer; background: white;">
                <option value="">Todos los Años</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>

              <!-- Selector de Mes -->
              <select id="filtroMes" onchange="aplicarFiltrosRadicados()" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155; font-weight: 600; cursor: pointer; background: white;">
                <option value="">Todos los Meses</option>
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
              <button class="detail-filter-button" type="button" onclick="aplicarFiltrosRadicados()"><i class="bi bi-funnel" aria-hidden="true"></i> Filtrar</button>
            </div>
            <div class="received-register-actions">
              <button id="abrirExportarPlanilla" class="received-register-button" type="button">
                <i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i>
                Descargar planilla de recibidos
              </button>
            </div>
          </div>

          <span class="detail-status-tag" style="font-size: 12px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 6px 12px; border-radius: 6px;">ESTADO GENERAL DE RADICADOS</span>
        </div>

        <div class="detail-current-period" aria-label="Mes y año actuales">
          <i class="bi bi-calendar3" aria-hidden="true"></i>
          <time id="periodoActual"></time>
        </div>

        <p class="detail-table-scroll-hint">Desliza la tabla horizontalmente para ver todas las columnas.</p>

        <div class="detail-table-scroll">
          <table class="table-custom">
            <thead>
              <tr>
                <th>PDF</th>
                <th>N° Radicado</th>
                <th>F. Radicación</th>
                <th>F. Entrega</th>
                <th>F. Vencimiento</th>
                <th>Estado</th>
                <th>Días Háb.</th>
                <th>Remitente</th>
                <th>Asunto</th>
                <th>Funcionario Asignado</th>
                <th>Acciones</th>
                <th>Respuesta</th>
                <th>F. Carga Respuesta</th>
                <th>Tipo de petición *</th>
              </tr>
            </thead>
            <tbody id="cuerpoTablaExclusiva">
              <!-- Se llena dinámicamente -->
            </tbody>
          </table>
        </div>
      </div>
      <dialog id="modalExportarPlanilla" class="received-register-dialog" aria-labelledby="tituloModalPlanilla">
        <form id="formExportarPlanilla" class="received-register-dialog-card">
          <div class="received-register-dialog-heading">
            <span class="received-register-dialog-icon"><i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i></span>
            <div>
              <h2 id="tituloModalPlanilla">Generar planilla de recibidos</h2>
              <p>Indica el rango de radicados que deseas incluir.</p>
            </div>
            <button id="cerrarModalPlanilla" class="received-register-close" type="button" aria-label="Cerrar">×</button>
          </div>
          <p id="dependenciaPlanilla" class="received-register-dependency"></p>
          <div class="received-register-range">
            <label>
              Desde el radicado
              <input id="radicadoDesdePlanilla" name="radicadoDesde" type="text" placeholder="Ej.: R-2026-03148" required autocomplete="off">
            </label>
            <label>
              Hasta el radicado
              <input id="radicadoHastaPlanilla" name="radicadoHasta" type="text" placeholder="Ej.: R-2026-03160" required autocomplete="off">
            </label>
          </div>
          <p id="errorExportarPlanilla" class="received-register-error" role="alert" hidden></p>
          <div class="received-register-dialog-actions">
            <button id="cancelarExportarPlanilla" class="received-register-cancel" type="button">Cancelar</button>
            <button id="confirmarExportarPlanilla" class="received-register-submit" type="submit">
              <i class="bi bi-download" aria-hidden="true"></i>
              Descargar Excel
            </button>
          </div>
        </form>
      </dialog>
    </div>

`;
