import React from "react";
import { FaTrash, FaCheckSquare, FaSquare } from "react-icons/fa";

// Ajustá estos imports a donde los tengas actualmente

import { mejorProveedor, precioValido } from "../logic/mejorProveedor";
import PreciosMonroe from "../../proveedores/PreciosMonroe";
import PreciosSuizo from "../../proveedores/PreciosSuizo";
import PreciosCofarsur from "../../proveedores/PreciosCofarsur";
import PreciosKellerhoff from "../../proveedores/PreciosKellerhoff";

import QtyControl from "./QtyControl";
import MotivoSelect from "./MotivoSelect";
import NoPedirToggle from "./NoPedirToggle";
import CeldaProveedor from "./CeldaProveedor";
import {
    hayStockDeposito,
    hayDrogConPrecioValido,
    esMotivoStockDepoBloqueado,
} from "../logic/validaciones";


export default function FilaItem({
    item,
    seleccion = {},
    preciosMonroe,
    preciosSuizo,
    preciosCofarsur,
    stockDisponible,
    onElegirProveedor,
    onMotivo,
    onEliminar,
    onChangeQty,
    pedir,
    togglePedir,
    getStock,
    opcionesMotivo,
}) {
    const motivoActual = seleccion?.motivo;
    const proveedorActual = seleccion?.proveedor;


    const hayDepo = hayStockDeposito(item.idQuantio, stockDisponible);
    const stockDepo = getStock(item.idQuantio, stockDisponible); // seguimos mostrando el número
    const stockDepoValido = typeof stockDepo === "number" && stockDepo > 0;
    const hayAlgunaDrogConPrecio = hayDrogConPrecioValido(
        item.idQuantio,
        { preciosMonroe, preciosSuizo, preciosCofarsur },
        precioValido
    );
    const hayAlgoPedible = hayDepo || hayAlgunaDrogConPrecio;
    const motivoBloqueado = esMotivoStockDepoBloqueado({ motivoActual, proveedorActual, hayDepo });

    const estaPedir = !!pedir;
    const estaNoPedir = !estaPedir;

    return (
        <tr className={estaNoPedir ? "fila_omitida" : ""}>
            {/* Descripción + tooltip laboratorio */}
            <td className="celda_descripcion_hover" style={{ position: "relative", cursor: "pointer" }}>
                <span className="desc_texto">
                    {item.descripcion || item.nombre || `Producto ${item.ean}`}
                </span>
                <span className="celda_ean">{item.ean}</span>
                <div className="globo_hover">
                    <div className="globo_contenido">
                        {/* <div style={{ fontWeight: "bold", marginBottom: 4 }}>{item.descripcion}</div> */}
                        {item.laboratorio && (
                            <div style={{ fontSize: "0.95em", color: "#00bcd4" }}>
                                {item.laboratorio}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            {/* Unidades pedidas */}
            <td>
                <QtyControl
                    value={item.unidades || 1}
                    disabled={!pedir}
                    onChange={(v) => onChangeQty?.(item.idQuantio, v)}
                />
            </td>

            {/* Stock sucursal */}
            <td>{item.stockSucursal}</td>

            {/* Stock Depósito */}
            <CeldaProveedor
                activo={proveedorActual === "deposito"}
                disabled={!pedir || !stockDepoValido}
                valorMostrado={stockDepo}
                onSelect={() => onElegirProveedor(item.idQuantio, "deposito")}
            />

            {/* Monroe */}
            <td className={proveedorActual === "monroe" ? "celda_activa" : ""}>
                <PreciosMonroe
                    idQuantio={item.idQuantio}
                    ean={item.ean}
                    precios={preciosMonroe}
                    seleccionado={proveedorActual === "monroe"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* Suizo */}
            <td className={proveedorActual === "suizo" ? "celda_activa" : ""}>
                <PreciosSuizo
                    idQuantio={item.idQuantio}
                    ean={item.ean}
                    precios={preciosSuizo}
                    seleccionado={proveedorActual === "suizo"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* Cofarsur */}
            <td className={proveedorActual === "cofarsur" ? "celda_activa" : ""}>
                <PreciosCofarsur
                    idQuantio={item.idQuantio}
                    ean={item.ean}
                    precios={preciosCofarsur}
                    seleccionado={proveedorActual === "cofarsur"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* Kellerhoff (kellerhoff en slug si así lo usás en back/estado) */}
            <td className={"celda_kellerhoff" + (proveedorActual === "kellerhoff" ? " celda_activa" : "")}>
                <PreciosKellerhoff
                    idQuantio={item.idQuantio}
                    ean={item.ean}
                    seleccionado={proveedorActual === "kellerhoff"}
                    onSelect={(idQuantio, proveedor) => onElegirProveedor(idQuantio, proveedor)}
                />
            </td>

            {/* Motivo */}
            <td>
                <MotivoSelect
                    value={motivoActual}
                    disabled={!estaPedir || motivoBloqueado || motivoActual === "Falta"}
                    proveedorActual={proveedorActual}
                    stockDepo={stockDepo}
                    hayAlgoPedible={hayAlgoPedible}
                    onChange={(v) => onMotivo(item.idQuantio, v)}
                    opciones={opcionesMotivo}
                />

            </td>

            {/* Eliminar */}
            <td>
                <button
                    className="carrito_icon_btn"
                    title="Eliminar del carrito"
                    onClick={() => onEliminar(item.idQuantio)}
                >
                    <FaTrash />
                </button>
            </td>

            {/* Pedir / No pedir */}
            <td>
                <NoPedirToggle pedir={pedir} onToggle={togglePedir} />
            </td>
        </tr>
    );
}
