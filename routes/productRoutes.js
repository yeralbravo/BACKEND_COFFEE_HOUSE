import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { uploadProductImages } from '../middleware/uploadMiddleware.js';
import {
    createProduct,
    findProductsBySupplier,
    updateProductById,
    deleteProductById,
    findAllPublicProducts,
    findProductById
} from '../models/Product.js';

const router = express.Router();

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

const productValidation = [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.'),
    body('tipo').trim().notEmpty().withMessage('El tipo es obligatorio.'),
    body('marca').trim().notEmpty().withMessage('La marca es obligatoria.'),
    body('precio').isDecimal({ decimal_digits: '1,2' }).withMessage('El precio debe ser un número válido.'),
    body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero no negativo.'),
    body('descripcion').trim().notEmpty().withMessage('La descripción es obligatoria.'),
    body('caracteristicas').optional({ checkFalsy: true }).isJSON(),
];

router.get('/public', async (req, res) => {
    try {
        const products = await findAllPublicProducts();
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error al obtener los productos públicos.' });
    }
});

router.post('/',
    [verifyToken, checkRole(['supplier']), uploadProductImages, ...productValidation],
    validateRequest,
    async (req, res) => {
        try {
            const productData = { supplier_id: req.user.id, ...req.body };
            const newProduct = await createProduct(productData, req.files);
            res.status(201).json({ success: true, message: '✅ Producto creado exitosamente', data: newProduct });
        } catch (error) {
            res.status(500).json({ success: false, error: '❌ Error interno al crear el producto.' });
        }
    }
);

router.get('/my-products', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const products = await findProductsBySupplier(req.user.id);
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error al obtener los productos del proveedor.' });
    }
});

router.put('/:id',
    [verifyToken, checkRole(['supplier']), uploadProductImages, param('id').isUUID().withMessage('El ID del producto debe ser un UUID válido.'), ...productValidation], // <--- 1. VALIDAMOS QUE EL ID SEA UUID
    validateRequest,
    async (req, res) => {
        try {
            // <--- 2. QUITAMOS parseInt()
            const result = await updateProductById(req.params.id, req.user.id, req.body, req.files);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado o sin permiso para editarlo.' });
            }
            res.status(200).json({ success: true, message: '✅ Producto actualizado correctamente.' });
        } catch (error) {
            res.status(500).json({ success: false, error: '❌ Error interno al actualizar el producto.' });
        }
    }
);

// <--- 3. CAMBIAMOS isInt() por isUUID() y QUITAMOS parseInt()
router.delete('/:id', [verifyToken, checkRole(['supplier']), param('id').isUUID().withMessage('El ID del producto debe ser un UUID válido.')], validateRequest, async (req, res) => {
    try {
        const result = await deleteProductById(req.params.id, req.user.id);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado o sin permiso para eliminarlo.' });
        }
        res.status(200).json({ success: true, message: '🗑️ Producto eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: '❌ Error interno al eliminar el producto.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await findProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
        }
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener el producto.' });
    }
});

export default router;