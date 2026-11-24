import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const scriptPath = fileURLToPath(new URL('../apps-script/Code.gs', import.meta.url));
const script = readFileSync(scriptPath, 'utf8');

function ejecutarAccionGestionPdf(accion, archivosDrive, rol = 'administrador', datos = {}, captura = {}) {
  const archivosCreados = [];
  const contexto = {
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'anyone' },
      Permission: { VIEW: 'view' },
      getFolderById(id) {
        assert.equal(id, '1yRe1EEuSPXrv-ssv_qmpuY6oKmSxsRDw');
        let indice = 0;
        return {
          getFiles() {
            return {
              hasNext() {
                return indice < archivosDrive.length;
              },
              next() {
                return archivosDrive[indice++];
              }
            };
          },
          createFile(blob) {
            let descripcion = '';
            const archivo = {
              getName() {
                return blob.name;
              },
              getDescription() {
                return descripcion;
              },
              getMimeType() {
                return blob.mimeType;
              },
              getDateCreated() {
                return { getTime: () => 600 };
              },
              getUrl() {
                return 'https://drive.google.com/file/d/new-pdf/view';
              },
              setDescription(valor) {
                descripcion = valor;
              },
              setSharing() {},
              setTrashed() {}
            };
            archivosCreados.push(archivo);
            return archivo;
          }
        };
      }
    },
    Utilities: {
      base64Decode(valor) {
        return valor;
      },
      newBlob(contenido, mimeType, nombre) {
        return { contenido, mimeType, name: nombre };
      }
    },
    UrlFetchApp: {
      fetch(url, opciones) {
        assert.match(url, /\/documents\/usuarios\/test-admin$/);
        assert.equal(opciones.headers.Authorization, 'Bearer token-test');
        return {
          getResponseCode() {
            return 200;
          },
          getContentText() {
            return JSON.stringify({
              fields: { rol: { stringValue: rol } }
            });
          }
        };
      }
    },
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
    }
  };
  vm.runInNewContext(script, contexto);
  const salida = contexto.doPost({
    postData: {
      contents: JSON.stringify({
        action: accion,
        uid: 'test-admin',
        idToken: 'token-test',
        ...datos
      })
    }
  });
  captura.archivosCreados = archivosCreados;
  return JSON.parse(salida.texto);
}

function crearArchivo(nombre, mimeType, fecha, url, descripcion = '') {
  return {
    getName() {
      return nombre;
    },
    getDescription() {
      return descripcion;
    },
    getMimeType() {
      return mimeType;
    },
    getDateCreated() {
      return { getTime: () => fecha };
    },
    getUrl() {
      return url;
    }
  };
}

test('lists persistent management PDFs from the application Drive folder, newest first', () => {
  const resultado = ejecutarAccionGestionPdf('listManagementPdfs', [
    crearArchivo(
      'OficioGestion_1700000000000_1_Acta.pdf',
      'application/pdf',
      100,
      'https://drive.google.com/file/d/acta/view'
    ),
    crearArchivo(
      'OficioGestion_1700000000001_1_Respuesta.pdf',
      'application/pdf',
      200,
      'https://drive.google.com/file/d/respuesta/view'
    ),
    crearArchivo(
      'Solicitud_1700000000002_1_Entrada.pdf',
      'application/pdf',
      300,
      'https://drive.google.com/file/d/entrada/view'
    ),
    crearArchivo(
      'Respuesta de Gestión.pdf',
      'application/pdf',
      400,
      'https://drive.google.com/file/d/respuesta-gestion/view',
      'PQRS_MANAGEMENT_PDF_LIBRARY'
    ),
    crearArchivo(
      'OficioGestion_1700000000003_1_Informe.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      500,
      'https://drive.google.com/file/d/informe/view'
    )
  ]);

  assert.equal(resultado.status, 'success');
  assert.deepEqual(resultado.files, [
    { name: 'Respuesta de Gestión.pdf', url: 'https://drive.google.com/file/d/respuesta-gestion/view' },
    { name: 'Respuesta.pdf', url: 'https://drive.google.com/file/d/respuesta/view' },
    { name: 'Acta.pdf', url: 'https://drive.google.com/file/d/acta/view' }
  ]);
});

test('rejects non-administrator access to the persistent management PDF library', () => {
  const resultado = ejecutarAccionGestionPdf('listManagementPdfs', [], 'funcionario');
  assert.equal(resultado.status, 'error');
  assert.match(resultado.message, /Solo el rol Administrador/);
});

test('rejects non-administrators attempting to upload management PDFs', () => {
  const resultado = ejecutarAccionGestionPdf('uploadManagementPdf', [], 'funcionario', {
    mimeType: 'application/pdf',
    nombreArchivo: 'Acta.pdf',
    archivoBase64: 'JVBERi0='
  });
  assert.equal(resultado.status, 'error');
  assert.match(resultado.message, /Solo el rol Administrador/);
});

test('stores management PDFs under their original uploaded filename', () => {
  const captura = {};
  const resultado = ejecutarAccionGestionPdf(
    'uploadManagementPdf',
    [],
    'administrador',
    {
      mimeType: 'application/pdf',
      nombreArchivo: 'Oficio de respuesta.pdf',
      archivoBase64: 'JVBERi0='
    },
    captura
  );

  assert.equal(resultado.status, 'success');
  assert.equal(captura.archivosCreados[0].getName(), 'Oficio de respuesta.pdf');
  assert.equal(captura.archivosCreados[0].getDescription(), 'PQRS_MANAGEMENT_PDF_LIBRARY');
});
