// services/sessionStorageService.js
// Servicio puro para manejo de sessionStorage con tipos específicos

const KEYS = {
    METADATOS_BULK: 'metadatosBulk'
};

/**
 * Servicio para gestionar metadatos de bulk en sessionStorage
 */
export class SessionStorageService {
    /**
     * Obtiene metadatos bulk del sessionStorage
     * @returns {Object} Metadatos por sucursal
     */
    static getMetadatosBulk() {
        try {
            const data = sessionStorage.getItem(KEYS.METADATOS_BULK);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error leyendo metadatos bulk:', error);
            return {};
        }
    }

    /**
     * Guarda metadatos bulk en sessionStorage
     * @param {Object} metadatos - Metadatos por sucursal
     */
    static setMetadatosBulk(metadatos) {
        try {
            sessionStorage.setItem(KEYS.METADATOS_BULK, JSON.stringify(metadatos));
        } catch (error) {
            console.error('Error guardando metadatos bulk:', error);
        }
    }

    /**
     * Limpia metadatos bulk del sessionStorage
     */
    static clearMetadatosBulk() {
        try {
            sessionStorage.removeItem(KEYS.METADATOS_BULK);
        } catch (error) {
            console.error('Error limpiando metadatos bulk:', error);
        }
    }

    /**
     * Obtiene metadatos de una sucursal específica
     * @param {string} sucursal - Código de sucursal
     * @returns {Object} Metadatos de la sucursal
     */
    static getMetadatosSucursal(sucursal) {
        const metadatos = this.getMetadatosBulk();
        return metadatos[sucursal] || {
            duplicados: 0,
            archivos: [],
            detallesDuplicados: []
        };
    }

    /**
     * Actualiza metadatos de una sucursal específica
     * @param {string} sucursal - Código de sucursal
     * @param {Object} nuevosMetadatos - Nuevos metadatos
     */
    static updateMetadatosSucursal(sucursal, nuevosMetadatos) {
        const metadatos = this.getMetadatosBulk();
        metadatos[sucursal] = nuevosMetadatos;
        this.setMetadatosBulk(metadatos);
    }
}

export default SessionStorageService;