var EMAIL_NOTIFICATIONS_VERSION = "email-notifications-14";
var PQRS_APP_URL = "https://alcaldia-municipal-de-arjona.vercel.app/";
var ESCUDO_URL = "https://alcaldia-municipal-de-arjona.vercel.app/assets/images/escudo-alcaldia-sin-fondo.png";

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    version: EMAIL_NOTIFICATIONS_VERSION,
    status: "ok"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var etapaSolicitud = "recibiendo la solicitud";
  try {
    var FOLDER_ID = "1yRe1EEuSPXrv-ssv_qmpuY6oKmSxsRDw";
    etapaSolicitud = "leyendo el contenido de la solicitud";
    var data = JSON.parse(e.postData.contents);

    if (data.action === "notification") {
      return enviarNotificacionCorreo(data);
    }

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

    function valorCampoFirestore(campo) {
      if (!campo) return null;
      if (Object.prototype.hasOwnProperty.call(campo, "stringValue")) return campo.stringValue;
      if (Object.prototype.hasOwnProperty.call(campo, "booleanValue")) return campo.booleanValue;
      if (Object.prototype.hasOwnProperty.call(campo, "integerValue")) return Number(campo.integerValue);
      if (Object.prototype.hasOwnProperty.call(campo, "doubleValue")) return Number(campo.doubleValue);
      if (Object.prototype.hasOwnProperty.call(campo, "nullValue")) return null;
      if (campo.arrayValue) {
        return (campo.arrayValue.values || []).map(valorCampoFirestore);
      }
      if (campo.mapValue) {
        return objetoFirestore(campo.mapValue.fields || {});
      }
      return null;
    }

    function objetoFirestore(campos) {
      return Object.keys(campos).reduce(function(resultado, clave) {
        resultado[clave] = valorCampoFirestore(campos[clave]);
        return resultado;
      }, {});
    }

    function obtenerTokenFirebase(data) {
      var token = String(data.idToken || "");
      var uid = String(data.uid || "");
      if (!token || !uid) throw new Error("La sesión de Firebase no es válida.");
      return { token: token, uid: uid };
    }

    function obtenerDocumentoFirestore(ruta, token) {
      var url = "https://firestore.googleapis.com/v1/projects/pqrsalcaldiaarjona/databases/(default)/documents/" + ruta;
      var respuesta = UrlFetchApp.fetch(url, {
        headers: { Authorization: "Bearer " + token },
        muteHttpExceptions: true
      });
      var codigo = respuesta.getResponseCode();
      var cuerpo = respuesta.getContentText();
      if (codigo < 200 || codigo >= 300) {
        throw new Error(codigo === 404
          ? "No se encontró el registro para notificar."
          : "Firebase no autorizó la validación del registro (" + codigo + ").");
      }
      return objetoFirestore((JSON.parse(cuerpo).fields) || {});
    }

    function dependenciaNombreCorreo(dependencia) {
      var correos = {
        "Gestion Social": "majodabel19@gmail.com",
        "Secretaría de Gobierno": "majodabel19@gmail.com",
        "Secretaría de Planeación": "majodabel19@gmail.com"
      };
      return correos[dependencia] || "";
    }

    function formatearFechaCorreo(fecha) {
      if (!fecha) return "No disponible";
      var texto = String(fecha);
      var fechaSoloDia = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (fechaSoloDia) {
        return [fechaSoloDia[3], fechaSoloDia[2], fechaSoloDia[1]].join("/");
      }
      var valor = new Date(fecha);
      if (isNaN(valor.getTime())) return String(fecha);
      var fechaBogota = new Date(valor.toLocaleString("en-US", { timeZone: "America/Bogota" }));
      return [
        String(fechaBogota.getDate()).padStart(2, "0"),
        String(fechaBogota.getMonth() + 1).padStart(2, "0"),
        fechaBogota.getFullYear()
      ].join("/") + " " + [
        String(fechaBogota.getHours()).padStart(2, "0"),
        String(fechaBogota.getMinutes()).padStart(2, "0")
      ].join(":");
    }

    function escaparHtmlCorreo(valor) {
      return String(valor || "No disponible")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function crearFilaDetalleCorreo(etiqueta, valor) {
      return '<tr>'
        + '<td style="padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;color:#243447;font-size:15px;font-weight:bold;vertical-align:top;white-space:nowrap;">'
        + escaparHtmlCorreo(etiqueta)
        + '</td>'
        + '<td style="padding:8px 10px;border:1px solid #d1d5db;color:#243447;font-size:15px;line-height:1.5;vertical-align:top;">'
        + escaparHtmlCorreo(valor)
        + '</td>'
        + '</tr>';
    }

    function crearHtmlNotificacionCorreo(tipo, registro, dependenciaDestino, mensaje, fechaEvento, dependenciaEvento) {
      var eventos = {
        "nueva-solicitud": {
          titulo: "NUEVA SOLICITUD DE VENTANILLA",
          etiqueta: "NUEVA SOLICITUD",
          color: "#166534",
          fondo: "#f0fdf4",
          borde: "#86efac"
        },
        "remision": {
          titulo: "REMISIÓN POR COMPETENCIA",
          etiqueta: "POR GESTIONAR",
          color: "#b45309",
          fondo: "#fffbeb",
          borde: "#fcd34d"
        },
        "recibida": {
          titulo: "REMISIÓN RECIBIDA",
          etiqueta: "RECIBIDA",
          color: "#166534",
          fondo: "#f0fdf4",
          borde: "#86efac"
        },
        "rechazo": {
          titulo: "REMISIÓN RECHAZADA",
          etiqueta: "RECHAZADA",
          color: "#b91c1c",
          fondo: "#fef2f2",
          borde: "#fca5a5"
        }
      };
      var evento = eventos[tipo] || {
        titulo: "ACTUALIZACIÓN DE RADICADO",
        etiqueta: "NOTIFICACIÓN",
        color: "#166534",
        fondo: "#f0fdf4",
        borde: "#86efac"
      };
      var fecha = formatearFechaCorreo(
        fechaEvento
          || registro.fechaRemisionCompetencia
          || registro.fechaHoraRadicacion
          || registro.fechaRadicacion
      );
      var filas = [
        crearFilaDetalleCorreo("Remitente:", registro.remitente),
        crearFilaDetalleCorreo("Asunto:", registro.asunto),
        crearFilaDetalleCorreo("Fecha:", fecha),
        crearFilaDetalleCorreo("Radicado:", registro.radicado || "Sin número")
      ];
      if (tipo === "rechazo") {
        filas.push(
          crearFilaDetalleCorreo("Dependencia que rechazó:", dependenciaEvento),
          crearFilaDetalleCorreo("Dependencia de origen:", dependenciaDestino)
        );
      } else if (tipo === "recibida") {
        filas.push(
          crearFilaDetalleCorreo("Dependencia que recibió:", dependenciaEvento),
          crearFilaDetalleCorreo("Dependencia de origen:", dependenciaDestino)
        );
      } else if (tipo === "remision") {
        filas.push(
          crearFilaDetalleCorreo("Dependencia que remite:", registro.dependencia || "No disponible"),
          crearFilaDetalleCorreo("Dependencia destinataria:", dependenciaDestino)
        );
      } else {
        filas.push(crearFilaDetalleCorreo("Dependencia destinataria:", dependenciaDestino));
      }
      if (tipo !== "rechazo" && tipo !== "recibida"
        && registro.dependencia && registro.dependencia !== dependenciaDestino) {
        filas.push(crearFilaDetalleCorreo("Dependencia de origen:", registro.dependencia));
      }
      var indicadorEvento = '<img src="' + escaparHtmlCorreo(ESCUDO_URL)
        + '" alt="Escudo de Arjona" width="72" style="display:block;width:72px;height:auto;border:0;">';

      return '<div style="margin:0;padding:24px 12px;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#243447;">'
        + '<div style="max-width:560px;margin:0 auto;border:1px solid #d1d5db;background:#ffffff;">'
        + '<div style="padding:16px 18px 8px;">'
        + '<div style="padding:16px;border:1px solid ' + evento.borde + ';border-radius:8px;background:' + evento.fondo + ';">'
        + '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr>'
        + '<td style="padding-right:10px;vertical-align:middle;">'
        + '<div style="color:' + evento.color + ';font-size:22px;font-weight:800;line-height:1.2;">'
        + escaparHtmlCorreo(evento.titulo)
        + '</div>'
        + '<div style="margin-top:6px;color:#243447;font-size:15px;line-height:1.4;">'
        + escaparHtmlCorreo(mensaje)
        + '</div></td>'
        + '<td style="width:1%;text-align:right;vertical-align:middle;white-space:nowrap;">'
        + indicadorEvento
        + '</td></tr></table></div>'
        + '<div style="margin-top:14px;font-size:16px;letter-spacing:.5px;color:#166534;font-weight:700;">ALCALDÍA MUNICIPAL DE ARJONA · VENTANILLA ÚNICA</div>'
        + '<p style="margin:12px 0 8px;color:#243447;font-size:17px;">Cordial saludo,</p>'
        + '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #d1d5db;border-collapse:collapse;">'
        + filas.join("")
        + '</table>'
        + '<div style="margin:18px 0 12px;text-align:center;">'
        + '<a href="' + escaparHtmlCorreo(PQRS_APP_URL) + '" style="display:inline-block;padding:10px 24px;border-radius:5px;background:#166534;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">'
        + 'Gestionar en la App'
        + '</a></div>'
        + '<p style="margin:14px 0 8px;color:#64748b;font-size:12px;line-height:1.5;">'
        + 'Ingresa al sistema PQRS para consultar el detalle y realizar las acciones correspondientes.'
        + '</p></div>'
        + '<div style="padding:8px 12px;background:#f3f4f6;text-align:center;color:#64748b;font-size:10px;line-height:1.5;">'
        + 'Este es un mensaje automático, por favor no responder a este correo.<br>'
        + 'Alcaldía de Arjona © ' + new Date().getFullYear() + '. Todos los derechos reservados.'
        + '</div></div></div>';
    }

    function enviarCorreoDependencia(tipo, registro, dependenciaDestino, eventoId, fechaEvento, dependenciaEvento) {
      var correo = dependenciaNombreCorreo(dependenciaDestino);
      if (!correo) return "unconfigured";

      var clave = ["notificacion", tipo, eventoId, dependenciaDestino].join(":");
      var bloqueo = LockService.getScriptLock();
      bloqueo.waitLock(10000);
      try {
        var propiedades = PropertiesService.getScriptProperties();
        if (propiedades.getProperty(clave)) return "already-sent";

        var radicado = String(registro.radicado || "Sin número");
        var asunto;
        var mensaje;
        if (tipo === "nueva-solicitud") {
          asunto = "Nueva solicitud de Ventanilla - " + radicado;
          mensaje = "Ventanilla cargó una nueva solicitud para " + dependenciaDestino + ".";
        } else if (tipo === "remision") {
          asunto = "Nueva remisión por competencia - " + radicado;
          mensaje = "La dependencia " + (registro.dependencia || "de origen")
            + " remitió un oficio por competencia a " + dependenciaDestino + ".";
        } else if (tipo === "recibida") {
          asunto = "Remisión por competencia recibida - " + radicado;
          mensaje = "La dependencia " + dependenciaEvento
            + " recibió la remisión por competencia enviada por " + dependenciaDestino + ".";
        } else {
          asunto = "Remisión por competencia rechazada - " + radicado;
          mensaje = "La dependencia " + dependenciaEvento
            + " rechazó la remisión por competencia enviada por " + dependenciaDestino + ".";
        }

        var detalleDependencias;
        if (tipo === "rechazo") {
          detalleDependencias = "\nDependencia que rechazó: " + dependenciaEvento
            + "\nDependencia de origen: " + dependenciaDestino;
        } else if (tipo === "recibida") {
          detalleDependencias = "\nDependencia que recibió: " + dependenciaEvento
            + "\nDependencia de origen: " + dependenciaDestino;
        } else if (tipo === "remision") {
          detalleDependencias = "\nDependencia que remite: " + (registro.dependencia || "No disponible")
            + "\nDependencia destinataria: " + dependenciaDestino;
        } else {
          detalleDependencias = "\nDependencia destinataria: " + dependenciaDestino;
        }
        MailApp.sendEmail({
          to: correo,
          subject: asunto,
          body: mensaje
            + "\n\nRadicado: " + radicado
            + detalleDependencias
            + (registro.remitente ? "\nRemitente: " + registro.remitente : "")
            + (registro.asunto ? "\nAsunto: " + registro.asunto : "")
            + "\nFecha: " + formatearFechaCorreo(fechaEvento
              || registro.fechaRemisionCompetencia
              || registro.fechaHoraRadicacion
              || registro.fechaRadicacion)
            + "\nIngresa al sistema PQRS para consultar el detalle.",
          htmlBody: crearHtmlNotificacionCorreo(
            tipo,
            registro,
            dependenciaDestino,
            mensaje,
            fechaEvento,
            dependenciaEvento
          )
        });
        propiedades.setProperty(clave, new Date().toISOString());
        return "sent";
      } finally {
        bloqueo.releaseLock();
      }
    }

    function enviarNotificacionCorreo(data) {
      var etapa = "validando la solicitud";
      try {
        var sesion = obtenerTokenFirebase(data);
        etapa = "validando el perfil en Firestore";
        var perfil = obtenerDocumentoFirestore("usuarios/" + encodeURIComponent(sesion.uid), sesion.token);
        var funcionario = perfil.rol === "funcionario";
        var administrador = perfil.rol === "administrador"
          || (funcionario && perfil.dependencia === "Control Interno");
        if (!funcionario && !administrador) {
          throw new Error("El perfil no está autorizado para notificar.");
        }

        var tipo = String(data.tipo || "");
        var registro;
        var enviados = 0;
        var duplicados = 0;
        var omitidos = [];
        if (tipo === "nueva-solicitud") {
          var ids = Array.isArray(data.ids) ? data.ids : [];
          if (!ids.length || ids.length > 20) throw new Error("La lista de solicitudes no es válida.");
          ids.forEach(function(id) {
            etapa = "consultando el radicado";
            var solicitud = obtenerDocumentoFirestore("radicados/" + encodeURIComponent(String(id)), sesion.token);
            if (solicitud.origenSolicitud !== "ventanilla"
              || (!administrador && solicitud.dependencia !== perfil.dependencia)) {
              throw new Error("No tienes permiso para notificar esta solicitud.");
            }
            etapa = "enviando el correo a " + solicitud.dependencia;
            var resultadoCorreo = enviarCorreoDependencia(
              tipo,
              solicitud,
              solicitud.dependencia,
              id,
              solicitud.fechaHoraRadicacion || solicitud.fechaRadicacion
            );
            if (resultadoCorreo === "sent") enviados++;
            else if (resultadoCorreo === "already-sent") duplicados++;
            else omitidos.push(solicitud.dependencia);
          });
        } else if (tipo === "remision" || tipo === "recibida" || tipo === "rechazo") {
          var idRegistro = String(data.id || "");
          if (!idRegistro) throw new Error("No se indicó el radicado para notificar.");
          etapa = "consultando el radicado";
          registro = obtenerDocumentoFirestore("radicados/" + encodeURIComponent(idRegistro), sesion.token);

          if (tipo === "remision") {
            if ((!administrador && registro.dependencia !== perfil.dependencia)
              || !Array.isArray(registro.dependenciasDestino)) {
              throw new Error("No tienes permiso para notificar esta remisión.");
            }
            registro.dependenciasDestino.forEach(function(destino) {
              etapa = "enviando el correo a " + destino;
              var resultadoCorreo = enviarCorreoDependencia(
                tipo,
                registro,
                destino,
                registro.fechaRemisionCompetencia || idRegistro,
                registro.fechaRemisionCompetencia
              );
              if (resultadoCorreo === "sent") enviados++;
              else if (resultadoCorreo === "already-sent") duplicados++;
              else omitidos.push(destino);
            });
          } else {
            etapa = "validando el evento de recepción o rechazo";
            var listaEventos = tipo === "recibida"
              ? registro.recepcionesCompetencia
              : registro.rechazosCompetencia;
            var dependenciaEvento = String(data.dependencia || perfil.dependencia || "");
            if (!dependenciaEvento
              || !Array.isArray(registro.dependenciasDestino)
              || registro.dependenciasDestino.indexOf(dependenciaEvento) === -1
              || (!administrador && dependenciaEvento !== perfil.dependencia)) {
              throw new Error("No tienes permiso para notificar este evento.");
            }
            var evento = (Array.isArray(listaEventos) ? listaEventos : []).find(function(item) {
              return item && item.dependencia === dependenciaEvento;
            });
            if (!evento) throw new Error("No se encontró el evento confirmado para esta dependencia.");
            var fechaEvento = tipo === "recibida" ? evento.fechaRecepcion : evento.fechaRechazo;
            etapa = "enviando el correo a " + registro.dependencia;
            var resultadoCorreo = enviarCorreoDependencia(
              tipo,
              registro,
              registro.dependencia,
              idRegistro + ":" + dependenciaEvento + ":" + fechaEvento,
              fechaEvento,
              dependenciaEvento
            );
            if (resultadoCorreo === "sent") enviados++;
            else if (resultadoCorreo === "already-sent") duplicados++;
            else omitidos.push(registro.dependencia);
          }
        } else {
          throw new Error("El tipo de notificación no está permitido.");
        }

        return ContentService.createTextOutput(JSON.stringify({
          version: EMAIL_NOTIFICATIONS_VERSION,
          status: "success",
          sent: enviados,
          alreadySent: duplicados,
          skipped: omitidos
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          version: EMAIL_NOTIFICATIONS_VERSION,
          status: "error",
          stage: etapa,
          message: error.message || String(error)
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
      version: EMAIL_NOTIFICATIONS_VERSION,
      "status": "error",
      stage: etapaSolicitud,
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}