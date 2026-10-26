export const navegacionMarkup = String.raw`  <div class="mobile-toolbar">
    <button
      class="menu-toggle"
      id="menuToggle"
      type="button"
      aria-label="Abrir menú de navegación"
      aria-controls="sidebar"
      aria-expanded="false">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <span class="mobile-toolbar-title">Ventanilla Única</span>
  </div>
  <button class="sidebar-backdrop" id="sidebarBackdrop" type="button" aria-label="Cerrar menú de navegación"></button>

  <!-- BARRA LATERAL -->
  <aside class="sidebar" id="sidebar">
    <div>
      <div class="brand">
        <img src="assets/images/escudo.png" alt="Escudo Alcaldía">
        <div class="brand-title">Alcaldía de Arjona</div>
      </div>

      <nav class="menu">
        <a class="menu-item active d-flex align-items-center gap-2" data-menu-view="pqrs" onclick="mostrarPantallaInicio()"><i class="bi bi-inbox-fill" aria-hidden="true"></i> PQRS</a>
        <a class="menu-item d-flex align-items-center gap-2" data-menu-view="dependencias" onclick="mostrarDependenciasMenu()"><i class="bi bi-buildings" aria-hidden="true"></i> Dependencias</a>
        <a class="menu-item d-flex align-items-center gap-2" data-menu-view="generacion" onclick="mostrarGeneracionRadicados()"><i class="bi bi-file-earmark-plus" aria-hidden="true"></i> Generación de Radicados</a>
        <a class="menu-item d-flex align-items-center gap-2" data-menu-view="ias" onclick="mostrarIAS()"><i class="bi bi-bank" aria-hidden="true"></i> IAS</a>
      </nav>
    </div>

    <div class="sidebar-footer">
      <div class="user-info">
        <p>Funcionario</p>
        <strong>Ventanilla Única</strong>
      </div>
      <a href="#" onclick="cerrarSesion()" class="btn-logout">Salir</a>
    </div>
  </aside>

  <!-- CONTENIDO PRINCIPAL -->
  `;
