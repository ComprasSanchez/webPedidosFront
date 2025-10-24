// logic/prioridad.js
export function proveedorViable(slug, ean, ctx) {
    if (slug === "deposito") {
        const s = ctx.stockDeposito.find(x => x.ean === ean)?.stock ?? 0;
        return s > 0;
    }
    if (slug === "kellerhoff") return true; // como antes
    if (slug === "suizaTuc") return true; // siempre viable para perfumería

    const fuente = slug === "monroe" ? ctx.preciosMonroe
        : slug === "suizo" ? ctx.preciosSuizo
            : slug === "cofarsur" ? ctx.preciosCofarsur : [];
    const p = fuente.find(x => x.ean === ean);
    const val = p?.offerPrice ?? p?.priceList;
    return p?.stock > 0 && typeof val === "number" && val > 0;
}

export function pickPorPrioridad(item, prioridad, ctx) {
    for (const slug of prioridad) {
        if (proveedorViable(slug, item.ean, ctx)) return slug;
    }
    // Fallback especial: kellerhoff o suizaTuc siempre están disponibles
    if (prioridad.includes("kellerhoff")) return "kellerhoff";
    if (prioridad.includes("suizaTuc")) return "suizaTuc";
    return null;
}
