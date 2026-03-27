/**
 * Calcula el precio efectivo para un producto dado la cantidad pedida y los tiers de oferta.
 *
 * Regla: el descuento solo aplica si la cantidad pedida >= minimo_unids del tier.
 * Si no se cumple ningún tier, se devuelve priceList (precio base sin descuento por volumen).
 *
 * @param {number|null} priceList - Precio base sin descuento por volumen
 * @param {Array}       offers    - Tiers de oferta: [{ Condicion_Compra: { minimo_unids }, precioOferta, descripcion }]
 * @param {number}      cantidad  - Unidades pedidas actualmente
 *
 * @returns {{
 *   precioEfectivo: number|null,  — precio que realmente aplica (mostrar y guardar)
 *   tierActivo:     object|null,  — tier aplicado (null = se usa priceList, sin descuento)
 *   siguienteTier:  object|null,  — próximo tier mejor no alcanzado (para mostrar hint)
 * }}
 */
export function calcularPrecioEfectivo(priceList, offers, cantidad) {
    const qty = (typeof cantidad === 'number' && cantidad > 0) ? Math.floor(cantidad) : 1;

    // Solo tiers con precio concreto definido
    const tiers = (offers || [])
        .filter(o => o.precioOferta != null && (o.Condicion_Compra?.minimo_unids ?? 1) >= 1)
        .map(o => ({
            minimo_unids: o.Condicion_Compra?.minimo_unids ?? 1,
            precioOferta: o.precioOferta,
            descripcion: o.descripcion ?? '',
        }))
        .sort((a, b) => a.minimo_unids - b.minimo_unids);

    let precioEfectivo = priceList;
    let tierActivo = null;

    // Aplicar el mejor tier alcanzado (mayor minimo_unids que todavía cumplimos)
    for (const tier of tiers) {
        if (qty >= tier.minimo_unids) {
            precioEfectivo = tier.precioOferta;
            tierActivo = tier;
        }
    }

    // El primer tier que aún no alcanzamos → hint para el usuario
    const siguienteTier = tiers.find(t => qty < t.minimo_unids) ?? null;

    return { precioEfectivo, tierActivo, siguienteTier };
}
