// hooks/usePreciosYStock.js
import { useEffect, useState, useRef } from "react";
import { getPreciosMonroe, getPreciosSuizo, getPreciosCofarsur, getStockDeposito } from "../../../services/droguerias";

export function usePreciosYStock({ carrito, sucursal, authFetch, authHeaders }) {
    const [preciosMonroe, setPM] = useState([]);
    const [preciosSuizo, setPS] = useState([]);
    const [preciosCofarsur, setPC] = useState([]);
    const [stockDeposito, setSD] = useState([]);
    const [loading, setLoading] = useState(false);
    const eanListRef = useRef([]);

    useEffect(() => {
        const eans = carrito.map(i => i.ean).sort();
        const prev = eanListRef.current.sort();
        const hayNuevo = eans.some(e => !prev.includes(e));

        if (!carrito.length || !sucursal || !hayNuevo) return;

        (async () => {
            setLoading(true);
            const [m, s, c, d] = await Promise.all([
                getPreciosMonroe(carrito, sucursal, { fetch: authFetch, headers: authHeaders }),
                getPreciosSuizo(carrito, sucursal, { fetch: authFetch, headers: authHeaders }),
                getPreciosCofarsur(carrito, sucursal, { fetch: authFetch, headers: authHeaders }),
                getStockDeposito(carrito, sucursal),
            ]);
            setPM(m); setPS(s); setPC(c); setSD(d);
            eanListRef.current = eans;
            setLoading(false);
        })();
    }, [carrito, sucursal, authFetch, authHeaders]);

    return { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, loading };
}
