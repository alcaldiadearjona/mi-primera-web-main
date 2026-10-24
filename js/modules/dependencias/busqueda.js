import { datosRadicados } from '../../data/radicados.js';

window.limpiarBusquedaDependencias = function() {
  const input = document.getElementById('inputBuscarDependencia');
  if (!input) return;

  input.value = '';
  window.filtrarDependenciasPorRadicadoOREmitente();
  input.focus();
};

window.filtrarDependenciasPorRadicadoOREmitente = function() {
  const input = document.getElementById('inputBuscarDependencia');
  if (!input) return;

  // Función interna para remover acentos/tildes
  const quitarTildes = (texto) => 
    texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const textoBusqueda = quitarTildes(input.value);
  const contenedor = document.getElementById('contenedorDependencias');
  if (!contenedor) return;

  const tarjetas = contenedor.querySelectorAll('.dep-card');

  tarjetas.forEach(tarjeta => {
    const tituloDepOriginal = tarjeta.querySelector('h3')?.textContent.trim() || "";
    const tituloDepSinTildes = quitarTildes(tituloDepOriginal);
    
    // Si el buscador está vacío, muestra todas las tarjetas
    if (textoBusqueda === "") {
      tarjeta.style.display = "";
      return;
    }

    // 1. Coincidencia por el nombre de la dependencia (sin tildes)
    const coincideNombreDep = tituloDepSinTildes.includes(textoBusqueda);

    // 2. Coincidencia por radicados o remitentes internos (sin tildes)
    let coincideRadicadoORemitente = false;
    if (typeof datosRadicados !== 'undefined' && datosRadicados && datosRadicados[tituloDepOriginal]) {
      const listaRadicados = datosRadicados[tituloDepOriginal] || [];
      coincideRadicadoORemitente = listaRadicados.some(reg => {
        const coincideRad = reg.radicado && quitarTildes(String(reg.radicado)).includes(textoBusqueda);
        const coincideRem = reg.remitente && quitarTildes(String(reg.remitente)).includes(textoBusqueda);
        return coincideRad || coincideRem;
      });
    }

    // 3. Aplicar visibilidad a la tarjeta
    if (coincideNombreDep || coincideRadicadoORemitente) {
      tarjeta.style.display = "";
    } else {
      tarjeta.style.display = "none";
    }
  });
};

// Función para iniciar sesión y guardar la sesión en el navegador
