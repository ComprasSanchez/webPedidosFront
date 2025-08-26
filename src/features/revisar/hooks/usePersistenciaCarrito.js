// hooks/usePersistenciaCarrito.js
import { useEffect, useState } from "react";

export function usePersistenciaCarrito({ carrito, usuario, replaceCarrito }) {
    const [noPedirMap, setNoPedirMap] = useState({});

    useEffect(() => {
        const initial = {};
        carrito.forEach(it => { if (it?.noPedir) initial[it.ean] = true; });
        setNoPedirMap(initial);
    }, [carrito]);

    const toggleNoPedir = (ean, checked) => {
        setNoPedirMap(prev => {
            const next = { ...prev };
            if (checked) next[ean] = true; else delete next[ean];
            // 🔹 Actualiza el carrito global → el Context hará el PUT con debounce
            const items = carrito.map(it => ({ ...it, noPedir: !!next[it.ean] }));
            replaceCarrito(items);
            return next;
        });
    };

    return { noPedirMap, toggleNoPedir };
}
