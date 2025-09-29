import { useState, useEffect } from "react";
import Modal from "./Modal";
import { API_URL } from "../../config/api";
import "../../styles/modalSeleccionSucursal.scss";

export default function ModalSeleccionSucursal({ isOpen, onSelect, onClose }) {
    const [sucursales, setSucursales] = useState([]);
    const [selected, setSelected] = useState("");

    // Obtener la sucursal actualmente seleccionada
    const sucursalActual = sessionStorage.getItem("sucursalReponer") || "";

    useEffect(() => {
        if (isOpen) {
            fetch(`${API_URL}/api/sucursales`)
                .then(res => res.json())
                .then(data => {
                    // Las sucursales ya vienen ordenadas desde el backend
                    setSucursales(data);
                })
                .catch(err => console.error("❌ Error cargando sucursales", err));

            // Pre-seleccionar la sucursal actual cuando se abre el modal
            setSelected(sucursalActual);
        }
    }, [isOpen, sucursalActual]);

    const handleConfirm = () => {
        if (!selected) return;
        onSelect(selected);
    };

    const handleDesseleccionar = () => {
        onSelect(""); // Pasar string vacío para desseleccionar
    };

    return (
        <>
            {isOpen && (
                <Modal onClose={onClose}>
                    <div className="modal_seleccion_sucursal">
                        <h2 className="modal_titulo">Seleccionar sucursal a reponer</h2>

                        {sucursalActual && (
                            <div className="sucursal_actual">
                                <p><strong>Sucursal actual:</strong> {sucursalActual}</p>
                            </div>
                        )}

                        <div className="seleccion_container">
                            <label className="seleccion_label" htmlFor="sucursal-select">
                                Sucursal destino:
                            </label>
                            <select
                                id="sucursal-select"
                                className="seleccion_select"
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                            >
                                <option value="">-- Sin sucursal (modo carga masiva ZIP) --</option>
                                {sucursales.map(s => (
                                    <option key={s.codigo} value={s.codigo}>
                                        {s.nombre || s.codigo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="botones_container">
                            {onClose && (
                                <button
                                    type="button"
                                    className="boton_cancelar"
                                    onClick={onClose}
                                    aria-label="Cancelar selección"
                                >
                                    Cancelar
                                </button>
                            )}
                            {sucursalActual && (
                                <button
                                    type="button"
                                    className="boton_desseleccionar"
                                    onClick={handleDesseleccionar}
                                    aria-label="Desseleccionar sucursal para modo ZIP"
                                >
                                    Desseleccionar
                                </button>
                            )}
                            <button
                                type="button"
                                className="boton_confirmar"
                                onClick={handleConfirm}
                                disabled={selected === sucursalActual}
                                aria-label={selected ? "Confirmar selección" : "Seleccione una opción"}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
