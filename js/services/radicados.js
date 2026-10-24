import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, RADICADOS_COLLECTION } from '../config/firebase-config.js';
import { datosRadicados, dependenciaActual, establecerDatosRadicados } from '../data/radicados.js';
import { sumarDiasHabilesColombia } from '../utils/helpers.js';
import { actualizarContadores, actualizarResumenRadicados } from '../modules/radicados/resumen.js';
import { abrirDependencia } from '../modules/radicados/detalle.js';

export async function cargarDatosDesdeFirebase() {
  const filtrosDetalle = dependenciaActual
    ? {
        busqueda: document.getElementById('inputBuscar')?.value || '',
        ano: document.getElementById('filtroAno')?.value || '',
        mes: document.getElementById('filtroMes')?.value || '',
        mesesDesplegados: Array.from(
          document.querySelectorAll('#cuerpoTablaExclusiva .month-group-toggle[aria-expanded="true"]')
        )
          .map(button => button.closest('tr')?.nextElementSibling?.dataset.monthGroup)
          .filter(Boolean)
      }
    : null;

  try {
    const querySnapshot = await getDocs(collection(db, RADICADOS_COLLECTION));
    console.log(`Consulta Firestore a "${RADICADOS_COLLECTION}": ${querySnapshot.size} documentos encontrados.`);
    if (querySnapshot.empty) {
      console.warn(`No se encontraron documentos en la colección "${RADICADOS_COLLECTION}". Verifica que el nombre coincida con la colección real en Firestore.`);
    }

    establecerDatosRadicados({
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
    });

    querySnapshot.forEach((documento) => {
      const item = documento.data();
      const dep = item.dependencia;
      if (datosRadicados[dep]) {
        datosRadicados[dep].push({
          id: documento.id,
          dependencia: dep,
          radicado: item.radicado,
          estado: item.estado || 'VIGENTE',
          fechaRadicacion: item.fechaRadicacion || '',
          fechaEntregaManual: item.fechaEntregaManual || '',
          fechaVencimiento: item.fechaVencimiento || item.fechaEntrega || sumarDiasHabilesColombia(item.fechaRadicacion, item.diasHabiles || 15),
          diasHabiles: item.diasHabiles || 15,
          remitente: item.remitente,
          asunto: item.asunto,
          funcionarioAsignado: item.funcionarioAsignado || '',
          pdfUrl: item.pdfUrl || '',
          respuestaUrl: item.respuestaUrl || '',
          otrosEstados: item.otrosEstados || '',
          observaciones: item.observaciones || ''
        });
      }
    });

    actualizarContadores();
    actualizarResumenRadicados();
    if (dependenciaActual) {
      abrirDependencia(dependenciaActual);
      if (filtrosDetalle) {
        const inputBuscar = document.getElementById('inputBuscar');
        const filtroAno = document.getElementById('filtroAno');
        const filtroMes = document.getElementById('filtroMes');
        if (inputBuscar) inputBuscar.value = filtrosDetalle.busqueda;
        if (filtroAno) filtroAno.value = filtrosDetalle.ano;
        if (filtroMes) filtroMes.value = filtrosDetalle.mes;
        window.aplicarFiltrosRadicados?.();

        document.querySelectorAll('#cuerpoTablaExclusiva .month-group-toggle').forEach(button => {
          const mesKey = button.closest('tr')?.nextElementSibling?.dataset.monthGroup;
          if (mesKey && filtrosDetalle.mesesDesplegados.includes(mesKey)) {
            window.toggleMonthGroup?.(button);
          }
        });
      }
    }
  } catch (err) {
    console.error("Error cargando desde Firebase:", err);
    const resumenRecientes = document.getElementById('resumenRecientes');
    if (resumenRecientes) {
      resumenRecientes.textContent = 'No fue posible cargar el resumen de radicados.';
    }
  }
}
