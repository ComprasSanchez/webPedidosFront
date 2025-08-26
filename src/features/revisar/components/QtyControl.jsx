// front/src/features/revisar/components/QtyControl.jsx
import React from "react";

export default function QtyControl({ value = 1, disabled, min = 1, onChange }) {
    const dec = () => onChange?.(Math.max(min, (value || 1) - 1));
    const inc = () => onChange?.((value || 1) + 1);

    return (
        <div className="qty">
            <button disabled={disabled} className="qty__btn" onClick={dec}>−</button>
            <span className="qty__num">{value || 1}</span>
            <button disabled={disabled} className="qty__btn" onClick={inc}>+</button>
        </div>
    );
}
