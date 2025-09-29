import { useState } from "react";
import DuplicadosModal from "./DuplicadosModal";
import ProductosInvalidosModal from "./ProductosInvalidosModal";
import "../../components/ui/ResumenZip.scss";

const CarritoBulk = ({ carritosBulk, totalSucursales, totalProductos, totalUnidades }) => {
    const [modalDuplicados, setModalDuplicados] = useState({ isOpen: false, sucursal: null, duplicados: [] });
    const [modalInvalidos, setModalInvalidos] = useState({ isOpen: false, sucursal: null, productosInvalidos: [] });

    const handleCloseDuplicadosModal = () => {
        setModalDuplicados({ isOpen: false, sucursal: null, duplicados: [] });
    };

    const handleCloseInvalidosModal = () => {
        setModalInvalidos({ isOpen: false, sucursal: null, productosInvalidos: [] });
    };

    return (
        <div className="resumen_bulk_container">
            <h3>📦 Carga Masiva - Resumen por Sucursales</h3>

            {/* Totales generales */}
            <div className="resumen_totales">
                <div className="total_card">
                    <span className="total_number">{totalSucursales}</span>
                    <span className="total_label">Sucursales</span>
                </div>
                <div className="total_card">
                    <span className="total_number">{totalProductos.toLocaleString()}</span>
                    <span className="total_label">Productos</span>
                </div>
                <div className="total_card">
                    <span className="total_number">{totalUnidades.toLocaleString()}</span>
                    <span className="total_label">Unidades</span>
                </div>
            </div>

            {/* Tabla de sucursales */}
            <div className="resumen_tabla_container">
                <table className="resumen_tabla">
                    <thead>
                        <tr>
                            <th>Sucursal</th>
                            <th>Archivo</th>
                            <th>Productos</th>
                            <th>Unidades</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(carritosBulk).map(([sucursal, items]) => {
                            const productos = items.length;
                            const unidades = items.reduce((sum, item) => sum + (item.unidades || 0), 0);
                            const nombreArchivo = items[0]?.archivo_origen || 'N/A';

                            // Obtener información de duplicados, productos inválidos y números de pedidos
                            const metadatos = JSON.parse(sessionStorage.getItem('metadatosBulk') || '{}');
                            const duplicados = metadatos[sucursal]?.duplicados || 0;
                            const detallesDuplicados = metadatos[sucursal]?.detallesDuplicados || [];
                            const productosInvalidos = metadatos[sucursal]?.productosInvalidos || 0;
                            const detallesInvalidos = metadatos[sucursal]?.detallesInvalidos || [];
                            const nroPedidoDeposito = metadatos[sucursal]?.nroPedidoDeposito;
                            const nrosPedidosDeposito = metadatos[sucursal]?.nrosPedidosDeposito || [];

                            const handleClickDuplicados = () => {
                                setModalDuplicados({
                                    isOpen: true,
                                    sucursal: sucursal,
                                    duplicados: detallesDuplicados
                                });
                            };

                            const handleClickInvalidos = () => {
                                setModalInvalidos({
                                    isOpen: true,
                                    sucursal: sucursal,
                                    productosInvalidos: detallesInvalidos
                                });
                            };

                            return (
                                <tr key={sucursal}>
                                    <td className="sucursal_cell">
                                        <span className="sucursal_badge">{sucursal}</span>
                                    </td>
                                    <td className="archivo_cell">
                                        <span className="archivo_nombre">{nombreArchivo}</span>
                                        {productosInvalidos > 0 && (
                                            <span
                                                className="duplicados_badge"
                                                title={`${productosInvalidos} productos inválidos eliminados - Click para ver detalles`}
                                                onClick={handleClickInvalidos}
                                                style={{
                                                    cursor: 'pointer',
                                                    backgroundColor: '#fef2f2',
                                                    color: '#dc2626',
                                                    border: '1px solid #fecaca',
                                                    marginLeft: '4px'
                                                }}
                                            >
                                                🚫 {productosInvalidos}
                                            </span>
                                        )}
                                        {duplicados > 0 && (
                                            <span
                                                className="duplicados_badge"
                                                title={`${duplicados} productos duplicados consolidados - Click para ver detalles`}
                                                onClick={handleClickDuplicados}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                📋 {duplicados}
                                            </span>
                                        )}
                                    </td>
                                    <td className="numero_cell">{productos}</td>
                                    <td className="numero_cell">{unidades}</td>
                                    <td className="estado_cell">
                                        {nrosPedidosDeposito.length > 0 ? (
                                            <div className="pedidos_container">
                                                {nrosPedidosDeposito.map((numeroPedido, index) => (
                                                    <span
                                                        key={index}
                                                        className="estado_badge estado_pedido"
                                                        title={`Pedido generado: ${numeroPedido}`}
                                                        style={{
                                                            marginRight: index < nrosPedidosDeposito.length - 1 ? '4px' : '0',
                                                            marginBottom: '2px',
                                                            display: 'inline-block'
                                                        }}
                                                    >
                                                        📋 {numeroPedido}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="estado_badge estado_sin_pedido" title="No se generó pedido (sin stock)">
                                                ⚠️ Sin pedido
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="resumen_info">
                <p>
                    💡 <strong>Solo depósito:</strong> Todos los pedidos se procesarán únicamente desde el depósito propio.
                </p>
            </div>

            {/* Modal de duplicados */}
            <DuplicadosModal
                modalData={modalDuplicados}
                onClose={handleCloseDuplicadosModal}
            />

            {/* Modal de productos inválidos */}
            <ProductosInvalidosModal
                modalData={modalInvalidos}
                onClose={handleCloseInvalidosModal}
            />
        </div>
    );
};

export default CarritoBulk;