// front/src/features/admin/PanelAdmin.jsx

import { useEffect, useState } from "react";
import CrearUsuarioForm from "./CrearUsuarioForm";
import Modal from "../../components/ui/Modal";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config/api";

const PanelAdmin = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [usuarioEditando, setUsuarioEditando] = useState(null);
    const [formEdit, setFormEdit] = useState({});
    const [modalCrear, setModalCrear] = useState(false);
    const [modalEditar, setModalEditar] = useState(false);
    const navigate = useNavigate();

    const handleEditClick = (usuario) => {
        setUsuarioEditando(usuario.id);
        setFormEdit(usuario);
        setModalEditar(true);
    };

    const handleEditChange = (e) => {
        setFormEdit({ ...formEdit, [e.target.name]: e.target.value });
    };

    const handleUpdate = async () => {
        try {
            const res = await fetch(`${API_URL}/api/usuarios/${usuarioEditando}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formEdit),
            });

            if (res.ok) {
                setUsuarioEditando(null);
                setModalEditar(false);
                cargarUsuarios();
            }
        } catch (err) {
            console.error("Error al actualizar usuario:", err);
        }
    };

    const cargarUsuarios = async () => {
        try {
            const res = await fetch(`${API_URL}/api/usuarios`);
            const data = await res.json();
            setUsuarios(data);
        } catch (err) {
            console.error("Error al obtener usuarios:", err);
        }
    };

    useEffect(() => {
        cargarUsuarios();
    }, []);

    return (
        <div className="admin_wrapper">
            <h2 className="admin_titulo">Panel de Administración</h2>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                <button onClick={() => setModalCrear(true)} className="boton_editar">Crear usuario</button>
            </div>

            {/* Modal Crear Usuario */}
            {modalCrear && (
                <Modal onClose={() => setModalCrear(false)}>
                    <h3 className="admin_subtitulo">Crear nuevo usuario</h3>
                    <CrearUsuarioForm
                        onUsuarioCreado={() => {
                            cargarUsuarios();
                            setModalCrear(false);
                        }}
                    />
                </Modal>
            )}

            <table className="admin_tabla">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Sucursal</th>
                        <th>Creado</th>
                        <th>Modificado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {usuarios.map((u) => (
                        <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>{u.nombre}</td>
                            <td>{u.usuario}</td>
                            <td>{u.rol}</td>
                            <td>{u.sucursal_codigo || "-"}</td>
                            <td>{new Date(u.fecha_creado).toLocaleString()}</td>
                            <td>{new Date(u.fecha_ult_modificacion).toLocaleString()}</td>
                            <td>
                                <button className="boton_editar" onClick={() => handleEditClick(u)}>✏️</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>


            {/* Modal Editar Usuario */}
            {modalEditar && usuarioEditando && (
                <Modal onClose={() => { setModalEditar(false); setUsuarioEditando(null); }}>
                    <h3 className="admin_subtitulo">Editar usuario</h3>
                    <form className="admin_form">
                        <input name="nombre" value={formEdit.nombre} onChange={handleEditChange} placeholder="Nombre" />
                        <input name="usuario" value={formEdit.usuario} onChange={handleEditChange} placeholder="Usuario" />
                        <select name="rol" value={formEdit.rol} onChange={handleEditChange}>
                            <option value="sucursal">Sucursal</option>
                            <option value="admin">Admin</option>
                        </select>
                        <input name="sucursal_codigo" value={formEdit.sucursal_codigo || ""} onChange={handleEditChange} placeholder="Sucursal código" />
                        <input name="contrasena" type="password" onChange={handleEditChange} placeholder="Nueva contrasena (opcional)" />
                        <button type="button" onClick={handleUpdate}>Guardar cambios</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default PanelAdmin;
