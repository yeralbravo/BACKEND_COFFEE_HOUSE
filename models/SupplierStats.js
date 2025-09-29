import db from '../config/db.js';

export const getSupplierDashboardStats = async (supplierId, dateRange) => {
    const { startDate, endDate } = dateRange;
    const endDateWithTime = `${endDate} 23:59:59`;
    const startDateWithTime = `${startDate} 00:00:00`;
    
    const summaryQuery = `
        SELECT 
            (SELECT COUNT(*) FROM products WHERE supplier_id = ?) AS total_products,
            (SELECT COUNT(*) FROM insumos WHERE supplier_id = ?) AS total_insumos,
            (SELECT COUNT(*) FROM products WHERE supplier_id = ? AND stock <= 5) AS low_stock_products,
            (SELECT COUNT(*) FROM insumos WHERE supplier_id = ? AND stock <= 5) AS low_stock_insumos,
            (
                SELECT COUNT(DISTINCT o.id) 
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE o.status = 'Pendiente' AND 
                      (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR 
                       oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?))
            ) AS pending_orders
    `;
    const [summaryResult] = await db.query(summaryQuery, [
        supplierId, supplierId, supplierId, supplierId, supplierId, supplierId
    ]);
    const summaryData = summaryResult[0];

    const salesDataQuery = `
        SELECT 
            DATE(o.created_at) as date, 
            SUM(oi.quantity * oi.price_at_purchase) as total 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE 
            (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR 
             oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?)) AND
            o.created_at BETWEEN ? AND ? AND
            o.status != 'Cancelado'
        GROUP BY DATE(o.created_at)
        ORDER BY date ASC
    `;
    const [salesData] = await db.query(salesDataQuery, [supplierId, supplierId, startDateWithTime, endDateWithTime]);
    
    const totalSales = salesData.reduce((sum, day) => sum + parseFloat(day.total), 0);

    const topProductsQuery = `
        SELECT 
            COALESCE(p.nombre, i.nombre) as name, 
            SUM(oi.quantity) as quantity_sold 
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN insumos i ON oi.insumo_id = i.id
        JOIN orders o ON oi.order_id = o.id
        WHERE 
            (p.supplier_id = ? OR i.supplier_id = ?) AND 
            o.created_at BETWEEN ? AND ? AND
            o.status != 'Cancelado'
        GROUP BY name 
        HAVING name IS NOT NULL
        ORDER BY quantity_sold DESC 
        LIMIT 5
    `;
    const [topProducts] = await db.query(topProductsQuery, [supplierId, supplierId, startDateWithTime, endDateWithTime]);

    return { 
        summary: { 
            totalProducts: parseInt(summaryData.total_products) + parseInt(summaryData.total_insumos), 
            lowStockCount: parseInt(summaryData.low_stock_products) + parseInt(summaryData.low_stock_insumos), 
            pendingOrders: parseInt(summaryData.pending_orders), 
            totalSales: totalSales 
        }, 
        salesData, 
        topProducts 
    };
};

export const getSupplierSalesReport = async (supplierId, dateRange) => {
    const { startDate, endDate } = dateRange;
    const startDateWithTime = `${startDate} 00:00:00`;
    const endDateWithTime = `${endDate} 23:59:59`;

    const [summaryResult] = await db.query(
        `SELECT 
            COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS totalRevenue, 
            COUNT(DISTINCT o.id) AS totalOrders, 
            COALESCE(SUM(oi.quantity), 0) AS productsSold 
         FROM orders o 
         JOIN order_items oi ON o.id = oi.order_id 
         WHERE (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?)) 
         AND o.created_at BETWEEN ? AND ? AND o.status != 'Cancelado'`,
        [supplierId, supplierId, startDateWithTime, endDateWithTime]
    );
    const summary = summaryResult[0];
    summary.averageItemsPerOrder = summary.totalOrders > 0 ? (summary.productsSold / summary.totalOrders) : 0;

    const [revenueByTypeResult] = await db.query(
        `SELECT 
            SUM(CASE WHEN oi.product_id IS NOT NULL THEN oi.quantity * oi.price_at_purchase ELSE 0 END) as cafeRevenue,
            SUM(CASE WHEN oi.insumo_id IS NOT NULL THEN oi.quantity * oi.price_at_purchase ELSE 0 END) as insumoRevenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?))
         AND o.created_at BETWEEN ? AND ? AND o.status != 'Cancelado'`,
        [supplierId, supplierId, startDateWithTime, endDateWithTime]
    );
    const revenueByType = revenueByTypeResult[0];

    const [revenueByCategory] = await db.query(
        `SELECT 
            category, 
            SUM(revenue) as totalRevenue
         FROM (
            SELECT 
                p.tipo as category, 
                oi.quantity * oi.price_at_purchase as revenue
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE p.supplier_id = ? AND o.created_at BETWEEN ? AND ? AND o.status != 'Cancelado'
            UNION ALL
            SELECT 
                i.categoria as category, 
                oi.quantity * oi.price_at_purchase as revenue
            FROM order_items oi
            JOIN insumos i ON oi.insumo_id = i.id
            JOIN orders o ON oi.order_id = o.id
            WHERE i.supplier_id = ? AND o.created_at BETWEEN ? AND ? AND o.status != 'Cancelado'
         ) as sales_by_category
         GROUP BY category
         ORDER BY totalRevenue DESC`,
        [supplierId, startDateWithTime, endDateWithTime, supplierId, startDateWithTime, endDateWithTime]
    );
    
    return { summary, revenueByType, revenueByCategory };
};

export const getSupplierProductStats = async (supplierId, dateRange) => {
    const { startDate, endDate } = dateRange;
    const startDateWithTime = `${startDate} 00:00:00`;
    const endDateWithTime = `${endDate} 23:59:59`;

    const [kpisResult] = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM products WHERE supplier_id = ?) AS total_products,
            (SELECT COUNT(*) FROM insumos WHERE supplier_id = ?) AS total_insumos,
            (SELECT COUNT(*) FROM products WHERE supplier_id = ? AND stock > 0 AND stock <= 5) + 
            (SELECT COUNT(*) FROM insumos WHERE supplier_id = ? AND stock > 0 AND stock <= 5) AS low_stock,
            (SELECT COUNT(*) FROM products WHERE supplier_id = ? AND stock = 0) + 
            (SELECT COUNT(*) FROM insumos WHERE supplier_id = ? AND stock = 0) AS out_of_stock
        `,
        [supplierId, supplierId, supplierId, supplierId, supplierId, supplierId]
    );
    const kpis = kpisResult[0];

    const [topViewedProducts] = await db.query(
        `SELECT 
            IFNULL(p.nombre, i.nombre) as name,
            SUM(v.view_count) as total_views
         FROM views v
         LEFT JOIN products p ON v.product_id = p.id
         LEFT JOIN insumos i ON v.insumo_id = i.id
         WHERE (p.supplier_id = ? OR i.supplier_id = ?)
         AND v.view_date BETWEEN ? AND ?
         GROUP BY name
         HAVING name IS NOT NULL
         ORDER BY total_views DESC
         LIMIT 5`,
        [supplierId, supplierId, startDateWithTime, endDateWithTime]
    );

    const [topRatedProducts] = await db.query(
        `SELECT 
            name, 
            avg_rating
        FROM (
            SELECT 
                p.nombre as name, 
                AVG(r.rating) as avg_rating,
                COUNT(r.id) as review_count
            FROM reviews r
            JOIN products p ON r.product_id = p.id
            WHERE p.supplier_id = ? AND r.created_at BETWEEN ? AND ?
            GROUP BY p.nombre
            UNION ALL
            SELECT 
                i.nombre as name, 
                AVG(r.rating) as avg_rating,
                COUNT(r.id) as review_count
            FROM reviews r
            JOIN insumos i ON r.insumo_id = i.id
            WHERE i.supplier_id = ? AND r.created_at BETWEEN ? AND ?
            GROUP BY i.nombre
        ) as combined_reviews
        WHERE avg_rating IS NOT NULL
        ORDER BY avg_rating DESC, review_count DESC
        LIMIT 5`,
        [supplierId, startDateWithTime, endDateWithTime, supplierId, startDateWithTime, endDateWithTime]
    );

    return { kpis, topViewedProducts, topRatedProducts };
};

// --- FUNCIÓN CORREGIDA ---
export const getSupplierOrderStats = async (supplierId, dateRange) => {
    const { startDate, endDate } = dateRange;
    const startDateWithTime = `${startDate} 00:00:00`;
    const endDateWithTime = `${endDate} 23:59:59`;

    // Query 1: Obtiene pedidos TOTALES y PENDIENTES basados en la FECHA DE CREACIÓN.
    const createdStatsQuery = `
        SELECT
            COUNT(DISTINCT o.id) AS total_orders,
            SUM(CASE WHEN o.status = 'Pendiente' THEN 1 ELSE 0 END) AS pending_count
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR 
               oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?))
          AND o.created_at BETWEEN ? AND ?
    `;
    const [createdStats] = await db.query(createdStatsQuery, [supplierId, supplierId, startDateWithTime, endDateWithTime]);

    // Query 2: Obtiene pedidos ENVIADOS y ENTREGADOS basados en la FECHA DE ACTUALIZACIÓN.
    const updatedStatsQuery = `
        SELECT
            SUM(CASE WHEN o.status = 'Enviado' THEN 1 ELSE 0 END) AS shipped_count,
            SUM(CASE WHEN o.status = 'Entregado' THEN 1 ELSE 0 END) AS delivered_count
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR 
               oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?))
          AND o.updated_at BETWEEN ? AND ?
    `;
    const [updatedStats] = await db.query(updatedStatsQuery, [supplierId, supplierId, startDateWithTime, endDateWithTime]);
    
    // El resto de las consultas siguen basándose en la fecha de creación, lo cual es correcto para "recientes" y "tipos de cliente".
    const baseQueryForRest = `
        WITH SupplierOrderIDs AS (
            SELECT DISTINCT o.id
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE (oi.product_id IN (SELECT id FROM products WHERE supplier_id = ?) OR 
                   oi.insumo_id IN (SELECT id FROM insumos WHERE supplier_id = ?))
              AND o.created_at BETWEEN ? AND ?
        )
    `;

    const recentOrdersQuery = `
        ${baseQueryForRest}
        SELECT o.id, u.nombre as user_name, o.total_amount, o.status, DATE_FORMAT(o.created_at, '%d/%m/%Y') as date
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id IN (SELECT id FROM SupplierOrderIDs)
        ORDER BY o.created_at DESC
        LIMIT 5
    `;
    const [recentOrders] = await db.query(recentOrdersQuery, [supplierId, supplierId, startDateWithTime, endDateWithTime]);

    const customerTypeQuery = `
        ${baseQueryForRest}
        , FirstOrderPerUser AS (
            SELECT user_id, MIN(id) as first_order_id
            FROM orders
            GROUP BY user_id
        )
        SELECT
            SUM(CASE WHEN o.id = fopu.first_order_id THEN 1 ELSE 0 END) AS new_customer_orders,
            SUM(CASE WHEN o.id != fopu.first_order_id THEN 1 ELSE 0 END) AS returning_customer_orders
        FROM orders o
        JOIN FirstOrderPerUser fopu ON o.user_id = fopu.user_id
        WHERE o.id IN (SELECT id FROM SupplierOrderIDs)
    `;
    const [customerTypeStats] = await db.query(customerTypeQuery, [supplierId, supplierId, startDateWithTime, endDateWithTime]);

    // Unimos los resultados de las consultas en el objeto final
    return {
        summary: {
            totalOrders: parseInt(createdStats[0].total_orders) || 0,
            pending: parseInt(createdStats[0].pending_count) || 0,
            shipped: parseInt(updatedStats[0].shipped_count) || 0,
            delivered: parseInt(updatedStats[0].delivered_count) || 0,
        },
        recentOrders,
        customerTypeStats: customerTypeStats[0]
    };
};

export const getLowStockItems = async (supplierId) => {
    const [items] = await db.query(
        `(SELECT 
            id, nombre, stock, 'Café' as type,
            (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) as image
        FROM products p
        WHERE supplier_id = ? AND stock <= 5)
        
        UNION ALL

        (SELECT 
            id, nombre, stock, 'Insumo' as type,
            (SELECT image_url FROM insumo_images WHERE insumo_id = i.id LIMIT 1) as image
        FROM insumos i
        WHERE supplier_id = ? AND stock <= 5)

        ORDER BY stock ASC
        `,
        [supplierId, supplierId]
    );
    return items;
};