import { API_URL } from "../config/api";

// Hardcode de portales externos (sin API)
export const EXTERNOS = {
    kellerhoff: { nombre: "Kellerof", url: "https://kellerhoff.com/compras" },
    // si sumás otros externos, agregalos acá
};

// Trae reglas normalizadas por sucursal
export async function fetchConvenios(sucursal_codigo) {
    const res = await fetch(`${API_URL}/api/convenios?sucursal=${encodeURIComponent(sucursal_codigo)}`);
    if (!res.ok) throw new Error("No se pudieron cargar los convenios");
    // Esperamos { byEAN: { [ean]: ["deposito","kellerhoff","suizo"] }, byLAB: { [CodLab]: [...] } }
    return res.json();
}

// Matchea si el item tiene convenio por EAN o LAB (CodLab/laboratorio)
export function matchConvenio(item, reglas) {
    if (!reglas) return { aplica: false, prioridad: [], fuente: null };

    if (item.ean && reglas.byEAN?.[item.ean]) {
        return { aplica: true, prioridad: reglas.byEAN[item.ean], fuente: "EAN" };
    }
    const labKey = item.CodLab ?? item.laboratorio ?? null;
    if (labKey && reglas.byLAB?.[labKey]) {
        return { aplica: true, prioridad: reglas.byLAB[labKey], fuente: "LAB" };
    }
    return { aplica: false, prioridad: [], fuente: null };
}
