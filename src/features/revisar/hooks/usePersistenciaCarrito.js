// hooks/usePersistenciaCarrito.js
import { useEffect, useState } from "react";

export function usePersistenciaCarrito({ carrito, usuario, replaceCarrito }) {
    const [noPedirMap, setNoPedirMap] = useState({});

    useEffect(() => {
        const initial = {};
        carrito.forEach(it => {
            const key = it.idQuantio || it.ean;
            if (it?.noPedir) initial[key] = true;
        });
        setNoPedirMap(initial);
    }, [carrito]);

    const toggleNoPedir = (id, checked) => {
        setNoPedirMap(prev => {
            const next = { ...prev };
            if (checked) next[id] = true; else delete next[id];
            // 🔹 Actualiza el carrito global → el Context hará el PUT con debounce
            const items = carrito.map(it => {
                const key = it.idQuantio || it.ean;
                return { ...it, noPedir: !!next[key] };
            });
            replaceCarrito(items);
            return next;
        });
    };

    return { noPedirMap, toggleNoPedir };
}
