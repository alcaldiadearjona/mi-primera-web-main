import { datosRadicados } from '../data/radicados.js';

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function obtenerRadicadosPorDependencia(nombreDependencia) {
    if (typeof datosRadicados === 'undefined' || !datosRadicados) return [];

    const nomBuscado = normalizarTexto(nombreDependencia);
    const claveEncontrada = Object.keys(datosRadicados).find(
        key => normalizarTexto(key) === nomBuscado
    );

    return claveEncontrada ? datosRadicados[claveEncontrada] : [];
}
