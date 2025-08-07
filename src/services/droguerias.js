// Simulación de respuesta de las droguerías
// services/droguerias.js
import axios from "axios";

export const getStockDeposito = async (carrito, sucursalCodigo) => {
    if (!sucursalCodigo) {
        console.warn("❌ No se recibió sucursalCodigo para consultar stock");
        return [];
    }

    const eanUnicos = [...new Set(carrito.map((item) => item.ean))];

    const resultados = await Promise.all(
        eanUnicos.map(async (ean) => {
            try {
                const res = await fetch(
                    `http://localhost:4000/api/stock/quantio/${ean}?sucursal=${sucursalCodigo}`
                );
                const data = await res.json();
                return { ean, stock: data.stock ?? 0, error: data.error ?? null };
            } catch (err) {
                console.error("Error consultando stock Quantio:", err);
                return { ean, stock: "-", error: "ERROR_CONEXION" };
            }
        })
    );

    return resultados;
};


export async function getPreciosMonroe(carrito, sucursal) {
    try {
        const resultados = await Promise.all(
            carrito.map(async (item) => {
                const res = await fetch(
                    `http://localhost:4000/api/droguerias/monroe/${item.ean}?sucursal=${sucursal}&unidades=${item.unidades}`
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
                    `http://localhost:4000/api/droguerias/suizo/${item.ean}?sucursal=${sucursal}`
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
    console.log(`🔍 Consultando Cofarsur para ${carrito.length} productos en sucursal: ${sucursal}`);

    try {
        const responses = await Promise.all(
            carrito.map((item) => {
                console.log("➡️ Llamando a:", `/api/droguerias/cofarsur/${item.ean}`);

                return axios.get(`/api/droguerias/cofarsur/${item.ean}`, {
                    params: { sucursal },
                });
            })
        );

        return responses.map((res, i) => ({
            ean: carrito[i].ean,
            ...res.data,
        }));
    } catch (err) {
        console.error("Error en getPreciosCofarsur:", err);
        return [];
    }
};




// Simula delay de red
const delay = (ms = 300) =>
    new Promise((res) => setTimeout(res, ms));
