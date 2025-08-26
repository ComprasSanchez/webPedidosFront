// front/src/features/revisar/components/NoPedirToggle.jsx
import React from "react";
import { FaCheckSquare, FaSquare } from "react-icons/fa";

export default function NoPedirToggle({ pedir = true, onToggle }) {
    const color = pedir ? "#00bcd4" : "#888";

    return (
        <div
            onClick={onToggle}
            style={{ textAlign: "center", cursor: "pointer", fontSize: "1.3rem", color }}
            title={pedir ? "Marcar como NO pedir" : "Volver a pedir"}
        >
            {pedir ? <FaCheckSquare /> : <FaSquare />}
        </div>
    );
}
