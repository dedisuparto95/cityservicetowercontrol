const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

// Jalur untuk mengambil data dari tab '15_VENDORS'
router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('15_VENDORS');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error dari Google Sheets (Vendors):", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data vendors', error: error.message });
    }
});

module.exports = router;