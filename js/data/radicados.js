export let datosRadicados = {
  "Secretaría de Gobierno": [],
  "Secretaría de Planeación": [],
  "Oficina de Gestion del Riesgo y Desastres": [],
  "Oficina de Desarrollo Social": [],
  "Secretaría de Salud": [],
  "Control Interno": [],
  "Oficina Juridica": [],
  "Despacho del Alcalde": [],
  "Secretaría de Umata": [],
  "Secretaría de Educación": [],
  "Secretaría de Hacienda": [],
  "Sisben": [],
  "Talento Humano": [],
  "Secretaría de Transito y Transporte": [],
  "Gestion Social": []
};

export let dependenciaActual = "";

export function establecerDatosRadicados(datos) {
  datosRadicados = datos;
}

export function establecerDependenciaActual(nombre) {
  dependenciaActual = nombre;
}
