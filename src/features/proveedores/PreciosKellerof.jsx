import React, { useState, useRef, useEffect } from "react";

const PreciosKellerof = ({ ean, seleccionado, onSelect }) => {
    const [showModal, setShowModal] = useState(false);
    const modalRef = useRef(null);
    const clase = seleccionado ? "precio_celda activa" : "precio_celda";

    const handleSelect = (e) => {
        e.stopPropagation();
        setShowModal(true);
    };

    const handleConfirm = () => {
        onSelect(ean, "kellerof");
        window.open("https://www.kellerhoff.com.ar/", "_blank", "noopener");
        setShowModal(false);
    };

    const handleCancel = (e) => {
        e.stopPropagation();
        setShowModal(false);
        onSelect(ean, "kellerof"); // Selecciona aunque no abra la web
    };

    // Cerrar modal al hacer click fuera
    useEffect(() => {
        if (!showModal) return;
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setShowModal(false);
                onSelect(ean, "kellerof");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showModal, ean, onSelect]);

    return (
        <div className={clase} onClick={handleSelect} style={{ cursor: "pointer", position: "relative" }}>
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
            {showModal && (
                <div
                    ref={modalRef}
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        zIndex: 10,
                        background: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        padding: "10px 16px",
                        marginTop: 4,
                        minWidth: 180,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ marginBottom: 8 }}>Desea abrir la página de Kellerhoff?</div>
                    <button
                        onClick={handleConfirm}
                        style={{
                            marginRight: 8,
                            background: "#00bcd4",
                            color: "#fff",
                            border: "none",
                            borderRadius: 3,
                            padding: "4px 10px",
                            cursor: "pointer",
                        }}
                    >
                        Sí
                    </button>
                    <button
                        onClick={handleCancel}
                        style={{
                            background: "#eee",
                            color: "#333",
                            border: "none",
                            borderRadius: 3,
                            padding: "4px 10px",
                            cursor: "pointer",
                        }}
                    >
                        No
                    </button>
                </div>
            )}
        </div>
    );
};

export default PreciosKellerof;
