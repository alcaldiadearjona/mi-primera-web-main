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
    </div>

    <!-- VISTA 3: PANTALLA DE LA DEPENDENCIA SELECCIONADA -->
    `;
