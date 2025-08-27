import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.png";
import { FaSearch, FaShoppingCart, FaSignOutAlt } from "react-icons/fa";

export default function Navbar() {
    const { usuario, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const base_links = [
        { to: "/buscador", label: "Inicio", icon: FaSearch },
        { to: "/revisar", label: "Carrito", icon: FaShoppingCart },
    ];

    const extra_links =
        (usuario?.rol === "admin" || usuario?.rol === "compras")
            ? [{ to: "/admin/usuarios", label: "Usuarios" }]
            : (usuario?.rol === "reposicion")
                ? [{ to: "/reposicion", label: "Reposición" }]
                : [];

    const links = [...base_links, ...extra_links];

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
                    to="/buscador"
                    className="navbar_brand"
                    title="Ir al buscador"
                    aria-label="Ir al buscador"
                >
                    <img src={logo} alt="Logo" className="navbar_logo" />
                </NavLink>

                <div className="navbar_user">
                    <span className="navbar_usuario">
                        {usuario?.sucursal_codigo ?? usuario?.usuario ?? "Usuario"}
                    </span>
                    {usuario ? (
                        <>
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
        </header>
    );
}
