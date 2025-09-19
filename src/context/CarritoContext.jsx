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

    // Estado para la sucursal de reposición (para usuarios de compras)
    const [sucursalReponer, setSucursalReponer] = useState(
        sessionStorage.getItem("sucursalReponer") || ""
    );

    const identidadLista = Boolean(usuario?.id && usuario?.sucursal_codigo);
    if (!API_URL) console.warn("⚠️ API_URL no está definida");

    // 🔹 Definir orderType según rol
    const orderType = usuario?.rol === "compras" ? "REPOSICION" : "SUCURSAL";

    // 🔹 Efecto para escuchar cambios en sessionStorage (usuarios de compras)
    useEffect(() => {
        if (usuario?.rol !== "compras") return;

        const handleStorageChange = () => {
            const nuevaSucursal = sessionStorage.getItem("sucursalReponer") || "";
            if (nuevaSucursal !== sucursalReponer) {
                setSucursalReponer(nuevaSucursal);
            }
        };

        // Escuchar cambios en storage y revisar cada segundo
        window.addEventListener("storage", handleStorageChange);
        const interval = setInterval(handleStorageChange, 1000);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, [sucursalReponer, usuario?.rol]);

    // 🔹 Determinar la sucursal actual según el rol
    const sucursalActual = usuario?.rol === "compras" ? sucursalReponer : usuario?.sucursal_codigo;

    // --- A) Hidratar carrito desde backend/Redis al cargar
    useEffect(() => {
        // No cargar si no tenemos usuario o sucursal
        if (!usuario?.id || !sucursalActual) return;

        let mounted = true;
        setCargandoCarrito(true);

        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/cart`, {
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "x-user-id": usuario?.id ?? "",
                        "x-sucursal": sucursalActual,
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
    }, [API_URL, usuario?.id, sucursalActual, orderType]);

    // --- B) Guardar carrito con debounce cada vez que cambia
    useEffect(() => {
        if (cargandoCarrito || !sucursalActual) return; // no guardes mientras hidratás
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
                        "x-sucursal": sucursalActual,
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
    }, [carrito, cargandoCarrito, API_URL, usuario?.id, sucursalActual, orderType]);

    // --- Helpers de negocio
    const agregarAlCarrito = (producto, cantidad) => {
        setCarrito(prev => {

            // Normalizar idQuantio a string
            const idQuantio = String(producto.idQuantio || producto.idProducto);
            if (!idQuantio) {
                console.warn("⚠️ Producto sin identificador único (idQuantio o idProducto):", producto);
                return prev; // No agregar productos sin identificador único
            }

            // Buscar producto existente por idQuantio (como string)
            const idx = prev.findIndex(p => String(p.idQuantio) === idQuantio);
            if (idx >= 0) {
                const copia = [...prev];
                const unidadesPrev = Number(copia[idx].unidades || 0);
                copia[idx] = {
                    ...copia[idx],
                    ...producto, // Actualizar datos del producto existente
                    idQuantio, // Forzar string
                    unidades: unidadesPrev + Number(cantidad || 0) // Sumar unidades
                };
                return copia;
            }

            // Normalizar el producto antes de agregarlo
            const nuevoProducto = {
                ...producto, // Mantener otros atributos si existen
                idQuantio, // Forzar string
                ean: producto.ean,
                nombre: producto.nombre,
                unidades: Number(cantidad || 0)
            };
            return [...prev, nuevoProducto];
        });
    };


    // Ahora usa idQuantio (CodPlex) para identificar el producto
    const actualizarCantidad = (idQuantio, nuevaCantidad) => {
        setCarrito(prev => prev.map(p => p.idQuantio === idQuantio ? { ...p, unidades: Number(nuevaCantidad || 0) } : p));
    };


    function replaceCarrito(items) {
        setCarrito(items);
    }


    // Ahora usa idQuantio (CodPlex) para identificar el producto
    const eliminarDelCarrito = (idQuantio) => {
        setCarrito(prev => prev.filter(p => p.idQuantio !== idQuantio));
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
                    "x-sucursal": sucursalActual,
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


    // Ahora usa idQuantio (CodPlex) para identificar el producto
    const actualizarUnidades = (idQuantio, nuevasUnidades) => {
        setCarrito((prev) => {
            if (nuevasUnidades <= 0) {
                return prev.filter((it) => it.idQuantio !== idQuantio);
            }
            return prev.map((it) =>
                it.idQuantio === idQuantio ? { ...it, unidades: nuevasUnidades } : it
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
