import { calcularPrecioEfectivo } from '../revisar/utils/precioTiers';

const PreciosDelSud = ({ idQuantio, ean, precios, seleccionado, onSelect, cantidad = 1, factorNC = 1 }) => {
    const p = precios?.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) {
            onSelect(idQuantio, "delsud");
        }
    };

    if (!p) return <div className={clase}>No disponible</div>;

    if (p._status >= 500) {
        return <div className={clase}>⚠️ Error {p._status}</div>;
    }

    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const { precioEfectivo, tierActivo, siguienteTier } = calcularPrecioEfectivo(p.priceList, p.offers, cantidad);
    const precioTier = precioEfectivo;
    const precio = precioTier * factorNC;
    const ncPct = factorNC < 1 ? Math.round((1 - factorNC) * 100) : 0;

    if (precio == null) return <div className={clase}>SIN PRECIO</div>;

    const showTachado = (tierActivo || factorNC < 1) && p.priceList != null && precio < p.priceList;

    return (
        <div className={clase} onClick={handleClick}>
            {/* Tachado si hay tier activo o NC */}
            {showTachado && p.priceList != null && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}
            <div style={{ fontWeight: (tierActivo || ncPct > 0) ? "bold" : "normal" }}>
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
            {ncPct > 0 && (
                <div style={{ marginTop: "2px", fontSize: "10px", color: "#e67e00", fontWeight: "600" }}>
                    Extra -{ncPct}%
                </div>
            )}
            {/* Hint: próximo tier no alcanzado */}
            {siguienteTier && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#e67e00", fontWeight: "500" }}>
                    Con {siguienteTier.minimo_unids}u: ${siguienteTier.precioOferta.toFixed(2)}
                </div>
            )}
        </div>
    );
};

export default PreciosDelSud;
