const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

// Jalur untuk mengambil data dari tab '07_STOCK'
router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('07_STOCK');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error dari Google Sheets (Stock):", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data stock', error: error.message });
    }
});

module.exports = router;