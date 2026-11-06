# Notificaciones por correo

El sistema usa el Apps Script existente para enviar avisos de nuevas solicitudes, remisiones, recepciones y rechazos. `Gestion Social`, `Secretaría de Gobierno` y `Secretaría de Planeación` están configuradas temporalmente para recibir los avisos en `majodabel19@gmail.com`; los demás destinatarios se agregan en `dependenciaNombreCorreo` de `apps-script/Code.gs`.

## Publicar el Apps Script

1. En [Google Apps Script](https://script.google.com/home), abre el proyecto existente que usa la aplicación para archivos y verifica que su implementación coincida con `GOOGLE_SCRIPT_URL` en `js/config/firebase-config.js`.
2. Reemplaza el contenido de `Code.gs` por el de `apps-script/Code.gs` y guarda.
3. En **Implementar > Gestionar implementaciones**, edita la implementación de tipo **Aplicación web**, selecciona **Ejecutar como: yo**, conserva el acceso que usa la aplicación y publica una nueva versión.
4. Autoriza los permisos de envío de correo y solicitudes externas cuando Google los solicite.

La acción de correo requiere una sesión válida de Firebase. El Apps Script valida el perfil y vuelve a leer los registros con el token de Firebase antes de enviar; solo los destinatarios configurados en `dependenciaNombreCorreo` reciben mensajes. El correo incluye un aviso destacado que cambia según la gestión (solicitud, remisión, recepción o rechazo), además de los datos del radicado; no adjunta archivos. El escudo del correo usa `assets/images/escudo-alcaldia-sin-fondo.png`, optimizado con fondo transparente. Para que aparezca, publica ese archivo en Vercel junto con la aplicación.

## Publicar reglas de Firestore

Desde la raíz del proyecto:

```powershell
firebase deploy --only firestore:rules --project pqrsalcaldiaarjona
```

Las reglas permiten a la dependencia destinataria leer un radicado remitido a ella, necesario para validar y notificar recepciones y rechazos.
