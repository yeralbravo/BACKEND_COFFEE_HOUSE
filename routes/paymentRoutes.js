import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { verifyToken } from '../middleware/authMiddleware.js';

// Inicializa el cliente de Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
});

const router = express.Router();

router.post('/create-order', verifyToken, async (req, res) => {
    try {
        const { cartItems } = req.body;

        const items = cartItems.map(item => ({
            id: item.id,
            title: item.nombre,
            quantity: Number(item.quantity),
            unit_price: Number(item.precio),
            currency_id: 'COP',
        }));

        const preference = new Preference(client);
        
        const result = await preference.create({
            body: {
                items: items,
                back_urls: {
                    success: 'http://localhost:5173/payment/success',
                    failure: 'http://localhost:5173/payment/failure',
                    pending: 'http://localhost:5173/payment/pending',
                },
                // Se elimina la línea 'auto_return' para evitar el conflicto.
            }
        });

        res.status(201).json({ 
            success: true, 
            payment_url: result.init_point 
        });

    } catch (error) {
        console.error('Error al crear orden de pago:', error.cause || error);
        res.status(500).json({ success: false, error: 'No se pudo generar el link de pago.' });
    }
});

export default router;