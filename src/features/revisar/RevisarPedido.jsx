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
import { FaArrowLeft } from "react-icons/fa";
import { API_URL } from "../../config/api"; // ajustá ruta si difiere
import logo from "../../assets/logo.png"; // ajustá ruta si difiere
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

    const cancelarReservaSoft = async () => {

        try {
            const response = await authFetch(`${API_URL}/api/pedidos/reservas/cancelar-soft`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-sucursal": usuario.sucursal_codigo
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

    // Mostrar mensaje de éxito después de recargar la página
    useEffect(() => {
        if (sessionStorage.getItem('preciosActualizados') === 'true') {
            sessionStorage.removeItem('preciosActualizados');
            toast.success("Precios y stock actualizados correctamente");
        }
    }, []);

    const { preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, loading: loadingPS }
        = usePreciosYStock({ carrito, sucursal: usuario?.sucursal_codigo, authFetch, authHeaders });

    const { reglas, ready, matchConvenio } = useConvenios({ sucursal: usuario?.sucursal_codigo });

    const { seleccion, setSeleccion } = useSeleccionAutomatica({
        carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDeposito, matchConvenio, getStock
    });

    const { noPedirMap, toggleNoPedir, persistirCarrito } = usePersistenciaCarrito({ carrito, usuario, replaceCarrito });

    const datosCompletos = !!(preciosMonroe?.length || preciosSuizo?.length || preciosCofarsur?.length || stockDeposito?.length);
    const loading = loadingPS || !ready;

    const handleMotivo = (ean, motivo) => setSeleccion(prev => ({ ...prev, [ean]: { ...prev[ean], motivo } }));

    const handleElegirProveedor = (ean, nuevoProveedor) => {
        const item = carrito.find(x => x.ean === ean);
        const stockDepo = getStock(ean, stockDeposito);
        const match = matchConvenio(item, reglas);
        const proveedorIdeal = mejorProveedor(ean, { preciosMonroe, preciosSuizo, preciosCofarsur });

        // Validar que no se pueda seleccionar depósito si el stock no es válido
        if (nuevoProveedor === "deposito") {
            if (typeof stockDepo !== "number" || stockDepo <= 0) {
                toast.error("No se puede seleccionar depósito: stock no disponible");
                return;
            }
        }

        setSeleccion(prev => {
            const actual = prev[ean] ?? {};
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

            return { ...prev, [ean]: { ...actual, proveedor: nuevoProveedor, motivo: nuevoMotivo } };
        });
    };


    const handleConfirmar = () => {

        const hayFaltasDeMotivo = carrito
            .filter(item => !noPedirMap[item.ean])
            .some((item) => requiereJustificacion(seleccion[item.ean]?.motivo));

        if (hayFaltasDeMotivo) {
            toast.error("Tenés productos sin motivo seleccionado. Completalos antes de confirmar el pedido.");
            return;
        }

        const haySinPrecioValido = carrito
            .filter(item => !noPedirMap[item.ean])
            .some((item) => {
                const motivo = seleccion[item.ean]?.motivo;
                if (motivo === "Falta") return false;
                const prov = seleccion[item.ean]?.proveedor;
                if (!prov || prov === "deposito" || prov === "kellerhoff") return false;
                const fuente =
                    prov === "monroe" ? preciosMonroe :
                        prov === "suizo" ? preciosSuizo :
                            prov === "cofarsur" ? preciosCofarsur : [];

                const p = fuente.find(x => x.ean === item.ean);
                const precio = getPrecioFinal(p, prov);

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
            const precios = getPreciosItem(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });

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
                    sucursal: usuario?.sucursal_codigo,
                    items: itemsParaEnviar,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setMostrarResumen(false);
                const enviados = new Set(itemsParaEnviar.map(i => i.codebar));
                const restantes = carrito
                    .filter(it => !enviados.has(it.ean))
                    .map(it => ({ ...it, noPedir: !!noPedirMap[it.ean] }));

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

        // Marcar que se está actualizando para mostrar el loading nativo
        sessionStorage.setItem('actualizandoPrecios', 'true');
        sessionStorage.setItem('preciosActualizados', 'true');

        // Recargar inmediatamente para mostrar el loading y luego los datos frescos
        window.location.reload();
    };

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
                    stockDeposito={stockDeposito}
                    seleccion={seleccion}
                    onElegirProveedor={handleElegirProveedor}
                    onMotivo={handleMotivo}
                    onEliminar={(ean) => eliminarDelCarrito(ean)}
                    onChangeQty={(ean, unidades) => actualizarUnidades(ean, unidades)}
                    noPedirMap={noPedirMap}
                    onToggleNoPedir={toggleNoPedir}
                    getStock={getStock}
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
