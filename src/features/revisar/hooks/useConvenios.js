// hooks/useConvenios.js
import { useEffect, useState, useCallback } from "react";
import { fetchConvenios } from "../../../services/convenios";

function normalizeProveedorSlug(value) {
    const slug = String(value || "").toLowerCase().trim();
    if (slug === "kellerof") return "kellerhoff";
    return slug;
}

export function useConvenios({ sucursal }) {
    const [reglas, setReglas] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!sucursal) return;

        let cancel = false;
        setReady(false);
        setReglas(null);

        (async () => {
            try {
                const data = await fetchConvenios(sucursal); // 👈 { byEAN: {...}, byLAB: {...} }
                const byEAN = data?.byEAN ?? {};

                // normalizamos: claves string y slugs en minúsculas
                const porEan = Object.fromEntries(
                    Object.entries(byEAN).map(([ean, prioridad]) => [
                        String(ean),
                        (Array.isArray(prioridad) ? prioridad : []).map((s) => normalizeProveedorSlug(s)),
                    ])
                );

                if (!cancel) setReglas({ porEan });
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

    return { reglas, ready, matchConvenio };
}