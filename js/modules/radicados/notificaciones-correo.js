import { auth, GOOGLE_SCRIPT_URL } from '../../config/firebase-config.js';

export async function enviarNotificacionCorreo(tipo, datos = {}) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Debes iniciar sesión para enviar una notificación por correo.');

  const token = await usuario.getIdToken();
  const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'notification',
      tipo,
      ...datos,
      uid: usuario.uid,
      idToken: token
    })
  });
  if (!respuesta.ok) {
    throw new Error(`El servicio de correo respondió con el estado ${respuesta.status}.`);
  }

  const resultado = await respuesta.json();
  if (resultado.status !== 'success') {
    const versionAntigua = Boolean(resultado.version)
      && resultado.version !== 'email-notifications-10';
    const diagnostico = resultado.stage ? ` (etapa: ${resultado.stage})` : '';
    const actualizacionPendiente = versionAntigua
      ? ' El Apps Script aún está ejecutando una versión anterior; publica una nueva versión de la aplicación web.'
      : resultado.version
        ? ''
        : ' El Apps Script respondió sin información de versión; revisa sus ejecuciones para identificar el error.';
    throw new Error(
      `${resultado.message || 'El servicio de correo no pudo procesar la notificación.'}${diagnostico}${actualizacionPendiente}`
    );
  }
  return resultado;
}

export async function informarResultadoNotificacionCorreo(tipo, datos) {
  try {
    const resultado = await enviarNotificacionCorreo(tipo, datos);
    const destinosSinCorreo = Array.isArray(resultado.skipped)
      ? [...new Set(resultado.skipped)]
      : [];
    if (destinosSinCorreo.length) {
      alert(
        resultado.sent
          ? `Se enviaron ${resultado.sent} correo(s). Falta configurar el correo de: ${destinosSinCorreo.join(', ')}.`
          : `La acción se completó, pero falta configurar el correo de: ${destinosSinCorreo.join(', ')}.`
      );
    } else if (resultado.sent === 0 && !resultado.alreadySent) {
      alert('La acción se completó, pero no se envió ningún correo.');
    }
  } catch (error) {
    console.error('No fue posible enviar la notificación por correo:', error);
    alert(`La acción se completó, pero no se pudo enviar el correo: ${error.message}`);
  }
}
