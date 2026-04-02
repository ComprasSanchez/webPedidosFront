import React from "react";

const PreciosKellerhoff = ({ idQuantio, ean, precios, seleccionado, onSelect }) => {
    const listaPrecios = Array.isArray(precios) ? precios : [];
    const p = listaPrecios.find((m) => m.ean === ean);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleClick = () => {
        onSelect(idQuantio, "kellerhoff");
    };

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
};

export default PreciosKellerhoff;
