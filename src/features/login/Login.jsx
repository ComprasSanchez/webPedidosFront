import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";

const Login = () => {
    const { login, usuario } = useAuth(); // 👈 ahora tomamos `usuario` del context
    const navigate = useNavigate();
    const [usuarioInput, setUsuarioInput] = useState("");
    const [contrasena, setContrasena] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await login(usuarioInput, contrasena);
        if (success) {
            navigate(usuario?.rol === "admin" ? "/admin" : "/buscador");
        } else {
            setError("Usuario o contraseña incorrectos.");
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
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    className="login_input"
                />
                <button type="submit" className="login_button">Ingresar</button>
                {error && <p className="login_error">{error}</p>}
            </form>
        </div>
    );
};

export default Login;
