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
import { useState, useEffect, useRef, useCallback } from "react";
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
    const { carrito, eliminarDelCarrito, actualizarUnidades, actualizarCantidad, replaceCarrito, soloDeposito, obtenerCarritoId } = useCarrito();
    const { authFetch, authHeaders, usuario } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [reservaVencida, setReservaVencida] = useState(false);
    const [graciaActiva, setGraciaActiva] = useState(false);
    const timeoutRef = useRef(null);
    const graciaRef = useRef(null);

    // 🆕 Estado para filtro de tipo de producto (solo compras)
    const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'medicamentos' | 'perfumeria'

    // 🏪 Estado para filtro por stock en depósito
    const [filtroDeposito, setFiltroDeposito] = useState('todos'); // 'todos' | 'conStock'

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

    // 🆕 Función para filtrar carrito según tipo de producto (solo compras)
    const obtenerCarritoFiltrado = () => {
        if (usuario?.rol !== 'compras' || filtroTipo === 'todos') {
            return carrito; // Sin filtro para no-compras o cuando se selecciona "todos"
        }

        return carrito.filter(item => {
            const esPerfumeria = item.esPerfumeria === true;

            if (filtroTipo === 'perfumeria') {
                return esPerfumeria;
            } else if (filtroTipo === 'medicamentos') {
                return !esPerfumeria;
            }

            return true; // fallback
        });
    };

    // Carrito filtrado para mostrar en la tabla
    const carritoFiltrado = obtenerCarritoFiltrado();

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
                    items: carritoFiltrado
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

    const { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud, stockDisponible, loading: loadingPS }
        = usePreciosYStock({ carrito, sucursal: sucursalActual, authFetch, authHeaders, usuario, soloDeposito });

    const { reglas, ready, matchConvenio } = useConvenios({ sucursal: sucursalActual });

    // Crear una versión de getStock que ya tenga la sucursal aplicada (memorizada)
    const getStockConSucursal = useCallback((idQuantio, stockData) => getStock(idQuantio, stockData, sucursalActual), [sucursalActual]);

    const { seleccion, setSeleccion } = useSeleccionAutomatica({
        carrito, reglas, preciosMonroe, preciosSuizo, preciosCofarsur, stockDisponible, matchConvenio, getStock: getStockConSucursal, sucursal: sucursalActual
    });

    const { noPedirMap, toggleNoPedir, persistirCarrito } = usePersistenciaCarrito({ carrito, usuario, replaceCarrito });

    const datosCompletos = !!(preciosMonroe?.length || preciosSuizo?.length || preciosCofarsur?.length || preciosDelSud?.length || stockDisponible?.length);
    const loading = loadingPS || !ready;

    // 🏪 Conteos para filtro depósito
    const cantConStockDepo = carritoFiltrado.filter(item => {
        const stock = getStockConSucursal(item.idQuantio, stockDisponible);
        return typeof stock === 'number' && stock > 0;
    }).length;

    const cantConDepoActivo = carritoFiltrado.filter(item => {
        const stock = getStockConSucursal(item.idQuantio, stockDisponible);
        const cId = obtenerCarritoId(item);
        return typeof stock === 'number' && stock > 0 && seleccion[cId]?.proveedor === 'deposito';
    }).length;

    // Carrito que se pasa a la tabla (filtro tipo + filtro depósito)
    const carritoParaTabla = filtroDeposito === 'conStock'
        ? carritoFiltrado.filter(item => {
            const stock = getStockConSucursal(item.idQuantio, stockDisponible);
            return typeof stock === 'number' && stock > 0;
        })
        : carritoFiltrado;

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

    // 🆔 Manejar motivo usando carritoId
    const handleMotivo = (carritoId, motivo) => setSeleccion(prev => ({ ...prev, [carritoId]: { ...prev[carritoId], motivo } }));

    // 🏪 Pasar a mejor precio los ítems con stock depo autoseleccionados como depósito
    const handlePasarAMejorPrecioDepo = () => {
        carritoFiltrado
            .filter(item => {
                const stock = getStockConSucursal(item.idQuantio, stockDisponible);
                const cId = obtenerCarritoId(item);
                return typeof stock === 'number' && stock > 0 && seleccion[cId]?.proveedor === 'deposito';
            })
            .forEach(item => {
                const cId = obtenerCarritoId(item);
                const mejor = mejorProveedor(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur });
                if (mejor) handleElegirProveedor(cId, mejor);
            });
    };

    // 🆔 Manejar selección de proveedor usando carritoId
    const handleElegirProveedor = (carritoId, nuevoProveedor) => {
        // Buscar producto por carritoId
        const item = carrito.find(x => x.carritoId === carritoId ||
            // Compatibilidad temporal con sistema anterior
            (x.esProductoNoRegistrado ? `ean_${x.ean}` : String(x.idQuantio)) === String(carritoId)
        );

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

        // 🆔 Usar carritoId como identificador
        const itemId = item.carritoId || (item.esProductoNoRegistrado ? `ean_${item.ean}` : String(item.idQuantio));

        setSeleccion(prev => {
            const actual = prev[itemId] ?? {};
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

            return { ...prev, [itemId]: { ...actual, proveedor: nuevoProveedor, motivo: nuevoMotivo } };
        });
    };


    const handleConfirmar = () => {

        // 🔄 Para usuarios de reposición, omitir validación de motivos
        const esUsuarioReposicion = usuario?.rol === "compras";

        // 🆔 Usar carritoId como identificador único

        if (!esUsuarioReposicion) {
            const hayFaltasDeMotivo = carritoFiltrado
                .filter(item => {
                    const carritoId = obtenerCarritoId(item);
                    return !noPedirMap[carritoId];
                })
                .some((item) => {
                    const carritoId = obtenerCarritoId(item);
                    const motivo = seleccion[carritoId]?.motivo;
                    const req = requiereJustificacion(motivo);
                    return req;
                });

            if (hayFaltasDeMotivo) {
                toast.error("Tenés productos sin motivo seleccionado. Completalos antes de confirmar el pedido.");
                return;
            }
        }


        const haySinPrecioValido = carritoFiltrado
            .filter(item => {
                const carritoId = obtenerCarritoId(item);
                return !noPedirMap[carritoId];
            })
            .some((item) => {
                const carritoId = obtenerCarritoId(item);
                const motivo = seleccion[carritoId]?.motivo;
                if (motivo === "Falta") return false;
                const prov = seleccion[carritoId]?.proveedor;
                if (!prov || prov === "deposito" || prov === "kellerhoff" || prov === "suizaTuc" || prov === "delsud") return false;
                const fuente =
                    prov === "monroe" ? preciosMonroe :
                        prov === "suizo" ? preciosSuizo :
                            prov === "cofarsur" ? preciosCofarsur :
                                prov === "delsud" ? preciosDelSud : [];

                const p = fuente.find(x => x.ean === item.ean);
                const precio = getPrecioFinal(p, prov);
                const sinPrecio = !(typeof precio === "number" && precio > 0);
                return sinPrecio;
            });


        if (haySinPrecioValido) {
            alert("⚠️ Tenés productos seleccionados sin precio válido. Elegí otro proveedor o quitá esos ítems antes de confirmar.");
            return;
        }


        const carritoSinNoPedir = carritoFiltrado.filter(it => {
            const carritoId = obtenerCarritoId(it);
            return !noPedirMap[carritoId];
        });
        if (carritoSinNoPedir.length === 0) {
            toast("No hay líneas para enviar (todas marcadas como “No pedir”).");
            return;
        }

        const carritoConPrecios = (carritoSinNoPedir || []).map((item) => {
            const precios = getPreciosItem(item.ean, { preciosMonroe, preciosSuizo, preciosCofarsur, preciosDelSud });
            const fuente = [...preciosMonroe, ...preciosSuizo, ...preciosCofarsur, ...(preciosDelSud || []), ...stockDisponible].find(p => (p.idProducto ?? p.idQuantio) === item.idQuantio);
            const idQuantio = item.idQuantio ?? fuente?.idQuantio ?? fuente?.idProducto ?? fuente?.id ?? null;
            return {
                ...item,
                precios,
                idQuantio,
            };
        });

        const resumenFinal = construirResumenPedido(carritoConPrecios, seleccion, obtenerCarritoId);

        // 🆕 Agregar información del filtro aplicado (solo compras)
        if (usuario?.rol === 'compras' && filtroTipo !== 'todos') {
            resumenFinal.filtroAplicado = {
                tipo: filtroTipo,
                totalOriginal: carrito.length,
                totalFiltrado: carritoFiltrado.length,
                mensaje: `Pedido de ${filtroTipo} (${carritoFiltrado.length} de ${carrito.length} productos)`
            };
        }

        setResumenFinal(resumenFinal);
        setMostrarResumen(true);
    };

    const handleEnviarPedido = async () => {
        if (isSending) return;
        setIsSending(true);

        const toastId = toast.loading("Enviando pedido...");

        const itemsParaEnviar = (carritoFiltrado || [])
            .filter(item => {
                // 🆔 Usar carritoId para filtrar noPedir
                const carritoId = obtenerCarritoId(item);
                return !noPedirMap[carritoId];
            })
            .map(item => {
                // 🆔 Usar carritoId para obtener selección
                const carritoId = obtenerCarritoId(item);
                const provSel = seleccion[carritoId]?.proveedor;
                const motivo = seleccion[carritoId]?.motivo;

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
                } else if (proveedor === "delsud") {
                    const p = preciosDelSud.find(p => p.ean === item.ean);
                    precio = getPrecioFinal(p, "delsud");
                } else if (proveedor === "kellerhoff") {
                    precio = 0;
                } else if (proveedor === "suizaTuc") {
                    precio = 0; // Suiza Tucumán no tiene precio, solo genera TXT
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

            if (data.success) {
                setMostrarResumen(false);

                // Solo sacar del carrito los productos que realmente se enviaron con éxito
                let productosExitosos = new Set();

                if (data.resultados?.exitos) {
                    // Función para normalizar nombres de proveedores
                    const normalizeProveedor = (proveedor) => {
                        if (!proveedor) return '';
                        return proveedor.toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '') // Remover acentos
                            .trim();
                    };

                    // Para cada proveedor exitoso, identificar qué productos se enviaron
                    data.resultados.exitos.forEach(resultado => {
                        const proveedorNormalizado = normalizeProveedor(resultado.proveedor);

                        const itemsDeEsteProveedor = itemsParaEnviar.filter(item =>
                            normalizeProveedor(item.proveedor) === proveedorNormalizado
                        );
                        itemsDeEsteProveedor.forEach(item => {
                            productosExitosos.add(item.codebar);
                        });
                    });
                } else if (!data.parcial) {
                    // Si no hay data.resultados pero success=true y no es parcial, 
                    // asumir que todos los enviados fueron exitosos
                    productosExitosos = new Set(itemsParaEnviar.map(i => i.codebar));
                }

                const restantes = carrito
                    .filter(it => !productosExitosos.has(it.ean))
                    .map(it => {
                        const key = it.idQuantio || it.ean;
                        return { ...it, noPedir: !!noPedirMap[key] };
                    });

                // await persistirCarrito(restantes);
                replaceCarrito(restantes);

                if (data.parcial) {
                    // Detectar si hay errores de crédito agotado en pedidos parciales
                    const hayErroresCreditoCofarsur = data.resultados.errores.some(r =>
                        r.proveedor === 'cofarsur' && r.creditoAgotado === true
                    );

                    // 🚨 Detectar warnings de crédito insuficiente en Monroe
                    const hayWarningsCreditoMonroe = data.resultados.exitos.some(r =>
                        r.proveedor === 'monroe' && r.creditoInsuficiente === true
                    );

                    if (hayErroresCreditoCofarsur || hayWarningsCreditoMonroe) {
                        // Obtener información específica de cada proveedor con problemas de crédito
                        const creditoCofarsur = data.resultados.errores.find(r => r.proveedor === 'cofarsur' && r.creditoAgotado === true);
                        const creditoMonroe = data.resultados.exitos.find(r => r.proveedor === 'monroe' && r.creditoInsuficiente === true);

                        const tituloToast = (hayErroresCreditoCofarsur && hayWarningsCreditoMonroe)
                            ? "🚫 Pedido parcial: Problemas de crédito en Cofarsur y Monroe"
                            : hayErroresCreditoCofarsur
                                ? "🚫 Pedido parcial: Cofarsur sin crédito"
                                : "🚫 Pedido parcial: Monroe con crédito insuficiente";

                        toast(
                            <div>
                                <strong>{tituloToast}</strong>
                                <br />
                                <div style={{ marginTop: '8px' }}>
                                    <strong>✅ Pedidos confirmados:</strong>
                                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                        {(data.resultados.exitos || []).map(r => (
                                            <li key={r.proveedor}>
                                                {r.proveedor}: #{r.nroPedido} ({r.items} productos)
                                                {r.creditoInsuficiente && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠️ Con observaciones</span>}
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Problemas de Cofarsur */}
                                    {creditoCofarsur && (
                                        <div style={{ marginTop: '12px', padding: '8px', background: '#fff5f5', borderRadius: '4px', borderLeft: '3px solid #dc3545' }}>
                                            <strong>🚫 Cofarsur sin crédito disponible</strong>
                                            <div style={{ fontSize: '0.9em', marginTop: '4px' }}>
                                                La cuenta no tiene crédito o está bloqueada para compras.
                                                <br />
                                                Productos afectados: {creditoCofarsur.items} productos
                                            </div>
                                            <div style={{ fontSize: '0.85em', marginTop: '6px', fontStyle: 'italic' }}>
                                                💡 Podés cambiar esos productos a otro proveedor o marcarlos como "Falta"
                                            </div>
                                        </div>
                                    )}

                                    {/* Problemas de Monroe */}
                                    {creditoMonroe && (
                                        <div style={{ marginTop: '12px', padding: '8px', background: '#fff9e6', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                                            <strong>⚠️ Monroe: Crédito insuficiente detectado</strong>
                                            <div style={{ fontSize: '0.9em', marginTop: '4px' }}>
                                                El pedido fue enviado pero Monroe reporta problemas de crédito.
                                                <br />
                                                Productos afectados: {creditoMonroe.detalleCredito?.productosAfectados || 0} de {creditoMonroe.items} productos
                                            </div>
                                            <div style={{ fontSize: '0.85em', marginTop: '6px', fontStyle: 'italic' }}>
                                                💡 Contactá a Monroe para verificar el estado del crédito y confirmar el pedido
                                            </div>
                                        </div>
                                    )}

                                    {/* Otros errores */}
                                    {data.resultados.errores.filter(r => r.proveedor !== 'cofarsur').length > 0 && (
                                        <>
                                            <strong style={{ marginTop: '8px', display: 'block' }}>❌ Otros errores:</strong>
                                            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                                {data.resultados.errores.filter(r => r.proveedor !== 'cofarsur').map(r => (
                                                    <li key={r.proveedor}>
                                                        {r.proveedor}: {r.error} ({r.items} productos)
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            </div>,
                            {
                                id: toastId,
                                duration: 15000, // Más tiempo porque puede haber más información
                                style: {
                                    maxWidth: '650px',
                                    background: '#fffbf0',
                                    borderLeft: '4px solid #f59e0b'
                                }
                            }
                        );
                    } else {
                        // Toast genérico para pedidos parciales sin crédito agotado
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
                    }
                } else {
                    // 🚨 Verificar si hay warnings de crédito en Monroe en pedidos exitosos
                    const hayWarningsCreditoMonroe = data.resultados.exitos?.some(r =>
                        r.proveedor === 'monroe' && r.creditoInsuficiente === true
                    );

                    if (hayWarningsCreditoMonroe) {
                        const creditoMonroe = data.resultados.exitos.find(r => r.proveedor === 'monroe' && r.creditoInsuficiente === true);

                        toast(
                            <div>
                                <strong>✅ Pedido enviado con observación</strong>
                                <br />
                                <div style={{ marginTop: '8px' }}>
                                    <strong>✅ Pedidos confirmados:</strong>
                                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                        {(data.resultados.exitos || []).map(r => (
                                            <li key={r.proveedor}>
                                                {r.proveedor}: #{r.nroPedido} ({r.items} productos)
                                                {r.creditoInsuficiente && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠️ Con observaciones</span>}
                                            </li>
                                        ))}
                                    </ul>
                                    <div style={{ marginTop: '12px', padding: '8px', background: '#fff9e6', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                                        <strong>⚠️ Monroe: Crédito insuficiente detectado</strong>
                                        <div style={{ fontSize: '0.9em', marginTop: '4px' }}>
                                            El pedido fue enviado pero Monroe reporta problemas de crédito.
                                            <br />
                                            Productos afectados: {creditoMonroe.detalleCredito?.productosAfectados || 0} de {creditoMonroe.items} productos
                                        </div>
                                        <div style={{ fontSize: '0.85em', marginTop: '6px', fontStyle: 'italic' }}>
                                            💡 Contactá a Monroe para verificar el estado del crédito y confirmar el pedido
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            {
                                id: toastId,
                                duration: 12000,
                                style: {
                                    maxWidth: '600px',
                                    background: '#fff9e6',
                                    borderLeft: '3px solid #f59e0b'
                                }
                            }
                        );
                    } else {
                        // Verificar si hay duplicados detectados
                        const hayDuplicados = data.resultados.exitos?.some(r => r.duplicado === true);

                        if (hayDuplicados) {
                            const duplicados = data.resultados.exitos.filter(r => r.duplicado === true);
                            const nuevos = data.resultados.exitos.filter(r => !r.duplicado);

                            toast(
                                <div>
                                    <strong>✅ Pedido procesado</strong>
                                    <br />
                                    <div style={{ marginTop: '8px' }}>
                                        {nuevos.length > 0 && (
                                            <>
                                                <strong>📤 Enviados:</strong>
                                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                                    {nuevos.map(r => (
                                                        <li key={r.proveedor}>
                                                            {r.proveedor}: #{r.nroPedido} ({r.items} productos)
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {duplicados.length > 0 && (
                                            <>
                                                <strong style={{ color: '#f59e0b', marginTop: '8px', display: 'block' }}>🔄 Duplicados detectados (no reenviados):</strong>
                                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                                    {duplicados.map(r => (
                                                        <li key={r.proveedor} style={{ color: '#856404' }}>
                                                            {r.proveedor}: #{r.nroPedido} ({r.items} productos)
                                                            {r.mensaje && <div style={{ fontSize: '0.85em', fontStyle: 'italic' }}>{r.mensaje}</div>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </div>,
                                {
                                    id: toastId,
                                    duration: 10000,
                                    style: {
                                        maxWidth: '550px',
                                        background: '#fff9e6',
                                        borderLeft: '4px solid #10b981'
                                    }
                                }
                            );
                        } else {
                            toast.success("Pedido enviado correctamente", { id: toastId });
                        }
                    }
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
                    // Detectar si hay errores de crédito agotado en Cofarsur
                    const hayErroresCreditoCofarsur = data.resultados.errores.some(r =>
                        r.proveedor === 'cofarsur' && r.creditoAgotado === true
                    );

                    if (hayErroresCreditoCofarsur) {
                        // Toast específico para crédito agotado
                        toast.error(
                            <div>
                                <strong>🚫 Cuenta Cofarsur sin crédito</strong>
                                <br />
                                <div style={{ marginTop: '8px', fontSize: '0.95em' }}>
                                    La cuenta de Cofarsur no tiene crédito disponible o está bloqueada para realizar compras.
                                    <br /><br />
                                    <strong>¿Qué hacer?</strong>
                                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                        <li>Contactar al área de compras para verificar el estado de la cuenta</li>
                                        <li>Elegir otro proveedor para estos productos</li>
                                        <li>Marcar como "Falta" si no hay alternativas</li>
                                    </ul>
                                    {data.resultados.errores
                                        .filter(r => r.proveedor === 'cofarsur')
                                        .map(r => (
                                            <div key={r.proveedor} style={{ marginTop: '8px', fontSize: '0.9em', opacity: 0.8 }}>
                                                Productos afectados: {r.items} productos
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>,
                            {
                                id: toastId,
                                duration: 20000, // Más tiempo para leer las instrucciones
                                style: {
                                    maxWidth: '600px',
                                    background: '#fff5f5',
                                    borderLeft: '4px solid #dc3545'
                                }
                            }
                        );
                    } else {
                        // Toast genérico para otros errores
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
            // Timer reiniciado

            // Nuevo timer principal
            timeoutRef.current = setTimeout(() => {
                // Timer principal expirado
                setShowModal(true);
                setGraciaActiva(true);

                // Nuevo timer de gracia (1 minuto)
                graciaRef.current = setTimeout(() => {
                    // Período de gracia expirado
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
                    <h2 style={{ color: "#f59e0b", marginBottom: "1rem" }}>
                        📋 Revisión de pedido individual
                    </h2>
                    <p style={{ fontSize: "1.1rem", color: "#666", marginBottom: "1.5rem" }}>
                        Esta página es para revisar pedidos de sucursales individuales. Si tienes productos cargados, necesitas seleccionar una sucursal específica para continuar.
                    </p>
                    <p style={{ fontSize: "1rem", color: "#666" }}>
                        Usa el ícono <strong>🏪</strong> para seleccionar una sucursal, o ve al buscador para cargar archivos ZIP masivos.
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

            {/* Indicador visual de modo "Solo depósito" */}
            {soloDeposito && (
                <div className="solo_deposito_indicator">
                    🏪 <strong>Modo Solo Depósito:</strong> No se consultarán droguerías externas
                </div>
            )}

            {/* 🆕 Barra de filtros combinada */}
            {carrito.length > 0 && usuario?.rol === 'compras' && (
                <div className="filtros_barra">
                    {/* Grupo tipo de producto: solo compras */}

                    <>
                        <div className="filtro_grupo">
                            <span className="filtro_label">Tipo</span>
                            <button className={`filtro_btn ${filtroTipo === 'todos' ? 'active' : ''}`} onClick={() => setFiltroTipo('todos')}>
                                📦 Todos ({carrito.length})
                            </button>
                            <button className={`filtro_btn ${filtroTipo === 'medicamentos' ? 'active' : ''}`} onClick={() => setFiltroTipo('medicamentos')}>
                                💊 Medicamentos ({carrito.filter(item => !item.esPerfumeria).length})
                            </button>
                            <button className={`filtro_btn ${filtroTipo === 'perfumeria' ? 'active' : ''}`} onClick={() => setFiltroTipo('perfumeria')}>
                                🧴 Perfumería ({carrito.filter(item => item.esPerfumeria === true).length})
                            </button>
                        </div>
                        <div className="filtro_separador" />
                    </>

                    {/* Grupo stock depósito */}
                    <div className="filtro_grupo">
                        <span className="filtro_label">Depósito</span>
                        <button className={`filtro_btn ${filtroDeposito === 'todos' ? 'active' : ''}`} onClick={() => setFiltroDeposito('todos')}>
                            📦 Todos ({carritoFiltrado.length})
                        </button>
                        <button className={`filtro_btn ${filtroDeposito === 'conStock' ? 'active' : ''}`} onClick={() => setFiltroDeposito('conStock')}>
                            🏪 Con stock ({cantConStockDepo})
                        </button>
                        {filtroDeposito === 'conStock' && cantConDepoActivo > 0 && (
                            <button
                                className="filtro_btn"
                                style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}
                                onClick={handlePasarAMejorPrecioDepo}
                            >
                                ⚡ Pasar {cantConDepoActivo} a mejor precio
                            </button>
                        )}
                    </div>
                </div>
            )}

            {carrito.length === 0 ? <SinProductos /> : (
                <TablaRevisar
                    carrito={carritoParaTabla}
                    preciosMonroe={preciosMonroe}
                    preciosSuizo={preciosSuizo}
                    preciosCofarsur={preciosCofarsur}
                    preciosDelSud={preciosDelSud}
                    stockDisponible={stockDisponible}
                    seleccion={seleccion}
                    onElegirProveedor={handleElegirProveedor}
                    onMotivo={handleMotivo}
                    onEliminar={(item) => {
                        // 🆔 Usar carritoId para eliminar
                        const carritoId = obtenerCarritoId(item);
                        eliminarDelCarrito(carritoId);
                    }}
                    onChangeQty={(item, unidades) => {
                        // 🆔 Usar carritoId para actualizar cantidad
                        const carritoId = obtenerCarritoId(item);
                        actualizarCantidad(carritoId, unidades);
                    }}
                    noPedirMap={noPedirMap}
                    onToggleNoPedir={toggleNoPedir}
                    getStock={getStockConSucursal}
                    precioValido={precioValido}
                />
            )}


            {carritoFiltrado.length > 0 && (
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
                    sucursalActual={sucursalActual}
                    authFetch={authFetch}
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
