function doPost(e) {
  try {
    var FOLDER_ID = "1yRe1EEuSPXrv-ssv_qmpuY6oKmSxsRDw";
    var data = JSON.parse(e.postData.contents);

    // ACCIÓN 1: ELIMINAR ARCHIVO DE DRIVE
    if (data.action === "delete") {
      var pdfUrl = data.pdfUrl;
      if (!pdfUrl) {
        return ContentService.createTextOutput(JSON.stringify({
          "status": "error",
          "message": "No se proporcionó la URL del archivo"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var match = pdfUrl.match(/[-\w]{25,}/);
      if (match) {
        var fileId = match[0];
        DriveApp.getFileById(fileId).setTrashed(true);
        return ContentService.createTextOutput(JSON.stringify({
          "status": "success",
          "message": "Archivo eliminado de Drive"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          "status": "error",
          "message": "ID de archivo no válido"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ACCIÓN 2: GUARDAR NUEVO ARCHIVO EN DRIVE CON MIMETYPE DINÁMICO
    var decoded = Utilities.base64Decode(data.archivoBase64);
    
    // Recibe el mimeType desde el frontend; si no viene, usa "application/pdf" por defecto
    var mimeType = data.mimeType || "application/pdf";
    var blob = Utilities.newBlob(decoded, mimeType, data.nombreArchivo);
    
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var file = folder.createFile(blob);
    
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      Logger.log("No se pudo cambiar el permiso de compartir: " + sharingError.toString());
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "url": file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}