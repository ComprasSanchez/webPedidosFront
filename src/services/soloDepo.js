import { API_URL } from "../config/api";

// Trae los idPlex de productos marcados como solo-depósito (nunca pedir a droguería externa)
export async function fetchSoloDepo() {
    const res = await fetch(`${API_URL}/api/solo-depo`);
    if (!res.ok) throw new Error("No se pudieron cargar los productos solo-depósito");
    return res.json();
}
