// useTxtUpload.js

import { useState } from "react";
import { API_URL } from "../../config/api";

function useTxtUpload({ sucursalCodigo, replaceCarrito, authFetch, toast, soloDeposito, setSoloDeposito, procesarZipData }) {
    const [loadingTxt, setLoadingTxt] = useState(false);
    const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
    const [duplicateItems, setDuplicateItems] = useState([]);
    const [pendingItems, setPendingItems] = useState([]);

    // Handler para subir archivo (TXT individual o ZIP masivo)
    const handleUploadTxt = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Detectar tipo de archivo
        const fileName = file.name.toLowerCase();
        const isZip = fileName.endsWith('.zip');
        const isTxt = fileName.endsWith('.txt');

        // Validaciones según tipo de archivo
        if (!isZip && !isTxt) {
            toast.error("Solo se permiten archivos .txt o .zip");
            e.target.value = "";
            return;
        }

        if (isZip && sucursalCodigo) {
            toast.error("Los archivos ZIP solo se pueden cargar sin sucursal seleccionada");
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

        setLoadingTxt(true);

        try {
            // Usar endpoint diferente según tipo de archivo
            const endpoint = isZip
                ? `${API_URL}/api/reposicion/upload-zip`
                : `${API_URL}/api/reposicion/upload-txt`;

            // Log de debugging para autenticación
            console.log('🔍 Upload debugging:', {
                endpoint,
                isZip,
                hasAuthFetch: !!authFetch,
                archivo: file.name
            });

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
                } else {
                    toast.error(errorData.error || "Error al procesar el archivo");
                    return;
                }
            }

            const data = await res.json();

            if (isZip) {
                // Manejo específico para ZIP - procesar directamente sin modal
                if (procesarZipData) {
                    try {
                        procesarZipData(data);
                    } catch (error) {
                        console.error("Error en procesarZipData:", error);
                        throw error; // Re-lanzar el error para que lo capture el catch principal
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
            } else {
                // Manejo tradicional para archivos TXT individuales
                const itemsParaCarrito = data.items.map(item => ({
                    ...item,
                    unidades: item.cantidad || 1,
                }));

                // Setear flag soloDeposito en el contexto del carrito si está marcado
                if (setSoloDeposito && soloDeposito) {
                    setSoloDeposito(true);
                }

                if (data.hasDuplicates) {
                    const duplicates = itemsParaCarrito.filter(item => item.isDuplicate);
                    const nonDuplicates = itemsParaCarrito.filter(item => !item.isDuplicate);
                    replaceCarrito(nonDuplicates);
                    setDuplicateItems(duplicates);
                    setPendingItems(nonDuplicates);
                    setShowDuplicatesModal(true);
                    toast.warning(
                        `Archivo cargado con ${data.duplicateEans.length} códigos duplicados. Resuelve los conflictos.`,
                        { duration: 5000 }
                    );
                } else {
                    replaceCarrito(itemsParaCarrito);
                    const modoText = soloDeposito ? " (Solo depósito)" : "";
                    toast.success(
                        `Archivo cargado: ${data.totalItems} items, ${data.totalUnidades} unidades${modoText}`
                    );
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
        replaceCarrito(finalItems);
        const totalItems = finalItems.length;
        const totalUnidades = finalItems.reduce((sum, item) => sum + item.unidades, 0);
        toast.success(
            `Duplicados resueltos: ${totalItems} items, ${totalUnidades} unidades`
        );
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