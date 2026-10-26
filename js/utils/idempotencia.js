function leerSolicitudesPendientes(storage, storageKey) {
  const contenido = storage.getItem(storageKey);
  if (!contenido) return {};

  let solicitudes;
  try {
    solicitudes = JSON.parse(contenido);
  } catch {
    throw new Error('No se pudo recuperar el estado de un envío pendiente. No borres los datos del formulario; recarga la página e inténtalo de nuevo.');
  }

  if (!solicitudes || typeof solicitudes !== 'object' || Array.isArray(solicitudes)) {
    throw new Error('El estado de los envíos pendientes no es válido. No borres los datos del formulario; recarga la página e inténtalo de nuevo.');
  }
  return solicitudes;
}

export function obtenerClaveIdempotencia(fingerprint, storage, storageKey, crearId) {
  const solicitudes = leerSolicitudesPendientes(storage, storageKey);
  const claveExistente = solicitudes[fingerprint];
  if (typeof claveExistente === 'string' && claveExistente) return claveExistente;

  const clave = crearId();
  solicitudes[fingerprint] = clave;
  storage.setItem(storageKey, JSON.stringify(solicitudes));
  return clave;
}

export function completarClaveIdempotencia(fingerprint, clave, storage, storageKey) {
  const solicitudes = leerSolicitudesPendientes(storage, storageKey);
  if (solicitudes[fingerprint] !== clave) return false;

  delete solicitudes[fingerprint];
  if (Object.keys(solicitudes).length === 0) {
    storage.removeItem(storageKey);
  } else {
    storage.setItem(storageKey, JSON.stringify(solicitudes));
  }
  return true;
}
