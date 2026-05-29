// front/src/features/convenios/GestionConvenios.jsx
import { useEffect, useState, useCallback } from "react";
import { FaPlus, FaEdit, FaTrash, FaCheckSquare, FaSearch, FaLayerGroup, FaPercent } from "react-icons/fa";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import Modal from "../../components/ui/Modal";
import "../../styles/convenios.scss";

const PROVEEDORES_DISPONIBLES = [
    "kellerhoff",
    "cofarsur",
    "monroe",
    "delsud",
    "suizaTuc",
    "deposito",
];

const PROVEEDOR_LABEL = {
    kellerhoff: "Kellerhoff",
    cofarsur: "Cofarsur",
    monroe: "Monroe",
    delsud: "Del Sud",
    suizaTuc: "Suiza Tuc.",
    deposito: "Depósito",
    suizo: "Suizo",
};

const PROVEEDORES_NC = ["suizo", "monroe", "cofarsur", "delsud", "kellerhoff", "suizaTuc"];

const SCOPE_LABEL = {
    producto: "Producto específico",
    laboratorio: "Laboratorio",
    perfumeria: "Toda la perfumería",
    todo: "Todos los productos",
};

const EMPTY_NC_FORM = {
    id_proveedor: "",
    scope: "perfumeria",
    scope_valor: "",
    porcentaje: "",
    descripcion: "",
    activo: true,
};

const EMPTY_FORM = {
    convenio_id: "",
    tipo: "EAN",
    ean: "",
    codlab: "",
    prioridad: [],
};

// PrioridadEditor (reutilizable)
function PrioridadEditor({ prioridad, onChange }) {
    const disponibles = PROVEEDORES_DISPONIBLES.filter(p => !prioridad.includes(p));

    const mover = (idx, dir) => {
        const arr = [...prioridad];
        const swap = idx + dir;
        if (swap < 0 || swap >= arr.length) return;
        [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
        onChange(arr);
    };

    const quitar = (idx) => onChange(prioridad.filter((_, i) => i !== idx));

    const agregar = (slug) => {
        if (!slug || prioridad.includes(slug)) return;
        onChange([...prioridad, slug]);
    };

    return (
        <div className="conv_prio_section">
            <span className="conv_label_text">Prioridad de proveedores</span>
            <p className="conv_prio_hint">
                El sistema usa los proveedores en este orden. Si el primero no tiene stock, intenta el siguiente.
            </p>
            {prioridad.length === 0 && (
                <p className="conv_prio_empty">Sin proveedores asignados</p>
            )}
            <ul className="conv_prio_list">
                {prioridad.map((slug, idx) => (
                    <li key={slug} className="conv_prio_item">
                        <span className="conv_prio_num">{idx + 1}</span>
                        <span className={`conv_chip conv_chip_${slug}`}>
                            {PROVEEDOR_LABEL[slug] ?? slug}
                        </span>
                        <div className="conv_prio_btns">
                            <button disabled={idx === 0} onClick={() => mover(idx, -1)} title="Subir">↑</button>
                            <button disabled={idx === prioridad.length - 1} onClick={() => mover(idx, 1)} title="Bajar">↓</button>
                            <button className="conv_prio_quitar" onClick={() => quitar(idx)} title="Quitar">×</button>
                        </div>
                    </li>
                ))}
            </ul>
            {disponibles.length > 0 && (
                <div className="conv_prio_agregar">
                    <select
                        defaultValue=""
                        onChange={e => { agregar(e.target.value); e.target.value = ""; }}
                    >
                        <option value="" disabled>+ Agregar proveedor</option>
                        {disponibles.map(p => (
                            <option key={p} value={p}>{PROVEEDOR_LABEL[p] ?? p}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

// Pagina principal
export default function GestionConvenios() {
    const { authFetch } = useAuth();

    // Tab activo
    const [tab, setTab] = useState("convenios"); // 'convenios' | 'descuentos-nc'

    // Lista principal
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [buscar, setBuscar] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("");
    const [filtroLab, setFiltroLab] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [conveniosPadre, setConveniosPadre] = useState([]);
    const [laboratorios, setLaboratorios] = useState([]);

    // Seleccion multiple (editar prioridad en masa)
    const [seleccionados, setSeleccionados] = useState(new Set());

    // Modal editar individual
    const [modalForm, setModalForm] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [confirmandoForm, setConfirmandoForm] = useState(false);

    // Modal bulk edit
    const [modalBulk, setModalBulk] = useState(false);
    const [bulkPrioridad, setBulkPrioridad] = useState([]);
    const [confirmandoBulk, setConfirmandoBulk] = useState(false);

    // Modal bulk create (agregar masivo)
    const [modalBulkCreate, setModalBulkCreate] = useState(false);
    const [buscarProducto, setBuscarProducto] = useState("");
    const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
    const [loadingBusqueda, setLoadingBusqueda] = useState(false);
    const [prodSelec, setProdSelec] = useState(new Set());
    const [bulkCreateConvenio, setBulkCreateConvenio] = useState("");
    const [bulkCreatePrioridad, setBulkCreatePrioridad] = useState([]);
    const [savingCreate, setSavingCreate] = useState(false);
    const [createResult, setCreateResult] = useState(null);
    const [confirmandoCreate, setConfirmandoCreate] = useState(false);

    // ── Descuentos NC state ────────────────────────────────────────────────────
    const [ncItems, setNcItems] = useState([]);
    const [ncLoading, setNcLoading] = useState(false);
    const [ncError, setNcError] = useState(null);
    const [ncModalForm, setNcModalForm] = useState(false);
    const [ncEditando, setNcEditando] = useState(null);
    const [ncForm, setNcForm] = useState(EMPTY_NC_FORM);
    const [ncFormError, setNcFormError] = useState(null);
    const [ncSaving, setNcSaving] = useState(false);
    // Mini buscador de producto para scope='producto'
    const [ncProdBuscar, setNcProdBuscar] = useState("");
    const [ncProdResultados, setNcProdResultados] = useState([]);
    const [ncProdLoading, setNcProdLoading] = useState(false);
    const [ncProdSelDesc, setNcProdSelDesc] = useState(""); // descripcion del idPlex seleccionado

    // Compartido
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const LIMIT = 50;

    // Carga inicial
    useEffect(() => {
        authFetch(`${API_URL}/api/convenios/padres`)
            .then(r => r.json())
            .then(data => setConveniosPadre(Array.isArray(data) ? data : []))
            .catch(() => { });
        authFetch(`${API_URL}/api/convenios/laboratorios`)
            .then(r => r.json())
            .then(data => setLaboratorios(Array.isArray(data) ? data : []))
            .catch(() => { });
    }, [authFetch]);

    // Cargar detalle
    const cargar = useCallback(() => {
        setLoading(true);
        setError(null);
        setSeleccionados(new Set());
        const params = new URLSearchParams({ page, limit: LIMIT, buscar, tipo: filtroTipo, laboratorio: filtroLab });
        authFetch(`${API_URL}/api/convenios/detalle?${params}`)
            .then(r => { if (!r.ok) throw new Error("Error al cargar"); return r.json(); })
            .then(data => { setItems(data.items || []); setTotal(data.total || 0); })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [authFetch, page, buscar, filtroTipo, filtroLab]);

    useEffect(() => { cargar(); }, [cargar]);

    // Seleccion
    const todosSeleccionados = items.length > 0 && items.every(i => seleccionados.has(i.id));
    const algunoSeleccionado = seleccionados.size > 0;

    const toggleTodos = () => {
        if (todosSeleccionados) {
            setSeleccionados(new Set());
        } else {
            setSeleccionados(new Set(items.map(i => i.id)));
        }
    };

    const toggleItem = (id) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Modales editar
    const abrirCrear = () => {
        const def = conveniosPadre.find(c => c.activo) ?? conveniosPadre[0];
        setForm({ ...EMPTY_FORM, convenio_id: def?.id ?? "" });
        setEditando(null);
        setFormError(null);
        setModalForm(true);
    };

    const abrirEditar = (item) => {
        setForm({
            convenio_id: item.convenio_id,
            tipo: item.tipo,
            ean: item.ean || "",
            codlab: item.codlab || "",
            prioridad: Array.isArray(item.prioridad) ? [...item.prioridad] : [],
        });
        setEditando(item.id);
        setFormError(null);
        setModalForm(true);
    };

    const abrirBulk = () => {
        const primera = items.find(i => seleccionados.has(i.id));
        setBulkPrioridad(primera?.prioridad ? [...primera.prioridad] : []);
        setFormError(null);
        setModalBulk(true);
    };

    // Guardar uno
    const guardar = async () => {
        setFormError(null);
        if (!form.convenio_id) return setFormError("Selecioná un convenio");
        if (form.tipo === "EAN" && !form.ean.trim()) return setFormError("EAN requerido");
        if (form.tipo === "LAB" && !form.codlab.trim()) return setFormError("CodLab requerido");
        if (form.prioridad.length === 0) return setFormError("Agregá al menos un proveedor");
        setSaving(true);
        try {
            const url = editando
                ? `${API_URL}/api/convenios/detalle/${editando}`
                : `${API_URL}/api/convenios/detalle`;
            const r = await authFetch(url, {
                method: editando ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    convenio_id: form.convenio_id,
                    tipo: form.tipo,
                    ean: form.tipo === "EAN" ? form.ean.trim() : null,
                    codlab: form.tipo === "LAB" ? form.codlab.trim() : null,
                    prioridad: form.prioridad,
                }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Error"); }
            setModalForm(false);
            cargar();
        } catch (e) {
            setFormError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // Guardar bulk edit
    const guardarBulk = async () => {
        setFormError(null);
        if (bulkPrioridad.length === 0) return setFormError("Agregá al menos un proveedor");
        setSaving(true);
        try {
            const r = await authFetch(`${API_URL}/api/convenios/detalle/bulk`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...seleccionados], prioridad: bulkPrioridad }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Error"); }
            setModalBulk(false);
            cargar();
        } catch (e) {
            setFormError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // Eliminar
    const eliminar = async (id) => {
        if (!window.confirm("¿Eliminar esta regla de convenio?\n\nEsta acción no se puede deshacer. El sistema dejará de aplicar esta prioridad para el producto o laboratorio indicado.")) return;
        try {
            const r = await authFetch(`${API_URL}/api/convenios/detalle/${id}`, { method: "DELETE" });
            if (!r.ok) throw new Error("Error al eliminar");
            cargar();
        } catch (e) {
            alert(e.message);
        }
    };

    // Buscar productos en plex (para agregar masivo)
    const buscarProductos = async () => {
        if (!buscarProducto.trim()) return;
        setLoadingBusqueda(true);
        setResultadosBusqueda([]);
        setProdSelec(new Set());
        try {
            const r = await authFetch(`${API_URL}/api/convenios/productos/buscar?q=${encodeURIComponent(buscarProducto)}&limit=500`);
            const data = await r.json();
            setResultadosBusqueda(Array.isArray(data) ? data : []);
        } catch { }
        setLoadingBusqueda(false);
    };

    // Abrir modal agregar masivo
    const abrirBulkCreate = () => {
        const def = conveniosPadre.find(c => c.activo) ?? conveniosPadre[0];
        setBulkCreateConvenio(def?.id ?? "");
        setBulkCreatePrioridad([]);
        setBuscarProducto("");
        setResultadosBusqueda([]);
        setProdSelec(new Set());
        setFormError(null);
        setCreateResult(null);
        setModalBulkCreate(true);
    };

    // Guardar bulk create
    const guardarBulkCreate = async () => {
        setFormError(null);
        if (!bulkCreateConvenio) return setFormError("Selecioná un convenio");
        if (prodSelec.size === 0) return setFormError("Selecioná al menos un producto");
        if (bulkCreatePrioridad.length === 0) return setFormError("Agregá al menos un proveedor");
        setSavingCreate(true);
        try {
            const r = await authFetch(`${API_URL}/api/convenios/detalle/bulk-create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    convenio_id: bulkCreateConvenio,
                    prioridad: bulkCreatePrioridad,
                    eans: [...prodSelec],
                }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Error"); }
            const res = await r.json();
            setCreateResult(res);
            cargar();
        } catch (e) {
            setFormError(e.message);
        } finally {
            setSavingCreate(false);
        }
    };

    const totalPages = Math.ceil(total / LIMIT);

    // ── Descuentos NC handlers ────────────────────────────────────────────────
    const cargarNC = useCallback(() => {
        setNcLoading(true);
        setNcError(null);
        authFetch(`${API_URL}/api/convenios/descuentos-nc`)
            .then(r => { if (!r.ok) throw new Error("Error al cargar"); return r.json(); })
            .then(data => setNcItems(Array.isArray(data) ? data : []))
            .catch(e => setNcError(e.message))
            .finally(() => setNcLoading(false));
    }, [authFetch]);

    useEffect(() => { if (tab === "descuentos-nc") cargarNC(); }, [tab, cargarNC]);

    const ncAbrirCrear = () => {
        setNcForm(EMPTY_NC_FORM);
        setNcEditando(null);
        setNcFormError(null);
        setNcProdBuscar("");
        setNcProdResultados([]);
        setNcProdSelDesc("");
        setNcModalForm(true);
    };

    const ncAbrirEditar = (item) => {
        setNcForm({
            id_proveedor: item.id_proveedor,
            scope: item.scope,
            scope_valor: item.scope_valor ?? "",
            porcentaje: String(item.porcentaje),
            descripcion: item.descripcion ?? "",
            activo: item.activo === 1 || item.activo === true,
        });
        setNcEditando(item.id);
        setNcFormError(null);
        setNcProdBuscar("");
        setNcProdResultados([]);
        // Si es scope producto, mostramos el idPlex ya seleccionado como descripción
        setNcProdSelDesc(item.scope === "producto" && item.scope_valor ? `idPlex: ${item.scope_valor}` : "");
        setNcModalForm(true);
    };

    const ncGuardar = async () => {
        setNcFormError(null);
        if (!ncForm.id_proveedor) return setNcFormError("Seleccioná un proveedor");
        if (!ncForm.scope) return setNcFormError("Seleccioná un scope");
        if ((ncForm.scope === "producto" || ncForm.scope === "laboratorio") && !ncForm.scope_valor.trim())
            return setNcFormError("El valor del scope es requerido");
        const pct = parseFloat(ncForm.porcentaje);
        if (isNaN(pct) || pct <= 0 || pct >= 100) return setNcFormError("El porcentaje debe ser entre 0 y 100");
        setNcSaving(true);
        try {
            const url = ncEditando
                ? `${API_URL}/api/convenios/descuentos-nc/${ncEditando}`
                : `${API_URL}/api/convenios/descuentos-nc`;
            const r = await authFetch(url, {
                method: ncEditando ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_proveedor: ncForm.id_proveedor,
                    scope: ncForm.scope,
                    scope_valor: ncForm.scope_valor.trim() || null,
                    porcentaje: pct,
                    descripcion: ncForm.descripcion.trim() || null,
                    activo: ncForm.activo,
                }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Error"); }
            setNcModalForm(false);
            cargarNC();
        } catch (e) {
            setNcFormError(e.message);
        } finally {
            setNcSaving(false);
        }
    };

    const ncEliminar = async (id) => {
        if (!window.confirm("¿Eliminar este descuento extra?\n\nEl sistema dejará de considerar este descuento al comparar precios.")) return;
        try {
            const r = await authFetch(`${API_URL}/api/convenios/descuentos-nc/${id}`, { method: "DELETE" });
            if (!r.ok) throw new Error("Error al eliminar");
            cargarNC();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="conv">
            <h2 className="conv_titulo">Gestión de Convenios</h2>

            {/* Tabs */}
            <div className="conv_tabs">
                <button
                    className={`conv_tab ${tab === "convenios" ? "conv_tab_active" : ""}`}
                    onClick={() => setTab("convenios")}
                >
                    Convenios
                </button>
                <button
                    className={`conv_tab ${tab === "descuentos-nc" ? "conv_tab_active" : ""}`}
                    onClick={() => setTab("descuentos-nc")}
                >
                    <FaPercent /> Descuentos extra
                </button>
            </div>

            {tab === "convenios" && (<>
                {/* Filtros */}
                <div className="conv_filtros">
                    <label>
                        Buscar EAN / CodLab
                        <input
                            type="text"
                            value={buscar}
                            placeholder="EAN o código de lab..."
                            onChange={e => { setBuscar(e.target.value); setPage(1); }}
                        />
                    </label>
                    <label>
                        Tipo
                        <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}>
                            <option value="">Todos</option>
                            <option value="EAN">EAN</option>
                            <option value="LAB">LAB</option>
                        </select>
                    </label>
                    <label>
                        Laboratorio
                        <select value={filtroLab} onChange={e => { setFiltroLab(e.target.value); setPage(1); }}>
                            <option value="">Todos</option>
                            {laboratorios.map(l => (
                                <option key={l.CodLab} value={l.CodLab}>{l.laboratorio}</option>
                            ))}
                        </select>
                    </label>
                    <button className="conv_btn_nuevo" onClick={abrirCrear}>
                        <FaPlus /> Nueva regla
                    </button>
                    <button className="conv_btn_masivo" onClick={abrirBulkCreate}>
                        <FaLayerGroup /> Agregar masivo
                    </button>
                </div>

                {error && <p className="conv_error">{error}</p>}

                {/* Barra de accion masiva */}
                {algunoSeleccionado && (
                    <div className="conv_bulk_bar">
                        <span className="conv_bulk_count">
                            <FaCheckSquare /> {seleccionados.size} seleccionado{seleccionados.size !== 1 ? "s" : ""}
                        </span>
                        <button className="conv_btn_bulk" onClick={abrirBulk}>
                            Editar prioridad de todos
                        </button>
                        <button className="conv_btn_deselect" onClick={() => setSeleccionados(new Set())}>
                            Cancelar selección
                        </button>
                    </div>
                )}

                {/* Tabla */}
                <div className="conv_tabla_wrap">
                    <table className="conv_tabla">
                        <thead>
                            <tr>
                                <th className="conv_th_check">
                                    <input
                                        type="checkbox"
                                        checked={todosSeleccionados}
                                        onChange={toggleTodos}
                                        title="Seleccionar todo"
                                    />
                                </th>
                                <th>ID</th>
                                <th>Convenio</th>
                                <th>Tipo</th>
                                <th>EAN / CodLab</th>
                                <th>Descripción</th>
                                <th>Laboratorio</th>
                                <th>Prioridad</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="conv_loading">Cargando...</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={9} className="conv_vacio">Sin resultados</td></tr>
                            ) : items.map(item => (
                                <tr
                                    key={item.id}
                                    className={seleccionados.has(item.id) ? "conv_tr_sel" : ""}
                                    onClick={() => toggleItem(item.id)}
                                >
                                    <td className="conv_th_check" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={seleccionados.has(item.id)}
                                            onChange={() => toggleItem(item.id)}
                                        />
                                    </td>
                                    <td className="conv_td_id">{item.id}</td>
                                    <td>{item.convenio_nombre}</td>
                                    <td>
                                        <span className={`conv_badge conv_badge_${item.tipo.toLowerCase()}`}>
                                            {item.tipo}
                                        </span>
                                    </td>
                                    <td className="conv_td_valor">
                                        {item.tipo === "EAN" ? item.ean : item.codlab}
                                    </td>
                                    <td className="conv_td_desc">{item.descripcion ?? "—"}</td>
                                    <td className="conv_td_lab">{item.laboratorio ?? "—"}</td>
                                    <td>
                                        <div className="conv_chips">
                                            {Array.isArray(item.prioridad) && item.prioridad.map((p, i) => (
                                                <span key={p} className={`conv_chip conv_chip_${p}`}>
                                                    {i + 1}. {PROVEEDOR_LABEL[p] ?? p}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="conv_td_acciones" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="conv_btn_icon conv_btn_edit"
                                            title="Editar"
                                            onClick={() => abrirEditar(item)}
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className="conv_btn_icon conv_btn_del"
                                            title="Eliminar"
                                            onClick={() => eliminar(item.id)}
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Paginacion */}
                {totalPages > 1 && (
                    <div className="conv_paginacion">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&#8249; Anterior</button>
                        <span>{page} / {totalPages} — {total} registros</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente &#8250;</button>
                    </div>
                )}
                {totalPages <= 1 && total > 0 && (
                    <p className="conv_total">{total} registro{total !== 1 ? "s" : ""}</p>
                )}

                {/* Modal crear / editar individual */}
                {modalForm && (
                    <Modal onClose={() => setModalForm(false)}>
                        <h3 className="conv_modal_titulo">
                            {editando ? "Editar regla" : "Nueva regla de convenio"}
                        </h3>
                        <div className="conv_form">
                            <label className="conv_label">
                                Convenio
                                <select
                                    value={form.convenio_id}
                                    onChange={e => setForm(f => ({ ...f, convenio_id: e.target.value }))}
                                >
                                    <option value="">— Selecioná —</option>
                                    {conveniosPadre.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}{c.activo ? "" : " (inactivo)"}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="conv_label">
                                Tipo
                                <select
                                    value={form.tipo}
                                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value, ean: "", codlab: "" }))}
                                >
                                    <option value="EAN">EAN (producto específico)</option>
                                    <option value="LAB">LAB (laboratorio completo)</option>
                                </select>
                            </label>
                            {form.tipo === "EAN" ? (
                                <label className="conv_label">
                                    EAN
                                    <input
                                        type="text"
                                        value={form.ean}
                                        placeholder="Ej: 7795338001425"
                                        onChange={e => setForm(f => ({ ...f, ean: e.target.value }))}
                                    />
                                </label>
                            ) : (
                                <label className="conv_label">
                                    CodLab
                                    <input
                                        type="text"
                                        value={form.codlab}
                                        placeholder="Ej: ABC123"
                                        onChange={e => setForm(f => ({ ...f, codlab: e.target.value }))}
                                    />
                                </label>
                            )}
                            <PrioridadEditor
                                prioridad={form.prioridad}
                                onChange={p => setForm(f => ({ ...f, prioridad: p }))}
                            />
                            {formError && <p className="conv_form_error">{formError}</p>}
                            {confirmandoForm ? (
                                <div className="conv_confirm_bar">
                                    <span>Esta regla afecta la compra automática. ¿Confirmás?</span>
                                    <button className="conv_btn_cancelar" onClick={() => setConfirmandoForm(false)}>No, volver</button>
                                    <button className="conv_btn_guardar" onClick={guardar} disabled={saving}>
                                        {saving ? "Guardando..." : "Sí, guardar"}
                                    </button>
                                </div>
                            ) : (
                                <div className="conv_form_acciones">
                                    <button className="conv_btn_cancelar" onClick={() => setModalForm(false)}>Cancelar</button>
                                    <button className="conv_btn_guardar" onClick={() => { setFormError(null); if (!form.convenio_id) return setFormError("Selecioná un convenio"); if (form.tipo === "EAN" && !form.ean.trim()) return setFormError("EAN requerido"); if (form.tipo === "LAB" && !form.codlab.trim()) return setFormError("CodLab requerido"); if (form.prioridad.length === 0) return setFormError("Agregá al menos un proveedor"); setConfirmandoForm(true); }}>
                                        Guardar
                                    </button>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Modal edicion masiva (cambiar prioridad) */}
                {modalBulk && (
                    <Modal onClose={() => setModalBulk(false)}>
                        <h3 className="conv_modal_titulo">
                            Editar prioridad — {seleccionados.size} regla{seleccionados.size !== 1 ? "s" : ""}
                        </h3>
                        <div className="conv_form">
                            <PrioridadEditor
                                prioridad={bulkPrioridad}
                                onChange={setBulkPrioridad}
                            />
                            {formError && <p className="conv_form_error">{formError}</p>}
                            {confirmandoBulk ? (
                                <div className="conv_confirm_bar">
                                    <span>Esto sobreescribe la prioridad de {seleccionados.size} regla{seleccionados.size !== 1 ? "s" : ""}. ¿Confirmás?</span>
                                    <button className="conv_btn_cancelar" onClick={() => setConfirmandoBulk(false)}>No, volver</button>
                                    <button className="conv_btn_guardar" onClick={guardarBulk} disabled={saving}>
                                        {saving ? "Guardando..." : "Sí, aplicar"}
                                    </button>
                                </div>
                            ) : (
                                <div className="conv_form_acciones">
                                    <button className="conv_btn_cancelar" onClick={() => setModalBulk(false)}>Cancelar</button>
                                    <button className="conv_btn_guardar" onClick={() => { if (bulkPrioridad.length === 0) return setFormError("Agregá al menos un proveedor"); setFormError(null); setConfirmandoBulk(true); }}>
                                        Aplicar a {seleccionados.size} reglas
                                    </button>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Modal agregar masivo */}
                {modalBulkCreate && (
                    <Modal onClose={() => setModalBulkCreate(false)}>
                        <h3 className="conv_modal_titulo">Agregar reglas en masa</h3>
                        <div className="conv_form conv_form_wide">
                            {/* Convenio */}
                            <label className="conv_label">
                                Convenio
                                <select value={bulkCreateConvenio} onChange={e => setBulkCreateConvenio(e.target.value)}>
                                    <option value="">— Selecioná —</option>
                                    {conveniosPadre.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}{c.activo ? "" : " (inactivo)"}</option>
                                    ))}
                                </select>
                            </label>

                            {/* Buscador de productos */}
                            <div className="conv_label">
                                <span className="conv_label_text">Buscar productos (nombre o laboratorio)</span>
                                <div className="conv_buscar_row">
                                    <input
                                        type="text"
                                        value={buscarProducto}
                                        placeholder="Ej: Amoxicilina, Bago, Roemmers..."
                                        onChange={e => setBuscarProducto(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && buscarProductos()}
                                    />
                                    <button
                                        className="conv_btn_buscar"
                                        onClick={buscarProductos}
                                        disabled={loadingBusqueda}
                                    >
                                        <FaSearch /> {loadingBusqueda ? "Buscando..." : "Buscar"}
                                    </button>
                                </div>
                            </div>

                            {/* Resultados */}
                            {resultadosBusqueda.length > 0 && (
                                <div className="conv_resultados_wrap">
                                    <div className="conv_resultados_header">
                                        <span>{resultadosBusqueda.length} resultado{resultadosBusqueda.length !== 1 ? "s" : ""}</span>
                                        <button
                                            className="conv_btn_small"
                                            onClick={() => setProdSelec(new Set(resultadosBusqueda.map(r => r.ean)))}
                                        >
                                            Seleccionar todos
                                        </button>
                                        <button className="conv_btn_small" onClick={() => setProdSelec(new Set())}>
                                            Limpiar
                                        </button>
                                        {prodSelec.size > 0 && (
                                            <span className="conv_sel_count">
                                                {prodSelec.size} seleccionado{prodSelec.size !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                    <div className="conv_resultados_lista">
                                        {resultadosBusqueda.map(p => (
                                            <label
                                                key={p.ean}
                                                className={`conv_resultado_item ${prodSelec.has(p.ean) ? "sel" : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={prodSelec.has(p.ean)}
                                                    onChange={() => {
                                                        setProdSelec(prev => {
                                                            const next = new Set(prev);
                                                            next.has(p.ean) ? next.delete(p.ean) : next.add(p.ean);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                                <span className="conv_resultado_desc">{p.descripcion}</span>
                                                <span className="conv_resultado_lab">{p.laboratorio ?? "—"}</span>
                                                <span className="conv_resultado_ean">{p.ean}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {resultadosBusqueda.length === 0 && buscarProducto && !loadingBusqueda && (
                                <p className="conv_vacio" style={{ textAlign: "left", padding: "0.5rem 0" }}>
                                    Sin resultados para esa búsqueda
                                </p>
                            )}

                            {/* Prioridad */}
                            <PrioridadEditor prioridad={bulkCreatePrioridad} onChange={setBulkCreatePrioridad} />

                            {/* Resultado de creacion */}
                            {createResult && (
                                <p className="conv_create_result">
                                    {createResult.created} regla{createResult.created !== 1 ? "s" : ""} creada{createResult.created !== 1 ? "s" : ""}
                                    {createResult.skipped > 0
                                        ? `, ${createResult.skipped} omitida${createResult.skipped !== 1 ? "s" : ""} (ya existían)`
                                        : ""}
                                </p>
                            )}

                            {formError && <p className="conv_form_error">{formError}</p>}

                            {confirmandoCreate ? (
                                <div className="conv_confirm_bar">
                                    <span>Se van a crear {prodSelec.size} regla{prodSelec.size !== 1 ? "s" : ""}. Los EANs ya existentes se omiten. ¿Confirmás?</span>
                                    <button className="conv_btn_cancelar" onClick={() => setConfirmandoCreate(false)}>No, volver</button>
                                    <button className="conv_btn_guardar" onClick={guardarBulkCreate} disabled={savingCreate}>
                                        {savingCreate ? "Creando..." : "Sí, crear"}
                                    </button>
                                </div>
                            ) : (
                                <div className="conv_form_acciones">
                                    <button className="conv_btn_cancelar" onClick={() => setModalBulkCreate(false)}>Cerrar</button>
                                    {!createResult ? (
                                        <button
                                            className="conv_btn_guardar"
                                            onClick={() => { if (!bulkCreateConvenio) return setFormError("Selecioná un convenio"); if (prodSelec.size === 0) return setFormError("Selecioná al menos un producto"); if (bulkCreatePrioridad.length === 0) return setFormError("Agregá al menos un proveedor"); setFormError(null); setConfirmandoCreate(true); }}
                                            disabled={prodSelec.size === 0}
                                        >
                                            Crear {prodSelec.size > 0 ? prodSelec.size + " " : ""}reglas
                                        </button>
                                    ) : (
                                        <button
                                            className="conv_btn_guardar"
                                            onClick={() => { setCreateResult(null); setProdSelec(new Set()); setResultadosBusqueda([]); setBuscarProducto(""); setConfirmandoCreate(false); }}
                                        >
                                            Agregar más
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </>)}

            {/* ── Tab: Descuentos NC ──────────────────────────────────────────── */}
            {tab === "descuentos-nc" && (<>
                <div className="conv_nc_header">
                    <p className="conv_nc_desc">
                        Descuentos que los proveedores otorgan fuera de la API (ej: notas de crédito).
                        Se usan <strong>solo para comparar precios</strong> al seleccionar proveedor automáticamente.
                    </p>
                    <button className="conv_btn_nuevo" onClick={ncAbrirCrear}>
                        <FaPlus /> Nuevo descuento extra
                    </button>
                </div>

                {ncError && <p className="conv_error">{ncError}</p>}

                <div className="conv_tabla_wrap">
                    <table className="conv_tabla">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Proveedor</th>
                                <th>Aplica a</th>
                                <th>Valor</th>
                                <th>Descuento</th>
                                <th>Descripción</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {ncLoading ? (
                                <tr><td colSpan={8} className="conv_loading">Cargando...</td></tr>
                            ) : ncItems.length === 0 ? (
                                <tr><td colSpan={8} className="conv_vacio">Sin descuentos extra configurados</td></tr>
                            ) : ncItems.map(item => (
                                <tr key={item.id}>
                                    <td className="conv_td_id">{item.id}</td>
                                    <td>
                                        <span className={`conv_chip conv_chip_${item.id_proveedor}`}>
                                            {PROVEEDOR_LABEL[item.id_proveedor] ?? item.id_proveedor}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="conv_badge conv_badge_nc">
                                            {SCOPE_LABEL[item.scope] ?? item.scope}
                                        </span>
                                    </td>
                                    <td className="conv_td_valor">
                                        {item.scope === "producto" ? (
                                            <div className="conv_nc_enriched">
                                                {item.nombre_producto
                                                    ? <span className="conv_nc_enriched_nombre">{item.nombre_producto}</span>
                                                    : <span className="conv_nc_enriched_id">{item.scope_valor}</span>}
                                                {item.ean_producto && <span className="conv_nc_enriched_ean">{item.ean_producto}</span>}
                                                {item.nombre_producto && <span className="conv_nc_enriched_id">ID {item.scope_valor}</span>}
                                            </div>
                                        ) : item.scope === "laboratorio" ? (
                                            <div className="conv_nc_enriched">
                                                {item.nombre_lab
                                                    ? <span className="conv_nc_enriched_nombre">{item.nombre_lab}</span>
                                                    : <span className="conv_nc_enriched_id">{item.scope_valor}</span>}
                                                {item.nombre_lab && <span className="conv_nc_enriched_id">{item.scope_valor}</span>}
                                            </div>
                                        ) : (
                                            item.scope_valor ?? "—"
                                        )}
                                    </td>
                                    <td className="conv_td_pct"><strong>{item.porcentaje}%</strong></td>
                                    <td className="conv_td_desc">{item.descripcion ?? "—"}</td>
                                    <td>
                                        <span className={`conv_badge ${item.activo ? "conv_badge_activo" : "conv_badge_inactivo"}`}>
                                            {item.activo ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="conv_td_acciones">
                                        <button
                                            className="conv_btn_icon conv_btn_edit"
                                            title="Editar"
                                            onClick={() => ncAbrirEditar(item)}
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className="conv_btn_icon conv_btn_del"
                                            title="Eliminar"
                                            onClick={() => ncEliminar(item.id)}
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {ncItems.length > 0 && (
                    <p className="conv_total">{ncItems.length} descuento{ncItems.length !== 1 ? "s" : ""} configurado{ncItems.length !== 1 ? "s" : ""}</p>
                )}

                {/* Modal crear / editar NC */}
                {ncModalForm && (
                    <Modal onClose={() => setNcModalForm(false)}>
                        <h3 className="conv_modal_titulo">
                            {ncEditando ? "Editar descuento extra" : "Nuevo descuento extra"}
                        </h3>
                        <div className="conv_form">
                            <label className="conv_label">
                                Proveedor
                                <select
                                    value={ncForm.id_proveedor}
                                    onChange={e => setNcForm(f => ({ ...f, id_proveedor: e.target.value }))}
                                >
                                    <option value="">— Seleccioná —</option>
                                    {PROVEEDORES_NC.map(p => (
                                        <option key={p} value={p}>{PROVEEDOR_LABEL[p] ?? p}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="conv_label">
                                Aplica a
                                <select
                                    value={ncForm.scope}
                                    onChange={e => {
                                        setNcForm(f => ({ ...f, scope: e.target.value, scope_valor: "" }));
                                        setNcProdBuscar("");
                                        setNcProdResultados([]);
                                        setNcProdSelDesc("");
                                    }}
                                >
                                    {Object.entries(SCOPE_LABEL).map(([v, l]) => (
                                        <option key={v} value={v}>{l}</option>
                                    ))}
                                </select>
                            </label>
                            {ncForm.scope === "producto" && (
                                <div className="conv_label">
                                    <span className="conv_label_text">Producto (buscar por nombre)</span>
                                    <div className="conv_buscar_row">
                                        <input
                                            type="text"
                                            value={ncProdBuscar}
                                            placeholder="Ej: Amoxicilina, Ibupirac..."
                                            onChange={e => setNcProdBuscar(e.target.value)}
                                            onKeyDown={async e => {
                                                if (e.key !== "Enter" || !ncProdBuscar.trim()) return;
                                                setNcProdLoading(true);
                                                setNcProdResultados([]);
                                                try {
                                                    const r = await authFetch(`${API_URL}/api/convenios/productos/buscar?q=${encodeURIComponent(ncProdBuscar)}&limit=100`);
                                                    const data = await r.json();
                                                    // Deduplicar por idPlex (un producto puede tener varios EANs)
                                                    const seen = new Set();
                                                    const unicos = (Array.isArray(data) ? data : []).filter(p => {
                                                        if (seen.has(p.idPlex)) return false;
                                                        seen.add(p.idPlex);
                                                        return true;
                                                    });
                                                    setNcProdResultados(unicos);
                                                } catch { }
                                                setNcProdLoading(false);
                                            }}
                                        />
                                        <button
                                            className="conv_btn_buscar"
                                            disabled={ncProdLoading}
                                            onClick={async () => {
                                                if (!ncProdBuscar.trim()) return;
                                                setNcProdLoading(true);
                                                setNcProdResultados([]);
                                                try {
                                                    const r = await authFetch(`${API_URL}/api/convenios/productos/buscar?q=${encodeURIComponent(ncProdBuscar)}&limit=100`);
                                                    const data = await r.json();
                                                    const seen = new Set();
                                                    const unicos = (Array.isArray(data) ? data : []).filter(p => {
                                                        if (seen.has(p.idPlex)) return false;
                                                        seen.add(p.idPlex);
                                                        return true;
                                                    });
                                                    setNcProdResultados(unicos);
                                                } catch { }
                                                setNcProdLoading(false);
                                            }}
                                        >
                                            <FaSearch /> {ncProdLoading ? "..." : "Buscar"}
                                        </button>
                                    </div>
                                    {ncProdResultados.length > 0 && (
                                        <div className="conv_nc_prod_lista">
                                            {ncProdResultados.map(p => (
                                                <button
                                                    key={p.idPlex}
                                                    type="button"
                                                    className={`conv_nc_prod_item ${ncForm.scope_valor === String(p.idPlex) ? "sel" : ""}`}
                                                    onClick={() => {
                                                        setNcForm(f => ({ ...f, scope_valor: String(p.idPlex) }));
                                                        setNcProdSelDesc(p.descripcion);
                                                        setNcProdResultados([]);
                                                        setNcProdBuscar("");
                                                    }}
                                                >
                                                    <span className="conv_nc_prod_desc">{p.descripcion}</span>
                                                    <span className="conv_nc_prod_id">#{p.idPlex}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {ncForm.scope_valor && (
                                        <p className="conv_nc_prod_sel">
                                            Seleccionado: <strong>{ncProdSelDesc || ncForm.scope_valor}</strong>
                                            <button type="button" className="conv_nc_prod_quitar" onClick={() => { setNcForm(f => ({ ...f, scope_valor: "" })); setNcProdSelDesc(""); }}>×</button>
                                        </p>
                                    )}
                                </div>
                            )}
                            {ncForm.scope === "laboratorio" && (
                                <label className="conv_label">
                                    CodLab
                                    <input
                                        type="text"
                                        value={ncForm.scope_valor}
                                        placeholder="Ej: ABC123"
                                        onChange={e => setNcForm(f => ({ ...f, scope_valor: e.target.value }))}
                                    />
                                </label>
                            )}
                            <label className="conv_label">
                                Descuento (%)
                                <input
                                    type="number"
                                    min="0.01"
                                    max="99.99"
                                    step="0.01"
                                    value={ncForm.porcentaje}
                                    placeholder="Ej: 12"
                                    onChange={e => setNcForm(f => ({ ...f, porcentaje: e.target.value }))}
                                />
                            </label>
                            <label className="conv_label">
                                Descripción (opcional)
                                <input
                                    type="text"
                                    value={ncForm.descripcion}
                                    placeholder="Ej: NC perfumería Suizo Q2 2026"
                                    onChange={e => setNcForm(f => ({ ...f, descripcion: e.target.value }))}
                                />
                            </label>
                            {ncEditando && (
                                <label className="conv_label conv_label_inline">
                                    <input
                                        type="checkbox"
                                        checked={ncForm.activo}
                                        onChange={e => setNcForm(f => ({ ...f, activo: e.target.checked }))}
                                    />
                                    Activo
                                </label>
                            )}
                            {ncFormError && <p className="conv_form_error">{ncFormError}</p>}
                            <div className="conv_form_acciones">
                                <button className="conv_btn_cancelar" onClick={() => setNcModalForm(false)}>Cancelar</button>
                                <button className="conv_btn_guardar" onClick={ncGuardar} disabled={ncSaving}>
                                    {ncSaving ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </>)}
        </div>
    );
}
