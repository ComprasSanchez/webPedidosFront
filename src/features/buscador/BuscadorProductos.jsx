// front/src/features/buscador/BuscadorProductos.jsx

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
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
    const { carrito, agregarAlCarrito } = useCarrito();
    const navigate = useNavigate();
    const [eanRecienAgregado, setEanRecienAgregado] = useState(null);

    // Estado reactivo para la sucursal seleccionada
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState(
        sessionStorage.getItem("sucursalReponer") || ""
    );

    // Efecto para escuchar cambios en sessionStorage
    useEffect(() => {
        const handleStorageChange = () => {
            setSucursalSeleccionada(sessionStorage.getItem("sucursalReponer") || "");
        };

        // Escuchar cambios en storage
        window.addEventListener("storage", handleStorageChange);

        // También revisar cada segundo por si acaso (backup)
        const interval = setInterval(handleStorageChange, 1000);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    // Ya no bloqueamos el buscador por falta de sucursal

    // Determinar qué sucursal usar para las búsquedas
    const sucursalParaBusqueda = usuario?.rol === "compras" ? sucursalSeleccionada : usuario?.sucursal_codigo;

    // Para usuarios de compras: no pasar sucursalId (se usa sucursalCodigo)
    // Para usuarios normales: usar su ID como siempre
    const idSucursalParaBusqueda = usuario?.rol === "compras" ? null : usuario?.id;

    const handleProductoEncontrado = (producto) => {
        if (!producto?.ean) {
            alert("Para agregar, el producto debe tener código de barras. Si no existe en la base, ingresá el EAN.");
            return;
        }
        setEanRecienAgregado(producto.ean);
        setTimeout(() => setEanRecienAgregado(null), 400);
        agregarAlCarrito(producto, 1);
        toast.success("Producto agregado. Podes editar la cantidad desde el carrito.", { duration: 2500 });
    };

    const handleLimpiarResultados = () => { };

    const handleRealizarPedido = () => {
        // Navegar inmediatamente para mejor UX
        navigate("/revisar");

        // Crear reservas SOFT en segundo plano (sin bloquear la interfaz)
        const crearReservasSoft = async () => {
            try {
                // Determinar la sucursal actual según el rol del usuario
                const sucursalActual = usuario?.rol === "compras" ? sucursalSeleccionada : usuario?.sucursal_codigo;

                // Validar que tenemos una sucursal válida
                if (!sucursalActual || sucursalActual.trim() === '') {
                    console.warn("⚠️ No se puede crear reservas SOFT sin sucursal válida");
                    return;
                }

                // Verificar productos para reservas soft
                const productosConId = carrito.filter(item => item.idQuantio);

                if (productosConId.length === 0) {
                    // No hay productos con idQuantio válido para reservar
                    return;
                }

                // 🎯 Crear reservas SOFT (el backend validará por stock automáticamente)
                const response = await fetch(`${API_URL}/api/pedidos/reservas-soft/soft`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-sucursal': sucursalActual
                    },
                    body: JSON.stringify({
                        items: productosConId.map(item => ({
                            idproducto: item.idQuantio,
                            cantidad: item.unidades || 1
                        }))
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ [RESERVAS SOFT] Error del backend:', response.status, errorText);
                } else {
                    // Reservas soft creadas exitosamente
                }
            } catch (error) {
                console.warn('Reserva SOFT fallida, se continúa sin frenar:', error.message);
                // No se muestra nada al usuario
            }
        };

        // Ejecutar en segundo plano
        crearReservasSoft();
    };

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