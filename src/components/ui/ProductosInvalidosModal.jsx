const ProductosInvalidosModal = ({ modalData, onClose }) => {
    const { isOpen, sucursal, productosInvalidos } = modalData;

    if (!isOpen) return null;

    // Agrupar productos por razón de invalidez
    const grupos = productosInvalidos.reduce((acc, producto) => {
        const razon = producto.razonInvalido || 'Razón desconocida';
        if (!acc[razon]) {
            acc[razon] = [];
        }
        acc[razon].push(producto);
        return acc;
    }, {});

    const totalProductos = productosInvalidos.length;
    const totalUnidades = productosInvalidos.reduce((sum, p) => sum + (p.unidades || 0), 0);

    return (
        <div className="modal_overlay" onClick={onClose}>
            <div className="resumen_zip_modal" onClick={e => e.stopPropagation()}>
                <div className="resumen_zip_header">
                    <h3>🚫 Productos inválidos eliminados - {sucursal}</h3>
                    <button
                        type="button"
                        className="modal_close_btn"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="resumen_info">
                    <p>
                        <strong>Total eliminados:</strong> {totalProductos} productos ({totalUnidades} unidades)
                    </p>
                    <p>
                        💡 Estos productos fueron eliminados automáticamente por tener códigos de barras inválidos.
                    </p>
                </div>

                <div className="resumen_tabla_container">
                    {Object.entries(grupos).length > 0 ? (
                        <>
                            {Object.entries(grupos).map(([razon, productos]) => (
                                <div key={razon} style={{ marginBottom: '20px' }}>
                                    <h4 style={{
                                        color: '#dc2626',
                                        marginBottom: '10px',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}>
                                        {razon} ({productos.length} productos)
                                    </h4>
                                    <table className="resumen_tabla">
                                        <thead>
                                            <tr>
                                                <th>EAN Original</th>
                                                <th>Nombre del Producto</th>
                                                <th>Unidades</th>
                                                <th>Razón</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productos.map((producto, index) => (
                                                <tr key={index}>
                                                    <td className="archivo_cell">
                                                        <span className="archivo_nombre" style={{ color: '#dc2626', fontFamily: 'monospace' }}>
                                                            {producto.eanOriginal || producto.ean || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="archivo_cell">
                                                        <span className="archivo_nombre">
                                                            {producto.nombre || producto.descripcion || 'Producto sin nombre'}
                                                        </span>
                                                    </td>
                                                    <td className="numero_cell">{producto.unidades || 0}</td>
                                                    <td className="estado_cell">
                                                        <span className="estado_badge" style={{
                                                            backgroundColor: '#fef2f2',
                                                            color: '#dc2626',
                                                            border: '1px solid #fecaca'
                                                        }}>
                                                            {producto.razonInvalido || 'Inválido'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="resumen_info">
                            <p>No hay productos inválidos para mostrar.</p>
                        </div>
                    )}
                </div>

                <div className="resumen_info" style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '12px'
                }}>
                    <p style={{ margin: 0, color: '#dc2626' }}>
                        ⚠️ <strong>Importante:</strong> Estos productos fueron eliminados para evitar errores en el procesamiento.
                        Verifique los códigos de barras en el archivo original y vuelva a subirlo si es necesario.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProductosInvalidosModal;