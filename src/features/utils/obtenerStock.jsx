export const getStock = (ean, stockDeposito) => {
    const s = stockDeposito.find((item) => item.ean === ean);
    if (!s) return "-";
    if (s.error === "NO_AUTORIZADO") return <span style={{ color: "#f80" }}>No autorizado</span>;
    return s.stock;
};