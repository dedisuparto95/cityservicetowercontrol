const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('08_STOCK_MOVEMENT');
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data stock movement', error: error.message });
    }
});

module.exports = router;