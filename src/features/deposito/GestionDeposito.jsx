// front/src/features/deposito/GestionDeposito.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { FaBoxOpen, FaHistory, FaCheckCircle, FaExclamationTriangle, FaSync, FaChevronDown, FaChevronRight, FaTrashAlt } from "react-icons/fa";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import Modal from "../../components/ui/Modal";
import "../../styles/deposito.scss";

const ESTADO_LABEL = {
    PENDIENTE_DEPOSITO: "Pendiente",
    EXITOSO: "Procesado",
    FALTANTE_PARCIAL: "Con faltantes",
    CANCELADO_AUTO: "Cancelado (auto)",
    CANCELADO_DEPOSITO: "Cancelado",
};

const ROL_LABEL = { sucursal: "Suc.", compras: "Compras", admin: "Admin" };

// ── Transforma la respuesta del API ─────────────────────────────────────────
// Agrupa las reservas dentro de cada sucursal por nro_pedido_interno.
// La unidad de selección es el pedido interno, nunca la reserva individual.
function agruparPorPedido(data) {
    return data.map(suc => {
        const pedidosMap = new Map();
        const reservasUnicas = [...new Map(suc.reservas.map(r => [r.reserva_id, r])).values()];

        for (const r of reservasUnicas) {
            const key = r.nro_pedido_interno ?? `__sin_pedido_${r.reserva_id}`;
            if (!pedidosMap.has(key)) {
                pedidosMap.set(key, {
                    nro_pedido_interno: key,
                    pedido_id: r.pedido_id,
                    usuario_login: r.usuario_login,
                    usuario_nombre: r.usuario_nombre,
                    usuario_rol: r.usuario_rol,
                    estado_pedido: r.estado_pedido,
                    fecha: r.fecha_pedido ?? r.created_at,
                    cluster_nombre: r.cluster_nombre ?? null,
                    reservas: []
                });
            }
            pedidosMap.get(key).reservas.push(r);
        }

        const pedidos = Array.from(pedidosMap.values()).map(p => ({
            ...p,
            total_unidades: p.reservas.reduce((s, r) => s + Number(r.cantidad), 0)
        }));

        return {
            sucursal_codigo: suc.sucursal_codigo,
            total_unidades: suc.total_unidades,
            pedido_mas_antiguo: suc.pedido_mas_antiguo,
            pedidos
        };
    });
}

export default function GestionDeposito() {
    const { authFetch } = useAuth();
    const [tab, setTab] = useState("pendientes");

    // ── Pendientes ────────────────────────────────────────────────────────────
    const [pendientes, setPendientes] = useState([]);
    const [loadingPend, setLoadingPend] = useState(false);
    const [errorPend, setErrorPend] = useState(null);

    // Conjunto de nro_pedido_interno seleccionados (unidad de selección)
    const [seleccionados, setSeleccionados] = useState(new Set());
    // Qué pedidos internos están expandidos (muestran sus productos)
    const [expandidos, setExpandidos] = useState(new Set());

    // ── Modal procesar ────────────────────────────────────────────────────────
    const [modalProcesar, setModalProcesar] = useState(false);
    const [procesando, setProcesando] = useState(false);
    const [resultados, setResultados] = useState(null); // array por sucursal
    const [errorProcesar, setErrorProcesar] = useState(null);
    const [sucursalesAbiertas, setSucursalesAbiertas] = useState(new Set());

    // ── Modal anular ──────────────────────────────────────────────────────────
    const [modalAnular, setModalAnular] = useState(false);
    const [anulando, setAnulando] = useState(false);
    const [resultadoAnular, setResultadoAnular] = useState(null); // { ok, reservas_anuladas, pedidos_anulados } | { error }

    // ── Menú de opciones (⋮) ─────────────────────────────────────────────────
    const [menuOpciones, setMenuOpciones] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        if (!menuOpciones) return;
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpciones(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [menuOpciones]);

    const toggleSucursalModal = (suc) =>
        setSucursalesAbiertas(prev => {
            const next = new Set(prev);
            next.has(suc) ? next.delete(suc) : next.add(suc);
            return next;
        });

    // ── Historial ─────────────────────────────────────────────────────────────
    const [lotes, setLotes] = useState([]);
    const [loadingLotes, setLoadingLotes] = useState(false);
    const [errorLotes, setErrorLotes] = useState(null);

    // ── Cargar pendientes ─────────────────────────────────────────────────────
    const cargarPendientes = useCallback(() => {
        setLoadingPend(true);
        setErrorPend(null);
        authFetch(`${API_URL}/api/deposito/pendientes`)
            .then(r => { if (!r.ok) throw new Error("Error al cargar"); return r.json(); })
            .then(data => {
                setPendientes(agruparPorPedido(data.data || []));
                setSeleccionados(new Set());
            })
            .catch(e => setErrorPend(e.message))
            .finally(() => setLoadingPend(false));
    }, [authFetch]);

    useEffect(() => { if (tab === "pendientes") cargarPendientes(); }, [tab, cargarPendientes]);

    // ── Cargar historial ──────────────────────────────────────────────────────
    const cargarLotes = useCallback(() => {
        setLoadingLotes(true);
        setErrorLotes(null);
        authFetch(`${API_URL}/api/deposito/lotes`)
            .then(r => { if (!r.ok) throw new Error("Error al cargar"); return r.json(); })
            .then(data => setLotes(data.data || []))
            .catch(e => setErrorLotes(e.message))
            .finally(() => setLoadingLotes(false));
    }, [authFetch]);

    useEffect(() => { if (tab === "historial") cargarLotes(); }, [tab, cargarLotes]);

    // ── Computed: todos los pedidos internos y usuarios únicos ───────────────
    const todosLosPedidos = useMemo(
        () => pendientes.flatMap(s => s.pedidos),
        [pendientes]
    );

    const usuariosUnicos = useMemo(() => {
        const map = new Map();
        for (const p of todosLosPedidos) {
            if (p.usuario_login && !map.has(p.usuario_login)) {
                map.set(p.usuario_login, { login: p.usuario_login, nombre: p.usuario_nombre, rol: p.usuario_rol });
            }
        }
        return Array.from(map.values());
    }, [todosLosPedidos]);

    const clustersUnicos = useMemo(() => {
        const set = new Set();
        for (const p of todosLosPedidos) {
            if (p.cluster_nombre) set.add(p.cluster_nombre);
        }
        return [...set].sort();
    }, [todosLosPedidos]);

    // ── Selección ─────────────────────────────────────────────────────────────
    const togglePedido = (nro) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            next.has(nro) ? next.delete(nro) : next.add(nro);
            return next;
        });
    };

    const seleccionarTodo = () => {
        const todos = todosLosPedidos.every(p => seleccionados.has(p.nro_pedido_interno));
        setSeleccionados(todos ? new Set() : new Set(todosLosPedidos.map(p => p.nro_pedido_interno)));
    };

    const seleccionarPorCluster = (cluster) => {
        const pedidosDelCluster = todosLosPedidos.filter(p => p.cluster_nombre === cluster);
        const todosYaSelec = pedidosDelCluster.every(p => seleccionados.has(p.nro_pedido_interno));
        setSeleccionados(prev => {
            const next = new Set(prev);
            if (todosYaSelec) {
                pedidosDelCluster.forEach(p => next.delete(p.nro_pedido_interno));
            } else {
                pedidosDelCluster.forEach(p => next.add(p.nro_pedido_interno));
            }
            return next;
        });
    };

    const seleccionarPorUsuario = (login) => {
        const pedidosDelUsuario = todosLosPedidos.filter(p => p.usuario_login === login);
        const todosYaSelec = pedidosDelUsuario.every(p => seleccionados.has(p.nro_pedido_interno));
        setSeleccionados(prev => {
            const next = new Set(prev);
            if (todosYaSelec) {
                pedidosDelUsuario.forEach(p => next.delete(p.nro_pedido_interno));
            } else {
                pedidosDelUsuario.forEach(p => next.add(p.nro_pedido_interno));
            }
            return next;
        });
    };

    const toggleExpandido = (nro) => {
        setExpandidos(prev => {
            const next = new Set(prev);
            next.has(nro) ? next.delete(nro) : next.add(nro);
            return next;
        });
    };

    // ── Resumen de selección ──────────────────────────────────────────────────
    const resumenSeleccion = useMemo(() => {
        const porSucursal = {};
        for (const suc of pendientes) {
            const pedidosSelec = suc.pedidos.filter(p => seleccionados.has(p.nro_pedido_interno));
            if (pedidosSelec.length > 0) {
                porSucursal[suc.sucursal_codigo] = {
                    pedidos: pedidosSelec,
                    reservaIds: pedidosSelec.flatMap(p => p.reservas.map(r => r.reserva_id))
                };
            }
        }
        const totalPedidos = Object.values(porSucursal).reduce((s, v) => s + v.pedidos.length, 0);
        const totalLotes = Object.keys(porSucursal).length;
        return { porSucursal, totalPedidos, totalLotes };
    }, [pendientes, seleccionados]);

    // ── Preview consolidado para el modal ────────────────────────────────────
    const previewPorSucursal = useMemo(() => {
        return Object.entries(resumenSeleccion.porSucursal).map(([suc, { pedidos }]) => {
            const productosMap = new Map();
            for (const ped of pedidos) {
                for (const r of ped.reservas) {
                    const key = String(r.idProducto);
                    if (productosMap.has(key)) {
                        productosMap.get(key).cantidad += Number(r.cantidad);
                    } else {
                        productosMap.set(key, {
                            idProducto: r.idProducto,
                            codebar: r.codebar,
                            descripcion: r.descripcion,
                            cantidad: Number(r.cantidad)
                        });
                    }
                }
            }
            return {
                sucursal: suc,
                cantPedidos: pedidos.length,
                productos: Array.from(productosMap.values())
            };
        });
    }, [resumenSeleccion]);

    // ── Procesar lotes (uno por sucursal) ─────────────────────────────────────
    const procesarLotes = async () => {
        setProcesando(true);
        setErrorProcesar(null);

        const entradas = Object.entries(resumenSeleccion.porSucursal);
        setResultados(entradas.map(([suc]) => ({ sucursal: suc, status: "pending" })));

        for (const [sucursal, { reservaIds }] of entradas) {
            setResultados(prev => prev.map(r =>
                r.sucursal === sucursal ? { ...r, status: "processing" } : r
            ));
            try {
                const res = await authFetch(`${API_URL}/api/deposito/procesar`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sucursal_codigo: sucursal, reserva_ids: reservaIds })
                });
                const data = await res.json();
                setResultados(prev => prev.map(r =>
                    r.sucursal === sucursal
                        ? { sucursal, status: res.ok ? "ok" : "error", ok: res.ok, ...data }
                        : r
                ));
            } catch (e) {
                setResultados(prev => prev.map(r =>
                    r.sucursal === sucursal
                        ? { sucursal, status: "error", ok: false, error: e.message }
                        : r
                ));
            }
        }

        setProcesando(false);
        cargarPendientes();
    };

    const todosOk = !procesando && resultados != null && resultados.every(r => r.ok === true);
    const todosTienen = todosLosPedidos.length > 0 && todosLosPedidos.every(p => seleccionados.has(p.nro_pedido_interno));

    // ── Anular pedidos seleccionados ──────────────────────────────────────────
    const anularPedidos = async () => {
        setAnulando(true);
        setResultadoAnular(null);

        const reservaIds = [...seleccionados]
            .flatMap(nro => {
                const ped = todosLosPedidos.find(p => p.nro_pedido_interno === nro);
                return ped ? ped.reservas.map(r => r.reserva_id) : [];
            });

        try {
            const res = await authFetch(`${API_URL}/api/deposito/anular`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reserva_ids: reservaIds })
            });
            const data = await res.json();
            setResultadoAnular(res.ok ? { ok: true, ...data } : { ok: false, error: data.error ?? "Error desconocido" });
            if (res.ok) cargarPendientes();
        } catch (e) {
            setResultadoAnular({ ok: false, error: e.message });
        } finally {
            setAnulando(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="dep">
            <h2 className="dep_titulo">Panel del Depósito</h2>

            {/* Tabs + Actualizar */}
            <div className="dep_tabs_row">
                <div className="dep_tabs">
                    <button className={`dep_tab ${tab === "pendientes" ? "dep_tab_active" : ""}`} onClick={() => setTab("pendientes")}>
                        <FaBoxOpen /> Pedidos pendientes
                    </button>
                    <button className={`dep_tab ${tab === "historial" ? "dep_tab_active" : ""}`} onClick={() => setTab("historial")}>
                        <FaHistory /> Historial de lotes
                    </button>
                </div>
                <button
                    className="dep_btn_refresh"
                    onClick={tab === "pendientes" ? cargarPendientes : cargarLotes}
                    disabled={loadingPend || loadingLotes}
                >
                    <FaSync className={(loadingPend || loadingLotes) ? "dep_spin" : ""} />
                    Actualizar
                </button>
            </div>

            {/* ── Tab: Pendientes ─────────────────────────────────────────────── */}
            {tab === "pendientes" && (
                <div className="dep_pendientes">

                    {/* Barra de herramientas */}
                    <div className="dep_toolbar">
                        <div className="dep_toolbar_izq">
                            {/* Seleccionar todo */}
                            <label className="dep_check_label">
                                <input
                                    type="checkbox"
                                    checked={todosTienen}
                                    onChange={seleccionarTodo}
                                    disabled={todosLosPedidos.length === 0}
                                />
                                Seleccionar todo
                            </label>

                            {/* Selección por cluster */}
                            {clustersUnicos.length > 0 && (
                                <div className="dep_toolbar_clusters">
                                    <span className="dep_toolbar_label">Por cluster:</span>
                                    {clustersUnicos.map(c => {
                                        const pedidosC = todosLosPedidos.filter(p => p.cluster_nombre === c);
                                        const activo = pedidosC.every(p => seleccionados.has(p.nro_pedido_interno));
                                        return (
                                            <button
                                                key={c}
                                                className={`dep_chip_cluster ${activo ? "dep_chip_cluster_activo" : ""}`}
                                                onClick={() => seleccionarPorCluster(c)}
                                                title={`${activo ? "Deseleccionar" : "Seleccionar"} todos los pedidos del cluster ${c}`}
                                            >
                                                {c}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Quick-select por usuario */}
                            {usuariosUnicos.length > 0 && (
                                <div className="dep_toolbar_usuarios">
                                    <span className="dep_toolbar_label">Por usuario:</span>
                                    {usuariosUnicos.map(u => {
                                        const pedidosU = todosLosPedidos.filter(p => p.usuario_login === u.login);
                                        const activo = pedidosU.every(p => seleccionados.has(p.nro_pedido_interno));
                                        return (
                                            <button
                                                key={u.login}
                                                className={`dep_chip_usuario ${activo ? "dep_chip_usuario_activo" : ""}`}
                                                onClick={() => seleccionarPorUsuario(u.login)}
                                                title={`${activo ? "Deseleccionar" : "Seleccionar"} todos los pedidos de ${u.nombre ?? u.login}`}
                                            >
                                                {u.login}
                                                {u.rol && <span className="dep_chip_rol">{ROL_LABEL[u.rol] ?? u.rol}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                        </div>

                        <div className="dep_toolbar_der">
                            {resumenSeleccion.totalPedidos > 0 && (
                                <div className="dep_btn_group" ref={menuRef}>
                                    <button
                                        className="dep_btn_procesar"
                                        onClick={() => { setResultados(null); setErrorProcesar(null); setSucursalesAbiertas(new Set()); setModalProcesar(true); }}
                                    >
                                        Procesar {resumenSeleccion.totalPedidos} pedido{resumenSeleccion.totalPedidos !== 1 ? "s" : ""}
                                    </button>
                                    <button
                                        className="dep_btn_opciones"
                                        onClick={() => setMenuOpciones(p => !p)}
                                        title="Más opciones"
                                    >
                                        ⋮
                                    </button>
                                    {menuOpciones && (
                                        <div className="dep_dropdown">
                                            <button
                                                className="dep_dropdown_item dep_dropdown_item_danger"
                                                onClick={() => { setMenuOpciones(false); setResultadoAnular(null); setModalAnular(true); }}
                                            >
                                                <FaTrashAlt />
                                                Anular {resumenSeleccion.totalPedidos} pedido{resumenSeleccion.totalPedidos !== 1 ? "s" : ""}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {errorPend && <p className="dep_error">{errorPend}</p>}

                    {loadingPend ? (
                        <p className="dep_loading">Cargando pendientes...</p>
                    ) : pendientes.length === 0 ? (
                        <div className="dep_vacio">
                            <FaCheckCircle className="dep_vacio_icon" />
                            <p>No hay pedidos pendientes</p>
                        </div>
                    ) : pendientes.map(suc => (
                        <div key={suc.sucursal_codigo} className="dep_suc_section">

                            {/* Header sucursal */}
                            <div className="dep_suc_header">
                                <span className="dep_suc_nombre">{suc.sucursal_codigo}</span>
                                <span className="dep_suc_stats">
                                    {suc.pedidos.length} pedido{suc.pedidos.length !== 1 ? "s" : ""}
                                    <span className="dep_stat_sep">·</span>
                                    {suc.total_unidades} unidades
                                    <span className="dep_stat_sep">·</span>
                                    <span className="dep_stat_fecha">desde {new Date(suc.pedido_mas_antiguo).toLocaleDateString("es-AR")}</span>
                                </span>
                                {/* Sel. toda la sucursal */}
                                <label className="dep_check_label dep_check_suc" title={`Seleccionar todos los pedidos de ${suc.sucursal_codigo}`}>
                                    <input
                                        type="checkbox"
                                        checked={suc.pedidos.length > 0 && suc.pedidos.every(p => seleccionados.has(p.nro_pedido_interno))}
                                        onChange={() => {
                                            const todos = suc.pedidos.every(p => seleccionados.has(p.nro_pedido_interno));
                                            setSeleccionados(prev => {
                                                const next = new Set(prev);
                                                suc.pedidos.forEach(p => todos ? next.delete(p.nro_pedido_interno) : next.add(p.nro_pedido_interno));
                                                return next;
                                            });
                                        }}
                                    />
                                    Sel. todos
                                </label>
                            </div>

                            {/* Pedidos internos */}
                            {suc.pedidos.map(ped => {
                                const selec = seleccionados.has(ped.nro_pedido_interno);
                                const expanded = expandidos.has(ped.nro_pedido_interno);
                                return (
                                    <div key={ped.nro_pedido_interno} className={`dep_ped_card ${selec ? "dep_ped_card_sel" : ""}`}>

                                        {/* Fila del pedido */}
                                        <div className="dep_ped_row">
                                            <input
                                                type="checkbox"
                                                className="dep_ped_check"
                                                checked={selec}
                                                onChange={() => togglePedido(ped.nro_pedido_interno)}
                                            />
                                            <div className="dep_ped_info" onClick={() => togglePedido(ped.nro_pedido_interno)}>
                                                <div className="dep_ped_nro_row">
                                                    <span className="dep_ped_nro">{ped.nro_pedido_interno}</span>
                                                    {ped.cluster_nombre && (
                                                        <span className="dep_ped_cluster">{ped.cluster_nombre}</span>
                                                    )}
                                                </div>
                                                <div className="dep_ped_meta">
                                                    {ped.usuario_login && (
                                                        <span className="dep_ped_usuario">
                                                            {ped.usuario_nombre ?? ped.usuario_login}
                                                            {ped.usuario_rol && (
                                                                <span className="dep_ped_rol">{ROL_LABEL[ped.usuario_rol] ?? ped.usuario_rol}</span>
                                                            )}
                                                        </span>
                                                    )}
                                                    <span className="dep_ped_fecha">
                                                        {ped.fecha ? new Date(ped.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                                                    </span>
                                                    <span className="dep_ped_unidades">
                                                        {ped.total_unidades} un. · {ped.reservas.length} producto{ped.reservas.length !== 1 ? "s" : ""}
                                                    </span>
                                                    {ped.estado_pedido && (
                                                        <span className={`dep_badge dep_badge_${ped.estado_pedido === "PENDIENTE_DEPOSITO" ? "pendiente" : "exitoso"}`}>
                                                            {ESTADO_LABEL[ped.estado_pedido] ?? ped.estado_pedido}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                className="dep_ped_expand"
                                                onClick={() => toggleExpandido(ped.nro_pedido_interno)}
                                                title={expanded ? "Ocultar productos" : "Ver productos"}
                                            >
                                                {expanded ? <FaChevronDown /> : <FaChevronRight />}
                                            </button>
                                        </div>

                                        {/* Productos expandidos */}
                                        {expanded && (
                                            <table className="dep_tabla dep_tabla_productos">
                                                <thead>
                                                    <tr>
                                                        <th>EAN</th>
                                                        <th>Descripción</th>
                                                        <th>Unidades</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ped.reservas.map(r => (
                                                        <tr key={r.reserva_id}>
                                                            <td className="dep_td_ean">{r.codebar ?? "—"}</td>
                                                            <td className="dep_td_desc">{r.descripcion ?? "—"}</td>
                                                            <td className="dep_td_cant">{Number(r.cantidad).toFixed(0)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Tab: Historial ──────────────────────────────────────────────── */}
            {tab === "historial" && (
                <div>
                    <div className="dep_section_header">
                        <p className="dep_section_desc">Lotes procesados y enviados a Quantio.</p>
                    </div>
                    {errorLotes && <p className="dep_error">{errorLotes}</p>}
                    <div className="dep_tabla_wrap">
                        <table className="dep_tabla">
                            <thead>
                                <tr>
                                    <th>Nro Quantio</th>
                                    <th>Sucursal</th>
                                    <th>Fecha</th>
                                    <th>Procesado por</th>
                                    <th>Pedidos agrupados</th>
                                    <th>Total unidades</th>
                                    <th>Pedidos internos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingLotes ? (
                                    <tr><td colSpan={7} className="dep_loading">Cargando...</td></tr>
                                ) : lotes.length === 0 ? (
                                    <tr><td colSpan={7} className="dep_vacio_cell">Sin lotes procesados</td></tr>
                                ) : lotes.map((lote, i) => (
                                    <tr key={`${lote.nro_pedido_quantio}-${i}`}>
                                        <td><strong className="dep_nro_quantio">{lote.nro_pedido_quantio}</strong></td>
                                        <td><span className="dep_badge dep_badge_sucursal">{lote.sucursal_codigo}</span></td>
                                        <td className="dep_td_fecha">
                                            {new Date(lote.fecha_procesado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </td>
                                        <td>{lote.procesado_por ?? "—"}</td>
                                        <td className="dep_td_cant">{lote.pedidos_agrupados}</td>
                                        <td className="dep_td_cant">{lote.total_unidades ?? "—"}</td>
                                        <td className="dep_td_internos">{lote.pedidos_internos}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Modal anular ─────────────────────────────────────────────────── */}
            {modalAnular && (
                <Modal onClose={() => { if (!anulando) setModalAnular(false); }}>
                    <h3 className="dep_modal_titulo">Anular pedidos seleccionados</h3>

                    {!resultadoAnular ? (
                        <div className="dep_modal_body">
                            <p className="dep_modal_desc">
                                Se van a anular <strong>{resumenSeleccion.totalPedidos} pedido{resumenSeleccion.totalPedidos !== 1 ? "s" : ""}</strong> de las siguientes sucursales. El stock quedará liberado.
                            </p>
                            <ul className="dep_anular_lista">
                                {Object.entries(resumenSeleccion.porSucursal).map(([suc, { pedidos }]) => (
                                    <li key={suc}>
                                        <span className="dep_badge dep_badge_sucursal">{suc}</span>
                                        <span className="dep_anular_detalle">
                                            {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} · {pedidos.map(p => p.nro_pedido_interno).join(", ")}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <p className="dep_anular_aviso">Esta acción no se puede deshacer.</p>
                            <div className="dep_modal_acciones">
                                <button className="dep_btn_cancelar" onClick={() => setModalAnular(false)} disabled={anulando}>
                                    Cancelar
                                </button>
                                <button className="dep_btn_anular_confirm" onClick={anularPedidos} disabled={anulando}>
                                    {anulando ? "Anulando..." : "Confirmar anulación"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="dep_modal_resultado">
                            <div className="dep_resultado_header">
                                {resultadoAnular.ok
                                    ? <FaCheckCircle className="dep_resultado_icon dep_resultado_ok" />
                                    : <FaExclamationTriangle className="dep_resultado_icon dep_resultado_warn" />
                                }
                                <p className="dep_resultado_titulo">
                                    {resultadoAnular.ok
                                        ? `${resultadoAnular.reservas_anuladas} reservas anuladas — stock liberado`
                                        : `Error: ${resultadoAnular.error}`
                                    }
                                </p>
                            </div>
                            <div className="dep_modal_acciones">
                                <button className="dep_btn_guardar" onClick={() => setModalAnular(false)}>Cerrar</button>
                            </div>
                        </div>
                    )}
                </Modal>
            )}

            {/* ── Modal procesar ───────────────────────────────────────────────── */}
            {modalProcesar && (
                <Modal onClose={() => { if (!procesando) setModalProcesar(false); }}>
                    <h3 className="dep_modal_titulo">Procesar pedidos seleccionados</h3>

                    {!resultados ? (
                        <div className="dep_modal_body">
                            <p className="dep_modal_desc">
                                Se enviarán <strong>{resumenSeleccion.totalLotes} pedido{resumenSeleccion.totalLotes !== 1 ? "s" : ""} a Quantio</strong> (uno por sucursal), con los productos consolidados:
                            </p>

                            <div className="dep_modal_scroll">
                                {previewPorSucursal.map(({ sucursal, cantPedidos, productos }) => {
                                    const abierta = sucursalesAbiertas.has(sucursal);
                                    return (
                                        <div key={sucursal} className="dep_preview_suc">
                                            <div
                                                className="dep_preview_suc_header dep_preview_suc_header_toggle"
                                                onClick={() => toggleSucursalModal(sucursal)}
                                            >
                                                <span className="dep_badge dep_badge_sucursal">{sucursal}</span>
                                                <span className="dep_preview_suc_info">
                                                    {cantPedidos} pedido{cantPedidos !== 1 ? "s" : ""} · {productos.length} productos
                                                </span>
                                                <span className="dep_modal_chevron">
                                                    {abierta ? <FaChevronDown /> : <FaChevronRight />}
                                                </span>
                                            </div>
                                            {abierta && (
                                                <table className="dep_tabla dep_tabla_modal">
                                                    <thead>
                                                        <tr><th>EAN</th><th>Descripción</th><th>Unidades</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {productos.map(p => (
                                                            <tr key={p.idProducto}>
                                                                <td className="dep_td_ean">{p.codebar ?? p.idProducto}</td>
                                                                <td className="dep_td_desc">{p.descripcion ?? "—"}</td>
                                                                <td className="dep_td_cant">{p.cantidad}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {errorProcesar && <p className="dep_form_error">{errorProcesar}</p>}
                            <div className="dep_modal_acciones">
                                <button className="dep_btn_cancelar" onClick={() => setModalProcesar(false)} disabled={procesando}>
                                    Cancelar
                                </button>
                                <button className="dep_btn_procesar" onClick={procesarLotes} disabled={procesando}>
                                    {procesando ? "Enviando..." : `Confirmar y enviar ${resumenSeleccion.totalLotes > 1 ? `${resumenSeleccion.totalLotes} lotes` : ""}`.trim()}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="dep_modal_resultado">
                            <div className="dep_resultado_header">
                                {procesando
                                    ? <FaSync className="dep_resultado_icon dep_spin dep_resultado_procesando" />
                                    : todosOk
                                        ? <FaCheckCircle className="dep_resultado_icon dep_resultado_ok" />
                                        : <FaExclamationTriangle className="dep_resultado_icon dep_resultado_warn" />
                                }
                                <p className="dep_resultado_titulo">
                                    {procesando
                                        ? `Procesando... (${resultados.filter(r => r.status === "ok" || r.status === "error").length} / ${resultados.length})`
                                        : todosOk ? "Todos los lotes procesados correctamente" : "Procesado con errores"
                                    }
                                </p>
                            </div>

                            <div className="dep_modal_scroll">
                                {resultados.map(r => {
                                    const abierta = sucursalesAbiertas.has(r.sucursal);
                                    if (r.status === "pending") return (
                                        <div key={r.sucursal} className="dep_resultado_suc dep_resultado_suc_pending">
                                            <div className="dep_resultado_suc_header">
                                                <span className="dep_badge dep_badge_sucursal">{r.sucursal}</span>
                                                <span className="dep_resultado_espera">En espera...</span>
                                            </div>
                                        </div>
                                    );
                                    if (r.status === "processing") return (
                                        <div key={r.sucursal} className="dep_resultado_suc dep_resultado_suc_processing">
                                            <div className="dep_resultado_suc_header">
                                                <span className="dep_badge dep_badge_sucursal">{r.sucursal}</span>
                                                <span className="dep_resultado_enviando">
                                                    <FaSync className="dep_spin" /> Enviando...
                                                </span>
                                            </div>
                                        </div>
                                    );
                                    return (
                                        <div key={r.sucursal} className={`dep_resultado_suc ${r.ok ? "" : "dep_resultado_suc_error"}`}>
                                            <div
                                                className="dep_resultado_suc_header dep_resultado_suc_header_toggle"
                                                onClick={() => toggleSucursalModal(r.sucursal)}
                                            >
                                                <span className="dep_badge dep_badge_sucursal">{r.sucursal}</span>
                                                {r.ok
                                                    ? <span className="dep_resultado_nro">→ Nro Quantio: <strong>{r.nro_pedido_quantio}</strong> · {r.reservas_procesadas} reservas · {r.productos_enviados} productos</span>
                                                    : <span className="dep_resultado_err">{r.error ?? "Error desconocido"}</span>
                                                }
                                                {r.ok && r.faltantes?.length > 0 && (
                                                    <span className="dep_modal_chevron dep_modal_chevron_warn">
                                                        {abierta ? <FaChevronDown /> : <FaChevronRight />}
                                                    </span>
                                                )}
                                            </div>
                                            {abierta && r.ok && r.faltantes?.length > 0 && (
                                                <div className="dep_faltantes">
                                                    <div className="dep_faltantes_header">
                                                        <FaExclamationTriangle />
                                                        <span>Faltantes ({r.faltantes.length})</span>
                                                    </div>
                                                    <table className="dep_tabla dep_tabla_modal">
                                                        <thead>
                                                            <tr><th>Descripción</th><th>Solic.</th><th>Confirm.</th><th>Faltante</th></tr>
                                                        </thead>
                                                        <tbody>
                                                            {r.faltantes.map(f => (
                                                                <tr key={f.idProducto}>
                                                                    <td>{f.descripcion ?? f.codebar ?? f.idProducto}</td>
                                                                    <td className="dep_td_cant">{f.solicitada}</td>
                                                                    <td className="dep_td_cant">{f.confirmada}</td>
                                                                    <td className="dep_td_cant dep_td_faltante">{f.faltante}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="dep_modal_acciones">
                                <button className="dep_btn_guardar" onClick={() => setModalProcesar(false)} disabled={procesando}>Cerrar</button>
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}
