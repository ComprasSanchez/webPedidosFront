// src/features/revisar/ResumenPedidoModal.jsx
import React, { useState } from "react";
import { API_URL } from "../../config/api";

const ResumenPedidoModal = ({ resumen, onClose, onEnviar, isSending, sucursalActual, authFetch }) => {
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
            // Preparar datos en el formato que espera el backend
            const datos = productosKeller.map(item => ({
                codebar: item.ean || item.codebar,
                cantidad: item.unidades
            }));

            // Usar la sucursal actual pasada como prop (más confiable que sessionStorage)
            const sucursalId = sucursalActual || sessionStorage.getItem("sucursalReponer") || "0";

            // Crear un "pseudo-archivo" con los datos de Keller
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

            // Descargar el archivo
            const blob = await response.blob();

            // Verificar que el blob no esté vacío
            if (blob.size === 0) {
                throw new Error('El archivo recibido está vacío');
            }

            // Usar la sucursal actual de prop (ya sincronizada)
            const sucursalParaArchivo = sucursalActual || sessionStorage.getItem("sucursalReponer") || "0";
            const fileName = `Pedido_Keller_${sucursalParaArchivo}.xlsx`;

            // Crear descarga
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';

            // Ejecutar descarga
            document.body.appendChild(a);
            a.click();

            // Limpiar recursos
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);

        } catch (error) {
            console.error('Error generando Excel de Kellerhoff:', error);
            alert('Error al generar el archivo Excel de Kellerhoff');
        }
    };

    // 📋 Función para generar TXT de Suiza Tuc
    const generarExcelSuizaTuc = async (productosSuizaTuc) => {
        try {
            // Preparar datos en el formato que espera el backend
            const productos = productosSuizaTuc.map(item => ({
                cantidad: item.unidades,
                codebar: item.ean
            }));

            console.log('📋 Enviando productos a Suiza Tucumán:', productos);

            const response = await authFetch(`${API_URL}/api/generar-txt-suiza`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productos })
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // Obtener el archivo como blob (datos binarios)
            const blob = await response.blob();

            // Verificar que el archivo no esté vacío
            if (blob.size === 0) {
                throw new Error('El archivo recibido está vacío');
            }

            // Usar la sucursal actual para el nombre del archivo
            const sucursalParaArchivo = sucursalActual || sessionStorage.getItem("sucursalReponer") || "0";
            const fileName = `Pedido_Suiza_Tucuman_${sucursalParaArchivo}.txt`;

            // Crear descarga automática
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';

            // Ejecutar descarga
            document.body.appendChild(a);
            a.click();

            // Limpiar recursos para evitar memory leaks
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);

            console.log('✅ Archivo de Suiza Tucumán generado exitosamente:', fileName);

        } catch (error) {
            console.error('❌ Error generando TXT de Suiza Tucumán:', error);
            alert(`Error al generar el archivo de Suiza Tucumán: ${error.message}`);
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

    // Estado para seleccionar qué proveedores enviar (todos seleccionados por defecto)
    const [seleccionados, setSeleccionados] = useState(() =>
        Object.fromEntries(proveedores.map(p => [p.proveedor, true]))
    );

    const toggleProveedor = (prov) => {
        setSeleccionados(prev => ({ ...prev, [prov]: !prev[prov] }));
    };

    const haySeleccionados = Object.values(seleccionados).some(Boolean);

    return (
        <div className="resumen_modal_overlay">
            <div className="resumen_modal">
                <h2>Resumen de pedido</h2>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '30px' }}></th>
                            <th>Proveedor</th>
                            <th>Unidades</th>
                            <th>Total $</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proveedores.map((prov) => (
                            <tr key={prov.proveedor} style={{ opacity: seleccionados[prov.proveedor] ? 1 : 0.4 }}>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={!!seleccionados[prov.proveedor]}
                                        onChange={() => toggleProveedor(prov.proveedor)}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                </td>
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
                                    {prov.proveedor === 'suizaTuc' && (
                                        <span
                                            className="keller_excel_badge"
                                            title={`Generar archivo TXT para Suiza Tucumán con ${prov.totalUnidades} productos - Click para descargar`}
                                            onClick={() => generarExcelSuizaTuc(prov.items)}
                                            style={{ cursor: 'pointer', marginLeft: '8px' }}
                                        >
                                            📊 TXT
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
                        onClick={() => {
                            const provs = Object.keys(seleccionados).filter(k => seleccionados[k]);
                            const itemsSeleccionados = proveedores
                                .filter(prov => seleccionados[prov.proveedor])
                                .flatMap(prov => (prov.items || []).map(item => ({
                                    ...item,
                                    proveedor: prov.proveedor,
                                })));
                            onEnviar({ proveedores: provs, items: itemsSeleccionados });
                        }}
                        className="resumen_modal_button_enviar"
                        disabled={isSending || !haySeleccionados}
                        style={{
                            opacity: (isSending || !haySeleccionados) ? 0.6 : 1,
                            cursor: (isSending || !haySeleccionados) ? "not-allowed" : "pointer"
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