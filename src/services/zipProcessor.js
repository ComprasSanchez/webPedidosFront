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

        // Detectar si es modo Solo Depo
        const esSoloDepo = zipData.modo === 'SOLO_DEPOSITO';
        console.log(`🔍 Procesando ZIP - Modo: ${esSoloDepo ? 'Solo Depo' : 'Tradicional'}`);

        // Empezar con carritos existentes (mantener productos para resumen en Solo Depo)
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

            // Inicializar metadatos de sucursal
            if (!metadatosSucursales[sucursal]) {
                metadatosSucursales[sucursal] = {
                    duplicados: 0,
                    archivos: [],
                    detallesDuplicados: [],
                    productosInvalidos: 0,
                    detallesInvalidos: [],
                    nroPedidoDeposito: null // Número de pedido del depósito
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

            // 🔄 SOLO procesar productos para el carrito en modo Tradicional
            if (!esSoloDepo && item.productos_detalle) {
                // Inicializar array si no existe la sucursal
                if (!carritoConsolidado[sucursal] || !Array.isArray(carritoConsolidado[sucursal])) {
                    carritoConsolidado[sucursal] = [];
                }

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
            } else if (esSoloDepo && item.productos_detalle) {
                // 🏠 MODO SOLO DEPO: Procesar productos SOLO para mostrar resumen (NO van al carrito principal)
                console.log(`🏠 ${sucursal}: Solo Depo - Procesando productos para resumen (no van al carrito principal)`);

                // Procesar productos normalmente para el resumen
                const productosConArchivo = item.productos_detalle.map(producto => ({
                    ...producto,
                    sucursal: sucursal,
                    archivo_origen: item.archivo,
                    archivos_origen: [item.archivo],
                    nombre: producto.nombre || ProductosInvalidosService.extraerNombreProducto(producto.lineaOriginal) || producto.descripcion || `Producto ${producto.ean}`
                }));

                const validacionInvalidos = ProductosInvalidosService.detectarProductosInvalidos(productosConArchivo);

                // Agregar productos válidos a carritosBulk SOLO para mostrar el resumen
                if (!carritoConsolidado[sucursal]) {
                    carritoConsolidado[sucursal] = [];
                }

                // Guardar estadísticas de productos inválidos
                if (validacionInvalidos.productosInvalidos.length > 0) {
                    metadatosSucursales[sucursal].productosInvalidos += validacionInvalidos.productosInvalidos.length;
                    metadatosSucursales[sucursal].detallesInvalidos.push(...validacionInvalidos.productosInvalidos);
                }

                // PASO 2: Usar servicio de duplicados para consolidar productos para el resumen
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

        // Extraer números de pedidos del depósito de la respuesta del backend
        if (zipData.pedidos_deposito?.pedidos_resumen) {
            zipData.pedidos_deposito.pedidos_resumen.forEach(pedido => {
                const sucursal = pedido.sucursal;
                if (metadatosSucursales[sucursal] && pedido.nroPedidoQuantio) {
                    // Acumular múltiples números de pedido en lugar de sobreescribir
                    if (!metadatosSucursales[sucursal].nrosPedidosDeposito) {
                        metadatosSucursales[sucursal].nrosPedidosDeposito = [];
                    }

                    // Evitar duplicados si ya existe el número
                    if (!metadatosSucursales[sucursal].nrosPedidosDeposito.includes(pedido.nroPedidoQuantio)) {
                        metadatosSucursales[sucursal].nrosPedidosDeposito.push(pedido.nroPedidoQuantio);
                    }

                    // Mantener compatibilidad con el campo original (usar el último agregado)
                    metadatosSucursales[sucursal].nroPedidoDeposito = pedido.nroPedidoQuantio;
                }
            });
        }

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