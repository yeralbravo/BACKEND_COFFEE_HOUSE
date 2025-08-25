import db from '../config/db.js';

/**
 * Guarda un nuevo mensaje de contacto en la base de datos.
 */
export const createMessage = async (messageData) => {
    const { name, email, phone, message } = messageData;
    const [result] = await db.query(
        'INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)',
        [name, email, phone, message]
    );
    return { id: result.insertId, ...messageData };
};

/**
 * Obtiene todos los mensajes de contacto para el panel de administración.
 */
export const getAllMessages = async () => {
    const [rows] = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    return rows;
};

/**
 * Marca un mensaje como leído.
 */
export const markMessageAsRead = async (messageId) => {
    const [result] = await db.query(
        'UPDATE contact_messages SET is_read = TRUE WHERE id = ?',
        [messageId]
    );
    return result;
};