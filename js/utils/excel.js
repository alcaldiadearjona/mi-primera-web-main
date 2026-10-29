export function asegurarBordesCeldaExcel(celda) {
  const bordeActual = celda.border || {};
  const asegurarLado = lado => lado?.style
    ? lado
    : {
        ...lado,
        style: 'thin',
        color: lado?.color || { argb: 'FF000000' }
      };

  celda.border = {
    ...bordeActual,
    left: asegurarLado(bordeActual.left),
    right: asegurarLado(bordeActual.right),
    top: asegurarLado(bordeActual.top),
    bottom: asegurarLado(bordeActual.bottom)
  };
}
