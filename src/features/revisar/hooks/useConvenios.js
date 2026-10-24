// hooks/useConvenios.js
import { useEffect, useState, useCallback } from "react";
import { fetchConvenios, fetchDescuentosNC } from "../../../services/convenios";

function normalizeProveedorSlug(value) {
    const slug = String(value || "").toLowerCase().trim();
    if (slug === "kellerof") return "kellerhoff";
    return slug;
}

const normalizarCodLab = (v) => String(v ?? "").trim().toUpperCase();

const esPerfumeriaManual = (item) => item?.esPerfumeria === true;
const noEsMedicamento = () => false;
const sinClusters = () => [];

export function useConvenios({ sucursal, authFetch, esPerfumeria = esPerfumeriaManual, esMedicamento = noEsMedicamento, getClusterIds = sinClusters }) {
    const [reglas, setReglas] = useState(null);
    const [ready, setReady] = useState(false);
    const [descuentosNC, setDescuentosNC] = useState([]);

    useEffect(() => {
        if (!sucursal) return;

        let cancel = false;
        setReady(false);
        setReglas(null);

        (async () => {
            try {
                const promises = [fetchConvenios(sucursal)];
                if (authFetch) promises.push(fetchDescuentosNC(authFetch));

                const [data, ncData] = await Promise.all(promises);
                const byEAN = data?.byEAN ?? {};

                // normalizamos: claves string y slugs en minúsculas
                const porEan = Object.fromEntries(
                    Object.entries(byEAN).map(([ean, prioridad]) => [
                        String(ean),
                        (Array.isArray(prioridad) ? prioridad : []).map((s) => normalizeProveedorSlug(s)),
                    ])
                );

                // por laboratorio: clave CodLab normalizada (texto, sin espacios, mayúsculas)
                const porLab = Object.fromEntries(
                    Object.entries(data?.byLAB ?? {}).map(([codLab, prioridad]) => [
                        normalizarCodLab(codLab),
                        (Array.isArray(prioridad) ? prioridad : []).map((s) => normalizeProveedorSlug(s)),
                    ])
                );

                if (!cancel) {
                    setReglas({ porEan, porLab });
                    // porcentaje llega como string ("10.00") por ser DECIMAL: se normaliza a número para comparar
                    setDescuentosNC(Array.isArray(ncData)
                        ? ncData.filter(r => r.activo).map(r => ({ ...r, porcentaje: Number(r.porcentaje) }))
                        : []);
                }
            } catch (err) {
                console.warn("useConvenios: no se pudieron cargar convenios:", err?.message || err);
                if (!cancel) setReglas({ porEan: {}, porLab: {} });
            } finally {
                if (!cancel) setReady(true);
            }
        })();

        return () => { cancel = true; };
    }, [sucursal]);

    // 👉 EAN exacto (reglas.porEan) gana; si no hay, convenio del laboratorio (reglas.porLab por CodLab)
    const matchConvenio = useCallback(
        (item, reglasArg = reglas) => {
            const key = String(item?.ean ?? "");
            const prioridadEan = reglasArg?.porEan?.[key] || [];
            if (prioridadEan.length) return { aplica: true, prioridad: prioridadEan, fuente: "EAN" };

            const cod = normalizarCodLab(item?.CodLab);
            const prioridadLab = (cod && reglasArg?.porLab?.[cod]) || [];
            if (prioridadLab.length) return { aplica: true, prioridad: prioridadLab, fuente: "LAB" };

            return { aplica: false, prioridad: [], fuente: null };
        },
        [reglas]
    );

    // 👉 Devuelve el factor de precio efectivo para un item+proveedor según descuentos NC
    // Prioridad: producto (idQuantio) > laboratorio (CodLab) > perfumeria > todo
    const getFactorNC = useCallback(
        (item, proveedor) => {
            const registros = descuentosNC.filter(r => r.id_proveedor === proveedor);
            if (!registros.length) return 1;

            const porProducto = registros.find(
                r => r.scope === "producto" && String(r.scope_valor) === String(item?.idQuantio ?? "")
            );
            if (porProducto) return 1 - porProducto.porcentaje / 100;

            // Cluster: si el item está en varios clusters con regla, gana el mayor porcentaje
            const clusterIds = getClusterIds(item);
            const porCluster = registros
                .filter(r => r.scope === "cluster" && clusterIds.includes(String(r.scope_valor)))
                .reduce((max, r) => (max === null || r.porcentaje > max.porcentaje ? r : max), null);
            if (porCluster) return 1 - porCluster.porcentaje / 100;

            const codLab = item?.CodLab ?? item?.laboratorio ?? null;
            const porLab = codLab != null && registros.find(r => r.scope === "laboratorio" && String(r.scope_valor) === String(codLab));
            if (porLab) return 1 - porLab.porcentaje / 100;

            const porPerf = registros.find(r => r.scope === "perfumeria");
            if (porPerf && esPerfumeria(item)) return 1 - porPerf.porcentaje / 100;

            const porMed = registros.find(r => r.scope === "medicamento");
            if (porMed && esMedicamento(item)) return 1 - porMed.porcentaje / 100;

            const porTodo = registros.find(r => r.scope === "todo");
            if (porTodo) return 1 - porTodo.porcentaje / 100;

            return 1;
        },
        [descuentosNC, esPerfumeria, esMedicamento, getClusterIds]
    );

    return { reglas, ready, matchConvenio, descuentosNC, getFactorNC };
}