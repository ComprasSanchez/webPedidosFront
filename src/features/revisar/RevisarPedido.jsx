// RevisarPedido.jsx (resumido)
import { useAuth } from "../../context/AuthContext";
import { useCarrito } from "../../context/CarritoContext";
import { usePreciosYStock } from "./hooks/usePreciosYStock";
import { useConvenios } from "./hooks/useConvenios";
import { useSeleccionAutomatica } from "./hooks/useSeleccionAutomatica";
import { usePersistenciaCarrito } from "./hooks/usePersistenciaCarrito";
import { mejorProveedor, precioValido } from "./logic/mejorProveedor";
import { getStock } from "../utils/obtenerStock";
import TablaRevisar from "./components/TablaRevisar";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { API_URL } from "../../config/api";
import { construirResumenPedido } from "../utils/construirResumenPedido";
import ResumenPedidoModal from "../../components/ui/ResumenPedidoModal";
import HelpButton from "../../components/ui/HelpButton";
import UltimosPedidos from "../pedidos/UltimosPedidos";
import { getPreciosItem, getPrecioFinal } from "./utils/precioUtils";
import SinProductos from "./components/SinProductos";
import { requiereJustificacion } from "./logic/validaciones";
import Modal from "../../components/ui/Modal";


export default function RevisarPedido() {
    const [mostrarResumen, setMostrarResumen] = useState(false);
    const [resumenFinal, setResumenFinal] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const navigate = useNavigate();
    const { carrito, eliminarDelCarrito, actualizarUnidades, replaceCarrito } = useCarrito();
    const { authFetch, authHeaders, usuario } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [reservaVencida, setReservaVencida] = useState(false);
    const [graciaActiva, setGraciaActiva] = useState(false);
    const timeoutRef = useRef(null);
    const graciaRef = useRef(null);

    // Estado reactivo para la sucursal seleccionada (usuarios de compras)
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState(() => {
        const stored = sessionStorage.getItem("sucursalReponer");
        return stored || "";
    });

    // Efecto para escuchar cambios en sessionStorage
    useEffect(() => {
        if (usuario?.rol !== "compras") return;

        const handleStorageChange = () => {
            const nuevaSucursal = sessionStorage.getItem("sucursalReponer") || "";
            if (nuevaSucursal !== sucursalSeleccionada) {
                setSucursalSeleccionada(nuevaSucursal);
            }
        };

        window.addEventListener("storage", handleStorageChange);
        const interval = setInterval(handleStorageChange, 1000);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, [sucursalSeleccionada, usuario?.rol]);

    // Determinar la sucursal actual según el rol
    const sucursalActual = usuario?.rol === "compras" ? sucursalSeleccionada : usuario?.sucursal_codigo;

    // Validación: sucursal debe ser una cadena no vacía
    const sucursalValida = sucursalActual && typeof sucursalActual === 'string' && sucursalActual.trim() !== '';

    const cancelarReservaSoft = async () => {

        try {
            // Validar que tenemos sucursal antes de hacer la petición
            if (!sucursalValida) {
                return;
            }

            const response = await authFetch(`${API_URL}/api/pedidos/reservas-soft/cancelar-soft`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-sucursal": sucursalActual
                }
            });


            if (response.ok) {
                const data = await response.json();
            } else {
                console.error("❌ Error en respuesta de cancelación:", response.status);
            }
        } catch (error) {
            console.error("❌ Error al cancelar reserva SOFT:", error.message);
            console.error("❌ Error completo:", error);
        }
    };

    const regenerarReservasSoft = async () => {
        try {
            // Validar que tenemos sucursal antes de hacer la petición
            if (!sucursalValida) {
                return;
            }

            const response = await authFetch(`${API_URL}/api/pedidos/reservas-soft/soft`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sucursal': sucursalActual
                },
                body: JSON.stringify({
                    items: carrito
                        .filter(item => item.idQuantio) // Solo productos con ID válido
                        .map(item => ({
                            idproducto: item.idQuantio,
                            cantidad: item.unidades || 1
                        }))
                })
            });

            if (response.ok) {
                // ...
            } else {
                if (response.status === 401) {
                    toast.error("Sesión expirada. Por favor, inicia sesión nuevamente.");
                    // Opcional: redirigir al login
                    // navigate("/login");
                } else {
                    toast.error("Error al regenerar reservas. Revisa la consola para más detalles.");
                }
            }
        } catch (error) {
            toast.error("Error de conexión al regenerar reservas.");
            // No bloqueamos el flujo, solo logueamos
        }
    };

    useEffect(() => {
        if (!carrito.length) {
            setShowModal(false);
            setReservaVencida(false);
            setGraciaActiva(false);
            return;
        }

        // Resetear estados cuando el carrito cambia
        setShowModal(false);
        setReservaVencida(false);
        setGraciaActiva(false);

        const calcularTimeout = () => {
            const base = 180; // 3 minutos en producción
            const extra = carrito.length * 45; // Tiempo extra basado en cantidad de productos
            return Math.max(base, base + extra);
        };

        const tiempoTotal = calcularTimeout();

        // Timer principal
        timeoutRef.current = setTimeout(() => {
            setShowModal(true);
            setGraciaActiva(true);

            // Timer de gracia (1 minuto)
            graciaRef.current = setTimeout(() => {
                setReservaVencida(true);
                setGraciaActiva(false);
                // Cancelar reserva soft
                cancelarReservaSoft();
            }, 60000); // 1 minuto
        }, tiempoTotal * 1000);

        return () => {
            clearTimeout(timeoutRef.current);
            clearTimeout(graciaRef.current);
        };
    }, [carrito]);

    const { preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, loading: loadingPS }
        = usePreciosYStock({ carrito, sucursal: sucursalActual, authFetch, authHeaders });

    const { reglas, ready, matchConvenio } = useConvenios({ sucursal: sucursalActual });

    // Crear una versión de getStock que ya tenga la sucursal aplicada
    const getStockConSucursal = (idQuantio, stockData) => getStock(idQuantio, stockData, sucursalActual);

    const { seleccion, setSeleccion } = useSeleccionAutomatica({
        carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock: getStockConSucursal, sucursal: sucursalActual
    });

    const { noPedirMap, toggleNoPedir, persistirCarrito } = usePersistenciaCarrito({ carrito, usuario, replaceCarrito });

    const datosCompletos = !!(preciosMonroe?.length || preciosSuizo?.length || preciosCofarsur?.length || stockDisponible?.length);
    const loading = loadingPS || !ready;

    // Mostrar toast cuando termine el loading y haya flag de actualización
    useEffect(() => {
        const flag = localStorage.getItem('preciosActualizados');
        const timestamp = localStorage.getItem('preciosActualizadosTime');
        const now = Date.now();
        const recentReload = timestamp && (now - parseInt(timestamp)) < 5000; // 5 segundos

        // Mostrar toast si terminó loading, hay datos Y (hay flag O fue recarga reciente)
        if (!loading && datosCompletos && (flag === 'true' || recentReload)) {
            localStorage.removeItem('preciosActualizados');
            localStorage.removeItem('preciosActualizadosTime');
            toast.success("Precios y stock actualizados");
        }
    }, [loading, datosCompletos]);

    const handleMotivo = (idQuantio, motivo) => setSeleccion(prev => ({ ...prev, [idQuantio]: { ...prev[idQuantio], motivo } }));

    // Permitir que handleElegirProveedor reciba idQuantio o ean (para Kellerhoff)
    const handleElegirProveedor = (idQuantioOrEan, nuevoProveedor) => {
        let item = carrito.find(x => x.idQuantio === idQuantioOrEan);
        if (!item) {
            // fallback para Kellerhoff, que pasa ean
            item = carrito.find(x => x.ean === idQuantioOrEan);
        }
        if (!item) return;
        const stockDepo = getStock(item.idQuantio, stockDisponible, sucursalActual);
        const match = matchConvenio(item, reglas);
        const proveedorIdeal = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });

        // Validar que no se pueda seleccionar depósito si el stock no es válido
        if (nuevoProveedor === "deposito") {
            if (typeof stockDepo !== "number" || stockDepo <= 0) {
                toast.error("No se puede seleccionar depósito: stock no disponible");
                return;
            }
        }

        setSeleccion(prev => {
            const actual = prev[item.idQuantio] ?? {};
            let nuevoMotivo = actual.motivo;

            if (nuevoProveedor === "deposito" && stockDepo > 0) {
                nuevoMotivo = "Stock Depo";
            } else if (match?.aplica && match.prioridad?.includes(nuevoProveedor)) {
                nuevoMotivo = "Condición / Acuerdo";
            } else if (!match?.aplica && nuevoProveedor === proveedorIdeal) {
                nuevoMotivo = "Mejor precio";
            } else if (["Mejor precio", "Stock Depo", "Falta", "Condición / Acuerdo"].includes(actual.motivo)) {
                // si sale de esas condiciones, pedimos justificación manual
                nuevoMotivo = "";
            }

            return { ...prev, [item.idQuantio]: { ...actual, proveedor: nuevoProveedor, motivo: nuevoMotivo } };
        });
    };


    const handleConfirmar = () => {

        const hayFaltasDeMotivo = carrito
            .filter(item => !noPedirMap[item.idQuantio])
            .some((item) => {
                const motivo = seleccion[item.idQuantio]?.motivo;
                const req = requiereJustificacion(motivo);
                return req;
            });


        if (hayFaltasDeMotivo) {
            toast.error("Tenés productos sin motivo seleccionado. Completalos antes de confirmar el pedido.");
            return;
        }


        const haySinPrecioValido = carrito
            .filter(item => !noPedirMap[item.idQuantio])
            .some((item) => {
                const motivo = seleccion[item.idQuantio]?.motivo;
                if (motivo === "Falta") return false;
                const prov = seleccion[item.idQuantio]?.proveedor;
                if (!prov || prov === "deposito" || prov === "kellerhoff") return false;
                const fuente =
                    prov === "monroe" ? preciosMonroe :
                        prov === "suizo" ? preciosSuizo :
                            prov === "cofarsur" ? preciosCofarsur : [];

                const p = fuente.find(x => x.ean === item.ean);
                const precio = getPrecioFinal(p, prov);
                const sinPrecio = !(typeof precio === "number" && precio > 0);
                return sinPrecio;
            });


        if (haySinPrecioValido) {
            alert("⚠️ Tenés productos seleccionados sin precio válido. Elegí otro proveedor o quitá esos ítems antes de confirmar.");
            return;
        }


        const carritoFiltrado = carrito.filter(it => !noPedirMap[it.idQuantio]);
        if (carritoFiltrado.length === 0) {
            toast("No hay líneas para enviar (todas marcadas como “No pedir”).");
            return;
        }

        const carritoConPrecios = carritoFiltrado.map((item) => {
            const precios = getPreciosItem(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });
            const fuente = [...preciosMonroe, ...preciosSuizo, ...preciosCofarsur, ...stockDisponible].find(p => (p.idProducto ?? p.idQuantio) === item.idQuantio);
            const idQuantio = item.idQuantio ?? fuente?.idQuantio ?? fuente?.idProducto ?? fuente?.id ?? null;
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

    const handleEnviarPedido = async () => {
        if (isSending) return;
        setIsSending(true);

        const toastId = toast.loading("Enviando pedido...");

        const itemsParaEnviar = carrito
            .filter(item => !noPedirMap[item.idQuantio])
            .map(item => {
                const provSel = seleccion[item.idQuantio]?.proveedor;
                const motivo = seleccion[item.idQuantio]?.motivo;

                let proveedor = provSel;
                let precio = 0;

                if (motivo === "Falta") {
                    proveedor = "Falta";
                    precio = 0;
                } else if (proveedor === "monroe") {
                    const p = preciosMonroe.find(p => p.ean === item.ean);
                    precio = getPrecioFinal(p, "monroe");
                } else if (proveedor === "suizo") {
                    const p = preciosSuizo.find(p => p.ean === item.ean);
                    precio = getPrecioFinal(p, "suizo");
                } else if (proveedor === "cofarsur") {
                    const p = preciosCofarsur.find(p => p.ean === item.ean);
                    precio = getPrecioFinal(p, "cofarsur");
                } else if (proveedor === "kellerhoff") {
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
            const response = await authFetch(`${API_URL}/api/pedidos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal: sucursalActual,
                    items: itemsParaEnviar,
                }),
            });

            const data = await response.json();
            // Log para debug

            if (data.success) {
                setMostrarResumen(false);
                const enviados = new Set(itemsParaEnviar.map(i => i.codebar));
                const restantes = carrito
                    .filter(it => !enviados.has(it.ean))
                    .map(it => {
                        const key = it.idQuantio || it.ean;
                        return { ...it, noPedir: !!noPedirMap[key] };
                    });

                // await persistirCarrito(restantes);
                replaceCarrito(restantes);

                if (data.parcial) {
                    // Algunos pedidos funcionaron y otros no
                    toast(
                        <div>
                            <strong>Pedido parcialmente completado</strong>
                            <br />
                            <div style={{ marginTop: '8px' }}>
                                <strong>✅ Exitosos:</strong>
                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                    {data.resultados.exitos.map(r => (
                                        <li key={r.proveedor}>
                                            {r.proveedor}: #{r.nroPedido} ({r.items} productos)
                                        </li>
                                    ))}
                                </ul>
                                <strong>❌ Con errores:</strong>
                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                    {data.resultados.errores.map(r => (
                                        <li key={r.proveedor}>
                                            {r.proveedor}: {r.error} ({r.items} productos)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>,
                        {
                            id: toastId,
                            duration: 15000,
                            style: { maxWidth: '500px' }
                        }
                    );
                } else {
                    toast.success("Pedido enviado correctamente", { id: toastId });
                }
            } else if (data.resultados?.errores.length > 0) {
                // Si todos los errores son de proveedor "Falta", mostrar info en vez de error
                const soloFaltas = data.resultados.errores.length > 0 &&
                    data.resultados.errores.every(r => r.proveedor === "Falta");
                if (soloFaltas) {
                    toast(
                        <div>
                            <strong>Todos los productos fueron marcados como "Falta"</strong>
                            <br />
                            <span style={{ fontSize: '0.95em' }}>
                                El pedido fue registrado solo para control interno. No se envió a ningún proveedor.
                            </span>
                        </div>,
                        {
                            id: toastId,
                            duration: 12000,
                            style: { maxWidth: '500px', background: '#fffbe6', color: '#856404' }
                        }
                    );
                } else {
                    // Solo hubo errores
                    toast.error(
                        <div>
                            <strong>Error al enviar pedido</strong>
                            <br />
                            <div style={{ marginTop: '8px' }}>
                                {data.resultados.errores.map(r => (
                                    <div key={r.proveedor} style={{ marginBottom: '8px' }}>
                                        <strong>{r.proveedor}:</strong> {r.error}
                                        {r.detalle && <div style={{ fontSize: '0.9em' }}>{r.detalle}</div>}
                                        {r.debug && (
                                            <details style={{ fontSize: '0.9em', marginTop: '4px' }}>
                                                <summary>Más detalles</summary>
                                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>
                                                    {JSON.stringify(r.debug, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>,
                        {
                            id: toastId,
                            duration: 15000,
                            style: { maxWidth: '500px' }
                        }
                    );
                }
            } else {
                toast.error(`Error al enviar pedido${data?.error ? `: ${data.error}` : ""}`, { id: toastId });
            }
        } catch (err) {
            toast.error(
                <div>
                    Error inesperado al enviar pedido
                    <br />
                    <small>{err.message}</small>
                </div>,
                { id: toastId }
            );
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

    const actualizarPreciosYStock = async () => {
        if (graciaActiva) {
            // Período de gracia: cerrar modal y REINICIAR todo el timer
            clearTimeout(graciaRef.current); // cancelar timer de gracia
            clearTimeout(timeoutRef.current); // cancelar timer principal
            setGraciaActiva(false);
            setShowModal(false);

            // Reiniciar todo el timer desde el principio
            const calcularTimeout = () => {
                const base = 180; // 3 minutos en producción
                const extra = carrito.length * 1; // Tiempo extra basado en cantidad de productos
                return Math.max(base, base + extra);
            };

            const tiempoTotal = calcularTimeout();
            console.log(`🔄 Timer REINICIADO: ${tiempoTotal} segundos total`);

            // Nuevo timer principal
            timeoutRef.current = setTimeout(() => {
                console.log("🔔 Timer principal EXPIRÓ (después de reinicio) - Mostrando modal con período de gracia");
                setShowModal(true);
                setGraciaActiva(true);

                // Nuevo timer de gracia (1 minuto)
                graciaRef.current = setTimeout(() => {
                    console.log("⏰ Período de gracia EXPIRÓ (después de reinicio) - Cancelando reserva soft");
                    setReservaVencida(true);
                    setGraciaActiva(false);
                    // Cancelar reserva soft
                    cancelarReservaSoft();
                }, 60000); // 1 minuto
            }, tiempoTotal * 1000);

            return;
        }

        // Reserva vencida: necesitamos actualizar todo
        setShowModal(false);

        // 🎯 MEJORA: Regenerar reservas SOFT antes de actualizar
        await regenerarReservasSoft();

        // Marcar que se está actualizando para mostrar el loading nativo
        sessionStorage.setItem('actualizandoPrecios', 'true');
        localStorage.setItem('preciosActualizados', 'true');
        localStorage.setItem('preciosActualizadosTime', Date.now().toString());

        // Recargar inmediatamente para mostrar el loading y luego los datos frescos
        window.location.reload();
    };

    // Validación: usuarios de compras necesitan tener sucursal seleccionada
    if (usuario?.rol === "compras" && !sucursalValida) {
        return (
            <div className="revisar_wrapper">
                <Toaster position="top-center" />
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "60vh",
                    textAlign: "center",
                    padding: "2rem"
                }}>
                    <h2 style={{ color: "#dc3545", marginBottom: "1rem" }}>
                        Selecciona una sucursal para revisar el pedido
                    </h2>
                    <p style={{ fontSize: "1.1rem", color: "#666", marginBottom: "1.5rem" }}>
                        Para revisar y enviar el pedido, primero debes seleccionar qué sucursal vas a reponer.
                    </p>
                    <p style={{ fontSize: "1rem", color: "#666" }}>
                        Usa el ícono <strong>🏪</strong> en la parte superior derecha para seleccionar una sucursal.
                    </p>
                    <button
                        onClick={() => navigate("/buscador")}
                        style={{
                            marginTop: "2rem",
                            padding: "0.75rem 2rem",
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "1rem"
                        }}
                    >
                        Volver al Buscador
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="revisar_wrapper">

            <Toaster position="top-center" />
            <h2 className="buscador_titulo">REVISAR PEDIDO</h2>

            {carrito.length === 0 ? <SinProductos /> : (
                <TablaRevisar
                    carrito={carrito}
                    preciosMonroe={preciosMonroe}
                    preciosSuizo={preciosSuizo}
                    preciosCofarsur={preciosCofarsur}
                    stockDisponible={stockDisponible}
                    seleccion={seleccion}
                    onElegirProveedor={handleElegirProveedor}
                    onMotivo={handleMotivo}
                    onEliminar={(idQuantio) => eliminarDelCarrito(idQuantio)}
                    onChangeQty={(idQuantio, unidades) => actualizarUnidades(idQuantio, unidades)}
                    noPedirMap={noPedirMap}
                    onToggleNoPedir={toggleNoPedir}
                    getStock={getStockConSucursal}
                    precioValido={precioValido}
                />
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
            <HelpButton />

            {showModal && (
                <Modal onClose={null}>
                    <h2>📈 Inactividad detectada</h2>
                    <p>
                        <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9em', fontWeight: 'lighter' }}>
                            {graciaActiva ? <strong>⚠️ Presiona CONTINUAR para mantener la sesion activa.</strong> : <strong>⚠️ Actualizá ahora para mantener los precios y el stock actualizado.</strong>}
                        </span>

                    </p>
                    <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
                        <button
                            onClick={actualizarPreciosYStock}
                            className="btn_actualizar_precios"
                        >
                            {graciaActiva ? "Continuar" : "Actualizar"}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
