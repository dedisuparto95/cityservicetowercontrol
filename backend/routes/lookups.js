const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

router.get('/', async (req, res) => {
    try {
        const rows = await googleSheetsService.getRows('19_LOOKUPS');
        const data = {
            categories1: [], categories2Map: [], services: [], uoms: [], deliveryMethods: [],
            minusCategories: [], shifts: [], grades: [], 
            bankAccounts: [] // TAMBAHAN FASE 2: Rekening Bank
        };

        rows.forEach(row => {
            const keys = Object.keys(row);
            const colA_Cat1 = row[keys[0]]; const colB_Cat2 = row[keys[1]]; const colC_Sett = row[keys[2]]; 
            const colD_Serv = row[keys[3]]; const colE_Unit = row[keys[4]]; const colF_Delivery = row[keys[5]]; 
            const colG_Shift = row['SHIFT'] || row['NAMA SHIFT'] || (keys.length > 6 ? row[keys[6]] : null);
            const colH_Grade = row['GRADE'] || row['NAMA GRADE'] || (keys.length > 7 ? row[keys[7]] : null);
            // Ekstrak Kolom I (Rekening Penerima)
            const colI_Bank = row['REKENING'] || row['BANK'] || row['INFORMASI REKENING'] || (keys.length > 8 ? row[keys[8]] : null);
            const colP_Reason = row['OVER REASON'] || row['OVER_REASON'] || row['ALASAN OVER'] || row['ALASAN'] || (keys.length > 15 ? row[keys[15]] : null);

            if (colA_Cat1 && colA_Cat1.trim() !== '' && !data.categories1.includes(colA_Cat1.toUpperCase())) data.categories1.push(colA_Cat1.toUpperCase());
            if (colB_Cat2 && colB_Cat2.trim() !== '') {
                const cat2Name = colB_Cat2.toUpperCase();
                if (!data.categories2Map.find(c => c.name === cat2Name)) data.categories2Map.push({ name: cat2Name, sett: colC_Sett ? String(colC_Sett).replace('%', '').trim() : '100' });
            }
            if (colD_Serv && colD_Serv.trim() !== '' && !data.services.includes(colD_Serv.toUpperCase())) data.services.push(colD_Serv.toUpperCase());
            if (colE_Unit && colE_Unit.trim() !== '' && !data.uoms.includes(colE_Unit.toUpperCase())) data.uoms.push(colE_Unit.toUpperCase());
            if (colF_Delivery && colF_Delivery.trim() !== '' && !data.deliveryMethods.includes(colF_Delivery.toUpperCase())) data.deliveryMethods.push(colF_Delivery.toUpperCase());
            if (colG_Shift && colG_Shift.trim() !== '' && !data.shifts.includes(colG_Shift.trim().toUpperCase())) data.shifts.push(colG_Shift.trim().toUpperCase());
            if (colH_Grade && colH_Grade.trim() !== '' && !data.grades.includes(colH_Grade.trim().toUpperCase())) data.grades.push(colH_Grade.trim().toUpperCase());
            // Memasukkan opsi bank
            if (colI_Bank && colI_Bank.trim() !== '' && !data.bankAccounts.includes(colI_Bank.trim().toUpperCase())) data.bankAccounts.push(colI_Bank.trim().toUpperCase());
            if (colP_Reason && colP_Reason.trim() !== '' && !data.minusCategories.includes(colP_Reason.trim().toUpperCase())) data.minusCategories.push(colP_Reason.trim().toUpperCase());
        });

        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal Lookups' }); }
});

module.exports = router;