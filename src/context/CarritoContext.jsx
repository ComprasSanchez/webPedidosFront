import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
const API_URL = import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL; // fallback

const CarritoContext = createContext();

export const CarritoProvider = ({ children }) => {
    const { usuario } = useAuth(); // <-- toma usuario del Auth
    const [carrito, setCarrito] = useState([]);
    const [cargandoCarrito, setCargandoCarrito] = useState(true);
    const [sincronizando, setSincronizando] = useState(false);
    const debounceRef = useRef(null);

    const identidadLista = Boolean(usuario?.id && usuario?.sucursal_codigo);
    if (!API_URL) console.warn("⚠️ API_URL no está definida");

    // 🔹 Definir orderType según rol
    const orderType = usuario?.rol === "compras" ? "REPOSICION" : "SUCURSAL";

    // --- A) Hidratar carrito desde backend/Redis al cargar
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/cart`, {
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": usuario?.id ?? "",
                        "x-sucursal": usuario?.sucursal_codigo ?? "",
                        "x-order-type": orderType
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (mounted) setCarrito(Array.isArray(data.items) ? data.items : []);
                }
            } catch (e) {
                console.warn("No se pudo hidratar carrito:", e?.message || e);
            } finally {
                if (mounted) setCargandoCarrito(false);
            }
        })();
        return () => { mounted = false; };
    }, [API_URL, usuario?.id, usuario?.sucursal_codigo, orderType]);

    // --- B) Guardar carrito con debounce cada vez que cambia
    useEffect(() => {
        if (cargandoCarrito) return; // no guardes mientras hidratás
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                setSincronizando(true);
                await fetch(`${API_URL}/api/cart`, {
                    method: "PUT",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": usuario?.id ?? "",
                        "x-sucursal": usuario?.sucursal_codigo ?? "",
                        "x-order-type": orderType
                    },
                    body: JSON.stringify({ items: carrito })
                });
            } catch (e) {
                console.warn("No se pudo guardar carrito:", e?.message || e);
            } finally {
                setSincronizando(false);
            }
        }, 400);
        return () => clearTimeout(debounceRef.current);
    }, [carrito, cargandoCarrito, API_URL, usuario?.id, usuario?.sucursal_codigo, orderType]);

    // --- Helpers de negocio
    const agregarAlCarrito = (producto, cantidad) => {
        setCarrito(prev => {
            const idx = prev.findIndex(p => p.ean === producto.ean);
            if (idx >= 0) {
                const copia = [...prev];
                const unidadesPrev = Number(copia[idx].unidades || 0);
                copia[idx] = { ...copia[idx], ...producto, unidades: unidadesPrev + Number(cantidad || 0) };
                return copia;
            }
            return [...prev, { ...producto, unidades: Number(cantidad || 0) }];
        });
    };

    const actualizarCantidad = (ean, nuevaCantidad) => {
        setCarrito(prev => prev.map(p => p.ean === ean ? { ...p, unidades: Number(nuevaCantidad || 0) } : p));
    };

    function replaceCarrito(items) {
        setCarrito(items);
    }

    const eliminarDelCarrito = (ean) => {
        setCarrito(prev => prev.filter(p => p.ean !== ean));
    };

    const vaciarCarrito = async () => {
        setCarrito([]);
        try {
            await fetch(`${API_URL}/api/cart`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": usuario?.id ?? "",
                    "x-sucursal": usuario?.sucursal_codigo ?? "",
                    "x-order-type": orderType
                }
            });
        } catch (e) {
            console.error("No se pudo limpiar el carrito remoto (se vació local igual)", e);
        }
    };

    // Llamá esto después de “pedido enviado correctamente”
    const limpiarCarritoPostPedido = async () => {
        await vaciarCarrito();
    };

    const actualizarUnidades = (ean, nuevasUnidades) => {
        setCarrito((prev) => {
            if (nuevasUnidades <= 0) {
                return prev.filter((it) => it.ean !== ean);
            }
            return prev.map((it) =>
                it.ean === ean ? { ...it, unidades: nuevasUnidades } : it
            );
        });
    };

    return (
        <CarritoContext.Provider
            value={{
                carrito,
                cargandoCarrito,
                sincronizando,
                agregarAlCarrito,
                actualizarCantidad,
                eliminarDelCarrito,
                vaciarCarrito,
                limpiarCarritoPostPedido,
                actualizarUnidades,
                replaceCarrito,
            }}
        >
            {children}
        </CarritoContext.Provider>
    );
};

export const useCarrito = () => useContext(CarritoContext);
