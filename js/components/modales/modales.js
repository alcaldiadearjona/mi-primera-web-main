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
          <button type="submit" style="background:#2563eb; color:white; border:none; padding:10px 18px; border-radius:6px; cursor:pointer; font-weight:bold;">Guardar Cambios</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL OTROS ESTADOS / OBSERVACIONES -->
  <div id="modalOtrosEstados" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center;">
    <div style="background: white; padding: 24px; border-radius: 12px; width: 400px; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: inherit;">
      <h3 style="margin-top: 0; font-size: 18px; color: #1e293b;">📌 Gestión de Radicado</h3>
      <input type="hidden" id="modalEstadoDocId">

      <div style="margin-top: 16px;">
        <label for="txtFuncionarioAsignado" style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Asignar Funcionario:</label>
        <input id="txtFuncionarioAsignado" type="text" maxlength="120" placeholder="Escriba el nombre del funcionario..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
        <p id="estadoFuncionarioPreview" style="margin: 6px 0 0; color: #64748b; font-size: 12px;">Al escribir un nombre, el estado cambiará a En Trámite al guardar.</p>
      </div>

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
        <button type="button" onclick="guardarOtrosEstados()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">💾 Guardar</button>
      </div>
    </div>
  </div>

`;
