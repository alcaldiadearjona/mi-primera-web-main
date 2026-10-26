import { establecerDependenciaActual } from '../../data/radicados.js';
import { establecerFormularioVisible } from '../radicados/formulario.js';

function mostrarVista(idVista) {
  ['pantallaInicio', 'vista-dependencias', 'pantallaDependencia', 'pantallaIAS'].forEach(id => {
    const vista = document.getElementById(id);
    if (vista) vista.style.display = id === idVista ? 'block' : 'none';
  });
}

function activarMenu(vista) {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.menuView === vista);
  });
}

window.mostrarPantallaInicio = function() {
  establecerDependenciaActual("");
  mostrarVista('pantallaInicio');
  establecerFormularioVisible(false);
  document.getElementById('tituloPantallaPrincipal').textContent = 'Ventanilla Única';
  document.getElementById('iconoPantallaPrincipal').className = 'bi bi-folder2-open';
  document.getElementById('subtituloPantallaPrincipal').textContent = 'Sistema Institucional de Radicación de Correspondencia y PQRS';
  document.getElementById('textoAccionFormulario').textContent = 'Ingresar nueva PQRS';
  document.getElementById('ayudaFormulario').textContent = 'Registra y asigna una solicitud a su dependencia destino.';
  document.getElementById('tituloFormularioRadicado').textContent = 'Formulario de Radicación de Solicitud / PQRS';
  activarMenu('pqrs');
};

window.mostrarGeneracionRadicados = function() {
  establecerDependenciaActual("");
  mostrarVista('pantallaInicio');
  document.getElementById('tituloPantallaPrincipal').textContent = 'Generación de Radicados';
  document.getElementById('iconoPantallaPrincipal').className = 'bi bi-file-earmark-plus';
  document.getElementById('subtituloPantallaPrincipal').textContent = 'Sistema de Generacion de Radicados de Salida';
  document.getElementById('textoAccionFormulario').textContent = 'Generar nuevo radicado';
  document.getElementById('ayudaFormulario').textContent = 'Diligencia el formulario para generar un nuevo radicado.';
  document.getElementById('tituloFormularioRadicado').textContent = 'Generación de Radicado';
  establecerFormularioVisible(true);
  activarMenu('generacion');
};

window.mostrarIAS = function() {
  establecerDependenciaActual("");
  mostrarVista('pantallaIAS');
  establecerFormularioVisible(false);
  activarMenu('ias');
};

window.mostrarDependenciasMenu = function() {
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
