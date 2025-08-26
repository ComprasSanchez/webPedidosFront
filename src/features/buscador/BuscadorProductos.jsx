// front/src/features/buscador/BuscadorProductos.jsx

import { useEffect, useRef, useState } from "react";
import { useCarrito } from "../../context/CarritoContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FaSearch, FaMinus, FaPlus, FaTrash } from "react-icons/fa";
import { API_URL } from "../../config/api";
import logo from "../../assets/logo.png";
import UltimosPedidos from "../pedidos/UltimosPedidos";
import HelpButton from "../../components/ui/HelpButton";


const BuscadorProductos = () => {
    const { usuario } = useAuth();
    const [queryCode, setQueryCode] = useState("");
    const [queryName, setQueryName] = useState("");
    const [cantidad, setCantidad] = useState(1);
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [resultadosNombre, setResultadosNombre] = useState([]);
    const [loadingName, setLoadingName] = useState(false);
    const { carrito, agregarAlCarrito, eliminarDelCarrito, actualizarUnidades } = useCarrito();
    const navigate = useNavigate();
    const nombreBoxRef = useRef(null);
    const [loadingCode, setLoadingCode] = useState(false);
    const [eanRecienAgregado, setEanRecienAgregado] = useState(null);


    const handleBuscarCodigo = async () => {
        const q = queryCode.trim();
        if (!q) return;
        if (!usuario || !usuario.sucursal_codigo) {
            console.warn("usuario no definido aún");
            return;
        }

        try {
            setLoadingCode(true);
            setResultadosNombre([]);
            setProductoSeleccionado(null);
            setQueryCode("");
            const res = await fetch(`${API_URL}/api/productos/buscar/${q}?sucursalId=${usuario.id}`);
            const data = await res.json();

            if (data.encontrado) {
                console.log("Producto encontrado:", data);

                setProductoSeleccionado({
                    ean: data.ean,
                    descripcion: data.descripcion,
                    stockSucursal: data.stockSucursal,
                    precios: { deposito: 0 },
                    idQuantio: data.idQuantio ?? data.codPlex ?? null,
                    laboratorio: data.laboratorio || "Desconocido",
                    CodLab: data.CodLab || "Desconocido"
                });
            } else {
                // No está en nuestra base → igual se puede pedir por EAN si lo escribieron
                setProductoSeleccionado({
                    ean: q,
                    descripcion: `Producto no registrado`,
                    stockSucursal: 0,
                    precios: { deposito: 0 },
                    idQuantio: null,
                    laboratorio: "Desconocido",
                    CodLab: "Desconocido"
                });
            }
            setResultadosNombre([]);
        } catch (err) {
            console.error("Error buscando producto:", err);
            setProductoSeleccionado({
                ean: q,
                descripcion: "Producto no registrado",
                stockSucursal: 0,
                precios: { deposito: 0 },
                idQuantio: null,
                laboratorio: "Desconocido",
                CodLab: "Desconocido"
            });
        } finally {
            setLoadingCode(false);
        }
    };


    // cerrar dropdown al click afuera o Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (nombreBoxRef.current && !nombreBoxRef.current.contains(e.target)) {
                setResultadosNombre([]);
            }
        };
        const handleEsc = (e) => {
            if (e.key === "Escape") setResultadosNombre([]);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, []);

    const handleBuscarNombre = async () => {

        const q = (queryName || "").trim();
        if (q.length < 2) return;

        if (!usuario?.sucursal_codigo) {
            console.warn("Falta sucursal_codigo en usuario");
            return;
        }

        const queryFormateada = q.replace(/\s+/g, "%");

        try {
            setLoadingName(true);
            setProductoSeleccionado(null);
            setResultadosNombre([]);
            const url = new URL(`${API_URL}/api/stock/productos/quantio`);

            url.searchParams.set("busqueda", queryFormateada);
            url.searchParams.set("sucursal", usuario.sucursal_codigo);
            url.searchParams.set("sucursalId", usuario.id);

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            setResultadosNombre(Array.isArray(data.resultados) ? data.resultados : []);
            setProductoSeleccionado(null);
        } catch (err) {
            console.error("Error buscando por nombre:", err);
            setResultadosNombre([]);
        } finally {
            setLoadingName(false);
        }
    };

    const handleElegirResultado = (p) => {

        setProductoSeleccionado({
            ean: p.ean || null,
            descripcion: p.descripcion,
            stockSucursal: p.stockSucursal || 0,
            precios: { deposito: 0 },
            idQuantio: p.idQuantio ?? null,
            laboratorio: p.laboratorio || "Desconocido",
            CodLab: p.CodLab || "Desconocido"
        });
        setResultadosNombre([]);
        setQueryName("");
    };



    const handleAgregar = () => {
        setEanRecienAgregado(productoSeleccionado.ean);
        setTimeout(() => setEanRecienAgregado(null), 400);
        if (!productoSeleccionado?.ean) {
            alert("Para agregar, el producto debe tener código de barras. Si no existe en la base, ingresá el EAN.");
            return;
        }
        agregarAlCarrito(productoSeleccionado, cantidad);
        setQueryCode("");
        setQueryName("");
        setCantidad(1);
        setProductoSeleccionado(null);
        setResultadosNombre([]);
    };

    return (
        <div className="buscador_wrapper">
            <img src={logo} alt="Logo" className="buscador_logo" />
            <div className="buscador_usuario">
                {usuario.sucursal_codigo}
            </div>

            <div className="buscadores">
                <h2 className="buscador_titulo">BUSCADOR DE PRODUCTOS</h2>
                <div className="buscador_busquedas">
                    {/* Código de barras (angosto, izquierda) */}
                    <div className="buscador_form buscador_codigo">
                        <input
                            type="text"
                            className="buscador_input"
                            placeholder="Código de barras"
                            value={queryCode}
                            disabled={loadingCode}                          // 🔹 bloquea escritura
                            onChange={(e) => setQueryCode(e.target.value)}
                            onKeyDown={(e) => !loadingCode && e.key === "Enter" && handleBuscarCodigo()}
                        />
                        <button type="button" className="buscador_btn_buscar" onClick={handleBuscarCodigo} disabled={loadingCode}>
                            <FaSearch />
                        </button>
                        {/* hint de estado */}
                        {loadingCode && <div className="buscador_hint"><span className="spinner" /> Buscando…</div>}

                    </div>

                    {/* Nombre (derecha) con dropdown */}
                    <div className="buscador_form buscador_nombre" ref={nombreBoxRef}>
                        <input
                            type="text"
                            className="buscador_input"
                            placeholder="Buscar por nombre (Quantio)"
                            value={queryName}
                            disabled={loadingName}                            // 🔹 bloquea escritura
                            onChange={(e) => setQueryName(e.target.value)}
                            onKeyDown={(e) => !loadingName && e.key === "Enter" && handleBuscarNombre()}
                            aria-expanded={resultadosNombre.length > 0}
                        />
                        <button type="button" className="buscador_btn_buscar" onClick={handleBuscarNombre} disabled={loadingName}>
                            <FaSearch />
                        </button>
                        {loadingName && <div className="buscador_hint"><span className="spinner" /> Buscando…</div>}

                        {/* Dropdown pegado al input */}
                        {!loadingName && queryName && resultadosNombre.length > 0 && (
                            <div
                                id="lista-resultados-nombre"
                                className="buscador_resultados_dropdown"
                                role="listbox"
                            >
                                {resultadosNombre.map((p, i) => (
                                    <button
                                        key={`${p.ean || p.idQuantio || i}`}
                                        className="buscador_resultado_item"
                                        onClick={() => handleElegirResultado(p)}
                                        role="option"
                                        title={p.ean ? `EAN ${p.ean}` : "Sin EAN"}
                                    >
                                        <span className="resultado_titulo">{p.descripcion}</span>
                                        <span className={`resultado_tag ${p.ean ? "" : "sin-ean"}`}>
                                            {p.ean ? `EAN ${p.ean}` : "SIN EAN"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Sin resultados */}
                        {!loadingName && queryName && resultadosNombre.length === 0 && (
                            <div className="buscador_resultados_dropdown sin-resultados">
                                Sin resultados…
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Selección + agregar */}
            {productoSeleccionado && (
                <div className="buscador_seleccionado">
                    <span>
                        {productoSeleccionado.descripcion}
                        {!productoSeleccionado.ean && (
                            <em style={{ marginLeft: 8, color: "#c00" }}>
                                (Debe tener EAN para poder agregar)
                            </em>
                        )}
                    </span>
                    <div className="qty">
                        <button className="qty__btn" onClick={() => setCantidad(Math.max(1, cantidad - 1))}>−</button>
                        <span className="qty__num">{cantidad}</span>
                        <button className="qty__btn" onClick={() => setCantidad(cantidad + 1)}>+</button>
                    </div>

                    <button className="buscador_agregar" onClick={handleAgregar}>
                        AGREGAR
                    </button>
                </div>
            )}
            {carrito.length === 0 ? (
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
            ) : (
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
                                    title={`Precio: — | Motivo: —`} // si querés, podés usar acá tu hover de precio/motivo
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
            )}
            {carrito.length > 0 && (
                <div style={{ marginTop: "2rem", textAlign: "right" }}>
                    <button className="buscador_btn_revisar" onClick={() => navigate("/revisar")}>
                        Realizar pedido
                    </button>
                </div>
            )}
            <UltimosPedidos />
            <HelpButton />
        </div>
    );
};

export default BuscadorProductos;