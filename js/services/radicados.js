import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, RADICADOS_COLLECTION } from '../config/firebase-config.js';
import { datosRadicados, dependenciaActual, establecerDatosRadicados } from '../data/radicados.js';
import { esAdministrador, esFuncionario, obtenerDependenciaSesion } from '../modules/auth/roles.js';
import { sumarDiasHabilesColombia } from '../utils/helpers.js';
import { actualizarContadores, actualizarResumenRadicados } from '../modules/radicados/resumen.js';
import { abrirDependencia } from '../modules/radicados/detalle.js';
import {
  establecerErrorDependenciasInforme,
  establecerDependenciasInforme
} from '../modules/informes/tablero.js';

const periodosRadicadosCargados = new Map();
const cargasPeriodoRadicados = new Map();
let cargaAnoInicialRadicados;

export async function obtenerAnoInicialRadicados() {
  if (!cargaAnoInicialRadicados) {
    cargaAnoInicialRadicados = (async () => {
      const condiciones = [];
      if (!esAdministrador() && esFuncionario()) {
        condiciones.push(where('dependencia', '==', obtenerDependenciaSesion()));
      }
      if (!esAdministrador() && !esFuncionario()) {
        throw new Error('Se requiere una sesión autorizada para consultar los radicados.');
      }
      const snapshot = await getDocs(query(
        collection(db, RADICADOS_COLLECTION),
        ...condiciones,
        orderBy('fechaRadicacion', 'asc'),
        limit(1)
      ));
      if (snapshot.empty) return String(new Date().getFullYear());

      const fecha = String(snapshot.docs[0].data().fechaRadicacion || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new Error('No fue posible determinar el año inicial de los radicados.');
      }
      return fecha.slice(0, 4);
    })();
  }

  try {
    return await cargaAnoInicialRadicados;
  } catch (error) {
    cargaAnoInicialRadicados = null;
    throw error;
  }
}

function obtenerRangoConsulta({ ano, mes, inicio, fin } = {}) {
  if (inicio || fin) {
    return {
      inicio: inicio || '0000-01-01',
      fin: fin || '9999-12-31',
      clave: `rango:${inicio || ''}:${fin || ''}`
    };
  }

  const ahora = new Date();
  const anoActual = String(ahora.getFullYear());
  const mesActual = String(ahora.getMonth() + 1).padStart(2, '0');
  const anoConsulta = ano ?? (dependenciaActual
    ? document.getElementById('filtroAno')?.value ?? anoActual
    : anoActual);
  const mesConsulta = mes ?? (dependenciaActual
    ? document.getElementById('filtroMes')?.value ?? mesActual
    : mesActual);
  if (!anoConsulta) {
    return {
      inicio: '0000-01-01',
      fin: '9999-12-31',
      clave: 'todos'
    };
  }
  const mesKey = `${anoConsulta}-${mesConsulta}`;
  if (mesConsulta && anoConsulta) {
    const ultimoDia = new Date(Number(anoConsulta), Number(mesConsulta), 0).getDate();
    return {
      inicio: `${mesKey}-01`,
      fin: `${mesKey}-${String(ultimoDia).padStart(2, '0')}`,
      clave: mesKey
    };
  }

  if (!mesConsulta && anoConsulta) return {
    inicio: `${anoConsulta}-01-01`,
    fin: `${anoConsulta}-12-31`,
    clave: `ano:${anoConsulta}`
  };
  return {
    inicio: `${anoConsulta}-01-01`,
    fin: `${anoConsulta}-12-31`,
    clave: `ano:${anoConsulta}`
  };
}

function perteneceAlRango(registro, { inicio, fin }) {
  const fecha = String(registro.fechaRadicacion || '').slice(0, 10);
  return fecha >= inicio && fecha <= fin;
}

function periodoRadicadoCargado(rango) {
  return Array.from(periodosRadicadosCargados.values()).some(periodo => (
    periodo.inicio <= rango.inicio && periodo.fin >= rango.fin
  ));
}

function mapearRadicado(documento) {
  const item = documento.data();
  const dependencia = item.dependencia;
  return {
    id: documento.id,
    dependencia,
    radicado: item.radicado,
    estado: item.estado || 'VIGENTE',
    tipoCanal: item.tipoCanal || '',
    fechaRadicacion: item.fechaRadicacion || '',
    fechaHoraRadicacion: item.fechaHoraRadicacion || '',
    fechaEntregaManual: item.fechaEntregaManual || '',
    fechaVencimiento: item.fechaVencimiento || item.fechaEntrega || sumarDiasHabilesColombia(item.fechaRadicacion, item.diasHabiles || 15),
    diasHabiles: item.diasHabiles || 15,
    remitente: item.remitente,
    asunto: item.asunto,
    funcionarioAsignado: item.funcionarioAsignado || '',
    pdfUrl: item.pdfUrl || '',
    respuestaUrl: item.respuestaUrl || '',
    fechaCargaRespuesta: item.fechaCargaRespuesta || '',
    tipoPeticion: item.tipoPeticion || '',
    otrosEstados: item.otrosEstados || '',
    observaciones: item.observaciones || '',
    dependenciasRecibidas: Array.isArray(item.dependenciasRecibidas) ? item.dependenciasRecibidas : [],
    dependenciasRechazadas: Array.isArray(item.dependenciasRechazadas) ? item.dependenciasRechazadas : [],
    dependenciasDestino: Array.isArray(item.dependenciasDestino) ? item.dependenciasDestino : [],
    remisionOrigenId: item.remisionOrigenId || '',
    remisionOrigenColeccion: item.remisionOrigenColeccion || RADICADOS_COLLECTION,
    remisionOrigenDependencia: item.remisionOrigenDependencia || '',
    remisionOrigenRadicado: item.remisionOrigenRadicado || '',
    fechaRemisionCompetencia: item.fechaRemisionCompetencia || '',
    fechaRecepcionCompetencia: item.fechaRecepcionCompetencia || ''
  };
}

export async function cargarDatosDesdeFirebase(opciones = {}) {
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
    const rango = obtenerRangoConsulta(opciones);
    const forzar = opciones.forzar ?? true;
    if (periodoRadicadoCargado(rango) && !forzar) {
      establecerDependenciasInforme();
      return true;
    }
    if (cargasPeriodoRadicados.has(rango.clave)) {
      return await cargasPeriodoRadicados.get(rango.clave);
    }

    const registrosRef = collection(db, RADICADOS_COLLECTION);
    const condiciones = [];
    if (!esAdministrador() && esFuncionario()) {
      condiciones.push(where('dependencia', '==', obtenerDependenciaSesion()));
    }
    if (!esAdministrador() && !esFuncionario()) {
      throw new Error('Se requiere una sesión autorizada para consultar los radicados.');
    }
    condiciones.push(where('fechaRadicacion', '>=', rango.inicio));
    condiciones.push(where('fechaRadicacion', '<=', rango.fin));
    const promesaConsulta = (async () => {
      const querySnapshot = await getDocs(query(registrosRef, ...condiciones));
      console.log(`Consulta Firestore a "${RADICADOS_COLLECTION}" (${rango.clave}): ${querySnapshot.size} documentos encontrados.`);
      const registrosNuevos = querySnapshot.docs
        .map(mapearRadicado)
        .filter(registro => datosRadicados[registro.dependencia]);
      const identificadores = new Set(registrosNuevos.map(registro => registro.id));
      const datosActualizados = Object.fromEntries(
        Object.entries(datosRadicados).map(([dependencia, lista]) => [
          dependencia,
          lista.filter(registro => !perteneceAlRango(registro, rango) && !identificadores.has(registro.id))
        ])
      );
      registrosNuevos.forEach(registro => datosActualizados[registro.dependencia].push(registro));
      establecerDatosRadicados(datosActualizados);
      periodosRadicadosCargados.set(rango.clave, { inicio: rango.inicio, fin: rango.fin });

      actualizarContadores();
      actualizarResumenRadicados();
      establecerDependenciasInforme();
      if (dependenciaActual && opciones.actualizarVista !== false) {
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
      return true;
    })();
    cargasPeriodoRadicados.set(rango.clave, promesaConsulta);
    try {
      return await promesaConsulta;
    } finally {
      cargasPeriodoRadicados.delete(rango.clave);
    }
  } catch (err) {
    console.error('Error cargando desde Firebase:', err);
    establecerErrorDependenciasInforme();
    const resumenRecientes = document.getElementById('resumenRecientes');
    if (resumenRecientes) {
      resumenRecientes.textContent = 'No fue posible cargar los vencimientos.';
    }
    return false;
  }
}
