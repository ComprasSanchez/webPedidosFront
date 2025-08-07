import { useState } from "react";
import { useCarrito } from "../../context/CarritoContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const BuscadorProductos = () => {
    const { usuario } = useAuth();
    const [query, setQuery] = useState("");
    const [cantidad, setCantidad] = useState(1);
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const { carrito, agregarAlCarrito } = useCarrito();
    const navigate = useNavigate();

    const handleBuscar = async () => {
        if (!query.trim()) return;

        if (!usuario || !usuario.sucursal_codigo) {
            console.warn("usuario no definido aún");
            return;
        }
        try {
            const res = await fetch(`http://localhost:4000/api/productos/buscar/${query}?sucursalId=${usuario.id}`);
            const data = await res.json();

            console.log("Respuesta del backend:", data);

            if (data.encontrado) {
                setProductoSeleccionado({
                    ean: data.ean,
                    descripcion: data.descripcion,
                    stockSucursal: data.stockSucursal,
                    precios: { deposito: 0 },
                    idQuantio: data.idQuantio ?? data.codPlex ?? null,
                });
            } else {
                setProductoSeleccionado({
                    ean: query,
                    descripcion: `Producto no registrado (${query})`,
                    stockSucursal: 0,
                    precios: { deposito: 0 },
                    idQuantio: null,
                });
            }

        } catch (err) {
            console.error("Error buscando producto:", err);
            setProductoSeleccionado({
                ean: query,
                descripcion: "Producto no registrado",
                stockSucursal: 0,
                precios: { deposito: 0 },
                idQuantio: null,
            });
        }
    };

    const handleAgregar = () => {
        if (productoSeleccionado) {
            agregarAlCarrito(productoSeleccionado, cantidad);
            setQuery("");
            setCantidad(1);
            setProductoSeleccionado(null);
        }
    };

    return (
        <div className="buscador_wrapper">
            <h2 className="buscador_titulo">BUSCADOR DE PRODUCTOS</h2>

            <div className="buscador_form">
                <input
                    type="text"
                    className="buscador_input"
                    placeholder="Código de barras"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                />
                <button className="buscador_btn_buscar" onClick={handleBuscar}>
                    🔍
                </button>
            </div>

            {productoSeleccionado && (
                <div className="buscador_seleccionado">
                    <span>{productoSeleccionado.descripcion}</span>
                    <div className="buscador_contador">
                        <button onClick={() => setCantidad(Math.max(1, cantidad - 1))}>
                            ➖
                        </button>
                        <span>{cantidad}</span>
                        <button onClick={() => setCantidad(cantidad + 1)}>➕</button>
                    </div>
                    <button className="buscador_agregar" onClick={handleAgregar}>
                        AGREGAR
                    </button>
                </div>
            )}

            <h3>Carrito</h3>
            <table className="buscador_tabla">
                <thead>
                    <tr>
                        <th>EAN</th>
                        <th>Descripción</th>
                        <th>Stock sucursal</th>
                        <th>Unidades</th>
                    </tr>
                </thead>
                <tbody>
                    {carrito.map((item, i) => (
                        <tr key={i}>
                            <td>{item.ean}</td>
                            <td>{item.descripcion}</td>
                            <td>{item.stockSucursal}</td>
                            <td>{item.unidades}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {carrito.length > 0 && (
                <div style={{ marginTop: "2rem", textAlign: "right" }}>
                    <button
                        className="buscador_btn_revisar"
                        onClick={() => navigate("/revisar")}
                    >
                        Revisar pedido
                    </button>
                </div>
            )}
        </div >
    );
};

export default BuscadorProductos;
