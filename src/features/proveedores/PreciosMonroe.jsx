import { calcularPrecioEfectivo } from '../revisar/utils/precioTiers';

const PreciosMonroe = ({ idQuantio, ean, precios, seleccionado, onSelect, cantidad = 1 }) => {
    const p = precios.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        if (p && p.priceList != null) {
            onSelect(idQuantio, "monroe");
        }
    };

    if (!p) return <div className={clase}>No disponible</div>;

    // ⚠️ Mostrar error si hubo fallo HTTP
    if (p._status >= 500) {
        return <div className={clase}>⚠️ Error {p._status}</div>;
    }

    // 📦 Mostrar sin stock si vino explícito
    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const { precioEfectivo, tierActivo, siguienteTier } = calcularPrecioEfectivo(p.priceList, p.offers, cantidad);
    const precio = precioEfectivo;

    if (precio == null) return <div className={clase}>SIN PRECIO</div>;

    return (
        <div className={clase} onClick={handleClick}>
            {/* Tachado solo si hay descuento activo en la cantidad actual */}
            {tierActivo && p.priceList != null && (
                <div style={{ fontSize: "12px", color: "#555" }}>
                    <s>${p.priceList.toFixed(2)}</s>
                </div>
            )}
            <div style={{ fontWeight: tierActivo ? "bold" : "normal" }}>
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
            {/* Hint: próximo tier no alcanzado */}
            {siguienteTier && (
                <div style={{ marginTop: "3px", fontSize: "11px", color: "#e67e00", fontWeight: "500" }}>
                    Con {siguienteTier.minimo_unids}u: ${siguienteTier.precioOferta.toFixed(2)}
                </div>
            )}
        </div>
    );
};

export default PreciosMonroe;
