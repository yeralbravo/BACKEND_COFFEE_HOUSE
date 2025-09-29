import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { updateStockById } from '../models/Item.js';

const router = express.Router();

// Ruta para actualizar el stock de cualquier tipo de ítem (producto o insumo)
router.put('/:itemType/:itemId/stock', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const { itemType, itemId } = req.params;
        const { stock } = req.body;
        const supplierId = req.user.id;

        await updateStockById(itemType, itemId, supplierId, stock);
        
        res.status(200).json({ success: true, message: 'Stock actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Error interno al actualizar el stock.' });
    }
});

export default router;