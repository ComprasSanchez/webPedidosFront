// src/features/revisar/ResumenPedidoModal.jsx
import React from "react";

const ResumenPedidoModal = ({ resumen, onClose, onEnviar, isSending, sucursalActual }) => {
    if (!resumen || Object.keys(resumen).length === 0) return null;

    // 💰 Formateador de montos estilo argentino (puntos para miles, comas para decimales)
    const formatearMonto = (monto) => {
        return monto.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // 📋 Función para generar Excel de Kellerhoff
    const generarExcelKellerhoff = async (productosKeller) => {
        try {
            // 🔍 LOG: Información inicial
            console.log('🚀 FRONTEND: Iniciando descarga de Excel Kellerhoff');

            // Preparar datos en el formato que espera el backend
            const datosKeller = productosKeller.map(item => ({
                codebar: item.ean || item.codebar,
                cantidad: item.unidades
            }));

            // Usar la sucursal actual pasada como prop (más confiable que sessionStorage)
            const sucursalId = sucursalActual || sessionStorage.getItem("sucursalReponer") || "0";

            // 🔍 LOG: Datos que se envían
            console.log('📤 FRONTEND: Enviando al backend:', {
                cantidadProductos: datosKeller.length,
                sucursalId: sucursalId,
                sucursalProp: sucursalActual,
                sessionStorage: sessionStorage.getItem("sucursalReponer")
            });            // Crear un "pseudo-archivo" con los datos de Keller
            const excelData = {
                productos: datosKeller,
                sucursalId: sucursalId
            };

            // Importar API_URL para usar la URL correcta del backend
            const { API_URL } = await import('../../config/api.js');

            const response = await fetch(`${API_URL}/api/generar-excel-keller`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(excelData)
            });

            if (!response.ok) {
                throw new Error('Error al generar el Excel de Kellerhoff');
            }

            // Descargar el archivo - usar sucursal de prop (más confiable)
            const blob = await response.blob();

            // Usar la sucursal actual de prop (ya sincronizada)
            const sucursalParaArchivo = sucursalActual || sessionStorage.getItem("sucursalReponer") || "0";
            const fileName = `Pedido_Keller_${sucursalParaArchivo}.xlsx`;

            // 🔍 LOG: Información de descarga
            console.log('📥 FRONTEND: Preparando descarga:', {
                sucursalProp: sucursalActual,
                sucursalParaArchivo: sucursalParaArchivo,
                fileName: fileName,
                sessionStorageActual: sessionStorage.getItem("sucursalReponer"),
                blobSize: blob.size
            });

            // Crear URL único para evitar caché (sin cambiar el nombre del archivo)
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url + '?t=' + Date.now(); // Timestamp en la URL, no en el nombre
            a.download = fileName;

            // 🔍 LOG: Elemento de descarga creado
            console.log('🔗 FRONTEND: Elemento <a> creado:', {
                href: a.href,
                download: a.download,
                fileName: fileName
            });

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log(`✅ FRONTEND: Descarga iniciada con nombre: ${fileName}`);

        } catch (error) {
            console.error('Error generando Excel de Kellerhoff:', error);
            alert('Error al generar el archivo Excel de Kellerhoff');
        }
    };

    const proveedores = Object.entries(resumen).map(([proveedor, items]) => {
        if (!Array.isArray(items)) {
            console.warn(`⚠️ El resumen de ${proveedor} no es un array:`, items);
            return null;
        }

        const totalUnidades = items.reduce((sum, item) => sum + item.unidades, 0);
        const totalMonto = items.reduce((sum, item) => sum + (item.precio * item.unidades), 0);

        return { proveedor, totalUnidades, totalMonto, items };
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
                                <td>
                                    {prov.proveedor.toUpperCase()}
                                    {prov.proveedor.toLowerCase() === 'kellerhoff' && (
                                        <span
                                            className="keller_excel_badge"
                                            title={`Generar Excel para Kellerhoff con ${prov.totalUnidades} productos - Click para descargar`}
                                            onClick={() => generarExcelKellerhoff(prov.items)}
                                            style={{ cursor: 'pointer', marginLeft: '8px' }}
                                        >
                                            📊 Excel
                                        </span>
                                    )}
                                </td>
                                <td>{prov.totalUnidades}</td>
                                <td>$ {formatearMonto(prov.totalMonto)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="resumen_modal_button">
                    <button onClick={onClose} className="resumen_modal_button_cerrar">Cerrar</button>
                    <button
                        onClick={onEnviar}
                        className="resumen_modal_button_enviar"
                        disabled={isSending}
                        style={{
                            opacity: isSending ? 0.6 : 1,
                            cursor: isSending ? "not-allowed" : "pointer"
                        }}
                    >
                        {isSending ? "..." : "Enviar pedido"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResumenPedidoModal;