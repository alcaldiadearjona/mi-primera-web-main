export const iasMarkup = String.raw`<div id="pantallaIAS" style="display: none;">
      <header class="top-header">
        <div class="top-header-content">
          <h1><i class="bi bi-bank" aria-hidden="true"></i> IAS</h1>
          <p>Atención a Contraloría, Procuraduría y demás entes de control</p>
        </div>
      </header>

      <section class="ias-page" aria-label="Entidades IAS">
        <div class="dependencias-toolbar ias-toolbar">
          <input id="buscarEntidadIAS" type="search" placeholder="Buscar entidad, N° radicado o remitente..." aria-label="Buscar entidad, número de radicado o remitente">
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
                    <th>N° Radicado</th>
                    <th>F. Radicación</th>
                    <th>Remitente</th>
                    <th>Asunto</th>
                    <th>Estado</th>
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
