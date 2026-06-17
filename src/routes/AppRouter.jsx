import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Toaster } from "react-hot-toast";

import Login from "../features/login/Login";
import BuscadorProductos from "../features/buscador/BuscadorProductos";
import RevisarPedido from "../features/revisar/RevisarPedido";
import PanelAdmin from "../features/admin/PanelAdmin";
import PanelCredenciales from "../features/admin/PanelCredenciales";
import ResumenPedidos from "../features/reposicion/ResumenPedidos";
import GestionConvenios from "../features/convenios/GestionConvenios";
import GestionDeposito from "../features/deposito/GestionDeposito";
import Navbar from "../features/navbar/Navbar";

// ✅ Ruta privada con control de login + roles
const PrivateRoute = ({ children, roles }) => {
    const { usuario, initializing } = useAuth();

    if (initializing) return null; // spinner/loader si querés
    if (!usuario) return <Navigate to="/login" replace />;

    if (roles && !roles.includes(usuario.rol)) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

const AppRouter = () => {
    const location = useLocation();
    const hideNavbar = location.pathname === "/login";
    const { usuario } = useAuth();

    // 🔧 Redirección inteligente según el rol
    const getDefaultRoute = () => {
        if (!usuario) return "/login";
        if (usuario.rol === "compras") return "/buscador";
        if (usuario.rol === "admin") return "/admin";
        if (usuario.rol === "sucursal") return "/buscador";
        if (usuario.rol === "deposito") return "/deposito";
        return "/login";
    }; return (
        <>
            {!hideNavbar && <Navbar />}
            <Routes>
                {/* Login */}
                <Route path="/login" element={<Login />} />

                {/* Admin */}
                <Route
                    path="/admin"
                    element={
                        <PrivateRoute roles={["admin"]}>
                            <PanelAdmin />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/admin/credenciales"
                    element={
                        <PrivateRoute roles={["admin"]}>
                            <PanelCredenciales />
                        </PrivateRoute>
                    }
                />


                {/* Sucursales */}
                <Route
                    path="/buscador"
                    element={
                        <PrivateRoute roles={["sucursal", "compras"]}>
                            <BuscadorProductos />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/revisar"
                    element={
                        <PrivateRoute roles={["sucursal", "compras"]}>
                            <RevisarPedido />
                        </PrivateRoute>
                    }
                />

                {/* Reposición - Resumen de pedidos */}
                <Route
                    path="/reposicion/resumen"
                    element={
                        <PrivateRoute roles={["compras", "admin"]}>
                            <ResumenPedidos />
                        </PrivateRoute>
                    }
                />

                {/* Reposición - Gestión de convenios */}
                <Route
                    path="/reposicion/convenios"
                    element={
                        <PrivateRoute roles={["compras", "admin"]}>
                            <GestionConvenios />
                        </PrivateRoute>
                    }
                />

                {/* Depósito */}
                <Route
                    path="/deposito"
                    element={
                        <PrivateRoute roles={["deposito", "admin"]}>
                            <GestionDeposito />
                        </PrivateRoute>
                    }
                />

                {/* Default */}
                <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
                <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
            </Routes>
            <Toaster position="top-center" />
        </>
    );
};

const AppRouterWithRouter = () => (
    <Router>
        <AppRouter />
    </Router>
);

export default AppRouterWithRouter;
