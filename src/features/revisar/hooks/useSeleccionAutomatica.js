// hooks/useSeleccionAutomatica.js
import { useEffect, useState, useRef } from "react";
import { pickPorPrioridad } from "../logic/prioridad";
import { mejorProveedor, precioValido } from "../logic/mejorProveedor";


export function useSeleccionAutomatica({ carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock, sucursal }) {
    const [seleccion, setSeleccion] = useState({});
    const prevEansRef = useRef([]);
    const prevEansAutoAjustesRef = useRef([]);
    const reglasLoadedRef = useRef(false);
    const preciosLoadedRef = useRef(false);

    // selección inicial - solo cuando se AGREGAN nuevos productos, no cuando se eliminan
    useEffect(() => {
        if (!carrito.length || !reglas) {
            // ...
            return;
        }

        // Verificar que tengamos al menos algunos precios disponibles
        const hayPrecios = preciosMonroe?.length || preciosSuizo?.length || preciosCofarsur?.length || stockDisponible?.length;
        if (!hayPrecios) {
            // ...
            return;
        }

        // Usar idQuantio como clave única
        const currentIds = carrito.map(item => item.idQuantio).sort();
        const prevIds = prevEansRef.current;

        // Identificar si hay productos nuevos (que no estaban antes)
        const nuevosIds = currentIds.filter(id => !prevIds.includes(id));
        const esInicialCarga = prevIds.length === 0;
        const reglasRecienCargadas = reglas && !reglasLoadedRef.current;
        const preciosRecienCargados = hayPrecios && !preciosLoadedRef.current;

        // Ejecutar si: es carga inicial, hay productos nuevos, recién llegaron las reglas, o recién llegaron los precios
        if (!esInicialCarga && nuevosIds.length === 0 && !reglasRecienCargadas && !preciosRecienCargados) {
            // ...
            return;
        }

        // ...

        // Marcar que las reglas y precios ya se cargaron
        reglasLoadedRef.current = true;
        preciosLoadedRef.current = true;

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito: stockDisponible };
        const productosParaProcesar = esInicialCarga ? carrito : carrito.filter(item => nuevosIds.includes(item.idQuantio));

        // Solo modificar selección para productos nuevos o carga inicial
        const nuevaSeleccion = esInicialCarga ? {} : { ...seleccion };

        productosParaProcesar.forEach((item) => {
            // Usar idQuantio para consultar el stock del depósito
            const stockDepoItem = getStock(item.idQuantio, stockDisponible, sucursal);
            if (typeof stockDepoItem === "number" && stockDepoItem > 0) {
                nuevaSeleccion[item.idQuantio] = { proveedor: "deposito", motivo: "Stock Depo" };
                return;
            }

            const match = matchConvenio(item, reglas);
            if (match.aplica) {
                const elegido = pickPorPrioridad(item, match.prioridad, ctx);
                nuevaSeleccion[item.idQuantio] = elegido
                    ? { proveedor: elegido, motivo: "Condición / Acuerdo" }
                    : { proveedor: "Falta", motivo: "Falta" };
                return;
            }

            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });
            nuevaSeleccion[item.idQuantio] = ideal ? { proveedor: ideal, motivo: "Mejor precio" }
                : { proveedor: "Falta", motivo: "Falta" };
        });

        // ...
        setSeleccion(nuevaSeleccion);

        // Actualizar la referencia de idQuantio
        prevEansRef.current = currentIds;
    }, [carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock]);

    // auto-ajustes (depósito gana, motivo coherente, salir de "Falta" si aparece opción)
    // NOTA: Solo se ejecuta cuando cambian los EANs del carrito o precios/stock, NO cuando cambian las unidades
    useEffect(() => {
        // Verificar si realmente cambiaron los idQuantio
        const currentIds = carrito.map(item => item.idQuantio).sort();
        const prevIds = prevEansAutoAjustesRef.current;

        const idsChanged = currentIds.length !== prevIds.length ||
            currentIds.some((id, index) => id !== prevIds[index]);

        // Actualizar la referencia para auto-ajustes
        prevEansAutoAjustesRef.current = currentIds;

        // Solo ejecutar si cambiaron los ids o los precios/stock
        if (!idsChanged && carrito.length > 0) {
            return; // No hacer nada si solo cambiaron las unidades
        }

        // Limpiar selecciones de productos eliminados
        let nueva = { ...seleccion };
        const idsActuales = carrito.map(item => item.idQuantio);

        // Eliminar selecciones de productos que ya no están en el carrito
        Object.keys(nueva).forEach(id => {
            if (!idsActuales.includes(id)) {
                delete nueva[id];
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
            const sel = nueva[item.idQuantio] || {};
            const prov = sel.proveedor;
            const motivo = sel.motivo;
            const stockDepo = getStock(item.ean, stockDisponible, sucursal);
            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });

            if (stockDepo > 0 && prov !== "deposito") {
                nueva[item.idQuantio] = { proveedor: "deposito", motivo: "Stock Depo" };
                cambios = true;
                return;
            }
            if (prov === "deposito" && stockDepo > 0 && motivo !== "Stock Depo") {
                nueva[item.idQuantio].motivo = "Stock Depo";
                cambios = true;
            }
            if (prov === ideal && prov !== "deposito" && motivo !== "Mejor precio") {
                nueva[item.idQuantio].motivo = "Mejor precio";
                cambios = true;
            }
            if (motivo === "Falta" && (stockDepo > 0 || ideal)) {
                nueva[item.idQuantio] = stockDepo > 0
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
    }, [carrito, stockDisponible, preciosMonroe, preciosSuizo, preciosCofarsur]); // eslint-disable-line

    return { seleccion, setSeleccion };
}
