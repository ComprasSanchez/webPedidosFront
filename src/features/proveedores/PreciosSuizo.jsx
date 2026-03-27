const PreciosSuizo = ({ idQuantio, ean, precios, seleccionado, onSelect, cantidad = 1 }) => {
    const p = precios.find((s) => s.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) onSelect(idQuantio, "suizo");
    };

    if (!p) return <div className={clase}>No disponible</div>;
    if (p._status >= 500) return <div className={clase}>⚠️ Error {p._status}</div>;
    if (p.noDisponible === true) return <div className={clase}>NO DISPONIBLE</div>;
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    // Suizo: el servidor ya computé el precio con la cantidad enviada — confiamos en finalPrice
    const precio = (typeof p.finalPrice === "number") ? p.finalPrice : (p.offerPrice ?? p.priceList);
    if (precio == null || precio === 0) return <div className={clase}>SIN PRECIO</div>;

    const showTachado = (typeof p.priceList === "number") && (precio < p.priceList);

    // % real (solo si hay tachado)
    const effPct = showTachado
        ? (typeof p.effectiveDiscountPct === "number"
            ? p.effectiveDiscountPct
            : Number(((1 - (precio / p.priceList)) * 100).toFixed(2)))
        : null;

    const minUnits = Number.isFinite(p.minimo_unids) ? p.minimo_unids : null;

    // Hint: si hay mínimo de unidades y la cantidad actual está por debajo
    const hintMinimo = (minUnits != null && minUnits > 1 && cantidad < minUnits);

    return (
        <div className={clase} onClick={handleClick}>
            {showTachado && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}

            <div style={{ fontWeight: "bold" }}>
                ${precio.toFixed(2)}
                <span
                    style={{
                        color: "#00bcd4",
                        marginLeft: "5px",
                        visibility: seleccionado ? "visible" : "hidden",
                    }}
                >
                    ✔
                </span>
            </div>

            {effPct != null && effPct > 0 && (
                <div style={{ marginTop: "2px", fontSize: "11px", color: "#333" }}>
                    -{effPct.toFixed(0)}%
                </div>
            )}

            {/* Hint: pediste menos del mínimo para el descuento */}
            {hintMinimo && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#e67e00", fontWeight: "500" }}>
                    Con {minUnits}u: dto.
                </div>
            )}
        </div>
    );
};

export default PreciosSuizo;
