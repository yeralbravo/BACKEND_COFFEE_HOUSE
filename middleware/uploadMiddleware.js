// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');

// Asegurarnos de que exista la carpeta uploads al iniciar
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimeType = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (mimeType && extname) cb(null, true);
  else cb(new Error('Error: El archivo debe ser una imagen válida (JPEG, PNG, GIF, WEBP).'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter
});

// Middlewares exportados
export const uploadProductImages = upload.array('product_images', 5);
export const uploadInsumoImages = upload.array('insumo_images', 5);
export const uploadProfilePicture = upload.single('profile_picture');
