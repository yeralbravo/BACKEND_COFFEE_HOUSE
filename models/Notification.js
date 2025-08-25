import db from '../config/db.js';
import { findAllAdminIds } from './User.js';

export const createNotification = async (userId, message, linkUrl = null) => {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)',
            [userId, message, linkUrl]
        );
    } catch (error) {
        console.error('Error al crear la notificación:', error);
    }
};

export const findNotificationsByUserId = async (userId) => {
    try {
        // Establece el idioma a español para los nombres de los meses
        await db.query("SET lc_time_names = 'es_ES'");

        // Selecciona la fecha original y la fecha ya formateada
        const [notifications] = await db.query(
            'SELECT id, message, link_url, is_read, created_at, DATE_FORMAT(created_at, "%d de %M de %Y") as formatted_date FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [userId]
        );
        return notifications;
    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        throw error;
    }
};

export const markAllNotificationsAsRead = async (userId) => {
    try {
        const [result] = await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        return result;
    } catch (error) {
        console.error('Error al marcar todas las notificaciones como leídas:', error);
        throw error;
    }
};

export const deleteNotificationById = async (notificationId, userId) => {
    try {
        const [result] = await db.query(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
        return result;
    } catch (error) {
        console.error('Error al eliminar la notificación:', error);
        throw error;
    }
};

export const createNotificationForAllAdmins = async (message, linkUrl = null) => {
    try {
        const adminIds = await findAllAdminIds();
        if (adminIds.length === 0) return;

        const notifications = adminIds.map(adminId => [adminId, message, linkUrl]);
        
        await db.query(
            'INSERT INTO notifications (user_id, message, link_url) VALUES ?',
            [notifications]
        );
    } catch (error) {
        console.error('Error al crear notificación para todos los admins:', error);
    }
};