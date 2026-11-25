// front/src/features/revisar/components/QtyControl.jsx
import React from "react";
import QtyInput from "../../../components/ui/QtyInput";

export default function QtyControl({ value = 1, disabled, min = 1, onChange }) {
    const dec = () => onChange?.(Math.max(min, (value || 1) - 1));
    const inc = () => onChange?.((value || 1) + 1);

    return (
        <div className="qty">
            <button disabled={disabled} className="qty__btn" onClick={dec}>−</button>
            <QtyInput value={value || 1} min={min} disabled={disabled} onCommit={(n) => onChange?.(n)} />
            <button disabled={disabled} className="qty__btn" onClick={inc}>+</button>
        </div>
    );
}
