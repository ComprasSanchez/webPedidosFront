// hooks/useSeleccionAutomatica.js
import { useEffect, useState, useRef } from "react";
import { pickPorPrioridad } from "../logic/prioridad";
import { mejorProveedor, precioValido } from "../logic/mejorProveedor";


export function useSeleccionAutomatica({ carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, matchConvenio, getStock }) {
    const [seleccion, setSeleccion] = useState({});
    const prevEansRef = useRef([]);
    const prevEansAutoAjustesRef = useRef([]);

    // selección inicial - solo cuando se AGREGAN nuevos productos, no cuando se eliminan
    useEffect(() => {
        if (!carrito.length || !reglas) {
            return;
        }

        // Verificar si cambiaron los EANs para este useEffect también
        const currentEans = carrito.map(item => item.ean).sort();
        const prevEans = prevEansRef.current;

        // Identificar si hay productos nuevos (que no estaban antes)
        const nuevosEans = currentEans.filter(ean => !prevEans.includes(ean));
        const esInicialCarga = prevEans.length === 0;

        if (!esInicialCarga && nuevosEans.length === 0) {
            return;
        }

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito };
        const productosParaProcesar = esInicialCarga ? carrito : carrito.filter(item => nuevosEans.includes(item.ean));

        // Solo modificar selección para productos nuevos o carga inicial
        const nuevaSeleccion = esInicialCarga ? {} : { ...seleccion };

        productosParaProcesar.forEach((item) => {
            const stockDepoItem = getStock(item.ean, stockDeposito);
            if (stockDepoItem > 0) {
                nuevaSeleccion[item.ean] = { proveedor: "deposito", motivo: "Stock Depo" };
                return;
            }

            const match = matchConvenio(item, reglas);
            if (match.aplica) {
                const elegido = pickPorPrioridad(item, match.prioridad, ctx);
                nuevaSeleccion[item.ean] = elegido
                    ? { proveedor: elegido, motivo: "Condición / Acuerdo" }
                    : { proveedor: "Falta", motivo: "Falta" };
                return;
            }

            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });
            nuevaSeleccion[item.ean] = ideal ? { proveedor: ideal, motivo: "Mejor precio" }
                : { proveedor: "Falta", motivo: "Falta" };
        });

        setSeleccion(nuevaSeleccion);

        // Actualizar la referencia de EANs
        prevEansRef.current = currentEans;
    }, [carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, matchConvenio, getStock]);

    // auto-ajustes (depósito gana, motivo coherente, salir de "Falta" si aparece opción)
    // NOTA: Solo se ejecuta cuando cambian los EANs del carrito o precios/stock, NO cuando cambian las unidades
    useEffect(() => {
        // Verificar si realmente cambiaron los EANs
        const currentEans = carrito.map(item => item.ean).sort();
        const prevEans = prevEansAutoAjustesRef.current;

        const eansChanged = currentEans.length !== prevEans.length ||
            currentEans.some((ean, index) => ean !== prevEans[index]);

        // Actualizar la referencia para auto-ajustes
        prevEansAutoAjustesRef.current = currentEans;

        // Solo ejecutar si cambiaron los EANs o los precios/stock
        if (!eansChanged && carrito.length > 0) {
            return; // No hacer nada si solo cambiaron las unidades
        }

        // Limpiar selecciones de productos eliminados
        let nueva = { ...seleccion };
        const eansActuales = carrito.map(item => item.ean);

        // Eliminar selecciones de productos que ya no están en el carrito
        Object.keys(nueva).forEach(ean => {
            if (!eansActuales.includes(ean)) {
                delete nueva[ean];
            }
        });

        if (!carrito.length) {
            if (Object.keys(nueva).length > 0) {
                setSeleccion({});
            }
            return;
        }

        let cambios = false;

        carrito.forEach((item) => {
            const sel = nueva[item.ean] || {};
            const prov = sel.proveedor;
            const motivo = sel.motivo;
            const stockDepo = getStock(item.ean, stockDeposito);
            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });

            if (stockDepo > 0 && prov !== "deposito") {
                nueva[item.ean] = { proveedor: "deposito", motivo: "Stock Depo" };
                cambios = true;
                return;
            }
            if (prov === "deposito" && stockDepo > 0 && motivo !== "Stock Depo") {
                nueva[item.ean].motivo = "Stock Depo";
                cambios = true;
            }
            if (prov === ideal && prov !== "deposito" && motivo !== "Mejor precio") {
                nueva[item.ean].motivo = "Mejor precio";
                cambios = true;
            }
            if (motivo === "Falta" && (stockDepo > 0 || ideal)) {
                nueva[item.ean] = stockDepo > 0
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
    }, [carrito, stockDeposito, preciosMonroe, preciosSuizo, preciosCofarsur]); // eslint-disable-line

    return { seleccion, setSeleccion };
}
