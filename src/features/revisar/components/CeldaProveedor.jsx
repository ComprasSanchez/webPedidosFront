// front/src/features/revisar/components/CeldaProveedor.jsx
import React from "react";

export default function CeldaProveedor({
    activo = false,
    disabled = false,
    valorMostrado,
    onSelect,
}) {
    return (
        <td className={activo ? "celda_activa" : ""}>
            <div
                className="precio_celda"
                onClick={() => !disabled && onSelect?.()}
                style={{
                    fontWeight: "bold",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                {valorMostrado}
                <span
                    style={{
                        color: "#00bcd4",
                        marginLeft: "5px",
                        visibility: activo ? "visible" : "hidden",
                    }}
                >
                    ✔
                </span>
            </div>
        </td>
    );
}
