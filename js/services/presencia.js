import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { realtimeDb } from '../config/firebase-config.js';

let presenciaActual = null;

function crearTokenPresencia() {
  return window.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function resolverEsperasConexion(estado, error = null) {
  const esperas = Array.from(estado.esperas);
  estado.esperas.clear();
  esperas.forEach(resolver => resolver(error));
}

function esperarConexion(estado) {
  if (estado.conectado) return Promise.resolve(estado.token);
  return new Promise((resolve, reject) => {
    let finalizada = false;
    const resolver = error => {
      if (finalizada) return;
      finalizada = true;
      window.clearTimeout(temporizador);
      estado.esperas.delete(resolver);
      if (error) reject(error);
      else resolve(estado.token);
    };
    const temporizador = window.setTimeout(() => {
      resolver(new Error('No se pudo conectar con Realtime Database. Verifica que estén publicadas sus reglas.'));
    }, 15000);
    estado.esperas.add(resolver);
  });
}

export async function obtenerTokenPresenciaPQRS(uid) {
  if (!uid) throw new Error('No se pudo identificar la cuenta para registrar su conexión.');
  if (presenciaActual?.uid !== uid) {
    await detenerPresenciaPQRS();
    const token = crearTokenPresencia();
    const conexionRef = ref(realtimeDb, `presenciaPQRS/${token}`);
    const estado = {
      uid,
      token,
      conexionRef,
      conectado: false,
      registrando: false,
      esperas: new Set(),
      desuscribir: null
    };
    presenciaActual = estado;
    estado.desuscribir = onValue(
      ref(realtimeDb, '.info/connected'),
      snapshot => {
        if (snapshot.val() !== true) {
          estado.conectado = false;
          return;
        }
        if (estado.registrando) return;
        estado.registrando = true;
        onDisconnect(conexionRef).remove()
          .then(() => set(conexionRef, {
            uid,
            conectadoEn: serverTimestamp()
          }))
          .then(() => {
            estado.conectado = true;
            estado.registrando = false;
            resolverEsperasConexion(estado);
          })
          .catch(error => {
            estado.conectado = false;
            estado.registrando = false;
            console.error('No fue posible registrar la presencia en Realtime Database:', error);
            resolverEsperasConexion(estado, error);
            if (presenciaActual === estado) {
              estado.desuscribir?.();
              presenciaActual = null;
            }
          });
      },
      error => {
        estado.conectado = false;
        console.error('No fue posible observar la conexión con Realtime Database:', error);
        resolverEsperasConexion(estado, error);
        if (presenciaActual === estado) {
          estado.desuscribir?.();
          presenciaActual = null;
        }
      }
    );
  }
  return esperarConexion(presenciaActual);
}

export async function detenerPresenciaPQRS() {
  const estado = presenciaActual;
  if (!estado) return;
  presenciaActual = null;
  estado.desuscribir?.();
  resolverEsperasConexion(
    estado,
    new Error('La sesión se está cerrando antes de completar la conexión.')
  );
  try {
    await remove(estado.conexionRef);
  } catch (error) {
    console.error('No fue posible quitar la presencia antes de cerrar sesión:', error);
  }
}

export function observarPresenciaPQRS(token, alCambiar, alFallar) {
  return onValue(
    ref(realtimeDb, `presenciaPQRS/${token}`),
    snapshot => alCambiar(snapshot.exists() ? snapshot.val() : null),
    alFallar
  );
}
