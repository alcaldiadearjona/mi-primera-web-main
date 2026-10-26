export const avisosMarkup = String.raw`<div id="modalAvisoApp" class="app-notice-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="tituloAvisoApp" aria-describedby="mensajeAvisoApp">
  <div class="app-notice-card">
    <div id="iconoAvisoApp" class="app-notice-icon" aria-hidden="true">
      <i class="bi bi-info-lg"></i>
    </div>
    <h2 id="tituloAvisoApp">Aviso</h2>
    <p id="mensajeAvisoApp"></p>
    <div class="app-notice-actions">
      <button id="cancelarAvisoApp" class="app-notice-button app-notice-cancel" type="button">Cancelar</button>
      <button id="aceptarAvisoApp" class="app-notice-button" type="button">Entendido</button>
    </div>
  </div>
</div>`;
