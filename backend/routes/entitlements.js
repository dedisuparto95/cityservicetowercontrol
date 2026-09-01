const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

// Jalur untuk mengambil data dari tab '05_PROJECT_ENTITLEMENT'
router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('05_PROJECT_ENTITLEMENT');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error dari Google Sheets (Entitlements):", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data entitlements', error: error.message });
    }
});

module.exports = router;