// front/src/features/buscador/TablaCarrito.jsx

import { FaTrash } from "react-icons/fa";
import { useCarrito } from "../../context/CarritoContext";

const TablaCarrito = ({ eanRecienAgregado }) => {
    const { carrito, eliminarDelCarrito, actualizarUnidades } = useCarrito();

    if (carrito.length === 0) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "60vh"
            }}>
                <div className="sin-productos">
                    No hay productos en el carrito.
                </div>
            </div>
        );
    }

    return (
        <>
            <h3>Carrito</h3>
            <table className="buscador_tabla">
                <thead>
                    <tr>
                        <th>EAN</th>
                        <th>Descripción</th>
                        <th>Laboratorio</th>
                        <th>Stock sucursal</th>
                        <th>Unidades</th>
                        <th><FaTrash /></th>
                    </tr>
                </thead>
                <tbody>
                    {carrito.map((item, i) => (
                        <tr
                            key={i}
                            className={`carrito_row ${eanRecienAgregado === item.ean ? "is-new" : ""}`}
                        >
                            <td>{item.ean}</td>
                            <td>{item.descripcion}</td>
                            <td>{item.laboratorio}</td>
                            <td>{item.stockSucursal}</td>
                            <td>
                                <div className="qty">
                                    <button
                                        className="qty__btn"
                                        onClick={() =>
                                            actualizarUnidades(item.ean, Math.max(1, (item.unidades || 1) - 1))
                                        }
                                    >
                                        −
                                    </button>

                                    <span className="qty__num">{item.unidades || 1}</span>

                                    <button
                                        className="qty__btn"
                                        onClick={() =>
                                            actualizarUnidades(item.ean, (item.unidades || 1) + 1)
                                        }
                                    >
                                        +
                                    </button>
                                </div>
                            </td>

                            <td>
                                <button
                                    className="carrito_icon_btn"
                                    onClick={() => eliminarDelCarrito(item.ean)}
                                    aria-label={`Eliminar ${item.descripcion}`}
                                    title="Eliminar"
                                >
                                    <FaTrash />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
};

export default TablaCarrito;