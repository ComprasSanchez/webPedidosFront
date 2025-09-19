// podés mover esto a ./logic/submit.js si querés
export function construirResumenPedido(carritoConPrecios, seleccion) {
    const porProveedor = {};
    carritoConPrecios.forEach((item) => {
    const prov = (seleccion[item.idQuantio] || seleccion[item.ean])?.proveedor ?? "Falta";
        if (!porProveedor[prov]) porProveedor[prov] = { totalUnidades: 0, totalMonto: 0, items: [] };
        const precioUsado =
            prov === "deposito" ? 0
                : prov === "monroe" ? item.precios.monroe
                    : prov === "suizo" ? item.precios.suizo
                        : prov === "cofarsur" ? item.precios.cofarsur
                            : 0;

        porProveedor[prov].totalUnidades += item.unidades;
        porProveedor[prov].totalMonto += (precioUsado || 0) * item.unidades;
        porProveedor[prov].items.push(item);
    });

    const resumen = Object.entries(porProveedor).map(([proveedor, data]) => ({
        proveedor,
        totalUnidades: data.totalUnidades,
        totalMonto: Number(data.totalMonto.toFixed(2)),
        items: data.items
    }));

    const totales = resumen.reduce((acc, r) => ({
        unidades: acc.unidades + r.totalUnidades,
        monto: acc.monto + r.totalMonto
    }), { unidades: 0, monto: 0 });

    return { grupos: resumen, totales: { ...totales, monto: Number(totales.monto.toFixed(2)) } };
}
