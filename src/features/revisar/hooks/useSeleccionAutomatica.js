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

                // 🔍 LOG para debugging selecciones manuales
                if (cambiosRegistrados.length > 0) {
                    console.log('✋ MARCADO COMO MANUAL:', cambiosRegistrados);
                    console.log('📝 TOTAL MANUALES:', Array.from(manualSelectionRef.current));

                    // Mostrar qué tipo de productos fueron marcados como manuales
                    cambiosRegistrados.forEach(key => {
                        const producto = carrito.find(p => String(p.idQuantio || p.ean) === String(key));
                        if (producto) {
                            console.log(`  ${key}: ${producto.descripcion || producto.nombre} ${!producto.idQuantio ? '(TXT)' : '(ID)'}`);
                        }
                    });
                }
            }, 0);

            return newSelection;
        });
    };

    // Memorizar productos esenciales para selección automática (ignorar cambios de unidades y flags)
    const productosEsenciales = useMemo(() => {
        const productos = carrito.filter(item =>
            (item.idQuantio || item.ean) && item.unidades > 0
        );

        // 🔍 LOG para debugging productos TXT vs manuales y TIPOS DE DATOS
        const productosTxt = productos.filter(p => !p.idQuantio && p.ean);
        const productosConId = productos.filter(p => p.idQuantio);

        if (productosTxt.length > 0) {
            console.log('📋 PRODUCTOS TXT (sin idQuantio):', productosTxt.length);
            console.log('📝 PRIMEROS 3 TXT:', productosTxt.slice(0, 3).map(p => ({
                ean: p.ean,
                descripcion: p.descripcion || p.nombre,
                origen: p.origen,
                desde_zip: p.desde_zip,
                timestamp_zip: p.timestamp_zip
            })));
        }

        if (productosConId.length > 0) {
            console.log('🆔 PRODUCTOS CON ID:', productosConId.length);
            console.log('🔍 TIPOS DE idQuantio:', productosConId.slice(0, 3).map(p => ({
                idQuantio: p.idQuantio,
                tipo: typeof p.idQuantio,
                esString: typeof p.idQuantio === 'string',
                esNumber: typeof p.idQuantio === 'number'
            })));
        } return productos;
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

        // Usar productos esenciales memorizados

        // Crear firma estructural (solo IDs, ignorar unidades y flags) - SIEMPRE STRINGS
        const firmaActual = productosEsenciales.map(item => String(item.idQuantio || item.ean)).sort().join(',');
        const firmaPrevia = prevEansRef.current.join(',');

        // Solo cambios estructurales (productos agregados/eliminados)
        const cambioEstructural = firmaActual !== firmaPrevia;

        // Identificar productos ZIP que no han sido procesados
        const productosZipNuevos = productosEsenciales.filter(item =>
            (item.desde_zip === true || item.timestamp_zip) &&
            !zipProcessedRef.current.has(String(item.idQuantio || item.ean))
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
            // Procesar productos nuevos + productos ZIP nuevos - SIEMPRE STRINGS
            const idsActuales = productosEsenciales.map(item => String(item.idQuantio || item.ean));
            const idsNuevos = idsActuales.filter(id => !prevEansRef.current.includes(id));
            const productosNuevos = productosEsenciales.filter(item => idsNuevos.includes(String(item.idQuantio || item.ean)));
            const todosLosPorProcesar = [...productosNuevos, ...productosZipNuevos];
            productosParaProcesar = todosLosPorProcesar.filter((item, index, arr) =>
                arr.findIndex(p => String(p.idQuantio || p.ean) === String(item.idQuantio || item.ean)) === index // eliminar duplicados
            );
        }

        // Solo modificar selección para productos nuevos, carga inicial, o productos ZIP nuevos
        const nuevaSeleccion = esInicialCarga ? {} : { ...seleccion };

        productosParaProcesar.forEach((item) => {
            // Usar EAN como clave cuando idQuantio es null (productos ZIP) - SIEMPRE STRING
            const clave = String(item.idQuantio || item.ean);

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

        // Marcar productos ZIP como procesados - SIEMPRE STRINGS
        if (hayProductosZipNuevos) {
            productosZipNuevos.forEach(item => {
                zipProcessedRef.current.add(String(item.idQuantio || item.ean));
            });
        }

        // Actualizar la referencia con productos esenciales - SIEMPRE STRINGS
        prevEansRef.current = productosEsenciales.map(item => String(item.idQuantio || item.ean)).sort();
    }, [productosEsenciales, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock]);

    // auto-ajustes (depósito gana, motivo coherente, salir de "Falta" si aparece opción)
    // NOTA: Solo se ejecuta cuando cambian los EANs del carrito o precios/stock, NO cuando cambian las unidades
    useEffect(() => {
        console.log('🔄 AUTO-AJUSTES useEffect ejecutándose...');

        // Calcular firma estructural actual y previa para auto-ajustes
        // Separar productos con/sin idQuantio para evitar inconsistencias
        const firmaActual = JSON.stringify({
            conQuantio: productosEsenciales
                .filter(item => item.idQuantio)
                .map(item => ({
                    id: item.idQuantio,
                    ean: item.ean,
                    monroe: !!preciosMonroe[item.ean],
                    suizo: !!preciosSuizo[item.ean],
                    cofarsur: !!preciosCofarsur[item.ean],
                    stock: !!stockDisponible[item.ean]
                })).sort((a, b) => Number(a.id) - Number(b.id)),
            sinQuantio: productosEsenciales
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
        if (!cambioEstructural && productosEsenciales.length > 0) {
            return;
        }

        // Limpiar selecciones de productos eliminados
        let nueva = { ...seleccion };
        const idsActuales = productosEsenciales.map(item => String(item.idQuantio || item.ean));

        // Eliminar selecciones de productos que ya no están en el carrito
        const productosEliminados = [];
        Object.keys(nueva).forEach(id => {
            // Asegurar que ambos sean strings para la comparación
            const idString = String(id);
            if (!idsActuales.includes(idString)) {
                productosEliminados.push(id);
                delete nueva[id];
                // TAMBIÉN limpiar del tracking de selecciones manuales
                manualSelectionRef.current.delete(id);
            }
        });

        // 🔍 LOG para debugging productos TXT
        if (productosEliminados.length > 0) {
            console.log('🗑️ PRODUCTOS ELIMINADOS:', productosEliminados);
            console.log('📋 IDs ACTUALES:', idsActuales);
            console.log('🎯 SELECCIONES MANUALES RESTANTES:', Array.from(manualSelectionRef.current));
            console.log('🔄 NUEVA SELECCIÓN DESPUÉS DE LIMPIAR:', nueva);
        }

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
            const clave = String(item.idQuantio || item.ean);

            // 🔒 No modificar selecciones marcadas como manuales
            if (manualSelectionRef.current.has(clave)) {
                console.log(`🔒 PROTEGIDO (manual): ${clave} - ${item.descripcion || item.ean}`);
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

        // Actualizar la referencia al final para la próxima comparación
        prevEansAutoAjustesRef.current = {
            conQuantio: productosEsenciales
                .filter(item => item.idQuantio)
                .map(item => ({
                    id: item.idQuantio,
                    ean: item.ean,
                    monroe: !!preciosMonroe[item.ean],
                    suizo: !!preciosSuizo[item.ean],
                    cofarsur: !!preciosCofarsur[item.ean],
                    stock: !!stockDisponible[item.ean]
                })).sort((a, b) => Number(a.id) - Number(b.id)),
            sinQuantio: productosEsenciales
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

    return { seleccion, setSeleccion: setSeleccionManual };
}