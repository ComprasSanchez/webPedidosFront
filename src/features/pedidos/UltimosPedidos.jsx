// front/src/features/pedidos/UltimosPedidos.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { FaChevronRight } from "react-icons/fa";

const PAGE_SIZE = 25;

export default function UltimosPedidos() {
    const { usuario, authFetch } = useAuth();
    const [open, setOpen] = useState(false);

    // filtros
    const [ean, setEan] = useState("");
    const [nombre, setNombre] = useState("");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");

    const [idsFiltrados, setIdsFiltrados] = useState(null); // ahora serán id_pedido

    // data
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState({ pedidos: [], total: 0, page: 1, pageSize: PAGE_SIZE });

    // bloquea buscar si falta fecha
    const canSearch = useMemo(() => Boolean(start && end), [start, end]);

    function pad(n) { return n.toString().padStart(2, "0"); }
    function formatLocalYYYYMMDD(d) {
        // arma YYYY-MM-DD en hora local (sin UTC shift)
        const y = d.getFullYear();
        const m = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        return `${y}-${m}-${day}`;
    }
    function getDefaultRange() {
        const today = new Date();
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        return {
            start: formatLocalYYYYMMDD(yesterday),
            end: formatLocalYYYYMMDD(today),
        };
    }

    const handleAbrir = (e) => {
        const { start, end, idPedidos } = e.detail || {};
        if (start) setStart(start);
        if (end) setEnd(end);
        setIdsFiltrados(idPedidos?.length ? idPedidos : null);
        setOpen(true);

        // fetch con filtros directamente
        const { start: s, end: e_ } = getDefaultRange();
        const desde = start || s;
        const hasta = end || e_;

        queueMicrotask(() => {
            fetchPedidos(1, idPedidos?.length ? idPedidos : null, desde, hasta);
        });
    };


    // cierra con ESC
    useEffect(() => {
        const onEsc = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, []);

    useEffect(() => {
        window.addEventListener("ultped:open", handleAbrir);
        return () => window.removeEventListener("ultped:open", handleAbrir);
    }, []);


    useEffect(() => {
        // cuando se abre: setear ayer→hoy si están vacíos y buscar
        if (open) {
            const hasDates = Boolean(start && end);
            const hasIds = Array.isArray(idsFiltrados) && idsFiltrados.length > 0;

            const { start: defStart, end: defEnd } = getDefaultRange();
            if (!hasDates) {
                setStart(defStart);
                setEnd(defEnd);
                queueMicrotask(() => {
                    if (hasIds) {
                        fetchPedidos(1, idsFiltrados, defStart, defEnd);
                    }
                });
            } else if (hasIds) {
                fetchPedidos(1, idsFiltrados, start, end);
            }

        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);


    const fetchPedidos = async (targetPage = 1, idsFiltro = idsFiltrados, startParam = start, endParam = end) => {
        // 🔧 NUEVO: Diferentes validaciones según rol
        if (usuario?.rol === 'sucursal' && !usuario?.sucursal_codigo) return;
        if (!startParam || !endParam) return;

        try {
            setLoading(true);
            setError("");
            setPage(targetPage);

            const qs = new URLSearchParams({
                start: startParam,
                end: endParam,
                page: String(targetPage),
                pageSize: idsFiltro?.length ? "1000" : String(PAGE_SIZE), // Más resultados cuando hay filtro
            });
            if (ean.trim()) qs.set("q", ean.trim());
            if (nombre.trim()) qs.set("q", nombre.trim());

            // 🔧 NUEVO: Usuarios de compras pueden especificar sucursal, otros usan la propia
            if (usuario?.rol === 'compras' && usuario?.sucursal_codigo) {
                qs.set("sucursal", usuario.sucursal_codigo);
            }

            const res = await authFetch(`${API_URL}/api/ver-pedidos?${qs.toString()}`);
            const json = await res.json();

            if (!json.ok) throw new Error(json.error || "Error desconocido");

            let pedidosFiltrados = json.pedidos;

            if (idsFiltro?.length) {
                const idsSet = new Set(idsFiltro.map(id => String(id)));
                // Filtrar por id_pedido y solo ítems pendientes (sin número válido)
                const excluidas = ['kellerof', 'kellerhoff', 'falta', 'Faltante', 'Falta'];
                pedidosFiltrados = pedidosFiltrados
                    .flatMap(p => p.items.map(i => ({ ...i, pedidoFecha: p.fecha })))
                    .filter(i => {
                        const pendiente =
                            i.nro_pedido_drogueria == null ||
                            i.nro_pedido_drogueria === 'Sin nro de pedido' ||
                            i.nro_pedido_drogueria === '0';
                        const drogExcluida = excluidas.includes((i.drogueria_comprada || '').toLowerCase());
                        return idsSet.has(String(i.id_pedido)) && pendiente && !drogExcluida;
                    });
                // Reconvertir a estructura de pedidos para la tabla
                pedidosFiltrados = pedidosFiltrados.map(i => ({
                    fecha: i.pedidoFecha,
                    items: [i]
                }));
            }

            setResult({
                ...json,
                pedidos: pedidosFiltrados,
                total: idsFiltro?.length ? pedidosFiltrados.length : json.total, // Solo cambiar total cuando hay filtro
                page: 1,
            });
        } catch (err) {
            setError(err.message || "Error cargando pedidos");
            setResult({ pedidos: [], total: 0, page: 1, pageSize: PAGE_SIZE });
        } finally {
            setLoading(false);
        }
    };

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil((result.total || 0) / PAGE_SIZE)),
        [result.total]
    );

    // aplanamos pedidos -> items y ordenamos por fecha (más reciente primero)
    const allItems = result.pedidos
        .flatMap(p =>
            p.items.map(it => ({
                ...it,
                fecha: dayjs.tz(p.fecha, "YYYY-MM-DD HH:mm:ss", "America/Argentina/Buenos_Aires"),
                nro_pedido: it.nro_pedido_drogueria,
                drogueria: it.drogueria_comprada
            }))
        )
        .sort((a, b) => b.fecha.valueOf() - a.fecha.valueOf()); // Ordenar por fecha desc

    return (
        <>
            {/* Botón lateral */}
            <button
                className={`ultpedidos_tab ${open ? "is-open" : ""}`}
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                {!open ? (
                    <span className="label">ÚLTIMOS PEDIDOS</span>
                ) : (
                    <FaChevronRight className="ultpedidos_arrow" />
                )}
            </button>

            <div
                className={`ultpedidos_backdrop ${open ? "show" : ""}`}
                onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <aside className={`ultpedidos_panel ${open ? "open" : ""}`} aria-hidden={!open}>
                <div className="ultpedidos_header">
                    <h3>Últimos pedidos</h3>
                    <h4>
                        {usuario?.rol === 'compras'
                            ? (sessionStorage.getItem("sucursalReponer") || "Seleccionar sucursal")
                            : (usuario?.sucursal_codigo || "Sin sucursal")
                        }
                    </h4>
                    <button className="ultpedidos_close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
                </div>

                {/* Indicador de filtro activo */}
                {/* Filtros */}
                <form
                    className="ultpedidos_filters"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (canSearch) fetchPedidos(1);
                    }}
                >
                    <div className="fld">
                        <label>Código de barras</label>
                        <input value={ean} onChange={(e) => setEan(e.target.value)} placeholder="EAN" />
                    </div>

                    <div className="fld">
                        <label>Nombre de producto</label>
                        <input
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej: ibuprofeno"
                        />
                    </div>

                    <div className="fld">
                        <label>Desde*</label>
                        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
                    </div>

                    <div className="fld">
                        <label>Hasta*</label>
                        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
                    </div>


                    <div className="actions">
                        <button type="submit" className="btn" disabled={!canSearch || loading}>
                            {loading ? "Buscando…" : "Buscar"}
                        </button>
                        {!canSearch && <small className="req-hint">Elegí un rango de fechas para buscar</small>}
                    </div>
                </form>

                {/* Indicador de filtro activo */}
                {idsFiltrados && (
                    <div className="ultpedidos_filter_indicator">
                        <span className="filter_text">
                            📋 Mostrando {idsFiltrados.length} producto{idsFiltrados.length > 1 ? 's' : ''} que no{idsFiltrados.length > 1 ? ' fueron' : ' fue'} pedido con éxito
                        </span>
                        <button
                            className="filter_clear_btn"
                            onClick={() => {
                                setIdsFiltrados(null);
                                if (start && end) {
                                    fetchPedidos(1, null, start, end);
                                }
                            }}
                            title="Limpiar filtro y mostrar todos los pedidos"
                        >
                            Borrar filtro
                        </button>
                    </div>
                )}

                {/* Estado */}
                {error && <div className="ultpedidos_error">{error}</div>}
                {loading && <div className="ultpedidos_loading">CARGANDO…</div>}

                {/* Lista de pedidos como tabla única */}
                {!loading && !error && (
                    <div className="ultpedidos_table_wrap">
                        {allItems.length === 0 ? (
                            <div className="ultpedidos_empty">Presiona "Buscar" para ver resultados</div>
                        ) : (
                            <table className="ultpedidos_table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Nro Pedido</th>
                                        <th>EAN</th>
                                        <th>Descripción</th>
                                        <th>Cant</th>
                                        <th>Droguería</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allItems.map((it, idx) => (
                                        <tr key={`${it.id}-${idx}`}>
                                            <td>{it.fecha.format("DD/MM/YYYY HH:mm")}</td>
                                            <td>{it.nro_pedido ?? "-"}</td>
                                            <td>{it.codebar}</td>
                                            <td
                                                title={`Precio: $${Number(it.precio_comprado || 0).toFixed(2)} | Motivo: ${it.motivo ?? "—"}`}
                                            >
                                                {(it.producto_nombre || it.producto_presentacion)
                                                    ? `${it.producto_nombre ?? ""} ${it.producto_presentacion ?? ""}`.trim()
                                                    : "—"}
                                            </td>
                                            <td>{it.cantidad}</td>
                                            <td>{it.drogueria.toUpperCase()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}


                {/* Paginación - solo mostrar cuando NO hay filtro y hay más resultados */}
                {!loading && !idsFiltrados && result.total > PAGE_SIZE && (
                    <div className="ultpedidos_pager">
                        <button
                            onClick={() => fetchPedidos(Math.max(1, page - 1))}
                            disabled={page <= 1 || loading}
                        >
                            ←
                        </button>
                        <span>{page} / {totalPages}</span>
                        <button
                            onClick={() => fetchPedidos(Math.min(totalPages, page + 1))}
                            disabled={page >= totalPages || loading}
                        >
                            →
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
