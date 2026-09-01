const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('12_RECEIVING');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error mengambil Receiving:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data Receiving', error: error.message });
    }
});

module.exports = router;