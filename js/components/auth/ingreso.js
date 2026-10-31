export const ingresoMarkup = String.raw`<!-- PANTALLA 0: LOGIN CENTRADO -->
<div id="pantalla-login">
  <div class="card-login">
    
    <!-- ENCABEZADO SUPERIOR CON FONDO GRIS CLARO -->
    <div class="header-top-gris">
      <img src="assets/images/escudo.png" alt="Escudo Arjona" class="escudo-login">
      <span class="titulo-alcaldia-login">ALCALDÍA MUNICIPAL DE ARJONA</span>
    </div>

    <!-- CUERPO BLANCO DEL FORMULARIO -->
    <div class="card-body-login">
      
      <!-- Título Principal -->
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 400; color: #000000; margin: 0; line-height: 1.35;">
          Sistema de Gestor Documental<br><span style="font-weight: 700; text-transform: uppercase;">VENTANILLA ÚNICA</span>
        </h2>
        <div class="linea-verde-login"></div>
      </div>

      <div style="display: flex; margin-bottom: 20px;">
        <div class="badge-flecha">
          Ingreso al sistema
        </div>
      </div>

      <!-- Formulario de Login -->
      <form onsubmit="iniciarSesion(event)" style="display: flex; flex-direction: column; gap: 18px; text-align: left;">
        <div>
          <label for="loginRol" style="font-size: 15px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Rol</label>
          <select id="loginRol" required style="width: 100%; padding: 8px 0; border: none; border-bottom: 1px solid #cbd5e1; outline: none; font-size: 15px; background: transparent; color: #1e293b;">
            <option value="funcionario">Funcionario</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>
        <div>
          <label for="loginUsuario" style="font-size: 15px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Usuario</label>
          <input type="text" id="loginUsuario" autocomplete="username" required placeholder="Ingrese su usuario..." style="width: 100%; padding: 8px 0; border: none; border-bottom: 1px solid #cbd5e1; outline: none; font-size: 15px; background: transparent; color: #1e293b;" onfocus="this.style.borderColor='#00a838'" onblur="this.style.borderColor='#cbd5e1'">
        </div>

        <div>
          <label for="loginClave" style="font-size: 15px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Contraseña</label>
          <div class="login-password-field">
            <input type="password" id="loginClave" autocomplete="current-password" required placeholder="••••••••" style="width: 100%; padding: 8px 0; border: none; border-bottom: 1px solid #cbd5e1; outline: none; font-size: 15px; background: transparent; color: #1e293b;" onfocus="this.style.borderColor='#00a838'" onblur="this.style.borderColor='#cbd5e1'">
            <button type="button" class="login-password-toggle" onclick="togglePasswordVisibility()" aria-label="Mostrar contraseña" aria-pressed="false">
              <i class="bi bi-eye" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <p id="errorLogin" role="alert" hidden style="margin:0; color:#b91c1c; font-size:13px;"></p>

        <!-- Opciones secundarias -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-top: 5px; margin-bottom: 10px;">
          <a href="#" onclick="alert('Contacte al administrador del sistema para restablecer su clave.')" style="color: #64748b; text-decoration: none;">Olvidé mi Contraseña</a>
          <a href="#" onclick="alert('El registro requiere autorización previa de la oficina de sistemas.')" style="color: #64748b; text-decoration: none;">Registrarse</a>
        </div>

        <!-- Botón Ingresar con Ruedita de Carga -->
        <div style="text-align: center;">
          <button type="submit" id="btnIngresarLogin" class="btn-ingresar-login" style="display: inline-flex; align-items: center; justify-content: center; gap: 10px;">
            <!-- Ruedita SVG (Spinner) inicialmente oculta -->
            <svg id="spinnerLogin" style="display: none; width: 18px; height: 18px; animation: girar 0.8s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            <span id="textoBtnLogin">Ingresar</span>
          </button>
        </div>
      </form>

    </div>

  </div>
</div>

`;
