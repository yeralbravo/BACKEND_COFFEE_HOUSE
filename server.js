import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Importaciones de Rutas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import insumoRoutes from './routes/insumoRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import supplierRequestRoutes from './routes/supplierRequestRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import itemRoutes from './routes/itemRoutes.js';

dotenv.config();

// =======================================================
// CONFIGURACIÓN PARA ES MODULES (import/export)
// Necesario para poder usar __dirname con módulos de ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// =======================================================

// Manejo de promesas no manejadas (unhandled rejections)
process.on('unhandledRejection', (err, promise) => {
    console.error(`ALERTA: Error de Promesa no Manejado: ${err.message}`, err);
    // En un entorno de producción, podrías querer apagar el servidor aquí.
});

const app = express();

// Seguridad con Helmet: ayuda a proteger la aplicación de vulnerabilidades conocidas.
app.use(helmet());

// Configuración de CORS para permitir la comunicación con el frontend
const allowedOrigins = ['http://localhost:5173', process.env.FRONTEND_URL];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir peticiones sin 'origin' (como apps móviles o curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'), false);
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));

// Limitador de tasa (Rate Limiter) para prevenir ataques de fuerza bruta/DoS
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite de 100 peticiones por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo después de 15 minutos.'
});

app.use(limiter);

// Middlewares de parseo (body-parser)
// Se aumenta el límite de tamaño de payload para manejar subidas de imágenes (5mb)
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas de la API
// ************************************************************
// Todas las rutas están correctamente montadas bajo /api/*
// ************************************************************
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/insumos', insumoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/supplier-requests', supplierRequestRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/items', itemRoutes);

// Middleware para rutas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Middleware manejador de errores final y global
app.use((err, req, res, next) => {
    console.error('Error capturado por el manejador global:', err.stack);

    const statusCode = err.status || 500;
    let errorMessage = err.message || 'Error interno del servidor';
    
    // Manejo de errores específicos de JWT
    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        errorMessage = 'Token no válido o expirado.';
        return res.status(401).json({ success: false, error: errorMessage });
    }

    res.status(statusCode).json({
        success: false,
        error: errorMessage,
        // Puedes descomentar para ver el stack en desarrollo
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));