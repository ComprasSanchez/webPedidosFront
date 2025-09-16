// front/src/features/buscador/BuscadorProductos.jsx

import { useState } from "react";
import { useCarrito } from "../../context/CarritoContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../config/api";
import UltimosPedidos from "../pedidos/UltimosPedidos";
import HelpButton from "../../components/ui/HelpButton";
import PedidosAlertBanner from "../pedidos/PedidosAlertBanner";
import BuscadorCodigo from "./BuscadorCodigo";
import BuscadorNombre from "./BuscadorNombre";
import TablaCarrito from "./TablaCarrito";


const BuscadorProductos = () => {
    const { usuario } = useAuth();
    const [cantidad, setCantidad] = useState(1);
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const { carrito, agregarAlCarrito } = useCarrito();
    const navigate = useNavigate();
    const [eanRecienAgregado, setEanRecienAgregado] = useState(null);

    const sucursalSeleccionada = sessionStorage.getItem("sucursalReponer") || "";

    // Verificar si el usuario de compras necesita seleccionar sucursal
    const necesitaSeleccionarSucursal = usuario?.rol === "compras" && !sucursalSeleccionada;

    // Determinar qué sucursal usar para las búsquedas
    const sucursalParaBusqueda = usuario?.rol === "compras" ? sucursalSeleccionada : usuario?.sucursal_codigo;
    const idSucursalParaBusqueda = usuario?.id; // Esto se mantiene igual

    const handleProductoEncontrado = (producto) => {
        setProductoSeleccionado(producto);
    };

    const handleLimpiarResultados = () => {
        setProductoSeleccionado(null);
    };

    const handleAgregar = () => {
        setEanRecienAgregado(productoSeleccionado.ean);
        setTimeout(() => setEanRecienAgregado(null), 400);
        if (!productoSeleccionado?.ean) {
            alert("Para agregar, el producto debe tener código de barras. Si no existe en la base, ingresá el EAN.");
            return;
        }
        agregarAlCarrito(productoSeleccionado, cantidad);
        setCantidad(1);
        setProductoSeleccionado(null);
    };

    const handleRealizarPedido = async () => {
        try {
            // 🎯 Crear reservas SOFT (el backend validará por stock automáticamente)
            await fetch(`${API_URL}/api/pedidos/reservas-soft/soft`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sucursal': usuario.sucursal_codigo
                },
                body: JSON.stringify({
                    items: carrito
                        .filter(item => item.idQuantio) // Solo productos con ID válido
                        .map(item => ({
                            idproducto: item.idQuantio,
                            cantidad: item.unidades || 1
                        }))
                })
            });
        } catch (error) {
            console.warn('Reserva SOFT fallida, se continúa sin frenar:', error.message);
            // No se muestra nada al usuario
        } finally {
            navigate("/revisar");
        }
    };

    // Si es usuario de compras y no tiene sucursal seleccionada, mostrar mensaje
    if (necesitaSeleccionarSucursal) {
        return (
            <div className="buscador_wrapper">
                <PedidosAlertBanner />
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "60vh",
                    textAlign: "center",
                    padding: "2rem"
                }}>
                    <h2 style={{ color: "#dc3545", marginBottom: "1rem" }}>
                        Selecciona una sucursal para reponer
                    </h2>
                    <p style={{ fontSize: "1.1rem", color: "#666", marginBottom: "1.5rem" }}>
                        Para usar el buscador, primero debes seleccionar qué sucursal vas a reponer.
                    </p>
                    <p style={{ fontSize: "1rem", color: "#666" }}>
                        Usa el ícono <strong>🏪</strong> en la parte superior derecha para seleccionar una sucursal.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="buscador_wrapper">
            <PedidosAlertBanner />
            <div className="buscadores">
                <h2 className="buscador_titulo">BUSCADOR DE PRODUCTOS</h2>
                <div className="buscador_busquedas">
                    {/* Código de barras (angosto, izquierda) */}
                    <BuscadorCodigo
                        onProductoEncontrado={handleProductoEncontrado}
                        sucursalCodigo={sucursalParaBusqueda}
                        sucursalId={idSucursalParaBusqueda}
                    />

                    {/* Nombre (derecha) con dropdown */}
                    <BuscadorNombre
                        onProductoEncontrado={handleProductoEncontrado}
                        onLimpiarResultados={handleLimpiarResultados}
                        sucursalCodigo={sucursalParaBusqueda}
                        sucursalId={idSucursalParaBusqueda}
                    />
                </div>
            </div>

            {/* Selección + agregar */}
            {productoSeleccionado && (
                <div className="buscador_seleccionado">
                    <span>
                        {productoSeleccionado.descripcion}
                        {!productoSeleccionado.ean && (
                            <em style={{ marginLeft: 8, color: "#c00" }}>
                                (Debe tener EAN para poder agregar)
                            </em>
                        )}
                    </span>
                    <div className="qty">
                        <button className="qty__btn" onClick={() => setCantidad(Math.max(1, cantidad - 1))}>−</button>
                        <span className="qty__num">{cantidad}</span>
                        <button className="qty__btn" onClick={() => setCantidad(cantidad + 1)}>+</button>
                    </div>

                    <button className="buscador_agregar" onClick={handleAgregar}>
                        AGREGAR
                    </button>
                </div>
            )}

            <TablaCarrito eanRecienAgregado={eanRecienAgregado} />
            {carrito.length > 0 && (
                <div style={{ marginTop: "2rem", textAlign: "right" }}>
                    <button className="buscador_btn_revisar" onClick={handleRealizarPedido}>
                        Realizar pedido
                    </button>
                </div>
            )}
            <UltimosPedidos />
            <HelpButton />
        </div>
    );
};

export default BuscadorProductos;