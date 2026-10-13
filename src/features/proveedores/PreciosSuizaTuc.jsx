

const PreciosSuizaTuc = ({ idQuantio, ean, seleccionado, onSelect, soloDepo = false }) => {
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleSelect = (e) => {
        e.stopPropagation();
        onSelect(idQuantio, "suizaTuc");
    };

    if (soloDepo) return <div className={clase}>Solo Depo</div>;

    return (
        <div className={clase} onClick={handleSelect} style={{ cursor: "pointer", position: "relative" }}>
            <div className="kellerhoff-label">
                Ir a la web
                <span className={`kellerhoff-check ${seleccionado ? "visible" : ""}`}>
                    ✔
                </span>
            </div>
        </div>
    );
};

export default PreciosSuizaTuc;
