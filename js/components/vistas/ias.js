export const iasMarkup = String.raw`<div id="pantallaIAS" style="display: none;">
      <header class="top-header institutional-header">
        <div class="top-header-content">
          <h1><i class="bi bi-bank" aria-hidden="true"></i> IAS</h1>
          <p>Atención a Contraloría, Procuraduría y demás entes de control</p>
        </div>
        <div class="institutional-header-art" aria-hidden="true">
          <img src="assets/images/bandera-header.png" alt="">
        </div>
        <span class="institutional-header-accent" aria-hidden="true"></span>
      </header>

      <section class="ias-page" aria-label="Entidades IAS">
        <section class="dashboard-form-column ias-form-column ias-manage-only" aria-labelledby="tituloAccionesIAS">
          <h2 id="tituloAccionesIAS" class="section-title"><i class="bi bi-grid-1x2-fill" aria-hidden="true"></i> Acciones IAS</h2>
          <button id="toggleFormularioIA" class="dashboard-form-toggle is-collapsed" type="button" aria-expanded="false" aria-controls="contenedorFormularioIA">
            <span><i class="bi bi-plus-circle-fill" aria-hidden="true"></i> Ingresar Nueva IA</span>
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
          </button>
          <span class="dashboard-form-hint">Registra una comunicación y asígnala a la entidad de control correspondiente.</span>

          <div id="contenedorFormularioIA" class="form-card" style="display:none;">
            <div class="form-header-bar">
              <i class="bi bi-pencil-square" aria-hidden="true"></i> Formulario de Radicación IA
            </div>
            <form id="formNuevaIA">
              <div class="form-grid">
                <div class="form-group">
                  <label for="radicadoIA">Número de Radicado</label>
                  <input id="radicadoIA" type="text" placeholder="Ej: R-2026-03148" required>
                </div>
                <div class="form-group">
                  <label for="destinoIA">Destino</label>
                  <select id="destinoIA" required>
                    <option value="">-- Seleccionar IAS --</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="tipoCanalIA">Tipo de Canal</label>
                  <select id="tipoCanalIA" required>
                    <option value="">-- Seleccionar tipo de canal --</option>
                    <option value="Virtual">Virtual</option>
                    <option value="Presencial">Presencial</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="estadoInicialIA">Estado Inicial</label>
                  <select id="estadoInicialIA" required>
                    <option value="VIGENTE">VIGENTE</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="fechaRadicacionIA">F. Radicación</label>
                  <input id="fechaRadicacionIA" type="date" required>
                </div>
                <div class="form-group">
                  <label for="diasHabilesIA">Días Hábiles</label>
                  <input id="diasHabilesIA" type="number" min="1" value="15" required>
                </div>
                <div class="form-group">
                  <label for="fechaVencimientoIA">F. Vencimiento</label>
                  <input id="fechaVencimientoIA" type="date" disabled>
                </div>
                <div class="form-group full-width">
                  <label for="remitenteIA">Nombre y Datos del Remitente</label>
                  <input id="remitenteIA" type="text" required>
                </div>
                <div class="form-group full-width">
                  <label for="asuntoIA">Asunto de la Comunicación</label>
                  <textarea id="asuntoIA" required></textarea>
                </div>
                <div class="form-group full-width">
                  <label for="solicitudPdfIA">Solicitud Escaneada (Archivo PDF)</label>
                  <input id="solicitudPdfIA" type="file" accept=".pdf,application/pdf">
                </div>
              </div>
              <button type="submit" id="btnGuardarIA" class="btn-guardar">
                <span id="textoBtnGuardarIA">Guardar IA</span>
              </button>
            </form>
          </div>
        </section>

        <div class="dependencias-toolbar ias-toolbar">
          <span style="font-size: 13px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            <i class="bi bi-search" aria-hidden="true"></i> Buscar:
          </span>
          <input id="buscarEntidadIAS" type="text" placeholder="Buscar entidad, N° radicado o remitente..." aria-label="Buscar entidad, número de radicado o remitente">
          <button id="limpiarBusquedaIAS" class="dependencias-filter-chip" type="button" aria-label="Limpiar búsqueda IAS">
            <i class="bi bi-sliders" aria-hidden="true"></i>
            <span>Filtros</span>
            <span class="dependencias-filter-clear" aria-hidden="true"><i class="bi bi-x"></i></span>
          </button>
        </div>

        <div id="tarjetasEntidadesIAS" class="ias-entities-grid" aria-live="polite">
          <p class="ias-empty-state" role="status">Cargando radicados de IAS...</p>
        </div>

        <section id="detalleEntidadIAS" class="ias-detail-section" aria-labelledby="tituloDetalleIAS" hidden>
          <button id="volverEntidadesIAS" class="ias-back-button" type="button">
            <i class="bi bi-arrow-left" aria-hidden="true"></i> Volver a IAS
          </button>
          <div class="view-card ias-detail-card">
            <div class="ias-detail-heading">
              <h2 id="tituloDetalleIAS" class="section-title"></h2>
              <span id="conteoDetalleIAS" class="ias-count-badge"></span>
            </div>

            <div class="ias-filters" role="search" aria-label="Filtros de radicados IAS">
              <input id="buscarRadicadoIAS" type="search" placeholder="Buscar radicado, remitente o asunto..." aria-label="Buscar radicado, remitente o asunto">
              <select id="filtroAnoIAS" aria-label="Filtrar por año">
                <option value="">Todos los Años</option>
              </select>
              <select id="filtroMesIAS" aria-label="Filtrar por mes">
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
              <button id="aplicarFiltrosIAS" class="ias-filter-button" type="button">
                <i class="bi bi-funnel" aria-hidden="true"></i> Filtrar
              </button>
            </div>

            <div class="ias-current-period">
              <i class="bi bi-calendar3" aria-hidden="true"></i>
              <time id="periodoDetalleIAS"></time>
            </div>

            <p class="detail-table-scroll-hint">Desliza la tabla horizontalmente para ver todas las columnas.</p>
            <div class="detail-table-scroll ias-table-scroll">
              <table class="table-custom ias-table">
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
                    <th>Tipo de Canal</th>
                  </tr>
                </thead>
                <tbody id="cuerpoTablaIAS"></tbody>
              </table>
            </div>
          </div>
        </section>
      </section>
    </div>
`;
