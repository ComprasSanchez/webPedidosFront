// front/src/features/admin/PanelCredenciales.jsx

import { useEffect, useRef, useState } from "react";
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
    drogueria: "quantio", // todas las filas actuales usan 'quantio'
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
    kellerhoff_cuenta: "",
    kellerhoff_ecommerce_key: "",
    kellerhoff_software_key: "",
};

// Kellerhoff API nueva: la cuenta va en texto plano y las dos keys se guardan cifradas (las cifra el backend)
const CAMPOS_KELLERHOFF_NUEVA = ["kellerhoff_cuenta", "kellerhoff_ecommerce_key", "kellerhoff_software_key"];

// Keys cifradas en la base: al abrir una fila se piden descifradas al backend
const CAMPOS_CIFRADOS = ["kellerhoff_ecommerce_key", "kellerhoff_software_key"];

const CAMPOS_NO_EDITABLES = ["id", "creado_en", "fecha_ult_modificacion"];

// Grupos del formulario de alta (sucursal_codigo y drogueria van aparte, arriba)
const GRUPOS_ALTA = [
    { titulo: "Quantio", campos: ["quantio_usuario", "quantio_clave"] },
    { titulo: "Monroe", campos: ["monroe_cuenta", "monroe_ecommerce_key", "monroe_software_key"] },
    { titulo: "Cofarsur", campos: ["cofarsur_usuario", "cofarsur_clave", "cofarsur_token"] },
    { titulo: "Suizo", campos: ["suizo_usuario", "suizo_clave", "suizo_cliente"] },
    {
        titulo: "Kellerhoff - API nueva",
        ayuda: "Cuenta (referencia del cliente) y las dos keys. Se piden los tres datos juntos; las keys se guardan cifradas.",
        campos: CAMPOS_KELLERHOFF_NUEVA,
    },
    {
        titulo: "Kellerhoff - API vieja",
        ayuda: "Se mantienen por si hay que volver a la API vieja.",
        campos: ["kellerhof_usuario", "kellerhof_clave", "kellerhof_cliente"],
    },
];

// Para decidir si un campo es sensible (lo mostramos como password)
const isSecretField = (name) =>
    /(clave|key|token)/i.test(name);

// Campo de texto; los sensibles se ocultan y se pueden mostrar con el botón
const CampoCredencial = ({ campo, valor, onChange, disabled = false }) => {
    const [visible, setVisible] = useState(false);
    const secreto = isSecretField(campo);

    return (
        <div className="cred_input_group">
            <label>{campo.replace(/_/g, " ")}</label>
            <div className="cred_input_fila">
                <input
                    type={secreto && !visible ? "password" : "text"}
                    value={valor || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={secreto ? "••••••••" : ""}
                    autoComplete="new-password"
                    disabled={disabled}
                />
                {secreto && (
                    <button
                        type="button"
                        className="cred_ver_btn"
                        onClick={() => setVisible((v) => !v)}
                        disabled={disabled}
                    >
                        {visible ? "Ocultar" : "Ver"}
                    </button>
                )}
            </div>
        </div>
    );
};


const PanelCredenciales = () => {
    const [credenciales, setCredenciales] = useState([]);
    const [abierto, setAbierto] = useState(null);
    const [formData, setFormData] = useState({});
    const [nuevo, setNuevo] = useState(NUEVA_CRED_BASE);
    const [cargando, setCargando] = useState(false);
    // Estado del descifrado por fila: "cargando" | "ok" | "error" (sin entrada = todavía no se abrió)
    const [descifrado, setDescifrado] = useState({});
    // Valores tal como se cargaron (con las keys ya descifradas): al guardar solo se envía lo que cambió
    const originales = useRef({});
    const navigate = useNavigate();


    // La lista trae las keys de Kellerhoff cifradas: se descifran recién al abrir cada fila
    const cargarLista = async () => {
        const res = await fetch(`${API_URL}/api/credenciales`);
        const data = await res.json();
        setCredenciales(data);
        const inicial = {};
        const base = {};
        data.forEach((c) => {
            inicial[c.id] = { ...c };
            base[c.id] = { ...c };
        });
        setFormData(inicial);
        originales.current = base;
        setDescifrado({});
        setAbierto(null);
    };

    useEffect(() => {
        (async () => {
            setCargando(true);
            try {
                await cargarLista();
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

    // Reemplaza en el formulario y en los originales solo las keys cifradas: el resto puede tener ediciones sin guardar
    const aplicarClaves = (id, claves) => {
        originales.current[id] = { ...originales.current[id], ...claves };
        setFormData((prev) => ({ ...prev, [id]: { ...prev[id], ...claves } }));
    };

    const handleAbrir = async (id) => {
        if (abierto === id) {
            setAbierto(null);
            return;
        }
        setAbierto(id);
        if (descifrado[id]) return;

        setDescifrado((prev) => ({ ...prev, [id]: "cargando" }));
        try {
            const res = await fetch(`${API_URL}/api/credenciales/${id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const fila = await res.json();

            const claves = {};
            CAMPOS_CIFRADOS.forEach((k) => { claves[k] = fila[k] ?? ""; });
            aplicarClaves(id, claves);
            setDescifrado((prev) => ({ ...prev, [id]: fila._errorDescifrado ? "error" : "ok" }));
        } catch (e) {
            console.error("Error obteniendo las keys descifradas:", e);
            // Sin el valor descifrado los campos quedan vacíos (no se muestra el texto cifrado) y, sin cambios, no se envían
            const claves = {};
            CAMPOS_CIFRADOS.forEach((k) => { claves[k] = ""; });
            aplicarClaves(id, claves);
            setDescifrado((prev) => ({ ...prev, [id]: "error" }));
        }
    };

    const handleGuardar = async (id) => {
        try {
            const actual = formData[id] || {};
            const original = originales.current[id] || {};

            // Solo los campos que cambiaron: evita reenviar keys sin tocar
            const datosParaActualizar = {};
            Object.keys(actual).forEach((k) => {
                if (CAMPOS_NO_EDITABLES.includes(k)) return;
                if ((actual[k] ?? "") !== (original[k] ?? "")) datosParaActualizar[k] = actual[k] ?? "";
            });

            if (Object.keys(datosParaActualizar).length === 0) {
                alert("No hay cambios para guardar");
                return;
            }

            const res = await fetch(`${API_URL}/api/credenciales/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datosParaActualizar),
            });

            if (res.ok) {
                originales.current[id] = { ...actual };
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

        // Kellerhoff API nueva: o están los tres datos o ninguno (con uno solo la sucursal quedaría a medias)
        const cargadosKeller = CAMPOS_KELLERHOFF_NUEVA.filter((k) => nuevo[k]?.trim());
        if (cargadosKeller.length > 0 && cargadosKeller.length < CAMPOS_KELLERHOFF_NUEVA.length) {
            alert("Kellerhoff API nueva: completá cuenta, ecommerce key y software key, o dejá las tres vacías");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/credenciales`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...nuevo, kellerhoff_cuenta: nuevo.kellerhoff_cuenta.trim() }),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                alert("✅ Credencial creada");
                // Refrescar la grilla
                await cargarLista();
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

                    {/* Credenciales por proveedor (se llenan solo las que correspondan a la sucursal) */}
                    {GRUPOS_ALTA.map((grupo) => (
                        <div key={grupo.titulo} className="cred_grupo">
                            <h4 className="cred_grupo_titulo">{grupo.titulo}</h4>
                            {grupo.ayuda && <p className="cred_grupo_ayuda">{grupo.ayuda}</p>}
                            <div className="cred_grupo_campos">
                                {grupo.campos.map((campo) => (
                                    <CampoCredencial
                                        key={campo}
                                        campo={campo}
                                        valor={nuevo[campo]}
                                        onChange={(v) => setNuevo({ ...nuevo, [campo]: v })}
                                    />
                                ))}
                            </div>
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
                                onClick={() => handleAbrir(cred.id)}
                            >
                                {cred.sucursal_codigo} - {cred.drogueria}
                            </div>

                            {abierto === cred.id && (
                                <div className="accordion_body">
                                    <form className="cred_form">
                                        {Object.entries(formData[cred.id])
                                            .filter(([k]) => !CAMPOS_NO_EDITABLES.includes(k))
                                            .map(([campo, valor]) => (
                                                <CampoCredencial
                                                    key={campo}
                                                    campo={campo}
                                                    valor={valor}
                                                    onChange={(v) => handleChange(cred.id, campo, v)}
                                                    disabled={descifrado[cred.id] === "cargando" && CAMPOS_CIFRADOS.includes(campo)}
                                                />
                                            ))}

                                        {descifrado[cred.id] === "error" && (
                                            <p className="cred_aviso">
                                                No se pudieron descifrar las keys de Kellerhoff de esta sucursal. Los campos quedan
                                                vacíos: si cargás valores nuevos se guardan cifrados, y si los dejás vacíos no se modifican.
                                            </p>
                                        )}

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
