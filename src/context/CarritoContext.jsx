import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import ZipProcessor from "../services/zipProcessor.js";
import SessionStorageService from "../services/sessionStorageService.js";
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

    // Estado para el flag "Solo depósito" (solo para usuarios de compras)
    const [soloDeposito, setSoloDeposito] = useState(false);

    // Estado para modo bulk (carga masiva de ZIP)
    const [modoBulk, setModoBulk] = useState(false);
    const [carritosBulk, setCarritosBulk] = useState({}); // { sucursal1: [...items], sucursal2: [...items] }

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

    // 🔹 Detectar modo bulk automáticamente
    useEffect(() => {
        const esModoBulk = usuario?.rol === "compras" && !sucursalReponer;
        if (esModoBulk !== modoBulk) {
            setModoBulk(esModoBulk);
            if (!esModoBulk) {
                // Limpiar carritos bulk y metadatos al salir del modo bulk
                setCarritosBulk({});
                SessionStorageService.clearMetadatosBulk();
            }
        }
    }, [sucursalReponer, usuario?.rol, modoBulk]);

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
            // 🔍 LOG: Debug del producto que se está agregando
            console.log('🔍 [CARRITO] Agregando producto:', {
                ean: producto.ean,
                idQuantio: producto.idQuantio,
                idProducto: producto.idProducto,
                nombre: producto.nombre || producto.descripcion
            });

            // Normalizar idQuantio a string
            const idQuantio = String(producto.idQuantio || producto.idProducto);
            if (!idQuantio || idQuantio === 'undefined' || idQuantio === 'null') {
                console.warn("⚠️ [CARRITO] Producto sin identificador único (idQuantio o idProducto):", producto);
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
        // 🔍 LOG: Debug de productos que se están reemplazando
        console.log('🔍 [CARRITO] Reemplazando carrito con', items.length, 'productos');

        const productosConId = items.filter(item => item.idQuantio);
        const productosSinId = items.filter(item => !item.idQuantio);

        console.log('✅ [CARRITO] Productos con idQuantio:', productosConId.length);
        console.log('❌ [CARRITO] Productos SIN idQuantio:', productosSinId.length);

        if (productosSinId.length > 0) {
            console.log('❌ [CARRITO] Productos SIN ID detalle:', productosSinId.slice(0, 5).map(p => ({
                ean: p.ean,
                nombre: p.nombre || p.descripcion,
                idQuantio: p.idQuantio,
                origen: p.origen
            })));
        }

        setCarrito(items);
    }

    // Función para acumular productos (sumar cantidades de productos existentes)
    function acumularProductosEnCarrito(nuevosItems) {
        let agregados = 0;
        let actualizados = 0;

        setCarrito(prev => {
            // Crear un Map del carrito actual para búsqueda rápida por EAN
            const carritoMap = new Map();
            prev.forEach(item => {
                carritoMap.set(item.ean, item);
            });

            // Procesar nuevos items: sumar cantidades o agregar nuevos
            nuevosItems.forEach(nuevoItem => {
                if (carritoMap.has(nuevoItem.ean)) {
                    // Producto existe: sumar cantidades
                    const itemExistente = carritoMap.get(nuevoItem.ean);
                    itemExistente.unidades = (itemExistente.unidades || 0) + (nuevoItem.unidades || 0);
                    actualizados++;
                } else {
                    // Producto nuevo: agregarlo al Map
                    carritoMap.set(nuevoItem.ean, nuevoItem);
                    agregados++;
                }
            });

            // Convertir Map de vuelta a array
            return Array.from(carritoMap.values());
        });

        return { agregados, actualizados };
    }

    // Funciones específicas para modo bulk
    const procesarZipData = (zipData) => {
        try {
            const carritoConsolidado = ZipProcessor.procesarZipData(zipData, carritosBulk);

            setCarritosBulk(carritoConsolidado);
            setModoBulk(true);
            setSoloDeposito(true); // Forzar modo solo depósito en bulk
        } catch (error) {
            console.error('Error procesando ZIP:', error);
            throw error;
        }
    };

    const obtenerCarritosSucursales = () => {
        return modoBulk ? carritosBulk : {};
    };

    const obtenerTotalProductosBulk = () => {
        return ZipProcessor.calcularTotales(carritosBulk).totalProductos;
    };

    const obtenerTotalUnidadesBulk = () => {
        return ZipProcessor.calcularTotales(carritosBulk).totalUnidades;
    };


    // Ahora usa idQuantio (CodPlex) para identificar el producto
    const eliminarDelCarrito = (idQuantio) => {
        setCarrito(prev => prev.filter(p => p.idQuantio !== idQuantio));
    };

    const vaciarCarrito = async () => {
        setCarrito([]);
        setSoloDeposito(false); // Resetear flag cuando se vacía carrito

        // Limpiar también estado bulk y metadatos en sessionStorage
        setCarritosBulk({});
        setModoBulk(false);
        SessionStorageService.clearMetadatosBulk();

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


    // Actualizar unidades usando identificador único (idQuantio o EAN)
    const actualizarUnidades = (identificador, nuevasUnidades) => {
        setCarrito((prev) => {
            if (nuevasUnidades <= 0) {
                return prev.filter((it) => (it.idQuantio || it.ean) !== identificador);
            }
            return prev.map((it) =>
                (it.idQuantio || it.ean) === identificador ? { ...it, unidades: nuevasUnidades } : it
            );
        });
    };

    return (
        <CarritoContext.Provider
            value={{
                carrito,
                cargandoCarrito,
                sincronizando,
                soloDeposito,
                setSoloDeposito,
                agregarAlCarrito,
                actualizarCantidad,
                eliminarDelCarrito,
                vaciarCarrito,
                limpiarCarritoPostPedido,
                actualizarUnidades,
                replaceCarrito,
                acumularProductosEnCarrito,
                // Funciones para modo bulk
                modoBulk,
                setModoBulk,
                carritosBulk,
                setCarritosBulk,
                procesarZipData,
                obtenerCarritosSucursales,
                obtenerTotalProductosBulk,
                obtenerTotalUnidadesBulk,
            }}
        >
            {children}
        </CarritoContext.Provider>
    );
};

export const useCarrito = () => useContext(CarritoContext);
