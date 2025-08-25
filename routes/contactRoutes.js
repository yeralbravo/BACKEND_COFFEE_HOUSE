import express from 'express';
import { body, validationResult } from 'express-validator';
import { createMessage, getAllMessages, markMessageAsRead } from '../models/ContactMessage.js';
import { createNotificationForAllAdmins } from '../models/Notification.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ruta pública para que un usuario envíe un mensaje de contacto
router.post('/',
    [
        body('name').trim().notEmpty().withMessage('El nombre es obligatorio.'),
        body('email').isEmail().withMessage('El correo no es válido.'),
        body('message').trim().notEmpty().withMessage('El mensaje es obligatorio.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, error: errors.array()[0].msg });
        }

        try {
            // 1. Guardar el mensaje en la base de datos
            await createMessage(req.body);

            // 2. Crear una notificación para todos los administradores
            const { name, message } = req.body;
            const notificationMessage = `Nuevo mensaje de ${name}: "${message.substring(0, 50)}..."`;
            await createNotificationForAllAdmins(notificationMessage, '/admin/support');

            res.status(200).json({ success: true, message: 'Mensaje enviado correctamente. ¡Gracias por contactarnos!' });

        } catch (error) {
            console.error("Error en el formulario de contacto:", error);
            res.status(500).json({ success: false, error: 'Error interno al procesar el mensaje.' });
        }
    }
);

// Ruta protegida para que los administradores vean los mensajes
router.get('/admin', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const messages = await getAllMessages();
        res.status(200).json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener los mensajes.' });
    }
});

// Ruta protegida para marcar un mensaje como leído
router.put('/admin/:id/read', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        const result = await markMessageAsRead(id);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Mensaje no encontrado.' });
        }
        res.status(200).json({ success: true, message: 'Mensaje marcado como leído.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al actualizar el mensaje.' });
    }
});


export default router;