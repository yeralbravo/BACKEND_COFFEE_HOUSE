import db from '../config/db.js';

export const getCartByUserId = async (userId) => {
    try {
        const [rows] = await db.query(
            `
            SELECT 
                ci.id AS cartItemId,
                ci.quantity,
                ci.product_id, 
                ci.insumo_id,
                CASE WHEN ci.product_id IS NOT NULL THEN p.id ELSE i.id END AS id,
                CASE WHEN ci.product_id IS NOT NULL THEN p.nombre ELSE i.nombre END AS nombre,
                CASE WHEN ci.product_id IS NOT NULL THEN p.precio ELSE i.precio END AS precio,
                CASE WHEN ci.product_id IS NOT NULL THEN p.stock ELSE i.stock END AS stock,
                
                p.tipo,
                i.categoria,
                
                CASE WHEN ci.product_id IS NOT NULL THEN p.marca ELSE i.marca END AS marca,
                CASE WHEN ci.product_id IS NOT NULL THEN 
                    (SELECT GROUP_CONCAT(pi.image_url) FROM product_images pi WHERE pi.product_id = p.id)
                ELSE 
                    (SELECT GROUP_CONCAT(ii.image_url) FROM insumo_images ii WHERE ii.insumo_id = i.id)
                END AS images
            FROM cart_items ci
            LEFT JOIN products p ON ci.product_id = p.id
            LEFT JOIN insumos i ON ci.insumo_id = i.id
            WHERE ci.user_id = ?
            `,
            [userId]
        );
        return rows.map(row => ({
            ...row,
            images: row.images ? row.images.split(',') : [],
            isProduct: !!row.product_id
        }));
    } catch (error) {
        console.error("Error al obtener el carrito por ID de usuario:", error);
        throw error;
    }
};

export const addItemToCart = async (userId, itemId, quantity, isProduct) => {
    try {
        const itemTypeColumn = isProduct ? "product_id" : "insumo_id";

        const [existingItem] = await db.query(
            `SELECT * FROM cart_items WHERE user_id = ? AND ${itemTypeColumn} = ?`,
            [userId, itemId]
        );

        if (existingItem.length > 0) {
            const [result] = await db.query(
                `UPDATE cart_items 
                 SET quantity = quantity + ? 
                 WHERE user_id = ? AND ${itemTypeColumn} = ?`,
                [quantity, userId, itemId]
            );
            return { message: "Cantidad actualizada en el carrito", result };
        } else {
            const [result] = await db.query(
                `INSERT INTO cart_items (user_id, ${itemTypeColumn}, quantity) 
                 VALUES (?, ?, ?)`,
                [userId, itemId, quantity]
            );
            return { message: "Ítem agregado al carrito", result };
        }
    } catch (error) {
        console.error("Error al agregar ítem al carrito:", error.message);
        throw error;
    }
};


export const updateCartItemQuantity = async (userId, itemId, quantity, isProduct) => {
    try {
        const itemTypeColumn = isProduct ? 'product_id' : 'insumo_id';
        const [result] = await db.query(
            `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND ${itemTypeColumn} = ?`,
            [quantity, userId, itemId]
        );
        return result;
    } catch (error) {
        console.error("Error al actualizar la cantidad del ítem en el carrito:", error);
        throw error;
    }
};

export const removeItemFromCart = async (userId, itemId, isProduct) => {
    try {
        const itemTypeColumn = isProduct ? 'product_id' : 'insumo_id';
        const [result] = await db.query(
            `DELETE FROM cart_items WHERE user_id = ? AND ${itemTypeColumn} = ?`,
            [userId, itemId]
        );
        return result;
    } catch (error) {
        console.error("Error al eliminar ítem del carrito:", error);
        throw error;
    }
};

export const clearCartByUserId = async (userId) => {
    try {
        const [result] = await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
        return result;
    } catch (error) {
        console.error("Error al vaciar el carrito:", error);
        throw error;
    }
};

// --- NUEVA FUNCIÓN AÑADIDA ---
export const removeMultipleItemsFromCart = async (userId, itemIds) => {
    if (!itemIds || itemIds.length === 0) {
        return { affectedRows: 0 };
    }
    try {
        const [result] = await db.query(
            'DELETE FROM cart_items WHERE user_id = ? AND id IN (?)',
            [userId, itemIds]
        );
        return result;
    } catch (error) {
        console.error("Error al eliminar múltiples ítems del carrito:", error);
        throw error;
    }
};