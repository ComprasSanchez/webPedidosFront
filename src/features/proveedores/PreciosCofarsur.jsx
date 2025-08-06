const PreciosCofarsur = ({ ean, precios, seleccionado, onSelect }) => {
    const p = precios.find((c) => c.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) {
            onSelect(ean, "cofarsur");
        }
    };

    if (!p) return <div className={clase}>No disponible</div>;
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const precio = p.offerPrice ?? p.priceList;

    return (
        <div className={clase} onClick={handleClick}>
            {p.offerPrice != null && p.priceList != null && p.offerPrice < p.priceList && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}
            <div style={{ fontWeight: p.offerPrice < p.priceList ? "bold" : "normal" }}>
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
            {p.offers?.length > 0 && (
                <div style={{ marginTop: "4px", fontSize: "11px", color: "#333" }}>
                    {p.offers.map((o, idx) => (
                        <div key={idx}>• {o.descripcion}</div>
                    ))}
                </div>
            )}
        </div>

    );
};

export default PreciosCofarsur;