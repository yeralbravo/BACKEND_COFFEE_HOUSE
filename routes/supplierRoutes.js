import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { 
    getSupplierDashboardStats, 
    getSupplierSalesReport, 
    getSupplierProductStats, 
    getSupplierOrderStats,
    getLowStockItems 
} from '../models/SupplierStats.js';

const router = express.Router();

router.get('/stats', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { range } = req.query;
        const stats = await getSupplierDashboardStats(supplierId, range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas del proveedor:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

router.get('/sales-report', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { range } = req.query;
        const report = await getSupplierSalesReport(supplierId, range);
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        console.error("Error al obtener el reporte de ventas:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

router.get('/product-stats', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const stats = await getSupplierProductStats(supplierId);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas de productos:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

router.get('/order-stats', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { range } = req.query;
        const stats = await getSupplierOrderStats(supplierId, range);
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas de pedidos:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

router.get('/low-stock-items', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const items = await getLowStockItems(supplierId);
        res.status(200).json({ success: true, data: items });
    } catch (error) {
        console.error("Error al obtener ítems con bajo stock:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

export default router;