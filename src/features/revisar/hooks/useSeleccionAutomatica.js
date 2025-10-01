// hooks/useSeleccionAutomatica.js
import { useEffect, useState, useRef, useMemo } from "react";
import { pickPorPrioridad } from "../logic/prioridad";
import { mejorProveedor, precioValido } from "../logic/mejorProveedor";


export function useSeleccionAutomatica({ carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock, sucursal }) {
    const [seleccion, setSeleccion] = useState({});
    const prevEansRef = useRef([]);
    const prevEansAutoAjustesRef = useRef([]);
    const reglasLoadedRef = useRef(false);
    const preciosLoadedRef = useRef(false);
    const zipProcessedRef = useRef(new Set()); // Para evitar re-procesar productos ZIP
    const manualSelectionRef = useRef(new Set()); // Rastrear selecciones manuales

    // Memorizar productos esenciales para selección automática (ignorar cambios de unidades y flags)
    const productosEsenciales = useMemo(() => {
        return carrito.filter(item =>
            (item.idQuantio || item.ean) && item.unidades > 0
        );
    }, [carrito.map(item =>
        `${item.idQuantio || 'null'}-${item.ean || 'null'}-${item.unidades > 0 ? '1' : '0'}-${item.desde_zip ? '1' : '0'}`
    ).join('|')]);

    // selección inicial - solo cuando se AGREGAN nuevos productos, no cuando se eliminan
    useEffect(() => {
        if (!carrito.length || !reglas) {
            return;
        }

        // Verificar que tengamos al menos algunos precios disponibles
        const hayPrecios = preciosMonroe?.length || preciosSuizo?.length || preciosCofarsur?.length || stockDisponible?.length;
        if (!hayPrecios) {
            return;
        }

        // Usar productos esenciales memorizados (ignora cambios en unidades específicas)
        const productosExistentes = productosEsenciales;

        // Crear firma estructural (solo IDs, ignorar unidades y flags)
        const firmaActual = productosExistentes.map(item => item.idQuantio || item.ean).sort().join(',');
        const firmaPrevia = prevEansRef.current.join(',');

        // Solo cambios estructurales (productos agregados/eliminados)
        const cambioEstructural = firmaActual !== firmaPrevia;

        // Identificar productos ZIP que no han sido procesados
        const productosZipNuevos = productosExistentes.filter(item =>
            (item.desde_zip === true || item.timestamp_zip) &&
            !zipProcessedRef.current.has(item.idQuantio || item.ean)
        );
        const hayProductosZipNuevos = productosZipNuevos.length > 0;
        const esInicialCarga = prevEansRef.current.length === 0;
        const reglasRecienCargadas = reglas && !reglasLoadedRef.current;
        const preciosRecienCargados = hayPrecios && !preciosLoadedRef.current;

        // Ejecutar si: es carga inicial, cambio estructural, recién llegaron las reglas/precios, o hay productos ZIP nuevos
        if (!esInicialCarga && !cambioEstructural && !reglasRecienCargadas && !preciosRecienCargados && !hayProductosZipNuevos) {
            console.log('⏭️ [SELECCION] Saltando selección automática - Sin cambios estructurales');
            return;
        }

        console.log('🔄 [SELECCION] Ejecutando selección automática - Cambio estructural detectado');

        // Marcar que las reglas y precios ya se cargaron
        reglasLoadedRef.current = true;
        preciosLoadedRef.current = true;

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito: stockDisponible };

        // Determinar qué productos procesar
        let productosParaProcesar;
        if (esInicialCarga) {
            productosParaProcesar = productosExistentes;
        } else {
            // Procesar productos nuevos + productos ZIP nuevos
            const idsActuales = productosExistentes.map(item => item.idQuantio || item.ean);
            const idsNuevos = idsActuales.filter(id => !prevEansRef.current.includes(id));
            const productosNuevos = productosExistentes.filter(item => idsNuevos.includes(item.idQuantio || item.ean));
            const todosLosPorProcesar = [...productosNuevos, ...productosZipNuevos];
            productosParaProcesar = todosLosPorProcesar.filter((item, index, arr) =>
                arr.findIndex(p => (p.idQuantio || p.ean) === (item.idQuantio || item.ean)) === index // eliminar duplicados
            );
        }

        // Solo modificar selección para productos nuevos, carga inicial, o productos ZIP nuevos
        const nuevaSeleccion = esInicialCarga ? {} : { ...seleccion };

        productosParaProcesar.forEach((item) => {
            // Usar EAN como clave cuando idQuantio es null (productos ZIP)
            const clave = item.idQuantio || item.ean;

            // Usar idQuantio para consultar el stock del depósito
            const stockDepoItem = getStock(item.idQuantio, stockDisponible, sucursal);

            if (typeof stockDepoItem === "number" && stockDepoItem > 0) {
                nuevaSeleccion[clave] = { proveedor: "deposito", motivo: "Stock Depo" };
                return;
            }

            const match = matchConvenio(item, reglas);

            if (match.aplica) {
                const elegido = pickPorPrioridad(item, match.prioridad, ctx);
                nuevaSeleccion[clave] = elegido
                    ? { proveedor: elegido, motivo: "Condición / Acuerdo" }
                    : { proveedor: "Falta", motivo: "Falta" };
                return;
            }

            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });
            nuevaSeleccion[clave] = ideal ? { proveedor: ideal, motivo: "Mejor precio" }
                : { proveedor: "Falta", motivo: "Falta" };
        });

        setSeleccion(nuevaSeleccion);

        // Marcar productos ZIP como procesados
        if (hayProductosZipNuevos) {
            productosZipNuevos.forEach(item => {
                zipProcessedRef.current.add(item.idQuantio || item.ean);
            });
        }

        // Actualizar la referencia con productos existentes
        prevEansRef.current = productosExistentes.map(item => item.idQuantio || item.ean).sort();
    }, [productosEsenciales, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock]);

    // auto-ajustes (depósito gana, motivo coherente, salir de "Falta" si aparece opción)
    // NOTA: Solo se ejecuta cuando cambian los EANs del carrito o precios/stock, NO cuando cambian las unidades
    useEffect(() => {
        // Usar productos esenciales memorizados (ignora cambios en cantidades específicas)
        const productosExistentes = productosEsenciales;

        // Calcular firma estructural actual y previa para auto-ajustes
        // Separar productos con/sin idQuantio para evitar inconsistencias
        const firmaActual = JSON.stringify({
            conQuantio: productosExistentes
                .filter(item => item.idQuantio)
                .map(item => ({
                    id: item.idQuantio,
                    ean: item.ean,
                    monroe: !!preciosMonroe[item.ean],
                    suizo: !!preciosSuizo[item.ean],
                    cofarsur: !!preciosCofarsur[item.ean],
                    stock: !!stockDisponible[item.ean]
                })).sort((a, b) => Number(a.id) - Number(b.id)),
            sinQuantio: productosExistentes
                .filter(item => !item.idQuantio && item.ean)
                .map(item => ({
                    ean: item.ean,
                    monroe: !!preciosMonroe[item.ean],
                    suizo: !!preciosSuizo[item.ean],
                    cofarsur: !!preciosCofarsur[item.ean],
                    stock: !!stockDisponible[item.ean]
                })).sort((a, b) => a.ean.localeCompare(b.ean))
        });
        const firmaPrevia = JSON.stringify(prevEansAutoAjustesRef.current || { conQuantio: [], sinQuantio: [] });
        const cambioEstructural = firmaActual !== firmaPrevia;

        // No actualizar la referencia aquí - se hace al final

        // Solo ejecutar si cambiaron los productos estructuralmente
        if (!cambioEstructural && productosExistentes.length > 0) {
            console.log('⏭️ [AUTO-AJUSTES] Saltando auto-ajustes - Sin cambios estructurales');
            return;
        }

        console.log('🔄 [AUTO-AJUSTES] Ejecutando auto-ajustes - Cambio estructural detectado');

        // Limpiar selecciones de productos eliminados
        let nueva = { ...seleccion };
        const idsActuales = productosExistentes.map(item => item.idQuantio || item.ean);

        // Eliminar selecciones de productos que ya no están en el carrito
        Object.keys(nueva).forEach(id => {
            if (!idsActuales.includes(id)) {
                delete nueva[id];
            }
        });

        if (!productosExistentes.length) {
            if (Object.keys(nueva).length > 0) {
                setSeleccion({});
            }
            return;
        }

        let cambios = false;

        productosExistentes.forEach((item) => {
            const clave = item.idQuantio || item.ean;

            // 🔒 No modificar selecciones marcadas como manuales
            if (manualSelectionRef.current.has(clave)) {
                return;
            }

            const sel = nueva[clave] || {};
            const prov = sel.proveedor;
            const motivo = sel.motivo;
            const stockDepo = getStock(item.ean, stockDisponible, sucursal);
            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });

            if (stockDepo > 0 && prov !== "deposito") {
                nueva[clave] = { proveedor: "deposito", motivo: "Stock Depo" };
                cambios = true;
                return;
            }
            if (prov === "deposito" && stockDepo > 0 && motivo !== "Stock Depo") {
                nueva[clave].motivo = "Stock Depo";
                cambios = true;
            }
            if (prov === ideal && prov !== "deposito" && motivo !== "Mejor precio") {
                nueva[clave].motivo = "Mejor precio";
                cambios = true;
            }
            if (motivo === "Falta" && (stockDepo > 0 || ideal)) {
                nueva[clave] = stockDepo > 0
                    ? { proveedor: "deposito", motivo: "Stock Depo" }
                    : { proveedor: ideal, motivo: "Mejor precio" };
                cambios = true;
            }
        });

        // Verificar si hubo cambios en la limpieza o en los ajustes
        const huboCambiosEnLimpieza = Object.keys(seleccion).length !== Object.keys(nueva).length;

        if (cambios || huboCambiosEnLimpieza) {
            setSeleccion(nueva);
        }

        // Actualizar la referencia al final para la próxima comparación
        prevEansAutoAjustesRef.current = {
            conQuantio: productosExistentes
                .filter(item => item.idQuantio)
                .map(item => ({
                    id: item.idQuantio,
                    ean: item.ean,
                    monroe: !!preciosMonroe[item.ean],
                    suizo: !!preciosSuizo[item.ean],
                    cofarsur: !!preciosCofarsur[item.ean],
                    stock: !!stockDisponible[item.ean]
                })).sort((a, b) => Number(a.id) - Number(b.id)),
            sinQuantio: productosExistentes
                .filter(item => !item.idQuantio && item.ean)
                .map(item => ({
                    ean: item.ean,
                    monroe: !!preciosMonroe[item.ean],
                    suizo: !!preciosSuizo[item.ean],
                    cofarsur: !!preciosCofarsur[item.ean],
                    stock: !!stockDisponible[item.ean]
                })).sort((a, b) => a.ean.localeCompare(b.ean))
        };
    }, [productosEsenciales, stockDisponible, preciosMonroe, preciosSuizo, preciosCofarsur]); // eslint-disable-line

    // Wrapper para marcar selecciones como manuales
    const setSeleccionManual = (updater) => {
        setSeleccion(prev => {
            const newSelection = typeof updater === 'function' ? updater(prev) : updater;

            // Marcar como manual cualquier clave que cambió (en el siguiente tick)
            setTimeout(() => {
                Object.keys(newSelection).forEach(key => {
                    if (!prev[key] ||
                        prev[key].proveedor !== newSelection[key]?.proveedor ||
                        prev[key].motivo !== newSelection[key]?.motivo) {
                        manualSelectionRef.current.add(key);
                    }
                });
            }, 0);

            return newSelection;
        });
    };

    return { seleccion, setSeleccion: setSeleccionManual };
}