import db from '../config/db.js';
import { createNotification } from './Notification.js';

export const cancelOrder = async (orderId, userId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = "Pendiente"', [orderId, userId]);
        if (orders.length === 0) {
            throw new Error('El pedido no se puede cancelar o no te pertenece.');
        }
        const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of items) {
            if (item.product_id) {
                await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
            } else if (item.insumo_id) {
                await connection.query('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.quantity, item.insumo_id]);
            }
        }
        await connection.query('UPDATE orders SET status = "Cancelado" WHERE id = ?', [orderId]);
        await connection.commit();
        return { success: true, message: 'Pedido cancelado correctamente.' };
    } catch (error) {
        await connection.rollback();
        console.error("Error al cancelar el pedido:", error);
        throw error;
    } finally {
        connection.release();
    }
};

export const createOrder = async (userId, cartItems, shippingAddress, paymentMethod, totalAmount) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const stockChecks = [];
        for (const item of cartItems) {
            const tableToQuery = item.isProduct ? 'products' : 'insumos';
            const [rows] = await connection.query(`SELECT stock, nombre, supplier_id FROM ${tableToQuery} WHERE id = ? FOR UPDATE`, [item.id]);
            if (rows.length === 0) {
                throw new Error(`El ítem "${item.nombre}" ya no se encuentra disponible.`);
            }
            if (rows[0].stock < item.quantity) {
                throw new Error(`No hay suficiente stock para "${rows[0].nombre}". Disponible: ${rows[0].stock}, Solicitado: ${item.quantity}.`);
            }
            stockChecks.push({ ...item, oldStock: rows[0].stock, supplier_id: rows[0].supplier_id });
        }
        const [orderResult] = await connection.query('INSERT INTO orders (user_id, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?)', [userId, totalAmount, JSON.stringify(shippingAddress), paymentMethod]);
        const orderId = orderResult.insertId;
        const supplierIdsWithNewOrders = new Set();
        for (const item of cartItems) {
            const tableToUpdate = item.isProduct ? 'products' : 'insumos';
            await connection.query('INSERT INTO order_items (order_id, product_id, insumo_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?, ?)', [orderId, item.isProduct ? item.id : null, item.isProduct ? null : item.id, item.quantity, item.precio]);
            await connection.query(`UPDATE ${tableToUpdate} SET stock = stock - ? WHERE id = ?`, [item.quantity, item.id]);
            const itemWithStock = stockChecks.find(i => i.id === item.id);
            const newStock = itemWithStock.oldStock - item.quantity;
            if (newStock <= 10) {
                const message = `¡Stock bajo o agotado! Tu ítem "${item.nombre}" ahora tiene ${newStock} unidades.`;
                await createNotification(itemWithStock.supplier_id, message, '/supplier/stats/low-stock');
            }
            supplierIdsWithNewOrders.add(itemWithStock.supplier_id);
        }
        for (const supplierId of supplierIdsWithNewOrders) {
            const message = `¡Nuevo pedido recibido! Tienes nuevos ítems para preparar en el pedido #${orderId}.`;
            await createNotification(supplierId, message, '/supplier/orders');
        }
        await connection.commit();
        return { success: true, orderId: orderId };
    } catch (error) {
        await connection.rollback();
        console.error("Error al crear la orden:", error);
        throw new Error(error.message || 'No se pudo procesar la orden.');
    } finally {
        connection.release();
    }
};

// ================== FUNCIÓN MODIFICADA ==================
export const findOrdersByUserId = async (userId, filters = {}) => {
    // Se establece el idioma de la sesión a español para los nombres de los meses.
    await db.query("SET lc_time_names = 'es_ES'");

    let query = `SELECT o.id, o.total_amount, o.status, o.shipping_company, o.tracking_number, DATE_FORMAT(o.created_at, '%d de %M de %Y') as date, o.updated_at FROM orders o`;
    const conditions = ['o.user_id = ?'];
    const params = [userId];

    if (filters.status && filters.status !== '') {
        conditions.push('o.status = ?');
        params.push(filters.status);
    }

    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
    // Si se proporciona solo una fecha, filtramos por ese día exacto.
    if (filters.startDate && !filters.endDate) {
        conditions.push('DATE(o.created_at) = ?');
        params.push(filters.startDate);
    } 
    // Si se proporcionan ambas fechas, filtramos por el rango.
    else {
        if (filters.startDate) {
            conditions.push('o.created_at >= ?');
            params.push(`${filters.startDate} 00:00:00`);
        }
        if (filters.endDate) {
            conditions.push('o.created_at <= ?');
            params.push(`${filters.endDate} 23:59:59`);
        }
    }

    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.created_at DESC';
    
    const [orders] = await db.query(query, params);

    if (orders.length === 0) {
        return [];
    }

    const orderIds = orders.map(o => o.id);
    const itemsQuery = `SELECT oi.order_id, IFNULL(p.nombre, i.nombre) as name, oi.quantity, IFNULL(p.marca, i.marca) as marca, IFNULL((SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1), (SELECT image_url FROM insumo_images WHERE insumo_id = i.id LIMIT 1)) as image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id WHERE oi.order_id IN (?)`;
    const [items] = await db.query(itemsQuery, [orderIds]);

    const ordersWithItems = orders.map(order => {
        return {
            ...order,
            items: items.filter(item => item.order_id === order.id)
        };
    });

    return ordersWithItems;
};

export const findOrderById = async (orderId, userId) => {
    const [orderCheck] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
    if (orderCheck.length === 0) return null;
    const orderDetails = orderCheck[0];
    const [items] = await db.query(`SELECT oi.id, oi.quantity, oi.price_at_purchase as price, oi.product_id, oi.insumo_id, IFNULL(p.nombre, i.nombre) as name, IFNULL(p.marca, i.marca) as brand, IFNULL((SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1), (SELECT image_url FROM insumo_images WHERE insumo_id = i.id LIMIT 1)) as image, IF(r.id IS NOT NULL, TRUE, FALSE) as is_reviewed FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id LEFT JOIN reviews r ON oi.id = r.order_item_id WHERE oi.order_id = ?`, [orderId]);
    return { 
        id: orderDetails.id, 
        total_amount: orderDetails.total_amount, 
        status: orderDetails.status, 
        shipping_address: orderDetails.shipping_address || {}, 
        shipping_company: orderDetails.shipping_company, 
        tracking_number: orderDetails.tracking_number, 
        date: new Date(orderDetails.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric'}),
        updated_at: new Date(orderDetails.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric'}),
        items: items 
    };
};

export const findAllOrders = async (filters = {}) => {
    await db.query("SET lc_time_names = 'es_ES'");
    let query = `SELECT o.id, o.total_amount, o.status, o.shipping_company, o.tracking_number, u.nombre as user_name, u.apellido as user_lastname, DATE_FORMAT(o.created_at, '%d de %M de %Y') as date, o.created_at FROM orders o JOIN users u ON o.user_id = u.id`;
    const conditions = [];
    const params = [];
    if (filters.status && filters.status !== '') { conditions.push('o.status = ?'); params.push(filters.status); }
    if (filters.startDate) { conditions.push('o.created_at >= ?'); params.push(`${filters.startDate} 00:00:00`); }
    if (filters.endDate) { conditions.push('o.created_at <= ?'); params.push(`${filters.endDate} 23:59:59`); }
    if (conditions.length > 0) { query += ' WHERE ' + conditions.join(' AND '); }
    query += ' ORDER BY o.created_at DESC';
    const [orders] = await db.query(query, params);
    return orders;
};

export const updateOrderStatus = async (orderId, updateData) => {
    const [result] = await db.query(`UPDATE orders SET status = ?, shipping_company = ?, tracking_number = ? WHERE id = ?`, [updateData.status, updateData.shipping_company, updateData.tracking_number, orderId]);
    const [order] = await db.query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
    return { affectedRows: result.affectedRows, userId: order[0]?.user_id };
};

export const findOrdersBySupplierId = async (supplierId, filters = {}) => {
    await db.query("SET lc_time_names = 'es_ES'");
    const orderIdsQuery = `SELECT DISTINCT oi.order_id FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id WHERE p.supplier_id = ? OR i.supplier_id = ?`;
    const [orderIdRows] = await db.query(orderIdsQuery, [supplierId, supplierId]);
    if (orderIdRows.length === 0) {
        return [];
    }
    const orderIds = orderIdRows.map(row => row.order_id);
    let query = `SELECT o.id, o.total_amount, o.status, o.shipping_company, o.tracking_number, u.nombre AS user_name, u.apellido AS user_lastname, DATE_FORMAT(o.created_at, '%d de %M de %Y') AS date FROM orders o JOIN users u ON o.user_id = u.id`;
    const conditions = ['o.id IN (?)'];
    const params = [orderIds];
    if (filters.status && filters.status !== '') {
        conditions.push('o.status = ?');
        params.push(filters.status);
    }
    if (filters.startDate) {
        conditions.push('o.created_at >= ?');
        params.push(`${filters.startDate} 00:00:00`);
    }
    if (filters.endDate) {
        conditions.push('o.created_at <= ?');
        params.push(`${filters.endDate} 23:59:59`);
    }
    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.created_at DESC';
    const [orders] = await db.query(query, params);
    return orders;
};

export const deleteOrderById = async (orderId) => {
    const [result] = await db.query('DELETE FROM orders WHERE id = ?', [orderId]);
    return result;
};

export const updateOrderStatusBySupplier = async (orderId, supplierId, updateData) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [items] = await connection.query( `SELECT oi.id FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id WHERE oi.order_id = ? AND (p.supplier_id = ? OR i.supplier_id = ?)`, [orderId, supplierId, supplierId] );
        if (items.length === 0) {
            throw new Error('No tienes permiso para modificar este pedido.');
        }
        const [result] = await connection.query( `UPDATE orders SET status = ?, shipping_company = ?, tracking_number = ? WHERE id = ?`, [updateData.status, updateData.shipping_company, updateData.tracking_number, orderId] );
        const [order] = await db.query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
        await connection.commit();
        return { affectedRows: result.affectedRows, userId: order[0]?.user_id };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};