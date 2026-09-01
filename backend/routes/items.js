const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');
const cron = require('node-cron'); // Tambahan: Import Cron Job

// 1. GET: Mengambil Semua Data Items
router.get('/', async (req, res) => {
    try {
        const data = await googleSheetsService.getRows('04_ITEMS');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error("Error get items:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data items', error: error.message });
    }
});

// 2. POST: Tambah Item Baru
router.post('/', async (req, res) => {
    try {
        const raw = req.body;
        const existingItems = await googleSheetsService.getRows('04_ITEMS');
        
        // CEK VALIDASI: Pastikan item_code unik (tidak boleh sama)
        const isDuplicate = existingItems.some(item => item.item_code.trim().toUpperCase() === raw.item_code.trim().toUpperCase());
        if (isDuplicate) {
            return res.status(400).json({ success: false, message: `Item Code '${raw.item_code}' sudah terdaftar. Gunakan kode lain.` });
        }
        
        let maxNum = 0;
        existingItems.forEach(item => {
            if (item.item_id && item.item_id.startsWith('ITM-')) {
                const num = parseInt(item.item_id.replace('ITM-', ''), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        const nextId = `ITM-${String(maxNum + 1).padStart(6, '0')}`;
        
        const price = parseFloat(raw.price) || 0;
        const lifespan = parseInt(raw.lifespan_months) || 1;
        const cogs = Math.round(price / lifespan); 
        
        const cogsSettPct = parseFloat(String(raw.cogs_sett || '100').replace('%', '')) || 100; 
        const hargaJualPerBulan = Math.round(cogs / (cogsSettPct / 100));

        // Karena Frontend sudah mengirim JSON string (JSON.stringify), kita simpan as is,
        // Tapi jika dapetnya object, kita stringify.
        let bundleStr = '[]';
        if (raw.bundle_details) {
            bundleStr = typeof raw.bundle_details === 'string' ? raw.bundle_details : JSON.stringify(raw.bundle_details);
        }

        const newItem = {
            item_id: nextId,
            item_code: raw.item_code.trim().toUpperCase(),
            item_name: raw.item_name || '',
            category_1: raw.category_1 || '',
            category_2: raw.category_2 || '',
            service_type: raw.service_type || 'SECURITY',
            unit: raw.unit || 'PCS',
            price: price,
            lifespan_months: lifespan,
            cogs_per_month: cogs,
            cogs_sett: `${cogsSettPct}%`,
            harga_jual_per_month: hargaJualPerBulan,
            harga_jual_per_moth: hargaJualPerBulan, 
            minimum_stock: parseInt(raw.minimum_stock) || 0,
            reorder_point: parseInt(raw.reorder_point) || 0,
            active: raw.active || 'TRUE',
            created_at: new Date().toISOString(),
            bundle_details: bundleStr
        };

        await googleSheetsService.appendRow('04_ITEMS', newItem);
        res.json({ success: true, message: 'Item berhasil ditambahkan', data: newItem });
    } catch (error) {
        console.error("Error add item:", error);
        res.status(500).json({ success: false, message: 'Gagal menambah item', error: error.message });
    }
});

// 3. PUT: Edit Item 
router.put('/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const raw = req.body;
        
        const existingItems = await googleSheetsService.getRows('04_ITEMS');
        
        // CEK VALIDASI: Pastikan item_code tidak dipakai oleh ID lain
        const isDuplicate = existingItems.some(item => 
            item.item_code.trim().toUpperCase() === raw.item_code.trim().toUpperCase() && 
            item.item_id !== itemId
        );
        if (isDuplicate) {
            return res.status(400).json({ success: false, message: `Item Code '${raw.item_code}' sudah digunakan oleh item lain.` });
        }
        
        const price = parseFloat(raw.price) || 0;
        const lifespan = parseInt(raw.lifespan_months) || 1;
        const cogs = Math.round(price / lifespan);
        
        const cogsSettPct = parseFloat(String(raw.cogs_sett || '100').replace('%', '')) || 100;
        const hargaJualPerBulan = Math.round(cogs / (cogsSettPct / 100));

        let bundleStr = '[]';
        if (raw.bundle_details) {
            bundleStr = typeof raw.bundle_details === 'string' ? raw.bundle_details : JSON.stringify(raw.bundle_details);
        }

        const updatedItem = {
            item_code: raw.item_code.trim().toUpperCase(),
            item_name: raw.item_name,
            category_1: raw.category_1,
            category_2: raw.category_2,
            service_type: raw.service_type,
            unit: raw.unit,
            price: price,
            lifespan_months: lifespan,
            cogs_per_month: cogs,
            cogs_sett: `${cogsSettPct}%`,
            harga_jual_per_month: hargaJualPerBulan,
            harga_jual_per_moth: hargaJualPerBulan,
            minimum_stock: parseInt(raw.minimum_stock) || 0,
            reorder_point: parseInt(raw.reorder_point) || 0,
            active: raw.active,
            bundle_details: bundleStr
        };

        await googleSheetsService.updateRow('04_ITEMS', 'item_id', itemId, updatedItem);
        res.json({ success: true, message: 'Item berhasil diupdate' });
    } catch (error) {
        console.error("Error update item:", error);
        res.status(500).json({ success: false, message: 'Gagal update item', error: error.message });
    }
});

// =========================================================================
// 4. POST: Deactivate Semua "SPECIAL EXPERTISE" Manual
// =========================================================================
router.post('/deactivate-expertise', async (req, res) => {
    try {
        const rows = await googleSheetsService.getRows('04_ITEMS');
        let updatedCount = 0;
        
        for (let i = 0; i < rows.length; i++) {
            // Jika kategori 2 adalah SPECIAL EXPERTISE dan statusnya saat ini masih TRUE/ACTIVE
            if (rows[i].category_2 && rows[i].category_2.toUpperCase() === 'SPECIAL EXPERTISE' && (rows[i].active === 'TRUE' || rows[i].active === true || rows[i].active === 'ACTIVE')) {
                // Update ke database
                await googleSheetsService.updateRow('04_ITEMS', 'item_id', rows[i].item_id, { ...rows[i], active: 'FALSE' });
                updatedCount++;
            }
        }
        res.json({ success: true, message: `${updatedCount} item SPECIAL EXPERTISE berhasil dinonaktifkan.` });
    } catch (error) {
        console.error("Gagal Deactivate:", error);
        res.status(500).json({ success: false, message: 'Gagal melakukan mass-deactivate.' });
    }
});

// =========================================================================
// 5. CRON JOB: Auto Deactivate setiap hari Minggu jam 23:59
// =========================================================================
cron.schedule('59 23 * * 0', async () => {
    console.log('[CRON] Memulai Auto-Deactivate SPECIAL EXPERTISE mingguan...');
    try {
        const rows = await googleSheetsService.getRows('04_ITEMS');
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].category_2 && rows[i].category_2.toUpperCase() === 'SPECIAL EXPERTISE' && (rows[i].active === 'TRUE' || rows[i].active === true || rows[i].active === 'ACTIVE')) {
                await googleSheetsService.updateRow('04_ITEMS', 'item_id', rows[i].item_id, { ...rows[i], active: 'FALSE' });
            }
        }
        console.log('[CRON] Auto-Deactivate Selesai.');
    } catch (error) {
        console.error('[CRON ERROR] Gagal melakukan auto-deactivate:', error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Jakarta" // Zona waktu eksekusi Cron Job (WIB)
});

module.exports = router;