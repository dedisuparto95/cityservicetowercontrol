const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');
const nodemailer = require('nodemailer'); // IMPORT NODEMAILER

// KONFIGURASI MESIN PENGIRIM EMAIL (SMTP GMAIL)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

router.get('/', async (req, res) => {
    try {
        const rows = await googleSheetsService.getRows('09_ALLOCATIONS');
        const allocMap = {};
        
        rows.forEach(row => {
            const alloc_id = row.allocation_id;
            if (!alloc_id) return;
            
            let rawRemarks = row.remarks || '';
            let email = '', name = '', notes = rawRemarks;
            if (rawRemarks.includes('EMAIL:')) {
                const parts = rawRemarks.split(' | ');
                parts.forEach(p => {
                    if (p.startsWith('NAME: ')) name = p.replace('NAME: ', '');
                    if (p.startsWith('EMAIL: ')) email = p.replace('EMAIL: ', '');
                    if (p.startsWith('NOTES: ')) notes = p.replace('NOTES: ', '');
                });
            }
            
            if (!allocMap[alloc_id]) {
                allocMap[alloc_id] = {
                    allocation_id: alloc_id, allocation_date: row.allocation_date || '',
                    pr_id: row.pr_id || '', project_id: row.project_id || '',
                    status: row.status || 'DELIVERED',
                    recipient_name: name, recipient_email: email, remarks: notes,
                    allocated_items: [], receipt_data: null
                };
            }

            if (row.item_id === 'SIGNATURE') {
                allocMap[alloc_id].status = 'RECEIVED';
                try { allocMap[alloc_id].receipt_data = JSON.parse(row.remarks); } catch(e){}
            } 
            else if (row.item_id !== 'REJECTED') {
                const existingItem = allocMap[alloc_id].allocated_items.find(i => i.item_id === row.item_id);
                if (existingItem) existingItem.allocated_qty += (parseInt(row.allocated_qty) || 0);
                else allocMap[alloc_id].allocated_items.push({ item_id: row.item_id, allocated_qty: parseInt(row.allocated_qty) || 0 });
            }
        });

        res.json({ success: true, data: Object.values(allocMap).reverse() });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil data' }); }
});

router.get('/:id', async (req, res) => {
    try {
        const rows = await googleSheetsService.getRows('09_ALLOCATIONS');
        const allocItems = [];
        let baseData = null;

        rows.forEach(row => {
            if (row.allocation_id === req.params.id) {
                if (!baseData) baseData = row;
                if (row.item_id === 'SIGNATURE') baseData.status = 'RECEIVED';
                if (row.item_id !== 'REJECTED' && row.item_id !== 'SIGNATURE') {
                    allocItems.push({ item_id: row.item_id, allocated_qty: parseInt(row.allocated_qty) || 0 });
                }
            }
        });

        if (!baseData) return res.status(404).json({ success: false, message: 'Alokasi tidak ditemukan' });

        let name = '';
        if (baseData.remarks && baseData.remarks.includes('NAME:')) {
            baseData.remarks.split(' | ').forEach(p => { if (p.startsWith('NAME: ')) name = p.replace('NAME: ', ''); });
        }

        res.json({ success: true, data: {
            allocation_id: baseData.allocation_id, allocation_date: baseData.allocation_date,
            pr_id: baseData.pr_id, project_id: baseData.project_id,
            status: baseData.status || 'DELIVERED',
            recipient_name: name, items: allocItems
        }});
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal load data receipt' }); }
});

router.post('/', async (req, res) => {
    try {
        const raw = req.body; 
        const action = raw.action || 'ALLOCATE'; 
        
        const allocRows = await googleSheetsService.getRows('09_ALLOCATIONS');
        let maxNum = 0;
        allocRows.forEach(r => {
            if (r.allocation_id && r.allocation_id.startsWith('ALC-')) {
                const num = parseInt(r.allocation_id.replace('ALC-', ''), 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        const nextId = `ALC-${String(maxNum + 1).padStart(6, '0')}`;

        if (action === 'REJECT') {
            await googleSheetsService.appendRow('09_ALLOCATIONS', {
                allocation_id: nextId, allocation_date: new Date().toISOString().split('T')[0],
                pr_id: raw.pr_id, project_id: raw.project_id || '',
                item_id: 'REJECTED', allocated_qty: 0,
                status: 'REJECTED', remarks: raw.remarks || 'DITOLAK OLEH GUDANG'
            });
        } else {
            const itemsToAllocate = typeof raw.items === 'string' ? JSON.parse(raw.items) : raw.items;
            const combinedRemarks = `NAME: ${raw.recipient_name || '-'} | EMAIL: ${raw.recipient_email || '-'} | NOTES: ${raw.remarks || ''}`;

            for (const item of itemsToAllocate) {
                if (item.alloc_qty > 0) {
                    await googleSheetsService.appendRow('09_ALLOCATIONS', {
                        allocation_id: nextId, allocation_date: raw.allocation_date || new Date().toISOString().split('T')[0],
                        pr_id: raw.pr_id, project_id: raw.project_id || '',
                        item_id: item.item_id, allocated_qty: item.alloc_qty,
                        status: 'DELIVERED', remarks: combinedRemarks
                    });
                }
            }

            // ==========================================================
            // KIRIM EMAIL SUNGGUHAN KE KLIEN
            // ==========================================================
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS && raw.recipient_email) {
                // Link E-Receipt
                const receiptLink = `http://localhost:5173/receipt/${nextId}`;
                
                // Desain Email HTML Profesional
                const mailOptions = {
                    from: `"City Service Logistik" <${process.env.EMAIL_USER}>`,
                    to: raw.recipient_email,
                    subject: `[ACTION REQUIRED] Tanda Terima Pengiriman Barang - ${nextId}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px; color: #18181b;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                <div style="background-color: #3b82f6; padding: 20px; text-align: center;">
                                    <h2 style="color: #ffffff; margin: 0;">CITY SERVICE</h2>
                                    <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 14px;">Surat Jalan Digital (E-Delivery)</p>
                                </div>
                                <div style="padding: 30px;">
                                    <p>Yth. Bapak/Ibu <strong>${raw.recipient_name}</strong>,</p>
                                    <p>Kami informasikan bahwa barang untuk Project <strong>${raw.project_id}</strong> (Ref PR: ${raw.pr_id}) sedang dalam proses pengiriman.</p>
                                    <p>Mohon untuk melakukan pemeriksaan barang saat tiba di lokasi. Jika barang sudah sesuai, silakan konfirmasi penerimaan dan berikan <b>tanda tangan digital</b> Anda melalui tautan aman di bawah ini:</p>
                                    
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${receiptLink}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Buka Lembar Tanda Terima</a>
                                    </div>
                                    
                                    <p style="font-size: 13px; color: #52525b; border-top: 1px solid #e4e4e7; padding-top: 15px; margin-top: 30px;">
                                        Pesan ini dibuat secara otomatis oleh sistem Control Tower. Mohon tidak membalas email ini.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                };

                // Kirim di background (tidak menahan proses response ke frontend)
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.error("Gagal kirim email:", error);
                    else console.log("Email Sukses Terkirim ke:", raw.recipient_email);
                });
            }
            // ==========================================================
        }

        res.json({ success: true, message: 'Alokasi berhasil!', data: { alloc_id: nextId } });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal memproses alokasi', error: error.message }); }
});

router.post('/:id/receive', async (req, res) => {
    try {
        const { signature, photo } = req.body;
        const receiptData = JSON.stringify({ date: new Date().toISOString(), signature: signature, photo: photo });

        await googleSheetsService.appendRow('09_ALLOCATIONS', {
            allocation_id: req.params.id, allocation_date: new Date().toISOString().split('T')[0],
            pr_id: '-', project_id: '-', item_id: 'SIGNATURE', allocated_qty: 0,
            status: 'RECEIVED', remarks: receiptData
        });

        res.json({ success: true, message: 'Tanda Terima disimpan!' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan tanda terima' }); }
});

module.exports = router;