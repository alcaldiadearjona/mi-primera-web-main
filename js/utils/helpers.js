// CÁLCULO DINÁMICO DE FESTIVOS EN COLOMBIA (Ley Emiliani)
export function calcularPascua(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function siguienteLunes(fecha) {
  const res = new Date(fecha);
  const diaSemana = res.getDay();
  if (diaSemana !== 1) {
    const diasHastaLunes = (8 - diaSemana) % 7;
    res.setDate(res.getDate() + diasHastaLunes);
  }
  return res;
}

export function formatearIso(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function obtenerFestivosColombia(year) {
  const festivos = [];
  festivos.push(`${year}-01-01`); 
  festivos.push(`${year}-05-01`); 
  festivos.push(`${year}-07-20`); 
  festivos.push(`${year}-08-07`); 
  festivos.push(`${year}-12-08`); 
  festivos.push(`${year}-12-25`); 

  festivos.push(formatearIso(siguienteLunes(new Date(year, 0, 6))));   
  festivos.push(formatearIso(siguienteLunes(new Date(year, 2, 19))));  
  festivos.push(formatearIso(siguienteLunes(new Date(year, 5, 29))));  
  festivos.push(formatearIso(siguienteLunes(new Date(year, 7, 15))));  
  festivos.push(formatearIso(siguienteLunes(new Date(year, 9, 12))));  
  festivos.push(formatearIso(siguienteLunes(new Date(year, 10, 1))));  
  festivos.push(formatearIso(siguienteLunes(new Date(year, 10, 11)))); 

  const pascua = calcularPascua(year);
  
  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(pascua.getDate() - 3);
  festivos.push(formatearIso(juevesSanto));

  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(pascua.getDate() - 2);
  festivos.push(formatearIso(viernesSanto));

  const ascension = new Date(pascua);
  ascension.setDate(pascua.getDate() + 43);
  festivos.push(formatearIso(siguienteLunes(ascension)));

  const corpusChristi = new Date(pascua);
  corpusChristi.setDate(pascua.getDate() + 64);
  festivos.push(formatearIso(siguienteLunes(corpusChristi)));

  const sagradoCorazon = new Date(pascua);
  sagradoCorazon.setDate(pascua.getDate() + 71);
  festivos.push(formatearIso(siguienteLunes(sagradoCorazon)));

  return festivos;
}

export function sumarDiasHabilesColombia(fechaInicioStr, diasHabiles) {
  if (!fechaInicioStr) return "";
  let [anio, mes, dia] = fechaInicioStr.split('-').map(Number);
  let fecha = new Date(anio, mes - 1, dia);
  let diasAgregados = 0;

  while (diasAgregados < parseInt(diasHabiles)) {
    fecha.setDate(fecha.getDate() + 1);
    let anioActual = fecha.getFullYear();
    let festivosAnio = obtenerFestivosColombia(anioActual);

    let fechaIsoStr = formatearIso(fecha);
    let diaSemana = fecha.getDay();

    let esFinDeSemana = (diaSemana === 0 || diaSemana === 6);
    let esFestivo = festivosAnio.includes(fechaIsoStr);

    if (!esFinDeSemana && !esFestivo) {
      diasAgregados++;
    }
  }

  return formatearIso(fecha);
}

// EVALUACIÓN DE ESTADO AUTOMÁTICO (Filtro estricto para CERRADO)
export function evaluarEstadoAutomatico(fechaVencimientoStr, respuestaUrl = null, otrosEstados = null, estadoBase = null) {
  // 1. Convertir 'otrosEstados' a texto limpio para comparar de forma segura
  const otroEstadoTexto = otrosEstados 
    ? otrosEstados.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() 
    : "";

  // 2. Comprobar si realmente hay una URL válida de respuesta (debe ser un enlace web real)
  const tieneRespuestaValida = Boolean(
    respuestaUrl && 
    typeof respuestaUrl === 'string' && 
    respuestaUrl.trim().startsWith('http')
  );

  const esParaConocimiento = otroEstadoTexto.includes("para conocimiento");
  const noRequiereRespuesta = otroEstadoTexto.includes("no requiere respuesta");

  // 3. SOLO pasa a CERRADO si tiene una URL real o si se eligió una de las dos opciones explícitas
  if (tieneRespuestaValida || esParaConocimiento || noRequiereRespuesta) {
    return { texto: "CERRADO", clase: "status-cerrado" };
  }

  const estadoNormalizado = estadoBase
    ? estadoBase.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    : "";
  if (estadoNormalizado === "en tramite") {
    return { texto: "EN TRÁMITE", clase: "status-tramite" };
  }

  // 4. Si NO cumple ninguna de las 3, evalúa la fecha de vencimiento normalmente:
  if (!fechaVencimientoStr) return { texto: "VIGENTE", clase: "status-vigente" };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let [anio, mes, dia] = fechaVencimientoStr.split('-').map(Number);
  const fechaVenc = new Date(anio, mes - 1, dia);
  fechaVenc.setHours(0, 0, 0, 0);

  const diferenciaDias = Math.round((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

  if (diferenciaDias < 0) {
    return { texto: "EXTEMPORÁNEA", clase: "status-extemporanea" };
  } else if (diferenciaDias >= 0 && diferenciaDias <= 2) {
    return { texto: "PRÓXIMO A VENCER", clase: "status-proximo" };
  } else {
    return { texto: "VIGENTE", clase: "status-vigente" };
  }
}

export function convertirABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}