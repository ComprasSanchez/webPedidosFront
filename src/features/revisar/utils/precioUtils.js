// utils/precioUtils.js
import { calcularPrecioEfectivo } from './precioTiers';

/**
 * Obtiene el precio final que se muestra al usuario para cualquier proveedor.
 * Respeta los tiers de descuento por cantidad: si `cantidad` no alcanza el mínimo
 * de un tier, ese descuento NO se aplica.
 *
 * @param {object}      producto  - datos del proveedor para ese EAN
 * @param {string}      proveedor - "monroe" | "suizo" | "cofarsur" | "delsud"
 * @param {number}      cantidad  - unidades pedidas (default 1)
 */
export function getPrecioFinal(producto, proveedor, cantidad = 1) {
    if (!producto) return 0;

    // Suizo: el servidor ya computó el precio con la cantidad original, confiamos en finalPrice
    if (proveedor === 'suizo') {
        if (typeof producto.finalPrice === 'number') return producto.finalPrice;
        return producto.priceList ?? 0;
    }

    // Monroe, Cofarsur, DelSud: calcular precio según tiers, respetando cantidad
    const { precioEfectivo } = calcularPrecioEfectivo(producto.priceList, producto.offers, cantidad);
    return precioEfectivo ?? 0;
}

/**
 * Verifica si un producto tiene precio válido para la cantidad pedida.
 */
export function precioValido(producto, proveedor = null, cantidad = 1) {
    const precio = getPrecioFinal(producto, proveedor, cantidad);
    return typeof precio === 'number' && precio > 0;
}

/**
 * Obtiene precios para el resumen (usado en RevisarPedido).
 * Acepta `cantidad` para respetar los tiers de descuento por volumen.
 */
export function getPreciosItem(ean, { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud }, cantidad = 1) {
    const monroe = preciosMonroe.find(p => p.ean === ean);
    const suizo = preciosSuizo.find(p => p.ean === ean);
    const cofarsur = preciosCofarsur.find(p => p.ean === ean);
    const delsud = preciosDelSud?.find(p => p.ean === ean);

    return {
        deposito: 0,
        monroe: getPrecioFinal(monroe, 'monroe', cantidad),
        suizo: getPrecioFinal(suizo, 'suizo', cantidad),
        cofarsur: getPrecioFinal(cofarsur, 'cofarsur', cantidad),
        delsud: getPrecioFinal(delsud, 'delsud', cantidad),
    };
}
