// hooks/usePreciosYStock.js
import { useEffect, useState, useRef, useMemo } from "react";
import { getPreciosMonroe, getPreciosSuizo, getPreciosCofarsur, getStockDisponible } from "../../../services/droguerias";

export function usePreciosYStock({ carrito, sucursal, authFetch, authHeaders, usuario, soloDeposito = false }) {
    const [preciosMonroe, setPM] = useState([]);
    const [preciosSuizo, setPS] = useState([]);
    const [preciosCofarsur, setPC] = useState([]);
    const [stockDisponible, setSD] = useState([]);
    const [loading, setLoading] = useState(false);
    const eanListRef = useRef([]);

    // Memorizar solo los datos esenciales del carrito (ignorando flags como noPedir y cantidad específica de unidades)
    const carritoEsencial = useMemo(() => {
        return carrito.map(item => ({
            ean: item.ean,
            existe: item.unidades > 0, // Solo importa si existe, no cuántas unidades
            desde_zip: item.desde_zip, // Solo este flag es relevante para precios
            idQuantio: item.idQuantio
        })).filter(item => item.ean && item.existe);
    }, [carrito.map(item => `${item.ean}-${item.unidades > 0 ? '1' : '0'}-${item.desde_zip ? '1' : '0'}-${item.idQuantio || 'null'}`).join('|')]);

    useEffect(() => {
        // Usar el carrito esencial ya filtrado y memorizado
        const productosExistentes = carritoEsencial;

        // Crear firma estable basada SOLO en EANs esenciales
        const eansEsenciales = productosExistentes.map(item => item.ean).sort();
        const firmaActual = eansEsenciales.join(',');
        const firmaPrevia = eanListRef.current.join(',');

        // Solo ejecutar si cambia la firma de EANs (productos agregados/eliminados realmente)
        const cambioEstructural = firmaActual !== firmaPrevia;

        // Detectar productos del ZIP que necesitan consulta forzada
        const hayProductosZip = productosExistentes.some(item => item.desde_zip === true);

        if (hayProductosZip) {
            console.log('🔍 Detectados productos del ZIP, forzando consulta de precios y stock');
        }

        // Solo ejecutar si: hay productos, hay sucursal, Y (cambió estructura O hay productos ZIP)
        if (!productosExistentes.length || !sucursal || (!cambioEstructural && !hayProductosZip)) {
            console.log('⏭️ [PRECIOS] Saltando consulta - Sin cambios estructurales');
            return;
        }

        console.log('🔄 [PRECIOS] Ejecutando consulta - Cambio estructural detectado');

        (async () => {
            setLoading(true);

            // Crear lista de productos del carrito original para las consultas (necesita unidades reales)
            const productosParaConsulta = carrito.filter(item => item.ean && item.unidades > 0);

            if (soloDeposito) {
                // 🔥 MODO SOLO DEPÓSITO: No consultar droguerías para ahorrar créditos
                console.log("🏪 Modo Solo Depósito activado - saltando consultas a droguerías");

                const stockDisponible = await getStockDisponible(productosParaConsulta, sucursal, { fetch: authFetch, headers: authHeaders });

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
                    getPreciosMonroe(productosParaConsulta, sucursal, { fetch: authFetch, headers: authHeaders }),
                    getPreciosSuizo(productosParaConsulta, sucursal, { fetch: authFetch, headers: authHeaders }),
                    getPreciosCofarsur(productosParaConsulta, sucursal, { fetch: authFetch, headers: headersConRol }),
                    getStockDisponible(productosParaConsulta, sucursal, { fetch: authFetch, headers: authHeaders }),
                ]);
                setPM(m); setPS(s); setPC(c); setSD(d);
            }

            // Actualizar referencia con la nueva firma estable
            eanListRef.current = eansEsenciales;
            setLoading(false);

            // Limpiar flags de ZIP después de la consulta (opcional, para optimización futura)
            if (hayProductosZip) {
                console.log('✅ Consulta de productos ZIP completada');
            }
        })();
    }, [carritoEsencial, sucursal, authFetch, authHeaders, usuario?.rol, soloDeposito]);

    return { preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, loading };
}
