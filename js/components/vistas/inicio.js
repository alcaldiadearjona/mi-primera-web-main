export const inicioMarkup = String.raw`<div id="pantallaInicio">
      <header class="top-header">
        <div class="top-header-content">
          <h1><i id="iconoPantallaPrincipal" class="bi bi-folder2-open" aria-hidden="true"></i> <span id="tituloPantallaPrincipal">Ventanilla Única</span></h1>
          <p id="subtituloPantallaPrincipal">Sistema Institucional de Radicación de Correspondencia y PQRS</p>
        </div>
      </header>

      <div class="dashboard-layout">
        <section class="dashboard-form-column" aria-labelledby="accionesPrincipales">
          <h2 id="accionesPrincipales" class="section-title"><i class="bi bi-grid-1x2-fill" aria-hidden="true"></i> Acciones Principales</h2>
          <button class="dashboard-form-toggle is-collapsed" type="button" aria-expanded="false" aria-controls="contenedorFormulario" onclick="toggleFormulario()">
            <span><i class="bi bi-plus-circle-fill" aria-hidden="true"></i> <span id="textoAccionFormulario">Ingresar nueva PQRS</span></span>
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
          </button>
          <span id="ayudaFormulario" class="dashboard-form-hint">Registra y asigna una solicitud a su dependencia destino.</span>

          <div id="contenedorFormulario" class="form-card" style="display: none;">
            <div class="form-header-bar">
              <i class="bi bi-pencil-square" aria-hidden="true"></i> <span id="tituloFormularioRadicado">Formulario de Radicación de Solicitud / PQRS</span>
            </div>

            <form id="pqrsForm">
              <div class="form-grid">
            
            <div class="form-group">
              <label for="radicado">Número de Radicado</label>
              <input type="text" id="radicado" placeholder="Ej: R-2026-03148" required>
            </div>

            <div class="form-group">
              <label for="dependencia">Dependencia Destino</label>
              <select id="dependencia" required>
                <option value="">-- Seleccionar Dependencia --</option>
                <option value="Secretaría de Gobierno">Secretaría de Gobierno</option>
                <option value="Secretaría de Planeación">Secretaría de Planeación</option>
                <option value="Oficina de Gestion del Riesgo y Desastres">Oficina de Gestion del Riesgo y Desastres</option>
                <option value="Oficina de Desarrollo Social">Oficina de Desarrollo Social</option>
                <option value="Secretaría de Salud">Secretaría de Salud</option>
                <option value="Control Interno">Control Interno</option>
                <option value="Oficina Juridica">Oficina Juridica</option>
                <option value="Despacho del Alcalde">Despacho del Alcalde</option>
                <option value="Secretaría de Umata">Secretaría de Umata</option>
                <option value="Secretaría de Educación">Secretaría de Educación</option>
                <option value="Secretaría de Hacienda">Secretaría de Hacienda</option>
                <option value="Sisben">Sisben</option>
                <option value="Talento Humano">Talento Humano</option>
                <option value="Secretaría de Transito y Transporte">Secretaría de Transito y Transporte</option>
                <option value="Gestion Social">Gestion Social</option>
              </select>
            </div>

            <div class="form-group">
              <label for="estadoSolicitud">Estado Inicial</label>
              <select id="estadoSolicitud" required>
                <option value="VIGENTE">VIGENTE</option>
              </select>
            </div>

            <div class="form-group">
              <label for="fechaRadicacion">F. Radicación (Manual)</label>
              <input type="date" id="fechaRadicacion" required>
            </div>

            <div class="form-group">
              <label for="fechaEntregaManual">F. Entrega (Manual)</label>
              <input type="date" id="fechaEntregaManual" required>
            </div>

            <div class="form-group">
              <label for="diasHabiles">Días Hábiles</label>
              <input type="number" id="diasHabiles" value="15" required>
            </div>

            <div class="form-group">
              <label for="fechaEntrega">F. Vencimiento (Automática)</label>
              <input type="date" id="fechaEntrega" readonly style="background-color: #e2e8f0; cursor: not-allowed;" required>
            </div>

            <div class="form-group full-width">
              <label for="remitente">Nombre y Datos del Remitente</label>
              <input type="text" id="remitente" placeholder="Ej: Francisco Javier Pacheco Charris" required>
            </div>

            <div class="form-group full-width">
              <label for="asunto">Asunto de la Comunicación</label>
              <textarea id="asunto" placeholder="Escriba el resumen del Derecho de Petición / PQRS..." required></textarea>
            </div>

            <div class="form-group full-width">
              <label for="solicitudPdf">Solicitud Escaneada (Archivo PDF)</label>
              <input type="file" id="solicitudPdf" accept=".pdf">
            </div>

              </div>

              <button type="submit" id="btnGuardarRadicado" class="btn-guardar">
                <svg id="spinnerGuardarRadicado" style="display: none; width: 18px; height: 18px; animation: girar 0.8s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span id="textoBtnGuardar">Guardar Radicado</span>
              </button>
            </form>
          </div>
        </section>

        <aside class="dashboard-summary" aria-label="Resumen de PQRS">
          <div class="dashboard-stats" aria-live="polite">
            <article class="summary-card summary-card-received">
              <div class="summary-card-top">
                <span class="summary-icon"><i class="bi bi-folder2-open" aria-hidden="true"></i></span>
                <span class="summary-badge">Recibidas</span>
              </div>
              <h3 id="resumenTotal" aria-label="Total de solicitudes recibidas">—</h3>
              <div class="summary-card-bottom">
                <span>Recibidas</span>
                <svg class="summary-trend" viewBox="0 0 54 24" aria-hidden="true">
                  <path class="summary-trend-fill" d="M1 21 9 18 14 19 20 11 25 14 31 5 36 10 43 12 49 7 53 3V24H1Z"></path>
                  <path class="summary-trend-line" d="m1 21 8-3 5 1 6-8 5 3 6-9 5 5 7 2 6-5 4-4"></path>
                </svg>
              </div>
            </article>
            <article class="summary-card summary-card-progress">
              <div class="summary-card-top">
                <span class="summary-icon"><i class="bi bi-calendar-check" aria-hidden="true"></i></span>
                <span class="summary-badge">En Trámite</span>
              </div>
              <h3 id="resumenEnTramite">—</h3>
              <div class="summary-card-bottom">
                <span>En Trámite</span>
                <svg class="summary-trend" viewBox="0 0 54 24" aria-hidden="true">
                  <path class="summary-trend-fill" d="m1 19 8-3 5 2 6-5 5 2 6-7 5 4 7-1 6-5 4 2V24H1Z"></path>
                  <path class="summary-trend-line" d="m1 19 8-3 5 2 6-5 5 2 6-7 5 4 7-1 6-5 4 2"></path>
                </svg>
              </div>
            </article>
            <article class="summary-card summary-card-resolved">
              <div class="summary-card-top">
                <span class="summary-icon"><i class="bi bi-check2-circle" aria-hidden="true"></i></span>
                <span class="summary-badge">Resueltas</span>
              </div>
              <h3 id="resumenResueltas">—</h3>
              <div class="summary-card-bottom">
                <span>Resueltas</span>
                <svg class="summary-trend" viewBox="0 0 54 24" aria-hidden="true">
                  <path class="summary-trend-fill" d="m1 20 8-4 5 2 6-2 5-7 6 3 5-2 7 2 6-8 4 2V24H1Z"></path>
                  <path class="summary-trend-line" d="m1 20 8-4 5 2 6-2 5-7 6 3 5-2 7 2 6-8 4 2"></path>
                </svg>
              </div>
            </article>
          </div>

          <section class="recent-card" aria-labelledby="tituloRecientes">
            <div class="recent-card-heading">
              <div>
                <h2 id="tituloRecientes">Radicados recientes</h2>
                <p>Últimas solicitudes recibidas</p>
              </div>
              <i class="bi bi-clock-history" aria-hidden="true"></i>
            </div>
            <div id="resumenRecientes" class="recent-list" aria-live="polite">
              <p class="recent-empty">Cargando radicados...</p>
            </div>
          </section>
        </aside>
      </div>
    </div>

    <!-- VISTA 2: SECCIÓN DE DEPENDENCIAS -->
    `;
