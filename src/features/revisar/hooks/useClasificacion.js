// hooks/useClasificacion.js
import { useEffect, useState, useCallback } from "react";
import { fetchClasificacion } from "../../../services/clasificacion";

// Mismo criterio que back/services/clasificacionProductos.js:
//  - perfumería  = flag manual item.esPerfumeria O producto en cluster con medicamento = 0
//  - medicamento = producto en cluster con medicamento = 1 y que no sea perfumería
//  - clusters    = clusters del producto con descuento extra activo (scope "cluster")
export function useClasificacion() {
    const [clasif, setClasif] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancel = false;

        (async () => {
            try {
                const data = await fetchClasificacion();
                if (!cancel) {
                    setClasif({
                        perfumeria: new Set((data?.perfumeria ?? []).map(String)),
                        medicamento: new Set((data?.medicamento ?? []).map(String)),
                        clusters: data?.clusters ?? {}, // { idPlex: [clusterId...] } solo clusters con descuento extra
                    });
                }
            } catch (err) {
                console.warn("useClasificacion: no se pudo cargar la clasificación, se usa solo el flag manual:", err?.message || err);
                if (!cancel) setClasif({ perfumeria: new Set(), medicamento: new Set(), clusters: {} });
            } finally {
                if (!cancel) setReady(true);
            }
        })();

        return () => { cancel = true; };
    }, []);

    // 👉 Match por idQuantio, que equivale a id_plex
    const esPerfumeria = useCallback(
        (item) => {
            if (item?.esPerfumeria === true) return true;
            const key = String(item?.idQuantio ?? item?.idPlex ?? "");
            return key !== "" && !!clasif?.perfumeria.has(key);
        },
        [clasif]
    );

    const esMedicamento = useCallback(
        (item) => {
            if (esPerfumeria(item)) return false;
            const key = String(item?.idQuantio ?? item?.idPlex ?? "");
            return key !== "" && !!clasif?.medicamento.has(key);
        },
        [clasif, esPerfumeria]
    );

    // 👉 Ids (string) de los clusters del item que tienen descuento extra activo
    const getClusterIds = useCallback(
        (item) => {
            const key = String(item?.idQuantio ?? item?.idPlex ?? "");
            return (key !== "" && clasif?.clusters?.[key]) || [];
        },
        [clasif]
    );

    return { esPerfumeria, esMedicamento, getClusterIds, ready };
}
