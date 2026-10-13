import { useEffect, useState, useRef, useMemo } from "react";
import { pickPorPrioridad } from "../logic/prioridad";
import { mejorProveedor, precioValido } from "../logic/mejorProveedor";
import { useCarrito } from "../../../context/CarritoContext";

export function useSeleccionAutomatica({ carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud = [], preciosKellerhoff = [], stockDisponible, matchConvenio, getStock, sucursal, getFactorNC = null, esSoloDepo = () => false }) {
    const { obtenerCarritoId } = useCarrito();
    const [seleccion, setSeleccion] = useState({});
    const prevEansRef = useRef([]);
    const prevEansAutoAjustesRef = useRef([]);
    const reglasLoadedRef = useRef(false);
    const preciosLoadedRef = useRef(false);
    const zipProcessedRef = useRef(new Set());
    const manualSelectionRef = useRef(new Set());

    const setSeleccionManual = (updater) => {
        setSeleccion(prev => {
            const newSelection = typeof updater === 'function' ? updater(prev) : updater;

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

                if (cambiosRegistrados.length > 0) {

                    cambiosRegistrados.forEach(key => {
                        const producto = (carrito || []).find(p => obtenerCarritoId(p) === String(key));

                    });
                }
            }, 0);

            return newSelection;
        });
    };

    const productosEsenciales = useMemo(() => {
        if (!carrito || !Array.isArray(carrito)) return [];

        const productos = carrito.filter(item =>
            (item.idQuantio || item.ean) && item.unidades > 0
        );

        return productos;
    }, [(carrito || []).map(item =>
        `${obtenerCarritoId(item)}-${item.unidades > 0 ? '1' : '0'}-${item.desde_zip ? '1' : '0'}`
    ).join('|'), obtenerCarritoId]);

    useEffect(() => {
        if (!carrito || !carrito.length || !reglas) {
            return;
        }

        const hayPrecios = (preciosMonroe && preciosMonroe.length) ||
            (preciosSuizo && preciosSuizo.length) ||
            (preciosCofarsur && preciosCofarsur.length) ||
            (preciosDelSud && preciosDelSud.length) ||
            (preciosKellerhoff && preciosKellerhoff.length) ||
            (stockDisponible && stockDisponible.length);
        if (!hayPrecios) {
            return;
        }

        const firmaActual = productosEsenciales.map(item => obtenerCarritoId(item)).sort().join(',');
        const firmaPrevia = prevEansRef.current.join(',');
        const cambioEstructural = firmaActual !== firmaPrevia;

        const productosZipNuevos = productosEsenciales.filter(item =>
            (item.desde_zip === true || item.timestamp_zip) &&
            !zipProcessedRef.current.has(obtenerCarritoId(item))
        );
        const hayProductosZipNuevos = productosZipNuevos.length > 0;
        const esInicialCarga = prevEansRef.current.length === 0;
        const reglasRecienCargadas = reglas && !reglasLoadedRef.current;
        const preciosRecienCargados = hayPrecios && !preciosLoadedRef.current;

        if (!esInicialCarga && !cambioEstructural && !reglasRecienCargadas && !preciosRecienCargados && !hayProductosZipNuevos) {
            return;
        }

        reglasLoadedRef.current = true;
        preciosLoadedRef.current = true;

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, preciosKellerhoff, stockDeposito: stockDisponible };

        let productosParaProcesar;
        if (esInicialCarga) {
            productosParaProcesar = productosEsenciales;
        } else {
            const idsActuales = productosEsenciales.map(item => obtenerCarritoId(item));
            const idsNuevos = idsActuales.filter(id => !prevEansRef.current.includes(id));
            const productosNuevos = productosEsenciales.filter(item => idsNuevos.includes(obtenerCarritoId(item)));
            const todosLosPorProcesar = [...productosNuevos, ...productosZipNuevos];
            productosParaProcesar = todosLosPorProcesar.filter((item, index, arr) =>
                arr.findIndex(p => obtenerCarritoId(p) === obtenerCarritoId(item)) === index
            );
        }

        const nuevaSeleccion = esInicialCarga ? {} : { ...seleccion };

        productosParaProcesar.forEach((item) => {
            const clave = obtenerCarritoId(item);
            const stockDepoItem = getStock(item.idQuantio, stockDisponible, sucursal);

            if (typeof stockDepoItem === "number" && stockDepoItem > 0) {
                nuevaSeleccion[clave] = { proveedor: "deposito", motivo: "Stock Depo" };
                return;
            }

            // Producto solo-depósito: nunca droguería externa, aunque no haya stock.
            if (esSoloDepo(item)) {
                nuevaSeleccion[clave] = { proveedor: "Falta", motivo: "Falta Solo Depo" };
                return;
            }

            const match = matchConvenio(item, reglas);

            if (match.aplica) {
                const elegido = pickPorPrioridad(item, match.prioridad, ctx);
                if (elegido) {
                    nuevaSeleccion[clave] = { proveedor: elegido, motivo: "Condición / Acuerdo" };
                } else {
                    if (item.esPerfumeria === true) {
                        nuevaSeleccion[clave] = { proveedor: "suizaTuc", motivo: "Suiza Tucumán" };
                    } else {
                        nuevaSeleccion[clave] = { proveedor: "Falta", motivo: "Falta" };
                    }
                }
                return;
            }

            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, preciosKellerhoff }, item.unidades ?? 1, item, getFactorNC);
            if (ideal) {
                nuevaSeleccion[clave] = { proveedor: ideal, motivo: "Mejor precio" };
            } else {
                if (item.esPerfumeria === true) {
                    nuevaSeleccion[clave] = { proveedor: "suizaTuc", motivo: "Suiza Tucumán" };
                } else {
                    nuevaSeleccion[clave] = { proveedor: "Falta", motivo: "Falta" };
                }
            }
        });

        setSeleccion(nuevaSeleccion);

        if (hayProductosZipNuevos) {
            productosZipNuevos.forEach(item => {
                zipProcessedRef.current.add(obtenerCarritoId(item));
            });
        }

        prevEansRef.current = productosEsenciales.map(item => obtenerCarritoId(item)).sort();
    }, [productosEsenciales, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, preciosKellerhoff, stockDisponible, matchConvenio, getStock, obtenerCarritoId]);

    useEffect(() => {

        const firmaActual = JSON.stringify(
            productosEsenciales.map(item => ({
                carritoId: obtenerCarritoId(item),
                ean: item.ean,
                monroe: !!(preciosMonroe && preciosMonroe[item.ean]),
                suizo: !!(preciosSuizo && preciosSuizo[item.ean]),
                cofarsur: !!(preciosCofarsur && preciosCofarsur[item.ean]),
                delsud: !!(preciosDelSud && preciosDelSud.find && preciosDelSud.find(p => p.ean === item.ean)),
                kellerhoff: !!(preciosKellerhoff && preciosKellerhoff.find && preciosKellerhoff.find(p => p.ean === item.ean)),
                stock: !!(stockDisponible && stockDisponible[item.ean])
            })).sort((a, b) => a.carritoId.localeCompare(b.carritoId))
        );
        const firmaPrevia = JSON.stringify(prevEansAutoAjustesRef.current || []);
        const cambioEstructural = firmaActual !== firmaPrevia;

        if (!cambioEstructural && productosEsenciales.length > 0) {
            return;
        }

        const idsActuales = productosEsenciales.map(item => obtenerCarritoId(item));

        // IMPORTANTE: el cálculo de "nueva" se hace dentro del updater funcional de
        // setSeleccion, partiendo de `prev` (el estado más reciente garantizado por React)
        // en vez de la `seleccion` capturada en el closure de este efecto. Este efecto y el
        // de arriba pueden correr dentro del mismo ciclo de render con el mismo `seleccion`
        // obsoleto en su clausura; si acá se parte de ese valor obsoleto, un setSeleccion
        // posterior puede pisar una selección que el otro efecto ya había calculado bien
        // (ej: "delsud" para un producto sin convenio) con una versión sin ese dato.
        setSeleccion(prev => {
            let nueva = { ...prev };

            Object.keys(nueva).forEach(id => {
                if (!idsActuales.includes(id)) {
                    manualSelectionRef.current.delete(id);
                    delete nueva[id];
                }
            });

            if (!productosEsenciales.length) {
                manualSelectionRef.current.clear();
                return Object.keys(nueva).length > 0 ? {} : prev;
            }

            let cambios = false;

            productosEsenciales.forEach((item) => {
                const clave = obtenerCarritoId(item);

                if (manualSelectionRef.current.has(clave)) {
                    return;
                }

                const sel = nueva[clave] || {};
                const prov = sel.proveedor;
                const motivo = sel.motivo;
                const stockDepo = getStock(item.ean, stockDisponible, sucursal);
                const soloDepo = esSoloDepo(item);
                // Solo-depósito: nunca calcular ni asignar una droguería externa como "ideal".
                const ideal = soloDepo ? null : mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, preciosKellerhoff }, item.unidades ?? 1, item, getFactorNC);

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
                if (soloDepo && motivo !== "Falta Solo Depo" && prov !== "deposito" && !(stockDepo > 0)) {
                    nueva[clave] = { proveedor: "Falta", motivo: "Falta Solo Depo" };
                    cambios = true;
                    return;
                }
                if (motivo === "Falta" && (stockDepo > 0 || ideal)) {
                    nueva[clave] = stockDepo > 0
                        ? { proveedor: "deposito", motivo: "Stock Depo" }
                        : { proveedor: ideal, motivo: "Mejor precio" };
                    cambios = true;
                }
                // El item todavía no tiene ninguna selección: el efecto principal pudo haber
                // corrido en el mismo ciclo de render sin que este efecto viera su resultado
                // todavía (closure de `prev` desactualizado). Se calcula acá mismo con "ideal"
                // en vez de dejarlo vacío, para no perder una selección válida por la carrera.
                // (stockDepo > 0 ya fue resuelto arriba con `return`, por eso no se repite acá.)
                if (!motivo && !prov && !soloDepo && ideal) {
                    nueva[clave] = { proveedor: ideal, motivo: "Mejor precio" };
                    cambios = true;
                }

                // 🆕 Auto-ajuste para productos de perfumería que están en "Falta"
                if (motivo === "Falta" && !stockDepo && !ideal && !soloDepo && item.esPerfumeria === true) {
                    nueva[clave] = { proveedor: "suizaTuc", motivo: "Suiza Tucumán" };
                    cambios = true;
                }
            });

            return cambios ? nueva : prev;
        });

        prevEansAutoAjustesRef.current = productosEsenciales.map(item => ({
            carritoId: obtenerCarritoId(item),
            ean: item.ean,
            monroe: !!(preciosMonroe && preciosMonroe[item.ean]),
            suizo: !!(preciosSuizo && preciosSuizo[item.ean]),
            cofarsur: !!(preciosCofarsur && preciosCofarsur[item.ean]),
            delsud: !!(preciosDelSud && preciosDelSud.find && preciosDelSud.find(p => p.ean === item.ean)),
            kellerhoff: !!(preciosKellerhoff && preciosKellerhoff.find && preciosKellerhoff.find(p => p.ean === item.ean)),
            stock: !!(stockDisponible && stockDisponible[item.ean])
        })).sort((a, b) => a.carritoId.localeCompare(b.carritoId));
    }, [productosEsenciales, stockDisponible, preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, preciosKellerhoff, obtenerCarritoId]);

    return { seleccion, setSeleccion: setSeleccionManual };
}
