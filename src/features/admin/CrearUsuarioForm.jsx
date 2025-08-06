import { useState } from "react";

const CrearUsuarioForm = ({ onUsuarioCreado }) => {
    const [form, setForm] = useState({
        nombre: "",
        usuario: "",
        contrasena: "",
        rol: "sucursal",
        sucursal_codigo: "",
    });

    const [mensaje, setMensaje] = useState("");

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch("http://localhost:4000/api/usuarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (res.status === 201 || res.status === 200) {
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
                setMensaje("❌ Error: " + data.error);
            }
        } catch (err) {
            console.error("❌ Error de conexión:", err);
            setMensaje("❌ Error de conexión");
        }
    };


    return (
        <div style={{ marginTop: "2rem" }}>
            <h3>Crear nuevo usuario</h3>
            <form onSubmit={handleSubmit} className="admin_form">

                <input name="nombre" placeholder="Nombre" value={form.nombre} onChange={handleChange} required />
                <input name="usuario" placeholder="Usuario" value={form.usuario} onChange={handleChange} required />
                <input name="contrasena" placeholder="contrasena" type="password" value={form.contrasena} onChange={handleChange} required />
                <select name="rol" value={form.rol} onChange={handleChange}>
                    <option value="sucursal">Sucursal</option>
                    <option value="admin">Admin</option>
                </select>
                {form.rol === "sucursal" && (
                    <input name="sucursal_codigo" placeholder="Código de sucursal" value={form.sucursal_codigo} onChange={handleChange} />
                )}
                <button type="submit">Crear usuario</button>
            </form>
            {mensaje && <p>{mensaje}</p>}
        </div>
    );
};

export default CrearUsuarioForm;
