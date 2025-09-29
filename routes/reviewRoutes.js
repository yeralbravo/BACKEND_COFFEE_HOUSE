import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { canUserReview, createReview, findReviewsByItemId } from '../models/Review.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Ruta para que un cliente cree una reseña
router.post('/',
    [
        verifyToken,
        body('orderItemId').isInt(),
        body('rating').isInt({ min: 1, max: 5 }),
        body('comment').optional().trim().isLength({ max: 500 }),
        body('type').isIn(['product', 'insumo']),
        // ================== AQUÍ ESTÁ LA CORRECCIÓN ==================
        // Cambiamos isInt() por isUUID() para que acepte el nuevo formato de ID.
        body('itemId').isUUID()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Este es el bloque que te está dando el error 400
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user.id;
        const { orderItemId, rating, comment, type, itemId } = req.body;

        try {
            const canReview = await canUserReview(userId, orderItemId);
            if (!canReview) {
                return res.status(403).json({ success: false, error: 'No puedes calificar este producto hasta que el pedido sea entregado.' });
            }

            const reviewData = {
                userId,
                productId: type === 'product' ? itemId : null,
                insumoId: type === 'insumo' ? itemId : null,
                orderItemId,
                rating,
                comment
            };

            await createReview(reviewData);
            res.status(201).json({ success: true, message: 'Gracias por tu reseña.' });

        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, error: 'Ya has calificado este producto.' });
            }
            res.status(500).json({ success: false, error: 'Error al guardar la reseña.' });
        }
    }
);

// Ruta pública para obtener las reseñas de un item
router.get('/:type/:itemId', async (req, res) => {
    try {
        const { type, itemId } = req.params;
        if (!['product', 'insumo'].includes(type)) {
            return res.status(400).json({ success: false, error: 'Tipo de item inválido.' });
        }
        
        const reviews = await findReviewsByItemId(type, itemId);
        res.status(200).json({ success: true, data: reviews });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener las reseñas.' });
    }
});

export default router;