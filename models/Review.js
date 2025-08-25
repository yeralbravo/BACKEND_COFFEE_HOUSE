import db from '../config/db.js';

/**
 * Verifica si un usuario puede dejar una reseña para un item de una orden.
 * El pedido debe estar 'Entregado'.
 */
export const canUserReview = async (userId, orderItemId) => {
    const [rows] = await db.query(
        `SELECT o.status 
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE o.user_id = ? AND oi.id = ?`,
        [userId, orderItemId]
    );
    return rows.length > 0 && rows[0].status === 'Entregado';
};

/**
 * Crea una nueva reseña.
 */
export const createReview = async (reviewData) => {
    const { userId, productId, insumoId, orderItemId, rating, comment } = reviewData;
    const [result] = await db.query(
        'INSERT INTO reviews (user_id, product_id, insumo_id, order_item_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, productId, insumoId, orderItemId, rating, comment]
    );
    return { id: result.insertId };
};

/**
 * Obtiene todas las reseñas de un producto o insumo específico.
 */
export const findReviewsByItemId = async (type, itemId) => {
    const field = type === 'product' ? 'r.product_id' : 'r.insumo_id';
    const [reviews] = await db.query(
        `SELECT r.rating, r.comment, u.nombre, u.apellido, r.created_at
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE ${field} = ?
         ORDER BY r.created_at DESC`,
        [itemId]
    );
    return reviews;
};