const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('13_QC');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error mengambil QC:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data QC', error: error.message });
    }
});

module.exports = router;