// hooks/usePersistenciaCarrito.js
import { useEffect, useState } from "react";
import { useCarrito } from "../../../context/CarritoContext";

export function usePersistenciaCarrito({ carrito, usuario, replaceCarrito }) {
    const { obtenerCarritoId } = useCarrito();
    const [noPedirMap, setNoPedirMap] = useState({});

    useEffect(() => {
        // 🆔 Crear mapa limpio con carritoId
        const initial = {};
        const validIds = new Set();

        carrito.forEach(it => {
            const key = obtenerCarritoId(it);
            validIds.add(key);
            if (it?.noPedir) initial[key] = true;
        });

        // Limpiar el mapa anterior manteniendo solo IDs válidos
        setNoPedirMap(prev => {
            const cleaned = {};
            Object.keys(prev).forEach(id => {
                if (validIds.has(id)) {
                    cleaned[id] = prev[id];
                }
            });
            return { ...cleaned, ...initial };
        });
    }, [carrito, obtenerCarritoId]);

    const toggleNoPedir = (carritoId, checked) => {
        setNoPedirMap(prev => {
            const next = { ...prev };
            if (checked) next[carritoId] = true; else delete next[carritoId];
            // 🔹 Actualiza el carrito global → el Context hará el PUT con debounce
            const items = carrito.map(it => {
                const key = obtenerCarritoId(it);
                return { ...it, noPedir: !!next[key] };
            });
            replaceCarrito(items);
            return next;
        });
    };

    return { noPedirMap, toggleNoPedir };
}
