import express from 'express';
import { body, validationResult } from 'express-validator';
import { createSupplierRequest, getAllSupplierRequests, updateRequestStatus, findRequestById, findRequestByEmail, findRequestByPhone, findRequestByNit } from '../models/SupplierRequest.js';
import { createUser, findUserByEmail, findUserByPhone } from '../models/User.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { logAdminActivity } from '../models/ActivityLog.js';
import { sendEmail } from '../services/emailService.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = express.Router();

router.post('/validate', async (req, res) => {
    const { field, value } = req.body;
    let userExists, requestExists;

    try {
        if (field === 'email') {
            userExists = await findUserByEmail(value);
            requestExists = await findRequestByEmail(value);
        } else if (field === 'phone') {
            userExists = await findUserByPhone(value);
            requestExists = await findRequestByPhone(value);
        } else if (field === 'nit') {
            requestExists = await findRequestByNit(value);
        } else {
            return res.status(400).json({ success: false, error: 'Campo no válido para validación.' });
        }

        if (userExists || requestExists) {
            const fieldName = { email: 'correo', phone: 'teléfono', nit: 'NIT' }[field];
            return res.status(200).json({ success: true, isTaken: true, message: `Este ${fieldName} ya está en uso.` });
        }

        return res.status(200).json({ success: true, isTaken: false });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Error en el servidor al validar.' });
    }
});

router.post('/',
    [
        body('company_name').trim().notEmpty().withMessage('El nombre de la empresa es obligatorio.'),
        body('nit').trim().notEmpty().withMessage('El NIT es obligatorio.'),
        body('contact_person').trim().notEmpty().withMessage('El nombre del contacto es obligatorio.'),
        body('email').isEmail().withMessage('Debe ser un correo electrónico válido.'),
        body('phone').trim().notEmpty().withMessage('El teléfono es obligatorio.'),
        body('product_types').trim().notEmpty().withMessage('Debe especificar qué tipo de productos ofrece.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, error: errors.array()[0].msg });
        }

        try {
            const request = await createSupplierRequest(req.body);
            res.status(201).json({
                success: true,
                message: 'Tu solicitud ha sido enviada. Nuestro equipo la revisará pronto.',
                data: request
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get('/admin', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { status } = req.query;
        const requests = await getAllSupplierRequests(status);
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener las solicitudes de proveedores.' });
    }
});

router.put('/admin/:id/status', [verifyToken, checkRole(['admin'])], async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const adminUser = req.user;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Estado no válido.' });
    }

    try {
        const request = await findRequestById(id);
        if (!request) {
            return res.status(404).json({ success: false, error: 'Solicitud no encontrada.' });
        }

        if (status === 'approved') {
            const emailExists = await findUserByEmail(request.email);
            if (emailExists) {
                await updateRequestStatus(id, 'rejected');
                return res.status(409).json({ success: false, error: `El correo ${request.email} ya está registrado en el sistema.` });
            }
            
            const phoneExists = await findUserByPhone(request.phone);
            if (phoneExists) {
                await updateRequestStatus(id, 'rejected');
                return res.status(409).json({ success: false, error: `El teléfono ${request.phone} ya está registrado en el sistema.` });
            }

            const tempPassword = crypto.randomBytes(8).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            
            const nameParts = request.contact_person.split(' ');
            const nombre = nameParts[0];
            const apellido = nameParts.slice(1).join(' ') || nombre;

            await createUser(nombre, apellido, request.phone, request.email, hashedPassword, 'supplier');
            
            //Código para enviar el correo con el logo
            const emailSubject = "¡Tu solicitud para ser proveedor ha sido aprobada!";
            const emailContent = `
                <div style="text-align: center;">
                    <img src="https://subir-imagen.com/images/2025/09/23/logo.png" alt="Logo de COFFEEHOUSE" style="width:120px; height:auto;"/>
                </div>
                <h1>Hola, ${request.contact_person}</h1>
                <p>¡Tu solicitud ha sido aprobada! 🎉 Ahora eres un proveedor registrado en COFFEE HOUSE.</p>
                <p>Aquí están tus credenciales para iniciar sesión:</p>
                <ul>
                    <li><strong>Correo:</strong> ${request.email}</li>
                    <li><strong>Contraseña temporal:</strong> <strong>${tempPassword}</strong></li>
                </ul>
                <p>Te recomendamos cambiar tu contraseña por una más segura después de tu primer inicio de sesión, la puedes cambiar en tu perfil, en la opcion modificar contraseña.</p>
            `;
            await sendEmail(request.email, emailSubject, emailContent);
        }

        await updateRequestStatus(id, status);

        const actionText = status === 'approved' ? 'aprobó' : 'rechazó';
        await logAdminActivity(
            adminUser.id,
            `${adminUser.nombre} ${adminUser.apellido}`,
            'SUPPLIER_REQUEST_UPDATED',
            'supplier_request',
            id,
            { 
                companyName: request.company_name,
                action: actionText
            }
        );

        res.status(200).json({ success: true, message: `Solicitud ${actionText} con éxito.` });

    } catch (error) {
        console.error("Error al actualizar el estado de la solicitud:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

export default router;