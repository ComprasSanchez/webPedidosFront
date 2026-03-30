// logic/mejorProveedor.js
import { getPrecioFinal } from "../utils/precioUtils";

export function precioValido(p, proveedor = null, cantidad = 1) {
    const val = getPrecioFinal(p, proveedor, cantidad);
    return typeof val === "number" && val > 0;
}

export function mejorProveedor(ean, { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud = [], preciosKellerhoff = [] }, cantidad = 1) {
    const candidatos = [
        { proveedor: "monroe", data: preciosMonroe.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "monroe", cantidad)) },
        { proveedor: "suizo", data: preciosSuizo.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "suizo", cantidad)) },
        { proveedor: "cofarsur", data: preciosCofarsur.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "cofarsur", cantidad)) },
        { proveedor: "delsud", data: preciosDelSud.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "delsud", cantidad)) },
        { proveedor: "kellerhoff", data: preciosKellerhoff.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "kellerhoff", cantidad)) },
    ].filter(p => p.data);

    if (!candidatos.length) return null;

    const mejor = candidatos.reduce((a, b) =>
        getPrecioFinal(a.data, a.proveedor, cantidad) < getPrecioFinal(b.data, b.proveedor, cantidad) ? a : b
    );
    return mejor.proveedor;
}
