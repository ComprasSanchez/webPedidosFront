// front/src/features/reposicion/ResumenPedidos.jsx
import { useEffect, useState, useCallback } from "react";
import { FaDownload } from "react-icons/fa";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/resumenPedidos.scss";

const PAGE_SIZE = 50;

function pad(n) { return String(n).padStart(2, "0"); }

function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatFecha(raw) {
    if (!raw) return "—";
    // Con dateStrings:true en mysql2, las fechas siempre llegan como "YYYY-MM-DD HH:mm:ss"
    // ya en hora Buenos Aires. Solo reformateamos.
    const [dp, tp = ""] = String(raw).split(" ");
    const [, month, day] = dp.split("-");
    const [h = "00", m = "00"] = tp.split(":");
    return `${day}/${month} ${h}:${m}`;
}

function formatMonto(val) {
    if (val === null || val === undefined || val === "" || Number(val) === 0) return "—";
    return Number(val).toFixed(2).replace(".", ",");
}

const ESTADO_CLASE = {
    EXITOSO: "exitoso",
    ERROR: "error",
    PROCESANDO: "procesando",
    CREDITO_AGOTADO: "credito_agotado",
    SKIP: "skip",
    SKIPPED: "skipped",
    FALTA: "falta",
};

const PROVEEDOR_CLASE = {
    monroe: "monroe",
    cofarsur: "cofarsur",
    suizo: "suizo",
    suizaTuc: "suizatuc",
    deposito: "deposito",
    kellerhoff: "kellerhoff",
    Falta: "falta",
};

const PROVEEDORES = [
    { value: "", label: "Todos los proveedores" },
    { value: "monroe", label: "Monroe" },
    { value: "cofarsur", label: "Cofarsur" },
    { value: "suizo", label: "Suizo" },
    { value: "suizaTuc", label: "Suiza Tucumán" },
    { value: "deposito", label: "Depósito" },
    { value: "kellerhoff", label: "Kellerhoff" },
    { value: "Falta", label: "Falta" },
];

const ESTADOS = [
    { value: "", label: "Todos los estados" },
    { value: "EXITOSO", label: "Exitoso" },
    { value: "ERROR", label: "Error" },
    { value: "PROCESANDO", label: "Procesando" },
    { value: "CREDITO_AGOTADO", label: "Crédito agotado" },
    { value: "SKIP", label: "Skip (sin API)" },
    { value: "FALTA", label: "Falta" },
];

export default function ResumenPedidos() {
    const { authFetch } = useAuth();

    const [start, setStart] = useState(hoy());
    const [end, setEnd] = useState(hoy());
    const [proveedor, setProveedor] = useState("");
    const [estado, setEstado] = useState("");
    const [sucursal, setSucursal] = useState("");

    const [soloReposicion, setSoloReposicion] = useState(true);
    const [descargando, setDescargando] = useState(null); // id del registro en descarga

    const [page, setPage] = useState(1);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Construye la query string de filtros activos
    const buildParams = useCallback(() => {
        const p = new URLSearchParams();
        if (start) p.set("start", start);
        if (end) p.set("end", end);
        if (proveedor) p.set("proveedor", proveedor);
        if (estado) p.set("estado", estado);
        if (sucursal) p.set("sucursal", sucursal);
        p.set("soloReposicion", soloReposicion ? "true" : "false");
        return p;
    }, [start, end, proveedor, estado, sucursal, soloReposicion]);

    const fetchData = useCallback(async (p = 1) => {
        setLoading(true);
        setError("");
        try {
            const params = buildParams();
            params.set("page", p);
            params.set("pageSize", PAGE_SIZE);

            const res = await authFetch(`${API_URL}/api/resumen-pedidos?${params.toString()}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const json = await res.json();
            setData(json.data || []);
            setTotal(json.total || 0);
            setPage(p);
        } catch (e) {
            setError("No se pudo cargar el resumen de pedidos.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [authFetch, buildParams]);

    // Carga inicial
    useEffect(() => {
        fetchData(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDescargar = async (row) => {
        if (descargando) return;
        setDescargando(row.id);
        try {
            const res = await authFetch(`${API_URL}/api/resumen-pedidos/${row.id}/descargar`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || `Error ${res.status} al descargar`);
                return;
            }
            const blob = await res.blob();
            const ext = row.proveedor === "kellerhoff" ? "xlsx" : "txt";
            const fileName = row.proveedor === "kellerhoff"
                ? `Pedido_Keller_${row.sucursal}.xlsx`
                : `Pedido_Suiza_Tucuman_${row.sucursal}.txt`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Error descargando:", e);
            alert("Error al descargar el archivo.");
        } finally {
            setDescargando(null);
        }
    };

    const handleBuscar = () => fetchData(1);

    const handleLimpiar = () => {
        setStart(hoy());
        setEnd(hoy());
        setProveedor("");
        setEstado("");
        setSucursal("");
        setSoloReposicion(true);
        // el fetchData se dispara en el siguiente render NO automáticamente,
        // lo forzamos a mano después del reset
        setTimeout(() => fetchData(1), 50);
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Métricas del resultado actual
    const stats = {
        exitosos: data.filter(r => r.estado_pedido === "EXITOSO").length,
        errores: data.filter(r => r.estado_pedido === "ERROR").length,
        monto: data
            .filter(r => r.estado_pedido === "EXITOSO")
            .reduce((acc, r) => acc + Number(r.monto_calculado || 0), 0),
    };

    return (
        <div className="rped">
            <h2 className="rped_titulo">Resumen de Pedidos a Droguerías</h2>

            {/* ── Filtros ── */}
            <div className="rped_filtros">
                <label>
                    Desde
                    <input type="date" value={start} onChange={e => setStart(e.target.value)} />
                </label>
                <label>
                    Hasta
                    <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
                </label>
                <label>
                    Proveedor
                    <select value={proveedor} onChange={e => setProveedor(e.target.value)}>
                        {PROVEEDORES.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Estado
                    <select value={estado} onChange={e => setEstado(e.target.value)}>
                        {ESTADOS.map(e => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Sucursal
                    <input
                        type="text"
                        placeholder="ej: SA3"
                        value={sucursal}
                        onChange={e => setSucursal(e.target.value.toUpperCase())}
                        style={{ width: 90 }}
                    />
                </label>
                <label>
                    Reposición
                    <div className="rped_check_wrap">
                        <input
                            type="checkbox"
                            checked={soloReposicion}
                            onChange={e => setSoloReposicion(e.target.checked)}
                        />
                    </div>
                </label>
                <button className="rped_btn rped_btn--buscar" onClick={handleBuscar}>
                    Buscar
                </button>
                <button className="rped_btn rped_btn--limpiar" onClick={handleLimpiar}>
                    Limpiar
                </button>
            </div>

            {/* ── Estadísticas rápidas ── */}
            {!loading && data.length > 0 && (
                <div className="rped_stats">
                    <span>Total registros: <strong>{total.toLocaleString("es-AR")}</strong></span>
                    <span>Exitosos en página: <strong>{stats.exitosos}</strong></span>
                    {stats.errores > 0 && (
                        <span>Errores en página: <strong>{stats.errores}</strong></span>
                    )}
                    {stats.monto > 0 && (
                        <span>Monto exitosos: <strong>{formatMonto(stats.monto)}</strong></span>
                    )}
                </div>
            )}

            {/* ── Contenido ── */}
            {loading && <div className="rped_loading">Cargando...</div>}

            {error && !loading && (
                <div className="rped_empty" style={{ color: "#c0392b" }}>{error}</div>
            )}

            {!loading && !error && data.length === 0 && (
                <div className="rped_empty">No hay registros para los filtros seleccionados.</div>
            )}

            {!loading && !error && data.length > 0 && (
                <div className="rped_tabla_wrapper">
                    <table className="rped_tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Usuario</th>
                                <th>Sucursal</th>
                                <th>Proveedor</th>
                                <th>Nro Pedido</th>
                                <th>Productos</th>
                                <th>Unidades</th>
                                <th>Monto</th>
                                <th>Estado</th>
                                <th>Mensaje</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(row => {
                                const estadoKey = (row.estado_pedido || "").toUpperCase();
                                const estadoClase = ESTADO_CLASE[estadoKey] || "desconocido";
                                const provClase = PROVEEDOR_CLASE[row.proveedor] || "default";

                                return (
                                    <tr key={row.id}>
                                        <td style={{ whiteSpace: "nowrap" }}>
                                            {formatFecha(row.fecha_creacion)}
                                        </td>
                                        <td>
                                            {row.usuario_nombre || row.usuario_login || `ID ${row.usuario_id}`}
                                        </td>
                                        <td>{row.sucursal || "—"}</td>
                                        <td>
                                            <span className={`rped_proveedor rped_proveedor--${provClase}`}>
                                                {row.proveedor}
                                            </span>
                                        </td>
                                        <td>
                                            {row.nro_pedido_proveedor
                                                ? <span className="rped_nropedido">{row.nro_pedido_proveedor}</span>
                                                : <span style={{ color: "#aaa" }}>—</span>}
                                        </td>
                                        <td style={{ textAlign: "center" }}>{row.cantidad_productos ?? "—"}</td>
                                        <td style={{ textAlign: "center" }}>{row.total_unidades ?? "—"}</td>
                                        <td className="rped_monto">{formatMonto(row.monto_calculado)}</td>
                                        <td>
                                            <span className={`rped_estado rped_estado--${estadoClase}`}>
                                                {row.estado_pedido}
                                            </span>
                                        </td>
                                        <td style={{ maxWidth: 260, wordBreak: "break-word", fontSize: "0.8rem", color: "#555" }}>
                                            {row.mensaje_proveedor || "—"}
                                        </td>
                                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                            {(row.proveedor === "kellerhoff" || row.proveedor === "suizaTuc") && row.estado_pedido === "SKIP" && (
                                                <button
                                                    className="rped_btn_descarga"
                                                    onClick={() => handleDescargar(row)}
                                                    disabled={descargando === row.id}
                                                    title="Descargar archivo"
                                                >
                                                    {descargando === row.id
                                                        ? <span style={{ fontSize: "0.75rem" }}>...</span>
                                                        : <FaDownload />}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Paginación ── */}
            {totalPages > 1 && (
                <div className="rped_paginacion">
                    <button onClick={() => fetchData(1)} disabled={page === 1}>«</button>
                    <button onClick={() => fetchData(page - 1)} disabled={page === 1}>‹</button>

                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        // Ventana deslizante de 7 páginas centrada en `page`
                        const half = 3;
                        let first = Math.max(1, page - half);
                        const last = Math.min(totalPages, first + 6);
                        first = Math.max(1, last - 6);
                        const n = first + i;
                        if (n > totalPages) return null;
                        return (
                            <button key={n} onClick={() => fetchData(n)}
                                className={n === page ? "active" : ""}>
                                {n}
                            </button>
                        );
                    })}

                    <button onClick={() => fetchData(page + 1)} disabled={page === totalPages}>›</button>
                    <button onClick={() => fetchData(totalPages)} disabled={page === totalPages}>»</button>
                    <span>Página {page} de {totalPages} ({total.toLocaleString("es-AR")} registros)</span>
                </div>
            )}
        </div>
    );
}
