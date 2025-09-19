// src/utils/construirResumenPedido.js
export const construirResumenPedido = (carrito, seleccion) => {
    const resumen = {};

    for (const item of carrito) {
        const sel = seleccion[item.idQuantio] || seleccion[item.ean];
        if (!sel || !sel.proveedor) continue;

        const prov = sel.proveedor; // "deposito" | "monroe" | "suizo" | "cofarsur" | "kellerhoff" | "Falta"
        const precios = item.precios || {};

        const unidades = Number(item.unidades ?? 0) || 0;
        // depósito / kellerhoff / Falta => 0
        const precioUnit =
            prov === "deposito" || prov === "kellerhoff" || prov === "Falta"
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
