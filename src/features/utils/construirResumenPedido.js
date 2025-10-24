// src/utils/construirResumenPedido.js
export const construirResumenPedido = (carrito, seleccion, obtenerCarritoId) => {
    const resumen = {};

    for (const item of carrito) {
        // 🆔 Usar carritoId para obtener la selección (consistente con obtenerCarritoId)
        const carritoId = obtenerCarritoId ? obtenerCarritoId(item) : (item.carritoId || (item.esProductoNoRegistrado ? `ean_${item.ean}` : String(item.idQuantio)));
        const sel = seleccion[carritoId];
        if (!sel || !sel.proveedor) continue;

        const prov = sel.proveedor; // "deposito" | "monroe" | "suizo" | "cofarsur" | "kellerhoff" | "Falta"
        const precios = item.precios || {};

        const unidades = Number(item.unidades ?? 0) || 0;
        // depósito / kellerhoff / suizaTuc / Falta => 0
        const precioUnit =
            prov === "deposito" || prov === "kellerhoff" || prov === "suizaTuc" || prov === "Falta"
                ? 0
                : Number(precios[prov] ?? 0) || 0;

        (resumen[prov] ||= []).push({
            ean: item.ean,
            descripcion: item.descripcion,
            unidades,
            precio: precioUnit,
            motivo: sel.motivo,
        });
    }

    return resumen; // mismo contrato que tenías
};
