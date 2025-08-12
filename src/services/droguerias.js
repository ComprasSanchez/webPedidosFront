// Simulación de respuesta de las droguerías
// services/droguerias.js
import axios from "axios";
import { API_URL } from "../config/api";
import { http } from "../lib/http";


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

export async function getPreciosMonroe(carrito, sucursal) {
    try {
        const resultados = await Promise.all(
            carrito.map(async (item) => {
                const res = await fetch(
                    `${API_URL}/api/droguerias/monroe/${item.ean}?sucursal=${sucursal}&unidades=${item.unidades}`
                );
                const data = await res.json();
                return { ean: item.ean, ...data };
            })
        );
        return resultados;
    } catch (err) {
        console.error("Error en getPreciosMonroe:", err);
        return [];
    }
}


export async function getPreciosSuizo(carrito, sucursal) {
    try {
        const resultados = await Promise.all(
            carrito.map(async item => {
                const res = await fetch(
                    `${API_URL}/api/droguerias/suizo/${item.ean}?sucursal=${sucursal}`
                );
                const data = await res.json();
                return {
                    ean: item.ean,
                    ...data
                };
            })
        );
        return resultados;
    } catch (err) {
        console.error("Error en getPreciosSuizo:", err);
        return [];
    }
}


export const getPreciosCofarsur = async (carrito, sucursal) => {
    try {
        const calls = carrito.map((item) => {
            const url = `/api/droguerias/cofarsur/${encodeURIComponent(item.ean)}`;
            return http.get(url, { params: { sucursal }, validateStatus: s => s < 500 });
        });

        const responses = await Promise.all(calls);

        return responses.map((res, i) => ({
            ean: carrito[i].ean,
            ...res.data,
        }));
    } catch (err) {
        console.error("Error en getPreciosCofarsur:", err?.message || err);
        return [];
    }
};


// Simula delay de red
const delay = (ms = 300) =>
    new Promise((res) => setTimeout(res, ms));
