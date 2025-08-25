import express from 'express';
import { searchItems } from '../models/Search.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { q } = req.query; // q = query
    if (!q) {
        return res.status(400).json({ success: false, error: 'Se requiere un término de búsqueda.' });
    }
    try {
        const results = await searchItems(q);
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("Error en la búsqueda:", error);
        res.status(500).json({ success: false, error: 'Error al realizar la búsqueda.' });
    }
});

export default router;