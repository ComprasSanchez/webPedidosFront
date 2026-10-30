import React from "react";
import { calcularPrecioEfectivo } from "../revisar/utils/precioTiers";

const PreciosKellerhoff = ({ idQuantio, ean, precios, seleccionado, onSelect, cantidad = 1, factorNC = 1, soloDepo = false }) => {
    const listaPrecios = Array.isArray(precios) ? precios : [];
    const p = listaPrecios.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p?.manualOnly) {
            onSelect(idQuantio, "kellerhoff");
            return;
        }

        if (p && p.priceList != null && p.stock !== false) {
            onSelect(idQuantio, "kellerhoff");
        }
    };

    if (soloDepo) return <div className={clase}>Solo Depo</div>;

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

    if (typeof p.error === "string" && p.error.trim()) {
        return <div className={clase}>{p.error}</div>;
    }

    // Los tramos se recalculan con la cantidad actual; sin tramos con precio se usa el finalPrice del servidor
    const hayTramos = Array.isArray(p.offers) && p.offers.some((o) => o.precioOferta != null);
    const { precioEfectivo, siguienteTier } = calcularPrecioEfectivo(p.priceList, p.offers, cantidad);
    const precioApi = hayTramos && typeof precioEfectivo === "number"
        ? precioEfectivo
        : (typeof p.finalPrice === "number"
            ? p.finalPrice
            : (typeof p.priceList === "number" ? p.priceList : null));

    if (precioApi == null) {
        if (p.stock === false) return <div className={clase}>SIN STOCK</div>;
        return <div className={clase}>SIN PRECIO</div>;
    }

    const precio = precioApi * factorNC;
    const ncPct = factorNC < 1 ? Math.round((1 - factorNC) * 100) : 0;

    const tieneDescuento = typeof p.priceList === "number" && precio < p.priceList;

    // Porcentaje de la API (sin NC) segun la cantidad actual: p.effectiveDiscountPct quedaria fijo en el valor de la primera consulta
    const apiPct = (typeof p.priceList === "number" && p.priceList > 0 && precioApi < p.priceList)
        ? Number(((1 - precioApi / p.priceList) * 100).toFixed(2))
        : 0;

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
            {apiPct > 0 && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#555" }}>
                    -{apiPct}%
                </div>
            )}
            {ncPct > 0 && (
                <div style={{ marginTop: "2px", fontSize: "10px", color: "#e67e00", fontWeight: "600" }}>
                    Extra -{ncPct}%
                </div>
            )}
            {/* Hint: proximo tramo no alcanzado */}
            {siguienteTier && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#e67e00", fontWeight: "500" }}>
                    Con {siguienteTier.minimo_unids}u: ${siguienteTier.precioOferta.toFixed(2)}
                </div>
            )}
            {p.stock === false && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#a33", fontWeight: "500" }}>
                    Sin stock
                </div>
            )}
        </div>
    );
};

export default PreciosKellerhoff;
