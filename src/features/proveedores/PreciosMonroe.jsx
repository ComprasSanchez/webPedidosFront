const PreciosMonroe = ({ ean, precios, seleccionado, onSelect }) => {
    const p = precios.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) {
            onSelect(ean, "monroe");
        }
    };

    if (!p) return <div className={clase}>No disponible</div>;
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const precio = p.offerPrice ?? p.priceList;

    return (
        <div className={clase} onClick={handleClick}>
            {p.offerPrice != null && p.priceList != null && (
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
        </div>

    );
};

export default PreciosMonroe;