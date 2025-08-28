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
    const { usuario } = useAuth();
    const [open, setOpen] = useState(false);

    // filtros
    const [ean, setEan] = useState("");
    const [nombre, setNombre] = useState("");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");

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


    // cierra con ESC
    useEffect(() => {
        const onEsc = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, []);

    useEffect(() => {
        // cuando se abre: setear ayer→hoy si están vacíos y buscar
        if (open) {
            const hasDates = Boolean(start && end);
            const { start: defStart, end: defEnd } = getDefaultRange();

            // si no hay fechas cargadas, setear por defecto
            if (!hasDates) {
                setStart(defStart);
                setEnd(defEnd);
                // fetch después de setState: microtask para asegurar que el input ya tiene valores
                queueMicrotask(() => fetchPedidos(1));
            } else {
                // si ya hay fechas, buscar igual al abrir
                fetchPedidos(1);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);


    const fetchPedidos = async (targetPage = 1) => {
        if (!usuario?.sucursal_codigo) return;
        if (!canSearch) return;

        try {
            setLoading(true);
            setError("");
            setPage(targetPage);

            const qs = new URLSearchParams({
                start,
                end,
                page: String(targetPage),
                pageSize: String(PAGE_SIZE),
            });
            if (ean.trim()) qs.set("q", ean.trim());
            if (nombre.trim()) qs.set("q", nombre.trim());

            // usamos header X-Sucursal para que matchee con el patch del endpoint
            const res = await fetch(`${API_URL}/api/ver-pedidos?${qs.toString()}`, {
                headers: { "X-Sucursal": usuario.sucursal_codigo },
                credentials: "include",
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "Error desconocido");
            setResult(json);
        } catch (err) {
            setError(err.message || "Error cargando pedidos");
            setResult({ pedidos: [], total: 0, page: 1, pageSize: PAGE_SIZE });
        } finally {
            setLoading(false);
        }
    };

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil((result.total || 0) / (result.pageSize || PAGE_SIZE))),
        [result.total, result.pageSize]
    );

    // aplanamos pedidos -> items
    const allItems = result.pedidos
        .flatMap(p =>
            p.items.map(it => ({
                ...it,
                fecha: dayjs.tz(p.fecha, "YYYY-MM-DD HH:mm:ss", "America/Argentina/Buenos_Aires"),
                nro_pedido: it.nro_pedido_drogueria,
                drogueria: it.drogueria_comprada
            }))
        ).sort((a, b) => b.fecha - a.fecha);



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
                    <button className="ultpedidos_close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
                </div>

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
                                            <td>{it.nro_pedido ?? "—"}</td>
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


                {/* Paginación */}
                {!loading && result.total > result.pageSize && (
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
