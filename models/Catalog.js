import db from '../config/db.js';

const formatItems = (items) => {
    return items.map(item => ({
        ...item,
        images: item.images ? item.images.split(',') : []
    }));
};

export const findTopRatedAndSoldItems = async (limit = 4) => {
    const [rows] = await db.query(
        `
        SELECT id, nombre, precio, images, tipo, 'product' as item_type, sales_count, avg_rating, marca, descripcion, stock
        FROM (
            SELECT p.id, p.nombre, p.precio, p.tipo, p.marca, p.descripcion, p.stock,
                (SELECT GROUP_CONCAT(pi.image_url) FROM product_images pi WHERE pi.product_id = p.id) as images,
                COUNT(DISTINCT oi.id) as sales_count, AVG(r.rating) as avg_rating
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN reviews r ON p.id = r.product_id
            WHERE p.stock > 0
            GROUP BY p.id
        ) AS products_summary
        UNION ALL
        SELECT id, nombre, precio, images, categoria as tipo, 'insumo' as item_type, sales_count, avg_rating, marca, descripcion, stock
        FROM (
            SELECT i.id, i.nombre, i.precio, i.categoria, i.marca, i.descripcion, i.stock,
                (SELECT GROUP_CONCAT(ii.image_url) FROM insumo_images ii WHERE ii.insumo_id = i.id) as images,
                COUNT(DISTINCT oi.id) as sales_count, AVG(r.rating) as avg_rating
            FROM insumos i
            LEFT JOIN order_items oi ON i.id = oi.insumo_id
            LEFT JOIN reviews r ON i.id = r.insumo_id
            WHERE i.stock > 0
            GROUP BY i.id
        ) AS insumos_summary
        ORDER BY (sales_count * 1.5) + IFNULL(avg_rating, 0) DESC
        LIMIT ?
        `,
        [limit]
    );
    return formatItems(rows);
};

export const findPopularItems = async (limit = 8) => {
    const [rows] = await db.query(
        `
        SELECT id, nombre, precio, images, tipo, 'product' as item_type, sales_count, avg_rating, marca, descripcion, stock
        FROM (
            SELECT p.id, p.nombre, p.precio, p.tipo, p.marca, p.descripcion, p.stock,
                (SELECT GROUP_CONCAT(pi.image_url) FROM product_images pi WHERE pi.product_id = p.id) as images,
                COUNT(DISTINCT oi.id) as sales_count, AVG(r.rating) as avg_rating
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN reviews r ON p.id = r.product_id
            WHERE p.stock > 0
            GROUP BY p.id
        ) AS products_summary
        UNION ALL
        SELECT id, nombre, precio, images, categoria as tipo, 'insumo' as item_type, sales_count, avg_rating, marca, descripcion, stock
        FROM (
            SELECT i.id, i.nombre, i.precio, i.categoria, i.marca, i.descripcion, i.stock,
                (SELECT GROUP_CONCAT(ii.image_url) FROM insumo_images ii WHERE ii.insumo_id = i.id) as images,
                COUNT(DISTINCT oi.id) as sales_count, AVG(r.rating) as avg_rating
            FROM insumos i
            LEFT JOIN order_items oi ON i.id = oi.insumo_id
            LEFT JOIN reviews r ON i.id = r.insumo_id
            WHERE i.stock > 0
            GROUP BY i.id
        ) AS insumos_summary
        ORDER BY (sales_count * 1.5) + IFNULL(avg_rating, 0) DESC
        LIMIT ?
        `,
        [limit]
    );
    return formatItems(rows);
};

export const findRecentItems = async (limit = 20) => {
     const [rows] = await db.query(
        `
        (SELECT p.id, p.nombre, p.precio, p.tipo, p.marca, p.descripcion, p.stock,
            (SELECT GROUP_CONCAT(pi.image_url) FROM product_images pi WHERE pi.product_id = p.id) as images,
            'product' as item_type, p.created_at
        FROM products p WHERE p.stock > 0)
        UNION ALL
        (SELECT i.id, i.nombre, i.precio, i.categoria as tipo, i.marca, i.descripcion, i.stock,
            (SELECT GROUP_CONCAT(ii.image_url) FROM insumo_images ii WHERE ii.insumo_id = i.id) as images,
            'insumo' as item_type, i.created_at
        FROM insumos i WHERE i.stock > 0)
        ORDER BY created_at DESC
        LIMIT ?
        `,
        [limit]
    );
    return formatItems(rows);
};
