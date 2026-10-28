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
            <input type="date" id="editFechaEntrega" readonly style="background-color: #e2e8f0;" required>
          </div>
          <div class="form-group full-width">
            <label>Remitente</label>
            <input type="text" id="editRemitente" required>
          </div>
          <div class="form-group full-width">
            <label>Asunto</label>
            <textarea id="editAsunto" required></textarea>
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

  <!-- MODAL OTROS ESTADOS / OBSERVACIONES -->
  <div id="modalOtrosEstados" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center;">
    <div style="background: white; padding: 24px; border-radius: 12px; width: 400px; max-width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: inherit;">
      <h3 style="margin-top: 0; font-size: 18px; color: #1e293b;">📌 Gestión de Radicado</h3>
      <input type="hidden" id="modalEstadoDocId">

      <div style="margin-top: 16px;">
        <label for="txtFuncionarioAsignado" style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Asignar Funcionario:</label>
        <input id="txtFuncionarioAsignado" type="text" maxlength="120" placeholder="Escriba el nombre del funcionario..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
        <p id="estadoFuncionarioPreview" style="margin: 6px 0 0; color: #64748b; font-size: 12px;">Al escribir un nombre, el estado cambiará a En Trámite al guardar.</p>
      </div>

      <hr style="margin: 18px 0; border: 0; border-top: 1px solid #e2e8f0;">

      <section aria-labelledby="tituloRemisionCompetencia" style="margin-top: 16px;">
        <h4 id="tituloRemisionCompetencia" style="margin: 0 0 5px; font-size: 14px; color: #334155;">Remitir por Competencia</h4>
        <p style="margin: 0 0 10px; color: #64748b; font-size: 12px;">Selecciona una o varias dependencias. Se creará una copia VIGENTE con el mismo número de radicado y esta solicitud quedará cerrada.</p>
        <div style="position: relative;">
          <button id="alternarDependenciasRemision" type="button" aria-expanded="false" aria-controls="dependenciasRemisionCompetencia" style="display:flex; width:100%; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; border:1px solid #cbd5e1; border-radius:7px; background:#fff; color:#334155; font:inherit; font-size:13px; text-align:left; cursor:pointer;">
            <span id="resumenDependenciasRemision" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Seleccionar dependencias destino</span>
            <i class="bi bi-chevron-down" aria-hidden="true"></i>
          </button>
          <div id="dependenciasRemisionCompetencia" role="group" aria-label="Dependencias destino para remisión por competencia" hidden style="position:absolute; z-index:2; top:calc(100% + 4px); left:0; right:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(145px, 1fr)); gap:5px; max-height:170px; overflow-y:auto; padding:8px; border:1px solid #d8e1e9; border-radius:8px; background:#fff; box-shadow:0 8px 20px rgba(15,23,42,.14);"></div>
        </div>
      </section>

      <hr style="margin: 18px 0; border: 0; border-top: 1px solid #e2e8f0;">

      <div style="margin-top: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Otros Estados:</label>
        <select id="selectOtrosEstados" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px;">
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

`;
