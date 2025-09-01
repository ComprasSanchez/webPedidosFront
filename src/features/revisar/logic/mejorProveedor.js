// logic/mejorProveedor.js
import { getPrecioFinal } from "../utils/precioUtils";

export function precioValido(p, proveedor = null) {
    const val = getPrecioFinal(p, proveedor);
    return typeof val === "number" && val > 0;
}

export function mejorProveedor(ean, { preciosMonroe, preciosSuizo, preciosCofarsur }) {
    const candidatos = [
        { proveedor: "monroe", data: preciosMonroe.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "monroe")) },
        { proveedor: "suizo", data: preciosSuizo.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "suizo")) },
        { proveedor: "cofarsur", data: preciosCofarsur.find(p => p.ean === ean && p.stock > 0 && precioValido(p, "cofarsur")) },
    ].filter(p => p.data);

    if (!candidatos.length) return null;

    const mejor = candidatos.reduce((a, b) =>
        getPrecioFinal(a.data, a.proveedor) < getPrecioFinal(b.data, b.proveedor) ? a : b
    );
    return mejor.proveedor;
}
