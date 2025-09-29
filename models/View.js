import db from '../config/db.js';

/**
 * Registra una vista para un producto o insumo en la fecha actual.
 * Si ya existe un registro para ese item en el día, incrementa el contador.
 * Si no, crea un nuevo registro.
 */
export const recordView = async ({ productId = null, insumoId = null }) => {
    try {
        const query = `
            INSERT INTO views (product_id, insumo_id, view_date, view_count)
            VALUES (?, ?, CURDATE(), 1)
            ON DUPLICATE KEY UPDATE view_count = view_count + 1;
        `;
        await db.query(query, [productId, insumoId]);
    } catch (error) {
        // No lanzamos un error aquí para no detener la carga de la página del producto,
        // pero sí lo registramos en la consola del servidor para depuración.
        console.error("Error al registrar la vista:", error.message);
    }
};