// logic/mejorProveedor.js
export function precioValido(p) {
    const val = p?.offerPrice ?? p?.priceList;
    return typeof val === "number" && val > 0;
}

export function mejorProveedor(ean, { preciosMonroe, preciosSuizo, preciosCofarsur }) {
    const candidatos = [
        { proveedor: "monroe", ...preciosMonroe.find(p => p.ean === ean && p.stock > 0 && precioValido(p)) },
        { proveedor: "suizo", ...preciosSuizo.find(p => p.ean === ean && p.stock > 0 && precioValido(p)) },
        { proveedor: "cofarsur", ...preciosCofarsur.find(p => p.ean === ean && p.stock > 0 && precioValido(p)) },
    ].filter(p => p.ean);
    if (!candidatos.length) return null;
    const mejor = candidatos.reduce((a, b) => (a.offerPrice ?? a.priceList) < (b.offerPrice ?? b.priceList) ? a : b);
    return mejor.proveedor;
}
