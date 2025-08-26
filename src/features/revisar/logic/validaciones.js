// front/src/features/revisar/logic/validaciones.js

// ¿Hay stock de depósito disponible para este EAN?
export function hayStockDeposito(ean, stockDeposito = []) {
    const s = stockDeposito.find(x => x.ean === ean)?.stock ?? 0;
    return Number(s) > 0;
}

// ¿Alguna droguería tiene stock y precio válido?
export function hayDrogConPrecioValido(ean, { preciosMonroe = [], preciosSuizo = [], preciosCofarsur = [] }, precioValidoFn) {
    const m = preciosMonroe.find(p => p.ean === ean && p.stock > 0 && precioValidoFn(p));
    const s = preciosSuizo.find(p => p.ean === ean && p.stock > 0 && precioValidoFn(p));
    const c = preciosCofarsur.find(p => p.ean === ean && p.stock > 0 && precioValidoFn(p));
    return !!(m || s || c);
}

// ¿El motivo “Stock Depo” debe bloquearse (auto-fijado)?
export function esMotivoStockDepoBloqueado({ motivoActual, proveedorActual, hayDepo }) {
    return motivoActual === "Stock Depo" && proveedorActual === "deposito" && hayDepo;
}

// ¿“Falta” debe bloquearse porque hay algo pedible?
export function deberiaBloquearFalta({ hayAlgoPedible }) {
    return !!hayAlgoPedible;
}

// ¿Hace falta justificación manual?
export function requiereJustificacion(motivo) {
    return !motivo || !String(motivo).trim();
}
