import React, { useMemo } from "react";
import FilaItem from "./FilaItem";
import { useCarrito } from "../../../context/CarritoContext";
import { useAuth } from "../../../context/AuthContext.jsx";

// Opciones por defecto si no te llegan por props
const DEFAULT_OPCIONES_MOTIVO = [
    { value: "", label: "Seleccionar motivo" },
    { value: "Falta", label: "Falta" },
    { value: "Stock Depo", label: "Stock Depo" },
    { value: "Mejor precio", label: "Mejor precio" },
    { value: "Llega más rápido", label: "Llega más rápido" },
    { value: "Condición / Acuerdo", label: "Condición / Acuerdo" },
    { value: "Sin troquel", label: "Sin troquel" },
    { value: "Sin stock drog principal", label: "Sin stock drog principal" },
];

export default function TablaRevisar({
    carrito,
    preciosMonroe,
    preciosSuizo,
    preciosCofarsur,
    preciosDelSud,
    stockDisponible,
    seleccion,
    onElegirProveedor,
    onMotivo,
    onEliminar,
    onChangeQty,
    noPedirMap,
    onToggleNoPedir,
    getStock,
    precioValido,
    opcionesMotivo = DEFAULT_OPCIONES_MOTIVO,
}) {
    const { obtenerCarritoId } = useCarrito();
    const { usuario } = useAuth();

    // 🔤 Ordenar carrito alfabéticamente por nombre del producto
    const carritoOrdenado = useMemo(() => {
        return [...carrito].sort((a, b) => {
            const nombreA = (a.descripcion || a.nombre || '').toLowerCase();
            const nombreB = (b.descripcion || b.nombre || '').toLowerCase();
            return nombreA.localeCompare(nombreB);
        });
    }, [carrito]);

    return (
        <div className="tabla_scroll">
            <table className="revisar_tabla">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th>Unidades pedidas</th>
                        <th>Stock Sucu</th>
                        <th>Stock Depo</th>
                        <th>Monroe</th>
                        <th>Suizo</th>
                        <th>Cofarsur</th>
                        <th>Kellerhoff</th>
                        {usuario?.rol === 'compras' && (<th>Suiza Tuc</th>)}
                        {usuario?.rol === 'compras' && (<th>Del Sud</th>)}
                        <th>Motivo</th>
                        <th>Eliminar</th>
                        <th>Pedir</th>
                    </tr>
                </thead>

                <tbody>
                    {carrito && Array.isArray(carrito) ? carritoOrdenado.map((item, index) => {
                        // 🆔 Usar carritoId como identificador único
                        const itemId = obtenerCarritoId(item);

                        return (
                            <FilaItem
                                key={`${itemId}-${index}`}
                                item={item}
                                seleccion={seleccion[itemId]}
                                preciosMonroe={preciosMonroe}
                                preciosSuizo={preciosSuizo}
                                preciosCofarsur={preciosCofarsur}
                                preciosDelSud={preciosDelSud}
                                stockDisponible={stockDisponible}
                                onElegirProveedor={onElegirProveedor}
                                onMotivo={onMotivo}
                                onEliminar={() => onEliminar(item)}
                                onChangeQty={(carritoId, unidades) => onChangeQty(item, unidades)}
                                pedir={!noPedirMap[itemId]}
                                togglePedir={() =>
                                    onToggleNoPedir(itemId, !!(!noPedirMap[itemId]))
                                }
                                getStock={getStock}
                                precioValido={precioValido}
                                opcionesMotivo={opcionesMotivo}
                            />
                        );
                    }) : null}
                </tbody>
            </table>
        </div>
    );
}
