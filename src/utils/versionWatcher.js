let currentVersion = null;
let started = false;

export function startVersionWatcher({ intervalMs = 15000 } = {}) {
    if (started) return () => { };
    started = true;

    const check = async () => {
        try {
            // cache-bust para pedir siempre la última versión del archivo
            const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const { version } = await res.json();

            if (!currentVersion) {
                currentVersion = version; // primer arranque
            } else if (version && version !== currentVersion) {
                hardReloadWithVersion(version); // detectó build nueva
            }
        } catch {
            /* ignorar errores transitorios durante deploy */
        }
    };

    const id = setInterval(check, intervalMs);
    check(); // primer chequeo inmediato

    return () => clearInterval(id);
}

export function hardReloadWithVersion(version) {
    if (window.__alreadyReloading) return;
    window.__alreadyReloading = true;

    // Forzamos cache-busting del index.html con ?v=<version>
    const { pathname, hash } = window.location;
    const v = encodeURIComponent(version);
    const next = `${pathname}?v=${v}${hash || ''}`;
    window.location.replace(next);
}
