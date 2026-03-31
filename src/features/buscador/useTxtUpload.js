// useTxtUpload.js

import { useState } from "react";
import { API_URL } from "../../config/api";

function useTxtUpload({ sucursalCodigo, replaceCarrito, acumularProductosEnCarrito, authFetch, toast, soloDeposito, setSoloDeposito, esPerfumeria, setEsPerfumeria, procesarZipData }) {
    const [loadingTxt, setLoadingTxt] = useState(false);
    const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
    const [duplicateItems, setDuplicateItems] = useState([]);
    const [pendingItems, setPendingItems] = useState([]);

    // Handler para subir archivo (TXT individual, ZIP masivo o CSV masivo)
    const handleUploadTxt = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Detectar tipo de archivo
        const fileName = file.name.toLowerCase();
        const isZip = fileName.endsWith('.zip');
        const isTxt = fileName.endsWith('.txt');
        const isCsv = fileName.endsWith('.csv');

        // Validaciones según tipo de archivo
        if (!isZip && !isTxt && !isCsv) {
            toast.error("Solo se permiten archivos .txt, .zip o .csv");
            e.target.value = "";
            return;
        }

        if (isZip && sucursalCodigo) {
            toast.error("Los archivos ZIP solo se pueden cargar sin sucursal seleccionada");
            e.target.value = "";
            return;
        }

        if (isCsv && sucursalCodigo) {
            toast.error("Los archivos CSV solo se pueden cargar sin sucursal seleccionada (la distribución está en el archivo)");
            e.target.value = "";
            return;
        }

        if (isTxt && !sucursalCodigo) {
            toast.error("Los archivos TXT requieren tener una sucursal seleccionada");
            e.target.value = "";
            return;
        }

        // Preparar FormData
        const formData = new FormData();
        formData.append("file", file);
        if (sucursalCodigo) {
            formData.append("sucursal_codigo", sucursalCodigo);
        }
        // Enviar el estado del switch "Solo Depo"
        formData.append("soloDeposito", soloDeposito ? "true" : "false");

        // 🆕 Enviar el estado del switch "Perfumería"
        formData.append("esPerfumeria", esPerfumeria ? "true" : "false");

        // 🔍 DEBUG: Log flags antes de enviar
        console.log(`🔍 [FRONTEND] Subiendo ${isZip ? 'ZIP' : 'TXT'}: soloDeposito=${soloDeposito}, esPerfumeria=${esPerfumeria}`);

        setLoadingTxt(true);

        try {
            // Usar endpoint diferente según tipo de archivo
            const endpoint = isZip
                ? `${API_URL}/api/reposicion/upload-zip`
                : isCsv
                    ? `${API_URL}/api/reposicion/upload-csv`
                    : `${API_URL}/api/reposicion/upload-txt`;

            // Preparar upload con autenticación

            const res = await authFetch(endpoint, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Error desconocido" }));

                setLoadingTxt(false);
                e.target.value = "";

                if (res.status === 400 && errorData.detalles) {
                    const { sucursal_seleccionada, sucursal_archivo } = errorData.detalles;
                    replaceCarrito([]);
                    toast.error(
                        `Error de sucursal: El archivo es de la sucursal ${sucursal_archivo}, pero tienes seleccionada la sucursal ${sucursal_seleccionada}`,
                        {
                            duration: 6000,
                            style: {
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fca5a5',
                            }
                        }
                    );
                    return;
                } else if (res.status === 409) {
                    toast.error(
                        errorData.mensaje || 'El archivo ya fue procesado recientemente. Para volver a subirlo intencionalmente, debe cambiar el nombre del archivo.',
                        {
                            duration: 8000,
                            style: {
                                background: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fcd34d',
                            }
                        }
                    );
                    return;
                } else {
                    toast.error(errorData.error || "Error al procesar el archivo");
                    return;
                }
            }

            const data = await res.json();

            if (isZip || isCsv) {
                // Manejo específico para ZIP según el modo
                if (data.modo === 'SOLO_DEPOSITO') {
                    // 🟢 MODO SOLO DEPO: Flujo directo completado
                    // ZIP procesado en modo Solo Depo

                    // Calcular duplicados totales
                    const duplicadosTotales = data.resumen?.reduce((sum, item) => {
                        return sum + (item.duplicados?.cantidad || 0);
                    }, 0) || 0;

                    const pedidosGenerados = data.pedidos_deposito?.pedidos_resumen?.length || 0;
                    const productosEnviados = data.pedidos_deposito?.productos_enviados || 0;

                    let mensaje = `✅ Solo Depo - Procesamiento completado:\n`;
                    mensaje += `🏠 ${pedidosGenerados} pedidos generados automáticamente\n`;
                    mensaje += `📦 ${productosEnviados} productos enviados al depósito\n`;
                    mensaje += `🏢 ${data.totales.sucursales} sucursales procesadas`;

                    if (duplicadosTotales > 0) {
                        mensaje += `\n📋 Se consolidaron ${duplicadosTotales} productos duplicados`;
                    }

                    toast.success(mensaje, {
                        duration: 6000,
                        style: { maxWidth: '500px' }
                    });

                    // ✅ SÍ procesar datos para mostrar resumen, pero marcar como Solo Depo
                    if (procesarZipData) {
                        try {
                            procesarZipData(data);
                        } catch (error) {
                            console.error("Error en procesarZipData:", error);
                            throw error;
                        }
                    }

                    setLoadingTxt(false);
                    e.target.value = "";
                    return;

                } else {
                    // 🛒 MODO TRADICIONAL: Procesar carrito para revisión manual
                    // ZIP procesado en modo tradicional

                    if (procesarZipData) {
                        try {
                            procesarZipData(data);
                        } catch (error) {
                            console.error("Error en procesarZipData:", error);
                            throw error;
                        }

                        // Calcular duplicados totales
                        const duplicadosTotales = data.resumen?.reduce((sum, item) => {
                            return sum + (item.duplicados?.cantidad || 0);
                        }, 0) || 0;

                        let mensaje = `Carga masiva completada: ${data.totales.sucursales} sucursales, ${data.totales.productos} productos cargados`;

                        if (duplicadosTotales > 0) {
                            mensaje += `\n📋 Se consolidaron ${duplicadosTotales} productos duplicados`;
                        }

                        toast.success(mensaje, { duration: 5000 });
                    }
                }
            } else {
                // Manejo tradicional para archivos TXT individuales
                const itemsParaCarrito = data.items.map(item => ({
                    ...item,
                    unidades: item.cantidad || 1,
                    // 🆕 Agregar flag esPerfumeria para archivos TXT también
                    esPerfumeria: esPerfumeria,
                }));

                // Setear flag soloDeposito en el contexto del carrito si está marcado
                if (setSoloDeposito && soloDeposito) {
                    setSoloDeposito(true);
                }

                if (data.hasDuplicates) {
                    const duplicates = itemsParaCarrito.filter(item => item.isDuplicate);
                    const nonDuplicates = itemsParaCarrito.filter(item => !item.isDuplicate);

                    // ACUMULAR productos en lugar de reemplazar
                    acumularProductosEnCarrito(nonDuplicates);

                    setDuplicateItems(duplicates);
                    setPendingItems(nonDuplicates);
                    setShowDuplicatesModal(true);
                    toast.warning(
                        `Archivo cargado con ${data.duplicateEans.length} códigos duplicados. Resuelve los conflictos.`,
                        { duration: 5000 }
                    );
                } else {
                    // ACUMULAR productos en lugar de reemplazar
                    const { agregados, actualizados } = acumularProductosEnCarrito(itemsParaCarrito);

                    const modoText = soloDeposito ? " (Solo depósito)" : "";
                    let mensaje = `Archivo cargado: ${data.totalItems} items, ${data.totalUnidades} unidades${modoText}`;

                    if (actualizados > 0) {
                        mensaje += `\n📋 ${actualizados} productos consolidados con cantidades existentes`;
                    }

                    toast.success(mensaje, { duration: 5000 });
                }
            }
        } catch (err) {
            console.error("Error procesando archivo:", err.message);
            toast.error(`Error al procesar el archivo: ${err.message}`);
        } finally {
            setLoadingTxt(false);
            e.target.value = "";
        }
    };

    // Handler para resolver duplicados
    const handleResolveDuplicates = (resolvedItems) => {
        const finalItems = [...pendingItems, ...resolvedItems];
        const { agregados, actualizados } = acumularProductosEnCarrito(finalItems);

        const totalItems = finalItems.length;
        const totalUnidades = finalItems.reduce((sum, item) => sum + item.unidades, 0);

        let mensaje = `Duplicados resueltos: ${totalItems} items, ${totalUnidades} unidades`;
        if (actualizados > 0) {
            mensaje += `\n📋 ${actualizados} productos consolidados con cantidades existentes`;
        }

        toast.success(mensaje, { duration: 5000 });
        setDuplicateItems([]);
        setPendingItems([]);
    };

    return {
        loadingTxt,
        showDuplicatesModal,
        duplicateItems,
        pendingItems,
        soloDeposito,
        setSoloDeposito,
        handleUploadTxt,
        handleResolveDuplicates,
        setShowDuplicatesModal
    };
}

export default useTxtUpload;