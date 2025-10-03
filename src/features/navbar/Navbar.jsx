import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.png";
import { FaSearch, FaShoppingCart, FaSignOutAlt, FaUserShield, FaKey, FaStore, FaUsers, FaWarehouse } from "react-icons/fa";
import ModalSeleccionSucursal from "../../components/ui/ModalSeleccionSucursal";

export default function Navbar() {
    const { usuario, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const [modalSucursalOpen, setModalSucursalOpen] = useState(false);
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState(
        sessionStorage.getItem("sucursalReponer") || ""
    );
    const navigate = useNavigate();

    // 🔧 Links según el rol del usuario
    const getLinks = () => {
        if (usuario?.rol === "admin") {
            return [
                { to: "/admin", label: "Admin", icon: FaUserShield },
                { to: "/admin/credenciales", label: "Credenciales", icon: FaKey }
            ];
        }

        if (usuario?.rol === "compras") {
            return [
                { to: "/reposicion", label: "Reposición", icon: FaSearch },
                { to: "/revisar", label: "Carrito", icon: FaShoppingCart }
            ];
        }

        if (usuario?.rol === "sucursal") {
            return [
                { to: "/buscador", label: "Inicio", icon: FaSearch },
                { to: "/revisar", label: "Carrito", icon: FaShoppingCart }
            ];
        }

        return [];
    };

    // 🔧 Ruta de inicio según el rol
    const getHomeRoute = () => {
        if (usuario?.rol === "compras") return "/reposicion";
        if (usuario?.rol === "admin") return "/admin";
        return "/buscador"; // sucursal por defecto
    };

    const links = getLinks();

    const handleSelectSucursal = (codigo) => {
        setSucursalSeleccionada(codigo);
        if (codigo) {
            sessionStorage.setItem("sucursalReponer", codigo);
        } else {
            sessionStorage.removeItem("sucursalReponer");
        }
        setModalSucursalOpen(false);
    };

    const handleOpenModalSucursal = () => {
        setModalSucursalOpen(true);
    };

    const handle_logout = () => {
        try {
            // opcional: invalidar en el back
            // await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        } catch { }
        logout();
        navigate("/login");
    };

    return (
        <header className="navbar_header">
            <div className="navbar_wrapper">

                <nav className={`navbar_nav ${open ? "is_open" : ""}`}>
                    <ul className="navbar_links">
                        {links.map(l => (
                            <li key={l.to} className="navbar_item">
                                <NavLink
                                    to={l.to}
                                    title={l.label}
                                    aria-label={l.label}
                                    className={({ isActive }) =>
                                        `navbar_link ${l.icon ? "navbar_icon_link" : ""} ${isActive ? "is_active" : ""}`
                                    }
                                    onClick={() => setOpen(false)}
                                >
                                    {l.icon ? <l.icon className="navbar_icon" aria-hidden="true" /> : l.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                </nav>
                <NavLink
                    to={getHomeRoute()}
                    className="navbar_brand"
                    title="Ir al inicio"
                    aria-label="Ir al inicio"
                >
                    <img src={logo} alt="Logo" className="navbar_logo" />
                </NavLink>

                <div className="navbar_user">
                    <span className="navbar_usuario">
                        {usuario?.rol === "compras" ? (
                            sucursalSeleccionada ? `Repo: ${sucursalSeleccionada}` : "Modo ZIP masivo"
                        ) : (
                            usuario?.sucursal_codigo ?? usuario?.usuario ?? "Usuario"
                        )}
                    </span>
                    {usuario ? (
                        <>
                            {usuario?.rol === "compras" && (
                                <button
                                    className="usuarios_icon_btn"
                                    onClick={handleOpenModalSucursal}
                                    aria-label="Cambiar sucursal a reponer"
                                    title={sucursalSeleccionada ? `Cambiar sucursal (actual: ${sucursalSeleccionada})` : "Seleccionar sucursal o activar modo ZIP masivo"}
                                    style={{
                                        color: "#cba204",
                                        fontSize: "1.3rem",
                                        border: "1px solid #cba204",
                                    }}
                                >
                                    <FaUsers />
                                </button>
                            )}
                            <button
                                className="carrito_icon_btn"
                                onClick={handle_logout}
                                aria-label="Cerrar sesión"
                                title="Cerrar sesión"
                            >
                                <FaSignOutAlt />
                            </button>
                        </>
                    ) : (
                        <NavLink to="/login" className="btn_primario navbar_btn_login">
                            Iniciar sesión
                        </NavLink>
                    )}
                </div>

            </div>

            <ModalSeleccionSucursal
                isOpen={modalSucursalOpen}
                onSelect={handleSelectSucursal}
                onClose={() => setModalSucursalOpen(false)}
            />
        </header>
    );
}
