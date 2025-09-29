// services/duplicadosService.js
// Servicio puro para lógica de consolidación de duplicados

/**
 * Servicio para manejo de duplicados y consolidación de productos
 */
export class DuplicadosService {
    /**
     * Consolida productos duplicados sumando cantidades
     * @param {Array} productos - Array de productos a consolidar
     * @returns {Object} { productosConsolidados, duplicadosDetalle }
     */
    static consolidarProductos(productos) {
        const productosMap = new Map();
        const duplicadosDetalle = [];

        productos.forEach(producto => {
            const key = producto.ean || producto.idQuantio;

            if (productosMap.has(key)) {
                // Producto duplicado encontrado
                const productoExistente = productosMap.get(key);
                const cantidadAnterior = productoExistente.unidades;

                productoExistente.unidades += producto.unidades;

                // Registrar duplicado si no está ya registrado
                const duplicadoExistente = duplicadosDetalle.find(d => d.ean === key);
                if (!duplicadoExistente) {
                    duplicadosDetalle.push({
                        ean: key,
                        nombre: producto.nombre || producto.descripcion || `Producto ${key}`,
                        cantidadOriginal: cantidadAnterior,
                        cantidadConsolidada: productoExistente.unidades
                    });
                } else {
                    // Actualizar cantidad consolidada
                    duplicadoExistente.cantidadConsolidada = productoExistente.unidades;
                }
            } else {
                // Producto nuevo
                productosMap.set(key, { ...producto });
            }
        });

        return {
            productosConsolidados: Array.from(productosMap.values()),
            duplicadosDetalle
        };
    }

    /**
     * Busca y consolida productos entre carrito existente y nuevos productos
     * @param {Array} carritoExistente - Productos ya en el carrito
     * @param {Array} nuevosProductos - Productos nuevos a agregar
     * @returns {Object} { carritoConsolidado, duplicadosDetalle }
     */
    static consolidarConCarritoExistente(carritoExistente, nuevosProductos) {
        const carritoConsolidado = [...carritoExistente];
        const duplicadosDetalle = [];

        nuevosProductos.forEach(nuevoProducto => {
            const key = nuevoProducto.ean || nuevoProducto.idQuantio;

            // Buscar si ya existe el producto en el carrito
            const productoExistente = carritoConsolidado.find(
                p => p.ean === key || p.idQuantio === key
            );

            if (productoExistente) {
                // CONSOLIDAR: Sumar cantidades y fusionar archivos origen
                const cantidadAnterior = productoExistente.unidades;
                productoExistente.unidades += nuevoProducto.unidades || 0;

                // Mantener lista de archivos origen
                const archivosOrigen = productoExistente.archivos_origen || [productoExistente.archivo_origen];
                if (!archivosOrigen.includes(nuevoProducto.archivo_origen)) {
                    archivosOrigen.push(nuevoProducto.archivo_origen);
                }

                productoExistente.archivos_origen = archivosOrigen;
                productoExistente.archivo_origen = archivosOrigen.length > 1
                    ? `${archivosOrigen.length} archivos`
                    : archivosOrigen[0];

                // Registrar duplicado
                duplicadosDetalle.push({
                    ean: key,
                    nombre: nuevoProducto.nombre || nuevoProducto.descripcion || `Producto ${key}`,
                    cantidadOriginal: cantidadAnterior,
                    cantidadConsolidada: productoExistente.unidades
                });
            } else {
                // NUEVO: Agregar producto nuevo
                carritoConsolidado.push({
                    ...nuevoProducto,
                    archivo_origen: nuevoProducto.archivo_origen,
                    archivos_origen: [nuevoProducto.archivo_origen]
                });
            }
        });

        return {
            carritoConsolidado,
            duplicadosDetalle
        };
    }

    /**
     * Calcula estadísticas de duplicados
     * @param {Array} duplicadosDetalle - Array de duplicados detectados
     * @returns {Object} Estadísticas de duplicados
     */
    static calcularEstadisticas(duplicadosDetalle) {
        const totalDuplicados = duplicadosDetalle.length;
        const totalCantidadOriginal = duplicadosDetalle.reduce(
            (sum, dup) => sum + dup.cantidadOriginal, 0
        );
        const totalCantidadConsolidada = duplicadosDetalle.reduce(
            (sum, dup) => sum + dup.cantidadConsolidada, 0
        );

        return {
            totalDuplicados,
            totalCantidadOriginal,
            totalCantidadConsolidada,
            diferencia: totalCantidadConsolidada - totalCantidadOriginal
        };
    }
}

export default DuplicadosService;