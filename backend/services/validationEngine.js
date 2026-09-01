// Aturan Bisnis untuk Menentukan Keputusan Request
function validateRequirement(reqData, project, entitlement, manpowerList, previousUsage = 0) {
    let decision = "NEED_APPROVAL";
    let rejection_code = "-";
    let expected_qty = 0;
    
    // 1. Validasi Status Project
    if (!project || project.status !== "ACTIVE") {
        return { decision: "REJECTED", rejection_code: "R05", expected_qty: 0, variance_qty: 0, variance_pct: 0, net_requirement: 0, remaining_entitlement: 0 };
    }
    
    // 2. Validasi Kontrak (Entitlement)
    if (!entitlement) {
        return { decision: "REJECTED", rejection_code: "R01", expected_qty: 0, variance_qty: 0, variance_pct: 0, net_requirement: 0, remaining_entitlement: 0 };
    }
    
    // 3. Validasi Tanggung Jawab (Client Responsibility = Reject)
    if (entitlement.responsibility === "CLIENT") {
        return { decision: "REJECTED", rejection_code: "R10", expected_qty: 0, variance_qty: 0, variance_pct: 0, net_requirement: 0, remaining_entitlement: 0 };
    }
    
    // 4. Hitung Expected Quantity (Berdasarkan Manpower aktif vs Jatah Kontrak)
    if (entitlement.calculation_basis === "MANPOWER") {
        // Hitung total manpower aktif untuk proyek tersebut
        const activeManpower = manpowerList.reduce((sum, mp) => sum + parseInt(mp.manpower_qty || 0), 0);
        expected_qty = activeManpower * parseFloat(entitlement.qty_per_person || 0);
    } else if (entitlement.calculation_basis === "FIXED_QTY") {
        expected_qty = parseFloat(entitlement.contract_qty || 0);
    }
    
    // 5. Hitung Variance (Penyimpangan antara permintaan vs seharusnya)
    const reqQty = parseFloat(reqData.requested_qty);
    const variance_qty = reqQty - expected_qty;
    const variance_pct = expected_qty > 0 ? (variance_qty / expected_qty) * 100 : 0;
    
    // 6. Hitung Sisa Jatah (Remaining Entitlement)
    const remainingEntitlement = expected_qty - previousUsage;
    
    // 7. Pengambilan Keputusan Akhir
    let net_requirement = reqQty;
    if (reqQty > remainingEntitlement) {
        decision = "NEED_APPROVAL";
        rejection_code = "R02"; // R02 = OVER_CONTRACT_QTY
    } else {
        // Jika aman, lanjutkan ke Procurement (Phase 4 nanti mengecek stock)
        decision = "PROCUREMENT_REQUIRED"; 
        rejection_code = "-";
    }
    
    return { 
        expected_qty, 
        variance_qty, 
        variance_pct: variance_pct.toFixed(2), 
        net_requirement, 
        decision, 
        rejection_code, 
        remaining_entitlement 
    };
}

module.exports = { validateRequirement };