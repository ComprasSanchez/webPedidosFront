import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../config/api";

const Reposicion = () => {
    const { usuario, authFetch } = useAuth();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resultado, setResultado] = useState(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0] || null);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setError("Seleccioná un archivo TXT");
            return;
        }
        setLoading(true);
        setError("");
        setResultado(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await authFetch(`${API_URL}/api/reposicion/upload-txt`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                throw new Error("Error al subir el archivo");
            }

            const data = await res.json();
            setResultado(data);
        } catch (err) {
            setError(err.message || "Error inesperado");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reposicion_container">
            <h1>📦 Reposición</h1>
            <p>Usuario: {usuario?.nombre}</p>
            <p>Sucursal: {usuario?.sucursal_codigo || "No asignada"}</p>

            <form onSubmit={handleUpload} className="reposicion_form">
                <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Subiendo..." : "Subir archivo"}
                </button>
            </form>

            {error && <p className="reposicion_error">{error}</p>}

            {resultado && (
                <div className="reposicion_result">
                    <h3>✅ Archivo procesado</h3>
                    <p><strong>ID:</strong> {resultado.id}</p>
                    <p><strong>Archivo:</strong> {resultado.nombre_archivo}</p>
                    <p><strong>Sucursal:</strong> {resultado.sucursal_codigo}</p>
                    <p><strong>Total items:</strong> {resultado.totalItems}</p>
                    <p><strong>Total unidades:</strong> {resultado.totalUnidades}</p>

                    <table className="reposicion_table">
                        <thead>
                            <tr>
                                <th>EAN</th>
                                <th>Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resultado.items.map((it, i) => (
                                <tr key={i}>
                                    <td>{it.ean}</td>
                                    <td>{it.cantidad}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default Reposicion;