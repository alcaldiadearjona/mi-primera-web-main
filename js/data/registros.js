import { datosRadicados } from './radicados.js';
import { registrosIAS } from './ias.js';

export function buscarRegistroRadicado(id, coleccion = '') {
  if (coleccion === 'radicadosIAS') {
    return registrosIAS.find(registro => registro.id === id) || null;
  }
  if (coleccion === 'radicados') {
    for (const registros of Object.values(datosRadicados)) {
      const registro = registros.find(item => item.id === id);
      if (registro) return registro;
    }
    return null;
  }

  for (const registros of Object.values(datosRadicados)) {
    const registro = registros.find(item => item.id === id);
    if (registro) return registro;
  }
  return registrosIAS.find(registro => registro.id === id) || null;
}

export function obtenerColeccionRegistro(registro) {
  return registro?.coleccion === 'radicadosIAS' ? 'radicadosIAS' : 'radicados';
}

export function obtenerTodosLosRegistros() {
  return [...Object.values(datosRadicados).flat(), ...registrosIAS];
}
