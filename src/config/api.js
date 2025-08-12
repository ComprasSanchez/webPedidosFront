// front/src/config/api.js
const envUrl = import.meta.env.VITE_API_URL;
if (!envUrl && import.meta.env.PROD) {
    // Aviso fuerte en consola si alguien olvidó configurar la URL en prod
    console.error('VITE_API_URL no está definida en producción');
}
export const API_URL = envUrl || 'http://localhost:4000';
