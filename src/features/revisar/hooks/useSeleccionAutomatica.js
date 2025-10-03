// hooks/useSeleccionAutomatica.js
import { useEffect, useState, useRef, useMemo } from "react";
import { pickPorPrioridad } from "../logic/prioridad";
import { mejorProveedor, precioValido } from "../logic/mejorProveedor";
import { useCarrito } from "../../../context/CarritoContext";


export function useSeleccionAutomatica({ carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock, sucursal }) {
    const { obtenerCarritoId } = useCarrito();
    const [seleccion, setSeleccion] = useState({});
    const prevEansRef = useRef([]);
    const prevEansAutoAjustesRef = useRef([]);
    const reglasLoadedRef = useRef(false);
    const preciosLoadedRef = useRef(false);
    const zipProcessedRef = useRef(new Set()); // Para evitar re-procesar productos ZIP
    const manualSelectionRef = useRef(new Set()); // Rastrear selecciones manuales

    // Wrapper para marcar selecciones como manuales - definido temprano para usarlo en useEffects
    const setSeleccionManual = (updater) => {
        setSeleccion(prev => {
            const newSelection = typeof updater === 'function' ? updater(prev) : updater;

            // Marcar como manual cualquier clave que cambió (en el siguiente tick)
            setTimeout(() => {
                const cambiosRegistrados = [];
                Object.keys(newSelection).forEach(key => {
                    if (!prev[key] ||
                        prev[key].proveedor !== newSelection[key]?.proveedor ||
                        prev[key].motivo !== newSelection[key]?.motivo) {
                        manualSelectionRef.current.add(key);
                        cambiosRegistrados.push(key);
                    }
                });

                // Registrar cambios manuales (debug removido en producción)
            }, 0);

            return newSelection;
        });
    };

    // Memorizar productos esenciales para selección automática (ignorar cambios de unidades y flags)
    const productosEsenciales = useMemo(() => {
        const productos = carrito.filter(item =>
            (item.idQuantio || item.ean) && item.unidades > 0
        );

        // Validación de productos (debug removido) return productos;
    }, [carrito.map(item =>
        `${obtenerCarritoId(item)}-${item.unidades > 0 ? '1' : '0'}-${item.desde_zip ? '1' : '0'}`
    ).join('|'), obtenerCarritoId]);

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

        // Usar productos esenciales memorizados

        // 🆔 Crear firma estructural usando carritoId
        const firmaActual = productosEsenciales.map(item => obtenerCarritoId(item)).sort().join(',');
        const firmaPrevia = prevEansRef.current.join(',');

        // Solo cambios estructurales (productos agregados/eliminados)
        const cambioEstructural = firmaActual !== firmaPrevia;

        // 🆔 Identificar productos ZIP que no han sido procesados
        const productosZipNuevos = productosEsenciales.filter(item =>
            (item.desde_zip === true || item.timestamp_zip) &&
            !zipProcessedRef.current.has(obtenerCarritoId(item))
        );
        const hayProductosZipNuevos = productosZipNuevos.length > 0;
        const esInicialCarga = prevEansRef.current.length === 0;
        const reglasRecienCargadas = reglas && !reglasLoadedRef.current;
        const preciosRecienCargados = hayPrecios && !preciosLoadedRef.current;

        // Ejecutar si: es carga inicial, cambio estructural, recién llegaron las reglas/precios, o hay productos ZIP nuevos
        if (!esInicialCarga && !cambioEstructural && !reglasRecienCargadas && !preciosRecienCargados && !hayProductosZipNuevos) {
            return;
        }

        // Marcar que las reglas y precios ya se cargaron
        reglasLoadedRef.current = true;
        preciosLoadedRef.current = true;

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito: stockDisponible };

        // Determinar qué productos procesar
        let productosParaProcesar;
        if (esInicialCarga) {
            productosParaProcesar = productosEsenciales;
        } else {
            // 🆔 Procesar productos nuevos + productos ZIP nuevos usando carritoId
            const idsActuales = productosEsenciales.map(item => obtenerCarritoId(item));
            const idsNuevos = idsActuales.filter(id => !prevEansRef.current.includes(id));
            const productosNuevos = productosEsenciales.filter(item => idsNuevos.includes(obtenerCarritoId(item)));
            const todosLosPorProcesar = [...productosNuevos, ...productosZipNuevos];
            productosParaProcesar = todosLosPorProcesar.filter((item, index, arr) =>
                arr.findIndex(p => obtenerCarritoId(p) === obtenerCarritoId(item)) === index // eliminar duplicados
            );
        }

        // Solo modificar selección para productos nuevos, carga inicial, o productos ZIP nuevos
        const nuevaSeleccion = esInicialCarga ? {} : { ...seleccion };

        productosParaProcesar.forEach((item) => {
            // 🆔 Usar carritoId como clave única
            const clave = obtenerCarritoId(item);

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

        // 🆔 Marcar productos ZIP como procesados usando carritoId
        if (hayProductosZipNuevos) {
            productosZipNuevos.forEach(item => {
                zipProcessedRef.current.add(obtenerCarritoId(item));
            });
        }

        // 🆔 Actualizar la referencia con carritoId
        prevEansRef.current = productosEsenciales.map(item => obtenerCarritoId(item)).sort();
    }, [productosEsenciales, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock, obtenerCarritoId]);

    // auto-ajustes (depósito gana, motivo coherente, salir de "Falta" si aparece opción)
    // NOTA: Solo se ejecuta cuando cambian los EANs del carrito o precios/stock, NO cuando cambian las unidades
    useEffect(() => {
        // Auto-ajustes ejecutándose

        // 🆔 Calcular firma estructural actual usando carritoId
        const firmaActual = JSON.stringify(
            productosEsenciales.map(item => ({
                carritoId: obtenerCarritoId(item),
                ean: item.ean,
                monroe: !!preciosMonroe[item.ean],
                suizo: !!preciosSuizo[item.ean],
                cofarsur: !!preciosCofarsur[item.ean],
                stock: !!stockDisponible[item.ean]
            })).sort((a, b) => a.carritoId.localeCompare(b.carritoId))
        );
        const firmaPrevia = JSON.stringify(prevEansAutoAjustesRef.current || []);
        const cambioEstructural = firmaActual !== firmaPrevia;

        // No actualizar la referencia aquí - se hace al final

        // Solo ejecutar si cambiaron los productos estructuralmente
        if (!cambioEstructural && productosEsenciales.length > 0) {
            return;
        }

        // 🆔 Limpiar selecciones de productos eliminados usando carritoId
        let nueva = { ...seleccion };
        const idsActuales = productosEsenciales.map(item => obtenerCarritoId(item));

        // 🆔 Eliminar selecciones de productos que ya no están en el carrito
        const productosEliminados = [];
        Object.keys(nueva).forEach(id => {
            if (!idsActuales.includes(id)) {
                productosEliminados.push(id);
                delete nueva[id];
                // TAMBIÉN limpiar del tracking de selecciones manuales
                manualSelectionRef.current.delete(id);
            }
        });

        // Limpieza completada - productos eliminados del carrito

        if (!productosEsenciales.length) {
            if (Object.keys(nueva).length > 0) {
                setSeleccion({});
            }
            // Limpiar también el tracking de selecciones manuales cuando no hay productos
            manualSelectionRef.current.clear();
            return;
        }

        let cambios = false;

        productosEsenciales.forEach((item) => {
            const clave = obtenerCarritoId(item);

            // 🔒 No modificar selecciones marcadas como manuales
            if (manualSelectionRef.current.has(clave)) {
                // Producto protegido por selección manual
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
            // USAR setSeleccion directamente pero SIN marcar como manual las selecciones automáticas
            // El problema era que perdíamos las selecciones manuales, pero ahora las protegemos
            // en el forEach anterior con manualSelectionRef.current.has(clave)
            setSeleccion(nueva);
        }

        // 🆔 Actualizar la referencia al final usando carritoId
        prevEansAutoAjustesRef.current = productosEsenciales.map(item => ({
            carritoId: obtenerCarritoId(item),
            ean: item.ean,
            monroe: !!preciosMonroe[item.ean],
            suizo: !!preciosSuizo[item.ean],
            cofarsur: !!preciosCofarsur[item.ean],
            stock: !!stockDisponible[item.ean]
        })).sort((a, b) => a.carritoId.localeCompare(b.carritoId));
    }, [productosEsenciales, stockDisponible, preciosMonroe, preciosSuizo, preciosCofarsur, obtenerCarritoId]); // eslint-disable-line

    return { seleccion, setSeleccion: setSeleccionManual };
}