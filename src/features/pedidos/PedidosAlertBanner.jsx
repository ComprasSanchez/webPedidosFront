import { useEffect, useState } from "react";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

export default function PedidosAlertBanner() {
    const { usuario, authFetch } = useAuth();
    const [pendientes, setPendientes] = useState([]);
    const [oculto, setOculto] = useState(false);

    useEffect(() => {
        let cancelado = false;

        // 🔧 LÓGICA DE SUCURSAL SEGÚN ROL
        let sucursalActiva = usuario?.sucursal_codigo;

        if (usuario?.rol === 'compras') {
            // Para usuarios de compras, usar la sucursal seleccionada para reposición
            const sucursalReponer = sessionStorage.getItem("sucursalReponer");
            if (sucursalReponer) {
                sucursalActiva = sucursalReponer;
            } else {
                // Si no hay sucursal seleccionada, no mostrar pendientes
                return;
            }
        }

        if (!sucursalActiva) return;

        (async () => {
            try {
                const res = await authFetch(`${API_URL}/api/pedidos/pendientes`, {
                    headers: { "X-Sucursal": sucursalActiva }
                });
                const json = await res.json();
                if (json.ok && json.pendientes?.length > 0 && !cancelado) {
                    setPendientes(json.pendientes);
                }
            } catch (err) {
                console.warn("No se pudo consultar pedidos pendientes:", err.message);
            }
        })();

        return () => { cancelado = true; };
    }, [usuario?.sucursal_codigo]);

    // 🔧 EFECTO ADICIONAL PARA COMPRAS: Escuchar cambios en sucursal seleccionada
    useEffect(() => {
        if (usuario?.rol !== 'compras') return;

        const handleStorageChange = () => {
            // Re-ejecutar el primer useEffect cuando cambie la sucursal
            const sucursalReponer = sessionStorage.getItem("sucursalReponer");
            if (sucursalReponer && usuario?.sucursal_codigo) {
                // Forzar re-render actualizando el estado
                setPendientes([]); // Reset para mostrar loading
            }
        };

        // Escuchar cambios en sessionStorage
        window.addEventListener('storage', handleStorageChange);

        // Cleanup
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [usuario?.rol, usuario?.sucursal_codigo]);

    if (oculto || pendientes.length === 0) return null;

    const handleVer = () => {
        // Abrimos el panel de Últimos pedidos con filtros usando id
        const ids = pendientes.map(p => p.id);

        const now = new Date();
        const desde = new Date(now);
        desde.setDate(now.getDate() - 3); // Aumentamos a 3 días para estar seguros

        const format = d => d.toISOString().slice(0, 10);

        const eventDetail = {
            start: format(desde),
            end: format(now),
            idPedidos: ids
        };

        window.dispatchEvent(new CustomEvent("ultped:open", {
            detail: eventDetail
        }));
        setOculto(true); // oculta el banner después
    }; return (

        <div className="alerta_pendiente">
            <div className="mensaje">
                <span>⚠️</span>
                <span>
                    Tenés {pendientes.length} pedido{pendientes.length > 1 ? 's' : ''} sin confirmar. No {pendientes.length > 1 ? 'fueron enviados' : 'fue enviado'} con éxito. Deberías volver a pedirlos.
                </span>
                <button className="btn-ver" onClick={handleVer}>Revisar</button>
            </div>
            <div className="acciones">
                <button className="ultpedidos_close ignorar" onClick={() => setOculto(true)}>X</button>
            </div>
        </div>

    );
}
