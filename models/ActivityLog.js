import db from '../config/db.js';

/**
 * Registra una acción realizada por un administrador.
 */
export const logAdminActivity = async (admin_id, admin_name, action, target_type = null, target_id = null, details = {}) => {
  try {
    const detailsJson = JSON.stringify(details);
    await db.query(
      'INSERT INTO admin_activity_log (admin_id, admin_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [admin_id, admin_name, action, target_type, target_id, detailsJson]
    );
  } catch (error) {
    console.error('Error al registrar la actividad del admin:', error);
  }
};

/**
 * Obtiene los registros de actividad, con filtros opcionales.
 * @param {object} filters - Objeto con los filtros: { adminName, action, date }.
 */
export const getActivityLogs = async (filters = {}) => {
    try {
        const { adminName, action, date } = filters;
        let query = 'SELECT * FROM admin_activity_log';
        const conditions = [];
        const params = [];

        if (adminName) {
            conditions.push('admin_name LIKE ?');
            params.push(`%${adminName}%`);
        }
        if (action) {
            conditions.push('action = ?');
            params.push(action);
        }
        if (date) {
            conditions.push('DATE(timestamp) = ?');
            params.push(date);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY timestamp DESC LIMIT 200';

        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error('Error al obtener los registros de actividad:', error);
        throw error;
    }
};