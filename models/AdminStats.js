import db from '../config/db.js';

// Función auxiliar para obtener el rango de fechas
const getDateRangeQuery = (range, dateColumn) => {
    switch (range) {
        case 'day':
            return ` AND ${dateColumn} >= CURDATE()`;
        case 'week':
            return ` AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        case 'month':
            return ` AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;
        case 'year':
            return ` AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`;
        default:
            return ''; // 'all'
    }
};

/**
 * Obtiene las estadísticas generales para el dashboard del administrador, incluyendo KPIs y datos para gráficos.
 */
export const getAdminDashboardStats = async (range = 'month') => {
    const dateFilter = getDateRangeQuery(range, 'o.created_at');
    const userDateFilter = getDateRangeQuery(range, 'created_at');

    // 1. KPIs (Tarjetas de estadísticas)
    const kpiQuery = `
        SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'client' ${userDateFilter}) as new_users,
            (SELECT COUNT(DISTINCT id) FROM orders o WHERE 1=1 ${dateFilter}) as total_orders,
            (SELECT SUM(total_amount) FROM orders o WHERE 1=1 ${dateFilter}) as total_revenue,
            (SELECT COUNT(*) FROM supplier_requests WHERE status = 'pending') as pending_suppliers
    `;
    const [kpiResult] = await db.query(kpiQuery);

    // 2. Gráfica de Ventas (ingresos a lo largo del tiempo)
    const salesOverTimeQuery = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, SUM(total_amount) as total
        FROM orders o
        WHERE 1=1 ${dateFilter}
        GROUP BY date
        ORDER BY date ASC
    `;
    const [salesData] = await db.query(salesOverTimeQuery);

    // 3. Gráfica de Productos más vendidos
    const topProductsQuery = `
        SELECT p.nombre, SUM(oi.quantity) as quantity_sold
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE p.nombre IS NOT NULL ${dateFilter}
        GROUP BY p.nombre
        ORDER BY quantity_sold DESC
        LIMIT 5
    `;
    const [topProducts] = await db.query(topProductsQuery);

    // 4. Gráfica de Usuarios (por rol, total histórico)
    const userDistributionQuery = `
        SELECT role, COUNT(*) as count FROM users GROUP BY role;
    `;
    const [userDistribution] = await db.query(userDistributionQuery);
    
    // 5. Gráfica de Pedidos (por estado, según el filtro de fecha)
    const orderStatusQuery = `
        SELECT status, COUNT(*) as count
        FROM orders o
        WHERE 1=1 ${dateFilter}
        GROUP BY status
    `;
    const [orderStatusDistribution] = await db.query(orderStatusQuery);

    return {
        kpis: {
            newUsers: kpiResult[0].new_users || 0,
            totalOrders: kpiResult[0].total_orders || 0,
            totalRevenue: kpiResult[0].total_revenue || 0,
            pendingSuppliers: kpiResult[0].pending_suppliers || 0,
        },
        salesOverTime: salesData,
        topProducts,
        userDistribution,
        orderStatusDistribution
    };
};

/**
 * Obtiene estadísticas detalladas de ventas.
 */
export const getSalesStats = async (range = 'month') => {
    const dateFilter = getDateRangeQuery(range, 'created_at');
    const query = `
        SELECT
            COALESCE(SUM(total_amount), 0) as totalRevenue,
            COUNT(*) as totalOrders,
            COALESCE(AVG(total_amount), 0) as averageOrderValue,
            (SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE 1=1 ${dateFilter}) as totalItemsSold
        FROM orders
        WHERE 1=1 ${dateFilter.replace('o.created_at', 'created_at')};
    `;
    const [kpis] = await db.query(query);

    const salesOverTimeQuery = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, SUM(total_amount) as total
        FROM orders
        WHERE 1=1 ${dateFilter.replace('o.created_at', 'created_at')}
        GROUP BY date ORDER BY date ASC;
    `;
    const [salesOverTime] = await db.query(salesOverTimeQuery);
    
    return { kpis: kpis[0], salesOverTime };
};

/**
 * Obtiene estadísticas detalladas de productos.
 */
export const getProductStats = async (range = 'month') => {
    const dateFilter = getDateRangeQuery(range, 'o.created_at');
    const topProductsQuery = `
        SELECT p.nombre, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price_at_purchase) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE p.nombre IS NOT NULL ${dateFilter}
        GROUP BY p.nombre ORDER BY revenue DESC LIMIT 10;
    `;
    const [topProducts] = await db.query(topProductsQuery);

    const stockStatusQuery = `
        SELECT 
            SUM(CASE WHEN stock > 10 THEN 1 ELSE 0 END) as in_stock,
            SUM(CASE WHEN stock > 0 AND stock <= 10 THEN 1 ELSE 0 END) as low_stock,
            SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock
        FROM (SELECT stock FROM products UNION ALL SELECT stock FROM insumos) as all_items;
    `;
    const [stockStatus] = await db.query(stockStatusQuery);

    return { topProducts, stockStatus: stockStatus[0] };
};

/**
 * Obtiene estadísticas detalladas de usuarios.
 */
export const getUserStats = async (range = 'month') => {
    const userDateFilter = getDateRangeQuery(range, 'created_at');
    const newUsersQuery = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count
        FROM users
        WHERE role = 'client' ${userDateFilter}
        GROUP BY date ORDER BY date ASC;
    `;
    const [newUsersOverTime] = await db.query(newUsersQuery);
    
    const userDistributionQuery = `SELECT role, COUNT(*) as count FROM users GROUP BY role;`;
    const [userDistribution] = await db.query(userDistributionQuery);

    return { newUsersOverTime, userDistribution };
};

/**
 * Obtiene estadísticas detalladas de pedidos.
 */
export const getOrderStats = async (range = 'month') => {
    const dateFilter = getDateRangeQuery(range, 'created_at');
    const ordersOverTimeQuery = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count
        FROM orders
        WHERE 1=1 ${dateFilter}
        GROUP BY date ORDER BY date ASC;
    `;
    const [ordersOverTime] = await db.query(ordersOverTimeQuery);

    const orderStatusQuery = `SELECT status, COUNT(*) as count FROM orders WHERE 1=1 ${dateFilter} GROUP BY status;`;
    const [orderStatusDistribution] = await db.query(orderStatusQuery);

    return { ordersOverTime, orderStatusDistribution };
};