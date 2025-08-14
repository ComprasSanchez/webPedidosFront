// front/src/features/revisar/RevisarPedido.jsx

import { useRef, useEffect, useState } from "react";
import { useCarrito } from "../../context/CarritoContext";
import { getPreciosMonroe, getPreciosSuizo, getPreciosCofarsur, getStockDeposito } from "../../services/droguerias";
import { useAuth } from "../../context/AuthContext";
import PreciosMonroe from "../proveedores/PreciosMonroe";
import PreciosSuizo from "../proveedores/PreciosSuizo";
import PreciosCofarsur from "../proveedores/PreciosCofarsur";
import { getStock } from "../utils/obtenerStock";
import { construirResumenPedido } from "../utils/construirResumenPedido";
import ResumenPedidoModal from "../../components/ui/ResumenPedidoModal";
import { API_URL } from "../../config/api";
import { Toaster, toast } from 'react-hot-toast';
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import logo from "../../assets/logo.png";


const RevisarPedido = () => {
    const { carrito, limpiarCarritoPostPedido, eliminarDelCarrito, actualizarUnidades } = useCarrito();
    const [preciosMonroe, setPreciosMonroe] = useState([]);
    const [preciosSuizo, setPreciosSuizo] = useState([]);
    const [preciosCofarsur, setPreciosCofarsur] = useState([]);
    const [stockDeposito, setStockDeposito] = useState([]);
    const [seleccion, setSeleccion] = useState({});
    const { usuario } = useAuth();
    const [loading, setLoading] = useState(false);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [resumenFinal, setResumenFinal] = useState({});
    const [mostrarResumen, setMostrarResumen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const navigate = useNavigate();
    const [eanList, setEanList] = useState([]);
    const eanListRef = useRef([]);

    const opcionesMotivo = [
        { value: "", label: "Seleccionar motivo" },
        { value: "Faltante", label: "Faltante" },
        { value: "Stock Depo", label: "Stock Depo" },
        { value: "Mejor precio", label: "Mejor precio" },
        { value: "Llega más rápido", label: "Llega más rápido" },
        { value: "Condición / Acuerdo", label: "Condición / Acuerdo" },
        { value: "Sin troquel", label: "Sin troquel" },
    ];

    const precioValido = (p) => {
        const val = p?.offerPrice ?? p?.priceList;
        return typeof val === "number" && val > 0;
    };


    useEffect(() => {
        // EANs actuales en el carrito
        const carritoEans = carrito.map(i => i.ean).sort();
        const prevEans = eanListRef.current.sort();

        // Si hay algún EAN nuevo, recargar precios
        const hayNuevo = carritoEans.some(ean => !prevEans.includes(ean));

        if (carrito.length > 0 && usuario?.sucursal_codigo && hayNuevo) {
            const fetchData = async () => {
                setLoading(true);
                const [monroe, suizo, cofarsur, stock] = await Promise.all([
                    getPreciosMonroe(carrito, usuario?.sucursal_codigo),
                    getPreciosSuizo(carrito, usuario?.sucursal_codigo),
                    getPreciosCofarsur(carrito, usuario?.sucursal_codigo),
                    getStockDeposito(carrito, usuario?.sucursal_codigo),
                ]);

                setPreciosMonroe(monroe);
                setPreciosSuizo(suizo);
                setPreciosCofarsur(cofarsur);
                setStockDeposito(stock);

                const seleccionInicial = {};

                carrito.forEach((item) => {
                    const stockDepo = stock.find((s) => s.ean === item.ean)?.stock ?? 0;

                    if (stockDepo > 0) {
                        seleccionInicial[item.ean] = { proveedor: "deposito", motivo: "Stock Depo" };
                    } else {
                        const candidatos = [
                            {
                                proveedor: "monroe", ...monroe.find(p =>
                                    p.ean === item.ean &&
                                    p.stock > 0 &&
                                    (p.offerPrice ?? p.priceList) != null &&
                                    (p.offerPrice ?? p.priceList) > 0
                                )
                            },
                            {
                                proveedor: "suizo", ...suizo.find(p =>
                                    p.ean === item.ean &&
                                    p.stock > 0 &&
                                    (p.offerPrice ?? p.priceList) != null &&
                                    (p.offerPrice ?? p.priceList) > 0
                                )
                            },
                            {
                                proveedor: "cofarsur", ...cofarsur.find(p =>
                                    p.ean === item.ean &&
                                    p.stock > 0 &&
                                    (p.offerPrice ?? p.priceList) != null &&
                                    (p.offerPrice ?? p.priceList) > 0
                                )
                            },
                        ].filter(p => p.ean);

                        if (candidatos.length > 0) {
                            const mejor = candidatos.reduce((a, b) =>
                                (a.offerPrice ?? a.priceList) < (b.offerPrice ?? b.priceList) ? a : b
                            );

                            seleccionInicial[item.ean] = {
                                proveedor: mejor.proveedor,
                                motivo: "Mejor precio"
                            };

                        } else {
                            seleccionInicial[item.ean] = { proveedor: "faltante", motivo: "Faltante" };
                        }
                    }
                });
                setSeleccion(seleccionInicial);
                setLoading(false);
                setEanList(carritoEans);
                eanListRef.current = carritoEans;
            };

            fetchData();
        }

        // Si el carrito quedó vacío, limpiá los precios
        if (carrito.length === 0) {
            setPreciosMonroe([]);
            setPreciosSuizo([]);
            setPreciosCofarsur([]);
            setStockDeposito([]);
            setEanList([]);
            eanListRef.current = [];
        }
    }, [carrito, usuario?.sucursal_codigo]);


    const handleMotivo = (ean, motivo) => {
        setSeleccion((prev) => ({
            ...prev,
            [ean]: { ...prev[ean], motivo },
        }));
    };

    const handleElegirProveedor = (ean, nuevoProveedor) => {
        // 🔒 Si está en Faltante, nada de cambios
        if (seleccion[ean]?.motivo === "Faltante") return;

        const stockDepo = getStock(ean, stockDeposito);
        const proveedorIdeal = mejorProveedor(ean);

        setSeleccion((prev) => {
            const actual = prev[ean] ?? {};
            const motivoActual = actual.motivo;
            let nuevoMotivo = motivoActual;

            if (nuevoProveedor === "deposito" && stockDepo > 0) {
                nuevoMotivo = "Stock Depo";
            } else if (nuevoProveedor === proveedorIdeal) {
                nuevoMotivo = "Mejor precio";
            } else if (motivoActual === "Mejor precio" || motivoActual === "Stock Depo" || motivoActual === "Faltante") {
                nuevoMotivo = "";
            }

            return {
                ...prev,
                [ean]: { ...actual, proveedor: nuevoProveedor, motivo: nuevoMotivo },
            };
        });
    };



    const handleConfirmar = () => {
        const hayFaltantesDeMotivo = carrito.some((item) => {
            const motivo = seleccion[item.ean]?.motivo;
            return !motivo || motivo.trim() === "";
        });

        if (hayFaltantesDeMotivo) {
            toast.error("Tenés productos sin motivo seleccionado. Completalos antes de confirmar el pedido.");
            return;
        }


        // Evitar confirmar si algún item seleccionado (no depósito) no tiene precio válido (> 0)
        const haySinPrecioValido = carrito.some((item) => {
            const motivo = seleccion[item.ean]?.motivo;
            if (motivo === "Faltante") return false;   // ✅ Permitido

            const prov = seleccion[item.ean]?.proveedor;
            if (!prov || prov === "deposito") return false;

            const fuente =
                prov === "monroe" ? preciosMonroe :
                    prov === "suizo" ? preciosSuizo :
                        prov === "cofarsur" ? preciosCofarsur : [];

            const p = fuente.find(x => x.ean === item.ean);
            const precio = p?.offerPrice ?? p?.priceList;

            return !(typeof precio === "number" && precio > 0);
        });


        if (haySinPrecioValido) {
            alert("⚠️ Tenés productos seleccionados sin precio válido. Elegí otro proveedor o quitá esos ítems antes de confirmar.");
            return;
        }


        const carritoConPrecios = carrito.map((item) => {
            const precios = {
                deposito: 0,
                monroe: preciosMonroe.find((p) => p.ean === item.ean)?.offerPrice ?? preciosMonroe.find((p) => p.ean === item.ean)?.priceList ?? 0,
                suizo: preciosSuizo.find((p) => p.ean === item.ean)?.offerPrice ?? preciosSuizo.find((p) => p.ean === item.ean)?.priceList ?? 0,
                cofarsur: preciosCofarsur.find((p) => p.ean === item.ean)?.offerPrice ?? preciosCofarsur.find((p) => p.ean === item.ean)?.priceList ?? 0,
            };

            const fuente = [...preciosMonroe, ...preciosSuizo, ...preciosCofarsur, ...stockDeposito].find(p => p.ean === item.ean);
            const idQuantio = item.idQuantio ?? fuente?.idQuantio ?? fuente?.id ?? null;

            return {
                ...item,
                precios,
                idQuantio,
            };
        });

        const resumenFinal = construirResumenPedido(carritoConPrecios, seleccion);
        setResumenFinal(resumenFinal);
        setMostrarResumen(true);
    };


    const mejorProveedor = (ean) => {
        const candidatos = [
            { proveedor: "monroe", ...preciosMonroe.find(p => p.ean === ean && p.stock > 0 && precioValido(p)) },
            { proveedor: "suizo", ...preciosSuizo.find(p => p.ean === ean && p.stock > 0 && precioValido(p)) },
            { proveedor: "cofarsur", ...preciosCofarsur.find(p => p.ean === ean && p.stock > 0 && precioValido(p)) },
        ].filter(p => p.ean);
        if (!candidatos.length) return null;
        const mejor = candidatos.reduce((a, b) => (a.offerPrice ?? a.priceList) < (b.offerPrice ?? b.priceList) ? a : b);
        return mejor.proveedor;
    };



    useEffect(() => {
        console.log("📦 Carrito actualizado en RevisarPedido:", carrito);
    }, [carrito]);

    const handleEnviarPedido = async () => {
        if (isSending) return;
        setIsSending(true);

        const toastId = toast.loading("Enviando pedido...");

        const itemsParaEnviar = carrito.map(item => {
            const provSel = seleccion[item.ean]?.proveedor;
            const motivo = seleccion[item.ean]?.motivo;

            let proveedor = provSel;
            let precio = 0;

            if (motivo === "Faltante") {
                proveedor = "faltante";
                precio = 0;
            } else if (proveedor === "monroe") {
                const p = preciosMonroe.find(p => p.ean === item.ean);
                precio = p?.offerPrice ?? p?.priceList ?? 0;
            } else if (proveedor === "suizo") {
                const p = preciosSuizo.find(p => p.ean === item.ean);
                precio = p?.offerPrice ?? p?.priceList ?? 0;
            } else if (proveedor === "cofarsur") {
                const p = preciosCofarsur.find(p => p.ean === item.ean);
                precio = p?.offerPrice ?? p?.priceList ?? 0;
            }

            return {
                idProducto: item.idQuantio ?? null,
                codebar: item.ean,
                cantidad: item.unidades,
                precio,
                proveedor,
                motivo,
                nroPedidoDrogueria: "",
            };
        });


        try {
            const response = await fetch(`${API_URL}/api/pedidos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal: usuario?.sucursal_codigo,
                    items: itemsParaEnviar,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Pedido enviado correctamente", { id: toastId });
                setMostrarResumen(false);
                await limpiarCarritoPostPedido();
            } else {
                toast.error(`Error al enviar pedido${data?.error ? `: ${data.error}` : ""}`, { id: toastId });
            }
        } catch (err) {
            console.error("Error enviando pedido:", err);
            toast.error("Error inesperado al enviar pedido", { id: toastId });
        } finally {
            setIsSending(false);
        }
    };


    useEffect(() => {
        const nueva = { ...seleccion };
        let cambios = false;

        carrito.forEach((item) => {
            const sel = nueva[item.ean] || {};
            const prov = sel.proveedor;
            const motivo = sel.motivo;

            const stockDepo = getStock(item.ean, stockDeposito);
            const ideal = mejorProveedor(item.ean);

            // si depósito tiene stock -> motivo fijo
            if (prov === "deposito" && stockDepo > 0 && motivo !== "Stock Depo") {
                nueva[item.ean].motivo = "Stock Depo";
                cambios = true;
            }

            // si está en mejor proveedor -> motivo fijo
            if (prov === ideal && prov !== "deposito" && motivo !== "Mejor precio") {
                nueva[item.ean].motivo = "Mejor precio";
                cambios = true;
            }

            // 👇 si estaba como Faltante y ahora hay una opción válida, auto-switch a mejor
            if (motivo === "Faltante" && (stockDepo > 0 || ideal)) {
                if (stockDepo > 0) {
                    nueva[item.ean] = { proveedor: "deposito", motivo: "Stock Depo" };
                } else if (ideal) {
                    nueva[item.ean] = { proveedor: ideal, motivo: "Mejor precio" };
                }
                cambios = true;
            }
        });

        if (cambios) setSeleccion(nueva);
    }, [carrito, stockDeposito, preciosMonroe, preciosSuizo, preciosCofarsur]);

    if (loading) {
        return (
            <div className="revisar_loader">
                <div className="spinner"></div>
                <p>Cargando precios y stock...</p>
            </div>
        );
    }

    return (
        <div className="revisar_wrapper">
            <img src={logo} alt="Logo" className="buscador_logo" />

            <button className="boton-volver" onClick={() => navigate("/buscador")}>
                <span className="icono">
                    <FaArrowLeft size={12} />
                </span>
                Volver
            </button>


            <Toaster position="top-center" />
            <h2 className="revisar_titulo">Revisar pedido</h2>

            {carrito.length === 0 ? (
                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "60vh" // ajusta según quieras que baje más o menos
                }}>
                    <div className="sin-productos">
                        No hay productos en el carrito.
                    </div>
                </div>
            ) : (
                <>
                    <table className="revisar_tabla">
                        <thead>
                            <tr>
                                <th>EAN</th>
                                <th>Descripción</th>
                                <th>Unidades pedidas</th>
                                <th>Stock Sucu</th>
                                <th>Stock Depo</th>
                                <th>Monroe</th>
                                <th>Suizo</th>
                                <th>Cofarsur</th>
                                <th>Motivo</th>
                                <th>Eliminar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carrito.map((item) => {
                                const motivoActual = seleccion[item.ean]?.motivo;
                                const proveedorActual = seleccion[item.ean]?.proveedor;
                                const stockDepo = getStock(item.ean, stockDeposito);
                                const proveedorIdeal = mejorProveedor(item.ean);

                                const motivoBloqueado =
                                    (motivoActual === "Stock Depo" && proveedorActual === "deposito" && stockDepo > 0);

                                const tieneAlgunoConPrecio = !![
                                    preciosMonroe.find(p => p.ean === item.ean && p.stock > 0 && precioValido(p)),
                                    preciosSuizo.find(p => p.ean === item.ean && p.stock > 0 && precioValido(p)),
                                    preciosCofarsur.find(p => p.ean === item.ean && p.stock > 0 && precioValido(p)),
                                ].filter(Boolean).length || getStock(item.ean, stockDeposito) > 0;


                                return (
                                    <tr key={item.ean}>
                                        <td>{item.ean}</td>
                                        <td>{item.descripcion}</td>
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

                                        <td>{item.stockSucursal}</td>
                                        <td className={seleccion[item.ean]?.proveedor === "deposito" ? "celda_activa" : ""}>
                                            <div
                                                className="precio_celda"
                                                onClick={() => {
                                                    const stock = getStock(item.ean, stockDeposito);
                                                    if (typeof stock === "number" && stock > 0) {
                                                        handleElegirProveedor(item.ean, "deposito");
                                                    }
                                                }}
                                                style={{ fontWeight: "bold", cursor: "pointer" }}
                                            >
                                                {getStock(item.ean, stockDeposito)}
                                                <span
                                                    style={{
                                                        color: "#00bcd4",
                                                        marginLeft: "5px",
                                                        visibility: seleccion[item.ean]?.proveedor === "deposito" ? "visible" : "hidden",
                                                    }}
                                                >
                                                    ✔
                                                </span>
                                            </div>
                                        </td>
                                        <td className={seleccion[item.ean]?.proveedor === "monroe" ? "celda_activa" : ""}>
                                            <PreciosMonroe
                                                ean={item.ean}
                                                precios={preciosMonroe}
                                                seleccionado={seleccion[item.ean]?.proveedor === "monroe"}
                                                onSelect={handleElegirProveedor}
                                            />
                                        </td>
                                        <td className={seleccion[item.ean]?.proveedor === "suizo" ? "celda_activa" : ""}>
                                            <PreciosSuizo
                                                ean={item.ean}
                                                precios={preciosSuizo}
                                                seleccionado={seleccion[item.ean]?.proveedor === "suizo"}
                                                onSelect={handleElegirProveedor}
                                            />
                                        </td>
                                        <td className={seleccion[item.ean]?.proveedor === "cofarsur" ? "celda_activa" : ""}>
                                            <PreciosCofarsur
                                                ean={item.ean}
                                                precios={preciosCofarsur}
                                                seleccionado={seleccion[item.ean]?.proveedor === "cofarsur"}
                                                onSelect={handleElegirProveedor}
                                            />
                                        </td>
                                        <td>
                                            <select
                                                value={motivoActual || ""}
                                                onChange={(e) => handleMotivo(item.ean, e.target.value)}
                                                disabled={motivoBloqueado || motivoActual === "Faltante"}
                                            >
                                                {opcionesMotivo.map((op) => {
                                                    const isBlocked =
                                                        (op.value === "Stock Depo" && (proveedorActual !== "deposito" || stockDepo <= 0)) |
                                                        (op.value === "Faltante" && tieneAlgunoConPrecio);
                                                    return (
                                                        <option key={op.value} value={op.value} disabled={op.value === "" || isBlocked}>
                                                            {op.label}
                                                        </option>
                                                    );
                                                })}

                                            </select>

                                        </td>
                                        <td>
                                            <button
                                                className="carrito_icon_btn"
                                                title="Eliminar del carrito"
                                                onClick={() => eliminarDelCarrito(item.ean)}
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                </>
            )}
            {carrito.length > 0 && (
                <div className="revisar_footer">
                    <button className="revisar_btn_confirmar" onClick={handleConfirmar}>
                        Confirmar pedido
                    </button>
                </div>
            )}

            {mostrarResumen && (
                <ResumenPedidoModal
                    resumen={resumenFinal}
                    onClose={() => setMostrarResumen(false)}
                    onEnviar={handleEnviarPedido}
                    isSending={isSending}
                />
            )}
        </div>

    );
};

export default RevisarPedido;
