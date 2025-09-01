// utils/precioUtils.js

/**
 * Obtiene el precio final que se muestra al usuario para cualquier proveedor
 * Debe ser consistente con lo que muestran los componentes de precios
 */
export function getPrecioFinal(producto, proveedor) {
    if (!producto) return 0;

    // Suizo usa finalPrice primero, luego offerPrice, luego priceList
    if (proveedor === "suizo") {
        if (typeof producto.finalPrice === "number") return producto.finalPrice;
    }

    // Todos los demás (monroe, cofarsur, kellerhoff) usan offerPrice primero, luego priceList
    return producto.offerPrice ?? producto.priceList ?? 0;
}

/**
 * Verifica si un producto tiene precio válido
 */
export function precioValido(producto, proveedor = null) {
    const precio = getPrecioFinal(producto, proveedor);
    return typeof precio === "number" && precio > 0;
}

/**
 * Obtiene precios para el resumen (usado en RevisarPedido)
 */
export function getPreciosItem(ean, { preciosMonroe, preciosSuizo, preciosCofarsur }) {
    const monroe = preciosMonroe.find(p => p.ean === ean);
    const suizo = preciosSuizo.find(p => p.ean === ean);
    const cofarsur = preciosCofarsur.find(p => p.ean === ean);

    return {
        deposito: 0,
        monroe: getPrecioFinal(monroe, "monroe"),
        suizo: getPrecioFinal(suizo, "suizo"),
        cofarsur: getPrecioFinal(cofarsur, "cofarsur"),
    };
}
