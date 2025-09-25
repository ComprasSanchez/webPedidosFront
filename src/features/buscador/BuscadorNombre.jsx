// front/src/features/buscador/BuscadorNombre.jsx

import { useEffect, useRef, useState } from "react";
import { FaSearch, FaFileUpload, FaSpinner } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCarrito } from "../../context/CarritoContext";
import { API_URL } from "../../config/api";
import DuplicateProductsModal from "../../components/ui/DuplicateProductsModal";

const BuscadorNombre = ({ onProductoEncontrado, onLimpiarResultados, sucursalCodigo, sucursalId }) => {
    const { usuario, authFetch } = useAuth();
    const { replaceCarrito } = useCarrito();
    const [queryName, setQueryName] = useState("");
    const [resultadosNombre, setResultadosNombre] = useState([]);
    const [loadingName, setLoadingName] = useState(false);
    const [loadingTxt, setLoadingTxt] = useState(false);
    const nombreBoxRef = useRef(null);

    // Estados para manejar duplicados
    const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
    const [duplicateItems, setDuplicateItems] = useState([]);
    const [pendingItems, setPendingItems] = useState([]);

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


    const handleUploadTxt = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        if (sucursalCodigo) {
            formData.append("sucursal_codigo", sucursalCodigo);
        }

        setLoadingTxt(true);

        try {
            const res = await authFetch(`${API_URL}/api/reposicion/upload-txt`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Error desconocido" }));

                // Limpiar estado
                setLoadingTxt(false);
                e.target.value = "";

                // Manejo específico para error de validación de sucursal
                if (res.status === 400 && errorData.detalles) {
                    const { sucursal_seleccionada, sucursal_archivo } = errorData.detalles;

                    // Vaciar el carrito cuando hay error de validación
                    replaceCarrito([]);

                    toast.error(
                        `Error de sucursal: El archivo es de la sucursal ${sucursal_archivo}, pero tienes seleccionada la sucursal ${sucursal_seleccionada}`,
                        {
                            duration: 6000,
                            style: {
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fca5a5',
                            }
                        }
                    );
                    return;
                } else {
                    toast.error(errorData.error || "Error al procesar el archivo");
                    return;
                }
            }

            const data = await res.json();

            // Mapear los items del TXT al formato del carrito
            const itemsParaCarrito = data.items.map(item => ({
                ...item,
                unidades: item.cantidad || 1, // Mapear 'cantidad' del TXT a 'unidades' del carrito
                // Mantener 'cantidad' para compatibilidad si se necesita
            }));


            // Verificar si hay duplicados
            if (data.hasDuplicates) {
                const duplicates = itemsParaCarrito.filter(item => item.isDuplicate);
                const nonDuplicates = itemsParaCarrito.filter(item => !item.isDuplicate);

                // Agregar primero los no duplicados al carrito
                replaceCarrito(nonDuplicates);

                // Mostrar modal para resolver duplicados
                setDuplicateItems(duplicates);
                setPendingItems(nonDuplicates);
                setShowDuplicatesModal(true);

                toast.warning(
                    `Archivo cargado con ${data.duplicateEans.length} códigos duplicados. Resuelve los conflictos.`,
                    { duration: 5000 }
                );
            } else {
                // No hay duplicados, proceder normal
                replaceCarrito(itemsParaCarrito);

                toast.success(
                    `Archivo cargado: ${data.totalItems} items, ${data.totalUnidades} unidades`
                );
            }
        } catch (err) {
            toast.error("Error al procesar el archivo");
        } finally {
            setLoadingTxt(false);
            e.target.value = ""; // limpiar input para poder re-subir
        }
    };

    // Función para manejar la resolución de duplicados
    const handleResolveDuplicates = (resolvedItems) => {
        // Combinar items no duplicados con items resueltos
        const finalItems = [...pendingItems, ...resolvedItems];
        replaceCarrito(finalItems);

        const totalItems = finalItems.length;
        const totalUnidades = finalItems.reduce((sum, item) => sum + item.unidades, 0);

        toast.success(
            `Duplicados resueltos: ${totalItems} items, ${totalUnidades} unidades`
        );

        // Limpiar estados
        setDuplicateItems([]);
        setPendingItems([]);
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
                <div className="upload_txt_wrapper">
                    <label htmlFor="uploadTxt" className="buscador_btn_buscar">
                        {loadingTxt ? (
                            <>
                                <FaSpinner className="upload_txt_icon spinner" />
                                Procesando...
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
                        accept=".txt"
                        onChange={handleUploadTxt}
                        style={{ display: "none" }}
                        disabled={loadingTxt}
                    />
                </div>
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
        </div>
    );
};

export default BuscadorNombre;