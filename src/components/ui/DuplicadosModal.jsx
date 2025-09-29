const DuplicadosModal = ({ modalData, onClose }) => {
    const { isOpen, sucursal, duplicados } = modalData;

    if (!isOpen) return null;

    return (
        <div className="modal_overlay" onClick={onClose}>
            <div className="resumen_zip_modal" onClick={e => e.stopPropagation()}>
                <div className="resumen_zip_header">
                    <h3>📋 Duplicados consolidados - {sucursal}</h3>
                    <button
                        type="button"
                        className="modal_close_btn"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="resumen_tabla_container">
                    {duplicados.length > 0 ? (
                        <table className="resumen_tabla">
                            <thead>
                                <tr>
                                    <th>EAN</th>
                                    <th>Nombre del Producto</th>
                                    <th>Cantidad Original</th>
                                    <th>Cantidad Consolidada</th>
                                    <th>Diferencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {duplicados.map((dup, index) => (
                                    <tr key={index}>
                                        <td className="archivo_cell">
                                            <span className="archivo_nombre" style={{ fontFamily: 'monospace' }}>
                                                {dup.ean}
                                            </span>
                                        </td>
                                        <td className="archivo_cell">
                                            <span className="archivo_nombre">
                                                {dup.nombre || `Producto ${dup.ean}`}
                                            </span>
                                        </td>
                                        <td className="numero_cell">{dup.cantidadOriginal}</td>
                                        <td className="numero_cell">{dup.cantidadConsolidada}</td>
                                        <td className="numero_cell">
                                            <span style={{ color: '#059669', fontWeight: 'bold' }}>
                                                +{dup.cantidadConsolidada - dup.cantidadOriginal}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="resumen_info">
                            <p>No hay detalles de duplicados disponibles para esta sucursal.</p>
                        </div>
                    )}
                </div>

                <div className="resumen_info">
                    <p>
                        💡 Los productos duplicados fueron consolidados automáticamente sumando las cantidades.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DuplicadosModal;