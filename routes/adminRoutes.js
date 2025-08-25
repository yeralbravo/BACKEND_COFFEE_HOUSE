import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { 
    getAdminDashboardStats,
    getSalesStats, 
    getProductStats, 
    getUserStats, 
    getOrderStats 
} from '../models/AdminStats.js';

const router = express.Router();

// Ruta para el Dashboard principal
router.get('/stats', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { range } = req.query;
        const stats = await getAdminDashboardStats(range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas del admin:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// Rutas para las páginas de estadísticas específicas
router.get('/stats/sales', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const stats = await getSalesStats(req.query.range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de ventas.' });
    }
});

router.get('/stats/products', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const stats = await getProductStats(req.query.range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de productos.' });
    }
});

router.get('/stats/users', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const stats = await getUserStats(req.query.range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de usuarios.' });
    }
});

router.get('/stats/orders', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const stats = await getOrderStats(req.query.range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de pedidos.' });
    }
});

export default router;