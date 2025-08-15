// front/src/features/proveedores/PreciosKellerof.jsx
const PreciosKellerof = ({ ean, seleccionado, onSelect }) => {
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleSelect = () => {
        onSelect(ean, "kellerof");
        window.open("https://www.kellerhoff.com.ar/", "_blank", "noopener");
    };

    return (
        <div className={clase} onClick={handleSelect} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: "bold", minWidth: "100px" }}>
                Ir a la web
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

export default PreciosKellerof;
