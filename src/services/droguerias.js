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

export const getStockDeposito = async (carrito, sucursalCodigo) => {
    if (!sucursalCodigo) {
        console.warn("❌ No se recibió sucursalCodigo para consultar stock");
        return [];
    }

    const eanUnicos = [...new Set(carrito.map((item) => item.ean))];

    try {
        const res = await fetch(`${API_URL}/api/stock/quantio/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
            body: JSON.stringify({ sucursal: sucursalCodigo, eans: eanUnicos }),
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("Batch stock HTTP", res.status, txt);
            return eanUnicos.map(ean => ({ ean, stock: "-", error: "HTTP_ERROR" }));
        }

        const data = await res.json(); // [{ean, stock}]
        // Mapear a salida alineada al carrito (por si hay repetidos)
        const map = new Map(data.map(d => [String(d.ean), d]));
        return carrito.map(item => {
            const d = map.get(String(item.ean));
            return { ean: item.ean, stock: d ? d.stock : "-", error: d?.error || null };
        });
    } catch (err) {
        console.error("Error consultando stock Quantio (batch):", err);
        return carrito.map(item => ({ ean: item.ean, stock: "-", error: "ERROR_CONEXION" }));
    }
};

export async function getPreciosMonroe(carrito, sucursal, opts = {}) {
    const f = opts.fetch || nativeFetch;
    const baseHeaders = opts.headers || {};

    try {
        const calls = carrito.map(async (item) => {
            const url = `${API_URL}/api/droguerias/monroe/${encodeURIComponent(item.ean)}?sucursal=${encodeURIComponent(sucursal)}&unidades=${encodeURIComponent(item.unidades)}`;

            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 12000);

            try {
                const res = await f(url, { headers: { ...baseHeaders }, signal: controller.signal });

                // si hay 401/403 devolvemos estructura “vacía” para no romper la UI
                if (!res.ok) {
                    console.warn('Monroe no-OK', res.status);
                    return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: res.status };
                }

                const data = await res.json();
                // normalizamos por seguridad
                const stock = data?.stock === true;
                const priceList = typeof data?.priceList === 'number' ? data.priceList : null;
                const offerPrice = typeof data?.offerPrice === 'number' ? data.offerPrice : null;
                const offers = Array.isArray(data?.offers) ? data.offers : [];

                return { ean: item.ean, stock, priceList, offerPrice, offers, _status: res.status };
            } catch (e) {
                console.warn('Error fetch Monroe', e?.message || e);
                return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: 0 };
            } finally {
                clearTimeout(id);
            }
        });

        return await Promise.all(calls);
    } catch (err) {
        console.error("Error en getPreciosMonroe:", err?.message || err);
        return carrito.map(it => ({ ean: it.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: 0 }));
    }
}

export async function getPreciosSuizo(
    carrito,
    sucursal,
    opts = {}
) {
    const f = opts.fetch || nativeFetch;
    const baseHeaders = opts.headers || {};
    const timeoutMs = opts.timeoutMs ?? 12000;

    const calls = carrito.map(async (item) => {
        const url = `${API_URL}/api/droguerias/suizo/${encodeURIComponent(item.ean)}?sucursal=${encodeURIComponent(sucursal)}`;
        const controller = new AbortController();

        try {
            const res = await withTimeout(
                f(url, { headers: { ...baseHeaders }, signal: controller.signal }),
                timeoutMs,
                controller
            );

            if (!res.ok) {
                console.warn('Suizo no-OK', res.status);
                return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: res.status };
            }

            const data = await res.json();
            console.log(`🔍 Suizo respuesta para ${item.ean}:`, JSON.stringify(data, null, 2));

            const stock = data?.stock === true;
            const priceList = typeof data?.priceList === 'number' ? data.priceList : null;
            const offerPrice = typeof data?.offerPrice === 'number' ? data.offerPrice : null;
            const offers = Array.isArray(data?.offers) ? data.offers : [];
            const error = typeof data?.error === 'string' ? data.error : null;

            console.log(`📊 Suizo datos procesados para ${item.ean}:`, {
                stock,
                priceList,
                offerPrice,
                offers,
                error
            });

            return { ean: item.ean, stock, priceList, offerPrice, offers, error, _status: res.status };

        } catch (e) {
            console.warn('Error fetch Suizo', e?.message || e);
            return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: 0 };
        }
    });

    try {
        return await Promise.all(calls);
    } catch (err) {
        console.error("Error en getPreciosSuizo:", err?.message || err);
        return carrito.map(it => ({ ean: it.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: 0 }));
    }
}


export async function getPreciosCofarsur(
    carrito,
    sucursal,
    opts = {}
) {
    const f = opts.fetch || nativeFetch;
    const baseHeaders = opts.headers || {};
    const timeoutMs = opts.timeoutMs ?? 12000;

    const calls = carrito.map(async (item) => {
        const url = `${API_URL}/api/droguerias/cofarsur/${encodeURIComponent(item.ean)}?sucursal=${encodeURIComponent(sucursal)}`;
        const controller = new AbortController();

        try {
            const res = await withTimeout(
                f(url, { headers: { ...baseHeaders }, signal: controller.signal }),
                timeoutMs,
                controller
            );

            if (!res.ok) {
                console.warn('Cofarsur no-OK', res.status);
                return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: res.status };
            }

            const data = await res.json();
            const stock = data?.stock === true;
            const priceList = typeof data?.priceList === 'number' ? data.priceList : null;
            const offerPrice = typeof data?.offerPrice === 'number' ? data.offerPrice : null;
            const offers = Array.isArray(data?.offers) ? data.offers : [];
            const error = typeof data?.error === 'string' ? data.error : null;

            return { ean: item.ean, stock, priceList, offerPrice, offers, error, _status: res.status };

        } catch (e) {
            console.warn('Error fetch Cofarsur', e?.message || e);
            return { ean: item.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: 0 };
        }
    });

    try {
        return await Promise.all(calls);
    } catch (err) {
        console.error("Error en getPreciosCofarsur:", err?.message || err);
        return carrito.map(it => ({ ean: it.ean, stock: null, priceList: null, offerPrice: null, offers: [], _status: 0 }));
    }
}


// Simula delay de red
const delay = (ms = 300) =>
    new Promise((res) => setTimeout(res, ms));
