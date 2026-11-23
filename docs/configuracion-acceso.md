# Configuración de acceso

El inicio de sesión usa Firebase Authentication. Las contraseñas no se almacenan en el código ni en el repositorio. Antes de usar las cuentas, rota las contraseñas compartidas durante la solicitud y configura las nuevas directamente en Firebase.

## 1. Activar Firebase Authentication

En Firebase Console del proyecto `pqrsalcaldiaarjona`, abre **Authentication > Sign-in method**, habilita los proveedores **Correo electrónico/Contraseña** y **Anónimo**, y guarda los cambios. El proveedor anónimo permite entrar como Invitado sin usuario ni contraseña.

Cada usuario inicia sesión con la clave indicada en la tabla de abajo; la aplicación la asocia con su correo de Firebase. El administrador principal usa el usuario `admin`. Si hay cuentas antiguas con correos `@usuarios.pqrsalcaldiaarjona.invalid`, actualiza esos correos en **Authentication > Users** conservando sus UID. Las cuentas `bridis` y `licth` indicadas abajo son una excepción: usan ese dominio solo como identificador y requieren restablecer las contraseñas desde Firebase Console.

Configura o restablece cada contraseña desde Firebase Console. No la agregues a este repositorio.

## 2. Crear perfiles

En Firestore, crea `usuarios/{uid}` usando el UID de cada cuenta de Authentication. El administrador debe crear estos perfiles manualmente desde Firebase Console; el cliente no puede otorgar ni cambiar roles.

Perfil administrador:

```json
{
  "rol": "administrador",
  "nombre": "Administrador"
}
```

Para que Bridis Esalas y Licth Montero gestionen PQRS en paralelo, crea estas cuentas individuales en **Authentication > Users**:

| Usuario de inicio | Correo de Firebase |
|---|---|
| `bridis` | `bridis@usuarios.pqrsalcaldiaarjona.invalid` |
| `licth` | `licth@usuarios.pqrsalcaldiaarjona.invalid` |

Para cada cuenta, crea también `usuarios/{uid}` con `"rol": "administrador"` y el nombre correspondiente. Iniciarán sesión eligiendo **Administrador** e ingresando `bridis` o `licth` en el campo **Usuario**. No compartas la misma cuenta: las reservas de pendientes se asignan al UID de cada cuenta. Como el dominio `.invalid` no recibe mensajes, restablece estas contraseñas desde **Authentication > Users** en Firebase Console, no desde el enlace de recuperación.

Perfil de funcionario:

```json
{
  "rol": "funcionario",
  "nombre": "Nombre de la dependencia",
  "dependencia": "Nombre exacto de la dependencia en la colección radicados"
}
```

Al elegir el rol Invitado o Ciudadano y pulsar Ingresar, la aplicación inicia una sesión anónima y crea automáticamente un perfil limitado en `usuarios`. Invitado solo puede acceder a **Generación de Radicados** y sus funciones. Ciudadano solo puede radicar solicitudes desde **Atención al Ciudadano**; no puede consultar los registros internos ni usar las funciones de Invitado. Como estos roles no requieren credenciales, cualquier persona que abra la aplicación puede ingresar con ellos.

El nombre de usuario determina la dependencia y el correo de inicio de sesión. Usa las claves exactas:

| Usuario | Dependencia | Correo de Firebase |
|---|---|---|
| gobierno | Secretaría de Gobierno | gobierno@arjona-bolivar.gov.co |
| planeacion | Secretaría de Planeación | planeacion@arjona-bolivar.gov.co |
| gestionriesgo | Oficina de Gestion del Riesgo y Desastres | riesgos@arjona-bolivar.gov.co |
| desarrollosocial | Oficina de Desarrollo Social | desarrollosocial@arjona-bolivar.gov.co |
| salud | Secretaría de Salud | salud@arjona-bolivar.gov.co |
| controlinterno | Control Interno | controlinterno@arjona-bolivar.gov.co |
| juridica | Oficina Juridica | juridica@arjona-bolivar.gov.co |
| despachoalcalde | Despacho del Alcalde | alcaldia@arjona-bolivar.gov.co |
| umata | Secretaría de Umata | umata@arjona-bolivar.gov.co |
| educacion | Secretaría de Educación | educacion@arjona-bolivar.gov.co |
| hacienda | Secretaría de Hacienda | hacienda@arjona-bolivar.gov.co |
| sisben | Sisben | sisben@arjona-bolivar.gov.co |
| talentohumano | Talento Humano | talentohumano@arjona-bolivar.gov.co |
| transito | Secretaría de Transito y Transporte | direcciondetransito@arjona-bolivar.gov.co |
| gestionsocial | Gestion Social | gestionsocialalcaldiaarjona@gmail.com |
| admin | Administrador | majodabel19@gmail.com |

El correo `alcaldia@arjona-bolivar.gov.co` queda reservado para Despacho; Administrador usa `majodabel19@gmail.com`, pues Firebase requiere correos únicos por cuenta.

Para ajustar el mensaje de recuperación, abre **Authentication > Templates > Password reset** en Firebase Console y personaliza el asunto y el texto en español. Firebase envía el enlace seguro de restablecimiento; no se envía la contraseña actual. El correo usa la plantilla de Firebase, independiente del diseño HTML de las notificaciones.

## 3. Aplicar reglas de Firestore

El proyecto `pqrsalcaldiaarjona` ya está seleccionado en `.firebaserc`. Tras iniciar sesión en Firebase CLI con una cuenta autorizada, desde la raíz del repositorio ejecuta:

```sh
firebase deploy --only firestore:rules
```

También puedes desplegarlas desde Firebase Console. Sin estas reglas desplegadas, ocultar elementos de la interfaz no protege los datos.
La asignación automática de consecutivos al rol Ciudadano requiere publicar estas reglas y la nueva versión de la aplicación.

El administrador y Control Interno pueden consultar y gestionar todas las colecciones, administrar usuarios y eliminar radicados. En **PQRS**, estos roles reciben solicitudes con un consecutivo anual `R-AAAA-00001`; luego, en **Gestionar PQRSF**, completan los datos, asignan dependencias y fechas y adjuntan el oficio antes de guardar. La recepción queda guardada como pendiente hasta completar su gestión. **Ciudadano comparte esa misma secuencia anual** al radicar: la solicitud queda pendiente en **Gestionar PQRSF** para que se completen los datos de trámite y se asigne la dependencia. El archivo original del ciudadano se conserva en Google Drive; Firestore guarda su enlace y no una copia del archivo. Los radicados de salida usan el prefijo `E` y mantienen una secuencia independiente. Los funcionarios ven todas las tarjetas de dependencias, pero solo pueden abrir la propia; las demás muestran “Acceso restringido”. En sus PQRS pueden registrar, asignar y actualizar el seguimiento, pero no editar los datos generales ni eliminar radicados. También pueden usar informes y planillas. La generación de radicados de salida es general: pueden consultar y gestionar radicados de todas las dependencias y seleccionar cualquier dependencia. Allí pueden editar y anular registros; la eliminación permanente sigue reservada al administrador y a Control Interno. Invitado solo puede consultar, generar y gestionar registros de salida y sus consecutivos; el resto de las colecciones y pantallas no están disponibles para este rol. Jurídica tiene acceso completo de consulta y gestión a IAS, incluida la creación, edición, asignación, seguimiento y gestión de respuestas, pero no puede eliminar registros IAS. IAS y su gestión quedan restringidas a los demás funcionarios.
