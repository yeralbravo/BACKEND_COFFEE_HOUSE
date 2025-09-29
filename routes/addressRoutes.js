import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { findAddressesByUserId, createAddress, updateAddressById, deleteAddressById } from '../models/Address.js';

const router = express.Router();

// Obtener todas las direcciones de un usuario
router.get('/', verifyToken, async (req, res) => {
    try {
        const addresses = await findAddressesByUserId(req.user.id);
        res.status(200).json({ success: true, data: addresses });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener las direcciones.' });
    }
});

// Crear una nueva dirección
router.post('/', verifyToken, async (req, res) => {
    try {
        const newAddress = await createAddress(req.user.id, req.body);
        res.status(201).json({ success: true, data: newAddress, message: 'Dirección guardada con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al guardar la dirección.' });
    }
});

// ================== RUTA AÑADIDA ==================
// Actualizar una dirección existente
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const result = await updateAddressById(req.params.id, req.user.id, req.body);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Dirección no encontrada o sin permiso para editarla.' });
        }
        res.status(200).json({ success: true, message: 'Dirección actualizada con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al actualizar la dirección.' });
    }
});


// Eliminar una dirección
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const result = await deleteAddressById(req.params.id, req.user.id);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Dirección no encontrada o no te pertenece.' });
        }
        res.status(200).json({ success: true, message: 'Dirección eliminada.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al eliminar la dirección.' });
    }
});

export default router;