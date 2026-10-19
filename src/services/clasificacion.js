import { API_URL } from "../config/api";

// Trae los idPlex clasificados según clusters: { perfumeria: [...], medicamento: [...] }
export async function fetchClasificacion() {
    const res = await fetch(`${API_URL}/api/clasificacion`);
    if (!res.ok) throw new Error("No se pudo cargar la clasificación de productos");
    return res.json();
}
