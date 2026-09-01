const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('02_PROJECTS');
        const formattedData = data.map(proj => {
            let parsedRemunerations = [], parsedOperations = [], parsedHistory = [], parsedShifts = [], parsedFees = [];
            try { parsedRemunerations = JSON.parse(proj.remunerations || '[]'); } catch (e) {}
            try { parsedOperations = JSON.parse(proj.operational_items || '[]'); } catch (e) {}
            try { parsedHistory = JSON.parse(proj.quotation_history || '[]'); } catch (e) {}
            try { parsedShifts = JSON.parse(proj.shifts || '[]'); } catch (e) {}
            try { parsedFees = JSON.parse(proj.commitment_fees || '[]'); } catch (e) {} // Parse Fees Baru

            return {
                ...proj, remunerations: parsedRemunerations, operational_items: parsedOperations,
                quotation_history: parsedHistory, shifts: parsedShifts, commitment_fees: parsedFees
            };
        });
        res.json({ success: true, data: formattedData });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal get projects' }); }
});

router.post('/', async (req, res) => {
    try {
        const raw = req.body;
        const existingProjects = await googleSheetsService.getRows('02_PROJECTS');
        let maxNum = 0;
        existingProjects.forEach(proj => {
            if (proj.project_id && proj.project_id.startsWith('PRJ-')) {
                const num = parseInt(proj.project_id.replace('PRJ-', ''), 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        const nextId = `PRJ-${String(maxNum + 1).padStart(6, '0')}`;
        
        const newProject = {
            project_id: nextId, project_name: raw.project_name || '', company_name: raw.company_name || '',
            location: raw.location || '', work_location: raw.work_location || '', pic_name: raw.pic_name || '', 
            pic_email: raw.pic_email || '', pic_phone: raw.pic_phone || '', work_pattern: raw.work_pattern || '',
            start_time: raw.start_time || '', end_time: raw.end_time || '', contract_period: raw.contract_period || '',
            contract_start: raw.contract_start || '', contract_end: raw.contract_end || '', 
            term_of_payment: raw.term_of_payment || '', additional_notes: raw.additional_notes || '', 
            shifts: typeof raw.shifts === 'object' ? JSON.stringify(raw.shifts) : raw.shifts || '[]', 
            remunerations: typeof raw.remunerations === 'object' ? JSON.stringify(raw.remunerations) : raw.remunerations || '[]',
            operational_items: typeof raw.operational_items === 'object' ? JSON.stringify(raw.operational_items) : raw.operational_items || '[]',
            commitment_fees: typeof raw.commitment_fees === 'object' ? JSON.stringify(raw.commitment_fees) : raw.commitment_fees || '[]', // Stringify Fees Baru
            membership_plan: raw.membership_plan || '', management_fee: raw.management_fee || '',
            status: raw.status || 'DRAFT', quotation_history: typeof raw.quotation_history === 'object' ? JSON.stringify(raw.quotation_history) : raw.quotation_history || '[]',
            updated_at: new Date().toISOString()
        };

        await googleSheetsService.appendRow('02_PROJECTS', newProject);
        res.json({ success: true, message: 'Project berhasil ditambahkan', data: newProject });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menambah project' }); }
});

router.put('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        const raw = req.body;
        
        const updatedProject = {
            project_name: raw.project_name, company_name: raw.company_name, location: raw.location,
            work_location: raw.work_location, pic_name: raw.pic_name, pic_email: raw.pic_email, pic_phone: raw.pic_phone, 
            work_pattern: raw.work_pattern, start_time: raw.start_time, end_time: raw.end_time,
            contract_period: raw.contract_period, contract_start: raw.contract_start, contract_end: raw.contract_end, 
            term_of_payment: raw.term_of_payment, additional_notes: raw.additional_notes, 
            shifts: typeof raw.shifts === 'object' ? JSON.stringify(raw.shifts) : raw.shifts || '[]', 
            remunerations: typeof raw.remunerations === 'object' ? JSON.stringify(raw.remunerations) : raw.remunerations || '[]',
            operational_items: typeof raw.operational_items === 'object' ? JSON.stringify(raw.operational_items) : raw.operational_items || '[]',
            commitment_fees: typeof raw.commitment_fees === 'object' ? JSON.stringify(raw.commitment_fees) : raw.commitment_fees || '[]', // Stringify Fees Baru
            membership_plan: raw.membership_plan, management_fee: raw.management_fee, status: raw.status,
            quotation_history: typeof raw.quotation_history === 'object' ? JSON.stringify(raw.quotation_history) : raw.quotation_history || '[]',
            updated_at: new Date().toISOString()
        };

        await googleSheetsService.updateRow('02_PROJECTS', 'project_id', projectId, updatedProject);
        res.json({ success: true, message: 'Project berhasil diupdate' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal update project' }); }
});

module.exports = router;