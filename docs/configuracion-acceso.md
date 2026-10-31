# Configuración de acceso

El inicio de sesión usa Firebase Authentication. Las contraseñas no se almacenan en el código ni en el repositorio. Antes de usar las cuentas, rota las contraseñas compartidas durante la solicitud y configura las nuevas directamente en Firebase.

## 1. Activar Firebase Authentication

En Firebase Console del proyecto `pqrsalcaldiaarjona`, abre **Authentication > Sign-in method**, habilita el proveedor **Correo electrónico/Contraseña** y guarda los cambios. Si este proveedor está desactivado, Firebase rechaza todos los intentos aunque la contraseña sea correcta.

Después, crea una cuenta por cada usuario usando el correo sintético `usuario@usuarios.pqrsalcaldiaarjona.invalid`, donde `usuario` es el nombre de usuario de inicio de sesión. El administrador usa `admin@usuarios.pqrsalcaldiaarjona.invalid`.

Configura cada contraseña en Firebase Console. No la agregues a este repositorio.

## 2. Crear perfiles

En Firestore, crea `usuarios/{uid}` usando el UID de cada cuenta de Authentication. El administrador debe crear estos perfiles manualmente desde Firebase Console; el cliente no puede otorgar ni cambiar roles.

Perfil administrador:

```json
{
  "rol": "administrador",
  "nombre": "Administrador"
}
```

Perfil de funcionario:

```json
{
  "rol": "funcionario",
  "nombre": "Nombre de la dependencia",
  "dependencia": "Nombre exacto de la dependencia en la colección radicados"
}
```

El nombre de usuario determina la dependencia esperada en el cliente. Usa las claves exactas:

| Usuario | Dependencia |
|---|---|
| gobierno | Secretaría de Gobierno |
| planeacion | Secretaría de Planeación |
| gestionriesgo | Oficina de Gestion del Riesgo y Desastres |
| desarrollosocial | Oficina de Desarrollo Social |
| salud | Secretaría de Salud |
| controlinterno | Control Interno |
| juridica | Oficina Juridica |
| despachoalcalde | Despacho del Alcalde |
| umata | Secretaría de Umata |
| educacion | Secretaría de Educación |
| hacienda | Secretaría de Hacienda |
| sisben | Sisben |
| talentohumano | Talento Humano |
| transito | Secretaría de Transito y Transporte |
| gestionsocial | Gestion Social |

## 3. Aplicar reglas de Firestore

El proyecto `pqrsalcaldiaarjona` ya está seleccionado en `.firebaserc`. Tras iniciar sesión en Firebase CLI con una cuenta autorizada, desde la raíz del repositorio ejecuta:

```sh
firebase deploy --only firestore:rules
```

También puedes desplegarlas desde Firebase Console. Sin estas reglas desplegadas, ocultar elementos de la interfaz no protege los datos.

El administrador puede consultar y gestionar las colecciones. Los funcionarios ven todas las tarjetas de dependencias, pero solo pueden abrir la propia; las demás muestran “Acceso restringido”. Las tarjetas IAS aparecen sin permitir entrar a los radicados. En sus PQRS pueden registrar, asignar y actualizar el seguimiento, pero no editar los datos generales ni eliminar radicados. También pueden usar informes y planillas. La generación de radicados de salida es general: pueden consultar y gestionar radicados de todas las dependencias y seleccionar cualquier dependencia. Allí pueden editar y anular registros; la eliminación permanente sigue reservada al administrador para conservar el historial. IAS y su gestión quedan restringidas al administrador.
