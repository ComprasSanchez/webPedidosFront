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
                    console.log(' MARCADO COMO MANUAL:', cambiosRegistrados);
                    console.log(' TOTAL MANUALES:', Array.from(manualSelectionRef.current));

                    cambiosRegistrados.forEach(key => {
                        const producto = (carrito || []).find(p => obtenerCarritoId(p) === String(key));
                        if (producto) {
                            console.log(`  ${key}: ${producto.descripcion || producto.nombre} ${!producto.idQuantio ? '(TXT)' : '(ID)'}`);
                        }
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
        }

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

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito: stockDisponible };

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

        if (hayProductosZipNuevos) {
            productosZipNuevos.forEach(item => {
                zipProcessedRef.current.add(obtenerCarritoId(item));
            });
        }

        prevEansRef.current = productosEsenciales.map(item => obtenerCarritoId(item)).sort();
    }, [productosEsenciales, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock, obtenerCarritoId]);

    useEffect(() => {
        console.log('🔄 AUTO-AJUSTES useEffect ejecutándose...');

        const firmaActual = JSON.stringify(
            productosEsenciales.map(item => ({
                carritoId: obtenerCarritoId(item),
                ean: item.ean,
                monroe: !!(preciosMonroe && preciosMonroe[item.ean]),
                suizo: !!(preciosSuizo && preciosSuizo[item.ean]),
                cofarsur: !!(preciosCofarsur && preciosCofarsur[item.ean]),
                stock: !!(stockDisponible && stockDisponible[item.ean])
            })).sort((a, b) => a.carritoId.localeCompare(b.carritoId))
        );
        const firmaPrevia = JSON.stringify(prevEansAutoAjustesRef.current || []);
        const cambioEstructural = firmaActual !== firmaPrevia;

        if (!cambioEstructural && productosEsenciales.length > 0) {
            return;
        }

        let nueva = { ...seleccion };
        const idsActuales = productosEsenciales.map(item => obtenerCarritoId(item));

        const productosEliminados = [];
        Object.keys(nueva).forEach(id => {
            if (!idsActuales.includes(id)) {
                productosEliminados.push(id);
                delete nueva[id];
                manualSelectionRef.current.delete(id);
            }
        });

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
            manualSelectionRef.current.clear();
            return;
        }

        let cambios = false;

        productosEsenciales.forEach((item) => {
            const clave = obtenerCarritoId(item);

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

        const huboCambiosEnLimpieza = Object.keys(seleccion).length !== Object.keys(nueva).length;

        if (cambios || huboCambiosEnLimpieza) {
            setSeleccion(nueva);
        }

        prevEansAutoAjustesRef.current = productosEsenciales.map(item => ({
            carritoId: obtenerCarritoId(item),
            ean: item.ean,
            monroe: !!(preciosMonroe && preciosMonroe[item.ean]),
            suizo: !!(preciosSuizo && preciosSuizo[item.ean]),
            cofarsur: !!(preciosCofarsur && preciosCofarsur[item.ean]),
            stock: !!(stockDisponible && stockDisponible[item.ean])
        })).sort((a, b) => a.carritoId.localeCompare(b.carritoId));
    }, [productosEsenciales, stockDisponible, preciosMonroe, preciosSuizo, preciosCofarsur, obtenerCarritoId]);

    return { seleccion, setSeleccion: setSeleccionManual };
}
