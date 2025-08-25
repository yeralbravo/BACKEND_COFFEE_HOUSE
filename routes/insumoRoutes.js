import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { uploadInsumoImages } from '../middleware/uploadMiddleware.js';
import { 
    createInsumo, 
    findInsumosBySupplier,
    updateInsumoById,
    deleteInsumoById,
    findAllPublicInsumos,
    findInsumoById
} from '../models/Insumo.js';

const router = express.Router();

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

const insumoValidation = [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.'),
    body('categoria').trim().notEmpty().withMessage('La categoría es obligatoria.'),
    body('marca').trim().optional(),
    body('precio').isDecimal({ decimal_digits: '1,2' }).withMessage('El precio debe ser un número válido.'),
    body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero no negativo.'),
    body('descripcion').trim().notEmpty().withMessage('La descripción es obligatoria.'),
    body('caracteristicas').optional({ checkFalsy: true }).isJSON(),
];

router.get('/public', async (req, res) => {
    try {
        const insumos = await findAllPublicInsumos();
        res.status(200).json({ success: true, data: insumos });
    } catch (error) {
        console.error("Error en GET /api/insumos/public:", error);
        res.status(500).json({ success: false, error: 'Error al obtener los insumos.' });
    }
});

router.get('/my-insumos', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const insumos = await findInsumosBySupplier(req.user.id);
        res.status(200).json({ success: true, data: insumos });
    } catch (error) {
        console.error("Error al obtener mis insumos:", error);
        res.status(500).json({ success: false, error: '❌ Error al obtener los insumos del proveedor.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const insumo = await findInsumoById(req.params.id);
        if (!insumo) {
            return res.status(404).json({ success: false, error: 'Insumo no encontrado.' });
        }
        res.status(200).json({ success: true, data: insumo });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener el insumo.' });
    }
});

router.post('/',
    [
        verifyToken,
        checkRole(['supplier']),
        uploadInsumoImages,
        ...insumoValidation
    ],
    validateRequest,
    async (req, res) => {
        try {
            const insumoData = {
                supplier_id: req.user.id,
                ...req.body,
                caracteristicas: req.body.caracteristicas || null
            };
            const newInsumo = await createInsumo(insumoData, req.files);
            res.status(201).json({ success: true, message: '✅ Insumo creado exitosamente', data: newInsumo });
        } catch (error) {
            console.error("Error al crear insumo:", error);
            res.status(500).json({ success: false, error: '❌ Error interno al crear el insumo.' });
        }
    }
);

router.put('/:id',
    [verifyToken, checkRole(['supplier']), uploadInsumoImages, param('id').isUUID().withMessage('El ID del insumo debe ser un UUID válido.'), ...insumoValidation], // <--- 1. VALIDAMOS QUE EL ID SEA UUID
    validateRequest,
    async (req, res) => {
        try {
            // <--- 2. QUITAMOS parseInt()
            const result = await updateInsumoById(req.params.id, req.user.id, req.body, req.files);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Insumo no encontrado o sin permiso para editarlo.' });
            }
            res.status(200).json({ success: true, message: '✅ Insumo actualizado correctamente.' });
        } catch (error) {
            res.status(500).json({ success: false, error: '❌ Error interno al actualizar el insumo.' });
        }
    }
);

// <--- 3. CAMBIAMOS isInt() por isUUID() y QUITAMOS parseInt()
router.delete('/:id', [verifyToken, checkRole(['supplier']), param('id').isUUID().withMessage('El ID del insumo debe ser un UUID válido.')], validateRequest, async (req, res) => {
    try {
        const result = await deleteInsumoById(req.params.id, req.user.id);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Insumo no encontrado o sin permiso para eliminarlo.' });
        }
        res.status(200).json({ success: true, message: '🗑️ Insumo eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error interno al eliminar el insumo.' });
    }
});

export default router;