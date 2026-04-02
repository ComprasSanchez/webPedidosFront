// logic/prioridad.js
import { getPrecioFinal } from "../utils/precioUtils";

export function proveedorViable(slug, ean, ctx) {
    if (slug === "deposito") {
        const s = ctx.stockDeposito.find(x => x.ean === ean)?.stock ?? 0;
        return s > 0;
    }
    if (slug === "kellerhoff") return true;
    if (slug === "suizaTuc") return true; // siempre viable para perfumería

    const fuente = slug === "monroe" ? ctx.preciosMonroe
        : slug === "suizo" ? ctx.preciosSuizo
            : slug === "cofarsur" ? ctx.preciosCofarsur
                : slug === "delsud" ? (ctx.preciosDelSud ?? [])
                    : slug === "kellerhoff" ? (ctx.preciosKellerhoff ?? []) : [];
    const p = fuente.find(x => x.ean === ean);
    const val = getPrecioFinal(p, slug, 1);
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
