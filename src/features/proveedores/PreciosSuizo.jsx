const PreciosSuizo = ({ ean, precios, seleccionado, onSelect }) => {
    const p = precios.find((s) => s.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) onSelect(ean, "suizo");
    };

    if (!p) return <div className={clase}>No disponible</div>;
    if (p._status >= 500) return <div className={clase}>⚠️ Error {p._status}</div>;
    if (p.noDisponible === true) return <div className={clase}>NO DISPONIBLE</div>;
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const precio = (typeof p.finalPrice === "number") ? p.finalPrice : (p.offerPrice ?? p.priceList);
    if (precio == null || precio === 0) return <div className={clase}>SIN PRECIO</div>;

    const showTachado = (typeof p.priceList === "number") && (precio < p.priceList);

    // % real (solo si hay tachado)
    const effPct = showTachado
        ? (typeof p.effectiveDiscountPct === "number"
            ? p.effectiveDiscountPct
            : Number(((1 - (precio / p.priceList)) * 100).toFixed(2)))
        : null;

    // Filtrar leyendas que duplican el % (sobre FAR/PVP)
    const offersToShow = Array.isArray(p.offers)
        ? p.offers.filter(o => !/sobre\s*(far|pvp)/i.test(String(o.descripcion || "")))
        : [];

    const minUnits = Number.isFinite(p.minimo_unids) ? p.minimo_unids : null;

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
                <div style={{ marginTop: "2px", fontSize: "11px", color: "#333", display: "flex", flexDirection: "row", gap: "2px", textAlign: "center", justifyContent: 'center' }}>
                    -{effPct.toFixed(0)}%
                    {/* Mostrar solo condiciones útiles; agregamos "Min.: N" si aplica */}
                    {minUnits > 1 && <div>Min.: {minUnits}</div>}
                    {offersToShow.map((o, idx) => (
                        <div key={idx}>{o.descripcion}</div>
                    ))}

                </div>
            )}

        </div>
    );
};

export default PreciosSuizo;
