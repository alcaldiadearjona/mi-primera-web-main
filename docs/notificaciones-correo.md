# Notificaciones por correo

El sistema usa el Apps Script existente para enviar avisos de nuevas solicitudes, remisiones, recepciones y rechazos. Cada dependencia tiene el correo de destino configurado en `dependenciaNombreCorreo` de `apps-script/Code.gs`. La comparación ignora tildes y diferencias entre mayúsculas y minúsculas. Las cuentas Invitado y Administrador no son dependencias destinatarias. Ciudadano puede avisar sobre las solicitudes que él mismo radicó; no puede notificar ni consultar solicitudes de terceros.

## Publicar el Apps Script

1. En [Google Apps Script](https://script.google.com/home), abre el proyecto existente que usa la aplicación para archivos y verifica que su implementación coincida con `GOOGLE_SCRIPT_URL` en `js/config/firebase-config.js`.
2. Reemplaza el contenido de `Code.gs` por el de `apps-script/Code.gs` y guarda.
3. En **Servicios**, pulsa **Agregar un servicio** y agrega **Drive API** (versión 3). Si el proyecto de Apps Script usa un proyecto de Google Cloud estándar, habilita también Google Drive API en ese proyecto.
4. En **Implementar > Gestionar implementaciones**, edita la implementación de tipo **Aplicación web**, selecciona **Ejecutar como: yo**, conserva el acceso que usa la aplicación y publica una nueva versión.
5. Autoriza los permisos de Drive y los demás permisos que Google solicite.

La acción de correo requiere una sesión válida de Firebase. El Apps Script valida el perfil y vuelve a leer los registros con el token de Firebase antes de enviar; solo los destinatarios configurados en `dependenciaNombreCorreo` reciben esos avisos. El correo incluye un aviso destacado que cambia según la gestión (solicitud, remisión, recepción o rechazo), además de los datos del radicado; identifica claramente la dependencia destinataria y, en remisiones, recepciones y rechazos, quién remite, recibe o rechaza y cuál es la dependencia de origen. Estos avisos no adjuntan archivos.

Al cargar una respuesta se pueden seleccionar hasta 10 PDF, de máximo 30 MB cada uno. La persona funcionaria debe elegir entre **Solo evidencia** y **Enviar al ciudadano**. La evidencia queda disponible en la consulta pública, sin enviar correo. El envío solo se habilita cuando la preferencia del ciudadano es Correo; en ese caso se adjuntan todos los PDF, con un límite total de 25 MB. El Apps Script valida nuevamente el permiso, la preferencia, la opción guardada y que los archivos estén en la carpeta de Drive de la aplicación.

El escudo del correo usa `assets/images/escudo-alcaldia-sin-fondo.png`, optimizado con fondo transparente. Para que aparezca, publica ese archivo en Vercel junto con la aplicación.

## Publicar reglas de Firestore

Desde la raíz del proyecto:

```powershell
firebase deploy --only firestore:rules --project pqrsalcaldiaarjona
```

Las reglas permiten a la dependencia destinataria leer un radicado remitido a ella, necesario para validar y notificar recepciones y rechazos.
