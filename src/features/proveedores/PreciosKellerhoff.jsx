import React from "react";

const PreciosKellerhoff = ({ idQuantio, ean, precios, seleccionado, onSelect }) => {
    const p = precios.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) {
            onSelect(idQuantio, "kellerhoff");
        }
    };

    if (!p) return <div className={clase}>No disponible</div>;

    // ⚠️ Mostrar error si hubo fallo HTTP
    if (p._status >= 500) {
        return <div className={clase}>⚠️ Error {p._status}</div>;
    }

    if (p.error) {
        return <div className={clase}>⚠️</div>;
    }

    // 📦 Mostrar sin stock si vino explícito
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const precio = (typeof p.finalPrice === "number") ? p.finalPrice : (p.offerPrice ?? p.priceList);
    const tieneDescuento = typeof p.priceList === "number" && typeof precio === "number" && precio < p.priceList;

    return (
        <div className={clase} onClick={handleClick}>
            {tieneDescuento && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}
            <div style={{ fontWeight: "bold" }}>
                ${precio?.toFixed(2)}
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

export default PreciosKellerhoff;
