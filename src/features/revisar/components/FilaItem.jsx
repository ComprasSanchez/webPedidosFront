import React from "react";
import { FaTrash, FaCheckSquare, FaSquare } from "react-icons/fa";

import { useCarrito } from "../../../context/CarritoContext";
import { useAuth } from "../../../context/AuthContext.jsx";

import { mejorProveedor, precioValido } from "../logic/mejorProveedor";
import PreciosMonroe from "../../proveedores/PreciosMonroe";
import PreciosSuizo from "../../proveedores/PreciosSuizo";
import PreciosCofarsur from "../../proveedores/PreciosCofarsur";
import PreciosKellerhoff from "../../proveedores/PreciosKellerhoff";
import PreciosSuizaTuc from "../../proveedores/PreciosSuizaTuc.jsx";
import PreciosDelSud from "../../proveedores/PreciosDelSud.jsx";

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
    preciosDelSud,
    preciosKellerhoff,
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
    const { obtenerCarritoId } = useCarrito();
    const { usuario } = useAuth();

    // 🆔 Usar carritoId como identificador único
    const itemId = obtenerCarritoId(item);

    const motivoActual = seleccion?.motivo;
    const proveedorActual = seleccion?.proveedor;


    const hayDepo = hayStockDeposito(item.idQuantio || item.ean, stockDisponible);
    const stockDepo = getStock(item.idQuantio || item.ean, stockDisponible); // seguimos mostrando el número
    const stockDepoValido = typeof stockDepo === "number" && stockDepo > 0;
    const hayAlgunaDrogConPrecio = hayDrogConPrecioValido(
        item.idQuantio || item.ean,
        { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, preciosKellerhoff },
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
                    onChange={(v) => {
                        // 🆔 Usar carritoId como identificador único
                        onChangeQty?.(itemId, v);
                    }}
                />
            </td>

            {/* Stock sucursal */}
            <td>{item.stockSucursal}</td>

            {/* Stock Depósito */}
            <CeldaProveedor
                activo={proveedorActual === "deposito"}
                disabled={!pedir || !stockDepoValido}
                valorMostrado={stockDepo}
                onSelect={() => onElegirProveedor(itemId, "deposito")}
            />

            {/* Monroe */}
            <td className={proveedorActual === "monroe" ? "celda_activa" : ""}>
                <PreciosMonroe
                    idQuantio={itemId}
                    ean={item.ean}
                    precios={preciosMonroe}
                    cantidad={item.unidades ?? 1}
                    seleccionado={proveedorActual === "monroe"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* Suizo */}
            <td className={proveedorActual === "suizo" ? "celda_activa" : ""}>
                <PreciosSuizo
                    idQuantio={itemId}
                    ean={item.ean}
                    precios={preciosSuizo}
                    cantidad={item.unidades ?? 1}
                    seleccionado={proveedorActual === "suizo"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* Cofarsur */}
            <td className={proveedorActual === "cofarsur" ? "celda_activa" : ""}>
                <PreciosCofarsur
                    idQuantio={itemId}
                    ean={item.ean}
                    precios={preciosCofarsur}
                    cantidad={item.unidades ?? 1}
                    seleccionado={proveedorActual === "cofarsur"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* Kellerhoff (kellerhoff en slug si así lo usás en back/estado) */}
            <td className={proveedorActual === "kellerhoff" ? "celda_activa" : ""}>
                <PreciosKellerhoff
                    idQuantio={itemId}
                    ean={item.ean}
                    precios={preciosKellerhoff}
                    seleccionado={proveedorActual === "kellerhoff"}
                    onSelect={onElegirProveedor}
                />
            </td>

            {/* suizaTuc (suizaTuc en slug si así lo usás en back/estado) */}
            {usuario?.rol === 'compras' && (
                <td className={"celda_suizaTuc" + (proveedorActual === "suizaTuc" ? " celda_activa" : "")}>
                    <PreciosSuizaTuc
                        idQuantio={itemId}
                        ean={item.ean}
                        seleccionado={proveedorActual === "suizaTuc"}
                        onSelect={(idQuantio, proveedor) => onElegirProveedor(itemId, proveedor)}
                    />
                </td>
            )}

            {/* Del Sud */}
            <td className={"celda_delsud" + (proveedorActual === "delsud" ? " celda_activa" : "")}>
                <PreciosDelSud
                    idQuantio={itemId}
                    ean={item.ean}
                    precios={preciosDelSud}
                    cantidad={item.unidades ?? 1}
                    seleccionado={proveedorActual === "delsud"}
                    onSelect={(idQuantio, proveedor) => onElegirProveedor(itemId, proveedor)}
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
                    onChange={(v) => onMotivo(itemId, v)}
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
