// services/zipProcessor.js
// Servicio puro para procesamiento de datos ZIP

import DuplicadosService from './duplicadosService.js';
import SessionStorageService from './sessionStorageService.js';
import ProductosInvalidosService from './productosInvalidosService.js';

/**
 * Servicio para procesamiento de datos de ZIP
 */
export class ZipProcessor {
    /**
     * Procesa datos de ZIP consolidando con carrito existente
     * @param {Object} zipData - Datos del ZIP del backend
     * @param {Object} carritosBulkExistente - Carritos bulk existentes
     * @returns {Object} Carritos consolidados
     */
    static procesarZipData(zipData, carritosBulkExistente = {}) {
        if (!zipData?.resumen) {
            throw new Error('Datos de ZIP inválidos');
        }

        // Empezar con carritos existentes
        const carritoConsolidado = { ...carritosBulkExistente };

        // Determinar si limpiar metadatos viejos
        const hayProductosExistentes = Object.keys(carritosBulkExistente).length > 0;
        let metadatosSucursales;

        if (hayProductosExistentes) {
            // Hay productos, mantener metadatos existentes
            metadatosSucursales = SessionStorageService.getMetadatosBulk();
        } else {
            // No hay productos (página recargada), limpiar metadatos viejos
            metadatosSucursales = {};
            SessionStorageService.clearMetadatosBulk();
        }

        // Procesar cada archivo del ZIP
        zipData.resumen.forEach(item => {
            const sucursal = item.sucursal;

            // Inicializar array si no existe la sucursal o no es un array
            if (!carritoConsolidado[sucursal] || !Array.isArray(carritoConsolidado[sucursal])) {
                carritoConsolidado[sucursal] = [];
            }

            // Inicializar metadatos de sucursal
            if (!metadatosSucursales[sucursal]) {
                metadatosSucursales[sucursal] = {
                    duplicados: 0,
                    archivos: [],
                    detallesDuplicados: [],
                    productosInvalidos: 0,
                    detallesInvalidos: []
                };
            }

            // Procesar duplicados del item
            if (item.duplicados?.cantidad > 0) {
                metadatosSucursales[sucursal].duplicados += item.duplicados.cantidad;

                if (item.duplicados.detalles && item.duplicados.detalles.length > 0) {
                    if (!Array.isArray(metadatosSucursales[sucursal].detallesDuplicados)) {
                        metadatosSucursales[sucursal].detallesDuplicados = [];
                    }
                    metadatosSucursales[sucursal].detallesDuplicados.push(...item.duplicados.detalles);
                }
            }

            // Procesar productos inválidos del item
            if (item.productos_invalidos?.cantidad > 0) {
                metadatosSucursales[sucursal].productosInvalidos += item.productos_invalidos.cantidad;

                if (item.productos_invalidos.detalles && item.productos_invalidos.detalles.length > 0) {
                    if (!Array.isArray(metadatosSucursales[sucursal].detallesInvalidos)) {
                        metadatosSucursales[sucursal].detallesInvalidos = [];
                    }
                    metadatosSucursales[sucursal].detallesInvalidos.push(...item.productos_invalidos.detalles);
                }
            }

            // Actualizar lista de archivos
            if (!metadatosSucursales[sucursal].archivos.includes(item.archivo)) {
                metadatosSucursales[sucursal].archivos.push(item.archivo);
            }

            // Consolidar productos de esta sucursal
            if (item.productos_detalle) {
                const productosConArchivo = item.productos_detalle.map(producto => ({
                    ...producto,
                    sucursal: sucursal,
                    archivo_origen: item.archivo,
                    archivos_origen: [item.archivo],
                    // Extraer nombre del producto si viene en el TXT
                    nombre: producto.nombre || ProductosInvalidosService.extraerNombreProducto(producto.lineaOriginal) || producto.descripcion || `Producto ${producto.ean}`
                }));

                // PASO 1: Detectar y filtrar productos inválidos
                const validacionInvalidos = ProductosInvalidosService.detectarProductosInvalidos(productosConArchivo);

                // Guardar información de productos inválidos eliminados
                if (validacionInvalidos.productosInvalidos.length > 0) {
                    metadatosSucursales[sucursal].productosInvalidos += validacionInvalidos.productosInvalidos.length;
                    metadatosSucursales[sucursal].detallesInvalidos.push(...validacionInvalidos.productosInvalidos);
                }

                // PASO 2: Usar servicio de duplicados para consolidar solo productos válidos
                const resultado = DuplicadosService.consolidarConCarritoExistente(
                    carritoConsolidado[sucursal],
                    validacionInvalidos.productosValidos
                );

                carritoConsolidado[sucursal] = resultado.carritoConsolidado;

                // Agregar duplicados a metadatos si los hay
                if (resultado.duplicadosDetalle.length > 0) {
                    metadatosSucursales[sucursal].detallesDuplicados.push(...resultado.duplicadosDetalle);
                    metadatosSucursales[sucursal].duplicados += resultado.duplicadosDetalle.length;
                }
            }
        });

        // Guardar metadatos actualizados
        SessionStorageService.setMetadatosBulk(metadatosSucursales);

        return carritoConsolidado;
    }

    /**
     * Calcula totales de productos bulk
     * @param {Object} carritosBulk - Carritos bulk por sucursal
     * @returns {Object} { totalProductos, totalUnidades, totalSucursales }
     */
    static calcularTotales(carritosBulk) {
        const totalSucursales = Object.keys(carritosBulk).length;
        const totalProductos = Object.values(carritosBulk).reduce(
            (total, items) => total + (Array.isArray(items) ? items.length : 0), 0
        );
        const totalUnidades = Object.values(carritosBulk).reduce(
            (total, items) => {
                if (!Array.isArray(items)) return total;
                return total + items.reduce((sum, item) => sum + (item.unidades || 0), 0);
            }, 0
        );

        return { totalProductos, totalUnidades, totalSucursales };
    }

    /**
     * Valida estructura de datos de ZIP
     * @param {Object} zipData - Datos a validar
     * @returns {boolean} True si es válido
     */
    static validarEstructuraZip(zipData) {
        if (!zipData || typeof zipData !== 'object') return false;
        if (!zipData.resumen || !Array.isArray(zipData.resumen)) return false;
        if (!zipData.totales || typeof zipData.totales !== 'object') return false;

        return zipData.resumen.every(item =>
            item.sucursal &&
            item.archivo &&
            Array.isArray(item.productos_detalle)
        );
    }
}

export default ZipProcessor;