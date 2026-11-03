const PREFIJO_ID_OPCIONES = 'opciones-select-';
const selectoresPersonalizados = new Map();
const ICONO_FLECHA = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2718%27 height=%2718%27 fill=%27none%27 stroke=%27%23566b7d%27 stroke-width=%271.8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27m7 10 5 5 5-5%27/%3E%3C/svg%3E")';
let cerrarListaActiva;
let siguienteIdSelector = 0;

function formatearEtiqueta(texto) {
  return String(texto || '')
    .toLocaleLowerCase('es-CO')
    .replace(/(^|[\s-])(\p{L})/gu, (coincidencia, separador, letra) => (
      `${separador}${letra.toLocaleUpperCase('es-CO')}`
    ));
}

function obtenerEtiqueta(selector) {
  const opcion = selector.options[selector.selectedIndex];
  if (selector.id === 'tipoPeriodoExportarGeneracion' && opcion?.value === 'mes') {
    return 'Mes y Año';
  }
  const etiqueta = formatearEtiqueta(opcion?.textContent || '');
  return etiqueta;
}

function inicializarSelector(selector) {
  if (selector.dataset.customizado === 'true'
    || selector.multiple
    || selector.size > 1
    || selector.hidden
    || selector.closest(
      '#pantallaDependencia .detail-filters, #pantallaDependencia .detail-month-filter, #pantallaIAS .ias-filters'
    )
    || selector.closest('[hidden]')) return;

  selector.dataset.customizado = 'true';
  const formulario = selector.form;
  const etiquetas = Array.from(selector.labels || []);
  const contenedor = document.createElement('div');
  contenedor.className = 'custom-select-wrapper';
  const estiloOriginal = getComputedStyle(selector);
  const propiedadesDeDistribucion = [
    'flex',
    'min-width',
    'max-width',
    'margin',
    'align-self',
    'order'
  ];
  if (selector.getClientRects().length > 0) propiedadesDeDistribucion.push('width');
  propiedadesDeDistribucion.forEach(propiedad => {
    const valor = estiloOriginal.getPropertyValue(propiedad);
    if (valor && valor !== 'auto') contenedor.style.setProperty(propiedad, valor);
  });
  if (selector.classList.contains('tipo-peticion-select')) {
    contenedor.classList.add('custom-select-wrapper--compact');
  }
  if (selector.closest('.detail-filters')) {
    contenedor.classList.add('custom-select-wrapper--detail-filter');
  }

  const boton = document.createElement('button');
  boton.type = 'button';
  const idBaseBoton = selector.id
    ? `${selector.id}-personalizado`
    : `select-personalizado-${++siguienteIdSelector}`;
  boton.id = document.getElementById(idBaseBoton)
    ? `${idBaseBoton}-${++siguienteIdSelector}`
    : idBaseBoton;
  boton.className = 'custom-select-trigger';
  [
    'box-sizing',
    'min-height',
    'padding',
    'border',
    'border-radius',
    'background-color',
    'background-image',
    'background-repeat',
    'background-position',
    'background-size',
    'box-shadow',
    'color',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'text-align',
    'transition',
    'cursor'
  ].forEach(propiedad => {
    const valor = estiloOriginal.getPropertyValue(propiedad);
    if (valor) boton.style.setProperty(propiedad, valor);
  });
  if (contenedor.classList.contains('custom-select-wrapper--detail-filter')) {
    boton.style.setProperty(
      'background-image',
      `${estiloOriginal.backgroundImage}, ${ICONO_FLECHA}`
    );
    boton.style.setProperty(
      'background-position',
      `${estiloOriginal.backgroundPosition}, right 13px center`
    );
    boton.style.setProperty(
      'background-size',
      `${estiloOriginal.backgroundSize}, 18px 18px`
    );
    boton.style.setProperty(
      'background-repeat',
      `${estiloOriginal.backgroundRepeat}, no-repeat`
    );
  }
  boton.style.width = '100%';
  boton.setAttribute('role', 'combobox');
  boton.setAttribute('aria-haspopup', 'listbox');
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-controls', `${PREFIJO_ID_OPCIONES}${boton.id}`);
  if (selector.required) boton.setAttribute('aria-required', 'true');
  if (selector.title) boton.title = selector.title;
  if (selector.getAttribute('aria-label')) {
    boton.setAttribute('aria-label', selector.getAttribute('aria-label'));
  } else if (etiquetas.length > 0) {
    if (!etiquetas[0].id) etiquetas[0].id = `${selector.id}-etiqueta`;
    boton.setAttribute('aria-labelledby', etiquetas.map(etiqueta => etiqueta.id).join(' '));
    etiquetas.forEach(etiqueta => {
      if (etiqueta.htmlFor === selector.id) etiqueta.htmlFor = boton.id;
    });
  }

  const lista = document.createElement('div');
  lista.id = `${PREFIJO_ID_OPCIONES}${boton.id}`;
  lista.className = 'custom-select-listbox';
  lista.setAttribute('role', 'listbox');
  if (boton.hasAttribute('aria-labelledby')) {
    lista.setAttribute('aria-labelledby', boton.getAttribute('aria-labelledby'));
  } else if (boton.hasAttribute('aria-label')) {
    lista.setAttribute('aria-label', boton.getAttribute('aria-label'));
  }
  lista.hidden = true;

  selector.classList.add('custom-select-native');
  selector.setAttribute('aria-hidden', 'true');
  selector.tabIndex = -1;
  selector.insertAdjacentElement('beforebegin', contenedor);
  contenedor.append(selector, boton);
  document.body.append(lista);

  let opciones = [];
  let indiceActivo = -1;

  const actualizarEstado = () => {
    boton.textContent = obtenerEtiqueta(selector) || 'Selecciona una opción';
    boton.disabled = selector.disabled;
    boton.setAttribute('aria-required', String(selector.required));
    if (selector.validity.valid) boton.removeAttribute('aria-invalid');
    renderizarOpciones();
  };

  const renderizarOpciones = () => {
    const opcionSeleccionada = selector.selectedIndex;
    opciones = Array.from(selector.options, (opcion, indice) => {
      const elemento = document.createElement('button');
      elemento.type = 'button';
      elemento.className = 'custom-select-option';
      elemento.setAttribute('role', 'option');
      elemento.setAttribute('aria-selected', String(indice === opcionSeleccionada));
      elemento.tabIndex = -1;
      elemento.disabled = opcion.disabled;
      elemento.textContent = selector.id === 'tipoPeriodoExportarGeneracion' && opcion.value === 'mes'
        ? 'Mes y Año'
        : formatearEtiqueta(opcion.textContent);
      elemento.addEventListener('click', () => {
        if (opcion.disabled) return;
        selector.selectedIndex = indice;
        selector.dispatchEvent(new Event('change', { bubbles: true }));
        cerrar();
        boton.focus();
      });
      return elemento;
    });
    lista.replaceChildren(...opciones);
    if (lista.getAttribute('aria-activedescendant')) {
      lista.removeAttribute('aria-activedescendant');
    }
  };

  const posicionarLista = () => {
    if (lista.hidden) return;
    const rectangulo = boton.getBoundingClientRect();
    const altoDisponibleDebajo = window.innerHeight - rectangulo.bottom - 8;
    const altoDisponibleEncima = rectangulo.top - 8;
    const ubicarEncima = altoDisponibleDebajo < 180 && altoDisponibleEncima > altoDisponibleDebajo;
    const altoDisponible = Math.max(100, Math.min(280, ubicarEncima
      ? altoDisponibleEncima
      : altoDisponibleDebajo));
    lista.style.left = `${Math.max(8, Math.min(rectangulo.left, window.innerWidth - rectangulo.width - 8))}px`;
    lista.style.width = `${Math.min(rectangulo.width, window.innerWidth - 16)}px`;
    lista.style.maxHeight = `${altoDisponible}px`;
    lista.style.top = ubicarEncima
      ? `${Math.max(8, rectangulo.top - Math.min(lista.offsetHeight, altoDisponible) - 6)}px`
      : `${rectangulo.bottom + 6}px`;
  };

  const cerrar = () => {
    lista.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    if (cerrarListaActiva === cerrar) cerrarListaActiva = undefined;
  };

  const enfocarOpcion = indice => {
    if (opciones.length === 0) return;
    indiceActivo = Math.max(0, Math.min(indice, opciones.length - 1));
    opciones[indiceActivo].focus();
    lista.setAttribute('aria-activedescendant', opciones[indiceActivo].id
      || (opciones[indiceActivo].id = `${lista.id}-opcion-${indiceActivo}`));
  };

  const abrir = indiceInicial => {
    cerrarListaActiva?.();
    actualizarEstado();
    lista.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    cerrarListaActiva = cerrar;
    posicionarLista();
    const indiceSeleccionado = selector.selectedIndex >= 0 ? selector.selectedIndex : 0;
    enfocarOpcion(indiceInicial ?? indiceSeleccionado);
  };

  boton.addEventListener('click', () => {
    if (lista.hidden) abrir();
    else cerrar();
  });

  boton.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      abrir(selector.selectedIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Escape') {
      cerrar();
    }
  });

  lista.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      cerrar();
      boton.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      enfocarOpcion(indiceActivo + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      enfocarOpcion(indiceActivo - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      enfocarOpcion(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      enfocarOpcion(opciones.length - 1);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      opciones[indiceActivo]?.click();
    }
  });

  const manejarCambio = () => actualizarEstado();
  const manejarInvalido = () => {
    boton.setAttribute('aria-invalid', 'true');
    boton.focus();
  };
  const sincronizarTrasReset = () => {
    setTimeout(actualizarEstado);
  };
  selector.addEventListener('change', manejarCambio);
  selector.addEventListener('invalid', manejarInvalido);
  formulario?.addEventListener('reset', sincronizarTrasReset);

  etiquetas.forEach(etiqueta => {
    if (etiqueta.htmlFor === selector.id) etiqueta.htmlFor = boton.id;
  });

  const cerrarAlHacerClickFuera = event => {
    if (!lista.hidden && !contenedor.contains(event.target) && !lista.contains(event.target)) cerrar();
  };
  document.addEventListener('pointerdown', cerrarAlHacerClickFuera);
  document.addEventListener('scroll', posicionarLista, true);
  window.addEventListener('resize', posicionarLista);

  actualizarEstado();
  selectoresPersonalizados.set(selector, {
    sincronizar: actualizarEstado,
    destruir: () => {
      cerrar();
      lista.remove();
      contenedor.remove();
      document.removeEventListener('pointerdown', cerrarAlHacerClickFuera);
      document.removeEventListener('scroll', posicionarLista, true);
      window.removeEventListener('resize', posicionarLista);
      selector.removeEventListener('change', manejarCambio);
      selector.removeEventListener('invalid', manejarInvalido);
      formulario?.removeEventListener('reset', sincronizarTrasReset);
    }
  });
}

function procesarMutaciones(registros) {
  registros.forEach(registro => {
    if (registro.type === 'childList') {
      registro.removedNodes.forEach(nodo => {
        if (!(nodo instanceof Element)) return;
        const selectores = [
          ...(nodo.matches('select') ? [nodo] : []),
          ...nodo.querySelectorAll('select')
        ];
        selectores.forEach(selector => {
          if (selector.isConnected) return;
          selectoresPersonalizados.get(selector)?.destruir();
          selectoresPersonalizados.delete(selector);
        });
      });
      registro.addedNodes.forEach(nodo => {
        if (!(nodo instanceof Element)) return;
        if (nodo.matches('select')) inicializarSelector(nodo);
        nodo.querySelectorAll('select').forEach(inicializarSelector);
      });
      if (registro.target instanceof HTMLSelectElement) {
        selectoresPersonalizados.get(registro.target)?.sincronizar();
      }
    } else if (registro.type === 'attributes') {
      if (registro.target instanceof HTMLSelectElement) {
        selectoresPersonalizados.get(registro.target)?.sincronizar();
        return;
      }

      registro.target.querySelectorAll('select').forEach(selector => {
        inicializarSelector(selector);
        selectoresPersonalizados.get(selector)?.sincronizar();
      });
    }
  });
}

export function inicializarSelectoresPersonalizados(contenedor = document.body) {
  contenedor.querySelectorAll('select').forEach(inicializarSelector);
  const observador = new MutationObserver(procesarMutaciones);
  observador.observe(contenedor, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['disabled', 'required', 'hidden', 'style']
  });
}
