import React, { useState, useRef, useEffect } from "react";

const PreciosKellerhoff = ({ idQuantio, ean, seleccionado, onSelect }) => {
    const [showModal, setShowModal] = useState(false);
    const modalRef = useRef(null);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleSelect = (e) => {
        e.stopPropagation();
        setShowModal(true);
    };

    const handleConfirm = () => {
        onSelect(idQuantio, "kellerhoff");
        window.open("https://www.kellerhoff.com.ar/", "_blank", "noopener");
        setShowModal(false);
    };

    const handleCancel = (e) => {
        e.stopPropagation();
        setShowModal(false);
        onSelect(idQuantio, "kellerhoff");
    };

    useEffect(() => {
        if (!showModal) return;
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setShowModal(false);
                onSelect(ean, "kellerhoff");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showModal, ean, onSelect]);

    return (
        <div className={clase} onClick={handleSelect} style={{ cursor: "pointer", position: "relative" }}>
            <div className="kellerhoff-label">
                Ir a la web
                <span className={`kellerhoff-check ${seleccionado ? "visible" : ""}`}>
                    ✔
                </span>
            </div>
            {showModal && (
                <div
                    ref={modalRef}
                    className="kellerhoff-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="kellerhoff-modal-text">Desea abrir la página de Kellerhoff?</div>
                    <button
                        className="kellerhoff-btn kellerhoff-btn-si"
                        onClick={handleConfirm}
                    >
                        Sí
                    </button>
                    <button
                        className="kellerhoff-btn kellerhoff-btn-no"
                        onClick={handleCancel}
                    >
                        No
                    </button>
                </div>
            )}
        </div>
    );
};

export default PreciosKellerhoff;
