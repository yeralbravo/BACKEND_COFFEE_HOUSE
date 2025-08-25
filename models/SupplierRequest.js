import db from '../config/db.js';
import { createNotificationForAllAdmins } from './Notification.js';

/**
 * Crea una nueva solicitud de proveedor y notifica a los administradores.
 */
export const createSupplierRequest = async (requestData) => {
    const {
        company_name,
        nit,
        contact_person,
        email,
        phone,
        address,
        city,
        product_types,
        message
    } = requestData;

    try {
        const [result] = await db.query(
            'INSERT INTO supplier_requests (company_name, nit, contact_person, email, phone, address, city, product_types, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [company_name, nit, contact_person, email, phone, address, city, product_types, message]
        );

        const notificationMessage = `Nueva solicitud de proveedor de: ${company_name}`;
        await createNotificationForAllAdmins(notificationMessage, '/admin/supplier-requests');

        return { id: result.insertId, ...requestData };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('Ya existe una solicitud con el mismo NIT o correo electrónico.');
        }
        console.error("Error al crear la solicitud de proveedor:", error);
        throw error;
    }
};

/**
 * Obtiene todas las solicitudes de proveedores.
 */
export const getAllSupplierRequests = async (status = null) => {
    try {
        let query = 'SELECT * FROM supplier_requests';
        const params = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error("Error al obtener las solicitudes:", error);
        throw error;
    }
};

/**
 * Actualiza el estado de una solicitud de proveedor.
 */
export const updateRequestStatus = async (requestId, status) => {
    const [result] = await db.query(
        'UPDATE supplier_requests SET status = ? WHERE id = ?',
        [status, requestId]
    );
    return result;
};

/**
 * Encuentra una solicitud de proveedor por su ID.
 */
export const findRequestById = async (requestId) => {
    const [rows] = await db.query('SELECT * FROM supplier_requests WHERE id = ?', [requestId]);
    return rows[0];
};

// --- FUNCIONES DE VALIDACIÓN ---
export const findRequestByEmail = async (email) => {
    const [rows] = await db.query('SELECT id FROM supplier_requests WHERE email = ?', [email]);
    return rows[0];
};

export const findRequestByPhone = async (phone) => {
    const [rows] = await db.query('SELECT id FROM supplier_requests WHERE phone = ?', [phone]);
    return rows[0];
};

// --- NUEVA FUNCIÓN ---
export const findRequestByNit = async (nit) => {
    const [rows] = await db.query('SELECT id FROM supplier_requests WHERE nit = ?', [nit]);
    return rows[0];
};