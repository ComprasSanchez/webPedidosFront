// front/src/features/revisar/components/MotivoSelect.jsx
import React from "react";

const DEFAULT_OPCIONES = [
    { value: "", label: "— Seleccionar motivo —" },
    { value: "Stock Depo", label: "Stock Depósito" },
    { value: "Mejor precio", label: "Mejor precio" },
    { value: "Condición / Acuerdo", label: "Condición / Acuerdo" },
    { value: "Falta", label: "Falta" },
];

export default function MotivoSelect({
    value,
    disabled,
    proveedorActual,
    stockDepo = 0,
    hayAlgoPedible = false,
    opciones = DEFAULT_OPCIONES,
    onChange,
}) {
    return (
        <select
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled || value === "Falta"}
        >
            {opciones.map((op) => {
                const blockStockDepo = op.value === "Stock Depo" && (proveedorActual !== "deposito" || stockDepo <= 0);
                const blockFalta = op.value === "Falta" && hayAlgoPedible;
                const isBlocked = op.value === "" || blockStockDepo || blockFalta;

                return (
                    <option key={op.value} value={op.value} disabled={isBlocked}>
                        {op.label}
                    </option>
                );
            })}
        </select>
    );
}
