const PreciosSuizo = ({ ean, precios, seleccionado, onSelect }) => {
    const p = precios.find((s) => s.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    if (!p) return <div className={clase}>No disponible</div>;

    // Si hubo un error (de credenciales, HTTP, etc.), mostrarlo
    if (p.error) return <div className={clase}>⚠️ {p.error}</div>;

    // Si el estado HTTP indica un error del servidor, mostrarlo
    if (p._status >= 500) return <div className={clase}>⚠️ Error {p._status}</div>;

    // Si el stock es null, significa que hubo un error de conexión, no de stock
    if (p.stock === null) return <div className={clase}>⚠️ Error en conexión</div>;

    // Si el stock es false, es que no hay stock del producto
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const precioFinal = p.offerPrice ?? p.priceList;
    if (!precioFinal || precioFinal === 0) return <div className={clase}>SIN PRECIO</div>;

    const handleClick = () => {
        if (precioFinal && precioFinal > 0) {
            onSelect(ean, "suizo");
        }
    };

    return (
        <div className={clase} onClick={handleClick}>
            {p.offerPrice != null && p.priceList != null && p.offerPrice < p.priceList && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}
            <div style={{ fontWeight: "bold" }}>
                ${precioFinal.toFixed(2)}
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
                        <div key={idx}>{o.descripcion}</div>
                    ))}
                </div>
            )}
        </div>
    );
};


export default PreciosSuizo;
