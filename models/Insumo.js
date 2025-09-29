import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const deleteImageFiles = (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;
    imageUrls.forEach(url => {
        const filePath = path.join(path.resolve(), url);
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Error al eliminar archivo de imagen ${filePath}:`, err);
        });
    });
};

export const createInsumo = async (insumoData, images) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const insumoId = uuidv4();
        const { supplier_id, nombre, categoria, marca, precio, stock, descripcion, caracteristicas } = insumoData;

        await connection.query(
            'INSERT INTO insumos (id, supplier_id, nombre, categoria, marca, precio, stock, descripcion, caracteristicas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [insumoId, supplier_id, nombre, categoria, marca, precio, stock, descripcion, caracteristicas]
        );

        if (images && images.length > 0) {
            const imageValues = images.map(img => [insumoId, img.path.replace(/\\/g, '/')]);
            await connection.query('INSERT INTO insumo_images (insumo_id, image_url) VALUES ?', [imageValues]);
        }
        await connection.commit();
        return { id: insumoId, ...insumoData };
    } catch (error) {
        await connection.rollback();
        if (images && images.length > 0) {
            deleteImageFiles(images.map(img => img.path));
        }
        throw error;
    } finally {
        connection.release();
    }
};

// --- FUNCIÓN MODIFICADA PARA ACEPTAR BÚSQUEDA ---
export const findInsumosBySupplier = async (supplierId, searchTerm = '') => {
    let query = `
        SELECT i.id, i.nombre, i.categoria, i.marca, i.precio, i.stock, i.descripcion, i.caracteristicas, 
        (SELECT GROUP_CONCAT(ii.image_url) FROM insumo_images ii WHERE ii.insumo_id = i.id) as images
        FROM insumos i 
        WHERE i.supplier_id = ?`;

    const params = [supplierId];

    if (searchTerm) {
        query += ` AND i.nombre LIKE ?`;
        params.push(`%${searchTerm}%`);
    }

    query += ` GROUP BY i.id ORDER BY i.created_at DESC`;
    
    const [insumos] = await db.query(query, params);
    return insumos.map(i => ({ ...i, images: i.images ? i.images.split(',') : [] }));
};

export const updateInsumoById = async (insumoId, supplierId, insumoData, newImages) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { nombre, categoria, marca, precio, stock, descripcion, caracteristicas } = insumoData;

        const [result] = await connection.query(
            'UPDATE insumos SET nombre = ?, categoria = ?, marca = ?, precio = ?, stock = ?, descripcion = ?, caracteristicas = ? WHERE id = ? AND supplier_id = ?',
            [nombre, categoria, marca, precio, stock, descripcion, caracteristicas, insumoId, supplierId]
        );

        if (newImages && newImages.length > 0) {
            const [oldImages] = await connection.query('SELECT image_url FROM insumo_images WHERE insumo_id = ?', [insumoId]);
            await connection.query('DELETE FROM insumo_images WHERE insumo_id = ?', [insumoId]);
            deleteImageFiles(oldImages.map(img => img.image_url));

            const imageValues = newImages.map(img => [insumoId, img.path.replace(/\\/g, '/')]);
            await connection.query('INSERT INTO insumo_images (insumo_id, image_url) VALUES ?', [imageValues]);
        }

        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        console.error("Error en updateInsumoById:", error);
        throw error;
    } finally {
        connection.release();
    }
};

export const deleteInsumoById = async (insumoId, supplierId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [images] = await connection.query(
            'SELECT image_url FROM insumo_images WHERE insumo_id = (SELECT id FROM insumos WHERE id = ? AND supplier_id = ?)',
            [insumoId, supplierId]
        );
        const imageUrls = images.map(img => img.image_url);
        const [result] = await connection.query('DELETE FROM insumos WHERE id = ? AND supplier_id = ?', [insumoId, supplierId]);
        
        await connection.commit();
        
        if (result.affectedRows > 0) {
            deleteImageFiles(imageUrls);
        }
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const findAllPublicInsumos = async () => {
    const [insumos] = await db.query(
        `SELECT i.id, i.nombre, i.categoria, i.marca, i.precio, i.stock, i.descripcion, i.caracteristicas, 
         'insumo' AS item_type,
         GROUP_CONCAT(ii.image_url) as images FROM insumos i
         LEFT JOIN insumo_images ii ON ii.insumo_id = i.id 
         WHERE i.stock > 0
         GROUP BY i.id ORDER BY i.created_at DESC`
    );
    return insumos.map(i => ({ ...i, images: i.images ? i.images.split(',') : [] }));
};

export const findInsumoById = async (insumoId) => {
    try {
        const [insumos] = await db.query(
            `SELECT 
                 i.id, i.nombre, i.categoria, i.marca, i.precio, i.stock, i.descripcion, i.caracteristicas, 
                 GROUP_CONCAT(ii.image_url) as images,
                 AVG(r.rating) as avg_rating,
                 COUNT(r.id) as review_count
             FROM insumos i
             LEFT JOIN insumo_images ii ON i.id = ii.insumo_id
             LEFT JOIN reviews r ON i.id = r.insumo_id
             WHERE i.id = ?
             GROUP BY i.id`,
            [insumoId]
        );
        if (insumos.length === 0) return null;
        const insumo = insumos[0];
        return { ...insumo, images: insumo.images ? insumo.images.split(',') : [] };
    } catch (error) {
        console.error("Error en findInsumoById:", error);
        throw error;
    }
};

export const findBestSellers = async (limit = 5) => {
    const [insumos] = await db.query(
        `SELECT 
            i.id, i.nombre, i.categoria, i.marca, i.precio, i.stock, i.descripcion, i.caracteristicas,
            GROUP_CONCAT(ii.image_url) as images, 
            COUNT(oi.insumo_id) as sales_count
         FROM insumos i
         LEFT JOIN insumo_images ii ON i.id = ii.insumo_id
         JOIN order_items oi ON i.id = oi.insumo_id
         WHERE i.stock > 0
         GROUP BY i.id
         ORDER BY sales_count DESC
         LIMIT ?`,
        [limit]
    );
    return insumos.map(i => ({ ...i, images: i.images ? i.images.split(',') : [] }));
};