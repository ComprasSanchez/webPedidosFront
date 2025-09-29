// services/productosInvalidosService.js
// Servicio puro para detección y manejo de productos inválidos

/**
 * Servicio para detectar y manejar productos inválidos
 */
export class ProductosInvalidosService {
    /**
     * Detecta productos con EAN inválido (ej: '0', '000000000000', vacío)
     * @param {Array} productos - Array de productos a validar
     * @returns {Object} { productosValidos, productosInvalidos }
     */
    static detectarProductosInvalidos(productos) {
        if (!Array.isArray(productos)) {
            return { productosValidos: [], productosInvalidos: [] };
        }

        const productosValidos = [];
        const productosInvalidos = [];

        productos.forEach(producto => {
            const ean = String(producto.ean || '').trim();

            // Criterios para considerar un EAN inválido:
            // 1. EAN es '0' o solo ceros (rompe el sistema)
            // 2. EAN está vacío o es null/undefined
            // 3. EAN tiene menos de 3 caracteres (muy corto)
            // NOTA: Se permiten códigos alfanuméricos para códigos internos
            if (this.esEanInvalido(ean)) {
                productosInvalidos.push({
                    ...producto,
                    razonInvalido: this.obtenerRazonInvalido(ean),
                    eanOriginal: ean
                });
            } else {
                productosValidos.push(producto);
            }
        });

        return {
            productosValidos,
            productosInvalidos,
            estadisticas: {
                totalOriginal: productos.length,
                totalValidos: productosValidos.length,
                totalInvalidos: productosInvalidos.length,
                porcentajeInvalidos: productos.length > 0
                    ? ((productosInvalidos.length / productos.length) * 100).toFixed(1)
                    : 0
            }
        };
    }

    /**
     * Determina si un EAN es inválido
     * @param {string} ean - EAN a validar
     * @returns {boolean} true si es inválido
     */
    static esEanInvalido(ean) {
        // EAN vacío o null
        if (!ean || ean.length === 0) return true;

        // EAN solo con ceros (problemático para el sistema)
        if (/^0+$/.test(ean)) return true;

        // EAN muy corto (menos de 3 caracteres es sospechoso)
        if (ean.length < 3) return true;

        return false;
    }

    /**
     * Obtiene la razón por la cual un EAN es considerado inválido
     * @param {string} ean - EAN inválido
     * @returns {string} Descripción de la razón
     */
    static obtenerRazonInvalido(ean) {
        if (!ean || ean.length === 0) {
            return 'EAN vacío';
        }

        if (/^0+$/.test(ean)) {
            return 'EAN solo ceros';
        }

        if (ean.length < 3) {
            return `EAN muy corto (${ean.length} caracteres)`;
        }

        return 'EAN inválido';
    }    /**
     * Extrae el nombre del producto desde una línea del TXT
     * @param {string} lineaTxt - Línea completa del archivo TXT
     * @returns {string} Nombre del producto extraído
     */
    static extraerNombreProducto(lineaTxt) {
        if (!lineaTxt || typeof lineaTxt !== 'string') {
            return 'Producto sin nombre';
        }

        // Formato de línea TXT: EAN(13) + DESCRIPCION + CANTIDAD_AL_FINAL
        // Ejemplo: "7798348390135 TAFIROL 1GR COMP X 20                   2"

        const linea = lineaTxt.trim();

        // EAN son los primeros 13 caracteres
        const eanParte = linea.substring(0, 13).trim();

        // El resto es descripción + cantidad
        const resto = linea.substring(13).trim();

        // Remover la cantidad del final (último número)
        const nombreMatch = resto.replace(/\s+\d+\s*$/, '').trim();

        return nombreMatch || 'Producto sin descripción';
    }

    /**
     * Agrupa productos inválidos por razón
     * @param {Array} productosInvalidos - Array de productos inválidos
     * @returns {Object} Productos agrupados por razón de invalidez
     */
    static agruparPorRazon(productosInvalidos) {
        const grupos = {};

        productosInvalidos.forEach(producto => {
            const razon = producto.razonInvalido;
            if (!grupos[razon]) {
                grupos[razon] = [];
            }
            grupos[razon].push(producto);
        });

        return grupos;
    }

    /**
     * Genera un reporte resumido de productos inválidos
     * @param {Array} productosInvalidos - Array de productos inválidos
     * @returns {Object} Reporte con estadísticas detalladas
     */
    static generarReporte(productosInvalidos) {
        const grupos = this.agruparPorRazon(productosInvalidos);
        const unidadesTotales = productosInvalidos.reduce((sum, p) => sum + (p.unidades || 0), 0);

        return {
            total: productosInvalidos.length,
            unidadesTotales,
            grupos: Object.entries(grupos).map(([razon, productos]) => ({
                razon,
                cantidad: productos.length,
                unidades: productos.reduce((sum, p) => sum + (p.unidades || 0), 0),
                productos: productos.map(p => ({
                    ean: p.eanOriginal,
                    nombre: p.nombre || this.extraerNombreProducto(p.lineaOriginal) || 'Sin nombre',
                    unidades: p.unidades || 0
                }))
            }))
        };
    }
}

export default ProductosInvalidosService;