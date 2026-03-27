import { calcularPrecioEfectivo } from '../revisar/utils/precioTiers';

const PreciosCofarsur = ({ idQuantio, ean, precios, seleccionado, onSelect, cantidad = 1 }) => {
    const p = precios.find((c) => c.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    if (!p) return <div className={clase}>No disponible</div>;

    if (p._status >= 500) return <div className={clase}>⚠️ Error {p._status}</div>;

    // 🟡 Mostrar error explícito desde backend
    if (p.error) {
        return (
            <div className={clase} title={p.error}>
                {p.error.length > 30 ? `${p.error.substring(0, 27)}...` : p.error}
            </div>
        );
    }

    if (p.stock === false) return <div className={clase}>SIN STOCK</div>;

    const { precioEfectivo, tierActivo, siguienteTier } = calcularPrecioEfectivo(p.priceList, p.offers, cantidad);
    const precio = precioEfectivo;

    if (!precio || precio === 0) return <div className={clase}>SIN PRECIO</div>;

    const handleClick = () => {
        if (precio > 0) onSelect(idQuantio, "cofarsur");
    };

    return (
        <div className={clase} onClick={handleClick}>
            {/* Tachado solo si el tier activo da descuento real */}
            {tierActivo && p.priceList != null && precio < p.priceList && (
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

export default PreciosCofarsur;
