// Simulación de respuesta de las droguerías
// services/droguerias.js
import axios from "axios";
import { API_URL } from "../config/api";
import { http } from "../lib/http";
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

function withTimeout(promise, ms = 12000, controller) {
    const id = setTimeout(() => controller.abort(), ms);
    return promise.finally(() => clearTimeout(id));
}

export async function getStockDisponible(carrito, sucursal, { fetch, headers }) {

    // ...

    const items = carrito
        .filter(item => item.idQuantio) // solo productos con ID válido
        .map(item => ({
            idproducto: item.idQuantio,
            cantidad: item.unidades || 1
        }));

    if (!items.length) return [];

    const res = await fetch(`${API_URL}/api/pedidos/reservas/stock-disponible`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-sucursal": sucursal,
            ...headers
        },
        body: JSON.stringify({ items })
    });

    if (!res.ok) throw new Error("Error obteniendo stock disponible");

    const backendData = await res.json(); // [{ idProducto, stockReal, hardActivas, softActivas, disponible }]

    // ...

    // Mapear los datos del backend para incluir el EAN correspondiente
    const resultado = backendData.map(stockItem => {
        // Buscar el item del carrito que corresponde a este idProducto
        const carritoItem = carrito.find(item => item.idQuantio === stockItem.idProducto);

        return {
            ean: carritoItem?.ean || stockItem.idProducto, // usar EAN si está disponible, sino el idProducto
            idProducto: stockItem.idProducto,
            stockReal: stockItem.stockReal,
            hardActivas: stockItem.hardActivas,
            softActivas: stockItem.softActivas,
            softOtras: stockItem.softOtras,
            softPropias: stockItem.softPropias,
            disponible: stockItem.disponible,
            error: stockItem.error || null
        };
    });

    return resultado;
}



export async function getPreciosMonroe(carrito, sucursal, opts = {}) {
    const f = opts.fetch || nativeFetch;
    const baseHeaders = opts.headers || {};
    const timeoutMs = opts.timeoutMs ?? 15000;

    // Si no hay EANs o sucursal, devolver vacío
    const items = (carrito || [])
        .filter(it => it?.ean)
        .map(it => ({ ean: it.ean, cantidad: it.cantidad || it.unidades || 1 }));

    if (!items.length || !sucursal) return [];

    const controller = new AbortController();

    try {
        // Llamada batch
        const res = await withTimeout(
            f(`${API_URL}/api/droguerias/monroe/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...baseHeaders },
                credentials: 'include',
                body: JSON.stringify({ sucursal, items }),
                signal: controller.signal
            }),
            timeoutMs,
            controller
        );

        if (!res.ok) {
            throw new Error('Error consultando Monroe batch');
        }

        const data = await res.json(); // { error, resultados: { [ean]: {...} } }
        if (data.error) {
            throw new Error(data.error);
        }

        const resultados = data.resultados || {};

        // Mapeo al shape que usa tu front (por EAN)
        return items.map(it => {
            const r = resultados[it.ean];
            if (!r) {
                return { ean: it.ean, stock: false, priceList: null, offerPrice: null, finalPrice: null, effectiveDiscountPct: null, minimo_unids: null, offers: [], noDisponible: false, error: null, _status: res.status };
            }

            const stock = r.stock === true;
            const priceList = typeof r.priceList === 'number' ? r.priceList : null;
            const offerPrice = typeof r.offerPrice === 'number' ? r.offerPrice : null;
            const finalPrice = (typeof r.finalPrice === 'number') ? r.finalPrice : (offerPrice ?? priceList ?? null);
            const effectiveDiscountPct = (typeof r.effectiveDiscountPct === 'number')
                ? r.effectiveDiscountPct
                : ((typeof priceList === 'number' && typeof finalPrice === 'number')
                    ? Number(((1 - (finalPrice / priceList)) * 100).toFixed(2))
                    : null);
            const minimo_unids = Number.isFinite(r.minimo_unids) ? r.minimo_unids : null;
            const offers = Array.isArray(r.offers) ? r.offers : [];
            const noDisponible = r.noDisponible === true;

            return {
                ean: it.ean,
                stock,
                priceList,
                offerPrice,
                finalPrice,
                effectiveDiscountPct,
                minimo_unids,
                offers,
                noDisponible,
                error: r.error || null,
                _status: res.status
            };
        });

    } catch (err) {
        // Error de red/timeout -> mostrar error directo
        return items.map(it => ({
            ean: it.ean,
            stock: null,
            priceList: null,
            offerPrice: null,
            finalPrice: null,
            effectiveDiscountPct: null,
            minimo_unids: null,
            offers: [],
            noDisponible: false,
            error: err.message || 'Error de conexión',
            _status: 0
        }));
    }
}



export async function getPreciosSuizo(carrito, sucursal, opts = {}) {
    const f = opts.fetch || nativeFetch;
    const baseHeaders = opts.headers || {};
    const timeoutMs = opts.timeoutMs ?? 15000;

    // Si no hay EANs o sucursal, devolver vacío
    const items = (carrito || [])
        .filter(it => it?.ean)
        .map(it => ({ ean: it.ean, cantidad: it.cantidad || 1 }));

    if (!items.length || !sucursal) return [];

    const controller = new AbortController();

    // Fallback legacy (por si falla el batch)
    async function fallbackLegacy() {
        const calls = carrito.map(async (item) => {
            const url = `${API_URL}/api/droguerias/suizo/${encodeURIComponent(item.ean)}?sucursal=${encodeURIComponent(sucursal)}`;
            const ctrl = new AbortController();
            try {
                const res = await withTimeout(
                    f(url, { headers: { ...baseHeaders }, signal: ctrl.signal }),
                    timeoutMs,
                    ctrl
                );
                if (!res.ok) {
                    return { ean: item.ean, stock: null, priceList: null, offerPrice: null, finalPrice: null, effectiveDiscountPct: null, offers: [], noDisponible: false, error: `HTTP ${res.status}`, _status: res.status };
                }
                const data = await res.json();
                const stock = data?.stock === true;
                const priceList = typeof data?.priceList === 'number' ? data.priceList : null;
                const offerPrice = typeof data?.offerPrice === 'number' ? data.offerPrice : null;
                const finalPrice = offerPrice ?? priceList ?? null;
                const effectiveDiscountPct = (typeof priceList === 'number' && typeof finalPrice === 'number')
                    ? Number(((1 - (finalPrice / priceList)) * 100).toFixed(2))
                    : null;
                const offers = Array.isArray(data?.offers) ? data.offers : [];
                const error = typeof data?.error === 'string' ? data.error : null;
                const noDisponible = data?.noDisponible === true;

                return { ean: item.ean, stock, priceList, offerPrice, finalPrice, effectiveDiscountPct, offers, noDisponible, error, _status: res.status };
            } catch (e) {
                return { ean: item.ean, stock: null, priceList: null, offerPrice: null, finalPrice: null, effectiveDiscountPct: null, offers: [], noDisponible: false, error: 'Error de conexión', _status: 0 };
            }
        });
        return Promise.all(calls);
    }

    try {
        // Llamada batch
        const res = await withTimeout(
            f(`${API_URL}/api/droguerias/suizo/consulta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...baseHeaders },
                credentials: 'include',
                body: JSON.stringify({ sucursal, items }),
                signal: controller.signal
            }),
            timeoutMs,
            controller
        );

        if (!res.ok) {
            // Si el batch no responde OK, caemos a legacy
            return await fallbackLegacy();
        }

        const data = await res.json(); // { error, resultados: { [ean]: {...} } }
        if (data.error) {
            // Si el back devolvió error, caemos a legacy
            return await fallbackLegacy();
        }

        const resultados = data.resultados || {};

        // Mapeo al shape que usa tu front (por EAN)
        // en el mapeo del batch
        return items.map(it => {
            const r = resultados[it.ean];
            if (!r) {
                return { ean: it.ean, stock: false, priceList: null, offerPrice: null, finalPrice: null, effectiveDiscountPct: null, minimo_unids: null, offers: [], noDisponible: false, error: null, _status: res.status };
            }

            const stock = r.stock === true;
            const priceList = typeof r.priceList === 'number' ? r.priceList : null;
            const offerPrice = typeof r.offerPrice === 'number' ? r.offerPrice : null;
            const finalPrice = (typeof r.finalPrice === 'number') ? r.finalPrice : (offerPrice ?? priceList ?? null);
            const effectiveDiscountPct = (typeof r.effectiveDiscountPct === 'number')
                ? r.effectiveDiscountPct
                : ((typeof priceList === 'number' && typeof finalPrice === 'number')
                    ? Number(((1 - (finalPrice / priceList)) * 100).toFixed(2))
                    : null);
            const minimo_unids = Number.isFinite(r.minimo_unids) ? r.minimo_unids : null;
            const offers = Array.isArray(r.offers) ? r.offers : [];

            // Manejar flag noDisponible
            const noDisponible = r.noDisponible === true;

            return {
                ean: it.ean,
                stock,
                priceList,
                offerPrice,
                finalPrice,
                effectiveDiscountPct,
                minimo_unids,
                offers,
                noDisponible,  // Nuevo campo
                error: r.error || null,
                _status: res.status
            };
        });


    } catch (err) {
        // Error de red/timeout -> legacy
        return await fallbackLegacy();
    }
}


export async function getPreciosCofarsur(carrito, sucursal, opts = {}) {
    const f = opts.fetch || nativeFetch;
    const baseHeaders = opts.headers || {};
    const timeoutMs = opts.timeoutMs ?? 90000; // ⬆️ Aumentado a 90s para producción con latencia

    // Si no hay EANs o sucursal, devolver vacío
    const items = (carrito || [])
        .filter(it => it?.ean)
        .map(it => ({ ean: it.ean, cantidad: it.cantidad || 1 }));

    if (!items.length || !sucursal) return [];

    // ✅ USAR REST BATCH - Más eficiente que SOAP individual
    return await getPreciosCofarsurBatch(items, sucursal, { f, baseHeaders, timeoutMs });
}

// ============================================================================
// 🟢 Función auxiliar para consultas batch REST - Activa
// ============================================================================
async function getPreciosCofarsurBatch(items, sucursal, { f, baseHeaders, timeoutMs }) {
    console.log(`[Front Cofarsur REST] Consultando ${items.length} productos en batch para sucursal: ${sucursal}`);
    console.log(`[Front Cofarsur REST] API_URL: ${API_URL}`);
    console.log(`[Front Cofarsur REST] Timeout: ${timeoutMs}ms`);

    const controller = new AbortController();

    try {
        const startTime = Date.now();
        // Llamada batch REST
        const res = await withTimeout(
            f(`${API_URL}/api/droguerias/cofarsur/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...baseHeaders },
                credentials: 'include',
                body: JSON.stringify({ sucursal, items }),
                signal: controller.signal
            }),
            timeoutMs,
            controller
        );
        const elapsed = Date.now() - startTime;
        console.log(`[Front Cofarsur REST] Respuesta recibida en ${elapsed}ms, status: ${res.status}`);

        if (!res.ok) {
            console.error('Cofarsur batch HTTP error:', res.status, res.statusText);
            // Retornar items con error en lugar de fallar
            return items.map(it => ({
                ean: it.ean,
                stock: null,
                priceList: null,
                offerPrice: null,
                offers: [],
                error: `HTTP ${res.status}`,
                minimo_unids: null,
                _status: res.status
            }));
        }

        let data;
        try {
            data = await res.json();
        } catch (jsonError) {
            console.error('Cofarsur devolvió respuesta inválida (no JSON)');
            return items.map(it => ({
                ean: it.ean,
                stock: null,
                priceList: null,
                offerPrice: null,
                offers: [],
                error: 'Respuesta inválida del servidor',
                minimo_unids: null,
                _status: res.status
            }));
        }

        if (data.error) {
            console.error('Cofarsur batch devolvió error:', data.error);
            return items.map(it => ({
                ean: it.ean,
                stock: null,
                priceList: null,
                offerPrice: null,
                offers: [],
                error: data.error,
                minimo_unids: null,
                _status: res.status
            }));
        }

        const resultados = data.resultados || {};

        return items.map(it => {
            const r = resultados[it.ean];
            if (!r) {
                return { ean: it.ean, stock: false, priceList: null, offerPrice: null, offers: [], error: null, minimo_unids: null, _status: res.status };
            }

            const stock = r.stock === true;
            const priceList = typeof r.priceList === 'number' ? r.priceList : null;
            const offerPrice = typeof r.offerPrice === 'number' ? r.offerPrice : null;
            const offers = Array.isArray(r.offers) ? r.offers : [];
            const error = typeof r.error === 'string' ? r.error : null;

            return {
                ean: it.ean,
                stock,
                priceList,
                offerPrice,
                offers,
                error,
                minimo_unids: null,
                _status: res.status
            };
        });

    } catch (err) {
        console.error('Error de red consultando Cofarsur batch:', err?.message || err);
        // Retornar items con error de conexión
        return items.map(it => ({
            ean: it.ean,
            stock: null,
            priceList: null,
            offerPrice: null,
            offers: [],
            error: err?.message?.includes('aborted') ? 'Timeout' : 'Error de conexión',
            minimo_unids: null,
            _status: 0
        }));
    }
}

// ============================================================================
// 🔵 BACKUP: Función individual con semáforo (SOAP) 
// ============================================================================
// Dejada como backup por si el REST vuelve a fallar
// Para usarla, cambiar getPreciosCofarsur para que llame a esta función
/* BACKUP_INDIVIDUAL_SOAP
async function getPreciosCofarsurIndividual_BACKUP(items, sucursal, { f, baseHeaders, timeoutMs }) {
    const MAX_CONCURRENT = 100;
    const results = new Array(items.length);
    let completados = 0;
    let enProceso = 0;
    let nextIndex = 0;

    return new Promise((resolve) => {
        const procesarSiguiente = async () => {
            if (nextIndex >= items.length) {
                if (completados === items.length) {
                    resolve(results.filter(r => r !== undefined));
                }
                return;
            }

            const currentIndex = nextIndex++;
            const item = items[currentIndex];
            enProceso++;

            const url = `${API_URL}/api/droguerias/cofarsur/${encodeURIComponent(item.ean)}?sucursal=${encodeURIComponent(sucursal)}`;
            const controller = new AbortController();

            try {
                const res = await withTimeout(
                    f(url, { headers: { ...baseHeaders }, signal: controller.signal }),
                    timeoutMs,
                    controller
                );

                if (!res.ok) {
                    results[currentIndex] = {
                        ean: item.ean,
                        stock: null,
                        priceList: null,
                        offerPrice: null,
                        offers: [],
                        minimo_unids: null,
                        error: `HTTP ${res.status}`,
                        _status: res.status
                    };
                } else {
                    const data = await res.json();
                    results[currentIndex] = {
                        ean: item.ean,
                        stock: data?.stock === true,
                        priceList: typeof data?.priceList === 'number' ? data.priceList : null,
                        offerPrice: typeof data?.offerPrice === 'number' ? data.offerPrice : null,
                        offers: Array.isArray(data?.offers) ? data.offers : [],
                        error: typeof data?.error === 'string' ? data.error : null,
                        minimo_unids: typeof data?.cantidadMinima === 'number' ? data.cantidadMinima : null,
                        _status: res.status
                    };
                }
            } catch (e) {
                let errorMsg = 'Error desconocido';
                if (e.name === 'AbortError' || e?.message?.includes('aborted')) {
                    errorMsg = 'Timeout';
                } else if (e?.message) {
                    errorMsg = e.message;
                }

                results[currentIndex] = {
                    ean: item.ean,
                    stock: null,
                    priceList: null,
                    offerPrice: null,
                    offers: [],
                    minimo_unids: null,
                    error: errorMsg,
                    _status: 0
                };
            } finally {
                enProceso--;
                completados++;
                if (completados % 10 === 0 || completados === items.length) {
                    console.log(`[SOAP Backup] Progreso: ${completados}/${items.length}`);
                }
                procesarSiguiente();
            }
        };

        for (let i = 0; i < Math.min(MAX_CONCURRENT, items.length); i++) {
            procesarSiguiente();
        }
    });
}
END_BACKUP_INDIVIDUAL_SOAP */

// Simula delay de red
const delay = (ms = 300) =>
    new Promise((res) => setTimeout(res, ms));
