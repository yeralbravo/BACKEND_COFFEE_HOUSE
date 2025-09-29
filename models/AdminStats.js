import db from '../config/db.js';

const getDateRangeQuery = (range, dateColumn) => {
    // ... (función sin cambios, la dejo para que el archivo esté completo)
    switch (range) {
        case 'day': return ` AND DATE(${dateColumn}) = CURDATE()`;
        case 'week': return ` AND YEARWEEK(${dateColumn}, 1) = YEARWEEK(CURDATE(), 1)`;
        case 'month': return ` AND ${dateColumn} BETWEEN DATE_FORMAT(CURDATE(), '%Y-%m-01') AND NOW()`;
        case 'year': return ` AND ${dateColumn} >= DATE_FORMAT(CURDATE(), '%Y-01-01')`;
        default: return '';
    }
};

export const getAdminDashboardStats = async (filters) => {
    // ... (esta función no cambia)
    const { range, startDate, endDate } = filters;
    let dateFilter, userDateFilter;
    if (startDate && endDate) {
        const startDateWithTime = `${startDate} 00:00:00`;
        const endDateWithTime = `${endDate} 23:59:59`;
        dateFilter = ` AND o.created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
        userDateFilter = ` AND created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
    } else {
        dateFilter = getDateRangeQuery(range, 'o.created_at');
        userDateFilter = getDateRangeQuery(range, 'created_at');
    }
    const kpiQuery = `SELECT (SELECT COUNT(*) FROM users WHERE role = 'client' ${userDateFilter}) as new_users, (SELECT COUNT(DISTINCT id) FROM orders o WHERE 1=1 ${dateFilter}) as total_orders, (SELECT SUM(total_amount) FROM orders o WHERE 1=1 ${dateFilter}) as total_revenue, (SELECT COUNT(*) FROM supplier_requests WHERE status = 'pending') as pending_suppliers`;
    const [kpiResult] = await db.query(kpiQuery);
    const salesOverTimeQuery = `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, SUM(total_amount) as total FROM orders o WHERE 1=1 ${dateFilter} GROUP BY date ORDER BY date ASC`;
    const [salesData] = await db.query(salesOverTimeQuery);
    const topProductsQuery = `SELECT COALESCE(p.nombre, i.nombre) AS nombre, SUM(oi.quantity) AS quantity_sold FROM order_items oi JOIN orders o ON oi.order_id = o.id LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id WHERE COALESCE(p.nombre, i.nombre) IS NOT NULL ${dateFilter} GROUP BY nombre ORDER BY quantity_sold DESC LIMIT 5`;
    const [topProducts] = await db.query(topProductsQuery);
    const userDistributionQuery = `SELECT role, COUNT(*) as count FROM users GROUP BY role;`;
    const [userDistribution] = await db.query(userDistributionQuery);
    const topSuppliersQuery = `SELECT CONCAT(u.nombre, ' ', u.apellido) as supplier_name, SUM(oi.quantity * oi.price_at_purchase) as total_revenue FROM order_items oi JOIN orders o ON oi.order_id = o.id LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id JOIN users u ON u.id = COALESCE(p.supplier_id, i.supplier_id) WHERE COALESCE(p.supplier_id, i.supplier_id) IS NOT NULL ${dateFilter} GROUP BY u.id, supplier_name ORDER BY total_revenue DESC LIMIT 5`;
    const [topSuppliers] = await db.query(topSuppliersQuery);
    const orderStatusQuery = `SELECT status, COUNT(*) as count FROM orders o WHERE 1=1 ${dateFilter} GROUP BY status`;
    const [orderStatusDistribution] = await db.query(orderStatusQuery);
    return { kpis: { newUsers: kpiResult[0].new_users || 0, totalOrders: kpiResult[0].total_orders || 0, totalRevenue: kpiResult[0].total_revenue || 0, pendingSuppliers: kpiResult[0].pending_suppliers || 0, }, salesOverTime: salesData, topProducts, userDistribution, topSuppliers, orderStatusDistribution };
};

export const getSalesStats = async (filters) => {
    // ... (esta función no cambia)
    const { range, startDate, endDate } = filters;
    let dateFilter;
    if (startDate && endDate) {
        const startDateWithTime = `${startDate} 00:00:00`;
        const endDateWithTime = `${endDate} 23:59:59`;
        dateFilter = ` AND o.created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
    } else {
        dateFilter = getDateRangeQuery(range, 'o.created_at');
    }
    const kpiQuery = `SELECT COALESCE(SUM(total_amount), 0) as totalRevenue, COUNT(*) as totalOrders, (SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE 1=1 ${dateFilter}) as totalItemsSold FROM orders o WHERE 1=1 ${dateFilter}`;
    const [kpis] = await db.query(kpiQuery);
    const recurringCustomersQuery = `SELECT COUNT(*) AS recurringCustomers FROM (SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(id) > 1) AS recurring_users`;
    const [recurringResult] = await db.query(recurringCustomersQuery);
    kpis[0].recurringCustomers = recurringResult[0].recurringCustomers;
    const paymentMethodQuery = `SELECT payment_method, SUM(total_amount) as total FROM orders o WHERE 1=1 ${dateFilter} AND payment_method IS NOT NULL GROUP BY payment_method`;
    const [paymentMethodStats] = await db.query(paymentMethodQuery);
    const locationRevenueQuery = `SELECT JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.ciudad')) AS ciudad, SUM(total_amount) as total FROM orders o WHERE JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.ciudad')) IS NOT NULL ${dateFilter} GROUP BY ciudad ORDER BY total DESC LIMIT 7`;
    const [locationRevenueStats] = await db.query(locationRevenueQuery);
    return { kpis: kpis[0], paymentMethodStats, locationRevenueStats };
};

export const getProductStats = async (filters) => {
    // ... (esta función no cambia)
    const { range, startDate, endDate } = filters;
    let dateFilter, viewsDateFilter;
    if (startDate && endDate) {
        const startDateWithTime = `${startDate} 00:00:00`;
        const endDateWithTime = `${endDate} 23:59:59`;
        dateFilter = ` AND o.created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
        viewsDateFilter = ` AND v.view_date BETWEEN '${startDate}' AND '${endDate}'`;
    } else {
        dateFilter = getDateRangeQuery(range, 'o.created_at');
        viewsDateFilter = getDateRangeQuery(range, 'v.view_date');
    }
    const kpiQuery = `SELECT (SELECT COUNT(*) FROM products) AS total_products, (SELECT COUNT(*) FROM insumos) AS total_insumos, (SELECT COUNT(*) FROM products WHERE stock > 0) + (SELECT COUNT(*) FROM insumos WHERE stock > 0) AS active_items, (SELECT COUNT(*) FROM reviews) AS total_reviews`;
    const [kpis] = await db.query(kpiQuery);
    const conversionQuery = `WITH ProductViews AS ( SELECT COALESCE(p.id, i.id) AS item_id, SUM(v.view_count) AS total_views FROM views v LEFT JOIN products p ON v.product_id = p.id LEFT JOIN insumos i ON v.insumo_id = i.id WHERE 1=1 ${viewsDateFilter.replace('o.created_at', 'v.view_date')} GROUP BY item_id ), ProductSales AS ( SELECT COALESCE(oi.product_id, oi.insumo_id) AS item_id, SUM(oi.quantity) AS total_sales FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE 1=1 ${dateFilter} GROUP BY item_id ) SELECT COALESCE(p.nombre, i.nombre) AS item_name, COALESCE(pv.total_views, 0) AS total_views, COALESCE(ps.total_sales, 0) AS total_sales FROM (SELECT id, nombre FROM products UNION ALL SELECT id, nombre FROM insumos) all_items LEFT JOIN products p ON all_items.id = p.id LEFT JOIN insumos i ON all_items.id = i.id LEFT JOIN ProductViews pv ON all_items.id = pv.item_id LEFT JOIN ProductSales ps ON all_items.id = ps.item_id WHERE COALESCE(pv.total_views, 0) > 0 OR COALESCE(ps.total_sales, 0) > 0 ORDER BY total_views DESC, total_sales DESC LIMIT 10;`;
    const [conversionData] = await db.query(conversionQuery);
    const leastSoldQuery = `SELECT COALESCE(p.nombre, i.nombre) as item_name, SUM(oi.quantity) as units_sold FROM order_items oi JOIN orders o ON oi.order_id = o.id LEFT JOIN products p ON oi.product_id = p.id LEFT JOIN insumos i ON oi.insumo_id = i.id WHERE 1=1 ${dateFilter} AND COALESCE(p.nombre, i.nombre) IS NOT NULL GROUP BY item_name ORDER BY units_sold ASC LIMIT 5;`;
    const [leastSoldData] = await db.query(leastSoldQuery);
    return { kpis: kpis[0], conversionData, leastSoldData };
};

export const getUserStats = async (filters) => {
    // ... (esta función no cambia)
    const { range, startDate, endDate } = filters;
    let userDateFilter, orderDateFilter;
    if (startDate && endDate) {
        const startDateWithTime = `${startDate} 00:00:00`;
        const endDateWithTime = `${endDate} 23:59:59`;
        userDateFilter = ` AND created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
        orderDateFilter = ` AND created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
    } else {
        userDateFilter = getDateRangeQuery(range, 'created_at');
        orderDateFilter = getDateRangeQuery(range, 'created_at');
    }
    const kpiQuery = `SELECT (SELECT COUNT(*) FROM users WHERE role = 'client') AS total_clients, (SELECT COUNT(*) FROM users WHERE role = 'supplier') AS total_suppliers, (SELECT COUNT(*) FROM users WHERE role = 'admin') AS total_admins, (SELECT COUNT(*) FROM users WHERE 1=1 ${userDateFilter}) AS new_users_in_period`;
    const [kpis] = await db.query(kpiQuery);
    const aovByRoleQuery = `SELECT u.role, AVG(o.total_amount) AS average_order_value FROM orders o JOIN users u ON o.user_id = u.id WHERE u.role IN ('client', 'supplier') ${orderDateFilter.replace('created_at', 'o.created_at')} GROUP BY u.role;`;
    const [aovByRole] = await db.query(aovByRoleQuery);
    const activeUsersOverTimeQuery = `SELECT DATE_FORMAT(created_at, '%Y-%m-01') as month, COUNT(DISTINCT user_id) as active_users FROM orders o WHERE 1=1 ${orderDateFilter} GROUP BY month ORDER BY month ASC;`;
    const [activeUsersOverTime] = await db.query(activeUsersOverTimeQuery);
    return { kpis: kpis[0], aovByRole, activeUsersOverTime };
};

// --- FUNCIÓN DE ESTADÍSTICAS DE PEDIDOS MODIFICADA ---
export const getOrderStats = async (filters) => {
    const { range, startDate, endDate } = filters;
    let dateFilter;

    if (startDate && endDate) {
        const startDateWithTime = `${startDate} 00:00:00`;
        const endDateWithTime = `${endDate} 23:59:59`;
        dateFilter = ` AND o.created_at BETWEEN '${startDateWithTime}' AND '${endDateWithTime}'`;
    } else {
        dateFilter = getDateRangeQuery(range, 'o.created_at');
    }

    const orderStatusQuery = `
        SELECT status, COUNT(*) as count 
        FROM orders o 
        WHERE 1=1 ${dateFilter} 
        GROUP BY status
    `;
    const [orderStatusDistribution] = await db.query(orderStatusQuery);

    const shippingCompanyQuery = `
        SELECT shipping_company, COUNT(id) as order_count
        FROM orders o
        WHERE shipping_company IS NOT NULL AND shipping_company != '' ${dateFilter}
        GROUP BY shipping_company
        ORDER BY order_count DESC
    `;
    const [shippingCompanyStats] = await db.query(shippingCompanyQuery);

    // Procesamiento de datos para los KPIs
    const totalOrders = orderStatusDistribution.reduce((sum, s) => sum + s.count, 0);
    const deliveredOrders = orderStatusDistribution.find(s => s.status === 'Entregado')?.count || 0;
    const inTransitOrders = orderStatusDistribution.find(s => s.status === 'Enviado')?.count || 0;
    const cancelledOrders = orderStatusDistribution.find(s => s.status === 'Cancelado')?.count || 0;
    const successRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
    
    const kpis = {
        total_orders: totalOrders,
        in_transit_orders: inTransitOrders,
        cancelled_orders: cancelledOrders,
        delivered_orders: deliveredOrders, // <-- Dato añadido para la nueva tarjeta
        successful_delivery_rate: successRate
    };

    return { kpis, orderStatusDistribution, shippingCompanyStats };
};