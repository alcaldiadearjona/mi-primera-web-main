export const informesMarkup = String.raw`<div id="pantallaInformes" style="display: none;">
      <header class="top-header reports-header institutional-header">
        <div class="top-header-content">
          <h1><i class="bi bi-bar-chart-line-fill" aria-hidden="true"></i> Informes</h1>
          <p>Una mirada clara a la gestión de radicados de Dependencias e IAS, consolidada por periodo.</p>
        </div>
        <div class="institutional-header-art" aria-hidden="true">
          <img src="assets/images/bandera-header.png" alt="">
        </div>
        <span class="institutional-header-accent" aria-hidden="true"></span>
      </header>

      <section class="reports-toolbar" aria-label="Filtros de informes">
        <div class="reports-source-switch" role="group" aria-label="Origen de los radicados">
          <button type="button" class="reports-source-button active" data-report-source="dependencias" aria-pressed="true">
            <i class="bi bi-buildings" aria-hidden="true"></i> Dependencias
          </button>
          <button type="button" class="reports-source-button" data-report-source="ias" aria-pressed="false">
            <i class="bi bi-bank" aria-hidden="true"></i> IAS
          </button>
        </div>
        <div class="reports-period-filters">
          <label class="reports-select-wrap reports-month-select">
            <span class="visually-hidden">Mes del informe</span>
            <i class="bi bi-calendar-month" aria-hidden="true"></i>
            <select id="filtroMesInformes" aria-label="Mes del informe">
              <option value="">Todo el año</option>
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
          </label>
          <label class="reports-select-wrap">
            <span class="visually-hidden">Año del informe</span>
            <i class="bi bi-calendar3" aria-hidden="true"></i>
            <select id="filtroAnoInformes" aria-label="Año del informe"></select>
          </label>
        </div>
      </section>
      <p id="informeIASAviso" class="report-source-notice" role="status" aria-live="polite" hidden></p>
      <p id="informeGraficasAviso" class="report-chart-status" role="status" aria-live="polite" hidden></p>

      <section class="reports-kpis" aria-label="Resumen del periodo">
        <article class="report-kpi report-kpi-total">
          <span class="report-kpi-icon"><i class="bi bi-file-earmark-text" aria-hidden="true"></i></span>
          <div><h2>Total de radicados</h2><strong id="informeTotal">0</strong><p id="informePeriodo">Todo el año</p></div>
        </article>
        <article class="report-kpi report-kpi-pending">
          <span class="report-kpi-icon"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
          <div class="report-kpi-copy">
            <h2>Pendientes</h2><strong id="informePendientes">0</strong>
            <p id="informePendientesDetalle">Sin respuesta registrada</p>
            <span id="informePendientesProgreso" class="report-kpi-progress" role="progressbar" aria-label="Porcentaje de radicados pendientes" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="informePendientesBar"></span></span>
          </div>
        </article>
        <article class="report-kpi report-kpi-resolved">
          <span class="report-kpi-icon"><i class="bi bi-check-circle-fill" aria-hidden="true"></i></span>
          <div class="report-kpi-copy">
            <h2>Resueltos</h2><strong id="informeResueltos">0</strong>
            <p id="informeResueltosDetalle">Con respuesta o estado cerrado</p>
            <span id="informeResueltosProgreso" class="report-kpi-progress" role="progressbar" aria-label="Porcentaje de radicados resueltos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="informeResueltosBar"></span></span>
          </div>
        </article>
        <article class="report-kpi report-kpi-extra">
          <span class="report-kpi-icon"><i id="informeExtraIcono" class="bi bi-exclamation-circle" aria-hidden="true"></i></span>
          <div class="report-kpi-copy">
            <h2 id="informeExtraTitulo">Vencidos</h2><strong id="informeExtra">0</strong>
            <p id="informeExtraDescripcion">Radicados extemporáneos</p>
            <span id="informeExtraProgreso" class="report-kpi-progress" role="progressbar" aria-label="Porcentaje de radicados vencidos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="informeExtraBar"></span></span>
          </div>
        </article>
      </section>

      <section class="reports-grid" aria-label="Gráficas de informes">
        <article class="report-panel report-ranking-panel" aria-labelledby="informeRankingTitulo">
          <header class="report-panel-heading">
            <span class="report-panel-icon"><i id="informeRankingIcono" class="bi bi-file-earmark-bar-graph" aria-hidden="true"></i></span>
            <div><h2 id="informeRankingTitulo">PQRS por Dependencia</h2><p>Distribución en el periodo seleccionado</p></div>
          </header>
          <div class="report-chart-frame report-ranking-chart">
            <canvas id="informeRanking" role="img" aria-label="Radicados por Dependencia"></canvas>
          </div>
          <p id="informeRankingVacio" class="report-empty" hidden>No hay radicados para mostrar en este periodo.</p>
        </article>

        <div class="report-visual-stack">
          <article class="report-panel report-ias-panel" aria-labelledby="informeIASGraficaTitulo">
            <header class="report-panel-heading">
              <span class="report-panel-icon"><i class="bi bi-pie-chart-fill" aria-hidden="true"></i></span>
              <div><h2 id="informeIASGraficaTitulo">PQRS por IAS</h2><p>Participación de radicados registrados en IAS</p></div>
            </header>
            <div class="report-donut-layout">
              <div class="report-chart-frame report-donut-chart">
                <canvas id="informeIASGrafica" role="img" aria-label="Participación de radicados por IAS"></canvas>
              </div>
              <ul id="informeIASLeyenda" class="report-donut-legend" aria-label="Detalle de radicados por IAS"></ul>
              <p id="informeIASVacio" class="report-empty" hidden>No hay radicados IAS para mostrar en este periodo.</p>
            </div>
          </article>

          <article class="report-panel report-trend-panel" aria-labelledby="informeTendenciaTitulo">
            <header class="report-panel-heading">
              <span class="report-panel-icon"><i class="bi bi-graph-up-arrow" aria-hidden="true"></i></span>
              <div><h2 id="informeTendenciaTitulo">Evolución mensual</h2><p id="informeTendenciaSubtitulo">Radicados recibidos durante el año</p></div>
            </header>
            <div class="report-chart-frame report-trend-chart">
              <canvas id="informeTendencia" role="img" aria-label="Evolución mensual de radicados"></canvas>
            </div>
          </article>
        </div>
      </section>

      <section class="report-panel report-history-panel" aria-labelledby="informeHistoricoTitulo">
        <header class="report-panel-heading">
          <span class="report-panel-icon"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
          <div><h2 id="informeHistoricoTitulo">Histórico de informes</h2><p>Resumen mensual de los radicados disponibles</p></div>
        </header>
        <div class="report-history-scroll">
          <table class="report-history-table">
            <thead><tr><th>Periodo</th><th>Total</th><th>Pendientes</th><th>Resueltos</th><th id="informeColumnaExtra">Vencidos</th></tr></thead>
            <tbody id="informeHistorico"></tbody>
          </table>
        </div>
        <p id="informeHistoricoVacio" class="report-empty" hidden>No hay radicados registrados para este periodo.</p>
      </section>
    </div>`;
