import express from 'express';
import { findPopularItems, findRecentItems, findTopRatedAndSoldItems } from '../models/Catalog.js';

const router = express.Router();

// Ruta para las secciones de la página de cliente logueado
router.get('/home-sections', async (req, res) => {
    try {
        const [popularItems, recentItems] = await Promise.all([
            findPopularItems(8),
            findRecentItems(24)
        ]);
        res.status(200).json({
            success: true,
            data: { popularItems, recentItems }
        });
    } catch (error) {
        console.error("Error fetching home page sections:", error);
        res.status(500).json({ success: false, error: 'Error al obtener los productos de la página principal.' });
    }
});

// Ruta para los productos de la landing page
router.get('/landing-products', async (req, res) => {
    try {
        const topItems = await findTopRatedAndSoldItems(4);
        res.status(200).json({
            success: true,
            data: topItems
        });
    } catch (error) {
        console.error("Error fetching landing page products:", error);
        res.status(500).json({ success: false, error: 'Error al obtener los productos destacados.' });
    }
});

export default router;