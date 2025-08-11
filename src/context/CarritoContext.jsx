import { createContext, useContext, useState } from "react";

const CarritoContext = createContext();

export const CarritoProvider = ({ children }) => {
    const [carrito, setCarrito] = useState([]);

    const agregarAlCarrito = (producto, cantidad) => {
        setCarrito((prev) => [
            ...prev,
            { ...producto, unidades: cantidad },
        ]);
    };

    const vaciarCarrito = () => setCarrito([]);

    const eliminarDelCarrito = (ean) => {
        setCarrito(prev => prev.filter(p => p.ean !== ean));
    };

    return (
        <CarritoContext.Provider value={{ carrito, agregarAlCarrito, vaciarCarrito, eliminarDelCarrito }}>
            {children}
        </CarritoContext.Provider>
    );
};

export const useCarrito = () => useContext(CarritoContext);
