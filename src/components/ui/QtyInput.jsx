import { useState } from "react";

// Input numérico editable: mientras se escribe guarda un borrador y confirma
// al salir del campo o con Enter. Si el valor es inválido (vacío, 0, negativo) se revierte.
const QtyInput = ({ value, onCommit, min = 1, disabled = false }) => {
    const [draft, setDraft] = useState(null); // null = no se está editando

    const commit = () => {
        if (draft === null) return;
        const n = parseInt(draft, 10);
        if (Number.isFinite(n) && n >= min && n !== value) onCommit(n);
        setDraft(null);
    };

    return (
        <input
            className="qty__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={disabled}
            value={draft ?? String(value)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); }
            }}
            aria-label="Unidades"
        />
    );
};

export default QtyInput;
