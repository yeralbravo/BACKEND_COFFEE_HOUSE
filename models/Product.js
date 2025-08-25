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

export const createProduct = async (productData, images) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const productId = uuidv4();
        const { supplier_id, nombre, tipo, precio, peso_neto, descripcion, caracteristicas, stock, marca } = productData;
        await connection.query(
            'INSERT INTO products (id, supplier_id, nombre, tipo, precio, peso_neto, descripcion, caracteristicas, stock, marca) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [productId, supplier_id, nombre, tipo, precio, peso_neto, descripcion, caracteristicas, stock, marca]
        );
        if (images && images.length > 0) {
            const imageValues = images.map(img => [productId, img.path.replace(/\\/g, '/')]);
            await connection.query('INSERT INTO product_images (product_id, image_url) VALUES ?', [imageValues]);
        }
        await connection.commit();
        return { id: productId, ...productData };
    } catch (error) {
        await connection.rollback();
        if (images && images.length > 0) {
            deleteImageFiles(images.map(img => img.path));
        }
        console.error("Error en createProduct:", error);
        throw error;
    } finally {
        connection.release();
    }
};

export const updateProductById = async (productId, supplierId, productData, newImages) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { nombre, tipo, precio, peso_neto, descripcion, caracteristicas, stock, marca } = productData;

        const [result] = await connection.query(
            'UPDATE products SET nombre = ?, tipo = ?, precio = ?, peso_neto = ?, descripcion = ?, caracteristicas = ?, stock = ?, marca = ? WHERE id = ? AND supplier_id = ?',
            [nombre, tipo, precio, peso_neto, descripcion, caracteristicas, stock, marca, productId, supplierId]
        );

        if (newImages && newImages.length > 0) {
            const imageValues = newImages.map(img => [productId, img.path.replace(/\\/g, '/')]);
            await connection.query('INSERT INTO product_images (product_id, image_url) VALUES ?', [imageValues]);
        }

        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        console.error("Error en updateProductById:", error);
        throw error;
    } finally {
        connection.release();
    }
};

export const findProductsBySupplier = async (supplierId) => {
    try {
        const [products] = await db.query(
            `SELECT p.id, p.nombre, p.tipo, p.marca, p.precio, p.stock, p.descripcion, p.caracteristicas,
             (SELECT GROUP_CONCAT(pi.image_url) FROM product_images pi WHERE pi.product_id = p.id) as images
             FROM products p WHERE p.supplier_id = ? GROUP BY p.id ORDER BY p.created_at DESC`,
            [supplierId]
        );
        return products.map(p => ({...p, images: p.images ? p.images.split(',') : [] }));
    } catch (error) {
        console.error("Error en findProductsBySupplier:", error);
        throw error;
    }
};

export const deleteProductById = async (productId, supplierId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [images] = await connection.query('SELECT image_url FROM product_images WHERE product_id = (SELECT id FROM products WHERE id = ? AND supplier_id = ?)', [productId, supplierId]);
        const imageUrls = images.map(img => img.image_url);
        const [result] = await connection.query('DELETE FROM products WHERE id = ? AND supplier_id = ?', [productId, supplierId]);
        await connection.commit();
        if (result.affectedRows > 0) {
            deleteImageFiles(imageUrls);
        }
        return result;
    } catch (error) {
        await connection.rollback();
        console.error("Error en deleteProductById:", error);
        throw error;
    } finally {
        connection.release();
    }
};

export const findAllPublicProducts = async () => {
    try {
        const [products] = await db.query(
            `SELECT p.id, p.nombre, p.tipo, p.marca, p.precio, p.stock, p.descripcion, p.caracteristicas,
             'product' AS itemType, -- <--- LÍNEA MODIFICADA
             GROUP_CONCAT(pi.image_url) as images FROM products p
             LEFT JOIN product_images pi ON p.id = pi.product_id 
             WHERE p.stock > 0
             GROUP BY p.id ORDER BY p.created_at DESC`
        );
        return products.map(p => ({ ...p, images: p.images ? p.images.split(',') : [] }));
    } catch (error) {
        console.error("Error en findAllPublicProducts:", error);
        throw error;
    }
};

export const findProductById = async (productId) => {
    try {
        const [products] = await db.query(
            `SELECT 
                 p.id, p.nombre, p.tipo, p.marca, p.precio, p.stock, p.peso_neto, p.descripcion, p.caracteristicas,
                 GROUP_CONCAT(pi.image_url) as images,
                 AVG(r.rating) as avg_rating,
                 COUNT(r.id) as review_count
             FROM products p
             LEFT JOIN product_images pi ON p.id = pi.product_id
             LEFT JOIN reviews r ON p.id = r.product_id
             WHERE p.id = ?
             GROUP BY p.id`,
            [productId]
        );
        if (products.length === 0) return null;
        const product = products[0];
        return { ...product, images: product.images ? product.images.split(',') : [] };
    } catch (error) {
        console.error("Error en findProductById:", error);
        throw error;
    }
};

export const findBestSellers = async (limit = 5) => {
    try {
        const [products] = await db.query(
            `SELECT 
                 p.id, p.nombre, p.tipo, p.marca, p.precio, p.stock, p.descripcion, p.caracteristicas,
                 GROUP_CONCAT(pi.image_url) as images, 
                 COUNT(oi.product_id) as sales_count
             FROM products p
             LEFT JOIN product_images pi ON p.id = pi.product_id
             JOIN order_items oi ON p.id = oi.product_id
             WHERE p.stock > 0
             GROUP BY p.id
             ORDER BY sales_count DESC
             LIMIT ?`,
            [limit]
        );
        return products.map(p => ({ ...p, images: p.images ? p.images.split(',') : [] }));
    } catch (error) {
        console.error("Error en findBestSellers:", error);
        throw error;
    }
};