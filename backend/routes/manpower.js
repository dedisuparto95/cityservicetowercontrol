const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

// Jalur untuk mengambil data dari tab '03_PROJECT_MANPOWER'
router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('03_PROJECT_MANPOWER');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error dari Google Sheets (Manpower):", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data manpower', error: error.message });
    }
});

module.exports = router;