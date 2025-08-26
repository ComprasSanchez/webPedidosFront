// front/src/features/revisar/components/SinProductos.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function SinProductos() {
    const navigate = useNavigate();
    return (
        <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "60vh"
        }}>
            <div className="sin-productos">
                <p>No hay productos en el carrito.</p>
                <button className="boton-volver" onClick={() => navigate("/buscador")}>
                    Volver al buscador
                </button>
            </div>
        </div >
    );
}
