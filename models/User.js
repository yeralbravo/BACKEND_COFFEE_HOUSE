import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import crypto from 'crypto';
import { sendEmail } from '../services/emailService.js'; 

export const createUser = async (nombre, apellido, telefono, correo, contraseña, role) => {
    try {
        const hashedPassword = await bcrypt.hash(contraseña, 10);
        const [result] = await db.query(
            'INSERT INTO users (nombre, apellido, telefono, correo, contraseña, role) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, apellido, telefono, correo, hashedPassword, role]
        );
        return result;
    } catch (error) {
        console.error("Error en createUser:", error);
        throw error;
    }
};

export const findUserByEmail = async (correo) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE correo = ?', [correo]);
        return rows[0];
    } catch (error) {
        console.error("Error en findUserByEmail:", error);
        throw error;
    }
};

export const findUserByPhone = async (telefono) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE telefono = ?', [telefono]);
        return rows[0];
    } catch (error) {
        console.error("Error en findUserByPhone:", error);
        throw error;
    }
};

export const loginUser = async (correo) => {
    return findUserByEmail(correo);
};

export const findUserById = async (id) => {
    try {
        const [result] = await db.query(
            'SELECT id, nombre, apellido, telefono, correo, role, profile_picture_url FROM users WHERE id = ?',
            [id]
        );
        return result[0];
    } catch (error) {
        throw error;
    }
};

export const showUsers = async (role, searchTerm) => {
    try {
        let query = 'SELECT id, nombre, apellido, telefono, correo, role, profile_picture_url FROM users';
        const conditions = [];
        const params = [];

        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }

        if (searchTerm) {
            conditions.push('(nombre LIKE ? OR apellido LIKE ? OR correo LIKE ? OR telefono LIKE ?)');
            const searchTermLike = `%${searchTerm}%`;
            params.push(searchTermLike, searchTermLike, searchTermLike, searchTermLike);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY nombre ASC';

        const [results] = await db.query(query, params);
        return results;
    } catch (error) {
        console.error('Error en la consulta:', error);
        throw error;
    }
};

export const deleteUserById = async (userId) => {
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);
        return result;
    } catch (error) {
        throw error;
    }
};

export const editUsers = async (id, fields) => {
    try {
        if (Object.keys(fields).length === 0) {
            throw new Error('No se proporcionaron campos para actualizar');
        }
        const [result] = await db.query('UPDATE users SET ? WHERE id = ?', [fields, id]);
        return result;
    } catch (error) {
        throw error;
    }
};

export const getUserStats = async (range) => {
    try {
        let whereClause = '';
        switch (range) {
            case 'day':
                whereClause = 'WHERE created_at >= CURDATE()';
                break;
            case 'week':
                whereClause = 'WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
                break;
            case 'month':
                whereClause = 'WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
                break;
            case 'year':
                whereClause = 'WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
                break;
        }
        
        const query = `SELECT role, COUNT(*) as count FROM users ${whereClause} GROUP BY role`;
        const [rows] = await db.query(query);
        
        const stats = {
            total: 0,
            client: 0,
            admin: 0,
            supplier: 0
        };

        rows.forEach(row => {
            if (stats.hasOwnProperty(row.role)) {
                stats[row.role] = row.count;
            }
            stats.total += row.count;
        });

        return stats;
    } catch (error) {
        console.error("Error en getUserStats:", error);
        throw error;
    }
};

export const changePassword = async (userId, currentPassword, newPassword) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = rows[0];
        if (!user) {
            return { success: false, error: 'Usuario no encontrado.' };
        }
        const isMatch = await bcrypt.compare(currentPassword, user.contraseña);
        if (!isMatch) {
            return { success: false, error: 'La contraseña actual es incorrecta.' };
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET contraseña = ? WHERE id = ?', [hashedNewPassword, userId]);
        return { success: true };
    } catch (error) {
        console.error("Error en changePassword:", error);
        throw error;
    }
};

export const generatePasswordResetCode = async (email) => {
    const user = await findUserByEmail(email);
    if (!user) {
        throw new Error('No existe una cuenta con ese correo electrónico.');
    }
    
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');
    const expirationDate = new Date(Date.now() + 600000);

    await db.query(
        'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
        [hashedCode, expirationDate, user.id]
    );
    
    // Lógica de envío de correo con logo
    const subject = "Código de Recuperación de Contraseña";
    const htmlContent = `
        <div style="text-align: center;">
            <img src="https://subir-imagen.com/images/2025/09/23/logo.png" alt="Logo de COFFEEHOUSE" style="width:120px; height:auto;"/>
        </div>
        <h1>Hola, ${user.nombre}</h1>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Si no hiciste esta solicitud, por favor ignora este correo.</p>
        <p>Tu código de recuperación es:</p>
        <h2 style="color: #24651C; font-size: 24px; text-align: center;"><strong>${resetCode}</strong></h2>
        <p style="margin-top: 20px;">Este código es válido por 10 minutos.</p>
    `;
    await sendEmail(user.correo, subject, htmlContent); // Llama a la función para enviar el correo

    return resetCode;
};

export const resetPasswordWithCode = async (email, code, newPassword) => {
    const user = await findUserByEmail(email);
    if (!user || !user.reset_password_token || !user.reset_password_expires) {
        throw new Error('Solicitud de reinicio inválida o no encontrada.');
    }

    if (new Date() > new Date(user.reset_password_expires)) {
        throw new Error('El código de recuperación ha expirado.');
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    if (hashedCode !== user.reset_password_token) {
        throw new Error('El código de recuperación es incorrecto.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
        'UPDATE users SET contraseña = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
        [hashedNewPassword, user.id]
    );

    return { success: true, message: 'La contraseña ha sido actualizada.' };
};

export const findAllAdminIds = async () => {
    try {
        const [rows] = await db.query("SELECT id FROM users WHERE role = 'admin'");
        return rows.map(row => row.id);
    } catch (error) {
        console.error("Error en findAllAdminIds:", error);
        throw error;
    }
};