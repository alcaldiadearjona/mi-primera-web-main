export const inicioMarkup = String.raw`<div id="pantallaInicio">
      <header class="top-header institutional-header">
        <div class="top-header-content">
          <h1><i id="iconoPantallaPrincipal" class="bi bi-folder2-open" aria-hidden="true"></i> <span id="tituloPantallaPrincipal">Ventanilla Única</span></h1>
          <p id="subtituloPantallaPrincipal">Sistema Institucional de Radicación de Correspondencia y PQRS</p>
        </div>
        <div class="institutional-header-art" aria-hidden="true">
          <img src="assets/images/bandera-header.png" alt="">
        </div>
        <span class="institutional-header-accent" aria-hidden="true"></span>
      </header>

      <p id="saludoSesion" class="session-greeting session-greeting-inline" aria-live="polite" hidden>
        <span class="session-greeting-label">Hola</span>
        <strong id="nombreSaludoSesion"></strong>
      </p>

      <div class="dashboard-layout">
        <section class="dashboard-form-column" aria-labelledby="accionesPrincipales">
          <h2 id="accionesPrincipales" class="section-title"><i class="bi bi-grid-1x2-fill" aria-hidden="true"></i> Acciones Principales</h2>
          <button id="toggleRecepcionPQRSF" class="dashboard-form-toggle is-collapsed" type="button" aria-expanded="false" aria-controls="contenedorFormularioRecepcion" onclick="abrirRecepcionPQRSF()" hidden>
            <span><i class="bi bi-plus-circle-fill" aria-hidden="true"></i> <span>Recepción de PQRSF</span></span>
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
          </button>
          <div id="contenedorFormularioRecepcion" class="form-card" style="display: none;">
            <div class="form-header-bar">
              <i class="bi bi-inbox" aria-hidden="true"></i> <span>Recepción de PQRSF</span>
            </div>
            <span class="dashboard-form-hint">Registra lo que tengas disponible. La dependencia responsable puede quedar vacía y asignarse en Gestionar PQRSF.</span>
            <form id="formRecepcionPQRSF">
              <div class="form-grid">
                <div class="form-group">
                  <label for="radicadoRecepcion">Número de Radicado</label>
                  <input type="text" id="radicadoRecepcion" readonly placeholder="Se asignará automáticamente al guardar">
                </div>
                <div class="form-group">
                  <label for="fechaRadicacionRecepcion">Fecha de Radicación</label>
                  <input type="text" id="fechaRadicacionRecepcion" readonly>
                </div>
                <div class="form-group">
                  <label for="horaRadicacionRecepcion">Hora de Radicación</label>
                  <input type="text" id="horaRadicacionRecepcion" readonly>
                </div>
                <div class="form-group">
                  <label for="tipoCanalRecepcion">Tipo de Canal</label>
                  <select id="tipoCanalRecepcion">
                    <option value="">Seleccionar Tipo de Canal</option>
                    <option value="Virtual">Virtual</option>
                    <option value="Presencial">Presencial</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="tipoNotificacionRecepcion">Notificación de Respuesta</label>
                  <select id="tipoNotificacionRecepcion" required>
                    <option value="">-- Seleccionar medio --</option>
                    <option value="Correo">Correo</option>
                    <option value="Celular">Celular</option>
                    <option value="Presencial">Presencial</option>
                  </select>
                </div>
                <div class="form-group">
                  <label id="etiquetaContactoNotificacionRecepcion" for="contactoNotificacionRecepcion">Dato de Notificación</label>
                  <input type="text" id="contactoNotificacionRecepcion" disabled>
                </div>
                <div class="form-group full-width">
                  <label for="remitenteRecepcion">Nombre Completo del Remitente</label>
                  <input type="text" id="remitenteRecepcion" maxlength="40">
                </div>
                <div class="form-group full-width">
                  <label for="asuntoRecepcion">Asunto de la Comunicación</label>
                  <textarea id="asuntoRecepcion" maxlength="80"></textarea>
                </div>
                <div class="form-group">
                  <label for="foliosRecepcion">Folios <span aria-hidden="true">*</span></label>
                  <input type="number" id="foliosRecepcion" min="1" step="1" required>
                </div>
                <div class="form-group">
                  <label for="anexosRecepcion">Anexos <span aria-hidden="true">*</span></label>
                  <input type="number" id="anexosRecepcion" min="0" step="1" required>
                </div>
                <div class="form-group full-width">
                  <label for="dependenciaResponsableRecepcion">Dependencia Responsable del Trámite (opcional)</label>
                  <select id="dependenciaResponsableRecepcion">
                    <option value="">-- Seleccionar dependencia --</option>
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
                  <label for="tiempoRespuestaRecepcion">Tiempo de Respuesta (días hábiles)</label>
                  <input type="number" id="tiempoRespuestaRecepcion" min="1" step="1">
                </div>
                <div class="form-group full-width">
                  <label for="observacionesRecepcion">Observaciones</label>
                  <textarea id="observacionesRecepcion"></textarea>
                </div>
                <div class="form-group full-width">
                  <label for="archivoPdfRecepcion">Documento de la solicitud (PDF opcional)</label>
                  <input type="file" id="archivoPdfRecepcion" accept=".pdf,application/pdf" aria-describedby="ayudaArchivoPdfRecepcion">
                  <small id="ayudaArchivoPdfRecepcion">Adjunta un archivo PDF válido de máximo 30 MB, si está disponible.</small>
                </div>
              </div>
              <label class="reception-no-number-option" for="sinNumeroRadicadoRecepcion">
                <input type="checkbox" id="sinNumeroRadicadoRecepcion">
                <span>La petición no requiere número de radicado</span>
              </label>
              <button type="submit" id="btnGuardarRecepcion" class="btn-guardar">
                <svg id="spinnerGuardarRecepcion" style="display: none; width: 18px; height: 18px; animation: girar 0.8s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span id="textoBtnGuardarRecepcion">Guardar Recepción</span>
              </button>
            </form>
          </div>
          <button id="toggleGestionPQRSF" class="dashboard-form-toggle is-collapsed" type="button" aria-expanded="false" aria-controls="contenedorFormulario pqrsPendientesGestion" onclick="toggleFormulario()">
            <span><i class="bi bi-plus-circle-fill" aria-hidden="true"></i> <span id="textoAccionFormulario">Gestionar PQRSF</span></span>
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
          </button>

          <div id="contenidoGestionPQRSF">
            <div id="contenedorFormulario" class="form-card" style="display: none;">
              <div class="form-header-bar">
                <i class="bi bi-pencil-square" aria-hidden="true"></i> <span id="tituloFormularioRadicado">Formulario de Radicación de Solicitud / PQRS</span>
              </div>
              <span id="ayudaFormulario" class="dashboard-form-hint">Selecciona una PQRS pendiente a la derecha para cargarla en este formulario.</span>
            
              <form id="pqrsForm">
                <div class="form-grid">
            <div id="grupoRadicado" class="form-group">
              <label for="radicado">Número de Radicado</label>
              <input type="text" id="radicado" required>
            </div>

            <div id="grupoDependenciaDestino" class="form-group">
              <label id="etiquetaDependenciaDestino" for="alternarDependenciasPqrs">Dependencias Destino</label>
              <div id="selectorDependenciasPqrs" class="pqrs-dependency-selector">
                <button id="alternarDependenciasPqrs" type="button" aria-expanded="false" aria-controls="opcionesDependenciasPqrs">
                  <span id="resumenDependenciasPqrs">-- Seleccionar Dependencias --</span>
                  <i class="bi bi-chevron-down" aria-hidden="true"></i>
                </button>
                <div id="opcionesDependenciasPqrs" class="pqrs-dependency-options" hidden>
                  <input id="buscarDependenciaPqrs" type="search" autocomplete="off" placeholder="Escribe para buscar..." aria-label="Buscar dependencia destino">
                  <div id="listaOpcionesDependenciasPqrs" role="group" aria-labelledby="etiquetaDependenciaDestino"></div>
                  <p id="sinResultadosDependenciasPqrs" class="pqrs-dependency-no-results" hidden>No se encontraron dependencias.</p>
                </div>
              </div>
              <small id="dependenciaLiderPqrs" class="dashboard-form-hint" hidden></small>
              <select id="dependencia" hidden aria-hidden="true" tabindex="-1">
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

            <div id="grupoTipoCanal" class="form-group">
              <label for="tipoCanal">Tipo de Canal</label>
              <select id="tipoCanal" required>
                <option value="">Seleccionar Tipo de Canal</option>
                <option value="Virtual">Virtual</option>
                <option value="Presencial">Presencial</option>
              </select>
            </div>

            <div id="grupoTipoNotificacionCiudadano" class="form-group">
              <label for="tipoNotificacionCiudadano">Notificación de Respuesta</label>
              <select id="tipoNotificacionCiudadano" required>
                <option value="">-- Seleccionar medio --</option>
                <option value="Correo">Correo</option>
                <option value="Celular">Celular</option>
                <option value="Presencial">Presencial</option>
              </select>
            </div>
            <div id="grupoContactoNotificacionCiudadano" class="form-group">
              <label id="etiquetaContactoNotificacionCiudadano" for="contactoNotificacionCiudadano">Dato de Notificación</label>
              <input type="text" id="contactoNotificacionCiudadano" disabled>
            </div>

            <div id="grupoEstadoSolicitud" class="form-group">
              <label for="estadoSolicitud">Estado Inicial</label>
              <select id="estadoSolicitud" required>
                <option value="VIGENTE">VIGENTE</option>
              </select>
            </div>

            <div id="grupoFechaRadicacion" class="form-group">
              <label for="fechaRadicacion">F. Radicación (Manual)</label>
              <input type="date" id="fechaRadicacion" required>
            </div>

            <div id="grupoFechaEntregaManual" class="form-group">
              <label for="fechaEntregaManual">F. Entrega (Manual)</label>
              <input type="date" id="fechaEntregaManual" required>
            </div>

            <div id="grupoDiasHabiles" class="form-group">
              <label for="diasHabiles">Días Hábiles</label>
              <input type="number" id="diasHabiles" value="15" required>
            </div>

            <div id="grupoFechaEntrega" class="form-group">
              <label for="fechaEntrega">F. Vencimiento (Automática)</label>
              <input type="date" id="fechaEntrega" readonly style="background-color: #e2e8f0; cursor: not-allowed;" required>
            </div>

            <div id="grupoRemitente" class="form-group full-width">
              <label for="remitente">Nombre Completo del Remitente</label>
              <input type="text" id="remitente" maxlength="40" required>
            </div>

            <div id="grupoAsunto" class="form-group full-width">
              <label for="asunto">Asunto de la Comunicación</label>
              <textarea id="asunto" maxlength="80" required></textarea>
            </div>

            <div class="form-group">
              <label for="folios">Folios <span aria-hidden="true">*</span></label>
              <input id="folios" type="number" min="1" step="1" required>
            </div>
            <div class="form-group">
              <label for="anexos">Anexos (si no tiene, ingrese 0) <span aria-hidden="true">*</span></label>
              <input id="anexos" type="number" min="0" step="1" required>
            </div>

            <div id="grupoSolicitudPdf" class="form-group full-width">
              <label for="solicitudPdf">Adjuntar Oficio (Archivo PDF)</label>
              <input type="file" id="solicitudPdf" accept=".pdf">
              <small id="ayudaSolicitudArchivo" hidden></small>
              <div id="selectorPdfGestion" class="pqrs-pdf-management-selector" hidden>
                <label id="etiquetaPdfGestion" for="abrirSelectorPdfGestion">Oficio de gestión (PDF obligatorio)</label>
                <button id="abrirSelectorPdfGestion" class="pqrs-pdf-selector-trigger" type="button" aria-haspopup="dialog" aria-controls="modalSeleccionarPdfGestion">
                  <span id="nombrePdfGestionSeleccionado">Buscar PDF en Google Drive</span>
                  <i class="bi bi-chevron-down" aria-hidden="true"></i>
                </button>
                <input id="pdfGestionSeleccionado" type="hidden">
                <small id="ayudaPdfGestion">Selecciona el oficio que se asociará al radicado y se enviará a la dependencia.</small>
                <dialog id="modalSeleccionarPdfGestion" class="received-register-dialog pqrs-pdf-picker-dialog" aria-labelledby="tituloModalPdfGestion">
                  <div class="received-register-dialog-card">
                    <div class="received-register-dialog-heading">
                      <span class="received-register-dialog-icon"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>
                      <div>
                        <h2 id="tituloModalPdfGestion">Seleccionar oficio de gestión</h2>
                        <p>Busca por nombre y selecciona el PDF que necesitas.</p>
                      </div>
                      <button id="cerrarModalPdfGestion" class="received-register-close" type="button" aria-label="Cerrar">×</button>
                    </div>
                    <label for="buscarPdfGestion">Buscar PDF en Google Drive</label>
                    <input id="buscarPdfGestion" type="search" autocomplete="off" placeholder="Escribe para ver coincidencias">
                    <p id="estadoBusquedaPdfGestion" class="pqrs-pdf-picker-status" role="status" aria-live="polite"></p>
                    <ul id="resultadosPdfGestion" class="pqrs-pdf-picker-results"></ul>
                    <div class="received-register-dialog-actions">
                      <button id="cancelarModalPdfGestion" class="received-register-cancel" type="button">Cancelar</button>
                    </div>
                  </div>
                </dialog>
              </div>
            </div>
            <div id="grupoAceptacionDatosCiudadano" class="form-group full-width" hidden>
              <label class="citizen-consent-label" for="aceptaTratamientoDatos">
                <input type="checkbox" id="aceptaTratamientoDatos" required>
                <span>Acepto el tratamiento de mis datos personales</span>
              </label>
            </div>
            <div id="grupoSolicitudOriginalCiudadano" class="form-group full-width" hidden>
              <span>Documento adjunto a la solicitud</span>
              <a id="enlaceSolicitudOriginalCiudadano" href="" target="_blank" rel="noopener noreferrer"></a>
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
          </div>

          <section id="notificacionesPqrsFuncionario" class="pqrs-notifications" aria-labelledby="tituloNotificacionesPqrs" hidden>
            <div class="pqrs-notifications-header">
              <button id="alternarNotificacionesPqrs" class="pqrs-notifications-toggle" type="button" aria-expanded="false" aria-controls="listaNotificacionesPqrs">
                <span class="pqrs-notifications-icon"><i class="bi bi-bell-fill" aria-hidden="true"></i></span>
                <span class="pqrs-notifications-heading">
                  <span class="pqrs-notifications-title">
                    <span id="tituloNotificacionesPqrs">Notificaciones</span>
                    <span class="pqrs-notifications-description">Nuevas solicitudes y actualizaciones sobre remisiones por competencia.</span>
                  </span>
                  <span id="contadorNotificacionesPqrs" class="pqrs-notifications-count" aria-label="0 notificaciones nuevas" hidden>0</span>
                </span>
                <i class="bi bi-chevron-down pqrs-notifications-chevron" aria-hidden="true"></i>
              </button>
              <button id="borrarNotificacionesPqrs" class="pqrs-notifications-clear" type="button" aria-label="Borrar todas las notificaciones" title="Borrar todas las notificaciones" hidden>
                <i class="bi bi-trash3" aria-hidden="true"></i>
              </button>
            </div>
            <div id="listaNotificacionesPqrs" class="pqrs-notifications-list" aria-live="polite" hidden></div>
          </section>
        </section>

        <aside class="dashboard-summary" aria-label="Resumen de PQRS">
          <section id="consultaEstadoCiudadano" class="citizen-status-search" hidden>
            <h2>Consulta el estado de tu petición</h2>
            <p>Ingresa el número de radicado recibido al realizar tu solicitud.</p>
            <form id="formConsultaEstadoCiudadano" class="citizen-status-form">
              <label for="radicadoConsultaCiudadano">Número de radicado</label>
              <input id="radicadoConsultaCiudadano" type="text" placeholder="Ej: R-2026-00001" autocomplete="off" maxlength="100">
              <button type="submit">Consultar</button>
            </form>
            <div id="resultadoConsultaCiudadano" class="citizen-status-result" role="status" aria-live="polite"></div>
            <p class="citizen-status-help">
              Para conocer cualquier otra información sobre su solicitud, diríjase a la Ventanilla Única de la Alcaldía Municipal.
            </p>
          </section>
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

          <section id="pqrsPendientesGestion" class="pqrs-pending-section" aria-labelledby="tituloPQRSFpendientes" hidden>
            <div class="pqrs-pending-heading">
              <h3 id="tituloPQRSFpendientes">PQRS Pendientes Por Gestionar</h3>
              <div class="pqrs-pdf-upload-controls">
                <input id="archivosPdfGestion" type="file" accept=".pdf,application/pdf" multiple hidden>
                <button id="btnSubirPdfGestion" type="button" class="pqrs-pdf-upload-button" hidden>Subir PDF</button>
                <span id="contadorPdfGestion" class="pqrs-pdf-upload-count" aria-live="polite" hidden>0 disponibles</span>
              </div>
            </div>
            <p id="estadoPdfGestion" class="pqrs-pdf-upload-status" role="status" aria-live="polite" hidden></p>
            <p class="pqrs-pending-order-hint">Cada solicitud puede ser gestionada por una persona a la vez. Puedes reservar un pendiente disponible.</p>
            <div id="listaPQRSFpendientes" class="pqrs-pending-list" aria-live="polite">
              <p class="pqrs-pending-empty">Cargando PQRS pendientes…</p>
            </div>
          </section>

          <section class="recent-card" aria-labelledby="tituloRecientes">
            <div class="recent-card-heading">
              <div>
                <h2 id="tituloRecientes">Próximos a vencer</h2>
                <p id="subtituloRecientes">Vencimientos de la dependencia de esta sesión</p>
              </div>
              <i class="bi bi-clock" aria-hidden="true"></i>
            </div>
            <div id="resumenRecientes" class="recent-list" aria-live="polite">
              <p class="recent-empty">Cargando vencimientos...</p>
            </div>
          </section>
        </aside>
      </div>
    </div>

    <!-- VISTA 2: SECCIÓN DE DEPENDENCIAS -->
    `;
