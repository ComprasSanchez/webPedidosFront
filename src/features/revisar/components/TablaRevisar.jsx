import React from "react";
import FilaItem from "./FilaItem";

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
                        <th>Motivo</th>
                        <th>Eliminar</th>
                        <th>Pedir</th>
                    </tr>
                </thead>

                <tbody>
                    {carrito.map((item) => (
                        <FilaItem
                            key={item.ean}
                            item={item}
                            seleccion={seleccion[item.ean]}
                            preciosMonroe={preciosMonroe}
                            preciosSuizo={preciosSuizo}
                            preciosCofarsur={preciosCofarsur}
                            stockDisponible={stockDisponible}
                            onElegirProveedor={onElegirProveedor}
                            onMotivo={onMotivo}
                            onEliminar={() => onEliminar(item.ean)}
                            onChangeQty={onChangeQty}                // puede venir null y no pasa nada
                            pedir={!noPedirMap[item.ean]}
                            togglePedir={() =>
                                onToggleNoPedir(item.ean, /* noPedirChecked */ !!(!noPedirMap[item.ean]))
                            }
                            getStock={getStock}
                            precioValido={precioValido}
                            opcionesMotivo={opcionesMotivo}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
