import express from 'express';
import { body, validationResult } from 'express-validator';
import { createSupplierRequest, getAllSupplierRequests, updateRequestStatus, findRequestById, findRequestByEmail, findRequestByPhone, findRequestByNit } from '../models/SupplierRequest.js';
import { createUser, findUserByEmail, findUserByPhone } from '../models/User.js';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import crypto from 'crypto';

const router = express.Router();

// Ruta de validación en tiempo real para email, teléfono y NIT
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
        } else if (field === 'nit') { // <-- LÓGICA AÑADIDA
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


// Ruta pública para que un proveedor envíe su solicitud
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

// Ruta protegida para que los administradores vean las solicitudes
router.get('/admin', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { status } = req.query;
        const requests = await getAllSupplierRequests(status);
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener las solicitudes de proveedores.' });
    }
});

// Ruta para actualizar estado (Aprobar/Rechazar)
router.put('/admin/:id/status', [verifyToken, checkRole(['admin'])], async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

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
            const nameParts = request.contact_person.split(' ');
            const nombre = nameParts[0];
            const apellido = nameParts.slice(1).join(' ') || nombre;

            await createUser(nombre, apellido, request.phone, request.email, tempPassword, 'supplier');
            
            console.log(`\n--- NUEVO PROVEEDOR APROBADO ---`);
            console.log(`Email: ${request.email}`);
            console.log(`Contraseña Temporal: ${tempPassword}`);
            console.log(`---------------------------------\n`);
        }

        await updateRequestStatus(id, status);
        res.status(200).json({ success: true, message: `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'} con éxito.` });

    } catch (error) {
        console.error("Error al actualizar el estado de la solicitud:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

export default router;