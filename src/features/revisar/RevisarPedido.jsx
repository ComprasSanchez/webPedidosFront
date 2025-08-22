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
import { FaArrowLeft, FaCheckSquare, FaSquare, FaTrash } from "react-icons/fa";
import logo from "../../assets/logo.png";
import { Tooltip } from 'react-tooltip';
import PreciosKellerof from "../proveedores/PreciosKellerof";
import { fetchConvenios, matchConvenio } from "../../services/convenios";
import UltimosPedidos from "../pedidos/UltimosPedidos";


const RevisarPedido = () => {
    const { carrito, limpiarCarritoPostPedido, eliminarDelCarrito, actualizarUnidades, replaceCarrito } = useCarrito();
    const [preciosMonroe, setPreciosMonroe] = useState([]);
    const [preciosSuizo, setPreciosSuizo] = useState([]);
    const [preciosCofarsur, setPreciosCofarsur] = useState([]);
    const [stockDeposito, setStockDeposito] = useState([]);
    const [seleccion, setSeleccion] = useState({});
    const { authFetch, authHeaders, usuario } = useAuth();
    const [loading, setLoading] = useState(false);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [resumenFinal, setResumenFinal] = useState({});
    const [noPedirMap, setNoPedirMap] = useState({}); // { [ean]: true }
    const [mostrarResumen, setMostrarResumen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const navigate = useNavigate();
    const [eanList, setEanList] = useState([]);
    const eanListRef = useRef([]);
    const [reglasConvenios, setReglasConvenios] = useState(null);

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
        console.log("📦 Carrito actualizado en RevisarPedido:", carrito);
        // hidratar mapa desde el carrito (si ya viene con noPedir en Redis)
        const initial = {};
        carrito.forEach(it => { if (it?.noPedir) initial[it.ean] = true; });
        setNoPedirMap(initial);
    }, [carrito]);


    const toggleNoPedir = async (ean, checked) => {
        setNoPedirMap(prev => {
            const next = { ...prev };
            if (checked) next[ean] = true; else delete next[ean];
            persistirCarritoConNoPedir(next);
            return next;
        });
    };

    async function persistirCarrito(items) {
        try {
            await fetch(`${API_URL}/api/cart`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": usuario?.id ?? "",
                    "x-sucursal": usuario?.sucursal_codigo ?? ""
                },
                body: JSON.stringify({ items })
            });
        } catch (e) {
            console.warn("No se pudo persistir el carrito:", e?.message || e);
        }
    }

    async function persistirCarritoConNoPedir(nextMap) {
        try {
            const items = carrito.map(it => ({
                ...it,
                noPedir: !!nextMap[it.ean],
            }));
            await persistirCarrito(items);
        } catch (e) {
            console.warn("No se pudo persistir carrito con noPedir:", e?.message || e);
        }
    }


    useEffect(() => {
        // EANs actuales en el carrito
        const carritoEans = carrito.map(i => i.ean).sort();
        const prevEans = eanListRef.current.sort();

        // Si hay algún EAN nuevo, recargar precios
        const hayNuevo = carritoEans.some(ean => !prevEans.includes(ean));

        if (carrito.length > 0 && usuario?.sucursal_codigo && hayNuevo && reglasConvenios) {
            const fetchData = async () => {
                setLoading(true);
                const [monroe, suizo, cofarsur, stock] = await Promise.all([
                    getPreciosMonroe(carrito, usuario?.sucursal_codigo, { fetch: authFetch, headers: authHeaders }),
                    getPreciosSuizo(carrito, usuario?.sucursal_codigo, { fetch: authFetch, headers: authHeaders }),
                    getPreciosCofarsur(carrito, usuario?.sucursal_codigo, { fetch: authFetch, headers: authHeaders }),
                    getStockDeposito(carrito, usuario?.sucursal_codigo),
                ]);

                setPreciosMonroe(monroe);
                setPreciosSuizo(suizo);
                setPreciosCofarsur(cofarsur);
                setStockDeposito(stock);

                const ctx = { stockDeposito: stock, preciosMonroe: monroe, preciosSuizo: suizo, preciosCofarsur: cofarsur };

                const seleccionInicial = {};
                carrito.forEach((item) => {
                    console.groupCollapsed(`🧮 Selección inicial para ${item.ean}`);
                    const match = matchConvenio(item, reglasConvenios);
                    console.debug("matchConvenio:", match);

                    if (match.aplica) {
                        // prioridad estricta (puede incluir "deposito" y "kellerof")
                        const elegido = pickPorPrioridad(item, match.prioridad, ctx);
                        console.debug("resultado convenio:", elegido);
                        if (elegido) {
                            seleccionInicial[item.ean] = { proveedor: elegido, motivo: "Condición / Acuerdo" };
                            return;
                        }
                        // ninguna opción viable y el primero no es externo → faltante
                        seleccionInicial[item.ean] = { proveedor: "faltante", motivo: "Faltante" };
                        return;
                    }

                    // SIN convenio → tu fallback de siempre
                    const stockDepo = stock.find(s => s.ean === item.ean)?.stock ?? 0;
                    if (stockDepo > 0) {
                        seleccionInicial[item.ean] = { proveedor: "deposito", motivo: "Stock Depo" };
                        return;
                    }

                    const candidatos = [
                        { proveedor: "monroe", ...monroe.find(p => p.ean === item.ean && p.stock > 0 && (p.offerPrice ?? p.priceList) > 0) },
                        { proveedor: "suizo", ...suizo.find(p => p.ean === item.ean && p.stock > 0 && (p.offerPrice ?? p.priceList) > 0) },
                        { proveedor: "cofarsur", ...cofarsur.find(p => p.ean === item.ean && p.stock > 0 && (p.offerPrice ?? p.priceList) > 0) },
                    ].filter(p => p.ean);

                    if (candidatos.length) {
                        const mejor = candidatos.reduce((a, b) => (a.offerPrice ?? a.priceList) < (b.offerPrice ?? b.priceList) ? a : b);
                        seleccionInicial[item.ean] = { proveedor: mejor.proveedor, motivo: "Mejor precio" };
                    } else {
                        seleccionInicial[item.ean] = { proveedor: "faltante", motivo: "Faltante" };
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
    }, [carrito, usuario?.sucursal_codigo, reglasConvenios]);

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


    // ADD: traer reglas de convenios (una vez por sucursal)
    useEffect(() => {
        if (!usuario?.sucursal_codigo) return;
        (async () => {
            try {
                const reglas = await fetchConvenios(usuario.sucursal_codigo);
                console.log("🧩 Convenios cargados:", reglas);
                setReglasConvenios(reglas);
            } catch (e) {
                console.error("❌ Error cargando convenios:", e);
                setReglasConvenios({ byEAN: {}, byLAB: {} });
            }
        })();
    }, [usuario?.sucursal_codigo]);



    function proveedorViable(slug, ean, ctx) {
        if (slug === "deposito") {
            const s = ctx.stockDeposito.find(x => x.ean === ean)?.stock ?? 0;
            console.debug("🔎 viable? deposito", { ean, stock: s, ok: s > 0 });
            return s > 0;
        }
        if (slug === "kellerof") {
            console.debug("🔎 viable? kellerof", { ean, ok: true });
            return true;
        }
        const fuente =
            slug === "monroe" ? ctx.preciosMonroe :
                slug === "suizo" ? ctx.preciosSuizo :
                    slug === "cofarsur" ? ctx.preciosCofarsur : [];
        const p = fuente.find(x => x.ean === ean);
        const val = p?.offerPrice ?? p?.priceList;
        const ok = p?.stock > 0 && typeof val === "number" && val > 0;
        console.debug("🔎 viable?", { ean, slug, stock: p?.stock, precio: val, ok });
        return ok;
    }


    // ADD: dado un item y una prioridad estricta, elegí el 1° viable
    function pickPorPrioridad(item, prioridad, ctx) {
        console.groupCollapsed(`⚖️ Prioridad para ${item.ean} [${prioridad.join(" > ")}]`);
        for (const slug of prioridad) {
            const ok = proveedorViable(slug, item.ean, ctx);
            console.debug(`➡️ probar ${slug}: ${ok ? "✅" : "❌"}`);
            if (ok) {
                console.groupEnd();
                return slug;
            }
        }
        if (prioridad[0] === "kellerof") {
            console.debug("ninguno viable; devolvemos kellerof igual para que prueben en web");
            console.groupEnd();
            return "kellerof";
        }
        console.debug("❌ ninguno viable → Faltante");
        console.groupEnd();
        return null;
    }



    const handleMotivo = (ean, motivo) => {
        setSeleccion((prev) => ({
            ...prev,
            [ean]: { ...prev[ean], motivo },
        }));
    };

    const handleElegirProveedor = (ean, nuevoProveedor) => {
        const item = carrito.find(x => x.ean === ean);
        const stockDepo = getStock(ean, stockDeposito);
        const match = matchConvenio(item, reglasConvenios);

        // tu mejorProveedor(ean) actual sirve como “mejor precio” si NO hay convenio
        const proveedorIdeal = mejorProveedor(ean);

        setSeleccion(prev => {
            const actual = prev[ean] ?? {};
            let nuevoMotivo = actual.motivo;

            if (nuevoProveedor === "deposito" && stockDepo > 0) {
                nuevoMotivo = "Stock Depo";
            } else if (match.aplica && match.prioridad.includes(nuevoProveedor)) {
                nuevoMotivo = "Condición / Acuerdo";
            } else if (!match.aplica && nuevoProveedor === proveedorIdeal) {
                nuevoMotivo = "Mejor precio";
            } else if (["Mejor precio", "Stock Depo", "Faltante", "Condición / Acuerdo"].includes(actual.motivo)) {
                // si elige algo fuera de esas condiciones, limpiamos motivo para forzar que lo justifique
                nuevoMotivo = "";
            }

            return { ...prev, [ean]: { ...actual, proveedor: nuevoProveedor, motivo: nuevoMotivo } };
        });
    };




    const handleConfirmar = () => {
        const hayFaltantesDeMotivo = carrito
            .filter(item => !noPedirMap[item.ean])
            .some((item) => {
                const motivo = seleccion[item.ean]?.motivo;
                return !motivo || motivo.trim() === "";
            });

        if (hayFaltantesDeMotivo) {
            toast.error("Tenés productos sin motivo seleccionado. Completalos antes de confirmar el pedido.");
            return;
        }

        const haySinPrecioValido = carrito
            .filter(item => !noPedirMap[item.ean])
            .some((item) => {
                const motivo = seleccion[item.ean]?.motivo;
                if (motivo === "Faltante") return false;
                const prov = seleccion[item.ean]?.proveedor;
                if (!prov || prov === "deposito" || prov === "kellerof") return false;
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

        const carritoFiltrado = carrito.filter(it => !noPedirMap[it.ean]);
        if (carritoFiltrado.length === 0) {
            toast("No hay líneas para enviar (todas marcadas como “No pedir”).");
            return;
        }

        const carritoConPrecios = carritoFiltrado.map((item) => {
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


    const handleEnviarPedido = async () => {
        if (isSending) return;
        setIsSending(true);

        const toastId = toast.loading("Enviando pedido...");

        const itemsParaEnviar = carrito
            .filter(item => !noPedirMap[item.ean])
            .map(item => {
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
                } else if (proveedor === "kellerof") {
                    precio = 0;
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
                const enviados = new Set(itemsParaEnviar.map(i => i.codebar));
                const restantes = carrito
                    .filter(it => !enviados.has(it.ean))
                    .map(it => ({ ...it, noPedir: !!noPedirMap[it.ean] }));

                await persistirCarrito(restantes);
                replaceCarrito(restantes);
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
                    minHeight: "60vh"
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


                                const estaPedir = !noPedirMap[item.ean];
                                const estaNoPedir = !estaPedir;

                                return (
                                    <tr key={item.ean} className={estaNoPedir ? "fila_omitida" : ""}>
                                        <td
                                            data-tooltip-id={`lab-${item.ean}`}
                                            data-tooltip-content={item.laboratorio ? `Laboratorio: ${item.laboratorio}` : ""}
                                            style={{ cursor: item.laboratorio ? 'help' : 'default' }}
                                        >
                                            {item.descripcion}{" "}
                                            <span style={{ fontWeight: "bold", color: "#000000ff" }}>
                                                ({item.ean})
                                            </span>

                                            {item.laboratorio && (
                                                <Tooltip
                                                    id={`lab-${item.ean}`}
                                                    place="bottom"
                                                    style={{
                                                        backgroundColor: '#333',
                                                        color: '#fff',
                                                        borderRadius: '4px',
                                                        padding: '6px 10px',
                                                        fontSize: '0.85rem'
                                                    }}
                                                />
                                            )}
                                        </td>


                                        <td>
                                            <div className="qty">
                                                <button
                                                    disabled={estaNoPedir}
                                                    className="qty__btn"
                                                    onClick={() =>
                                                        actualizarUnidades(item.ean, Math.max(1, (item.unidades || 1) - 1))
                                                    }
                                                >
                                                    −
                                                </button>

                                                <span className="qty__num">{item.unidades || 1}</span>

                                                <button
                                                    disabled={estaNoPedir}
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
                                                onClick={() => { if (!estaNoPedir) { handleElegirProveedor(item.ean, "deposito"); } }}
                                                style={{
                                                    fontWeight: "bold",
                                                    cursor: estaNoPedir ? "not-allowed" : "pointer",
                                                    opacity: estaNoPedir ? 0.5 : 1
                                                }}
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
                                        <td className={"celda_kellerof" + (seleccion[item.ean]?.proveedor === "kellerof" ? " celda_activa" : "")}>
                                            <PreciosKellerof
                                                ean={item.ean}
                                                seleccionado={seleccion[item.ean]?.proveedor === "kellerof"}
                                                onSelect={handleElegirProveedor}
                                            />
                                        </td>

                                        <td>
                                            <select
                                                value={motivoActual || ""}
                                                onChange={(e) => handleMotivo(item.ean, e.target.value)}
                                                disabled={estaNoPedir || motivoBloqueado || motivoActual === "Faltante"}
                                            >
                                                {opcionesMotivo.map((op) => {
                                                    const isBlocked =
                                                        (op.value === "Stock Depo" && (proveedorActual !== "deposito" || stockDepo <= 0)) ||
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
                                        <td
                                            onClick={() => {
                                                const noPedirChecked = estaPedir; // si está en pedir => destildo (no pedir)
                                                toggleNoPedir(item.ean, noPedirChecked);
                                            }}
                                            style={{
                                                textAlign: "center",
                                                cursor: "pointer",
                                                fontSize: "1.3rem",     // tamaño del icono
                                                color: estaPedir ? "#00bcd4" : "#888", // color activo/inactivo
                                            }}
                                        >
                                            {estaPedir ? <FaCheckSquare /> : <FaSquare />}
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

            <UltimosPedidos />

        </div>

    );
};

export default RevisarPedido;
