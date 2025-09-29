import db from '../config/db.js';

export const createMessage = async (messageData) => {
    const { name, email, phone, message } = messageData;
    const [result] = await db.query(
        'INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)',
        [name, email, phone, message]
    );
    return { id: result.insertId, ...messageData };
};

// --- FUNCIÓN MODIFICADA ---
// Ahora puede filtrar por estado ('pending' o 'replied') y trae el nombre del admin que respondió.
export const getAllMessages = async (status = 'pending') => {
    const query = `
        SELECT 
            cm.*, 
            CONCAT(u.nombre, ' ', u.apellido) as admin_name
        FROM contact_messages cm
        LEFT JOIN users u ON cm.replied_by_admin_id = u.id
        WHERE cm.status = ?
        ORDER BY cm.created_at DESC
    `;
    const [rows] = await db.query(query, [status]);
    return rows;
};

export const findMessageById = async (messageId) => {
    const [rows] = await db.query('SELECT * FROM contact_messages WHERE id = ?', [messageId]);
    return rows[0];
};

// --- NUEVA FUNCIÓN ---
// Guarda la respuesta en la base de datos.
export const addReplyToMessage = async (messageId, adminId, replyMessage) => {
    const [result] = await db.query(
        `UPDATE contact_messages SET 
            status = 'replied', 
            replied_by_admin_id = ?, 
            reply_message = ?, 
            replied_at = NOW() 
        WHERE id = ?`,
        [adminId, replyMessage, messageId]
    );
    return result;
};