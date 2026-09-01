const express = require('express');
const router = express.Router();
const googleSheetsService = require('../services/googleSheets');

router.get('/', async (req, res) => {
    try {
        const [prRows, allocRows] = await Promise.all([
            googleSheetsService.getRows('10_PURCHASE_REQUEST'),
            googleSheetsService.getRows('09_ALLOCATIONS').catch(() => []) 
        ]);

        const prMap = {};
        
        prRows.forEach(row => {
            const pr_id = row.pr_id;
            if (!pr_id) return; 
            
            let noteStr = row.notes || '';
            let specs = '', reason = '', globalRemark = '';
            
            if (noteStr.includes(' | ')) {
                let parts = noteStr.split(' | ');
                parts.forEach(p => {
                    if (p.startsWith('SPEC: ')) specs = p.replace('SPEC: ', '');
                    if (p.startsWith('REASON: ')) reason = p.replace('REASON: ', '');
                    if (p.startsWith('REMARK: ')) globalRemark = p.replace('REMARK: ', '');
                });
            } else {
                const matchOld = noteStr.match(/^\[ALASAN OVER:\s*(.*?)\]\s*(.*)$/i);
                if (matchOld) { reason = matchOld[1]; specs = matchOld[2]; } 
                else { specs = noteStr; }
            }
            
            if (!prMap[pr_id]) {
                prMap[pr_id] = {
                    pr_id: pr_id, request_date: row.pr_date || '',
                    project_id: row.project_id || '', status: 'OPEN FULL', 
                    remarks: globalRemark, requested_items: []
                };
            } else {
                if (globalRemark) prMap[pr_id].remarks = globalRemark;
            }
            
            if (row.item_id) {
                prMap[pr_id].requested_items.push({
                    item_id: row.item_id, name: row.item_id, 
                    req_qty: parseInt(row.required_qty) || 0,
                    line_status: 'OPEN FULL', line_notes: specs, minus_reason: reason     
                });
            }
        });

        const allocsByPr = {};
        allocRows.forEach(a => {
            if (!allocsByPr[a.pr_id]) allocsByPr[a.pr_id] = [];
            allocsByPr[a.pr_id].push(a);
        });

        Object.values(prMap).forEach(pr => {
            const prAllocs = allocsByPr[pr.pr_id] || [];
            
            // CEK APAKAH ADA PENOLAKAN DARI GUDANG
            const isRejected = prAllocs.some(a => a.status === 'REJECTED' || a.item_id === 'REJECTED');

            // SISTEM KANTONG DISTRIBUSI (FIFO POOL) & MENGHITUNG JUMLAH PENGIRIMAN
            const sentPool = {};
            const itemDeliveriesCount = {};

            prAllocs.forEach(a => {
                if (a.status === 'REJECTED' || a.item_id === 'REJECTED' || a.item_id === 'SIGNATURE') return;
                
                if (!sentPool[a.item_id]) sentPool[a.item_id] = 0;
                sentPool[a.item_id] += (parseInt(a.allocated_qty) || 0);

                if (!itemDeliveriesCount[a.item_id]) itemDeliveriesCount[a.item_id] = new Set();
                itemDeliveriesCount[a.item_id].add(a.allocation_id);
            });

            let totalReqQty = 0;
            let totalSentQty = 0;

            pr.requested_items.forEach(item => {
                totalReqQty += item.req_qty;
                let availableSent = sentPool[item.item_id] || 0;
                let appliedToThisLine = 0;

                // Mengurangi jatah dari kantong untuk baris ini
                if (availableSent >= item.req_qty) {
                    appliedToThisLine = item.req_qty;
                    sentPool[item.item_id] -= item.req_qty;
                } else {
                    appliedToThisLine = availableSent;
                    sentPool[item.item_id] = 0; 
                }

                totalSentQty += appliedToThisLine;
                let itemDeliveries = itemDeliveriesCount[item.item_id] ? itemDeliveriesCount[item.item_id].size : 0;

                // 1. STATUS PER BARIS BARANG (LINE STATUS)
                if (isRejected) {
                    item.line_status = appliedToThisLine > 0 ? 'REJECT PARTIAL' : 'REJECT FULL';
                } else {
                    if (appliedToThisLine === 0) {
                        item.line_status = 'OPEN FULL';
                    } else if (appliedToThisLine < item.req_qty) {
                        item.line_status = 'OPEN PARTIAL';
                    } else {
                        item.line_status = itemDeliveries > 1 ? 'CLOSE PARTIAL' : 'CLOSE FULL';
                    }
                }
            });

            // 2. STATUS PR GLOBAL (PR STATUS)
            let uniqueDeliveries = new Set(prAllocs.filter(a => a.item_id !== 'REJECTED' && a.item_id !== 'SIGNATURE').map(a => a.allocation_id)).size;

            if (isRejected) {
                pr.status = totalSentQty > 0 ? 'REJECT PARTIAL' : 'REJECT FULL';
            } else {
                if (totalSentQty === 0) {
                    pr.status = 'OPEN FULL';
                } else if (totalSentQty < totalReqQty) {
                    pr.status = 'OPEN PARTIAL';
                } else {
                    pr.status = uniqueDeliveries > 1 ? 'CLOSE PARTIAL' : 'CLOSE FULL';
                }
            }
        });

        res.json({ success: true, data: Object.values(prMap) });

    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil data PR' }); }
});

router.post('/', async (req, res) => {
    try {
        const raw = req.body;
        let itemsArr = typeof raw.requested_items === 'string' ? JSON.parse(raw.requested_items) : (raw.requested_items || []);

        if (itemsArr.length === 0) return res.status(400).json({ success: false, message: 'Harus ada minimal 1 barang.' });

        const rows = await googleSheetsService.getRows('10_PURCHASE_REQUEST');
        let maxNum = 0;
        rows.forEach(r => {
            if(r.pr_id && r.pr_id.startsWith('PRQ-')) {
                 const num = parseInt(r.pr_id.replace('PRQ-', ''), 10);
                 if(!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        const nextId = `PRQ-${String(maxNum + 1).padStart(6, '0')}`;

        for (const item of itemsArr) {
            let noteParts = [];
            if (item.line_notes) noteParts.push(`SPEC: ${item.line_notes}`);
            if (item.line_status === 'OVER' && item.minus_reason) noteParts.push(`REASON: ${item.minus_reason}`);
            if (raw.remarks) noteParts.push(`REMARK: ${raw.remarks}`);
            
            const finalNotes = noteParts.join(' | ');
            const newRow = {
                pr_id: nextId, pr_date: raw.request_date || '', source_request_id: '', project_id: raw.project_id || '',
                item_id: item.item_id || '', required_qty: item.req_qty || 0, available_stock: 0, incoming_stock: 0,
                net_procurement_qty: item.req_qty || 0, estimated_unit_cost: 0, estimated_value: 0, needed_date: '',
                priority: 'HIGH', status: item.line_status || 'OPEN FULL', requested_by: 'SYSTEM', approved_by: '',
                approval_date: '', notes: finalNotes 
            };
            await googleSheetsService.appendRow('10_PURCHASE_REQUEST', newRow);
        }

        res.json({ success: true, message: 'PR dibuat', data: { pr_id: nextId } });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal membuat PR' }); }
});

router.put('/:id', async (req, res) => { res.status(403).json({ success: false, message: 'Akses Ditolak.' }); });

module.exports = router;