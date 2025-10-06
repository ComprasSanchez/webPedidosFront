// utils/eanVariants.js (frontend)
/**
 * Funciones utilitarias para manejar variantes de EAN en el frontend
 */

/**
 * Genera variantes de un EAN para búsqueda alternativa
 * @param {string} ean - EAN original
 * @returns {string[]} - Array de variantes a probar
 */
export function generarVariantesEan(ean) {
    if (!ean || typeof ean !== 'string') return [];

    // Excluir casos especiales
    if (/^0+$/.test(ean)) return []; // Solo ceros
    if (ean.length < 3) return [];   // Muy corto
    if (ean === '0') return [];      // El caso específico

    const variantes = [];

    // Si empieza con 0, probar sin el 0
    if (ean.startsWith('0') && ean.length > 1) {
        variantes.push(ean.substring(1));
    }

    // Si NO empieza con 0, probar agregando 0 al inicio
    if (!ean.startsWith('0')) {
        variantes.push('0' + ean);
    }

    return variantes;
}

/**
 * Busca un EAN usando variantes alternativas si no se encuentra el original
 * @param {string} eanOriginal - EAN original a buscar
 * @param {function} buscarFuncion - Función que ejecuta la búsqueda (debe retornar objeto con encontrado: boolean)
 * @returns {Object} - { encontrado: boolean, ean: string, data: any }
 */
export async function buscarConVariantes(eanOriginal, buscarFuncion) {
    console.log(`🔍 [VARIANTES FRONT] Buscando EAN original: ${eanOriginal}`);

    // 1. Primero intentar con el EAN original
    let resultado = await buscarFuncion(eanOriginal);

    if (resultado && resultado.encontrado) {
        console.log(`✅ [VARIANTES FRONT] Encontrado con EAN original: ${eanOriginal}`);
        return {
            encontrado: true,
            ean: eanOriginal,
            data: resultado
        };
    }

    // 2. Si no se encontró, probar variantes
    const variantes = generarVariantesEan(eanOriginal);

    for (const variante of variantes) {
        console.log(`🔍 [VARIANTES FRONT] Probando variante: ${variante} (original: ${eanOriginal})`);

        resultado = await buscarFuncion(variante);

        if (resultado && resultado.encontrado) {
            console.log(`✅ [VARIANTES FRONT] Encontrado con variante: ${variante} (original: ${eanOriginal})`);
            return {
                encontrado: true,
                ean: variante,
                eanOriginal: eanOriginal,
                data: resultado
            };
        }
    }

    // 3. No se encontró nada
    console.log(`❌ [VARIANTES FRONT] No encontrado ni original ni variantes para: ${eanOriginal}`);
    return {
        encontrado: false,
        ean: eanOriginal,
        data: null
    };
}