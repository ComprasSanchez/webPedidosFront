// src/features/revisar/ResumenPedidoModal.jsx

import React from "react";

const ResumenPedidoModal = ({ resumen, onClose, onEnviar }) => {
    if (!resumen || Object.keys(resumen).length === 0) return null;

    const proveedores = Object.entries(resumen).map(([proveedor, items]) => {
        if (!Array.isArray(items)) {
            console.warn(`⚠️ El resumen de ${proveedor} no es un array:`, items);
            return null;
        }

        const totalUnidades = items.reduce((sum, item) => sum + item.unidades, 0);
        const totalMonto = items.reduce((sum, item) => sum + (item.precio * item.unidades), 0);

        return {
            proveedor,
            totalUnidades,
            totalMonto,
        };
    }).filter(Boolean);

    return (
        <div className="resumen_modal_overlay">
            <div className="resumen_modal">
                <h2>Resumen de pedido</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Proveedor</th>
                            <th>Unidades</th>
                            <th>Total $</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proveedores.map((prov) => (
                            <tr key={prov.proveedor}>
                                <td>{prov.proveedor.toUpperCase()}</td>
                                <td>{prov.totalUnidades}</td>
                                <td>$ {prov.totalMonto.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="resumen_modal_button">
                    <button onClick={onClose} className="resumen_modal_button_cerrar">Cerrar</button>
                    <button onClick={onEnviar} className="resumen_modal_button_enviar">Enviar pedido</button>
                </div>

            </div>
        </div>
    );
};

export default ResumenPedidoModal;