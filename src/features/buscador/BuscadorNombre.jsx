// front/src/features/buscador/BuscadorNombre.jsx

import { useEffect, useRef, useState } from "react";
import { FaSearch, FaFileUpload, FaSpinner } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCarrito } from "../../context/CarritoContext";
import { API_URL } from "../../config/api";
import DuplicateProductsModal from "../../components/ui/DuplicateProductsModal";

import useTxtUpload from "./useTxtUpload";

const BuscadorNombre = ({ onProductoEncontrado, onLimpiarResultados, sucursalCodigo, sucursalId }) => {
    const { usuario, authFetch } = useAuth();
    const { replaceCarrito, acumularProductosEnCarrito, soloDeposito, setSoloDeposito, procesarZipData } = useCarrito();

    // Eliminamos la lógica complicada de modo ZIP masivo
    const [queryName, setQueryName] = useState("");
    const [resultadosNombre, setResultadosNombre] = useState([]);
    const [loadingName, setLoadingName] = useState(false);
    // TXT upload hook
    const {
        loadingTxt,
        showDuplicatesModal,
        duplicateItems,
        pendingItems,
        handleUploadTxt,
        handleResolveDuplicates,
        setShowDuplicatesModal
    } = useTxtUpload({
        sucursalCodigo,
        replaceCarrito,
        acumularProductosEnCarrito,
        authFetch,
        toast,
        soloDeposito,
        setSoloDeposito,
        procesarZipData
    });
    const nombreBoxRef = useRef(null);

    // ...existing code...

    // cerrar dropdown al click afuera o Escape
    useEffect(() => {
        // Focus automático en el input de buscar por nombre al montar
        const input = nombreBoxRef.current?.querySelector('input');
        if (input) input.focus();

        const handleClickOutside = (e) => {
            if (nombreBoxRef.current && !nombreBoxRef.current.contains(e.target)) {
                setResultadosNombre([]);
            }
        };
        const handleEsc = (e) => {
            if (e.key === "Escape") setResultadosNombre([]);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, []);

    const handleBuscarNombre = async () => {
        const q = (queryName || "").trim();
        if (q.length < 2) return;

        if (!sucursalCodigo) {
            console.warn("Falta código de sucursal para la búsqueda");
            return;
        }

        const queryFormateada = q.replace(/\s+/g, "%");

        try {
            setLoadingName(true);
            onLimpiarResultados();
            setResultadosNombre([]);
            const url = new URL(`${API_URL}/api/stock/productos/quantio`);

            url.searchParams.set("busqueda", queryFormateada);
            url.searchParams.set("sucursal", sucursalCodigo);
            if (sucursalId) {
                url.searchParams.set("sucursalId", sucursalId);
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            setResultadosNombre(Array.isArray(data.resultados) ? data.resultados : []);
        } catch (err) {
            console.error("Error buscando por nombre:", err);
            setResultadosNombre([]);
        } finally {
            setLoadingName(false);
        }
    };

    const handleElegirResultado = (p) => {
        const producto = {
            ean: p.ean || null,
            descripcion: p.descripcion,
            stockSucursal: p.stockSucursal || 0,
            precios: { deposito: 0 },
            idQuantio: p.idQuantio ?? null,
            laboratorio: p.laboratorio || "Desconocido",
            CodLab: p.CodLab || "Desconocido"
        };

        onProductoEncontrado(producto);
        setResultadosNombre([]);
        setQueryName("");
    };


    return (
        <div className="buscador_form buscador_nombre" ref={nombreBoxRef}>
            <input
                type="text"
                className="buscador_input"
                placeholder="Buscar por nombre (PLEX)"
                value={queryName}
                disabled={loadingName}
                onChange={(e) => setQueryName(e.target.value)}
                onKeyDown={(e) => !loadingName && e.key === "Enter" && handleBuscarNombre()}
                aria-expanded={resultadosNombre.length > 0}
            />
            <button type="button" className="buscador_btn_buscar" onClick={handleBuscarNombre} disabled={loadingName}>
                <FaSearch />
            </button>

            {usuario?.rol === "compras" && (
                <>
                    <div className="upload_txt_wrapper">
                        <label
                            htmlFor="uploadTxt"
                            className="buscador_btn_buscar"
                            title="Subir archivo TXT o ZIP"
                        >
                            {loadingTxt ? (
                                <>
                                    <FaSpinner className="upload_txt_icon spinner" />
                                </>
                            ) : (
                                <>
                                    <FaFileUpload className="upload_txt_icon" />
                                </>
                            )}
                        </label>
                        <input
                            id="uploadTxt"
                            type="file"
                            accept=".txt,.zip"
                            onChange={handleUploadTxt}
                            style={{ display: "none" }}
                            disabled={loadingTxt}
                        />
                    </div>
                    <div className="solo_deposito_wrapper">
                        <label
                            htmlFor="soloDeposito"
                            className={`solo_deposito_toggle ${soloDeposito ? 'active' : 'inactive'}`}
                            title={soloDeposito ? "Solo depósito activado" : "Consultar todas las droguerías"}
                        >
                            <input
                                id="soloDeposito"
                                type="checkbox"
                                checked={soloDeposito}
                                onChange={(e) => setSoloDeposito(e.target.checked)}
                                disabled={loadingTxt}
                                style={{ display: 'none' }}
                            />
                            <span className="solo_deposito_label">Solo DEPO</span>
                            <div className="modern_switch">
                                <div className="slider">
                                    <div className="circle">
                                        <span className="switch_no">NO</span>
                                        <span className="switch_si">SI</span>
                                    </div>
                                </div>
                            </div>
                        </label>
                    </div>
                </>
            )}

            {loadingName && <div className="buscador_hint"><span className="spinner" /> Buscando…</div>}

            {/* Dropdown pegado al input */}
            {!loadingName && queryName && resultadosNombre.length > 0 && (
                <div
                    id="lista-resultados-nombre"
                    className="buscador_resultados_dropdown"
                    role="listbox"
                >
                    {resultadosNombre.map((p, i) => (
                        <button
                            key={`${p.ean || p.idQuantio || i}`}
                            className="buscador_resultado_item"
                            onClick={() => handleElegirResultado(p)}
                            role="option"
                            title={p.ean ? `EAN ${p.ean}` : "Sin EAN"}
                        >
                            <span className="resultado_titulo">{p.descripcion}</span>
                            <span className={`resultado_tag ${p.ean ? "" : "sin-ean"}`}>
                                {p.ean ? `EAN ${p.ean}` : "SIN EAN"}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Sin resultados */}
            {!loadingName && queryName && resultadosNombre.length === 0 && (
                <div className="buscador_resultados_dropdown sin-resultados">
                    Sin resultados…
                </div>
            )}

            {/* Modal para duplicados */}
            <DuplicateProductsModal
                isOpen={showDuplicatesModal}
                onClose={() => setShowDuplicatesModal(false)}
                duplicateItems={duplicateItems}
                onResolve={handleResolveDuplicates}
            />

            {/* Modal ZIP eliminado - procesamiento directo */}
        </div>
    );
};

export default BuscadorNombre;