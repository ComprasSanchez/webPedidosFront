import { useState, useEffect } from "react";
import Modal from "./Modal";
import { API_URL } from "../../config/api";

export default function ModalSeleccionSucursal({ isOpen, onSelect, onClose }) {
    const [sucursales, setSucursales] = useState([]);
    const [selected, setSelected] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetch(`${API_URL}/api/sucursales`)
                .then(res => res.json())
                .then(data => setSucursales(data))
                .catch(err => console.error("❌ Error cargando sucursales", err));
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (!selected) return;
        onSelect(selected);
    };

    return (
        <>
            {isOpen && (
                <Modal onClose={onClose}>
                    <h2>Seleccionar sucursal a reponer</h2>
                    <div style={{ marginBottom: "1rem" }}>
                        <select
                            value={selected}
                            onChange={e => setSelected(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "0.5rem",
                                marginBottom: "1rem",
                                fontSize: "1rem"
                            }}
                        >
                            <option value="">-- Elegir sucursal --</option>
                            {sucursales.map(s => (
                                <option key={s.codigo} value={s.codigo}>
                                    {s.codigo}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                        {onClose && (
                            <button
                                onClick={onClose}
                                style={{
                                    padding: "0.75rem 1.5rem",
                                    backgroundColor: "#6c757d",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "1rem"
                                }}
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={!selected}
                            style={{
                                padding: "0.75rem 1.5rem",
                                backgroundColor: selected ? "#007bff" : "#ccc",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: selected ? "pointer" : "not-allowed",
                                fontSize: "1rem"
                            }}
                        >
                            Confirmar
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}
