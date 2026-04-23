import React from "react";

const PreciosKellerhoff = ({ idQuantio, ean, precios, seleccionado, onSelect }) => {
    const listaPrecios = Array.isArray(precios) ? precios : [];
    const p = listaPrecios.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null && p.stock !== false && !p.manualOnly) {
            onSelect(idQuantio, "kellerhoff");
        }
    };

    if (!p) return <div className={clase}>No disponible</div>;

    if (p.manualOnly) {
        return (
            <div className={clase} onClick={handleClick}>
                <div className="kellerhoff-label">
                    Ir a la web
                    <span className={`kellerhoff-check ${seleccionado ? "visible" : ""}`}>
                        ✔
                    </span>
                </div>
            </div>
        );
    }

    if (p._status >= 500) {
        return <div className={clase}>⚠️ Error {p._status}</div>;
    }

    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const precio = typeof p.finalPrice === "number"
        ? p.finalPrice
        : (typeof p.priceList === "number" ? p.priceList : null);

    if (precio == null) return <div className={clase}>SIN PRECIO</div>;

    const tieneDescuento = typeof p.priceList === "number"
        && typeof p.finalPrice === "number"
        && p.finalPrice < p.priceList;

    return (
        <div className={clase} onClick={handleClick}>
            {tieneDescuento && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}
            <div style={{ fontWeight: tieneDescuento ? "bold" : "normal" }}>
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
            {typeof p.effectiveDiscountPct === "number" && p.effectiveDiscountPct > 0 && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#555" }}>
                    -{p.effectiveDiscountPct}%
                </div>
            )}
        </div>
    );
};

export default PreciosKellerhoff;
