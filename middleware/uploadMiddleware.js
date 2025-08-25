import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurarse de que el directorio de subidas exista
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Guarda los archivos en la carpeta 'uploads/'
    },
    filename: (req, file, cb) => {
        // Genera un nombre de archivo único para evitar colisiones
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimeType && extname) {
        return cb(null, true);
    }
    cb(new Error('Error: El archivo debe ser una imagen válida (JPEG, PNG, GIF, WEBP).'));
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB por archivo
    fileFilter: fileFilter
});

// Middleware para imágenes de PRODUCTOS
export const uploadProductImages = upload.array('product_images', 5);

// Middleware para imágenes de INSUMOS
export const uploadInsumoImages = upload.array('insumo_images', 5);

// --- NUEVO MIDDLEWARE PARA FOTO DE PERFIL ---
export const uploadProfilePicture = upload.single('profile_picture');