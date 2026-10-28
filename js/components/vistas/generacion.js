export const generacionMarkup = String.raw`<div id="pantallaGeneracion" style="display: none;">
      <header class="top-header generation-header institutional-header">
        <div class="top-header-content">
          <h1><i class="bi bi-file-earmark-plus" aria-hidden="true"></i> Generación de Radicados</h1>
          <p>Sistema de Generación de Radicados de Salida</p>
        </div>
        <div class="institutional-header-art" aria-hidden="true">
          <img src="assets/images/bandera-header.png" alt="">
        </div>
        <span class="institutional-header-accent" aria-hidden="true"></span>
      </header>

      <section class="generation-page" aria-labelledby="accionesGeneracion">
        <div class="generation-dashboard">
          <div class="dashboard-form-column generation-form-column">
            <h2 id="accionesGeneracion" class="section-title">
              <i class="bi bi-grid-1x2-fill" aria-hidden="true"></i> Acciones Principales
            </h2>
            <button
              id="toggleFormularioGeneracion"
              class="dashboard-form-toggle"
              type="button"
              aria-expanded="true"
              aria-controls="contenedorFormularioGeneracion"
              onclick="toggleFormularioGeneracion()">
              <span><i class="bi bi-plus-circle-fill" aria-hidden="true"></i> Generar Nuevo Radicado</span>
              <i class="bi bi-chevron-up" aria-hidden="true"></i>
            </button>
            <span class="dashboard-form-hint">Completa los datos de la comunicación oficial que deseas generar.</span>

            <div id="contenedorFormularioGeneracion" class="generation-card">
              <div class="generation-form-section">
                <div class="generation-section-title">
                  <i class="bi bi-journal-text" aria-hidden="true"></i>
                  <h3>Información de la comunicación</h3>
                </div>

                <form id="formGeneracionSalida">
                <div class="generation-form-grid">
                <div class="form-group">
                  <label for="destinatarioSalida">Nombre y Datos del Destinatario <span aria-hidden="true">*</span></label>
                  <input id="destinatarioSalida" name="destinatario" type="text" placeholder="Ej: Nombre completo, cargo, entidad, dirección" required>
                </div>

                <div class="form-group">
                  <label for="dependenciaSalida">Dependencia que Generó el Trámite <span aria-hidden="true">*</span></label>
                  <select id="dependenciaSalida" name="dependencia" required>
                    <option value="">Seleccione una dependencia</option>
                    <option>SECRETARÍA DE HACIENDA</option>
                    <option>SECRETARÍA GENERAL Y DE GOBIERNO</option>
                    <option>SECRETARÍA DE SALUD</option>
                    <option>SECRETARÍA DE EDUCACIÓN</option>
                    <option>SECRETARÍA DE PLANEACIÓN Y OBRAS</option>
                    <option>SECRETARÍA DE DESARROLLO SOCIAL</option>
                    <option>DESPACHO DEL ALCALDE</option>
                    <option>OFICINA ASESORA JURÍDICA</option>
                    <option>OFICINA DE TALENTO HUMANO</option>
                    <option>OFICINA DE CONTROL INTERNO</option>
                    <option>SECRETARIA DE UMATA</option>
                    <option>CUERPO OFICIAL DE BOMBEROS</option>
                    <option>COORDINACIÓN DE GESTIÓN DEL RIESGO DE DESASTRES</option>
                    <option>SECRETARIA DE TRANSITO Y TRANSPORTE</option>
                    <option value="Otro">Otro:</option>
                  </select>
                </div>

                <div id="dependenciaOtraGroup" class="form-group generation-full-width" hidden>
                  <label for="dependenciaOtra">Especifique la dependencia <span aria-hidden="true">*</span></label>
                  <input id="dependenciaOtra" name="dependenciaOtra" type="text" placeholder="Escriba el nombre de la dependencia">
                </div>

                <div class="form-group">
                  <label for="asuntoSalida">Asunto de la Comunicación <span aria-hidden="true">*</span></label>
                  <input id="asuntoSalida" name="asunto" type="text" placeholder="Ej: Solicitud de información / Remisión de documentos" required>
                </div>

                <div class="form-group">
                  <label for="foliosSalida">Folios <span aria-hidden="true">*</span></label>
                  <input id="foliosSalida" name="folios" type="number" min="1" step="1" placeholder="Ej: 3" required>
                </div>

                <div class="form-group generation-full-width">
                  <label for="anexosSalida">Anexos <span aria-hidden="true">*</span></label>
                  <input id="anexosSalida" name="anexos" type="text" placeholder="Ej: 2 documentos, 1 informe, etc." required>
                </div>

                <div class="form-group generation-full-width">
                  <label for="archivosSalida">Adjuntar Archivo(s)</label>
                  <div class="generation-file-picker">
                    <label class="generation-file-button" for="archivosSalida">
                      <i class="bi bi-cloud-arrow-up" aria-hidden="true"></i>
                      Seleccionar archivos
                    </label>
                    <input id="archivosSalida" name="archivos" type="file" multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png">
                    <span id="archivosSalidaAyuda">Sube hasta 10 archivos compatibles. Tamaño máximo por archivo: 10 MB.</span>
                  </div>
                  <ul id="listaArchivosSalida" class="generation-file-list" aria-live="polite"></ul>
                </div>
                </div>

                <div class="generation-form-footer">
                  <button type="submit" class="btn-guardar generation-submit">
                    <span id="spinnerGenerarSalida" class="spinner" style="display:none;" aria-hidden="true"></span>
                    <span id="textoGenerarSalida"><strong>Generar Radicado</strong></span>
                  </button>
                </div>
                </form>
              </div>
            </div>
          </div>

          <aside class="generation-summary" aria-label="Resumen de radicados">
            <section class="recent-card generation-month-card" aria-labelledby="tituloRadicadosMes">
              <div class="recent-card-heading">
                <div>
                  <h2 id="tituloRadicadosMes"><i class="bi bi-folder2-open" aria-hidden="true"></i> Radicados por mes</h2>
                  <p>Las comunicaciones oficiales se organizan por mes.</p>
                </div>
                <i class="bi bi-clock-history" aria-hidden="true"></i>
              </div>
              <div id="generacionMeses" class="generation-month-list">
                <div class="generation-empty-state" role="status">
                  <i class="bi bi-folder2-open" aria-hidden="true"></i>
                  <div>
                    <strong>Aún no hay radicados por mes</strong>
                    <span>Las comunicaciones que generes aparecerán aquí.</span>
                  </div>
                </div>
              </div>
            </section>

            <section class="recent-card" aria-labelledby="tituloGeneracionRecientes">
              <div class="recent-card-heading">
                <div>
                  <h2 id="tituloGeneracionRecientes">Radicados recientes</h2>
                  <p>Últimas comunicaciones oficiales de salida</p>
                </div>
                <i class="bi bi-clock-history" aria-hidden="true"></i>
              </div>
              <div id="generacionRecientes" class="generation-recent-list">
                <div class="generation-empty-state generation-empty-recent" role="status">
                  <i class="bi bi-send" aria-hidden="true"></i>
                  <div>
                    <strong>Aún no hay radicados recientes</strong>
                    <span>Cuando generes una comunicación, la verás en esta lista.</span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section id="detalleCarpetaGeneracion" class="generation-folder-detail" aria-labelledby="tituloCarpetaGeneracion" hidden>
          <button id="volverCarpetasGeneracion" class="btn-back generation-back" type="button">
            <i class="bi bi-arrow-left" aria-hidden="true"></i> Volver a Generación de Radicados
          </button>
          <div class="view-card">
            <div class="generation-folder-heading">
              <div>
                <h2 id="tituloCarpetaGeneracion" class="section-title">
                  <i class="bi bi-building" aria-hidden="true"></i>
                  <span>Radicados del mes</span>
                </h2>
              </div>
              <span id="conteoCarpetaGeneracion" class="detail-status-tag"></span>
            </div>
            <div class="generation-detail-filters">
              <label class="generation-detail-search" for="buscarRadicadosGeneracion">
                <i class="bi bi-search" aria-hidden="true"></i>
                <input id="buscarRadicadosGeneracion" type="search" placeholder="Buscar radicado, destinatario, asunto o dependencia...">
              </label>
              <button id="filtrarRadicadosGeneracion" class="detail-filter-button" type="button">
                <i class="bi bi-funnel" aria-hidden="true"></i> Filtrar
              </button>
            </div>
            <div class="generation-detail-period">
              <i class="bi bi-calendar3" aria-hidden="true"></i>
              <time id="periodoCarpetaGeneracion"></time>
            </div>
            <p class="detail-table-scroll-hint">Desliza la tabla horizontalmente para ver todas las columnas.</p>
            <div class="detail-table-scroll">
              <table class="table-custom generation-table">
                <thead>
                  <tr>
                    <th>N° Radicado</th>
                    <th>F. Generación</th>
                    <th>Destinatario</th>
                    <th>Asunto</th>
                    <th>Folios</th>
                    <th>Anexos</th>
                    <th>Dependencia</th>
                    <th>Estado</th>
                    <th>Archivo(s)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="cuerpoTablaGeneracion"></tbody>
              </table>
            </div>
          </div>
        </section>
      </section>

      <div id="modalEditarSalida" class="generation-modal" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="tituloEditarSalida">
        <div class="generation-modal-card">
          <h2 id="tituloEditarSalida"><i class="bi bi-pencil-square" aria-hidden="true"></i> Editar Radicado de Salida</h2>
          <form id="formEditarSalida">
            <input id="idEditarSalida" type="hidden">
            <div class="generation-form-grid">
              <div class="form-group">
                <label for="destinatarioEditarSalida">Nombre y Datos del Destinatario *</label>
                <input id="destinatarioEditarSalida" type="text" required>
              </div>
              <div class="form-group">
                <label for="dependenciaEditarSalida">Dependencia que Generó el Trámite *</label>
                <select id="dependenciaEditarSalida" required>
                  <option value="">Seleccione una dependencia</option>
                  <option>SECRETARÍA DE HACIENDA</option>
                  <option>SECRETARÍA GENERAL Y DE GOBIERNO</option>
                  <option>SECRETARÍA DE SALUD</option>
                  <option>SECRETARÍA DE EDUCACIÓN</option>
                  <option>SECRETARÍA DE PLANEACIÓN Y OBRAS</option>
                  <option>SECRETARÍA DE DESARROLLO SOCIAL</option>
                  <option>DESPACHO DEL ALCALDE</option>
                  <option>OFICINA ASESORA JURÍDICA</option>
                  <option>OFICINA DE TALENTO HUMANO</option>
                  <option>OFICINA DE CONTROL INTERNO</option>
                  <option>SECRETARIA DE UMATA</option>
                  <option>CUERPO OFICIAL DE BOMBEROS</option>
                  <option>COORDINACIÓN DE GESTIÓN DEL RIESGO DE DESASTRES</option>
                  <option>SECRETARIA DE TRANSITO Y TRANSPORTE</option>
                  <option value="Otro">Otro:</option>
                </select>
              </div>
              <div id="dependenciaOtraEditarGroup" class="form-group generation-full-width" hidden>
                <label for="dependenciaOtraEditar">Especifique la dependencia *</label>
                <input id="dependenciaOtraEditar" type="text">
              </div>
              <div class="form-group">
                <label for="asuntoEditarSalida">Asunto de la Comunicación *</label>
                <input id="asuntoEditarSalida" type="text" required>
              </div>
              <div class="form-group">
                <label for="foliosEditarSalida">Folios *</label>
                <input id="foliosEditarSalida" type="number" min="1" step="1" required>
              </div>
              <div class="form-group generation-full-width">
                <label for="anexosEditarSalida">Anexos *</label>
                <input id="anexosEditarSalida" type="text" required>
              </div>
              <div class="form-group generation-full-width">
                <label>Archivos adjuntos</label>
                <div id="archivosExistentesSalida" class="generation-existing-files"></div>
                <label for="archivosEditarSalida">Agregar archivos</label>
                <input id="archivosEditarSalida" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png">
                <span id="archivosEditarSalidaAyuda" class="generation-edit-file-hint">Puedes agregar archivos hasta completar el máximo de 10.</span>
                <ul id="listaArchivosEditarSalida" class="generation-file-list" aria-live="polite"></ul>
              </div>
            </div>
            <div class="generation-modal-actions">
              <button id="cancelarEditarSalida" type="button" class="generation-cancel">Cancelar</button>
              <button id="guardarEditarSalida" type="submit" class="btn-guardar generation-submit">
                <span id="spinnerEditarSalida" class="spinner" style="display:none;" aria-hidden="true"></span>
                <span id="textoEditarSalida">Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
`;
