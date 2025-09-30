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

process.on('unhandledRejection', (err, promise) => {
    console.error(`ALERTA: Error de Promesa no Manejado: ${err.message}`, err);
});
process.on('uncaughtException', (err) => {
    console.error(`ERROR CRÍTICO: Error no Capturado: ${err.message}`, err);
    process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ====================================================================
// 💡 CONFIGURACIÓN DE CORS ADAPTADA
// ====================================================================

// Construye la lista de orígenes a partir de una lista base y la variable de entorno.
// Se usa un array simple y Filter para evitar valores nulos (undefined) si la variable FRONTEND_URL no está.
const allowedOrigins = [
    'http://localhost:5173',
    // La URL de Render de tu Static Site (CLAVE)
    'https://frontend-coffee-house.onrender.com', 
    // La URL alternativa (si es necesaria)
    'http://coffeehouse25.s3-website.us-east-2.amazonaws.com',
    // Carga la variable de entorno definida en Render
    process.env.FRONTEND_URL 
].filter(Boolean); // Elimina entradas nulas si FRONTEND_URL no está definida

const corsOptions = {
    origin: (origin, callback) => {
        // Si no hay origen (ej. curl o cliente REST), permitir.
        // Si el origen está en la lista de permitidos, permitir.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Loguea el origen rechazado para debug
            console.warn(`CORS RECHAZADO: Origen no permitido: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

app.use(cors(corsOptions));

// ====================================================================
// FIN CONFIGURACIÓN DE CORS
// ====================================================================

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas de la API (Se mantienen tus rutas originales)
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
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor',
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});