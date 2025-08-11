// src/utils/construirResumenPedido.js

export const construirResumenPedido = (carrito, seleccion) => {
    const resumen = {};

    carrito.forEach((item) => {

        const sel = seleccion[item.ean];
        if (!sel || !sel.proveedor) return;

        const proveedor = sel.proveedor;
        const precios = item.precios || {};
        const precio = precios[proveedor] ?? 0;

        if (!resumen[proveedor]) resumen[proveedor] = [];

        resumen[proveedor].push({
            ean: item.ean,
            descripcion: item.descripcion,
            unidades: item.unidades,
            precio: precio,
            motivo: sel.motivo,
        });
    });

    return resumen;
};