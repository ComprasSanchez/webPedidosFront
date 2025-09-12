export const getStock = (ean, stockDisponible, sucursalActual = null) => {
    // Log simple para contar llamadas
    console.log(`📋 getStock llamado para EAN: ${ean}`);

    // Verificar que stockDisponible sea un array válido
    if (!Array.isArray(stockDisponible)) {
        return "-";
    }

    const s = stockDisponible.find((item) => item.ean === ean);

    if (!s) {
        return "-";
    }

    // Manejar errores específicos
    if (s.error === "NO_AUTORIZADO") {
        return <span style={{ color: "#f80" }}>No autorizado</span>;
    }
    if (s.error) {
        return <span style={{ color: "#f80" }}>Error</span>;
    }

    // El backend ya calcula correctamente el 'disponible' según la sucursal
    // - Para la sucursal actual: stockReal - hardActivas - softOtras (sin mis propias reservas)
    // - Para otras sucursales: stockReal - hardActivas - softActivas (con todas las reservas)
    if (typeof s.disponible === 'number') {
        return s.disponible;
    }

    // Fallback al campo 'stock' para compatibilidad
    if (typeof s.stock === 'number') {
        return s.stock;
    }

    // Si stock es booleano (como en algunas APIs), convertir a número
    if (s.stock === true) return 1;
    if (s.stock === false) return 0;

    return s.stock || "-";
};// Función adicional para obtener detalles completos del stock ATP
export const getStockDetails = (ean, stockDisponible) => {
    if (!Array.isArray(stockDisponible)) {
        return null;
    }

    const s = stockDisponible.find((item) => item.ean === ean);
    if (!s) return null;

    return {
        stockReal: s.stockReal || 0,
        hardActivas: s.hardActivas || 0,
        softActivas: s.softActivas || 0,
        softOtras: s.softOtras || 0,
        softPropias: s.softPropias || 0,
        disponible: s.disponible || 0,
        error: s.error || null
    };
};