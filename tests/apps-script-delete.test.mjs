import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const scriptPath = fileURLToPath(new URL('../apps-script/Code.gs', import.meta.url));
const script = readFileSync(scriptPath, 'utf8');

function eliminarArchivo(url) {
  const archivosEnPapelera = [];
  const idsConsultados = [];
  const contexto = {
    DriveApp: {
      getFileById(id) {
        idsConsultados.push(id);
        return {
          getMimeType() {
            return id.startsWith('1Folder')
              ? 'application/vnd.google-apps.folder'
              : 'application/pdf';
          },
          setTrashed(trashed) {
            if (trashed) archivosEnPapelera.push(id);
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
  const respuesta = JSON.parse(contexto.eliminarArchivo(url).texto);
  return { respuesta, archivosEnPapelera, idsConsultados };
}

test('trashes only the file ID from a standard Drive file URL', () => {
  const idArchivo = '1AbcdefghijklmnopqrstuvWXYZ_123';
  const resultado = eliminarArchivo(
    `https://drive.google.com/file/d/${idArchivo}/view?usp=drive_link`
  );

  assert.equal(resultado.respuesta.status, 'success');
  assert.deepEqual(resultado.archivosEnPapelera, [idArchivo]);
  assert.deepEqual(resultado.idsConsultados, [idArchivo]);
});

test('supports Drive open and download URLs with an id query parameter', () => {
  const idArchivo = '1AbcdefghijklmnopqrstuvWXYZ_123';
  const resultado = eliminarArchivo(
    `https://drive.google.com/uc?export=download&id=${idArchivo}`
  );

  assert.equal(resultado.respuesta.status, 'success');
  assert.deepEqual(resultado.archivosEnPapelera, [idArchivo]);
  assert.deepEqual(resultado.idsConsultados, [idArchivo]);
});

test('rejects folder, unrelated-host, and ambiguous URLs without looking up any ID', () => {
  const idCarpeta = '1Folderabcdefghijklmnopqrstuv_123';
  const idArchivo = '1AbcdefghijklmnopqrstuvWXYZ_123';
  const urls = [
    `https://drive.google.com/drive/folders/${idCarpeta}?id=${idArchivo}`,
    `https://example.com/file/d/${idArchivo}/view`,
    `https://drive.google.com/open?id=${idArchivo}&id=${idCarpeta}`,
    `https://drive.google.com/open?id=&id=${idArchivo}`
  ];

  for (const url of urls) {
    const resultado = eliminarArchivo(url);
    assert.equal(resultado.respuesta.status, 'error');
    assert.deepEqual(resultado.archivosEnPapelera, []);
    assert.deepEqual(resultado.idsConsultados, []);
  }
});

test('does not trash a Drive folder even when its ID appears in a file-shaped URL', () => {
  const idCarpeta = '1Folderabcdefghijklmnopqrstuv_123';
  const resultado = eliminarArchivo(`https://drive.google.com/file/d/${idCarpeta}/view`);

  assert.equal(resultado.respuesta.status, 'error');
  assert.deepEqual(resultado.archivosEnPapelera, []);
  assert.deepEqual(resultado.idsConsultados, [idCarpeta]);
});
