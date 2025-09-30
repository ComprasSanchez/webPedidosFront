import React, { useState } from 'react';
import './CrucePedidos.scss';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

const CrucePedidos = () => {
    const { usuario, authFetch } = useAuth();
    const [archivoTxts, setArchivoTxts] = useState(null);
    const [numerosPedidos, setNumerosPedidos] = useState('');
    const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split('T')[0]);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState(null);

    const cargarFaltantesEnCarrito = async () => {
        if (!resultado || !resultado.cruces) {
            setError('No hay datos para cargar al carrito');
            return;
        }

        setCargando(true);
        setError(null);

        try {
            // Extraer productos faltantes y no encontrados de todas las sucursales
            const productosFaltantes = [];

            resultado.cruces.forEach(archivo => {
                archivo.productos.forEach(producto => {
                    if (producto.estado === 'faltante' || producto.estado === 'no_encontrado') {
                        productosFaltantes.push({
                            codebar: producto.codebar,
                            descripcion: producto.descripcion,
                            cantidad: producto.cantidadSolicitada,
                            sucursal: archivo.sucursal,
                            estado: producto.estado,
                            motivo: producto.detalleFalta || 'No encontrado en Quantio'
                        });
                    }
                });
            });

            console.log(`🛒 Cargando ${productosFaltantes.length} productos faltantes al carrito...`);

            // Llamada al endpoint usando authFetch para incluir autorización
            const response = await authFetch(`${API_URL}/api/reposicion/cruce-pedidos/cargar-faltantes-carrito`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    productosFaltantes: productosFaltantes,
                    fechaProceso: fechaConsulta,
                    usuario: usuario?.usuario || 'cruce',
                    sucursal: usuario?.sucursal_codigo || 'todas'
                })
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                alert(`✅ ${data.productosAgregados || productosFaltantes.length} productos faltantes cargados al carrito exitosamente`);
            } else {
                throw new Error(data.error || 'Error desconocido al cargar productos');
            }

        } catch (err) {
            console.error('Error cargando al carrito:', err);
            setError('Error al cargar productos faltantes al carrito: ' + err.message);
        } finally {
            setCargando(false);
        }
    };

    const handleCrucePedidos = async () => {
        if (!archivoTxts) {
            setError('Se requiere el archivo ZIP con TXTs originales');
            return;
        }

        if (!numerosPedidos.trim()) {
            setError('Se requiere ingresar los números de pedidos');
            return;
        }

        setCargando(true);
        setError(null);
        setResultado(null);

        try {
            const formData = new FormData();
            formData.append('txtsOriginales', archivoTxts);

            // Convertir números de pedidos a array
            const listaPedidos = numerosPedidos
                .split(/[,\n\r]+/)
                .map(s => s.trim())
                .filter(Boolean);

            formData.append('numerosPedidos', JSON.stringify(listaPedidos));
            formData.append('fechaConsulta', fechaConsulta.replace(/-/g, ''));

            const response = await authFetch(`${API_URL}/api/reposicion/cruce-pedidos`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 Datos recibidos:', data);
            setResultado(data.data || data);

        } catch (err) {
            console.error('Error en cruce:', err);
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    const descargarReporte = () => {
        if (!resultado) return;

        const reporteDetallado = {
            ...resultado,
            productos_faltantes_detallado: resultado.detalles_por_sucursal
                .filter(s => s.productos_faltantes.length > 0)
                .map(s => ({
                    sucursal: s.sucursal,
                    archivo_txt: s.archivo_txt,
                    pedidos_numeros: s.pedidos_numeros,
                    productos_faltantes: s.productos_faltantes
                }))
        };

        const dataStr = JSON.stringify(reporteDetallado, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cruce-pedidos-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
    };

    return (
        <div className="cruce-pedidos">
            <div className="card">
                <div className="card-header">
                    <h2>🔄 Cruce de Pedidos - Consulta Directa Quantio</h2>
                    <p className="subtitle">
                        Compara TXTs originales vs Pedidos confirmados (consulta directa a Quantio)
                    </p>
                </div>

                <div className="card-body">
                    <div className="inputs-section">
                        <div className="archivo-input">
                            <label>
                                <strong>1. TXTs Originales (ZIP)</strong>
                                <p className="help-text">ZIP con los archivos TXT originales de cada sucursal</p>
                            </label>
                            <input
                                type="file"
                                accept=".zip"
                                onChange={(e) => setArchivoTxts(e.target.files[0])}
                            />
                            {archivoTxts && (
                                <span className="archivo-seleccionado">✅ {archivoTxts.name}</span>
                            )}
                        </div>

                        <div className="pedidos-input">
                            <label>
                                <strong>2. Números de Pedidos</strong>
                                <p className="help-text">Lista de números de pedidos generados (uno por línea o separados por comas)</p>
                            </label>
                            <textarea
                                value={numerosPedidos}
                                onChange={(e) => setNumerosPedidos(e.target.value)}
                                placeholder="887416, 887417, 887418&#10;887419&#10;887420"
                                rows={6}
                            />
                            {numerosPedidos.trim() && (
                                <span className="pedidos-count">
                                    📋 {numerosPedidos.split(/[,\n\r]+/).filter(s => s.trim()).length} pedidos ingresados
                                </span>
                            )}
                        </div>

                        <div className="fecha-input">
                            <label>
                                <strong>3. Fecha de Consulta</strong>
                                <p className="help-text">Fecha para consultar pedidos en Quantio (formato YYYY-MM-DD)</p>
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
                            onClick={handleCrucePedidos}
                            disabled={cargando || !archivoTxts || !numerosPedidos.trim()}
                        >
                            {cargando ? '🔄 Consultando Quantio...' : '🚀 Hacer Cruce con Quantio'}
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
                                <h3>📊 Resultados del Cruce (Consulta Quantio)</h3>
                                <button className="btn btn-secondary" onClick={descargarReporte}>
                                    📥 Descargar Reporte Completo
                                </button>
                            </div>

                            <div className="resumen-global">
                                <div className="stat-card">
                                    <span className="stat-number">{resultado.cruces?.length || 0}</span>
                                    <span className="stat-label">Sucursales</span>
                                </div>
                                <div className="stat-card success">
                                    <span className="stat-number">{resultado.resumen?.totalProductosConfirmados || 0}</span>
                                    <span className="stat-label">Confirmados</span>
                                </div>
                                <div className="stat-card alert">
                                    <span className="stat-number">{resultado.resumen?.totalProductosFaltantes || 0}</span>
                                    <span className="stat-label">Faltantes</span>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-number">{resultado.resumen?.porcentajeEntrega || '0'}%</span>
                                    <span className="stat-label">% Entrega</span>
                                </div>
                            </div>

                            <div className="acciones-rapidas">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => cargarFaltantesEnCarrito()}
                                    disabled={!resultado.cruces || resultado.cruces.length === 0}
                                >
                                    🛒 Cargar Faltantes al Carrito
                                </button>
                            </div>

                            <div className="detalles-sucursales">
                                <h4>📋 Detalles por Sucursal</h4>
                                {resultado.cruces
                                    ?.filter(archivo => archivo.productos.some(p => p.estado !== 'confirmado'))
                                    .map(archivo => {
                                        const confirmados = archivo.productos.filter(p => p.estado === 'confirmado').length;
                                        const faltantes = archivo.productos.filter(p => p.estado === 'faltante').length;
                                        const noEncontrados = archivo.productos.filter(p => p.estado === 'no_encontrado').length;

                                        return (
                                            <div key={archivo.archivo} className="sucursal-detalle">
                                                <div className="sucursal-header">
                                                    <h5>{archivo.sucursal}</h5>
                                                    <div className="archivo-info">
                                                        <span className="archivo">{archivo.archivo}</span>
                                                    </div>
                                                </div>

                                                <div className="resumen-sucursal">
                                                    <span>Total: {archivo.productos.length}</span>
                                                    <span className="confirmados">Confirmados: {confirmados}</span>
                                                    <span className="faltantes">Faltantes: {faltantes}</span>
                                                    <span className="no-encontrados">No encontrados: {noEncontrados}</span>
                                                </div>

                                                <div className="productos-faltantes">
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>EAN</th>
                                                                <th>Descripción</th>
                                                                <th>Solicitado</th>
                                                                <th>Confirmado</th>
                                                                <th>Estado</th>
                                                                <th>Motivo</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {archivo.productos
                                                                .filter(p => p.estado !== 'confirmado')
                                                                .map((producto, idx) => (
                                                                    <tr key={idx} className={producto.estado}>
                                                                        <td>{producto.codebar}</td>
                                                                        <td>{producto.descripcion}</td>
                                                                        <td>{producto.cantidadSolicitada}</td>
                                                                        <td>{producto.cantidadConfirmada || 0}</td>
                                                                        <td>
                                                                            <span className={`estado ${producto.estado}`}>
                                                                                {producto.estado === 'faltante' ? '❌ Faltante' : '❓ No encontrado'}
                                                                            </span>
                                                                        </td>
                                                                        <td>{producto.detalleFalta || 'No encontrado en Quantio'}</td>
                                                                    </tr>
                                                                ))
                                                            }
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrucePedidos;