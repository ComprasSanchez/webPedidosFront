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
        // Detectar solo productos NUEVOS (que no estaban en la consulta anterior)
        const eansActuales = carritoEsencial.map(item => item.ean).sort();
        const eansPrevios = eanListRef.current || [];
        const eansNuevos = eansActuales.filter(ean => !eansPrevios.includes(ean));
        const eansEliminados = eansPrevios.filter(ean => !eansActuales.includes(ean));

        // Detectar productos del ZIP que necesitan consulta forzada
        const productosZipNuevos = carritoEsencial.filter(item =>
            item.desde_zip === true && eansNuevos.includes(item.ean)
        );
        const hayProductosZipNuevos = productosZipNuevos.length > 0;

        // Productos ZIP nuevos detectados si los hay

        // Limpiar precios de productos eliminados (sin hacer consultas)
        if (eansEliminados.length > 0) {
            // Limpiar precios de productos eliminados

            setPM(prev => prev.filter(item => !eansEliminados.includes(item.ean)));
            setPS(prev => prev.filter(item => !eansEliminados.includes(item.ean)));
            setPC(prev => prev.filter(item => !eansEliminados.includes(item.ean)));
            setSD(prev => prev.filter(item => !eansEliminados.includes(item.ean)));
        }

        // Productos nuevos identificados para consulta

        if (!sucursal || (eansNuevos.length === 0 && !hayProductosZipNuevos)) {
            // No hay productos nuevos para consultar
            // Actualizar referencia aunque no consultemos
            eanListRef.current = eansActuales;
            return;
        }

        // Consultando precios para productos nuevos

        (async () => {
            setLoading(true);

            // Crear lista de productos del carrito original solo para los NUEVOS (necesita unidades reales)
            const productosParaConsulta = carrito.filter(item =>
                item.ean && item.unidades > 0 && eansNuevos.includes(item.ean)
            );

            if (soloDeposito) {
                // 🔥 MODO SOLO DEPÓSITO: No consultar droguerías para ahorrar créditos
                console.log("🏪 Modo Solo Depósito activado - consultando solo stock para productos nuevos");

                const stockNuevo = await getStockDisponible(productosParaConsulta, sucursal, { fetch: authFetch, headers: authHeaders });

                // Combinar con stock existente (mantener datos previos)
                setSD(prev => {
                    const combined = [...prev];
                    stockNuevo.forEach(nuevoItem => {
                        const existingIndex = combined.findIndex(item => item.ean === nuevoItem.ean);
                        if (existingIndex >= 0) {
                            combined[existingIndex] = nuevoItem;
                        } else {
                            combined.push(nuevoItem);
                        }
                    });
                    return combined;
                });
            } else {
                // 🌐 MODO NORMAL: Consultar todas las droguerías solo para productos nuevos
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

                // Combinar nuevos precios con existentes (evitar duplicados)
                setPM(prev => {
                    const combined = [...prev];
                    m.forEach(nuevoItem => {
                        const existingIndex = combined.findIndex(item => item.ean === nuevoItem.ean);
                        if (existingIndex >= 0) {
                            combined[existingIndex] = nuevoItem;
                        } else {
                            combined.push(nuevoItem);
                        }
                    });
                    return combined;
                });
                setPS(prev => {
                    const combined = [...prev];
                    s.forEach(nuevoItem => {
                        const existingIndex = combined.findIndex(item => item.ean === nuevoItem.ean);
                        if (existingIndex >= 0) {
                            combined[existingIndex] = nuevoItem;
                        } else {
                            combined.push(nuevoItem);
                        }
                    });
                    return combined;
                });
                setPC(prev => {
                    const combined = [...prev];
                    c.forEach(nuevoItem => {
                        const existingIndex = combined.findIndex(item => item.ean === nuevoItem.ean);
                        if (existingIndex >= 0) {
                            combined[existingIndex] = nuevoItem;
                        } else {
                            combined.push(nuevoItem);
                        }
                    });
                    return combined;
                });
                setSD(prev => {
                    const combined = [...prev];
                    d.forEach(nuevoItem => {
                        const existingIndex = combined.findIndex(item => item.ean === nuevoItem.ean);
                        if (existingIndex >= 0) {
                            combined[existingIndex] = nuevoItem;
                        } else {
                            combined.push(nuevoItem);
                        }
                    });
                    return combined;
                });
            }

            // Actualizar referencia con los EANs actuales
            eanListRef.current = eansActuales;
            setLoading(false);

            // Limpiar flags de ZIP después de la consulta
            // Consulta completada
        })();
    }, [carritoEsencial, sucursal, authFetch, authHeaders, usuario?.rol, soloDeposito]);

    return { preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, loading };
}
