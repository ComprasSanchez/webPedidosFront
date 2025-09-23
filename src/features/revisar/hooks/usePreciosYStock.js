// hooks/usePreciosYStock.js
import { useEffect, useState, useRef } from "react";
import { getPreciosMonroe, getPreciosSuizo, getPreciosCofarsur, getStockDisponible } from "../../../services/droguerias";

export function usePreciosYStock({ carrito, sucursal, authFetch, authHeaders, usuario }) {
    const [preciosMonroe, setPM] = useState([]);
    const [preciosSuizo, setPS] = useState([]);
    const [preciosCofarsur, setPC] = useState([]);
    const [stockDisponible, setSD] = useState([]);
    const [loading, setLoading] = useState(false);
    const eanListRef = useRef([]);

    useEffect(() => {
        const eans = carrito.map(i => i.ean).sort();
        const prev = eanListRef.current.sort();
        const hayNuevo = eans.some(e => !prev.includes(e));

        if (!carrito.length || !sucursal || !hayNuevo) return;

        (async () => {
            setLoading(true);

            // Agregar información del rol del usuario para Cofarsur
            const headersConRol = {
                ...authHeaders,
                'x-user-rol': usuario?.rol || 'sucursal'
            };

            const [m, s, c, d] = await Promise.all([
                getPreciosMonroe(carrito, sucursal, { fetch: authFetch, headers: authHeaders }),
                getPreciosSuizo(carrito, sucursal, { fetch: authFetch, headers: authHeaders }),
                getPreciosCofarsur(carrito, sucursal, { fetch: authFetch, headers: headersConRol }),
                getStockDisponible(carrito, sucursal, { fetch: authFetch, headers: authHeaders }),
            ]);
            setPM(m); setPS(s); setPC(c); setSD(d);
            eanListRef.current = eans;
            setLoading(false);
        })();
    }, [carrito, sucursal, authFetch, authHeaders, usuario?.rol]);

    return { preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, loading };
}
