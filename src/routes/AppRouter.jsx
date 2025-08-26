import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Login from "../features/login/Login";
import BuscadorProductos from "../features/buscador/BuscadorProductos";
import RevisarPedido from "../features/revisar/RevisarPedido";
import PanelAdmin from "../features/admin/PanelAdmin";
import PanelCredenciales from "../features/admin/PanelCredenciales";

const ProtectedRoute = ({ children }) => {
    const { usuario, initializing } = useAuth();
    if (initializing) return null; // o un loader/spinner
    return usuario ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
    const { usuario, initializing } = useAuth();
    if (initializing) return null;
    if (!usuario) return <Navigate to="/login" replace />;
    if (usuario.rol !== "admin") return <Navigate to="/buscador" replace />;
    return children;
};


const AppRouter = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<AdminRoute><PanelAdmin /></AdminRoute>} />
                <Route
                    path="/buscador"
                    element={
                        <ProtectedRoute>
                            <BuscadorProductos />
                        </ProtectedRoute>
                    }
                />
                <Route path="/admin/credenciales" element={<AdminRoute><PanelCredenciales /></AdminRoute>} />
                <Route path="/revisar" element={<ProtectedRoute><RevisarPedido /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </Router>
    );
};

export default AppRouter;
