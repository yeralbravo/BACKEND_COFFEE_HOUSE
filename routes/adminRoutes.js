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

router.get('/stats', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const stats = await getAdminDashboardStats({ range, startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas del admin:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

router.get('/stats/sales', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const stats = await getSalesStats({ range, startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de ventas.' });
    }
});

router.get('/stats/products', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const stats = await getProductStats({ range, startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de productos.' });
    }
});

router.get('/stats/users', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const stats = await getUserStats({ range, startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de usuarios.' });
    }
});

// --- RUTA MODIFICADA ---
router.get('/stats/orders', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const stats = await getOrderStats({ range, startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas de pedidos.' });
    }
});

export default router;