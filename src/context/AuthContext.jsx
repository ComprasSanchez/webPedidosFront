// front/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { API_URL } from "../config/api";

const AuthContext = createContext();

// Siempre usar el fetch nativo del browser, sin riesgo de recursión
const nativeFetch =
    typeof window !== "undefined" && window.fetch
        ? window.fetch.bind(window)
        : globalThis.fetch.bind(globalThis);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        const fromSession = localStorage.getItem("session");
        if (fromSession) {
            try {
                setSession(JSON.parse(fromSession));
                setInitializing(false); // ✅
                return;
            } catch { }
        }

        const legacy = localStorage.getItem("usuario");
        if (legacy) {
            try {
                const legacyUser = JSON.parse(legacy);
                const migrated = { token: null, user: legacyUser };
                setSession(migrated);
                localStorage.setItem("session", JSON.stringify(migrated));
                localStorage.removeItem("usuario");
            } catch { }
        }

        setInitializing(false); // ✅ en cualquier caso
    }, []);


    const login = async (usuario, contrasena) => {
        try {
            const res = await nativeFetch(`${API_URL}/api/usuarios/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, contrasena }),
            });
            if (!res.ok) return false;

            const { token, user } = await res.json();
            const newSession = { token, user };
            setSession(newSession);
            localStorage.setItem("session", JSON.stringify(newSession));
            localStorage.removeItem("usuario");
            return true;
        } catch (err) {
            console.error("Error en login:", err);
            return false;
        }
    };

    const logout = () => {
        setSession(null);
        localStorage.removeItem("session");
        localStorage.removeItem("usuario");
    };

    const usuario = session?.user || null;
    const token = session?.token || null;

    const authHeaders = useMemo(() => {
        const h = {};
        if (token) h.Authorization = `Bearer ${token}`;
        if (usuario?.id) h["x-user-id"] = usuario.id;
        if (usuario?.sucursal_codigo) h["x-sucursal"] = usuario.sucursal_codigo;
        return h;
    }, [token, usuario]);

    const authFetch = async (url, options = {}) => {
        const headers = { ...(options.headers || {}), ...authHeaders };

        // Debug logging para ZIP uploads
        if (url.includes('upload-zip')) {
            console.log('🔐 AuthFetch debug:', {
                url: url.split('/').pop(),
                hasToken: !!token,
                hasAuthHeader: !!headers.Authorization,
                authHeaderPrefix: headers.Authorization?.substring(0, 20) + '...',
                usuario: usuario?.usuario
            });
        }

        return nativeFetch(url, { ...options, headers });
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                login,
                logout,
                token,
                session,
                authHeaders,
                authFetch,
                initializing
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
