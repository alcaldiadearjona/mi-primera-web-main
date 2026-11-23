import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const scriptPath = fileURLToPath(new URL('../apps-script/Code.gs', import.meta.url));
const script = readFileSync(scriptPath, 'utf8');
const fileId = '1AbcdefghijklmnopqrstuvWXYZ_123';
const folderId = '1yRe1EEuSPXrv-ssv_qmpuY6oKmSxsRDw';

function campoFirestore(valor) {
  if (typeof valor === 'string') return { stringValue: valor };
  if (typeof valor === 'boolean') return { booleanValue: valor };
  if (Array.isArray(valor)) {
    return { arrayValue: { values: valor.map(campoFirestore) } };
  }
  if (valor && typeof valor === 'object') {
    return { mapValue: { fields: camposFirestore(valor) } };
  }
  return { nullValue: null };
}

function camposFirestore(valores) {
  return Object.fromEntries(Object.entries(valores).map(([clave, valor]) => [
    clave,
    campoFirestore(valor)
  ]));
}

function crearEntorno({
  dependenciaPerfil = 'Secretaría de Gobierno',
  tipoNotificacion = 'Correo',
  mimeTypeArchivo = 'application/pdf',
  firmaPdf = '%PDF-1.7',
  carpetaArchivo = folderId,
  archivosRespuesta = [fileId],
  soloEvidencia = false,
  enviarAlCiudadano = true,
  tamanoArchivo = 7
} = {}) {
  const correosEnviados = [];
  const propiedades = new Map();
  const fileIdsPermitidos = archivosRespuesta.length ? archivosRespuesta : [fileId];
  const perfil = {
    rol: 'funcionario',
    dependencia: dependenciaPerfil
  };
  const radicado = {
    dependencia: 'Secretaría de Gobierno',
    notificacionRespuestaTipo: tipoNotificacion,
    notificacionRespuestaContacto: 'ciudadano@example.com',
    respuestaUrl: `https://drive.google.com/file/d/${archivosRespuesta[0] || fileId}/view`,
    respuestaArchivos: archivosRespuesta.map(id => `https://drive.google.com/file/d/${id}/view`),
    respuestaSoloEvidencia: soloEvidencia,
    respuestaEnviarAlCiudadano: enviarAlCiudadano,
    radicado: 'PQRS-2026-001'
  };
  const contexto = {
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(texto) {
        return {
          texto,
          setMimeType() {
            return this;
          }
        };
      }
    },
    UrlFetchApp: {
      fetch(url) {
        const esPerfil = url.includes('/documents/usuarios/usuario-1');
        const datos = esPerfil ? perfil : radicado;
        return {
          getResponseCode() {
            return 200;
          },
          getContentText() {
            return JSON.stringify({ fields: camposFirestore(datos) });
          }
        };
      }
    },
    DriveApp: {
      getFileById(id) {
        assert.ok(fileIdsPermitidos.includes(id));
        return {
          isTrashed() {
            return false;
          },
          getMimeType() {
            return mimeTypeArchivo;
          },
          getParents() {
            let pendiente = true;
            return {
              hasNext() {
                return pendiente;
              },
              next() {
                pendiente = false;
                return { getId: () => carpetaArchivo };
              }
            };
          },
          getBlob() {
            return {
              name: '',
              getBytes() {
                return {
                  length: tamanoArchivo,
                  slice(inicio, fin) {
                    return Array.from(firmaPdf.slice(inicio, fin))
                      .map(character => character.charCodeAt(0));
                  }
                };
              },
              setName(nombre) {
                this.name = nombre;
              }
            };
          }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {},
          releaseLock() {}
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty: clave => propiedades.get(clave) || null,
          setProperty(clave, valor) {
            propiedades.set(clave, valor);
          }
        };
      }
    },
    MailApp: {
      sendEmail(opciones) {
        correosEnviados.push(opciones);
      }
    }
  };
  vm.runInNewContext(script, contexto);

  return {
    correosEnviados,
    enviarRespuesta(overrides = {}) {
      const resultado = contexto.doPost({
        postData: {
          contents: JSON.stringify({
            action: 'notification',
            tipo: 'respuesta',
            uid: 'usuario-1',
            idToken: 'token-valido',
            id: 'radicado-1',
            coleccion: 'radicados',
            ...overrides
          })
        }
      });
      return JSON.parse(resultado.texto);
    }
  };
}

test('sends the stored response PDF to the registered citizen email only once', () => {
  const entorno = crearEntorno();

  const primerEnvio = entorno.enviarRespuesta();
  const segundoEnvio = entorno.enviarRespuesta();

  assert.equal(primerEnvio.status, 'success');
  assert.equal(primerEnvio.sent, 1);
  assert.equal(segundoEnvio.alreadySent, 1);
  assert.equal(entorno.correosEnviados.length, 1);
  assert.equal(entorno.correosEnviados[0].to, 'ciudadano@example.com');
  assert.equal(entorno.correosEnviados[0].attachments[0].name, 'Respuesta_PQRS-2026-001_1.pdf');
});

test('attaches all ten response PDFs in one email', () => {
  const archivosRespuesta = Array.from({ length: 10 }, (_, indice) => (
    `1AbcdefghijklmnopqrstuvWXYZ_12${String(indice).padStart(1, '0')}`
  ));
  const entorno = crearEntorno({ archivosRespuesta });

  const resultado = entorno.enviarRespuesta();

  assert.equal(resultado.sent, 1);
  assert.equal(entorno.correosEnviados[0].attachments.length, 10);
  assert.equal(entorno.correosEnviados[0].attachments[9].name, 'Respuesta_PQRS-2026-001_10.pdf');
});

test('does not send a response marked only as evidence', () => {
  const entorno = crearEntorno({ soloEvidencia: true, enviarAlCiudadano: false });

  const resultado = entorno.enviarRespuesta();

  assert.equal(resultado.status, 'error');
  assert.match(resultado.message, /marcada como evidencia/);
  assert.equal(entorno.correosEnviados.length, 0);
});

test('rejects more than ten response files and duplicate files', () => {
  const demasiadosArchivos = crearEntorno({
    archivosRespuesta: Array.from({ length: 11 }, (_, indice) => `1archivo${indice}`)
  });
  const repetidos = crearEntorno({ archivosRespuesta: [fileId, fileId] });

  const resultadoDemasiados = demasiadosArchivos.enviarRespuesta();
  const resultadoRepetidos = repetidos.enviarRespuesta();

  assert.equal(resultadoDemasiados.status, 'error');
  assert.match(resultadoDemasiados.message, /entre 1 y 10/);
  assert.equal(resultadoRepetidos.status, 'error');
  assert.match(resultadoRepetidos.message, /duplicada/);
  assert.equal(demasiadosArchivos.correosEnviados.length, 0);
  assert.equal(repetidos.correosEnviados.length, 0);
});

test('supports the legacy single-response field and enforces the total attachment size', () => {
  const respuestaAntigua = crearEntorno({ archivosRespuesta: [] });
  const respuestaGrande = crearEntorno({
    archivosRespuesta: [
      '1AbcdefghijklmnopqrstuvWXYZ_11',
      '1AbcdefghijklmnopqrstuvWXYZ_12',
      '1AbcdefghijklmnopqrstuvWXYZ_13'
    ],
    tamanoArchivo: 9 * 1024 * 1024
  });

  const resultadoAntiguo = respuestaAntigua.enviarRespuesta();
  const resultadoGrande = respuestaGrande.enviarRespuesta();

  assert.equal(resultadoAntiguo.status, 'success');
  assert.equal(respuestaAntigua.correosEnviados[0].attachments.length, 1);
  assert.equal(resultadoGrande.status, 'error');
  assert.match(resultadoGrande.message, /25 MB/);
  assert.equal(respuestaGrande.correosEnviados.length, 0);
});

test('does not send a response belonging to another dependency', () => {
  const entorno = crearEntorno({ dependenciaPerfil: 'Secretaría de Salud' });

  const resultado = entorno.enviarRespuesta();

  assert.equal(resultado.status, 'error');
  assert.match(resultado.message, /No tienes permiso/);
  assert.equal(entorno.correosEnviados.length, 0);
});

test('does not send email when the citizen did not select email notifications', () => {
  const entorno = crearEntorno({ tipoNotificacion: 'Presencial' });

  const resultado = entorno.enviarRespuesta();

  assert.equal(resultado.status, 'error');
  assert.match(resultado.message, /no seleccionó el correo/);
  assert.equal(entorno.correosEnviados.length, 0);
});

test('rejects a response file unless it is a PDF in the application folder', () => {
  for (const opciones of [
    { mimeTypeArchivo: 'application/octet-stream' },
    { firmaPdf: 'plain text' },
    { carpetaArchivo: 'another-folder-id' }
  ]) {
    const entorno = crearEntorno(opciones);
    const resultado = entorno.enviarRespuesta();

    assert.equal(resultado.status, 'error');
    assert.equal(entorno.correosEnviados.length, 0);
  }
});
