import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './FaltantesDeposito.scss';

const FaltantesDeposito = () => {
    const { usuario, authFetch } = useAuth();
    const [datosTabla, setDatosTabla] = useState('');
    const [sucursal, setSucursal] = useState(usuario?.sucursal_codigo || '');
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState(null);

    const handleProcesarFaltantes = async () => {
        if (!datosTabla.trim()) {
            setError('Se requiere pegar los datos de faltantes del depósito');
            return;
        }

        if (!sucursal.trim()) {
            setError('Se requiere especificar la sucursal');
            return;
        }

        setCargando(true);
        setError(null);
        setResultado(null);

        try {
            setSyncing(true);

            const response = await authFetch(`${API_URL}/api/reposicion/procesar-faltantes-deposito`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    datosTabla: datosTabla,
                    sucursal: sucursal
                })
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            // Faltantes procesados
            setResultado(data);

        } catch (err) {
            console.error('❌ Error procesando faltantes:', err);
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    const limpiarFormulario = () => {
        setDatosTabla('');
        setResultado(null);
        setError(null);
    };

    return (
        <div className="faltantes-deposito">
            <div className="header">
                <h2>🏭 Procesar Faltantes del Depósito</h2>
                <p className="descripcion">
                    Pega aquí los datos de faltantes del depósito y se procesarán como un pedido TXT normal
                </p>
            </div>

            <div className="formulario">
                <div className="campo-sucursal">
                    <label htmlFor="sucursal">Sucursal:</label>
                    <input
                        id="sucursal"
                        type="text"
                        value={sucursal}
                        onChange={(e) => setSucursal(e.target.value)}
                        placeholder="ej: SA01, SA02..."
                        disabled={cargando}
                    />
                </div>

                <div className="campo-datos">
                    <label htmlFor="datosTabla">
                        Datos de Faltantes (pegar desde la tabla de Quantio):
                    </label>
                    <textarea
                        id="datosTabla"
                        value={datosTabla}
                        onChange={(e) => setDatosTabla(e.target.value)}
                        placeholder={`Pega aquí los datos de faltantes. Ejemplo:
7501033961625	PEDIALYTE MANZANA botella x 500 ml	Cantidad insuficiente	1	1
7790440408117	ISOPTINO MD 240 mg comp. rec.x 30	Cantidad insuficiente	1	1
...`}
                        rows={12}
                        disabled={cargando}
                    />
                    <small className="ayuda">
                        💡 Copia y pega directamente desde la tabla de faltantes de Quantio
                    </small>
                </div>

                <div className="acciones">
                    <button
                        type="button"
                        onClick={handleProcesarFaltantes}
                        disabled={cargando || !datosTabla.trim() || !sucursal.trim()}
                        className="btn-procesar"
                    >
                        {cargando ? '🔄 Procesando...' : '🚀 Procesar Faltantes'}
                    </button>

                    <button
                        type="button"
                        onClick={limpiarFormulario}
                        disabled={cargando}
                        className="btn-limpiar"
                    >
                        🗑️ Limpiar
                    </button>
                </div>
            </div>

            {error && (
                <div className="error">
                    <h4>❌ Error</h4>
                    <p>{error}</p>
                </div>
            )}

            {resultado && (
                <div className="resultado">
                    <h3>✅ Faltantes Procesados Exitosamente</h3>

                    <div className="resumen">
                        <div className="stat">
                            <span className="label">📋 Productos Procesados:</span>
                            <span className="valor">{resultado.productos_procesados}</span>
                        </div>
                        <div className="stat">
                            <span className="label">✅ Productos Válidos:</span>
                            <span className="valor">{resultado.productos_validos}</span>
                        </div>
                        <div className="stat">
                            <span className="label">❌ Productos Inválidos:</span>
                            <span className="valor">{resultado.productos_invalidos}</span>
                        </div>
                        <div className="stat">
                            <span className="label">🛒 Agregados al Carrito:</span>
                            <span className="valor">{resultado.productos_agregados}</span>
                        </div>
                        <div className="stat">
                            <span className="label">📊 Total en Carrito:</span>
                            <span className="valor">{resultado.total_en_carrito} productos</span>
                        </div>
                        <div className="stat">
                            <span className="label">🏪 Sucursal:</span>
                            <span className="valor">{resultado.sucursal}</span>
                        </div>
                        <div className="stat">
                            <span className="label">🔑 Carrito Key:</span>
                            <span className="valor carrito-key">{resultado.carrito_key}</span>
                        </div>
                    </div>

                    <div className="acciones-resultado">
                        <button
                            type="button"
                            onClick={() => window.location.href = '/carrito'}
                            className="btn-ver-carrito"
                        >
                            🛒 Ver Carrito
                        </button>

                        <button
                            type="button"
                            onClick={limpiarFormulario}
                            className="btn-procesar-mas"
                        >
                            ➕ Procesar Más Faltantes
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FaltantesDeposito;