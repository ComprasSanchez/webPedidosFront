// hooks/useConvenios.js
import { useEffect, useState } from "react";
import { fetchConvenios, matchConvenio } from "../../../services/convenios";

export function useConvenios({ sucursal }) {
    const [reglas, setReglas] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!sucursal) return;
        (async () => {
            try {
                const r = await fetchConvenios(sucursal);
                setReglas(r);
            } catch {
                setReglas({ byEAN: {}, byLAB: {} });
            } finally {
                setReady(true);
            }
        })();
    }, [sucursal]);

    return { reglas, ready, matchConvenio };
}
