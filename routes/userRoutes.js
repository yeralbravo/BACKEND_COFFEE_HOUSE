import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { uploadProfilePicture } from '../middleware/uploadMiddleware.js';
import { 
    showUsers, 
    deleteUserById, 
    editUsers, 
    findUserById,
    createUser,
    findUserByEmail,
    findUserByPhone,
    getUserStats,
    changePassword
} from '../models/User.js';
import { logAdminActivity, getActivityLogs } from '../models/ActivityLog.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Ruta para ACTUALIZAR la foto de perfil
router.put('/:id/picture', [verifyToken, uploadProfilePicture], async (req, res) => {
    const userIdToUpdate = parseInt(req.params.id);

    if (req.user.id !== userIdToUpdate && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'No tienes permisos para esta acción.' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No se ha subido ninguna imagen.' });
    }

    try {
        const user = await findUserById(userIdToUpdate);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
        }

        if (user.profile_picture_url) {
            const oldPath = path.join(path.resolve(), user.profile_picture_url);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const newImagePath = req.file.path.replace(/\\/g, '/');
        await editUsers(userIdToUpdate, { profile_picture_url: newImagePath });

        res.status(200).json({ 
            success: true, 
            message: 'Foto de perfil actualizada correctamente.',
            data: { profile_picture_url: newImagePath }
        });

    } catch (error) {
        console.error("Error al actualizar la foto de perfil:", error);
        res.status(500).json({ success: false, error: 'Error interno al actualizar la foto.' });
    }
});

// Ruta para ELIMINAR la foto de perfil
router.delete('/:id/picture', verifyToken, async (req, res) => {
    const userIdToDeletePic = parseInt(req.params.id);

    if (req.user.id !== userIdToDeletePic && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'No tienes permisos para esta acción.' });
    }

    try {
        const user = await findUserById(userIdToDeletePic);
        if (!user || !user.profile_picture_url) {
            return res.status(404).json({ success: false, error: 'El usuario no tiene foto de perfil para eliminar.' });
        }

        const imagePath = path.join(path.resolve(), user.profile_picture_url);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await editUsers(userIdToDeletePic, { profile_picture_url: null });

        res.status(200).json({ success: true, message: 'Foto de perfil eliminada correctamente.' });

    } catch (error) {
        console.error("Error al eliminar la foto de perfil:", error);
        res.status(500).json({ success: false, error: 'Error interno al eliminar la foto.' });
    }
});

// Ruta para obtener todos los usuarios (admin)
router.get('/admin', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { role, search } = req.query;
    const users = await showUsers(role, search);
    res.json({ success: true, data: { users } });
  } catch (error) {
    res.status(500).json({ success: false, error: '❌ Error al obtener usuarios' });
  }
});

// Ruta para estadísticas de usuarios (admin)
router.get('/admin/stats', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const { range } = req.query;
        const stats = await getUserStats(range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error al obtener las estadísticas' });
    }
});

// Ruta para registro de actividad (admin)
router.get('/admin/activity-log', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const filters = {
            adminName: req.query.adminName,
            action: req.query.action,
            date: req.query.date,
        };
        const logs = await getActivityLogs(filters);
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error al obtener el registro de actividad' });
    }
});

// Ruta para crear un usuario (admin)
router.post('/admin/create-user', 
    [
        verifyToken, 
        checkRole(['admin']),
        body('nombre').trim().notEmpty().matches(/^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/),
        body('apellido').trim().notEmpty().matches(/^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/),
        body('telefono').isNumeric().isLength({ min: 10, max: 10 }),
        body('correo').isEmail().normalizeEmail(),
        body('contraseña').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
        body('role').isIn(['client', 'admin', 'supplier'])
    ], 
    async (req, res) => {
        const { nombre, apellido, telefono, correo, contraseña, role } = req.body;
        try {
            const emailExists = await findUserByEmail(correo);
            if (emailExists) return res.status(409).json({ success: false, error: 'El correo electrónico ya está registrado.' });
            const phoneExists = await findUserByPhone(telefono);
            if (phoneExists) return res.status(409).json({ success: false, error: 'El número de teléfono ya está registrado.' });
            const result = await createUser(nombre, apellido, telefono, correo, contraseña, role);
            await logAdminActivity(req.user.id, `${req.user.nombre} ${req.user.apellido}`, 'USER_CREATED', role, result.insertId, { createdUserName: `${nombre} ${apellido}`, createdUserEmail: correo, createdUserRole: role });
            res.status(201).json({ success: true, message: `✅ Usuario con rol '${role}' registrado exitosamente` });
        } catch (error) {
            res.status(500).json({ success: false, error: `❌ Error interno al registrar ${role}` });
        }
    }
);

// Ruta para obtener un usuario por ID
router.get('/:id', verifyToken, [param('id').isInt()], async (req, res) => {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '❌ No tienes permisos' });
    }
    try {
      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: '❌ Error al obtener el usuario' });
    }
});

// Ruta para actualizar un usuario por ID
router.put('/:id', 
    [
        verifyToken, 
        param('id').isInt(),
        body('nombre').optional().trim().notEmpty(),
        body('apellido').optional().trim().notEmpty(),
        body('telefono').optional().isNumeric().isLength({ min: 10, max: 10 }),
        body('correo').optional().isEmail().normalizeEmail(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, error: errors.array()[0].msg });
        }

        const userIdToUpdate = parseInt(req.params.id);
        const adminUser = req.user;

        if (adminUser.id !== userIdToUpdate && adminUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: '❌ No tienes permisos para actualizar este usuario' });
        }

        try {
            const allowedFields = ['nombre', 'apellido', 'telefono', 'correo', 'role'];
            const fieldsToUpdate = {};
            
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    fieldsToUpdate[field] = req.body[field];
                }
            });

            if (Object.keys(fieldsToUpdate).length === 0) {
                return res.status(400).json({ success: false, error: 'No se proporcionaron campos para actualizar' });
            }
            
            if (adminUser.role === 'admin' && adminUser.id !== userIdToUpdate) {
                const userBeforeUpdate = await findUserById(userIdToUpdate);
                if (userBeforeUpdate) {
                    const changes = [];
                    for (const key in fieldsToUpdate) {
                        if (userBeforeUpdate[key] !== fieldsToUpdate[key]) {
                            changes.push({
                                field: key,
                                from: userBeforeUpdate[key],
                                to: fieldsToUpdate[key]
                            });
                        }
                    }
                    if (changes.length > 0) {
                        await logAdminActivity(
                            adminUser.id, 
                            `${adminUser.nombre} ${adminUser.apellido}`, 
                            'USER_UPDATED', 
                            userBeforeUpdate.role, 
                            userIdToUpdate, 
                            { 
                                updatedUserName: `${userBeforeUpdate.nombre} ${userBeforeUpdate.apellido}`,
                                updatedUserRole: userBeforeUpdate.role,
                                changes 
                            }
                        );
                    }
                }
            }

            await editUsers(userIdToUpdate, fieldsToUpdate);
            res.status(200).json({ success: true, message: 'Usuario actualizado correctamente' });
        } catch (error) {
            console.error("Error en PUT /api/user/:id", error);
            res.status(500).json({ success: false, error: error.message || 'Error interno al actualizar usuario' });
        }
    }
);

// Ruta para eliminar un usuario por ID
router.delete('/:id', verifyToken, [param('id').isInt()], async (req, res) => {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: '❌ No tienes permisos para eliminar este usuario' });
    }
    try {
        if (req.user.role === 'admin' && req.user.id !== userId) {
            const userToDelete = await findUserById(userId);
            if (userToDelete) {
                await logAdminActivity(req.user.id, `${req.user.nombre} ${req.user.apellido}`, 'USER_DELETED', userToDelete.role, userId, { deletedUserName: `${userToDelete.nombre} ${userToDelete.apellido}`, deletedUserRole: userToDelete.role, deletedUserEmail: userToDelete.correo });
            }
        }
        const result = await deleteUserById(userId);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        const message = req.user.id === userId ? '✅ Cuenta eliminada correctamente' : '✅ Usuario eliminado por el administrador';
        res.status(200).json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error al eliminar' });
    }
});

// Ruta para cambiar la contraseña
router.post('/change-password', 
    [
        verifyToken,
        body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria.'),
        body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres.')
                           .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
                           .withMessage('La nueva contraseña debe contener mayúscula, minúscula, número y carácter especial.'),
        body('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Las nuevas contraseñas no coinciden.');
            }
            return true;
        }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, error: errors.array()[0].msg });
        }

        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        try {
            const result = await changePassword(userId, currentPassword, newPassword);
            if (!result.success) {
                return res.status(401).json({ success: false, error: result.error });
            }
            res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente.' });
        } catch (error) {
            console.error("Error en la ruta de cambio de contraseña:", error);
            res.status(500).json({ success: false, error: 'Error interno del servidor.' });
        }
    }
);

export default router;
