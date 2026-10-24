import { establecerDependenciaActual } from '../../data/radicados.js';
import { establecerFormularioVisible } from '../radicados/formulario.js';

window.mostrarPantallaInicio = function() {
  establecerDependenciaActual("");
  const pantallaInicio = document.getElementById('pantallaInicio');
  const vistaDependencias = document.getElementById('vista-dependencias');
  const pantallaDependencia = document.getElementById('pantallaDependencia');

  if (pantallaDependencia) pantallaDependencia.style.display = 'none';
  if (vistaDependencias) vistaDependencias.style.display = 'none';
  if (pantallaInicio) pantallaInicio.style.display = 'block';
  establecerFormularioVisible(false);

  const menuItems = document.querySelectorAll('.menu-item');
  if (menuItems.length >= 2) {
    menuItems[0].classList.add('active');
    menuItems[1].classList.remove('active');
  }
};

window.mostrarDependenciasMenu = function() {
  establecerDependenciaActual("");
  const pantallaInicio = document.getElementById('pantallaInicio');
  const vistaDependencias = document.getElementById('vista-dependencias');
  const pantallaDependencia = document.getElementById('pantallaDependencia');

  if (pantallaInicio) pantallaInicio.style.display = 'none';
  if (pantallaDependencia) pantallaDependencia.style.display = 'none';
  if (vistaDependencias) vistaDependencias.style.display = 'block';

  const menuItems = document.querySelectorAll('.menu-item');
  if (menuItems.length >= 2) {
    menuItems[0].classList.remove('active');
    menuItems[1].classList.add('active');
  }
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
