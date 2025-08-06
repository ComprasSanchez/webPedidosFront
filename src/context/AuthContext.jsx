import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(null);

    useEffect(() => {
        const stored = localStorage.getItem("usuario");
        if (stored) setUsuario(JSON.parse(stored));

    }, []);

    const login = async (usuario, contrasena) => {
        try {
            const res = await fetch("http://localhost:4000/api/usuarios/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, contrasena }),
            });

            if (!res.ok) return false;

            const user = await res.json();
            setUsuario(user);
            localStorage.setItem("usuario", JSON.stringify(user));
            console.log("Usuario logueado:", user);

            return true;
        } catch (err) {
            console.error("Error en login:", err);
            return false;
        }
    };

    const logout = () => {
        setUsuario(null);
        localStorage.removeItem("usuario");
    };


    return (
        <AuthContext.Provider value={{ usuario, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
