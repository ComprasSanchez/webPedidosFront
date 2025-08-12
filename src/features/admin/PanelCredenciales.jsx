// front/src/features/admin/PanelCredenciales.jsx

import { useEffect, useState } from "react";
import "../../styles/PanelCredenciales.scss";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config/api";

const PanelCredenciales = () => {
    const [credenciales, setCredenciales] = useState([]);
    const [abierto, setAbierto] = useState(null);
    const [formData, setFormData] = useState({});
    const navigate = useNavigate();
    useEffect(() => {
        fetch(`${API_URL}/api/credenciales`)
            .then((res) => res.json())
            .then((data) => {
                setCredenciales(data);
                const inicial = {};
                data.forEach((c) => (inicial[c.id] = { ...c }));
                setFormData(inicial);
            });
    }, []);

    const handleChange = (id, campo, valor) => {
        setFormData((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                [campo]: valor,
            },
        }));
    };

    const handleGuardar = async (id) => {
        try {
            const { id: _, creado_en, fecha_ult_modificacion, ...datosParaActualizar } = formData[id];

            const res = await fetch(`${API_URL}/api/credenciales/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datosParaActualizar),
            });

            if (res.ok) {
                alert("✅ Cambios guardados correctamente");
            } else {
                alert("❌ Error al guardar cambios");
            }
        } catch (err) {
            console.error("Error al guardar:", err);
        }
    };

    return (
        <div className="panel_credenciales">
            <button
                onClick={() => navigate("/admin")}
                style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    background: "#007f96",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer"
                }}
            >
                Gestionar usuarios
            </button>
            <h2 className="panel_credenciales_titulo">Credenciales de Droguerías</h2>

            <div className="accordion_wrapper">
                {credenciales.map((cred) => (
                    <div key={cred.id} className="accordion_item">
                        <div
                            className="accordion_header"
                            onClick={() => setAbierto(abierto === cred.id ? null : cred.id)}
                        >
                            {cred.sucursal_codigo} - {cred.drogueria}
                        </div>

                        {abierto === cred.id && (
                            <div className="accordion_body">
                                <form className="cred_form">
                                    {Object.entries(formData[cred.id])
                                        .filter(([k]) => !["id", "creado_en", "fecha_ult_modificacion"].includes(k))
                                        .map(([campo, valor]) => (
                                            <div key={campo} className="cred_input_group">
                                                <label>{campo.replace(/_/g, " ")}</label>
                                                <input
                                                    value={valor || ""}
                                                    onChange={(e) => handleChange(cred.id, campo, e.target.value)}
                                                />
                                            </div>
                                        ))}

                                    <button type="button" onClick={() => handleGuardar(cred.id)}>
                                        Guardar cambios
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PanelCredenciales;
