// front/src/features/admin/PanelCredenciales.jsx

import { useEffect, useState } from "react";
import "../../styles/panelCredenciales.scss";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config/api";

const DROGUERIAS = [
    "quantio",     // depósito interno (si lo usás así)
    "monroe",
    "suizo",
    "cofarsur",
    "kellerhof",
];

const NUEVA_CRED_BASE = {
    sucursal_codigo: "",
    drogueria: "",
    quantio_usuario: "",
    quantio_clave: "",
    monroe_cuenta: "",
    monroe_ecommerce_key: "",
    monroe_software_key: "",
    cofarsur_usuario: "",
    cofarsur_clave: "",
    cofarsur_token: "",
    suizo_usuario: "",
    suizo_clave: "",
    suizo_cliente: "",
    kellerhof_usuario: "",
    kellerhof_clave: "",
    kellerhof_cliente: "",
};

// Para decidir si un campo es sensible (lo mostramos como password)
const isSecretField = (name) =>
    /(clave|key|token)/i.test(name);


const PanelCredenciales = () => {
    const [credenciales, setCredenciales] = useState([]);
    const [abierto, setAbierto] = useState(null);
    const [formData, setFormData] = useState({});
    const [nuevo, setNuevo] = useState(NUEVA_CRED_BASE);
    const [cargando, setCargando] = useState(false);
    const navigate = useNavigate();


    useEffect(() => {
        (async () => {
            setCargando(true);
            try {
                const res = await fetch(`${API_URL}/api/credenciales`);
                const data = await res.json();
                setCredenciales(data);
                const inicial = {};
                data.forEach((c) => (inicial[c.id] = { ...c }));
                setFormData(inicial);
            } catch (e) {
                console.error("Error cargando credenciales:", e);
            } finally {
                setCargando(false);
            }
        })();
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
            const {
                id: _omit,
                creado_en,
                fecha_ult_modificacion,
                ...datosParaActualizar
            } = formData[id] || {};

            // Evitar mandar undefined/null (limpia el payload)
            Object.keys(datosParaActualizar).forEach(k => {
                if (datosParaActualizar[k] === undefined) delete datosParaActualizar[k];
            });

            const res = await fetch(`${API_URL}/api/credenciales/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datosParaActualizar),
            });

            if (res.ok) {
                alert("✅ Cambios guardados correctamente");
            } else {
                const errTxt = await res.text();
                alert(`❌ Error al guardar cambios: ${errTxt || res.status}`);
            }
        } catch (err) {
            console.error("Error al guardar:", err);
        }
    };

    const handleCrear = async () => {
        // Validación mínima
        if (!nuevo.sucursal_codigo?.trim() || !nuevo.drogueria?.trim()) {
            alert("⚠️ sucursal_codigo y drogueria son obligatorios");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/credenciales`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevo),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                alert("✅ Credencial creada");
                // Refrescar la grilla
                const res2 = await fetch(`${API_URL}/api/credenciales`);
                const list = await res2.json();
                setCredenciales(list);
                const inicial = {};
                list.forEach((c) => (inicial[c.id] = { ...c }));
                setFormData(inicial);
                setNuevo(NUEVA_CRED_BASE); // limpiar form
            } else {
                alert(`❌ Error al crear: ${data?.error || res.status}`);
            }
        } catch (e) {
            console.error("Error creando credencial:", e);
            alert("❌ Error inesperado al crear credencial");
        }
    };


    return (
        <div className="panel_credenciales">

            <h2 className="panel_credenciales_titulo">Credenciales de Droguerías</h2>

            {/* ➕ Nueva credencial */}
            <div className="nueva_cred_card">
                <h3>➕ Nueva credencial</h3>
                <div className="nueva_cred_grid">
                    {/* sucursal_codigo */}
                    <div className="cred_input_group">
                        <label>sucursal_codigo *</label>
                        <input
                            value={nuevo.sucursal_codigo}
                            onChange={(e) => setNuevo({ ...nuevo, sucursal_codigo: e.target.value })}
                            placeholder="Ej: SA3"
                        />
                    </div>

                    {/* drogueria */}
                    <div className="cred_input_group">
                        <label>drogueria *</label>
                        <select
                            value={nuevo.drogueria}
                            onChange={(e) => setNuevo({ ...nuevo, drogueria: e.target.value })}
                        >
                            <option value="">-- seleccionar --</option>
                            {DROGUERIAS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    {/* Campos comunes (podés dejar todos y llenar solo los que correspondan a esa droguería) */}
                    {Object.entries(NUEVA_CRED_BASE)
                        .filter(([k]) => !["sucursal_codigo", "drogueria"].includes(k))
                        .map(([campo]) => (
                            <div key={campo} className="cred_input_group">
                                <label>{campo.replace(/_/g, " ")}</label>
                                <input
                                    type={isSecretField(campo) ? "password" : "text"}
                                    value={nuevo[campo] || ""}
                                    onChange={(e) => setNuevo({ ...nuevo, [campo]: e.target.value })}
                                    placeholder={isSecretField(campo) ? "••••••••" : ""}
                                    autoComplete="new-password"
                                />
                            </div>
                        ))}
                </div>
                <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={handleCrear}>
                        Crear credencial
                    </button>
                </div>
            </div>

            {/* Lista existente */}
            {cargando ? (
                <p>Cargando...</p>
            ) : (
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
                                                        type={isSecretField(campo) ? "password" : "text"}
                                                        value={valor || ""}
                                                        onChange={(e) => handleChange(cred.id, campo, e.target.value)}
                                                        placeholder={isSecretField(campo) ? "••••••••" : ""}
                                                        autoComplete="new-password"
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
            )}
        </div>
    );

};

export default PanelCredenciales;
