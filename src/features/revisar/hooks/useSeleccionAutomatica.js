// hooks/useSeleccionAutomatica.js
import { useEffect, useState } from "react";
import { pickPorPrioridad } from "../logic/prioridad";
import { mejorProveedor, precioValido } from "../logic/mejorProveedor";


export function useSeleccionAutomatica({ carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, matchConvenio, getStock }) {
    const [seleccion, setSeleccion] = useState({});

    // selección inicial
    useEffect(() => {
        if (!carrito.length || !reglas) return;

        const ctx = { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito };
        const initial = {};

        carrito.forEach((item) => {
            const stockDepoItem = getStock(item.ean, stockDeposito);
            if (stockDepoItem > 0) {
                initial[item.ean] = { proveedor: "deposito", motivo: "Stock Depo" };
                return;
            }

            const match = matchConvenio(item, reglas);
            if (match.aplica) {
                const elegido = pickPorPrioridad(item, match.prioridad, ctx);
                initial[item.ean] = elegido
                    ? { proveedor: elegido, motivo: "Condición / Acuerdo" }
                    : { proveedor: "Falta", motivo: "Falta" };
                return;
            }

            const ideal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });
            initial[item.ean] = ideal ? { proveedor: ideal, motivo: "Mejor precio" }
                : { proveedor: "Falta", motivo: "Falta" };
        });

        setSeleccion(initial);
    }, [carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, matchConvenio, getStock]);

    // auto-ajustes (depósito gana, motivo coherente, salir de “Falta” si aparece opción)
    useEffect(() => {
        if (!carrito.length) return;
        const nueva = { ...seleccion };
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

        if (cambios) setSeleccion(nueva);
    }, [carrito, stockDeposito, preciosMonroe, preciosSuizo, preciosCofarsur]); // eslint-disable-line

    return { seleccion, setSeleccion };
}
