export const dependenciasMarkup = String.raw`<div id="vista-dependencias" style="display: none;">
      <!-- Tarjeta principal -->
      <div class="view-card card shadow-sm institutional-header dependencies-header" style="margin-bottom: 25px;">
        <div class="top-header-content">
          <h2 class="section-title"><i class="bi bi-buildings" aria-hidden="true"></i> Dependencias Municipales</h2>
          <p>Selecciona una dependencia para gestionar sus trámites y correspondencia.</p>
        </div>
        <div class="institutional-header-art" aria-hidden="true">
          <img src="assets/images/bandera-header.png" alt="">
        </div>
        <span class="institutional-header-accent" aria-hidden="true"></span>
      </div>

      <!-- Buscador -->
      <div class="dependencias-toolbar">
        <span style="font-size: 13px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
          <i class="bi bi-search" aria-hidden="true"></i> Buscar:
        </span>
        <input type="text" id="inputBuscarDependencia" oninput="filtrarDependenciasPorRadicadoOREmitente()" placeholder="Buscar dependencia, N° radicado o remitente..." style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; width: 260px; outline: none; background: white; color: #334155;">
        <button class="dependencias-filter-chip" type="button" aria-label="Limpiar búsqueda" onclick="limpiarBusquedaDependencias()">
          <i class="bi bi-sliders" aria-hidden="true"></i>
          <span>Filtros</span>
          <span class="dependencias-filter-clear" aria-hidden="true"><i class="bi bi-x"></i></span>
        </button>
        <button id="abrirExportarPlanilla" class="received-register-button" type="button">
          <i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i>
          Descargar planilla
        </button>
      </div>

      <div class="dependencias-grid" id="contenedorDependencias">
        <div class="dep-card" style="border-top-color: #2563eb;" onclick="abrirDependencia('Secretaría de Gobierno')">
          <div class="dep-card-heading"><h3>Secretaría de Gobierno</h3><i class="bi bi-bank dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Gobierno" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #00a838;" onclick="abrirDependencia('Secretaría de Planeación')">
          <div class="dep-card-heading"><h3>Secretaría de Planeación</h3><i class="bi bi-shield-lock dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Planeación" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #dc2626;" onclick="abrirDependencia('Oficina de Gestion del Riesgo y Desastres')">
          <div class="dep-card-heading"><h3>Oficina de Gestion del Riesgo y Desastres</h3><i class="bi bi-fire dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Oficina de Gestion del Riesgo y Desastres" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #ec4899;" onclick="abrirDependencia('Oficina de Desarrollo Social')">
          <div class="dep-card-heading"><h3>Oficina de Desarrollo Social</h3><i class="bi bi-people dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Oficina de Desarrollo Social" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #06b6d4;" onclick="abrirDependencia('Secretaría de Salud')">
          <div class="dep-card-heading"><h3>Secretaría de Salud</h3><i class="bi bi-shield-plus dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Salud" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #475569;" onclick="abrirDependencia('Control Interno')">
          <div class="dep-card-heading"><h3>Control Interno</h3><i class="bi bi-clipboard-data dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Control Interno" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #8b5cf6;" onclick="abrirDependencia('Oficina Juridica')">
          <div class="dep-card-heading"><h3>Oficina Juridica</h3><i class="bi bi-people dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Oficina Juridica" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #f59e0b;" onclick="abrirDependencia('Despacho del Alcalde')">
          <div class="dep-card-heading"><h3>Despacho del Alcalde</h3><i class="bi bi-building-gear dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Despacho del Alcalde" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #00a838;" onclick="abrirDependencia('Secretaría de Umata')">
          <div class="dep-card-heading"><h3>Secretaría de Umata</h3><i class="bi bi-map dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Umata" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #3b82f6;" onclick="abrirDependencia('Secretaría de Educación')">
          <div class="dep-card-heading"><h3>Secretaría de Educación</h3><i class="bi bi-mortarboard dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Educación" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #9333ea;" onclick="abrirDependencia('Secretaría de Hacienda')">
          <div class="dep-card-heading"><h3>Secretaría de Hacienda</h3><i class="bi bi-cash-coin dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Hacienda" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #14b8a6;" onclick="abrirDependencia('Sisben')">
          <div class="dep-card-heading"><h3>Sisben</h3><i class="bi bi-arrow-repeat dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Sisben" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #6366f1;" onclick="abrirDependencia('Talento Humano')">
          <div class="dep-card-heading"><h3>Talento Humano</h3><i class="bi bi-person-check dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Talento Humano" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #eab308;" onclick="abrirDependencia('Secretaría de Transito y Transporte')">
          <div class="dep-card-heading"><h3>Secretaría de Transito y Transporte</h3><i class="bi bi-sign-turn-right dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Secretaría de Transito y Transporte" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
        <div class="dep-card" style="border-top-color: #f43f5e;" onclick="abrirDependencia('Gestion Social')">
          <div class="dep-card-heading"><h3>Gestion Social</h3><i class="bi bi-heart dep-card-icon" aria-hidden="true"></i></div>
          <span id="cant-Gestion Social" style="font-size: 13px; color: #64748b; font-weight: 600; display: block; margin-top: 8px;">0 radicados</span>
        </div>
      </div>
      <dialog id="modalExportarPlanilla" class="received-register-dialog" aria-labelledby="tituloModalPlanilla">
        <form id="formExportarPlanilla" class="received-register-dialog-card">
          <div class="received-register-dialog-heading">
            <span class="received-register-dialog-icon"><i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i></span>
            <div>
              <h2 id="tituloModalPlanilla">Generar planilla general de recibidos</h2>
              <p>Combina los filtros que necesites para preparar el Excel.</p>
            </div>
            <button id="cerrarModalPlanilla" class="received-register-close" type="button" aria-label="Cerrar">×</button>
          </div>
          <div class="received-register-filters">
            <section class="received-register-filter-section" aria-labelledby="tituloFiltroRadicado">
              <h3 id="tituloFiltroRadicado"><i class="bi bi-hash" aria-hidden="true"></i> Rango de radicados <span>Opcional</span></h3>
              <div class="received-register-range">
            <label>
                  Desde
                  <input id="radicadoDesdePlanilla" name="radicadoDesde" type="text" placeholder="Ej.: R-2026-03148" autocomplete="off">
            </label>
            <label>
                  Hasta
                  <input id="radicadoHastaPlanilla" name="radicadoHasta" type="text" placeholder="Ej.: R-2026-03160" autocomplete="off">
            </label>
              </div>
            </section>
            <section class="received-register-filter-section" aria-labelledby="tituloFiltroFecha">
              <h3 id="tituloFiltroFecha"><i class="bi bi-calendar3" aria-hidden="true"></i> Fecha de radicación <span>Opcional</span></h3>
              <div class="received-register-range received-register-date-range">
                <label>
                  Desde
                  <input id="fechaDesdePlanilla" name="fechaDesde" type="date">
                </label>
                <label>
                  Hasta
                  <input id="fechaHastaPlanilla" name="fechaHasta" type="date">
                </label>
              </div>
              <div class="received-register-range received-register-period-range">
                <label>
                  Mes
                  <select id="mesPlanilla" name="mes">
                    <option value="">Todos los meses</option>
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
                <label>
                  Año
                  <input id="anoPlanilla" name="ano" type="number" min="1900" max="9999" step="1" placeholder="Ej.: 2026">
                </label>
              </div>
            </section>
            <section class="received-register-filter-section" aria-labelledby="tituloFiltroDependencia">
              <h3 id="tituloFiltroDependencia"><i class="bi bi-buildings" aria-hidden="true"></i> Dependencias <span>Puedes elegir varias</span></h3>
              <label class="received-register-select-all">
                <input id="todasDependenciasPlanilla" type="checkbox" checked>
                Todas las dependencias
              </label>
              <div id="dependenciasPlanilla" class="received-register-dependencies" aria-label="Selecciona las dependencias"></div>
            </section>
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

    <!-- VISTA 3: PANTALLA DE LA DEPENDENCIA SELECCIONADA -->
    `;
