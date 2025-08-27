// front/src/features/revisar/components/MotivoSelect.jsx
import React from "react";

const DEFAULT_OPCIONES = [
    { value: "", label: "Seleccionar motivo" },
    { value: "Falta", label: "Falta" },
    { value: "Stock Depo", label: "Stock Depo" },
    { value: "Mejor precio", label: "Mejor precio" },
    { value: "Llega más rápido", label: "Llega más rápido" },
    { value: "Condición / Acuerdo", label: "Condición / Acuerdo" },
    { value: "Sin troquel", label: "Sin troquel" },
    { value: "Sin stock drog principal", label: "Sin stock drog principal" },
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
