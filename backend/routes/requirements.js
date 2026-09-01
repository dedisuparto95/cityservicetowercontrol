const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');
const { validateRequirement } = require('../services/validationEngine');

// GET: Ambil daftar seluruh request
router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('06_REQUIREMENTS');
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data requirements', error: error.message });
    }
});

// POST: Terima Request baru dari Frontend -> Proses Mesin -> Simpan ke Google Sheets
router.post('/', async (req, res) => {
    try {
        const reqData = req.body;
        
        // 1. Tarik referensi data untuk mesin validasi
        const projects = await googleSheetsService.getRows('02_PROJECTS');
        const entitlements = await googleSheetsService.getRows('05_PROJECT_ENTITLEMENT');
        const manpower = await googleSheetsService.getRows('03_PROJECT_MANPOWER');
        
        // 2. Temukan data yang spesifik dengan request ini
        const project = projects.find(p => p.project_id === reqData.project_id);
        const entitlement = entitlements.find(e => e.project_id === reqData.project_id && e.item_id === reqData.item_id);
        const projectManpower = manpower.filter(m => m.project_id === reqData.project_id && (m.status === 'ACTIVE' || m.status === 'Active'));
        
        // 3. Lempar ke Otak Validasi
        const previousUsage = 0; // Sementara diset 0, akan dikembangkan di fase advanced
        const validation = validateRequirement(reqData, project, entitlement, projectManpower, previousUsage);
        
        const totalManpowerQty = projectManpower.reduce((sum, mp) => sum + parseInt(mp.manpower_qty || 0), 0);
        
        // 4. Rakit data final untuk disimpan ke Spreadsheet
        const newRecord = {
            request_id: googleSheetsService.generateUniqueId('REQ'),
            request_date: new Date().toISOString().split('T')[0],
            project_id: reqData.project_id,
            requester: reqData.requester || 'SYSTEM',
            item_id: reqData.item_id,
            requested_qty: reqData.requested_qty,
            request_type: reqData.request_type || 'INITIAL',
            priority: reqData.priority || 'NORMAL',
            manpower_qty: totalManpowerQty,
            expected_qty: validation.expected_qty,
            contract_qty: entitlement ? entitlement.contract_qty : 0,
            previous_usage: previousUsage,
            remaining_entitlement: validation.remaining_entitlement,
            variance_qty: validation.variance_qty,
            variance_pct: `${validation.variance_pct}%`,
            net_requirement: validation.net_requirement,
            validation_status: validation.decision === "REJECTED" ? "FAILED" : "PASSED",
            decision: validation.decision,
            rejection_code: validation.rejection_code,
            approval_status: validation.decision === "NEED_APPROVAL" ? "PENDING" : "APPROVED",
            notes: reqData.notes || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // 5. Tulis ke Google Sheets ('06_REQUIREMENTS')
        await googleSheetsService.appendRow('06_REQUIREMENTS', newRecord);

        // Beri tahu frontend bahwa sukses
        res.json({ success: true, message: 'Request berhasil diproses mesin validasi', data: newRecord });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal memproses request', error: error.message });
    }
});

module.exports = router;