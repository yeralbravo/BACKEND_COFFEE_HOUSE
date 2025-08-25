import db from '../config/db.js';

/**
 * Busca items (productos e insumos) que coincidan con un término de búsqueda.
 */
export const searchItems = async (query) => {
    const searchTerm = `%${query}%`;
    const [rows] = await db.query(
        `
        (SELECT 
            p.id, p.nombre, p.precio, p.tipo, p.marca, p.descripcion, p.stock,
            (SELECT GROUP_CONCAT(pi.image_url) FROM product_images pi WHERE pi.product_id = p.id) as images,
            'product' as item_type
        FROM products p
        WHERE p.stock > 0 AND (p.nombre LIKE ? OR p.marca LIKE ? OR p.descripcion LIKE ?))
        
        UNION ALL

        (SELECT 
            i.id, i.nombre, i.precio, i.categoria as tipo, i.marca, i.descripcion, i.stock,
            (SELECT GROUP_CONCAT(ii.image_url) FROM insumo_images ii WHERE ii.insumo_id = i.id) as images,
            'insumo' as item_type
        FROM insumos i
        WHERE i.stock > 0 AND (i.nombre LIKE ? OR i.marca LIKE ? OR i.descripcion LIKE ?))
        `,
        [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
    );
    return rows.map(item => ({ ...item, images: item.images ? item.images.split(',') : [] }));
};
