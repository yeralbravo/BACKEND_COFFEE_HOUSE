import db from '../config/db.js';

export const findAddressesByUserId = async (userId) => {
    const [addresses] = await db.query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return addresses;
};

export const createAddress = async (userId, addressData) => {
    // Se añade 'correo' a la desestructuración
    const { nombre, apellido, telefono, correo, direccion, departamento, ciudad, nota } = addressData;
    const [result] = await db.query(
        // Se añade 'correo' a la consulta INSERT
        'INSERT INTO user_addresses (user_id, nombre, apellido, telefono, correo, direccion, departamento, ciudad, nota) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, nombre, apellido, telefono, correo, direccion, departamento, ciudad, nota]
    );
    return { id: result.insertId, ...addressData };
};

export const updateAddressById = async (addressId, userId, addressData) => {
    // Se añade 'correo' a la desestructuración
    const { nombre, apellido, telefono, correo, direccion, departamento, ciudad, nota } = addressData;
    const [result] = await db.query(
        // Se añade 'correo' a la consulta UPDATE
        'UPDATE user_addresses SET nombre = ?, apellido = ?, telefono = ?, correo = ?, direccion = ?, departamento = ?, ciudad = ?, nota = ? WHERE id = ? AND user_id = ?',
        [nombre, apellido, telefono, correo, direccion, departamento, ciudad, nota, addressId, userId]
    );
    return result;
};

export const deleteAddressById = async (addressId, userId) => {
    const [result] = await db.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
    return result;
};
