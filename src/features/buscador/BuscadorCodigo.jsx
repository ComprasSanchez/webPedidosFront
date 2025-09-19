// front/src/features/buscador/BuscadorCodigo.jsx

import { useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../config/api";

const BuscadorCodigo = ({ onProductoEncontrado, sucursalCodigo, sucursalId }) => {
    const { usuario } = useAuth();
    const [queryCode, setQueryCode] = useState("");
    const [loadingCode, setLoadingCode] = useState(false);
    const [productosEncontrados, setProductosEncontrados] = useState([]);

    const handleBuscarCodigo = async () => {
        const q = queryCode.trim();
        if (!q) return;

        // Para usuarios de compras: necesitamos sucursalCodigo
        // Para usuarios normales: necesitamos sucursalId
        if (!sucursalCodigo && !sucursalId) {
            console.warn("Falta información de sucursal para la búsqueda");
            return;
        }

        try {
            setLoadingCode(true);
            setQueryCode("");
            setProductosEncontrados([]);

            // Construir URL con parámetros
            const params = new URLSearchParams();
            if (sucursalId) params.append('sucursalId', sucursalId);
            if (sucursalCodigo) params.append('sucursal', sucursalCodigo);

            const url = `${API_URL}/api/productos/buscar/${q}?${params.toString()}`;

            const res = await fetch(url);
            const data = await res.json();


            if (data.encontrado) {
                if (Array.isArray(data.productos) && data.productos.length > 0) {
                    // Caso: múltiples productos encontrados
                    setProductosEncontrados(data.productos);
                } else {
                    // Caso: un solo producto encontrado
                    const producto = {
                        ean: data.ean || q,
                        descripcion: data.descripcion,
                        stockSucursal: data.stockSucursal || 0,
                        precios: { deposito: 0 },
                        idQuantio: data.idQuantio || null,
                        laboratorio: data.laboratorio || "Desconocido",
                        CodLab: data.CodLab || "Desconocido"
                    };
                    onProductoEncontrado(producto);
                }
            } else {

                // No está en nuestra base → igual se puede pedir por EAN si lo escribieron
                const producto = {
                    ean: q,
                    descripcion: `Producto no registrado`,
                    stockSucursal: 0,
                    precios: { deposito: 0 },
                    idQuantio: null,
                    laboratorio: "Desconocido",
                    CodLab: "Desconocido"
                };
                onProductoEncontrado(producto);
            }
        } catch (err) {
            console.error("Error buscando producto:", err);
            const producto = {
                ean: q,
                descripcion: "Producto no registrado",
                stockSucursal: 0,
                precios: { deposito: 0 },
                idQuantio: null,
                laboratorio: "Desconocido",
                CodLab: "Desconocido"
            };
            onProductoEncontrado(producto);
        } finally {
            setLoadingCode(false);
        }
    };

    const handleSeleccionarProducto = (producto) => {
        onProductoEncontrado(producto);
        setProductosEncontrados([]);
    };

    return (
        <div className="buscador_form buscador_codigo">
            <input
                type="text"
                className="buscador_input"
                placeholder="Código de barras"
                value={queryCode}
                disabled={loadingCode}
                onChange={(e) => setQueryCode(e.target.value)}
                onKeyDown={(e) => !loadingCode && e.key === "Enter" && handleBuscarCodigo()}
            />
            <button type="button" className="buscador_btn_buscar" onClick={handleBuscarCodigo} disabled={loadingCode}>
                <FaSearch />
            </button>
            {/* hint de estado */}
            {loadingCode && <div className="buscador_hint"><span className="spinner" /> Buscando…</div>}

            {productosEncontrados.length > 0 && (
                <div
                    id="lista-resultados-codigo"
                    className="buscador_resultados_dropdown"
                    role="listbox"
                >
                    {productosEncontrados.map((producto, i) => (
                        <button
                            key={`${producto.idProducto || i}`}
                            className="buscador_resultado_item"
                            onClick={() => handleSeleccionarProducto(producto)}
                            role="option"
                            title={producto.ean ? `EAN ${producto.ean}` : "Sin EAN"}
                        >
                            <span className="resultado_titulo">{producto.descripcion}</span>

                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BuscadorCodigo;