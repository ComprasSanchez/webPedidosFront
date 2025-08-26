import { useState } from "react";
import { API_URL } from "../../config/api";

const CrearUsuarioForm = ({ onUsuarioCreado }) => {
    const [form, setForm] = useState({
        nombre: "",
        usuario: "",
        contrasena: "",
        rol: "sucursal",
        sucursal_codigo: "",
    });

    const [mensaje, setMensaje] = useState("");
    const [tipoMensaje, setTipoMensaje] = useState("success");

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje("");

        try {
            const res = await fetch(`${API_URL}/api/usuarios`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (res.status === 201 || res.status === 200) {
                setTipoMensaje("success");
                setMensaje("✅ Usuario creado con ID " + data.id);
                setForm({
                    nombre: "",
                    usuario: "",
                    contrasena: "",
                    rol: "sucursal",
                    sucursal_codigo: "",
                });
                if (onUsuarioCreado) onUsuarioCreado();
            } else {
                setTipoMensaje("error");
                setMensaje("❌ Error: " + (data.error || "Error desconocido"));
            }
        } catch (err) {
            console.error("❌ Error de conexión:", err);
            setTipoMensaje("error");
            setMensaje("❌ Error de conexión");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="admin_form">
            <input
                name="nombre"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={handleChange}
                required
            />
            <input
                name="usuario"
                placeholder="Nombre de usuario"
                value={form.usuario}
                onChange={handleChange}
                required
            />
            <input
                name="contrasena"
                placeholder="Contraseña"
                type="password"
                value={form.contrasena}
                onChange={handleChange}
                required
            />
            <select name="rol" value={form.rol} onChange={handleChange}>
                <option value="sucursal">Sucursal</option>
                <option value="admin">Admin</option>
            </select>
            {form.rol === "sucursal" && (
                <input
                    name="sucursal_codigo"
                    placeholder="Código de sucursal"
                    value={form.sucursal_codigo}
                    onChange={handleChange}
                />
            )}
            <button type="submit" className="boton_editar">Crear usuario</button>

            {mensaje && (
                <p className={tipoMensaje === "success" ? "success" : "error"}>
                    {mensaje}
                </p>
            )}
        </form>
    );
};

export default CrearUsuarioForm;
