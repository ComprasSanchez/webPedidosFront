import React, { useState } from 'react';
import './CrucePedidos.scss';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

const CrucePedidos = () => {
    const { usuario, authFetch } = useAuth();
    const [archivoTxt, setArchivoTxt] = useState(null);
    const [numeroPedido, setNumeroPedido] = useState('');
    const [sucursal, setSucursal] = useState(usuario?.sucursal_codigo || 'SA2'); // Default SA2
    const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split('T')[0]);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState(null);

    const handleGenerarTxtActualizado = async () => {
        if (!archivoTxt) {
            setError('Se requiere el archivo TXT original');
            return;
        }

        if (!numeroPedido.trim()) {
            setError('Se requiere ingresar el número de pedido');
            return;
        }

        setCargando(true);
        setError(null);
        setResultado(null);

        try {
            const formData = new FormData();
            formData.append('archivoTxt', archivoTxt);
            formData.append('numeroPedido', numeroPedido.trim());
            formData.append('sucursal', sucursal);
            formData.append('fechaConsulta', fechaConsulta.replace(/-/g, ''));

            const response = await authFetch(`${API_URL}/api/reposicion/generar-txt-actualizado`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            // Procesar datos del cruce de pedidos
            setResultado(data.data || data);

        } catch (err) {
            console.error('Error en procesamiento:', err);
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    const descargarTxtActualizado = () => {
        if (!resultado || !resultado.contenidoTxtActualizado) return;

        const contenido = resultado.contenidoTxtActualizado;
        const dataBlob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;

        // Generar nombre del archivo basado en el original
        const nombreOriginal = archivoTxt?.name?.replace('.txt', '') || 'faltantes';
        const fecha = new Date().toISOString().split('T')[0];
        link.download = `${nombreOriginal}_actualizado_${fecha}.txt`;

        link.click();
        URL.revokeObjectURL(url);
    };

    const descargarReporte = () => {
        if (!resultado) return;

        const dataStr = JSON.stringify(resultado, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte-actualizacion-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
    };

    return (
        <div className="cruce-pedidos">
            <div className="card">
                <div className="card-header">
                    <h2>🔄 Generador de TXT Actualizado</h2>
                    <p className="subtitle">
                        Resta las unidades ya pedidas del TXT original y genera uno nuevo con el stock restante
                    </p>
                </div>

                <div className="card-body">
                    <div className="inputs-section">
                        <div className="archivo-input">
                            <label>
                                <strong>1. Archivo TXT Original</strong>
                                <p className="help-text">Archivo TXT original con los productos solicitados</p>
                            </label>
                            <input
                                type="file"
                                accept=".txt"
                                onChange={(e) => setArchivoTxt(e.target.files[0])}
                            />
                            {archivoTxt && (
                                <span className="archivo-seleccionado">✅ {archivoTxt.name}</span>
                            )}
                        </div>

                        <div className="pedido-input">
                            <label>
                                <strong>2. Número de Pedido</strong>
                                <p className="help-text">Número de pedido generado al depósito</p>
                            </label>
                            <input
                                type="text"
                                value={numeroPedido}
                                onChange={(e) => setNumeroPedido(e.target.value)}
                                placeholder="Ej: 888191"
                            />
                        </div>

                        <div className="sucursal-input">
                            <label>
                                <strong>3. Sucursal</strong>
                                <p className="help-text">Sucursal que realizó el pedido</p>
                            </label>
                            <select
                                value={sucursal}
                                onChange={(e) => setSucursal(e.target.value)}
                            >
                                <option value="SA1">SA1 - Sucursal 1</option>
                                <option value="SA2">SA2 - Sucursal 2</option>
                                <option value="SA3">SA3 - Sucursal 3</option>
                                <option value="SA4">SA4 - Sucursal 4</option>
                                <option value="SA5">SA5 - Sucursal 5</option>
                                <option value="SA6">SA6 - Sucursal 6</option>
                                <option value="SA7">SA7 - Sucursal 7</option>
                                <option value="SA8">SA8 - Sucursal 8</option>
                                <option value="SA9">SA9 - Sucursal 9</option>
                                <option value="SA10">SA10 - Sucursal 10</option>
                                <option value="SA11">SA11 - Sucursal 11</option>
                                <option value="SA12">SA12 - Sucursal 12</option>
                                <option value="SA14">SA14 - Sucursal 14</option>
                                <option value="SA15">SA15 - Sucursal 15</option>
                                <option value="SA16">SA16 - Sucursal 16</option>
                                <option value="SA17">SA17 - Sucursal 17</option>
                                <option value="SA18">SA18 - Sucursal 18</option>
                                <option value="SA19">SA19 - Sucursal 19</option>
                                <option value="SA20">SA20 - Sucursal 20</option>
                                <option value="SA21">SA21 - Sucursal 21</option>
                                <option value="SA22">SA22 - Sucursal 22</option>
                                <option value="SA23">SA23 - Sucursal 23</option>
                                <option value="SA24">SA24 - Sucursal 24</option>
                                <option value="SA25">SA25 - Sucursal 25</option>
                                <option value="SA26">SA26 - Sucursal 26</option>
                                <option value="SA27">SA27 - Sucursal 27</option>
                                <option value="SA28">SA28 - Sucursal 28</option>
                                <option value="SA29">SA29 - Sucursal 29</option>
                                <option value="SA30">SA30 - Sucursal 30</option>
                                <option value="SA31">SA31 - Sucursal 31</option>
                            </select>
                        </div>

                        <div className="fecha-input">
                            <label>
                                <strong>4. Fecha de Consulta</strong>
                                <p className="help-text">Fecha para consultar el pedido en Quantio</p>
                            </label>
                            <input
                                type="date"
                                value={fechaConsulta}
                                onChange={(e) => setFechaConsulta(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="acciones">
                        <button
                            className="btn btn-primary"
                            onClick={handleGenerarTxtActualizado}
                            disabled={cargando || !archivoTxt || !numeroPedido.trim() || !sucursal}
                        >
                            {cargando ? '🔄 Procesando...' : '� Generar TXT Actualizado'}
                        </button>
                    </div>

                    {error && (
                        <div className="alert alert-error">
                            ❌ Error: {error}
                        </div>
                    )}

                    {resultado && (
                        <div className="resultados">
                            <div className="resultados-header">
                                <h3>📊 Resultado del Procesamiento</h3>
                                <div className="acciones-descarga">
                                    <button
                                        className="btn btn-success"
                                        onClick={descargarTxtActualizado}
                                        disabled={!resultado.contenidoTxtActualizado}
                                    >
                                        📥 Descargar TXT Actualizado
                                    </button>
                                    <button className="btn btn-secondary" onClick={descargarReporte}>
                                        📄 Descargar Reporte JSON
                                    </button>
                                </div>
                            </div>

                            <div className="resumen-global">
                                <div className="stat-card">
                                    <span className="stat-number">{resultado.productosOriginales || 0}</span>
                                    <span className="stat-label">Productos Originales</span>
                                </div>
                                <div className="stat-card alert">
                                    <span className="stat-number">{resultado.productosPedidos || 0}</span>
                                    <span className="stat-label">Ya Pedidos</span>
                                </div>
                                <div className="stat-card success">
                                    <span className="stat-number">{resultado.productosRestantes || 0}</span>
                                    <span className="stat-label">Restantes</span>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-number">{resultado.porcentajePedido || '0'}%</span>
                                    <span className="stat-label">% Pedido</span>
                                </div>
                            </div>

                            {resultado.detalles && resultado.detalles.length > 0 && (
                                <div className="detalles-productos">
                                    <h4>📋 Detalle de Productos Procesados</h4>
                                    <div className="productos-tabla">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>EAN</th>
                                                    <th>Descripción</th>
                                                    <th>Cantidad Original</th>
                                                    <th>Cantidad Pedida</th>
                                                    <th>Cantidad Restante</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {resultado.detalles.map((producto, idx) => (
                                                    <tr key={idx} className={producto.cantidadRestante > 0 ? 'restante' : 'agotado'}>
                                                        <td>{producto.codebar}</td>
                                                        <td>{producto.descripcion}</td>
                                                        <td>{producto.cantidadOriginal}</td>
                                                        <td>{producto.cantidadPedida}</td>
                                                        <td>{producto.cantidadRestante}</td>
                                                        <td>
                                                            <span className={`estado ${producto.cantidadRestante > 0 ? 'restante' : 'agotado'}`}>
                                                                {producto.cantidadRestante > 0 ? '✅ Disponible' : '❌ Agotado'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {resultado.advertencias && resultado.advertencias.length > 0 && (
                                <div className="advertencias">
                                    <h4>⚠️ Advertencias</h4>
                                    <ul>
                                        {resultado.advertencias.map((adv, idx) => (
                                            <li key={idx}>{adv}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrucePedidos;