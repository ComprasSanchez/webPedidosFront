import { useState } from "react";
import { API_URL } from "../../config/api";

/**
 * Hook para manejar la carga y procesamiento de archivos TXT para el carrito.
 * @param {Object} params
 * @param {string} params.sucursalCodigo
 * @param {function} params.replaceCarrito
 * @param {function} params.authFetch
 * @param {object} params.toast
 * @param {boolean} params.soloDeposito - Estado actual del flag soloDeposito del carrito
 * @param {function} params.setSoloDeposito - Función para setear flag soloDeposito en el carrito
 */
export default function useTxtUpload({ sucursalCodigo, replaceCarrito, authFetch, toast, soloDeposito, setSoloDeposito }) {
    const [loadingTxt, setLoadingTxt] = useState(false);
    const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
    const [duplicateItems, setDuplicateItems] = useState([]);
    const [pendingItems, setPendingItems] = useState([]);    // Handler para subir el archivo TXT
    const handleUploadTxt = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        if (sucursalCodigo) {
            formData.append("sucursal_codigo", sucursalCodigo);
        }

        setLoadingTxt(true);

        try {
            const res = await authFetch(`${API_URL}/api/reposicion/upload-txt`, {
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
        } catch (err) {
            toast.error("Error al procesar el archivo");
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