import { establecerDependenciaActual } from '../../data/radicados.js';
import { esAdministrador, esCiudadano, esFuncionario, esInvitado, obtenerDependenciaSesion, puedeConsultarIAS } from '../auth/roles.js';
import {
  asegurarAniosInformes,
  actualizarInformes,
  redimensionarGraficasInformes,
  establecerCargaDependenciasInforme,
  establecerErrorDependenciasInforme
} from '../informes/tablero.js';
import { establecerFormularioVisible, prepararVistaPQRSF } from '../radicados/formulario.js';
import { cargarResumenRadicadosSalida } from '../radicados/generacion-salida.js';
import { asegurarDatosIAS } from '../ias/tablero.js';
import { cargarDatosDesdeFirebase } from '../../services/radicados.js';

function mostrarVista(idVista) {
  document.body.classList.remove('detail-view-open');
  ['pantallaInicio', 'pantallaGeneracion', 'vista-dependencias', 'pantallaDependencia', 'pantallaIAS', 'pantallaInformes'].forEach(id => {
    const vista = document.getElementById(id);
    if (vista) vista.style.display = id === idVista ? 'block' : 'none';
  });
}

function activarMenu(vista) {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.menuView === vista);
  });
}

function redirigirInvitadoAGeneracion() {
  if (!esInvitado()) return false;
  window.mostrarGeneracionRadicados();
  return true;
}

function redirigirCiudadanoAtencion() {
  if (!esCiudadano()) return false;
  window.mostrarAtencionCiudadano();
  return true;
}

window.mostrarPantallaInicio = function() {
  if (redirigirCiudadanoAtencion()) return;
  if (redirigirInvitadoAGeneracion()) return;
  establecerDependenciaActual("");
  mostrarVista('pantallaInicio');
  prepararVistaPQRSF(false);
  const resumen = document.querySelector('.dashboard-summary');
  if (resumen) resumen.removeAttribute('hidden');
  document.querySelector('.dashboard-stats')?.removeAttribute('hidden');
  document.querySelector('.recent-card')?.removeAttribute('hidden');
  document.getElementById('consultaEstadoCiudadano')?.setAttribute('hidden', '');
  document.getElementById('tituloPantallaPrincipal').textContent = 'Ventanilla Única';
  document.getElementById('iconoPantallaPrincipal').className = 'bi bi-folder2-open';
  document.getElementById('subtituloPantallaPrincipal').textContent = 'Sistema Institucional de Radicación de Correspondencia y PQRS';
  document.getElementById('textoAccionFormulario').textContent = 'Gestionar PQRSF';
  document.getElementById('ayudaFormulario').textContent = 'Selecciona una PQRS pendiente a la derecha para cargarla en este formulario.';
  document.getElementById('tituloFormularioRadicado').textContent = 'Formulario de Radicación de Solicitud / PQRS';
  activarMenu('pqrs');
};

window.mostrarAtencionCiudadano = function() {
  if (!esCiudadano() && !esAdministrador()) return;
  establecerDependenciaActual("");
  mostrarVista('pantallaInicio');
  prepararVistaPQRSF(true);
  document.getElementById('tituloPantallaPrincipal').textContent = 'ATENCIÓN AL CIUDADANO';
  document.getElementById('iconoPantallaPrincipal').className = 'bi bi-person-lines-fill';
  document.getElementById('subtituloPantallaPrincipal').textContent = 'Sistema Institucional de Radicación de Correspondencia y PQRS';
  document.getElementById('textoAccionFormulario').textContent = 'Ingresar PQRSF Ciudadano';
  document.getElementById('ayudaFormulario').textContent = 'Registra tu solicitud para que sea atendida por la dependencia correspondiente.';
  document.getElementById('tituloFormularioRadicado').textContent = 'Formulario de Radicación de Solicitud / PQRSF Ciudadano';
  const resumen = document.querySelector('.dashboard-summary');
  if (resumen) resumen.removeAttribute('hidden');
  document.querySelector('.dashboard-stats')?.setAttribute('hidden', '');
  document.getElementById('pqrsPendientesGestion')?.setAttribute('hidden', '');
  document.querySelector('.recent-card')?.setAttribute('hidden', '');
  document.getElementById('consultaEstadoCiudadano')?.removeAttribute('hidden');
  document.getElementById('notificacionesPqrsFuncionario')?.setAttribute('hidden', '');
  activarMenu('ciudadano');
};

window.mostrarGeneracionRadicados = function() {
  if (redirigirCiudadanoAtencion()) return;
  establecerDependenciaActual("");
  mostrarVista('pantallaGeneracion');
  activarMenu('generacion');
  void cargarResumenRadicadosSalida();
};

window.mostrarIAS = function() {
  if (redirigirCiudadanoAtencion()) return;
  if (redirigirInvitadoAGeneracion()) return;
  if (!puedeConsultarIAS()) return;
  establecerDependenciaActual("");
  mostrarVista('pantallaIAS');
  establecerFormularioVisible(false);
  activarMenu('ias');
  void asegurarDatosIAS();
};

window.mostrarInformes = function() {
  if (redirigirCiudadanoAtencion()) return;
  if (redirigirInvitadoAGeneracion()) return;
  establecerDependenciaActual("");
  mostrarVista('pantallaInformes');
  actualizarInformes();
  redimensionarGraficasInformes();
  establecerFormularioVisible(false);
  activarMenu('informes');
  establecerCargaDependenciasInforme();
  void (async () => {
    if (!await asegurarAniosInformes()) return;
    const ano = document.getElementById('filtroAnoInformes')?.value || String(new Date().getFullYear());
    await cargarDatosDesdeFirebase({
      ano,
      mes: '',
      forzar: false,
      actualizarVista: false
    });
  })().catch(error => {
    console.error('No fue posible preparar los datos históricos de los informes:', error);
    establecerErrorDependenciasInforme();
  });
};

window.mostrarDependenciasMenu = function() {
  if (redirigirCiudadanoAtencion()) return;
  if (redirigirInvitadoAGeneracion()) return;
  establecerDependenciaActual("");
  mostrarVista('vista-dependencias');
  establecerFormularioVisible(false);
  activarMenu('dependencias');
};

window.mostrarMenuPrincipal = function() {
  window.mostrarDependenciasMenu();
};

export function inicializarNavegacion() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  const closeSidebar = () => {
    document.body.classList.remove('sidebar-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Abrir menú de navegación');
  };

  menuToggle?.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('sidebar-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
  });

  sidebarBackdrop?.addEventListener('click', closeSidebar);
  sidebar?.querySelectorAll('.menu-item').forEach(menuItem => menuItem.addEventListener('click', closeSidebar));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSidebar();
  });
}
