// hooks/useConvenios.js
import { useEffect, useState, useCallback } from "react";
import { fetchConvenios, fetchDescuentosNC } from "../../../services/convenios";

function normalizeProveedorSlug(value) {
    const slug = String(value || "").toLowerCase().trim();
    if (slug === "kellerof") return "kellerhoff";
    return slug;
}

export function useConvenios({ sucursal, authFetch }) {
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

                if (!cancel) {
                    setReglas({ porEan });
                    setDescuentosNC(Array.isArray(ncData) ? ncData.filter(r => r.activo) : []);
                }
            } catch (err) {
                console.warn("useConvenios: no se pudieron cargar convenios:", err?.message || err);
                if (!cancel) setReglas({ porEan: {} });
            } finally {
                if (!cancel) setReady(true);
            }
        })();

        return () => { cancel = true; };
    }, [sucursal]);

    // 👉 Busca SOLO por EAN exacto dentro de reglas.porEan
    const matchConvenio = useCallback(
        (item, reglasArg = reglas) => {
            const key = String(item?.ean ?? "");
            const prioridad = reglasArg?.porEan?.[key] || [];
            return prioridad.length
                ? { aplica: true, prioridad, fuente: "EAN" }
                : { aplica: false, prioridad: [], fuente: null };
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

            const codLab = item?.CodLab ?? item?.laboratorio ?? null;
            const porLab = registros.find(r => r.scope === "laboratorio" && r.scope_valor === codLab);
            if (porLab) return 1 - porLab.porcentaje / 100;

            const porPerf = registros.find(r => r.scope === "perfumeria");
            if (porPerf && item?.esPerfumeria === true) return 1 - porPerf.porcentaje / 100;

            const porTodo = registros.find(r => r.scope === "todo");
            if (porTodo) return 1 - porTodo.porcentaje / 100;

            return 1;
        },
        [descuentosNC]
    );

    return { reglas, ready, matchConvenio, descuentosNC, getFactorNC };
}