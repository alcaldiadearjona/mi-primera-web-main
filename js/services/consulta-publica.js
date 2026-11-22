import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db, RADICADOS_COLLECTION } from '../config/firebase-config.js';
import { esAdministrador } from '../modules/auth/roles.js';
import { obtenerUrlHttpsSegura } from '../utils/helpers.js';

export const COLECCION_CONSULTA_PUBLICA = 'consultaPublicaRadicados';
const REFERENCIA_MIGRACION = doc(db, 'consultaPublicaMigraciones', 'ciudadanos-v1');

function crearVistaPublica(radicado, registro) {
  const otrosEstados = String(registro.otrosEstados || '').trim();
  const estadoGestion = ['Para conocimiento', 'No requiere respuesta'].find(
    estado => estado.toLocaleLowerCase('es-CO') === otrosEstados.toLocaleLowerCase('es-CO')
  ) || '';
  const prorroga = registro.prorroga && typeof registro.prorroga === 'object'
    ? {
        fechaAnterior: String(registro.prorroga.fechaAnterior || ''),
        nuevaFecha: String(registro.prorroga.nuevaFecha || ''),
        diasHabilesAdicionales: Number(registro.prorroga.diasHabilesAdicionales) || 0,
        archivoUrl: obtenerUrlHttpsSegura(registro.prorroga.archivoUrl),
        registradoEn: String(registro.prorroga.registradoEn || '')
      }
    : null;

  return {
    radicado,
    dependencia: String(registro.dependencia || ''),
    estado: String(registro.estado || 'VIGENTE'),
    fechaRadicacion: String(registro.fechaRadicacion || ''),
    fechaHoraRadicacion: String(registro.fechaHoraRadicacion || ''),
    fechaRecepcion: String(registro.fechaRecepcion || ''),
    fechaAsignacion: String(registro.fechaAsignacion || ''),
    fechaCambioEstado: String(registro.fechaCambioEstado || ''),
    fechaVencimiento: String(registro.fechaVencimiento || registro.fechaEntrega || ''),
    fechaRemisionCompetencia: String(registro.fechaRemisionCompetencia || ''),
    fechaRecepcionCompetencia: String(registro.fechaRecepcionCompetencia || ''),
    remisionOrigenDependencia: String(registro.remisionOrigenDependencia || ''),
    dependenciasDestino: Array.isArray(registro.dependenciasDestino)
      ? registro.dependenciasDestino.filter(dependencia => typeof dependencia === 'string')
      : [],
    enTramite: Boolean(String(registro.funcionarioAsignado || '').trim()),
    respuestaUrl: obtenerUrlHttpsSegura(registro.respuestaUrl),
    fechaCargaRespuesta: String(registro.fechaCargaRespuesta || ''),
    otrosEstados: estadoGestion,
    observaciones: String(registro.observaciones || '').trim(),
    notificacionRespuestaTipo: String(registro.notificacionRespuestaTipo || '').trim(),
    notificacionRespuestaContacto: String(registro.notificacionRespuestaContacto || '').trim(),
    prorroga
  };
}

export async function sincronizarConsultaPublicaRadicado(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Se requiere el identificador del radicado para publicar su consulta.');
  }
  const referencia = doc(db, RADICADOS_COLLECTION, id);
  const snapshot = await getDoc(referencia);
  if (!snapshot.exists()) {
    throw new Error(`No se encontró el radicado ${id} para actualizar su consulta pública.`);
  }
  const registro = snapshot.data();
  if (registro.radicado !== id) return false;

  await setDoc(
    doc(db, COLECCION_CONSULTA_PUBLICA, id),
    crearVistaPublica(id, registro)
  );
  return true;
}

export async function eliminarConsultaPublicaRadicado(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Se requiere el identificador del radicado para eliminar su consulta pública.');
  }
  await deleteDoc(doc(db, COLECCION_CONSULTA_PUBLICA, id));
}

export async function publicarConsultasPublicasCiudadanasFaltantes() {
  if (!esAdministrador()) {
    throw new Error('Solo el administrador puede preparar las consultas públicas existentes.');
  }
  const migracion = await getDoc(REFERENCIA_MIGRACION);
  if (migracion.exists() && migracion.data().version === 2) return 0;

  const radicados = await getDocs(collection(db, RADICADOS_COLLECTION));
  const faltantes = radicados.docs.filter(documento => (
    typeof documento.data().radicado === 'string'
    && documento.data().radicado === documento.id
  ));

  for (let inicio = 0; inicio < faltantes.length; inicio += 10) {
    const grupo = faltantes.slice(inicio, inicio + 10);
    await Promise.all(grupo.map(documento => setDoc(
      doc(db, COLECCION_CONSULTA_PUBLICA, documento.id),
      crearVistaPublica(documento.id, documento.data())
    )));
  }
  await setDoc(REFERENCIA_MIGRACION, {
    version: 2,
    completadaEn: new Date().toISOString()
  });
  return faltantes.length;
}
