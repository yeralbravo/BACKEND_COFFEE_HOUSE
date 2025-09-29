import db from '../config/db.js';

/**
 * Actualiza únicamente el stock de un ítem (producto o insumo).
 * @param {'product' | 'insumo'} itemType - El tipo de ítem.
 * @param {string} itemId - El ID (UUID) del ítem.
 * @param {number} supplierId - El ID del proveedor para seguridad.
 * @param {number} newStock - El nuevo valor del stock.
 * @returns {Promise<object>} El resultado de la consulta de actualización.
 */
export const updateStockById = async (itemType, itemId, supplierId, newStock) => {
    if (itemType !== 'product' && itemType !== 'insumo') {
        throw new Error('Tipo de ítem no válido.');
    }

    if (isNaN(newStock) || newStock < 0) {
        throw new Error('El valor del stock debe ser un número no negativo.');
    }

    const table = itemType === 'product' ? 'products' : 'insumos';
    
    const query = `UPDATE ${table} SET stock = ? WHERE id = ? AND supplier_id = ?`;
    
    try {
        const [result] = await db.query(query, [newStock, itemId, supplierId]);
        if (result.affectedRows === 0) {
            throw new Error('Ítem no encontrado o no tienes permiso para editarlo.');
        }
        return result;
    } catch (error) {
        console.error(`Error al actualizar stock para ${itemType}:`, error);
        throw error;
    }
};