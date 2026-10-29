import { ingresoMarkup } from './components/auth/ingreso.js';
import { navegacionMarkup } from './components/navegacion/menu.js';
import { aperturaVistaMarkup } from './components/vistas/layout.js';
import { inicioMarkup } from './components/vistas/inicio.js';
import { generacionMarkup } from './components/vistas/generacion.js';
import { iasMarkup } from './components/vistas/ias.js';
import { informesMarkup } from './components/vistas/informes.js';
import { dependenciasMarkup } from './components/vistas/dependencias.js';
import { detalleMarkup } from './components/vistas/detalle.js';
import { cierreVistaMarkup } from './components/vistas/cierre.js';
import { modalesMarkup } from './components/modales/modales.js';
import { avisosMarkup } from './components/modales/avisos.js';
import { inicializarAvisos } from './modules/ui/avisos.js';
import { inicializarSesion } from './modules/auth/sesion.js';
import './modules/dependencias/busqueda.js';
import { inicializarNavegacion } from './modules/navegacion/vistas.js';
import { inicializarFormulario } from './modules/radicados/formulario.js';
import { inicializarFormularioGeneracionSalida } from './modules/radicados/generacion-salida.js';
import { inicializarExportacionPlanilla } from './modules/radicados/exportar-planilla.js';
import { inicializarTableroIAS } from './modules/ias/tablero.js';
import { inicializarInformes } from './modules/informes/tablero.js';
import { inicializarAccionesRadicados } from './modules/radicados/gestion.js';
import './modules/radicados/archivos.js';
import './modules/radicados/detalle.js';
import './modules/radicados/tabla.js';
import './modules/radicados/resumen.js';
import { cargarDatosDesdeFirebase } from './services/radicados.js';


document.body.insertAdjacentHTML('beforeend', [
  ingresoMarkup,
  navegacionMarkup,
  aperturaVistaMarkup,
  inicioMarkup,
  generacionMarkup,
  iasMarkup,
  informesMarkup,
  dependenciasMarkup,
  detalleMarkup,
  cierreVistaMarkup,
  modalesMarkup,
  avisosMarkup
].join(''));

inicializarAvisos();

document.addEventListener('DOMContentLoaded', () => {
  inicializarSesion();
  inicializarFormulario();
  inicializarFormularioGeneracionSalida();
  inicializarExportacionPlanilla();
  inicializarTableroIAS();
  inicializarInformes();
  inicializarAccionesRadicados();
  inicializarNavegacion();
  cargarDatosDesdeFirebase();
});
