import express from 'express';
import { verifyToken, checkRole } from '../middleware/authMiddleware.js';
import { 
    createOrder, 
    findOrdersByUserId, 
    findOrderById, 
    findAllOrders, 
    updateOrderStatus,
    findOrdersBySupplierId,
    deleteOrderById,
    updateOrderStatusBySupplier,
    cancelOrder,
    findSupplierOrderDetails,
    findOrderDetailsForAdmin
} from '../models/Order.js';
import { createNotification } from '../models/Notification.js';
import { logAdminActivity } from '../models/ActivityLog.js'; // <-- 1. IMPORTAR LOG

const router = express.Router();

router.put('/:orderId/cancel', verifyToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;
        
        const result = await cancelOrder(orderId, userId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Error al cancelar el pedido.' });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { cartItems, shippingAddress, paymentMethod, totalAmount } = req.body;
        const result = await createOrder(userId, cartItems, shippingAddress, paymentMethod, totalAmount);
        res.status(201).json({ success: true, message: 'Orden creada exitosamente', data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/my-orders', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = { status: req.query.status, startDate: req.query.startDate, endDate: req.query.endDate };
        const orders = await findOrdersByUserId(userId, filters);
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        console.error("Error en la ruta /my-orders:", error);
        res.status(500).json({ success: false, error: 'No se pudieron obtener las órdenes.' });
    }
});

router.get('/:orderId', verifyToken, async (req, res) => {
    try {
        const order = await findOrderById(req.params.orderId, req.user.id);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado.' });
        }
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener el pedido.' });
    }
});

router.get('/admin/all', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const filters = { status: req.query.status, startDate: req.query.startDate, endDate: req.query.endDate };
        const orders = await findAllOrders(filters);
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener las órdenes.' });
    }
});

router.get('/admin/details/:orderId', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { orderId } = req.params;
        const orderDetails = await findOrderDetailsForAdmin(orderId);
        if (!orderDetails) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado.' });
        }
        res.status(200).json({ success: true, data: orderDetails });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener los detalles del pedido.' });
    }
});

// --- RUTA ACTUALIZADA ---
router.put('/admin/:orderId', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { orderId } = req.params;
        const adminUser = req.user;

        const orderBeforeUpdate = await findOrderDetailsForAdmin(orderId);
        if (!orderBeforeUpdate) {
            return res.status(404).json({ success: false, error: 'Orden no encontrada.' });
        }

        const result = await updateOrderStatus(orderId, req.body);
        
        await logAdminActivity(
            adminUser.id,
            `${adminUser.nombre} ${adminUser.apellido}`,
            'ORDER_STATUS_UPDATED',
            'order',
            orderId,
            { 
                orderId: orderId,
                customerName: `${orderBeforeUpdate.user_name} ${orderBeforeUpdate.user_lastname}`,
                fromStatus: orderBeforeUpdate.status,
                toStatus: req.body.status
            }
        );

        if (req.body.status === 'Entregado' && result.userId) {
            const message = `Tu pedido #${orderId} ha sido entregado. ¡Ya puedes calificar tus productos!`;
            await createNotification(result.userId, message, `/order/${orderId}`);
        }
        res.status(200).json({ success: true, message: 'Estado de la orden actualizado.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al actualizar la orden.' });
    }
});

// ... (rutas de supplier)

router.get('/supplier/my-orders', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const supplierId = req.user.id;
        const filters = { status: req.query.status, startDate: req.query.startDate, endDate: req.query.endDate };
        const orders = await findOrdersBySupplierId(supplierId, filters);
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        console.error("Error en la ruta /supplier/my-orders:", error);
        res.status(500).json({ success: false, error: 'Error al obtener los pedidos.' });
    }
});

router.get('/supplier/details/:orderId', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const { orderId } = req.params;
        const supplierId = req.user.id;
        
        const orderDetails = await findSupplierOrderDetails(orderId, supplierId);

        if (!orderDetails) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado o no pertenece a este proveedor.' });
        }

        res.status(200).json({ success: true, data: orderDetails });
    } catch (error) {
        console.error("Error al obtener detalles del pedido:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});


router.put('/supplier/:orderId', [verifyToken, checkRole(['supplier'])], async (req, res) => {
    try {
        const { orderId } = req.params;
        const supplierId = req.user.id;
        const result = await updateOrderStatusBySupplier(orderId, supplierId, req.body);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Orden no encontrada.' });
        }
        if (req.body.status === 'Entregado' && result.userId) {
            const message = `Tu pedido #${orderId} ha sido entregado. ¡Ya puedes calificar tus productos!`;
            await createNotification(result.userId, message, `/mis-pedidos`);
        }
        res.status(200).json({ success: true, message: 'Estado de la orden actualizado.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Error al actualizar la orden.' });
    }
});

// --- RUTA ACTUALIZADA ---
router.delete('/:orderId', [verifyToken, checkRole(['admin'])], async (req, res) => {
    try {
        const { orderId } = req.params;
        const adminUser = req.user;
        
        if(req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'No tienes permiso para realizar esta acción.' });
        }

        const orderToDelete = await findOrderDetailsForAdmin(orderId);
        if (!orderToDelete) {
             return res.status(404).json({ success: false, error: 'Pedido no encontrado.' });
        }

        const result = await deleteOrderById(orderId);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado.' });
        }

        await logAdminActivity(
            adminUser.id,
            `${adminUser.nombre} ${adminUser.apellido}`,
            'ORDER_DELETED',
            'order',
            orderId,
            { 
                orderId: orderId,
                customerName: `${orderToDelete.user_name} ${orderToDelete.user_lastname}`,
                totalAmount: orderToDelete.total_amount
            }
        );

        res.status(200).json({ success: true, message: 'Pedido eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al eliminar el pedido.' });
    }
});

export default router;