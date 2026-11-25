export const modalesMarkup = String.raw`  <!-- MODAL PARA EDITAR RADICADO -->
  <div id="modalEditar" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; justify-content:center; align-items:center;">
    <div style="background:#fff; width:90%; max-width:600px; padding:25px; border-radius:12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <h3 style="margin-bottom:15px; color:#0f172a;">✏️ Editar Radicado</h3>
      <form id="formEditar">
        <input type="hidden" id="editDocId">
        <div class="form-grid">
          <div class="form-group">
            <label>N° Radicado</label>
            <input type="text" id="editRadicado" required>
          </div>
          <div class="form-group">
            <label>Estado Inicial</label>
            <select id="editEstado" required>
              <option value="VIGENTE">VIGENTE</option>
              <option value="EN TRAMITE">EN TRÁMITE</option>
            </select>
          </div>
          <div class="form-group">
            <label>F. Radicación (Manual)</label>
            <input type="date" id="editFechaRadicacion" required>
          </div>
          <div class="form-group">
            <label>F. Entrega (Manual)</label>
            <input type="date" id="editFechaEntregaManual" required>
          </div>
          <div class="form-group">
            <label>Días Hábiles</label>
            <input type="number" id="editDiasHabiles" required>
          </div>
          <div class="form-group">
            <label>F. Vencimiento (Automática)</label>
            <input type="date" id="editFechaEntrega" disabled style="background-color: #e2e8f0;" required>
          </div>
          <div class="form-group full-width">
            <label>Remitente</label>
            <input type="text" id="editRemitente" maxlength="40" required>
          </div>
          <div class="form-group full-width">
            <label>Asunto</label>
            <textarea id="editAsunto" maxlength="80" required></textarea>
          </div>
          <div id="grupoEdicionDependenciasDestino" class="form-group full-width" hidden>
            <label for="buscarDependenciaDestinoEdicion">Agregar dependencia omitida</label>
            <p style="margin:0 0 8px; color:#64748b; font-size:12px;">Busca y selecciona la dependencia que faltó en el envío inicial. Se agregará una copia ordinaria de la solicitud, sin iniciar una remisión por competencia.</p>
            <div id="destinosSeleccionadosEdicion" class="edit-destination-chips" role="list" aria-label="Dependencias seleccionadas"></div>
            <input id="buscarDependenciaDestinoEdicion" type="search" autocomplete="off" placeholder="Buscar dependencia..." role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="opcionesDependenciasDestinoEdicion">
            <div id="opcionesDependenciasDestinoEdicion" class="custom-select-listbox" role="listbox" aria-label="Coincidencias de dependencias" hidden></div>
          </div>
          <div id="grupoEdicionFolios" class="form-group" hidden>
            <label for="editFolios">Folios *</label>
            <input id="editFolios" type="number" min="1" step="1">
          </div>
          <div id="grupoEdicionAnexos" class="form-group" hidden>
            <label for="editAnexos">Anexos (si no tiene, ingrese 0) *</label>
            <input id="editAnexos" type="number" min="0" step="1">
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" onclick="cerrarModalEditar()" style="background:#64748b; color:white; border:none; padding:10px 18px; border-radius:6px; cursor:pointer;">Cancelar</button>
          <button id="btnGuardarEditar" type="submit" style="background:#2563eb; color:white; border:none; padding:10px 18px; border-radius:6px; cursor:pointer; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;">
            <span id="spinnerGuardarEdicion" class="spinner" style="display:none;" aria-hidden="true"></span><span id="textoGuardarEdicion">Guardar Cambios</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <dialog id="modalRespuestaRadicado" class="received-register-dialog response-upload-dialog" aria-labelledby="tituloModalRespuestaRadicado">
    <form id="formRespuestaRadicado" class="received-register-dialog-card">
      <div class="received-register-dialog-heading">
        <span class="received-register-dialog-icon"><i class="bi bi-file-earmark-arrow-up" aria-hidden="true"></i></span>
        <div>
          <h2 id="tituloModalRespuestaRadicado">Cargar respuesta</h2>
          <p id="subtituloModalRespuestaRadicado">Selecciona los archivos y define cómo se gestionará la respuesta.</p>
        </div>
        <button id="cerrarModalRespuestaRadicado" class="received-register-close" type="button" aria-label="Cerrar">×</button>
      </div>

      <section class="response-modal-section" aria-labelledby="tituloArchivosRespuesta">
        <h3 id="tituloArchivosRespuesta"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i> Archivos PDF</h3>
        <label class="response-modal-file-picker" for="archivosRespuestaRadicado">
          <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
          <span><strong>Seleccionar archivos</strong><small>Hasta 10 PDF, máximo 10 MB por archivo.</small></span>
          <input id="archivosRespuestaRadicado" type="file" accept=".pdf,application/pdf" multiple aria-describedby="resumenArchivosRespuesta">
        </label>
        <p id="resumenArchivosRespuesta" class="response-modal-file-summary" aria-live="polite">Aún no has seleccionado archivos.</p>
        <ul id="listaArchivosRespuesta" class="response-modal-file-list"></ul>
      </section>

      <section class="response-modal-section" aria-labelledby="tituloEntregaRespuesta">
        <h3 id="tituloEntregaRespuesta"><i class="bi bi-send" aria-hidden="true"></i> ¿Cómo se gestionará?</h3>
        <div class="response-modal-options">
          <label>
            <input id="respuestaSoloEvidenciaModal" type="checkbox" checked>
            <span><strong>Solo evidencia</strong><small>Los archivos quedan disponibles en la consulta pública; no se envía correo.</small></span>
          </label>
          <label id="contenedorEnviarRespuestaCorreo">
            <input id="respuestaEnviarAlCiudadanoModal" type="checkbox">
            <span><strong>Enviar al ciudadano por correo</strong><small>Se adjuntarán todos los PDF al correo registrado.</small></span>
          </label>
        </div>
        <p id="ayudaEntregaRespuesta" class="response-modal-help" role="status"></p>
      </section>

      <div id="progresoRespuestaRadicado" class="response-modal-progress" hidden>
        <div class="response-modal-progress-label">
          <span id="textoProgresoRespuestaRadicado">Subiendo archivos...</span>
          <span id="porcentajeRespuestaRadicado">0%</span>
        </div>
        <div class="response-modal-progress-track">
          <div id="barraProgresoRespuestaRadicado" class="response-modal-progress-bar"></div>
        </div>
      </div>

      <p id="errorRespuestaRadicado" class="received-register-error" role="alert" hidden></p>
      <div class="received-register-dialog-actions">
        <button id="cancelarRespuestaRadicado" class="received-register-cancel" type="button">Cancelar</button>
        <button id="confirmarRespuestaRadicado" class="received-register-submit" type="submit">
          <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
          Cargar respuesta
        </button>
      </div>
    </form>
  </dialog>

  <dialog id="modalAporteDependencia" class="received-register-dialog response-upload-dialog" aria-labelledby="tituloModalAporteDependencia">
    <form id="formAporteDependencia" class="received-register-dialog-card">
      <div class="received-register-dialog-heading">
        <span class="received-register-dialog-icon"><i class="bi bi-chat-square-text" aria-hidden="true"></i></span>
        <div>
          <h2 id="tituloModalAporteDependencia">Aportar al radicado</h2>
          <p id="subtituloModalAporteDependencia">Agrega el concepto de tu dependencia para que la líder prepare la respuesta final.</p>
        </div>
        <button id="cerrarModalAporteDependencia" class="received-register-close" type="button" aria-label="Cerrar">×</button>
      </div>
      <label for="textoAporteDependencia">Concepto o información</label>
      <textarea id="textoAporteDependencia" rows="4" maxlength="4000" placeholder="Escribe el aporte de tu dependencia..."></textarea>
      <section class="response-modal-section" aria-labelledby="tituloArchivosAporte">
        <h3 id="tituloArchivosAporte"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i> Documentos de apoyo</h3>
        <label class="response-modal-file-picker" for="archivosAporteDependencia">
          <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
          <span><strong>Seleccionar archivos</strong><small>Hasta 10 PDF, máximo 10 MB por archivo.</small></span>
          <input id="archivosAporteDependencia" type="file" accept=".pdf,application/pdf" multiple aria-describedby="resumenArchivosAporte">
        </label>
        <p id="resumenArchivosAporte" class="response-modal-file-summary" aria-live="polite">Aún no has seleccionado archivos.</p>
      </section>
      <p id="errorAporteDependencia" class="received-register-error" role="alert" hidden></p>
      <div class="received-register-dialog-actions">
        <button id="cancelarAporteDependencia" class="received-register-cancel" type="button">Cancelar</button>
        <button id="guardarAporteDependencia" class="received-register-submit" type="submit">
          <i class="bi bi-send" aria-hidden="true"></i>
          Enviar aporte
        </button>
      </div>
    </form>
  </dialog>

  <dialog id="modalDetalleAportes" class="received-register-dialog response-view-dialog contribution-view-dialog" aria-labelledby="tituloModalDetalleAportes">
    <div class="received-register-dialog-card">
      <div class="received-register-dialog-heading">
        <span class="received-register-dialog-icon"><i class="bi bi-chat-square-text" aria-hidden="true"></i></span>
        <div>
          <h2 id="tituloModalDetalleAportes">Aportes del radicado</h2>
          <p id="subtituloModalDetalleAportes">Consulta la información enviada por las dependencias.</p>
        </div>
        <button id="cerrarModalDetalleAportes" class="received-register-close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div id="listaDetalleAportes" class="contribution-view-list" aria-live="polite"></div>
      <div class="received-register-dialog-actions">
        <button id="cerrarDetalleAportes" class="received-register-cancel" type="button">Cerrar</button>
      </div>
    </div>
  </dialog>

  <dialog id="modalVisualizarRespuesta" class="received-register-dialog response-view-dialog" aria-labelledby="tituloModalVisualizarRespuesta">
    <div class="received-register-dialog-card">
      <div class="received-register-dialog-heading">
        <span class="received-register-dialog-icon"><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i></span>
        <div>
          <h2 id="tituloModalVisualizarRespuesta">Archivos de respuesta</h2>
          <p>Selecciona un archivo para visualizarlo.</p>
        </div>
        <button id="cerrarModalVisualizarRespuesta" class="received-register-close" type="button" aria-label="Cerrar" onclick="document.getElementById('modalVisualizarRespuesta').close()">×</button>
      </div>
      <div id="listaVisualizarRespuesta" class="response-view-file-list"></div>
    </div>
  </dialog>

  <!-- MODAL PARA PRÓRROGA DE RADICADO -->
  <div id="modalProrrogaRadicado" class="modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,.48); z-index:1002; justify-content:center; align-items:center; padding:16px;">
    <div style="width:100%; max-width:520px; padding:24px; border:1px solid #e2eee5; border-radius:16px; background:#fff; box-shadow:0 18px 45px rgba(22,80,48,.2);">
      <h3 style="margin:0 0 8px; color:#244735; font-size:18px;">Prórroga del radicado</h3>
      <p id="textoProrrogaRadicado" style="margin:0 0 18px; color:#64748b; font-size:13px;"></p>
      <form id="formProrrogaRadicado">
        <input type="hidden" id="prorrogaRadicadoId">
        <input type="hidden" id="prorrogaRadicadoColeccion">
        <div class="form-grid">
          <div class="form-group">
            <label for="prorrogaDias">Días hábiles adicionales *</label>
            <input id="prorrogaDias" type="number" min="1" step="1" inputmode="numeric" required>
          </div>
          <div class="form-group full-width">
            <label for="prorrogaNuevaFecha">Nueva fecha de vencimiento</label>
            <input id="prorrogaNuevaFecha" type="text" readonly style="background:#e2e8f0; color:#475569;">
          </div>
          <div class="form-group">
            <label for="prorrogaArchivo">Oficio de prórroga * (PDF)</label>
            <input id="prorrogaArchivo" type="file" accept=".pdf,application/pdf" required>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:9px; margin-top:22px;">
          <button type="button" onclick="cerrarModalProrrogaRadicado()" style="padding:9px 15px; border:0; border-radius:8px; background:#e2e8f0; color:#475569; cursor:pointer; font-weight:600;">Cancelar</button>
          <button id="guardarProrrogaRadicado" type="submit" style="padding:9px 15px; border:0; border-radius:8px; background:#16804a; color:#fff; cursor:pointer; font-weight:700;">Guardar prórroga</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL PARA ASIGNAR FUNCIONARIO -->
  <div id="modalFuncionarioAsignado" class="modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,.48); z-index:1001; justify-content:center; align-items:center; padding:16px;">
    <div style="width:100%; max-width:440px; padding:24px; border:1px solid #e2eee5; border-radius:16px; background:#fff; box-shadow:0 18px 45px rgba(22,80,48,.2);">
      <h3 style="margin:0 0 18px; color:#244735; font-size:18px;">Asignar funcionario</h3>
      <form id="formFuncionarioAsignado">
        <input type="hidden" id="funcionarioAsignadoDocId">
        <label for="txtFuncionarioAsignado" style="display:block; margin-bottom:7px; color:#475569; font-size:13px; font-weight:600;">Nombre del funcionario:</label>
        <input id="txtFuncionarioAsignado" type="text" maxlength="120" autocomplete="off" placeholder="Escriba para buscar un funcionario..." role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="opcionesFuncionariosAsignados" required style="width:100%; box-sizing:border-box; padding:11px 13px; border:1px solid #cbd5e1; border-radius:9px; font-size:14px; outline-color:#6a9c78;">
        <div id="opcionesFuncionariosAsignados" class="custom-select-listbox" role="listbox" aria-label="Funcionarios disponibles" hidden></div>
        <p id="estadoFuncionarioPreview" style="margin:8px 0 0; color:#64748b; font-size:12px;">Al asignar un nombre, el estado cambiará a En Trámite al guardar.</p>
        <div style="display:flex; justify-content:flex-end; gap:9px; margin-top:22px;">
          <button type="button" onclick="cerrarModalFuncionarioAsignado()" style="padding:9px 15px; border:0; border-radius:8px; background:#e2e8f0; color:#475569; cursor:pointer; font-weight:600;">Cancelar</button>
          <button id="btnGuardarFuncionarioAsignado" type="submit" style="display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:9px 15px; border:0; border-radius:8px; background:linear-gradient(135deg,#358252,#21623b); box-shadow:0 5px 12px rgba(33,98,59,.22); color:#fff; cursor:pointer; font-weight:600;">
            <span id="spinnerGuardarFuncionario" class="spinner" style="display:none;" aria-hidden="true"></span><span id="textoGuardarFuncionario">Guardar</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL OTROS ESTADOS / OBSERVACIONES -->
  <div id="modalOtrosEstados" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center;">
    <div style="background: white; padding: 24px; border-radius: 12px; width: 400px; max-width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: inherit;">
      <h3 style="margin-top: 0; font-size: 18px; color: #1e293b;">📌 Gestión de Radicado</h3>
      <input type="hidden" id="modalEstadoDocId">

      <section aria-labelledby="tituloRemisionCompetencia" style="margin-top: 16px;">
        <h4 id="tituloRemisionCompetencia" style="margin: 0 0 5px; font-size: 14px; color: #334155;">Remitir por Competencia</h4>
        <p style="margin: 0 0 10px; color: #64748b; font-size: 12px;">Selecciona una o varias dependencias. Se creará una copia VIGENTE con el mismo número de radicado y esta solicitud quedará cerrada.</p>
        <div style="position: relative;">
          <button id="alternarDependenciasRemision" type="button" aria-expanded="false" aria-controls="dependenciasRemisionCompetencia">
            <span id="resumenDependenciasRemision">Seleccionar dependencias destino</span>
            <i class="bi bi-chevron-down" aria-hidden="true"></i>
          </button>
          <div id="dependenciasRemisionCompetencia" role="group" aria-label="Dependencias destino para remisión por competencia" hidden></div>
        </div>
        <div id="campoObservacionesRemision" hidden style="margin-top: 12px;">
          <label for="txtObservacionesRemision" style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Observaciones para la dependencia destinataria:</label>
          <textarea id="txtObservacionesRemision" rows="3" maxlength="4000" placeholder="Escriba las indicaciones para la dependencia destinataria..." style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; resize: vertical; box-sizing: border-box;"></textarea>
          <small style="display: block; margin-top: 5px; color: #64748b;">Estas observaciones aparecerán en la copia recibida por la dependencia.</small>
        </div>
      </section>

      <hr style="margin: 18px 0; border: 0; border-top: 1px solid #e2e8f0;">

      <div style="margin-top: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Otros Estados:</label>
        <select id="selectOtrosEstados">
          <option value="">-- Seleccionar --</option>
          <option value="Para Conocimiento">Para Conocimiento</option>
          <option value="No Requiere Respuesta">No Requiere Respuesta</option>
        </select>
      </div>

      <div style="margin-top: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Observaciones:</label>
        <textarea id="txtObservaciones" rows="4" placeholder="Escriba aquí las observaciones..." style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; resize: vertical; box-sizing: border-box;"></textarea>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 8px;">
  <button type="button" onclick="cerrarModalOtrosEstados()" style="background: #e2e8f0; color: #475569; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancelar</button>
  <button id="btnGuardarOtrosEstados" type="button" onclick="guardarOtrosEstados()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;">
    <span id="spinnerGuardarOtrosEstados" class="spinner" style="display:none;" aria-hidden="true"></span><span id="textoGuardarOtrosEstados">Guardar</span>
  </button>
</div>
</div>
</div>

  <!-- MODAL INFORMACIÓN GENERAL DEL REMITENTE -->
  <div id="modalInfoRemitente" class="modal remitente-info-modal" role="dialog" aria-modal="true" aria-labelledby="tituloInfoRemitente">
    <div class="remitente-info-dialog">
      <header class="remitente-info-header">
        <div class="remitente-info-heading">
          <div class="remitente-info-header-icon" aria-hidden="true">
            <i class="bi bi-file-earmark-text"></i>
          </div>
          <div>
            <span class="remitente-info-kicker">Información del remitente</span>
            <h3 id="tituloInfoRemitente"></h3>
          </div>
        </div>
        <button type="button" class="remitente-info-close" onclick="cerrarInfoRemitente()" aria-label="Cerrar">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </header>
      <div id="contenidoInfoRemitente" class="remitente-info-content"></div>
      <footer class="remitente-info-footer">
        <button type="button" class="remitente-info-close-button" onclick="cerrarInfoRemitente()">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
          <span>Cerrar</span>
        </button>
      </footer>
    </div>
  </div>

`;
