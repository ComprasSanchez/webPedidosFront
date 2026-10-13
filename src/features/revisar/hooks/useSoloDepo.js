// hooks/useSoloDepo.js
import { useEffect, useState, useCallback } from "react";
import { fetchSoloDepo } from "../../../services/soloDepo";

export function useSoloDepo() {
    const [idPlexSet, setIdPlexSet] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancel = false;

        (async () => {
            try {
                const data = await fetchSoloDepo();
                const ids = Array.isArray(data?.idPlex) ? data.idPlex : [];
                if (!cancel) setIdPlexSet(new Set(ids.map(String)));
            } catch (err) {
                console.warn("useSoloDepo: no se pudieron cargar productos solo-depósito:", err?.message || err);
                if (!cancel) setIdPlexSet(new Set());
            } finally {
                if (!cancel) setReady(true);
            }
        })();

        return () => { cancel = true; };
    }, []);

    // 👉 ¿Este item es solo-depósito? (match por idQuantio, que equivale a id_plex)
    const esSoloDepo = useCallback(
        (item) => {
            if (!idPlexSet) return false;
            const key = String(item?.idQuantio ?? item?.idPlex ?? "");
            return key !== "" && idPlexSet.has(key);
        },
        [idPlexSet]
    );

    return { esSoloDepo, ready };
}
