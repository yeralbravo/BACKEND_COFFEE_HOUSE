import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
// --- CORRECCIÓN AQUÍ ---
import { findNotificationsByUserId, markAllNotificationsAsRead, deleteNotificationById } from '../models/Notification.js';

const router = express.Router();

// Obtener notificaciones del usuario logueado
router.get('/', verifyToken, async (req, res) => {
    try {
        const notifications = await findNotificationsByUserId(req.user.id);
        res.status(200).json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener notificaciones.' });
    }
});

// Marcar todas las notificaciones como leídas
router.put('/read-all', verifyToken, async (req, res) => {
    try {
        await markAllNotificationsAsRead(req.user.id);
        res.status(200).json({ success: true, message: 'Notificaciones marcadas como leídas.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al actualizar las notificaciones.' });
    }
});

// Eliminar una notificación
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const result = await deleteNotificationById(req.params.id, req.user.id);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Notificación no encontrada.' });
        }
        res.status(200).json({ success: true, message: 'Notificación eliminada.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al eliminar la notificación.' });
    }
});

export default router;