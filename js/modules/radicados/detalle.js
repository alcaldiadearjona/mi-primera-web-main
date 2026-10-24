import { datosRadicados, dependenciaActual, establecerDependenciaActual } from '../../data/radicados.js';
import { renderizarTablaRadicados } from './tabla.js';

export function abrirDependencia(nombreDep) {
  establecerDependenciaActual(nombreDep);
  document.getElementById('pantallaInicio').style.display = 'none';
  document.getElementById('vista-dependencias').style.display = 'none';
  document.getElementById('pantallaDependencia').style.display = 'block';
  const tituloDependencia = document.getElementById('tituloDependenciaDetalle');
  tituloDependencia.textContent = nombreDep;
  const periodoActual = document.getElementById('periodoActual');
  if (periodoActual) {
    const ahora = new Date();
    periodoActual.dateTime = ahora.toISOString().slice(0, 10);
    periodoActual.textContent = new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric'
    }).format(ahora).replace(/^./, character => character.toLocaleUpperCase('es-CO'));
  }

  const tarjetaDependencia = Array.from(document.querySelectorAll('#contenedorDependencias .dep-card'))
    .find(card => card.querySelector('h3')?.textContent.trim() === nombreDep);
  const iconoDependencia = tarjetaDependencia?.querySelector('.dep-card-icon');
  if (iconoDependencia) {
    const iconoTitulo = document.createElement('i');
    iconoTitulo.className = 'detail-dependency-icon';
    iconoTitulo.setAttribute('aria-hidden', 'true');
    iconoDependencia.classList.forEach(className => {
      if (className.startsWith('bi-')) iconoTitulo.classList.add(className);
    });
    iconoTitulo.style.setProperty('--dep-accent', getComputedStyle(iconoDependencia).color);
    tituloDependencia.prepend(iconoTitulo);
  }

  // Limpiar campos de búsqueda y filtros al entrar
  const inputBuscar = document.getElementById('inputBuscar');
  const selectAno = document.getElementById('filtroAno');
  const selectMes = document.getElementById('filtroMes');
  if (inputBuscar) inputBuscar.value = "";
  if (selectAno) selectAno.value = "";
  if (selectMes) selectMes.value = "";

  let lista = datosRadicados[nombreDep] || [];
  
  // Ordenar automáticamente del más reciente al más antiguo
  lista.sort((a, b) => new Date(b.fechaRadicacion) - new Date(a.fechaRadicacion));

  renderizarTablaRadicados(lista);
}

window.abrirDependencia = abrirDependencia;

window.aplicarFiltrosRadicados = function() {
  if (!dependenciaActual) return;

  const textoBusqueda = document.getElementById('inputBuscar')?.value.toLowerCase().trim() || "";
  const anoSeleccionado = document.getElementById('filtroAno')?.value || "";
  const mesSeleccionado = document.getElementById('filtroMes')?.value || "";

  let lista = datosRadicados[dependenciaActual] || [];

  lista = lista.filter(reg => {
    // 1. Filtrar por texto (Número de Radicado o Remitente)
    const coincideTexto = textoBusqueda === "" || 
      (reg.radicado && reg.radicado.toLowerCase().includes(textoBusqueda)) || 
      (reg.remitente && reg.remitente.toLowerCase().includes(textoBusqueda));

    if (!coincideTexto) return false;

    // 2. Filtrar por Fecha (Año y Mes de F. Radicación)
    if (anoSeleccionado || mesSeleccionado) {
      if (!reg.fechaRadicacion) return false;
      const partes = reg.fechaRadicacion.split('-'); // [YYYY, MM, DD]
      const anoReg = partes[0];
      const mesReg = partes[1];

      const cumpleAno = anoSeleccionado ? anoReg === anoSeleccionado : true;
      const cumpleMes = mesSeleccionado ? mesReg === mesSeleccionado : true;

      return cumpleAno && cumpleMes;
    }

    return true;
  });

  // Ordenar también los resultados filtrados del más reciente al más antiguo
  lista.sort((a, b) => new Date(b.fechaRadicacion) - new Date(a.fechaRadicacion));

  renderizarTablaRadicados(lista);
};

window.toggleMonthGroup = function(button) {
  const expanded = button.getAttribute('aria-expanded') === 'true';
  const monthGroupRow = button.closest('tr');
  const tbody = monthGroupRow?.parentElement;
  if (!tbody) return;

  let nextRow = monthGroupRow.nextElementSibling;
  while (nextRow?.classList.contains('month-record-row')) {
    nextRow.hidden = expanded;
    nextRow = nextRow.nextElementSibling;
  }

  button.setAttribute('aria-expanded', String(!expanded));
  const icon = button.querySelector('i');
  if (icon) {
    icon.classList.toggle('bi-chevron-down', !expanded);
    icon.classList.toggle('bi-chevron-right', expanded);
  }
};
