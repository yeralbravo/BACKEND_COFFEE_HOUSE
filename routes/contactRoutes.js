import express from 'express';
import { body, validationResult } from 'express-validator';
import { createMessage, getAllMessages, findMessageById, addReplyToMessage } from '../models/ContactMessage.js';
import { createNotificationForAllAdmins } from '../models/Notification.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { sendEmail } from '../services/emailService.js';
import { logAdminActivity } from '../models/ActivityLog.js';

const router = express.Router();

// ... (ruta POST '/' sin cambios)
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
            await createMessage(req.body);
            const { name, message } = req.body;
            const notificationMessage = `Nuevo mensaje de ${name}: \"${message.substring(0, 50)}...\"`;
            await createNotificationForAllAdmins(notificationMessage, '/admin/support');
            res.status(200).json({ success: true, message: 'Mensaje enviado correctamente. ¡Gracias por contactarnos!' });
        } catch (error) {
            console.error("Error en el formulario de contacto:", error);
            res.status(500).json({ success: false, error: 'Error interno al procesar el mensaje.' });
        }
    }
);

// --- RUTA MODIFICADA ---
// Ahora filtra por estado (ej. /admin?status=pending)
router.get('/admin', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { status } = req.query;
        const messages = await getAllMessages(status);
        res.status(200).json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener los mensajes.' });
    }
});

// --- RUTA MODIFICADA ---
// Ahora también guarda la respuesta en la BD
router.post('/admin/:id/reply', [verifyToken, checkRole(['admin'])], async (req, res) => {
    const { id } = req.params;
    const { replyMessage } = req.body;
    const adminUser = req.user;

    if (!replyMessage || !replyMessage.trim()) {
        return res.status(400).json({ success: false, error: 'El mensaje de respuesta no puede estar vacío.' });
    }

    try {
        const originalMessage = await findMessageById(id);
        if (!originalMessage) {
            return res.status(404).json({ success: false, error: 'Mensaje original no encontrado.' });
        }

        // 1. Guardar la respuesta en la base de datos
        await addReplyToMessage(id, adminUser.id, replyMessage);

        // 2. Enviar el correo de notificación
        const emailSubject = `RE: Tu consulta en Coffee House`;
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="https://subir-imagen.com/images/2025/09/23/logo.png" alt="Logo de COFFEE HOUSE" style="width:120px; height:auto;"/>
                </div>
                <p>Hola ${originalMessage.name},</p>
                <p>Gracias por contactarnos. Aquí está la respuesta a tu consulta:</p>
                <div style="background-color: #f9f9f9; border-left: 4px solid #24651C; padding: 15px; margin: 20px 0;">
                    <p>${replyMessage.replace(/\n/g, '<br>')}</p>
                </div>
                <p>Saludos cordiales,<br>El equipo de Soporte de Coffee House</p>
                <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                <p style="font-size: 0.9em; color: #777;">
                    <strong>Tu mensaje original:</strong><br>
                    <em>"${originalMessage.message}"</em>
                </p>
            </div>
        `;
        await sendEmail(originalMessage.email, emailSubject, emailHtml);

        // 3. Registrar la actividad del admin
        await logAdminActivity(
            adminUser.id,
            `${adminUser.nombre} ${adminUser.apellido}`,
            'SUPPORT_MESSAGE_REPLIED',
            'contact_message',
            id,
            { repliedTo: originalMessage.name, email: originalMessage.email }
        );
        
        res.status(200).json({ success: true, message: 'Respuesta enviada y guardada exitosamente.' });

    } catch (error) {
        console.error("Error al enviar la respuesta:", error);
        res.status(500).json({ success: false, error: 'Error interno al enviar la respuesta.' });
    }
});

export default router;