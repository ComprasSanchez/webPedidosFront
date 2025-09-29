// hooks/usePreciosYStock.js
import { useEffect, useState, useRef } from "react";
import { getPreciosMonroe, getPreciosSuizo, getPreciosCofarsur, getStockDisponible } from "../../../services/droguerias";

export function usePreciosYStock({ carrito, sucursal, authFetch, authHeaders, usuario, soloDeposito = false }) {
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

        // Detectar productos del ZIP que necesitan consulta forzada
        const hayProductosZip = carrito.some(item => item.desde_zip === true);

        if (hayProductosZip) {
            console.log('🔍 Detectados productos del ZIP, forzando consulta de precios y stock');
        }

        if (!carrito.length || !sucursal || (!hayNuevo && !hayProductosZip)) return;

        (async () => {
            setLoading(true);

            if (soloDeposito) {
                // 🔥 MODO SOLO DEPÓSITO: No consultar droguerías para ahorrar créditos
                console.log("🏪 Modo Solo Depósito activado - saltando consultas a droguerías");

                const stockDisponible = await getStockDisponible(carrito, sucursal, { fetch: authFetch, headers: authHeaders });

                // Limpiar precios de droguerías y setear solo stock
                setPM([]);
                setPS([]);
                setPC([]);
                setSD(stockDisponible);
            } else {
                // 🌐 MODO NORMAL: Consultar todas las droguerías
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
            }

            eanListRef.current = eans;
            setLoading(false);

            // Limpiar flags de ZIP después de la consulta (opcional, para optimización futura)
            if (hayProductosZip) {
                console.log('✅ Consulta de productos ZIP completada');
            }
        })();
    }, [carrito, sucursal, authFetch, authHeaders, usuario?.rol, soloDeposito]);

    return { preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, loading };
}
