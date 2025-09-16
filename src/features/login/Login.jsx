import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [usuarioInput, setUsuarioInput] = useState("");
    const [contrasena, setContrasena] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const success = await login(usuarioInput, contrasena);
        setLoading(false);

        if (success) {
            const { user } = JSON.parse(localStorage.getItem("session"));

            // 🔧 Redirección inteligente según el rol
            let redirectTo = "/login"; // fallback

            if (user.rol === "admin") {
                redirectTo = "/admin";
            } else if (user.rol === "compras") {
                redirectTo = "/reposicion";
            } else if (user.rol === "sucursal") {
                redirectTo = "/buscador";
            }

            navigate(redirectTo, { replace: true });
        } else {
            setError("Credenciales incorrectas.");
        }
    };

    return (
        <div className="login_container">
            <img src={logo} alt="Logo" className="login_logo" />
            <form onSubmit={handleSubmit} className="login_box">
                <h2>Pedidos Sucursal</h2>
                <input
                    placeholder="Usuario"
                    value={usuarioInput}
                    onChange={(e) => setUsuarioInput(e.target.value)}
                    className="login_input"
                    disabled={loading}
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    className="login_input"
                    disabled={loading}
                />
                <button type="submit" className="login_button" disabled={loading}>
                    {loading ? "Iniciando sesión..." : "Ingresar"}
                </button>
                {error && <p className="login_error">{error}</p>}
            </form>
        </div>
    );
};

export default Login;
