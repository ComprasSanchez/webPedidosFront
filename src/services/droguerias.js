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
        }); x

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
    const timeoutMs = opts.timeoutMs ?? 12000;

    // Si no hay EANs o sucursal, devolver vacío
    const items = (carrito || [])
        .filter(it => it?.ean)
        .map(it => ({ ean: it.ean, cantidad: it.cantidad || 1 }));

    if (!items.length || !sucursal) return [];

    // DETECTAR TIPO DE USUARIO Y CANTIDAD
    // Si hay header x-user-rol o si detectamos contexto de compras/reposición
    const userAgent = baseHeaders['user-agent'] || '';
    const userRole = baseHeaders['x-user-rol'] || ''; // Si se puede pasar desde contexto
    const isReposicion = userRole === 'compras' ||
        userAgent.includes('compras') ||
        userAgent.includes('reposicion') ||
        window?.location?.pathname?.includes('/reposicion');

    const shouldUseBatch = isReposicion && items.length >= 15;

    // 📊 LOG PARA MONITOREO
    console.log(`[Cofarsur] Decisión:`, {
        userRole,
        isReposicion,
        productCount: items.length,
        shouldUseBatch,
        endpoint: shouldUseBatch ? 'REST_BATCH' : 'SOAP_INDIVIDUAL',
        decision: shouldUseBatch
            ? `REST batch para ${items.length} productos (usuario: ${userRole})`
            : `SOAP individual para ${items.length} productos (usuario: ${userRole || 'sucursal'})`
    });

    // DECISIÓN: usar batch (REST) o individual (SOAP)
    if (shouldUseBatch) {
        // USAR ENDPOINT BATCH (REST) para usuarios de reposición con 15+ productos
        return await getPreciosCofarsurBatch(items, sucursal, { f, baseHeaders, timeoutMs });
    } else {
        // USAR ENDPOINT INDIVIDUAL (SOAP) para sucursales o lotes pequeños
        return await getPreciosCofarsurIndividual(items, sucursal, { f, baseHeaders, timeoutMs });
    }
}

// Función auxiliar para consultas individuales (SOAP)
async function getPreciosCofarsurIndividual(items, sucursal, { f, baseHeaders, timeoutMs }) {
    console.log(`[Cofarsur] 🔵 Ejecutando SOAP individual para ${items.length} productos`);

    const calls = items.map(async (item) => {
        const url = `${API_URL}/api/droguerias/cofarsur/${encodeURIComponent(item.ean)}?sucursal=${encodeURIComponent(sucursal)}`;
        const controller = new AbortController();

        try {
            const res = await withTimeout(
                f(url, { headers: { ...baseHeaders }, signal: controller.signal }),
                timeoutMs,
                controller
            );

            if (!res.ok) {
                console.warn('Cofarsur individual no-OK', res.status);
                return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], minimo_unids: null, _status: res.status };
            }

            const data = await res.json();
            const stock = data?.stock === true;
            const priceList = typeof data?.priceList === 'number' ? data.priceList : null;
            const offerPrice = typeof data?.offerPrice === 'number' ? data.offerPrice : null;
            const offers = Array.isArray(data?.offers) ? data.offers : [];
            const error = typeof data?.error === 'string' ? data.error : null;

            // 🔧 EXTRAER CANTIDAD MÍNIMA DEL SOAP
            const minimo_unids = typeof data?.cantidadMinima === 'number' ? data.cantidadMinima : null;

            // 📊 LOG CANTIDAD MÍNIMA FRONTEND
            console.log(`[Cofarsur] 🔵 SOAP Frontend - EAN: ${item.ean}, cantidadMinima: ${data?.cantidadMinima}, minimo_unids: ${minimo_unids}, mostrarán: ${minimo_unids > 1 ? 'SÍ' : 'NO'}`);

            return {
                ean: item.ean,
                stock,
                priceList,
                offerPrice,
                offers,
                error,
                minimo_unids,  // ✅ Agregar cantidad mínima
                _status: res.status
            };

        } catch (e) {
            console.warn('Error fetch Cofarsur individual', e?.message || e);
            return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], minimo_unids: null, _status: 0 };
        }
    });

    try {
        const results = await Promise.all(calls);
        console.log(`[Cofarsur] ✅ SOAP individual exitoso para ${items.length} productos`);
        return results;
    } catch (err) {
        console.error("Error en getPreciosCofarsurIndividual:", err?.message || err);
        return items.map(it => ({ ean: it.ean, stock: null, priceList: null, offerPrice: null, offers: [], minimo_unids: null, _status: 0 }));
    }
}

// Función auxiliar para consultas batch (REST)
async function getPreciosCofarsurBatch(items, sucursal, { f, baseHeaders, timeoutMs }) {
    console.log(`[Cofarsur] 🟢 Ejecutando REST batch para ${items.length} productos`);

    const controller = new AbortController();

    try {
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

        if (!res.ok) {
            console.warn('Cofarsur batch no-OK, fallback a individual', res.status);
            // Fallback a individual si falla el batch
            return await getPreciosCofarsurIndividual(items, sucursal, { f, baseHeaders, timeoutMs });
        }

        const data = await res.json(); // { error, resultados: { [ean]: {...} } }
        if (data.error) {
            console.warn('Cofarsur batch error, fallback a individual:', data.error);
            // Fallback a individual si hay error
            return await getPreciosCofarsurIndividual(items, sucursal, { f, baseHeaders, timeoutMs });
        }

        const resultados = data.resultados || {};

        console.log(`[Cofarsur] ✅ REST batch exitoso para ${items.length} productos`);

        // Mapeo al shape que usa el frontend (por EAN)
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
                minimo_unids: null,  // ⚠️ REST no maneja cantidades mínimas
                _status: res.status
            };
        });

    } catch (err) {
        console.warn('Error en getPreciosCofarsurBatch, fallback a individual:', err?.message || err);
        // Fallback a individual en caso de error de red
        return await getPreciosCofarsurIndividual(items, sucursal, { f, baseHeaders, timeoutMs });
    }
}

// Simula delay de red
const delay = (ms = 300) =>
    new Promise((res) => setTimeout(res, ms));
