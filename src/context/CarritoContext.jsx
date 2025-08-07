import { createContext, useContext, useState } from "react";

const CarritoContext = createContext();

export const CarritoProvider = ({ children }) => {
    const [carrito, setCarrito] = useState([]);

    const agregarAlCarrito = (producto, cantidad) => {
        console.log("Agregando al carrito:", producto, "Cantidad:", cantidad);

        setCarrito((prev) => [
            ...prev,
            { ...producto, unidades: cantidad },
        ]);
    };

    const vaciarCarrito = () => setCarrito([]);

    return (
        <CarritoContext.Provider value={{ carrito, agregarAlCarrito, vaciarCarrito }}>
            {children}
        </CarritoContext.Provider>
    );
};

export const useCarrito = () => useContext(CarritoContext);
