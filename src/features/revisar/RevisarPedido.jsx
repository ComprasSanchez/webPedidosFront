
import { useEffect, useState } from "react";
import { useCarrito } from "../../context/CarritoContext";
import { getPreciosMonroe, getPreciosSuizo, getPreciosCofarsur, getStockDeposito } from "../../services/droguerias";
import { useAuth } from "../../context/AuthContext";
import PreciosMonroe from "../proveedores/PreciosMonroe";
import PreciosSuizo from "../proveedores/PreciosSuizo";
import PreciosCofarsur from "../proveedores/PreciosCofarsur";
import { getStock } from "../utils/obtenerStock";
import { construirResumenPedido } from "../utils/construirResumenPedido";
import ResumenPedidoModal from "../../components/ui/ResumenPedidoModal";

const RevisarPedido = () => {
    const { carrito } = useCarrito();
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

    const opcionesMotivo = [
        { value: "", label: "Seleccionar motivo" },
        { value: "Stock Depo", label: "Stock Depo" },
        { value: "Mejor precio", label: "Mejor precio" },
        { value: "Llega más rápido", label: "Llega más rápido" },
        { value: "Condición / Acuerdo", label: "Condición / Acuerdo" },
        { value: "Sin troquel", label: "Sin troquel" }
    ];


    useEffect(() => {
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
                        { proveedor: "monroe", ...monroe.find(p => p.ean === item.ean && (p.offerPrice ?? p.priceList) != null && p.stock > 0) },
                        { proveedor: "suizo", ...suizo.find(p => p.ean === item.ean && (p.offerPrice ?? p.priceList) != null && p.stock > 0) },
                        { proveedor: "cofarsur", ...cofarsur.find(p => p.ean === item.ean && (p.offerPrice ?? p.priceList) != null && p.stock > 0) },
                    ].filter(p => p.ean);


                    console.log(`🔎 Candidatos con stock para ${item.ean}:`, candidatos.map(c => ({
                        proveedor: c.proveedor,
                        precio: c.offerPrice ?? c.priceList,
                        stock: c.stock,
                    })));

                    if (candidatos.length > 0) {
                        const mejor = candidatos.reduce((a, b) =>
                            (a.offerPrice ?? a.priceList) < (b.offerPrice ?? b.priceList) ? a : b
                        );

                        console.log(`⭐ Se selecciona MEJOR PRECIO: ${mejor.proveedor} ($${(mejor.offerPrice ?? mejor.priceList).toFixed(2)}) para ${item.ean}`);
                        seleccionInicial[item.ean] = {
                            proveedor: mejor.proveedor,
                            motivo: "Mejor precio"
                        };

                    } else {
                        console.warn(`❌ Sin proveedores con stock para ${item.ean}`);
                    }
                }
            });
            console.log("🟢 Selección inicial:", seleccionInicial);
            setSeleccion(seleccionInicial);
            setLoading(false);
        };


        if (carrito.length > 0 && usuario?.sucursal_codigo) {
            fetchData();
        }
    }, [carrito, usuario]);


    const handleMotivo = (ean, motivo) => {
        setSeleccion((prev) => ({
            ...prev,
            [ean]: { ...prev[ean], motivo },
        }));
    };

    const handleElegirProveedor = (ean, nuevoProveedor) => {
        const stockDepo = getStock(ean, stockDeposito);
        const proveedorIdeal = mejorProveedor(ean);

        setSeleccion((prev) => {
            const motivoActual = prev[ean]?.motivo;

            let nuevoMotivo = motivoActual;

            // Si eligió depósito con stock → motivo fijo
            if (nuevoProveedor === "deposito" && stockDepo > 0) {
                nuevoMotivo = "Stock Depo";
            }
            // Si eligió el mejor proveedor → motivo fijo
            else if (nuevoProveedor === proveedorIdeal) {
                nuevoMotivo = "Mejor precio";
            }
            // Si NO es depósito ni el mejor → motivo queda vacío o lo que ya tenía
            else if (motivoActual === "Mejor precio" || motivoActual === "Stock Depo") {
                nuevoMotivo = "";
            }

            return {
                ...prev,
                [ean]: {
                    ...prev[ean],
                    proveedor: nuevoProveedor,
                    motivo: nuevoMotivo,
                },
            };
        });
    };


    const handleConfirmar = () => {
        const hayFaltantesDeMotivo = carrito.some((item) => {
            const motivo = seleccion[item.ean]?.motivo;
            return !motivo || motivo.trim() === "";
        });

        if (hayFaltantesDeMotivo) {
            alert("⚠️ Tenés productos sin motivo seleccionado. Completalos antes de confirmar el pedido.");
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
            { proveedor: "monroe", ...preciosMonroe.find(p => p.ean === ean && (p.offerPrice ?? p.priceList) != null && p.stock > 0) },
            { proveedor: "suizo", ...preciosSuizo.find(p => p.ean === ean && (p.offerPrice ?? p.priceList) != null && p.stock > 0) },
            { proveedor: "cofarsur", ...preciosCofarsur.find(p => p.ean === ean && (p.offerPrice ?? p.priceList) != null && p.stock > 0) },
        ].filter(p => p.ean);

        if (candidatos.length === 0) return null;

        const mejor = candidatos.reduce((a, b) =>
            (a.offerPrice ?? a.priceList) < (b.offerPrice ?? b.priceList) ? a : b
        );

        return mejor.proveedor;
    };

    useEffect(() => {
        console.log("📦 Carrito actualizado en RevisarPedido:", carrito);
    }, [carrito]);

    const handleEnviarPedido = async () => {

        const itemsParaEnviar = carrito.map(item => {
            console.log(`🔍 Procesando item: ${item}`);

            const proveedor = seleccion[item.ean]?.proveedor;
            const motivo = seleccion[item.ean]?.motivo;

            let precio = 0;
            if (proveedor === 'monroe') {
                const p = preciosMonroe.find(p => p.ean === item.ean);
                precio = p?.offerPrice ?? p?.priceList ?? 0;
            } else if (proveedor === 'suizo') {
                const p = preciosSuizo.find(p => p.ean === item.ean);
                precio = p?.offerPrice ?? p?.priceList ?? 0;
            } else if (proveedor === 'cofarsur') {
                const p = preciosCofarsur.find(p => p.ean === item.ean);
                precio = p?.offerPrice ?? p?.priceList ?? 0;
            }

            return {
                idProducto: item.idQuantio ?? null, // asegurate que esté en el carrito
                codebar: item.ean,
                cantidad: item.unidades,
                precio,
                proveedor,
                motivo,
                nroPedidoDrogueria: "", // lo completarás después
            };
        });

        try {
            const response = await fetch("http://localhost:4000/api/pedidos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal: usuario?.sucursal_codigo,
                    items: itemsParaEnviar,
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert("✅ Pedido enviado correctamente");
                setMostrarResumen(false);
            } else {
                alert("❌ Error al enviar pedido");
            }
        } catch (err) {
            console.error("Error enviando pedido:", err);
            alert("❌ Error inesperado al enviar pedido");
        }
    };


    useEffect(() => {
        const nuevaSeleccion = { ...seleccion };

        let cambios = false;

        carrito.forEach((item) => {
            const prov = nuevaSeleccion[item.ean]?.proveedor;
            const motivo = nuevaSeleccion[item.ean]?.motivo;
            const stockDepo = getStock(item.ean, stockDeposito);
            const ideal = mejorProveedor(item.ean);

            if (prov === "deposito" && stockDepo > 0 && motivo !== "Stock Depo") {
                nuevaSeleccion[item.ean].motivo = "Stock Depo";
                cambios = true;
            }

            if (prov === ideal && motivo !== "Mejor precio" && prov !== "deposito") {
                nuevaSeleccion[item.ean].motivo = "Mejor precio";
                cambios = true;
            }
        });

        if (cambios) {
            setSeleccion(nuevaSeleccion);
        }
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
            <h2 className="revisar_titulo">Revisar pedido</h2>
            <table className="revisar_tabla">
                <thead>
                    <tr>
                        <th>EAN</th>
                        <th>Descripción</th>
                        <th>Unidades pedidas</th>
                        <th>Stock Depo</th>
                        <th>Monroe</th>
                        <th>Suizo</th>
                        <th>Cofarsur</th>
                        <th>Motivo</th>
                    </tr>
                </thead>
                <tbody>
                    {carrito.map((item) => {
                        const motivoActual = seleccion[item.ean]?.motivo;
                        const proveedorActual = seleccion[item.ean]?.proveedor;
                        const stockDepo = getStock(item.ean, stockDeposito);
                        const proveedorIdeal = mejorProveedor(item.ean);

                        const motivoBloqueado =
                            (motivoActual === "Stock Depo" && proveedorActual === "deposito" && stockDepo > 0) ||
                            (motivoActual === "Mejor precio" && proveedorActual === proveedorIdeal);

                        return (
                            <tr key={item.ean}>
                                <td>{item.ean}</td>
                                <td>{item.descripcion}</td>
                                <td>{item.unidades}</td>
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
                                        disabled={motivoBloqueado}
                                    >
                                        {opcionesMotivo.map((op) => {
                                            const isBlocked =
                                                (op.value === "Stock Depo" && (proveedorActual !== "deposito" || stockDepo <= 0)) ||
                                                (op.value === "Mejor precio" && proveedorActual !== proveedorIdeal);

                                            return (
                                                <option
                                                    key={op.value}
                                                    value={op.value}
                                                    disabled={op.value === "" || isBlocked}
                                                >
                                                    {op.label}
                                                </option>
                                            );
                                        })}
                                    </select>

                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

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
                />
            )}
        </div>

    );
};

export default RevisarPedido;
