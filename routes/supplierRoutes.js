import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { 
    getSupplierDashboardStats, 
    getSupplierSalesReport, 
    getSupplierProductStats, 
    getSupplierOrderStats,
    getLowStockItems
} from '../models/SupplierStats.js';
import { findSupplierOrderDetails } from '../models/Order.js';

const router = express.Router();

// --- RUTA DE ESTADÍSTICAS DEL DASHBOARD ---
router.get('/stats', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Se requieren parámetros startDate y endDate.' });
        }
        
        const stats = await getSupplierDashboardStats(supplierId, { startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas del proveedor:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// --- RUTA DEL REPORTE DE VENTAS ---
router.get('/sales-report', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Se requieren parámetros startDate y endDate.' });
        }
        
        const report = await getSupplierSalesReport(supplierId, { startDate, endDate });
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        console.error("Error al obtener el reporte de ventas:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// ================== RUTA ACTUALIZADA ==================
// --- RUTA DE ESTADÍSTICAS DE PRODUCTOS ---
router.get('/product-stats', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        // Leemos las fechas que ahora envía el frontend
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Se requieren parámetros startDate y endDate.' });
        }
        // Pasamos las fechas a la función del modelo
        const stats = await getSupplierProductStats(supplierId, { startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas de productos:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});
// ================== FIN DE LA MODIFICACIÓN ==================


// --- RUTA DE ESTADÍSTICAS DE PEDIDOS ---
router.get('/order-stats', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Se requieren parámetros startDate y endDate.' });
        }

        const stats = await getSupplierOrderStats(supplierId, { startDate, endDate });
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error al obtener estadísticas de pedidos:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// --- RUTA DE DETALLES DE UN PEDIDO ESPECÍFICO ---
router.get('/orders/:id/details', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const { id } = req.params;
        const supplierId = req.user.id;
        
        const orderDetails = await findSupplierOrderDetails(id, supplierId);

        if (!orderDetails) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado o no pertenece a este proveedor.' });
        }

        res.status(200).json({ success: true, data: orderDetails });
    } catch (error) {
        console.error("Error al obtener detalles del pedido:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

// --- RUTA DE ÍTEMS CON BAJO STOCK ---
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