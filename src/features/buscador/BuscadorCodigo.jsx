// front/src/features/buscador/BuscadorCodigo.jsx

import { useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../config/api";

const BuscadorCodigo = ({ onProductoEncontrado, sucursalCodigo, sucursalId }) => {
    const { usuario } = useAuth();
    const [queryCode, setQueryCode] = useState("");
    const [loadingCode, setLoadingCode] = useState(false);

    const handleBuscarCodigo = async () => {
        const q = queryCode.trim();
        if (!q) return;

        // Para usuarios de compras: necesitamos sucursalCodigo
        // Para usuarios normales: necesitamos sucursalId
        if (!sucursalCodigo && !sucursalId) {
            console.warn("Falta información de sucursal para la búsqueda");
            return;
        }

        // Debug temporal
        console.log("🔍 BuscadorCodigo parámetros:", {
            sucursalCodigo,
            sucursalId,
            q
        });

        try {
            setLoadingCode(true);
            setQueryCode("");

            // Construir URL con parámetros
            const params = new URLSearchParams();
            if (sucursalId) params.append('sucursalId', sucursalId);
            if (sucursalCodigo) params.append('sucursal', sucursalCodigo);

            const url = `${API_URL}/api/productos/buscar/${q}?${params.toString()}`;
            console.log("🔍 BuscadorCodigo URL:", url);

            const res = await fetch(url);
            const data = await res.json();

            let producto;
            if (data.encontrado) {
                producto = {
                    ean: data.ean,
                    descripcion: data.descripcion,
                    stockSucursal: data.stockSucursal,
                    precios: { deposito: 0 },
                    idQuantio: data.idQuantio ?? data.codPlex ?? null,
                    laboratorio: data.laboratorio || "Desconocido",
                    CodLab: data.CodLab || "Desconocido"
                };
            } else {
                // No está en nuestra base → igual se puede pedir por EAN si lo escribieron
                producto = {
                    ean: q,
                    descripcion: `Producto no registrado`,
                    stockSucursal: 0,
                    precios: { deposito: 0 },
                    idQuantio: null,
                    laboratorio: "Desconocido",
                    CodLab: "Desconocido"
                };
            }

            onProductoEncontrado(producto);
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
        </div>
    );
};

export default BuscadorCodigo;