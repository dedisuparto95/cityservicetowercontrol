import React, { useEffect, useState, Fragment } from 'react';
import axios from 'axios';
import { Search, Plus, Trash2, ArrowRight, ArrowLeft, DollarSign, TrendingUp, Receipt, PieChart, Edit, Copy, FileDown, XCircle, Clock, ClipboardList, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Projects() {
    const [projects, setProjects] = useState([]);
    const [masterItems, setMasterItems] = useState([]);
    const [shiftOptions, setShiftOptions] = useState([]); 
    const [gradeOptions, setGradeOptions] = useState([]); 
    const [bankOptions, setBankOptions] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('ALL'); 
    
    // Modal & Wizard State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    
    // Download Modal State
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [selectedProjDownload, setSelectedProjDownload] = useState(null);

    // Commitment Fee State
    const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
    const [selectedProjForFee, setSelectedProjForFee] = useState(null);
    const [feeList, setFeeList] = useState([]);

    const initialFormState = {
        project_id: '', project_name: '', company_name: '', 
        location: '', work_location: '', 
        pic_name: '', pic_email: '', pic_phone: '', 
        work_pattern: '', shifts: [], 
        contract_period: '', contract_start: '', contract_end: '', 
        term_of_payment: '', additional_notes: '', 
        remunerations: [], 
        operational_items: { common_units: [], common_equipments: [], special_units: [], others: [] },
        membership_plan: '', management_fee: '', status: 'DRAFT', quotation_history: [],
        commitment_fees: []
    };

    const [formData, setFormData] = useState(initialFormState);

    const remFields = [
        { key: 'gaji_pokok', label: 'GAJI POKOK' },
        { key: 'bpjs_tk', label: 'BPJS TK' },
        { key: 'bpjs_kes', label: 'BPJS KES' },
        { key: 'thr', label: 'THR' },
        { key: 'pp35', label: 'TUNJ. PP35' },
        { key: 'tunjangan_jabatan', label: 'TUNJ. JABATAN' },
        { key: 'tunjangan_lainnya', label: 'TUNJ. LAINNYA' },
        { key: 'tunjangan_knowledge', label: 'TUNJ. KNOWLEDGE' }
    ];

    const calculateExpiring = (endDateStr) => {
        if (!endDateStr) return { isExpiring: false, isExpired: false, text: '', days: 999 };
        const end = new Date(endDateStr);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { isExpiring: false, isExpired: true, text: 'EXPIRED', days: diffDays };
        if (diffDays <= 90) { 
            const m = Math.floor(diffDays / 30);
            const d = diffDays % 30;
            return { 
                isExpiring: true, 
                isExpired: false, 
                text: `${String(m).padStart(2, '0')} BULAN ${String(d).padStart(2, '0')} HARI`,
                days: diffDays
            };
        }
        return { isExpiring: false, isExpired: false, text: '', days: diffDays };
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [projRes, itemRes, lookupsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/projects').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/items').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/lookups').catch(() => ({ data: { data: {} } }))
            ]);
            
            let rawProjects = Array.isArray(projRes?.data?.data) ? projRes.data.data.reverse() : [];
            
            const processedProjects = await Promise.all(rawProjects.map(async (p) => {
                if (p.status === 'ACTIVE' && p.contract_end) {
                    const exp = calculateExpiring(p.contract_end);
                    if (exp.isExpired) {
                        try {
                            const updatedPayload = { ...p, status: 'NONACTIVE' };
                            await axios.put(`http://localhost:5000/api/projects/${p.project_id}`, updatedPayload);
                            return updatedPayload;
                        } catch(e) { return p; }
                    }
                }
                return p;
            }));

            setProjects(processedProjects);
            setMasterItems(Array.isArray(itemRes?.data?.data) ? itemRes.data.data.filter(i => i.active === 'TRUE' || i.active === true || i.active === 'ACTIVE') : []);
            setShiftOptions(lookupsRes?.data?.data?.shifts || []);
            setGradeOptions(lookupsRes?.data?.data?.grades || []); 
            setBankOptions(lookupsRes?.data?.data?.bankAccounts || []); 
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsModalOpen(false);
                setIsDownloadModalOpen(false);
                setIsFeeModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, isDownloadModalOpen, isFeeModalOpen]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        const upperValue = type === 'text' ? value.toUpperCase() : value;
        setFormData({ ...formData, [name]: upperValue });
    };

    let previewEndDate = formData.contract_end;
    if (formData.contract_start && formData.contract_period) {
        try {
            const startDate = new Date(formData.contract_start);
            const months = parseInt(formData.contract_period, 10);
            if (!isNaN(months)) {
                startDate.setMonth(startDate.getMonth() + months);
                previewEndDate = startDate.toISOString().split('T')[0];
            }
        } catch(e) {}
    }

    const formatIndoDate = (isoStr) => {
        if (!isoStr) return '-';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const calculatePLData = (data) => {
        let remRev = 0, remProfit = 0;
        (data.remunerations || []).forEach(rem => {
            const q = parseInt(rem.qty) || 0;
            let rowRev = 0, rowProfit = 0;
            remFields.forEach(f => {
                const val = parseFloat(rem[f.key]) || 0;
                const pct = parseFloat(rem[`${f.key}_pct`]) || 0;
                rowRev += val;
                rowProfit += Math.round(val * (pct / 100));
            });
            remRev += (rowRev * q);
            remProfit += (rowProfit * q);
        });
        const remCogs = remRev - remProfit;

        let opsRev = 0, opsCogs = 0;
        const ops = data.operational_items || {};
        ['common_units', 'common_equipments', 'special_units'].forEach(cat => {
            (ops[cat] || []).forEach(op => {
                const q = parseInt(op.qty) || 0;
                opsRev += parseFloat(op.final_sell_total) || 0;
                opsCogs += (parseFloat(op.cogs_mo) || 0) * q;
            });
        });
        (ops.others || []).forEach(op => {
            const q = parseInt(op.qty) || 0;
            const hb = parseFloat(op.harga_beli) || 0;
            const sett = parseFloat(op.cogs_sett) || 100;
            opsRev += Math.round((hb / (sett / 100)) * q);
            opsCogs += hb * q;
        });
        const opsProfit = opsRev - opsCogs;

        const totalManpower = (data.remunerations || []).reduce((sum, rem) => sum + (parseInt(rem.qty) || 0), 0);
        const mgtFee = parseFloat(data.management_fee) || 0;
        const memRev = mgtFee * totalManpower;
        const memCogs = 0; 
        const memProfit = memRev;

        const grandRev = remRev + opsRev + memRev;
        const grandCogs = remCogs + opsCogs + memCogs;
        const grandProfit = remProfit + opsProfit + memProfit;
        const grandMargin = grandRev > 0 ? ((grandProfit / grandRev) * 100).toFixed(2) : 0;

        const ppnFee = memRev * 0.11;
        const pph23Fee = memRev * 0.02;

        return { remRev, remCogs, remProfit, opsRev, opsCogs, opsProfit, memRev, memCogs, memProfit, grandRev, grandCogs, grandProfit, grandMargin, totalManpower, ppnFee, pph23Fee };
    };
    
    const pl = calculatePLData(formData);

    const formatTime = (t) => {
        if (!t) return '';
        try {
            const strT = String(t);
            const match = strT.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (match) {
                let hrs = parseInt(match[1], 10);
                let mins = match[2];
                let modifier = match[3];
                if (modifier) {
                    modifier = modifier.toUpperCase();
                    if (modifier === 'PM' && hrs < 12) hrs += 12;
                    if (modifier === 'AM' && hrs === 12) hrs = 0;
                }
                return `${String(hrs).padStart(2, '0')}:${mins}`;
            }
            return strT;
        } catch (e) {
            return String(t);
        }
    };

    const formatVersionLabel = (isoDate) => {
        if (!isoDate) return 'VERSI UNKNOWN';
        try {
            const d = new Date(isoDate);
            if (isNaN(d.getTime())) return 'VERSI DRAFT';
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `VERSI ${dd}-${mm}-${yy} ${hh}.${min}`;
        } catch (e) {
            return 'VERSI DRAFT';
        }
    };

    const handleStatusChange = async (proj, newStatus) => {
        try {
            let historyArray = [];
            if (proj.quotation_history) {
                if (typeof proj.quotation_history === 'string') {
                    try { 
                        const parsed = JSON.parse(proj.quotation_history);
                        if (Array.isArray(parsed)) historyArray = parsed;
                    } catch(e) {}
                } else if (Array.isArray(proj.quotation_history)) {
                    historyArray = [...proj.quotation_history];
                }
            }

            if (newStatus === 'ACTIVE') {
                const { quotation_history, ...cleanSnapshotData } = proj; 
                historyArray.push({
                    version: historyArray.length + 1,
                    date: new Date().toISOString(),
                    data: cleanSnapshotData
                });
            }

            const payload = { 
                ...proj, 
                status: newStatus,
                quotation_history: JSON.stringify(historyArray) 
            };

            await axios.put(`http://localhost:5000/api/projects/${proj.project_id}`, payload);
            fetchAllData();
        } catch (err) {
            alert(`Gagal merubah status!\n\nAlasan: ${err.message}`);
        }
    };

    // ==========================================
    // MENU ACTIONS DENGAN ANTI-CRASH
    // ==========================================
    const openEditModal = (proj, isDuplicate = false, e) => {
        if(e) e.stopPropagation();
        try {
            let parsedOps = { common_units: [], common_equipments: [], special_units: [], others: [] };
            if (typeof proj.operational_items === 'string') {
                try { parsedOps = JSON.parse(proj.operational_items) } catch(e) {}
            } else if (proj.operational_items && typeof proj.operational_items === 'object' && !Array.isArray(proj.operational_items)) {
                parsedOps = { ...parsedOps, ...proj.operational_items };
            }
            
            let parsedRem = [];
            if (typeof proj.remunerations === 'string') {
                try { parsedRem = JSON.parse(proj.remunerations) } catch(e) {}
            } else {
                parsedRem = proj.remunerations || [];
            }

            let parsedShifts = [];
            if (typeof proj.shifts === 'string') {
                try { parsedShifts = JSON.parse(proj.shifts) } catch(e) {}
            } else if (Array.isArray(proj.shifts)) {
                parsedShifts = proj.shifts;
            } else if (!proj.shifts && proj.start_time && proj.end_time) {
                parsedShifts = [{ shift_name: 'DEFAULT', start_time: formatTime(proj.start_time), end_time: formatTime(proj.end_time) }];
            }

            let historyArray = [];
            if (!isDuplicate && proj.quotation_history) {
                if (typeof proj.quotation_history === 'string') {
                    try { 
                        const parsed = JSON.parse(proj.quotation_history);
                        if (Array.isArray(parsed)) historyArray = parsed;
                    } catch(e) {}
                } else if (Array.isArray(proj.quotation_history)) {
                    historyArray = [...proj.quotation_history];
                }
            }

            // KUNCI PERBAIKAN: JIKA DUPLIKASI, KOSONGKAN FEE ARRAY
            let feeArray = [];
            if (!isDuplicate && proj.commitment_fees) {
                 if (typeof proj.commitment_fees === 'string') {
                     try { feeArray = JSON.parse(proj.commitment_fees); } catch(e) {}
                 } else if (Array.isArray(proj.commitment_fees)) {
                     feeArray = proj.commitment_fees;
                 }
            }

            setFormData({ 
                ...proj, 
                project_id: isDuplicate ? '' : proj.project_id,
                project_name: isDuplicate ? `${proj.project_name || 'PROJECT'} (COPY)` : proj.project_name,
                status: isDuplicate ? 'DRAFT' : proj.status,
                remunerations: parsedRem,
                operational_items: parsedOps,
                shifts: parsedShifts,
                quotation_history: historyArray,
                commitment_fees: feeArray // <- Hanya dimasukkan jika bukan duplikasi
            });
            
            setIsEditing(!isDuplicate);
            setCurrentStep(1); 
            setIsModalOpen(true);
        } catch (err) {
            console.error("Error Open Modal:", err);
            alert(`Sistem gagal membaca sebagian data project ini.\n\nError: ${err.message}`);
        }
    };

    const handleDuplicate = (proj, e) => {
        if(e) e.stopPropagation();
        try {
            openEditModal(proj, true);
        } catch(err) {
            alert(`Gagal membuka menu duplikasi:\n${err.message}`);
        }
    };

    const handleOpenDownloadModal = (proj, e) => {
        if(e) e.stopPropagation();
        try {
            let historyArray = [];
            if (proj.quotation_history) {
                if (typeof proj.quotation_history === 'string') {
                    try { 
                        const parsed = JSON.parse(proj.quotation_history);
                        if (Array.isArray(parsed)) historyArray = parsed;
                    } catch(e) {}
                } else if (Array.isArray(proj.quotation_history)) {
                    historyArray = [...proj.quotation_history];
                }
            }
            setSelectedProjDownload({ ...proj, parsedHistory: historyArray });
            setIsDownloadModalOpen(true);
        } catch(err) {
            alert(`Gagal membuka menu download:\n${err.message}`);
        }
    };

    const openFeeModal = (proj, e) => {
        if(e) e.stopPropagation();
        try {
            setSelectedProjForFee(proj);
            let parsedFees = [];
            if (typeof proj.commitment_fees === 'string') {
                try { parsedFees = JSON.parse(proj.commitment_fees); } catch(e) {}
            } else if (Array.isArray(proj.commitment_fees)) {
                parsedFees = proj.commitment_fees;
            }
            setFeeList(parsedFees);
            setIsFeeModalOpen(true);
        } catch(err) {
            alert(`Gagal membuka menu Fee:\n${err.message}`);
        }
    };

    // ==========================================
    // COMMITMENT FEE LOGIC
    // ==========================================
    const addFeeRow = () => {
        setFeeList([
            ...feeList, 
            { id: Date.now(), description: '', amount: '', date: new Date().toISOString().split('T')[0], bank_account: '', status: 'DRAFT' }
        ]);
    };

    const updateFeeRow = (index, field, value) => {
        const updated = [...feeList];
        updated[index][field] = (field === 'description') ? value.toUpperCase() : value;
        setFeeList(updated);
    };

    const removeFeeRow = (index) => {
        const updated = [...feeList];
        updated.splice(index, 1);
        setFeeList(updated);
    };

    const saveFeeDrafts = async () => {
        setSubmitting(true);
        try {
            const payload = { ...selectedProjForFee, commitment_fees: JSON.stringify(feeList) };
            await axios.put(`http://localhost:5000/api/projects/${selectedProjForFee.project_id}`, payload);
            await fetchAllData();
            setIsFeeModalOpen(false);
        } catch (error) {
            alert(`Gagal menyimpan Fee: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const publishAndDownloadFee = async (index) => {
        const fee = feeList[index];
        if (!fee.description || !fee.amount || !fee.bank_account || !fee.date) {
            alert("Lengkapi semua isian (Deskripsi, Jumlah, Bank, dan Tanggal) sebelum menerbitkan.");
            return;
        }

        const updatedFees = [...feeList];
        updatedFees[index].status = 'PUBLISHED';
        setFeeList(updatedFees);

        setSubmitting(true);
        try {
            const payload = { ...selectedProjForFee, commitment_fees: JSON.stringify(updatedFees) };
            await axios.put(`http://localhost:5000/api/projects/${selectedProjForFee.project_id}`, payload);
            await fetchAllData();
            
            const doc = new jsPDF('p', 'pt', 'a4');
            const marginX = 40; 
            let currentY = 40;  
            
            const img = new Image();
            img.src = '/logo.png'; 
            await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

            if (img.width !== 0) {
                const imgWidth = 140; 
                const imgHeight = (img.height * imgWidth) / img.width;
                doc.addImage(img, 'PNG', marginX, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 30;
            } else {
                doc.setFontSize(22); doc.setTextColor(41, 91, 167); doc.setFont("helvetica", "bold");
                doc.text("CITY SERVICE", marginX, currentY + 15);
                currentY += 45;
            }

            doc.setFontSize(18); doc.setTextColor(41, 91, 167); doc.setFont("helvetica", "bold");
            doc.text("INVOICE - COMMITMENT FEE", marginX, currentY);
            currentY += 30;

            doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "normal");
            doc.text(`TAGIHAN KEPADA:`, marginX, currentY);
            currentY += 15;
            doc.setFont("helvetica", "bold");
            doc.text(`${(selectedProjForFee.company_name || '-').toUpperCase()}`, marginX, currentY);
            currentY += 15;
            doc.text(`PROYEK: ${(selectedProjForFee.project_name || '-').toUpperCase()}`, marginX, currentY);
            currentY += 25;

            const amount = parseFloat(fee.amount) || 0;
            const ppn = amount * 0.11;
            const total = amount + ppn;

            autoTable(doc, {
                startY: currentY,
                margin: { left: marginX, right: marginX },
                head: [['DESKRIPSI TAGIHAN', 'JUMLAH (Rp)', 'PPN 11% (Rp)', 'TOTAL (Rp)']],
                body: [[
                    (fee.description || '-').toUpperCase(),
                    amount.toLocaleString('id-ID'),
                    ppn.toLocaleString('id-ID'),
                    total.toLocaleString('id-ID')
                ]],
                theme: 'grid',
                headStyles: { fillColor: [41, 91, 167], fontSize: 9, halign: 'center', valign: 'middle' },
                styles: { fontSize: 9, halign: 'center', cellPadding: 8, textColor: [60,60,60] },
                columnStyles: { 0: { halign: 'left', cellWidth: 200 } }
            });

            currentY = doc.lastAutoTable.finalY + 40;

            doc.setFontSize(9); doc.setTextColor(40, 40, 40);
            doc.setFont("helvetica", "bold");
            doc.text("INFORMASI PEMBAYARAN:", marginX, currentY);
            currentY += 15;
            doc.setFont("helvetica", "normal");
            doc.text(`MOHON DITRANSFER KE: ${(fee.bank_account || '-').toUpperCase()}`, marginX, currentY);

            currentY += 70;
            const rightValueX = 595.28 - marginX;
            doc.text(`JAKARTA, ${formatIndoDate(fee.date).toUpperCase()}`, rightValueX, currentY, { align: 'right' });
            currentY += 70;
            doc.setFont("helvetica", "bold");
            doc.text("JACKSON", rightValueX, currentY, { align: 'right' });

            doc.save(`INVOICE-FEE-${selectedProjForFee.project_id}.pdf`);

        } catch (error) {
            alert(`Gagal menerbitkan Invoice: ${error.stack || error.message}`);
        } finally {
            setSubmitting(false);
        }
    };


    const handleDownloadPDF = async (projData, versionLabel) => {
        try {
            let parsedOps = { common_units: [], common_equipments: [], special_units: [], others: [] };
            if (typeof projData.operational_items === 'string') {
                try { parsedOps = JSON.parse(projData.operational_items); } catch(e){}
            } else if (projData.operational_items && typeof projData.operational_items === 'object' && !Array.isArray(projData.operational_items)) {
                parsedOps = { ...parsedOps, ...projData.operational_items };
            }

            let parsedRem = [];
            if (typeof projData.remunerations === 'string') {
                try { parsedRem = JSON.parse(projData.remunerations); } catch(e){}
            } else {
                parsedRem = projData.remunerations || [];
            }

            let parsedShifts = [];
            if (typeof projData.shifts === 'string') {
                try { parsedShifts = JSON.parse(projData.shifts); } catch(e){}
            } else {
                parsedShifts = projData.shifts || [];
            }

            const projForCalc = { ...projData, operational_items: parsedOps, remunerations: parsedRem };
            const projPL = calculatePLData(projForCalc);

            const doc = new jsPDF('p', 'pt', 'a4');
            const marginX = 20; 
            let currentY = 25;  

            doc.setFont("helvetica");

            if (versionLabel) {
                doc.setFontSize(6);
                doc.setTextColor(120, 120, 120); 
                doc.setFont("helvetica", "italic");
                const rightAlignX = 595.28 - marginX; 
                doc.text(String(versionLabel).toUpperCase(), rightAlignX, currentY + 5, { align: 'right' }); 
            }

            const img = new Image();
            img.src = '/logo.png'; 
            
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; 
            });

            if (img.width !== 0) {
                const imgWidth = 140; 
                const imgHeight = (img.height * imgWidth) / img.width;
                doc.addImage(img, 'PNG', marginX, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 20;
            } else {
                doc.setFontSize(22);
                doc.setTextColor(41, 91, 167);
                doc.setFont("helvetica", "bold");
                doc.text("CITY SERVICE", marginX, currentY + 15);
                currentY += 35;
            }
            
            doc.setFontSize(14);
            doc.setTextColor(41, 91, 167);
            doc.setFont("helvetica", "bold");
            doc.text("PENAWARAN KERJASAMA (QUOTATION)", marginX, currentY);
            currentY += 20;
            
            const shiftStr = parsedShifts.map(s => `${s.shift_name} (${s.start_time}-${s.end_time})`).join(', ') || '-';
            const picInfo = `${projData.pic_name || '-'} | ${projData.pic_email || '-'} | ${projData.pic_phone || '-'}`;

            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            doc.setFont("helvetica", "bold");
            doc.text("1. INFORMASI UMUM", marginX, currentY);
            currentY += 10;

            autoTable(doc, {
                startY: currentY,
                margin: { left: marginX, right: marginX, bottom: 20 },
                body: [
                    ['ID PROYEK', String(projData.project_id || 'DRAFT').toUpperCase()],
                    ['NAMA PROYEK', String(projData.project_name || '-').toUpperCase()],
                    ['NAMA PERUSAHAAN', String(projData.company_name || '-').toUpperCase()],
                    ['ALAMAT PERUSAHAAN', String(projData.location || '-').toUpperCase()],
                    ['ALAMAT PEKERJAAN', String(projData.work_location || '-').toUpperCase()],
                    ['INFO PIC', String(picInfo).toUpperCase()],
                    ['PERIODE KONTRAK', String(`${projData.contract_period} BULAN (${projData.contract_start || '-'} S/D ${projData.contract_end || '-'})`).toUpperCase()],
                    ['POLA KERJA & SHIFT', String(`${projData.work_pattern || '-'} | ${shiftStr}`).toUpperCase()],
                    ['TERM OF PAYMENT', String(`${projData.term_of_payment || '0'} HARI`).toUpperCase()]
                ],
                theme: 'plain',
                styles: { font: 'helvetica', cellPadding: 3, fontSize: 6, textColor: [60,60,60] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: [41, 91, 167] } }
            });
            currentY = doc.lastAutoTable.finalY + 20;

            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            doc.setFont("helvetica", "bold");
            doc.text("2. BIAYA TENAGA KERJA", marginX, currentY);
            
            const remBody = parsedRem.map(r => {
                const gp = parseFloat(r.gaji_pokok) || 0;
                const btk = parseFloat(r.bpjs_tk) || 0;
                const bkes = parseFloat(r.bpjs_kes) || 0;
                const thr = parseFloat(r.thr) || 0;
                const pp35 = parseFloat(r.pp35) || 0;
                const tjab = parseFloat(r.tunjangan_jabatan) || 0;
                const tlain = parseFloat(r.tunjangan_lainnya) || 0;
                const tknow = parseFloat(r.tunjangan_knowledge) || 0;
                
                const totalPerPerson = gp + btk + bkes + thr + pp35 + tjab + tlain + tknow;
                const qty = parseInt(r.qty) || 0;
                const subtotal = totalPerPerson * qty;

                return [
                    String(r.jabatan || '-').toUpperCase(), 
                    String(r.grade || '-').toUpperCase(),
                    String(qty), 
                    gp.toLocaleString('id-ID'), 
                    btk.toLocaleString('id-ID'), 
                    bkes.toLocaleString('id-ID'),
                    thr.toLocaleString('id-ID'), 
                    pp35.toLocaleString('id-ID'), 
                    tjab.toLocaleString('id-ID'),
                    tlain.toLocaleString('id-ID'), 
                    tknow.toLocaleString('id-ID'), 
                    totalPerPerson.toLocaleString('id-ID'), 
                    subtotal.toLocaleString('id-ID')
                ];
            });

            autoTable(doc, {
                startY: currentY + 10,
                margin: { left: marginX, right: marginX, bottom: 20 },
                head: [['POSISI', 'GRADE', 'QTY', 'GAJI POKOK', 'BPJS TK', 'BPJS KES', 'THR', 'TUNJ. PP35', 'TUNJ. JABATAN', 'TUNJ. LAIN', 'TUNJ. KNOW', 'TOT/ORG', 'SUBTOTAL']],
                body: remBody,
                theme: 'grid',
                headStyles: { font: 'helvetica', fillColor: [41, 91, 167], fontSize: 5, halign: 'center', valign: 'middle' },
                styles: { font: 'helvetica', fontSize: 5, halign: 'right', cellPadding: 2 },
                columnStyles: { 0: { halign: 'left', cellWidth: 45 }, 1: { halign: 'center', cellWidth: 35 }, 2: { halign: 'center' } },
                foot: [[ { content: 'TOTAL REMUNERASI', colSpan: 12, styles: { halign: 'right' } }, `Rp ${projPL.remRev.toLocaleString('id-ID')}` ]],
                footStyles: { font: 'helvetica', fillColor: [242, 170, 0], textColor: [255,255,255], fontSize: 6, fontStyle: 'bold', halign: 'right' }
            });
            currentY = doc.lastAutoTable.finalY + 20;

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("3. BIAYA OPERASIONAL & PERALATAN", marginX, currentY);

            const opsBody = [];
            ['common_units', 'common_equipments', 'special_units'].forEach(cat => {
                const catName = String(cat).replace('_', ' ').toUpperCase();
                (parsedOps[cat] || []).forEach(op => {
                    let itemName = op.item_id;
                    const item = masterItems.find(i => i.item_id === op.item_id);
                    if(item) itemName = item.item_name;
                    const qty = parseInt(op.qty) || 0;
                    const totHarga = parseFloat(op.final_sell_total) || 0;
                    opsBody.push([catName, String(itemName || '-').toUpperCase(), String(qty), totHarga.toLocaleString('id-ID')]);
                });
            });

            (parsedOps.others || []).forEach(op => {
                const q = parseInt(op.qty) || 0;
                const hb = parseFloat(op.harga_beli) || 0;
                const sett = parseFloat(op.cogs_sett) || 100;
                const totalJual = Math.round((hb / (sett / 100)) * q);
                opsBody.push(['OTHERS', String(op.item_name || '-').toUpperCase(), String(q), totalJual.toLocaleString('id-ID')]);
            });

            if (opsBody.length === 0) opsBody.push([{ content: 'TIDAK ADA ITEM OPERASIONAL', colSpan: 4, styles: { halign: 'center', fontStyle: 'italic' } }]);

            autoTable(doc, {
                startY: currentY + 10,
                margin: { left: marginX, right: marginX, bottom: 20 },
                head: [['KATEGORI', 'NAMA ITEM', 'QTY', 'TOTAL HARGA JUAL (Rp)']],
                body: opsBody,
                theme: 'grid',
                headStyles: { font: 'helvetica', fillColor: [41, 91, 167], fontSize: 6, halign: 'center', valign: 'middle' },
                styles: { font: 'helvetica', fontSize: 6, cellPadding: 3 },
                columnStyles: { 0: {cellWidth: 100}, 2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'right' } },
                foot: [[ { content: 'TOTAL OPERASIONAL', colSpan: 3, styles: { halign: 'right' } }, `Rp ${projPL.opsRev.toLocaleString('id-ID')}` ]],
                footStyles: { font: 'helvetica', fillColor: [242, 170, 0], textColor: [255,255,255], fontSize: 6, fontStyle: 'bold', halign: 'right' }
            });
            currentY = doc.lastAutoTable.finalY + 20;

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("4. MEMBERSHIP & MANAGEMENT FEE", marginX, currentY);

            const memBody = [
                [
                    String(projData.membership_plan || '-').toUpperCase(), 
                    String(projPL.totalManpower),
                    (parseFloat(projData.management_fee)||0).toLocaleString('id-ID'), 
                    projPL.memRev.toLocaleString('id-ID')
                ],
                [{ content: 'PPN 11%', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, projPL.ppnFee.toLocaleString('id-ID')],
                [{ content: 'PPH PASAL 23 (2%)', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, `( ${projPL.pph23Fee.toLocaleString('id-ID')} )`]
            ];

            autoTable(doc, {
                startY: currentY + 10,
                margin: { left: marginX, right: marginX, bottom: 20 },
                head: [['MEMBERSHIP PLAN', 'TOTAL MANPOWER (ORANG)', 'FEE PER ORANG (Rp)', 'TOTAL FEE (Rp)']],
                body: memBody,
                theme: 'grid',
                headStyles: { font: 'helvetica', fillColor: [41, 91, 167], fontSize: 6, halign: 'center', valign: 'middle' },
                styles: { font: 'helvetica', fontSize: 6, halign: 'center', cellPadding: 3 },
                columnStyles: { 0: { halign: 'left' }, 3: { halign: 'right' } },
                foot: [[ { content: 'TOTAL MEMBERSHIP (SEBELUM PAJAK)', colSpan: 3, styles: { halign: 'right' } }, `Rp ${projPL.memRev.toLocaleString('id-ID')}` ]],
                footStyles: { font: 'helvetica', fillColor: [242, 170, 0], textColor: [255,255,255], fontSize: 6, fontStyle: 'bold', halign: 'right' }
            });
            
            const grandTotalSetelahPajak = Math.round(projPL.grandRev + projPL.ppnFee - projPL.pph23Fee);
            let yPos = doc.lastAutoTable.finalY + 35;
            if (yPos > 700) { doc.addPage(); yPos = 40; }

            const rightValueX = 595.28 - marginX; 
            
            doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(41, 91, 167);
            doc.text("GRAND TOTAL PER BULAN (SEBELUM PAJAK)", marginX, yPos);
            doc.text(`Rp ${projPL.grandRev.toLocaleString('id-ID')}`, rightValueX, yPos, { align: 'right' });
            
            yPos += 20;
            doc.text("GRAND TOTAL PER BULAN (SETELAH PAJAK)", marginX, yPos);
            doc.text(`Rp ${grandTotalSetelahPajak.toLocaleString('id-ID')}`, rightValueX, yPos, { align: 'right' });

            yPos += 30; 

            let noteLines = 0;
            if (projData.additional_notes && projData.additional_notes.trim() !== '') {
                if (yPos > 750) { doc.addPage(); yPos = 40; }
                doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.setTextColor(41, 91, 167); 
                doc.text("KETERANGAN TAMBAHAN:", marginX, yPos);
                doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(60, 60, 60);
                const splitNotes = doc.splitTextToSize(String(projData.additional_notes).toUpperCase(), 350);
                doc.text(splitNotes, marginX, yPos + 10);
                noteLines = splitNotes.length;
            }

            let ttdY = Math.max(yPos + 40, yPos + 20 + (noteLines * 10));
            if (ttdY > 750) { doc.addPage(); ttdY = 50; }

            doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
            const pdfDate = versionLabel === 'DRAFT TERKINI' ? new Date().toISOString().split('T')[0] : (projData.date ? projData.date.split('T')[0] : new Date().toISOString().split('T')[0]);
            
            doc.text(`JAKARTA, ${formatIndoDate(pdfDate).toUpperCase()}`, rightValueX, ttdY, { align: 'right' });
            doc.text(String(projData.pic_name || 'NAMA PIC').toUpperCase(), rightValueX, ttdY + 60, { align: 'right' });

            const safeCompany = String(projData.company_name || 'UNKNOWN').replace(/[^a-zA-Z0-9- ]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
            const safeProject = String(projData.project_name || 'PROJECT').replace(/[^a-zA-Z0-9- ]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
            const safeVersion = String(versionLabel || 'DRAFT').replace(/[^a-zA-Z0-9- ]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
            
            doc.save(`QUO-${safeCompany}-${safeProject}-${safeVersion}.pdf`);
        } catch (err) {
            console.error("PDF ERROR:", err);
            alert(`Gagal memproses PDF.\n\nAlasan: ${err.stack || err.message}`);
        }
    };

    const addShift = () => setFormData(prev => ({ ...prev, shifts: [...prev.shifts, { shift_name: '', start_time: '', end_time: '' }] }));
    const updateShift = (index, field, value) => {
        const newShifts = [...formData.shifts];
        newShifts[index][field] = field === 'shift_name' ? value.toUpperCase() : value;
        setFormData({ ...formData, shifts: newShifts });
    };
    const removeShift = (index) => {
        const newShifts = [...formData.shifts];
        newShifts.splice(index, 1);
        setFormData({ ...formData, shifts: newShifts });
    };

    const addRemuneration = () => {
        setFormData({
            ...formData, 
            remunerations: [...formData.remunerations, {
                jabatan: '', grade: '', qty: '', gaji_pokok: '', gaji_pokok_pct: '', bpjs_tk: '', bpjs_tk_pct: '',
                bpjs_kes: '', bpjs_kes_pct: '', thr: '', thr_pct: '', pp35: '', pp35_pct: '',
                tunjangan_jabatan: '', tunjangan_jabatan_pct: '', tunjangan_lainnya: '', tunjangan_lainnya_pct: '', 
                tunjangan_knowledge: '', tunjangan_knowledge_pct: ''
            }]
        });
    };
    const updateRemuneration = (index, field, value) => {
        const updated = [...formData.remunerations];
        updated[index][field] = (field === 'jabatan' || field === 'grade') ? value.toUpperCase() : value;
        setFormData({ ...formData, remunerations: updated });
    };
    const removeRemuneration = (index) => {
        const updated = formData.remunerations.filter((_, i) => i !== index);
        setFormData({ ...formData, remunerations: updated });
    };

    const addOp = (category) => {
        const newItem = category === 'others'
            ? { item_name: '', qty: '', harga_beli: '', cogs_sett: '' }
            : { item_id: '', qty: '', base_price: 0, lifespan: 0, cogs_mo: 0, base_sell_mo: 0, final_sell_total: '', is_promo: false, promo_remark: '' };
        setFormData(prev => ({ ...prev, operational_items: { ...prev.operational_items, [category]: [...(prev.operational_items[category] || []), newItem] } }));
    };
    const updateOp = (category, index, field, value) => {
        setFormData(prev => {
            const updatedCat = [...(prev.operational_items[category] || [])];
            updatedCat[index][field] = typeof value === 'string' ? value.toUpperCase() : value;
            return { ...prev, operational_items: { ...prev.operational_items, [category]: updatedCat } };
        });
    };
    const handleOpQtyChange = (category, index, value) => {
        const newQtyStr = value.toUpperCase();
        const newQty = parseInt(newQtyStr) || 0;
        setFormData(prev => {
            const updatedCat = [...(prev.operational_items[category] || [])];
            updatedCat[index].qty = newQtyStr;
            if (category !== 'others') updatedCat[index].final_sell_total = (updatedCat[index].base_sell_mo || 0) * newQty;
            return { ...prev, operational_items: { ...prev.operational_items, [category]: updatedCat } };
        });
    };
    const removeOp = (category, index) => {
        setFormData(prev => {
            const updatedCat = [...(prev.operational_items[category] || [])];
            updatedCat.splice(index, 1);
            return { ...prev, operational_items: { ...prev.operational_items, [category]: updatedCat } };
        });
    };
    const handleOpItemChange = (category, index, itemId) => {
        const selectedItem = masterItems.find(i => i.item_id === itemId);
        setFormData(prev => {
            const updatedCat = [...(prev.operational_items[category] || [])];
            if (selectedItem) {
                const bp = parseFloat(selectedItem.price) || 0;
                const life = parseInt(selectedItem.lifespan_months) || 1;
                const cogs = parseFloat(selectedItem.cogs_per_month) || Math.round(bp / life);
                const sell = parseFloat(selectedItem.harga_jual_per_month || selectedItem.harga_jual_per_moth) || 0;
                const qty = parseInt(updatedCat[index].qty) || 1;
                updatedCat[index] = { ...updatedCat[index], item_id: itemId, base_price: bp, lifespan: life, cogs_mo: cogs, base_sell_mo: sell, final_sell_total: sell * qty, is_promo: false, promo_remark: '' };
            } else {
                updatedCat[index].item_id = '';
            }
            return { ...prev, operational_items: { ...prev.operational_items, [category]: updatedCat } };
        });
    };

    const openAddModal = () => { setIsEditing(false); setFormData(initialFormState); setCurrentStep(1); setIsModalOpen(true); };

    const validateStep = (step) => {
        if (step === 1) {
            const { project_name, company_name, location, contract_period, contract_start, work_pattern, shifts } = formData;
            if (!project_name || !company_name || !location || !contract_period || !contract_start || !work_pattern) {
                alert("MOHON LENGKAPI SEMUA KOLOM WAJIB (*) PADA INFORMASI UMUM."); return false;
            }
            if (shifts.length === 0) {
                alert("MOHON TAMBAHKAN MINIMAL 1 SHIFT KERJA."); return false;
            }
            let isShiftComplete = true;
            shifts.forEach(s => { if (!s.shift_name || !s.start_time || !s.end_time) isShiftComplete = false; });
            if (!isShiftComplete) {
                alert("MOHON LENGKAPI NAMA SHIFT, JAM MASUK, DAN JAM KELUAR PADA SEMUA BARIS SHIFT."); return false;
            }
        }
        if (step === 2) {
            if (formData.remunerations.length === 0) { alert("MOHON TAMBAHKAN SETIDAKNYA 1 BARIS REMUNERASI (JABATAN)."); return false; }
            let isComplete = true;
            formData.remunerations.forEach(rem => {
                if (!rem.jabatan || !rem.grade || !rem.qty) isComplete = false;
                remFields.forEach(f => { if (rem[f.key] === '' || rem[`${f.key}_pct`] === '') isComplete = false; });
            });
            if (!isComplete) { alert("MOHON LENGKAPI SEMUA KOTAK PADA MATRIKS REMUNERASI (TERMASUK GRADE & QTY). ISI ANGKA 0 JIKA TIDAK ADA NILAI."); return false; }
        }
        if (step === 3) {
            let isComplete = true, promoError = false;
            ['common_units', 'common_equipments', 'special_units'].forEach(cat => {
                (formData.operational_items[cat] || []).forEach(op => {
                    if (!op.item_id || !op.qty || op.final_sell_total === '') isComplete = false;
                    const finalSellTotal = parseFloat(op.final_sell_total) || 0;
                    const baseSellTotal = (parseFloat(op.base_sell_mo) || 0) * (parseInt(op.qty) || 1);
                    if (finalSellTotal < baseSellTotal) {
                        if (!op.is_promo) promoError = true;
                        if (op.is_promo && !op.promo_remark) promoError = true;
                    }
                });
            });
            (formData.operational_items.others || []).forEach(op => { if (!op.item_name || !op.qty || op.harga_beli === '' || op.cogs_sett === '') isComplete = false; });
            if (!isComplete) { alert("MOHON LENGKAPI SEMUA FIELD PADA OPERASIONAL (TERMASUK QTY DAN HARGA)."); return false; }
            if (promoError) { alert("JIKA FINAL SELL LEBIH RENDAH DARI BASE SELL, HARAP CENTANG 'PROMO' DAN ISI KETERANGAN (REMARK)."); return false; }
        }
        if (step === 4) {
            if (!formData.membership_plan || !formData.management_fee) {
                alert("MOHON LENGKAPI SEMUA KOLOM MEMBERSHIP SEBELUM MELIHAT P&L."); return false;
            }
        }
        return true;
    };

    const handleNext = () => { if (validateStep(currentStep)) setCurrentStep(prev => Math.min(prev + 1, 5)); };
    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const handleStepClick = (targetStep) => {
        if (targetStep < currentStep) setCurrentStep(targetStep);
        else if (targetStep > currentStep) {
            let canProceed = true;
            for(let i = currentStep; i < targetStep; i++) { if(!validateStep(i)) { canProceed = false; break; } }
            if(canProceed) setCurrentStep(targetStep);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payloadRemunerations = formData.remunerations.map(rem => {
                const calculatedRem = { ...rem };
                remFields.forEach(f => {
                    const nominal = Math.round((parseFloat(rem[f.key]) || 0) * ((parseFloat(rem[`${f.key}_pct`]) || 0) / 100));
                    calculatedRem[`${f.key}_nom`] = nominal;
                });
                return calculatedRem;
            });

            let currentHistory = formData.quotation_history || [];
            if (typeof currentHistory !== 'string') {
                currentHistory = JSON.stringify(currentHistory);
            }
            
            const payload = { 
                ...formData, 
                contract_end: previewEndDate, 
                remunerations: payloadRemunerations,
                shifts: JSON.stringify(formData.shifts), 
                status: 'DRAFT', 
                quotation_history: currentHistory
            };

            if (isEditing) await axios.put(`http://localhost:5000/api/projects/${formData.project_id}`, payload);
            else await axios.post('http://localhost:5000/api/projects', payload);
            
            setIsModalOpen(false);
            fetchAllData();
        } catch (err) {
            alert(`Gagal menyimpan project!\n\nAlasan: ${err.response?.data?.message || err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const expiringProjects = projects.filter(p => {
        if (p.status !== 'ACTIVE') return false;
        const exp = calculateExpiring(p.contract_end);
        return exp.isExpiring;
    }).sort((a, b) => calculateExpiring(a.contract_end).days - calculateExpiring(b.contract_end).days);

    const dataToDisplay = activeTab === 'ALL' ? projects : expiringProjects;

    const filteredData = dataToDisplay.filter(p => 
        (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.project_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && projects.length === 0) return <div className="text-[#C4C7C5] text-xs p-4">Syncing data...</div>;

    const renderMasterTable = (title, categoryKey, filterLabel) => {
        const itemsList = masterItems.filter(i => (i.category_2 || '').toUpperCase() === filterLabel);
        const dataList = formData.operational_items[categoryKey] || [];
        return (
            <div className="bg-[#1E1F22] p-4 rounded-xl border border-[#333639] space-y-3 shadow-sm">
                <div className="flex justify-between items-center border-b border-[#333639] pb-2 mb-1">
                    <h4 className="font-medium text-[#A8C7FA] text-[11px] uppercase tracking-wider">{title}</h4>
                    <button type="button" onClick={() => addOp(categoryKey)} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-3 py-1.5 rounded-full flex items-center transition-colors"><Plus className="w-3 h-3 mr-1"/> Add Row</button>
                </div>
                <div className="overflow-x-auto border border-[#333639] rounded-lg custom-scrollbar">
                    <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                        <thead className="bg-[#1E1F22] border-b border-[#333639]">
                            <tr>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase min-w-[200px]">Item *</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase w-16 text-center">Qty *</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase w-24 text-right">Price (Tot)</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase w-16 text-center">Life</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase w-24 text-right">COGS (Tot)</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase w-28 text-right">Base Sell (Tot)</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#A8C7FA] uppercase w-32 text-right">Final Sell (Tot) *</th>
                                <th className="p-2 border-r border-[#333639] font-medium text-[#8E918F] uppercase w-48">Promo & Remark</th>
                                <th className="p-2 text-center font-medium text-[#8E918F] uppercase w-10">Act</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333639]">
                            {dataList.length === 0 && <tr><td colSpan={9} className="p-3 text-center text-[#8E918F] italic">Click "Add Row" to add {title}.</td></tr>}
                            {dataList.map((op, idx) => {
                                const q = parseInt(op.qty) || 0;
                                const totPrice = (op.base_price || 0) * q;
                                const totCogs = (op.cogs_mo || 0) * q;
                                const totBaseSell = (op.base_sell_mo || 0) * q;
                                const isHargaTurun = parseFloat(op.final_sell_total) < totBaseSell;
                                return (
                                    <tr key={idx} className="hover:bg-[#333639]/30 transition-colors">
                                        <td className="p-1.5 border-r border-[#333639] align-top min-w-[200px]">
                                            <select value={op.item_id} onChange={(e) => handleOpItemChange(categoryKey, idx, e.target.value)} className="w-full border border-[#333639] rounded-md px-2 py-1 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                                <option value="" className="text-[#8E918F]">-- Select --</option>
                                                {itemsList.map(item => <option key={item.item_id} value={item.item_id}>{item.item_name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-1.5 border-r border-[#333639] align-top w-16">
                                            <input type="number" min="1" value={op.qty} onChange={(e) => handleOpQtyChange(categoryKey, idx, e.target.value)} placeholder="0" className="w-full border border-[#333639] bg-[#131314] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] text-center" />
                                        </td>
                                        <td className="p-1.5 border-r border-[#333639] align-middle text-right text-[#C4C7C5] w-24 overflow-hidden truncate">{totPrice > 0 ? totPrice.toLocaleString('id-ID') : '0'}</td>
                                        <td className="p-1.5 border-r border-[#333639] align-middle text-center text-[#8E918F] w-16">{op.lifespan || 0}</td>
                                        <td className="p-1.5 border-r border-[#333639] align-middle text-right text-[#FFBCA6] w-24 overflow-hidden truncate">{totCogs > 0 ? totCogs.toLocaleString('id-ID') : '0'}</td>
                                        <td className="p-1.5 border-r border-[#333639] align-middle text-right text-[#6DD58C] font-medium w-28 overflow-hidden truncate">{totBaseSell > 0 ? totBaseSell.toLocaleString('id-ID') : '0'}</td>
                                        <td className="p-1.5 border-r border-[#333639] align-top w-32">
                                            <input type="number" min="0" value={op.final_sell_total} onChange={(e) => updateOp(categoryKey, idx, 'final_sell_total', e.target.value)} className={`w-full border border-[#333639] bg-[#1E1F22] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none text-right transition font-bold ${isHargaTurun ? (op.is_promo ? 'text-[#F2AA00]' : 'text-[#FFB4AB]') : 'text-[#A8C7FA]'}`} placeholder="0" />
                                        </td>
                                        <td className="p-1.5 border-r border-[#333639] align-top w-48">
                                            <div className="flex items-center space-x-2 bg-[#1E1F22] border border-[#333639] rounded-md px-2 py-1">
                                                <input type="checkbox" checked={op.is_promo} onChange={(e) => updateOp(categoryKey, idx, 'is_promo', e.target.checked)} className="accent-[#A8C7FA] w-3 h-3 cursor-pointer shrink-0" title="Check if Promo" />
                                                <input type="text" disabled={!op.is_promo} value={op.promo_remark} onChange={(e) => updateOp(categoryKey, idx, 'promo_remark', e.target.value)} placeholder={op.is_promo ? "REMARK PROMO" : "N/A"} className="w-full bg-transparent text-[10px] text-[#E3E3E3] outline-none disabled:text-[#8E918F] placeholder-[#5F6368] uppercase" />
                                            </div>
                                        </td>
                                        <td className="p-1.5 text-center align-middle w-10"><button type="button" onClick={() => removeOp(categoryKey, idx)} className="text-[#8E918F] hover:text-[#FFB4AB] p-1 transition-colors rounded-full"><Trash2 className="w-3.5 h-3.5 mx-auto"/></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="relative space-y-4 w-full mx-auto font-sans antialiased text-[#E3E3E3]">
            {/* --- TABEL UTAMA --- */}
            <div className="bg-[#1E1F22] rounded-[16px] border border-[#333639] overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-[#333639] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1E1F22] space-y-3 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-[#E3E3E3] tracking-wide">Master Projects</h2>
                        <p className="text-[10px] text-[#8E918F] mt-0.5">{projects.length} Total Projects</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-56">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-[#8E918F]" /></div>
                            <input type="text" placeholder="Search references..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#333639] rounded-full bg-[#131314] text-[#E3E3E3] text-[11px] focus:outline-none focus:border-[#A8C7FA] transition-all" />
                        </div>
                        <button onClick={openAddModal} className="w-full sm:w-auto flex items-center justify-center bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-semibold px-4 py-1.5 rounded-full transition-colors"><Plus className="w-3.5 h-3.5 mr-1" /> Add Project</button>
                    </div>
                </div>

                <div className="px-5 py-1 flex space-x-2 bg-[#1E1F22] border-b border-[#333639]">
                    <button onClick={() => setActiveTab('ALL')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center uppercase ${activeTab === 'ALL' ? 'bg-[#D3E3FD] text-[#062E6F]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <ClipboardList className="w-3.5 h-3.5 mr-1.5"/> ALL PROJECTS
                    </button>
                    <button onClick={() => setActiveTab('EXPIRING')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center uppercase ${activeTab === 'EXPIRING' ? 'bg-[#FFBCA6]/20 text-[#FFBCA6]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Clock className="w-3.5 h-3.5 mr-1.5"/> EXPIRING SOON
                        {expiringProjects.length > 0 && <span className="ml-1.5 bg-[#FFBCA6] text-[#8C1D18] px-1.5 py-0.5 rounded-full text-[9px] font-bold">{expiringProjects.length}</span>}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                            <tr>
                                <th className="px-5 py-2 font-medium">Project ID</th>
                                <th className="px-5 py-2 font-medium">Project Name</th>
                                <th className="px-5 py-2 font-medium">Client</th>
                                <th className="px-5 py-2 font-medium">Period</th>
                                <th className="px-5 py-2 font-medium text-center">Pattern</th>
                                <th className="px-5 py-2 font-medium text-center">{activeTab === 'EXPIRING' ? 'TIME LEFT' : 'STATUS'}</th>
                                <th className="px-5 py-2 font-medium text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333639] text-[11px]">
                            {filteredData.length === 0 && <tr><td colSpan={7} className="text-center p-4 text-[#8E918F] italic">No projects found.</td></tr>}
                            {filteredData.map((proj, idx) => {
                                const exp = calculateExpiring(proj.contract_end);
                                return (
                                <tr key={idx} className="hover:bg-[#333639]/30 transition-colors">
                                    <td className="px-5 py-1.5 font-medium text-[#E3E3E3]">{proj.project_id}</td>
                                    <td className="px-5 py-1.5 font-medium text-[#A8C7FA]">{proj.project_name}</td>
                                    <td className="px-5 py-1.5 text-[#C4C7C5]">{proj.company_name}</td>
                                    <td className="px-5 py-1.5 text-[#8E918F]">
                                        <div className="text-[#C4C7C5]">{proj.contract_period ? `${proj.contract_period} MONTHS` : '-'}</div>
                                        <div className="text-[9px] mt-0.5">{proj.contract_start || '-'} TO {proj.contract_end || '-'}</div>
                                    </td>
                                    <td className="px-5 py-1.5 text-center"><span className="bg-[#333639] text-[#E3E3E3] px-2.5 py-0.5 rounded-full text-[9px] tracking-wide">{proj.work_pattern}</span></td>
                                    
                                    <td className="px-5 py-1.5 text-center">
                                        {activeTab === 'EXPIRING' ? (
                                            <div className="flex items-center justify-center space-x-1.5 bg-[#8C1D18]/20 border border-[#8C1D18]/50 px-2 py-0.5 rounded-full">
                                                <AlertTriangle className="w-3 h-3 text-[#FFB4AB]"/>
                                                <span className="text-[#FFB4AB] text-[9px] font-bold">{exp.text}</span>
                                            </div>
                                        ) : (
                                            <select 
                                                value={proj.status} 
                                                onChange={(e) => handleStatusChange(proj, e.target.value)}
                                                className={`px-3 py-1 rounded-full text-[9px] font-semibold border tracking-wide outline-none cursor-pointer appearance-none text-center transition-colors ${
                                                    proj.status === 'ACTIVE' ? 'bg-[#0F5223] text-[#6DD58C] border-[#0F5223]' : 
                                                    proj.status === 'NONACTIVE' ? 'bg-[#8C1D18] text-[#FFB4AB] border-[#8C1D18]' : 
                                                    'bg-[#5C3F00] text-[#FFBCA6] border-[#5C3F00]'
                                                }`}
                                            >
                                                <option value="DRAFT" className="bg-[#131314] text-[#FFBCA6]">DRAFT</option>
                                                <option value="ACTIVE" className="bg-[#131314] text-[#6DD58C]">ACTIVE</option>
                                                <option value="NONACTIVE" className="bg-[#131314] text-[#FFB4AB]">NONACTIVE</option>
                                            </select>
                                        )}
                                    </td>

                                    <td className="px-5 py-1.5 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={(e) => openEditModal(proj, false, e)} title="Edit" className="text-[#A8C7FA] hover:text-[#062E6F] bg-[#A8C7FA]/10 hover:bg-[#A8C7FA] p-1.5 rounded-full transition-colors"><Edit className="w-3.5 h-3.5"/></button>
                                            <button onClick={(e) => handleDuplicate(proj, e)} title="Duplicate (Copy)" className="text-[#A8C7FA] hover:text-[#062E6F] bg-[#A8C7FA]/10 hover:bg-[#A8C7FA] p-1.5 rounded-full transition-colors"><Copy className="w-3.5 h-3.5"/></button>
                                            <button onClick={(e) => openFeeModal(proj, e)} title="Commitment Fee Invoice" className="text-[#6DD58C] hover:text-[#0F5223] bg-[#6DD58C]/10 hover:bg-[#6DD58C] p-1.5 rounded-full transition-colors"><DollarSign className="w-3.5 h-3.5"/></button>
                                            <button onClick={(e) => handleOpenDownloadModal(proj, e)} title="Download Quotation (PDF)" className="text-[#A8C7FA] hover:text-[#062E6F] bg-[#A8C7FA]/10 hover:bg-[#A8C7FA] p-1.5 rounded-full transition-colors"><FileDown className="w-3.5 h-3.5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL DOWNLOAD PDF VERSIONING --- */}
            {isDownloadModalOpen && selectedProjDownload && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="px-5 py-3 border-b border-[#333639] bg-[#1E1F22] flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-[#E3E3E3] tracking-wide">PILIH VERSI PENAWARAN</h3>
                            <button onClick={() => setIsDownloadModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] hover:bg-[#333639] p-1 rounded-full transition-colors"><XCircle className="w-5 h-5"/></button>
                        </div>
                        <div className="p-5 space-y-3 bg-[#131314] max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {selectedProjDownload.parsedHistory && selectedProjDownload.parsedHistory.length > 0 ? (
                                selectedProjDownload.parsedHistory.map((h, i) => {
                                    const vLabel = formatVersionLabel(h.date);
                                    return (
                                        <button 
                                            key={i} 
                                            onClick={() => { handleDownloadPDF(h.data, `${vLabel} - AKTIF`); setIsDownloadModalOpen(false); }}
                                            className="w-full text-left px-4 py-3 bg-[#1E1F22] hover:bg-[#333639] border border-[#333639] hover:border-[#A8C7FA] rounded-xl text-[11px] text-[#E3E3E3] font-medium flex justify-between items-center transition-colors group"
                                        >
                                            <span className="group-hover:text-[#A8C7FA] transition-colors font-semibold uppercase">{vLabel}</span>
                                            <span className="text-[#6DD58C] text-[9px] uppercase tracking-wide">STATUS: ACTIVE</span>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="text-center text-[#8E918F] text-[10px] italic py-2">Belum ada riwayat penawaran aktif.</div>
                            )}
                            
                            <div className="pt-3 mt-3 border-t border-[#333639]">
                                <button 
                                    onClick={() => { handleDownloadPDF(selectedProjDownload, 'DRAFT TERKINI'); setIsDownloadModalOpen(false); }}
                                    className="w-full text-left px-4 py-3 bg-[#004A77]/20 hover:bg-[#004A77]/40 border border-[#004A77]/50 rounded-xl text-[11px] text-[#7FCFFF] font-semibold flex justify-between items-center transition-colors"
                                >
                                    <span className="uppercase">{selectedProjDownload.parsedHistory?.length > 0 ? 'DRAFT PERUBAHAN TERKINI' : 'DRAFT PENAWARAN AWAL'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL WIZARD FORM QUOTATION --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full xl:max-w-7xl overflow-hidden flex flex-col max-h-[95vh]">
                        
                        <div className="px-5 py-3 bg-[#1E1F22] flex justify-between items-center shrink-0 rounded-t-[16px]">
                            <div>
                                <h3 className="text-sm font-semibold text-[#E3E3E3]">{isEditing ? `EDIT PROJECT: ${formData.project_name}` : 'NEW PROJECT REGISTRATION'}</h3>
                                <p className="text-[10px] text-[#8E918F] mt-0.5">COMPLETE GENERAL, REMUNERATION, OPS, MEMBERSHIP, & P&L. PRESS ESC TO CLOSE.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] p-1 rounded-full hover:bg-[#333639] transition-colors"><XCircle className="w-5 h-5"/></button>
                        </div>

                        <div className="px-5 pb-3 bg-[#1E1F22] border-b border-[#333639] shrink-0">
                            <div className="flex justify-between space-x-2">
                                {[ { step: 1, label: 'GENERAL INFO' }, { step: 2, label: 'REMUNERATION' }, { step: 3, label: 'OPERATIONS' }, { step: 4, label: 'MEMBERSHIP' }, { step: 5, label: 'P&L SUMMARY' } ].map((s) => (
                                    <button key={s.step} type="button" onClick={() => handleStepClick(s.step)} className="flex-1 flex flex-col items-start transition-opacity text-left cursor-pointer group outline-none">
                                        <div className={`h-1.5 w-full rounded-full mb-1.5 transition-colors duration-300 ${currentStep >= s.step ? 'bg-[#6DD58C] shadow-[0_0_8px_rgba(109,213,140,0.4)] group-hover:bg-[#93D7A6]' : 'bg-[#333639] group-hover:bg-[#444746]'}`}></div>
                                        <span className={`text-[9px] font-bold uppercase transition-colors tracking-wide ${currentStep === s.step ? 'text-[#6DD58C]' : currentStep > s.step ? 'text-[#E3E3E3]' : 'text-[#8E918F]'}`}>{s.step}. {s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <form id="projectForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 bg-[#131314] custom-scrollbar">
                            
                            {/* STEP 1: GENERAL INFO */}
                            {currentStep === 1 && (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="bg-[#1E1F22] p-4 rounded-xl border border-[#333639] space-y-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">PROJECT ID</label>
                                                <input type="text" disabled value={isEditing ? formData.project_id : '(AUTO-GENERATED)'} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#8E918F] opacity-70" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">PROJECT NAME *</label>
                                                <input type="text" name="project_name" value={formData.project_name} onChange={handleChange} placeholder="E.G. MALL ALPHA SECURITY OPERATION" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">CLIENT NAME *</label>
                                                <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="E.G. PT ALPHA PROPERTI INDONESIA" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">ALAMAT PERUSAHAAN (KANTOR) *</label>
                                                <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="E.G. JL. JEND. SUDIRMAN KAV 1, JAKARTA PUSAT" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">ALAMAT PEKERJAAN (SITE) *</label>
                                                <input type="text" name="work_location" value={formData.work_location || ''} onChange={handleChange} placeholder="E.G. MALL ALPHA, JL. GATOT SUBROTO" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">TERM OF PAYMENT (HARI)</label>
                                                <input type="number" min="0" name="term_of_payment" value={formData.term_of_payment || ''} onChange={handleChange} placeholder="E.G. 30" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                            </div>
                                        </div>

                                        <div className="p-4 bg-[#131314] border border-[#333639] rounded-xl space-y-4">
                                            <div className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider">PIC INFORMATION</div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">PIC NAME</label>
                                                    <input type="text" name="pic_name" value={formData.pic_name || ''} onChange={handleChange} placeholder="BUDI SANTOSO" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">PIC EMAIL</label>
                                                    <input type="email" name="pic_email" value={formData.pic_email || ''} onChange={handleChange} placeholder="BUDI@CLIENT.COM" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all uppercase" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">PIC PHONE</label>
                                                    <input type="text" name="pic_phone" value={formData.pic_phone || ''} onChange={handleChange} placeholder="081234567890" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all uppercase" />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 bg-[#131314] border border-[#333639] rounded-xl space-y-4">
                                            <div className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider">CONTRACT CONFIGURATION & WORK PATTERN</div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">DURATION (MONTHS) *</label>
                                                    <input type="number" min="1" name="contract_period" value={formData.contract_period} onChange={handleChange} placeholder="E.G. 24" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">START DATE *</label>
                                                    <input type="date" name="contract_start" value={formData.contract_start} onChange={handleChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none transition-all" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">END DATE (AUTO)</label>
                                                    <input type="date" disabled value={previewEndDate || ''} className="w-full border border-[#0F5223]/50 rounded-lg px-2.5 py-1.5 text-[11px] bg-[#0F5223]/20 text-[#6DD58C] font-bold" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">WORK PATTERN *</label>
                                                    <input type="text" name="work_pattern" value={formData.work_pattern} onChange={handleChange} placeholder="E.G. 6-1 ATAU 5-2" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all" />
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-[#333639]">
                                                <div className="flex justify-between items-center mb-3">
                                                    <label className="block text-[10px] font-medium text-[#8E918F] uppercase tracking-wide">SHIFT DETAILS *</label>
                                                    <button type="button" onClick={addShift} className="text-[9px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-2.5 py-1 rounded-full flex items-center transition-colors uppercase">
                                                        <Plus className="w-3 h-3 mr-1"/> ADD SHIFT
                                                    </button>
                                                </div>
                                                {formData.shifts.length === 0 && <p className="text-[10px] text-[#8E918F] italic mb-2">Belum ada shift. Klik Add Shift.</p>}
                                                {formData.shifts.map((shift, idx) => (
                                                    <div key={idx} className="flex items-center space-x-3 mb-2 bg-[#1E1F22] p-2 rounded-lg border border-[#333639]">
                                                        <div className="flex-1">
                                                            <select value={shift.shift_name} onChange={(e) => updateShift(idx, 'shift_name', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none uppercase">
                                                                <option value="">-- PILIH SHIFT --</option>
                                                                {shiftOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                {shift.shift_name && !shiftOptions.includes(shift.shift_name) && <option value={shift.shift_name}>{shift.shift_name}</option>}
                                                            </select>
                                                        </div>
                                                        <div className="w-32">
                                                            <input type="time" value={shift.start_time} onChange={(e) => updateShift(idx, 'start_time', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none" title="Jam Masuk" />
                                                        </div>
                                                        <div className="w-32">
                                                            <input type="time" value={shift.end_time} onChange={(e) => updateShift(idx, 'end_time', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none" title="Jam Keluar" />
                                                        </div>
                                                        <button type="button" onClick={() => removeShift(idx)} className="text-[#8E918F] hover:text-[#FFB4AB] p-1.5 transition-colors rounded-full"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-[#131314] border border-[#333639] rounded-xl">
                                            <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">ADDITIONAL NOTES / KETERANGAN TAMBAHAN</label>
                                            <textarea name="additional_notes" rows="2" value={formData.additional_notes || ''} onChange={handleChange} placeholder="MASUKKAN KETERANGAN TAMBAHAN (AKAN TERCETAK DI PDF QUOTATION)" className="w-full border border-[#333639] rounded-lg px-2.5 py-2 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] transition-all resize-none"></textarea>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {/* STEP 2: REMUNERATION */}
                            {currentStep === 2 && (
                                <div className="bg-[#1E1F22] p-4 rounded-xl border border-[#333639] space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center border-b border-[#333639] pb-2 mb-1">
                                        <div>
                                            <h4 className="font-medium text-[#A8C7FA] text-[11px] uppercase tracking-wider">REMUNERATION MATRIX</h4>
                                            <p className="text-[9px] text-[#8E918F] mt-0.5 uppercase">PLEASE FILL ALL INPUTS. ENTER '0' IF A COMPONENT IS NOT APPLICABLE.</p>
                                        </div>
                                        <button type="button" onClick={addRemuneration} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-3 py-1.5 rounded-full flex items-center transition-colors"><Plus className="w-3 h-3 mr-1"/> ADD ROW</button>
                                    </div>
                                    
                                    <div className="overflow-x-auto border border-[#333639] rounded-lg custom-scrollbar pb-2">
                                        <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                                            <thead className="bg-[#1E1F22] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-2 border-r border-[#333639] font-medium min-w-[120px]">POSITION *</th>
                                                    <th className="p-2 border-r border-[#333639] font-medium w-24 text-center">GRADE *</th>
                                                    <th className="p-2 border-r border-[#333639] font-medium w-14 min-w-[50px] text-center">QTY *</th>
                                                    {remFields.map(f => <th key={f.key} className="p-2 border-r border-[#333639] font-medium min-w-[85px]">{f.label} *</th>)}
                                                    <th className="p-2 text-center font-medium">ACT</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333639]">
                                                {formData.remunerations.length === 0 && (
                                                    <tr><td colSpan={remFields.length + 4} className="p-4 text-center text-[#8E918F] italic">CLICK "ADD ROW" TO SETUP REMUNERATIONS.</td></tr>
                                                )}
                                                {formData.remunerations.map((rem, idx) => (
                                                    <Fragment key={idx}>
                                                        <tr className="border-b border-[#333639] hover:bg-[#333639]/10">
                                                            <td className="p-1.5 border-r border-[#333639] align-top min-w-[120px]">
                                                                <input type="text" value={rem.jabatan} onChange={(e) => updateRemuneration(idx, 'jabatan', e.target.value)} placeholder="E.G. DANRU" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none font-bold uppercase transition-all placeholder-[#5F6368]" />
                                                            </td>
                                                            <td className="p-1.5 border-r border-[#333639] align-top min-w-[80px]">
                                                                <select value={rem.grade || ''} onChange={(e) => updateRemuneration(idx, 'grade', e.target.value)} className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none uppercase transition-all">
                                                                    <option value="">-GRADE-</option>
                                                                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                                                                    {rem.grade && !gradeOptions.includes(rem.grade) && <option value={rem.grade}>{rem.grade}</option>}
                                                                </select>
                                                            </td>
                                                            <td className="p-1.5 border-r border-[#333639] align-top w-14 min-w-[50px]">
                                                                <input type="number" min="1" value={rem.qty} onChange={(e) => updateRemuneration(idx, 'qty', e.target.value)} placeholder="0" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none text-center transition-all placeholder-[#5F6368] uppercase" />
                                                            </td>
                                                            {remFields.map(f => (
                                                                <td key={f.key} className="p-1.5 border-r border-[#333639] align-top min-w-[85px]">
                                                                    <input type="number" value={rem[f.key]} onChange={(e) => updateRemuneration(idx, f.key, e.target.value)} placeholder="0" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none text-right transition-all placeholder-[#5F6368] uppercase" />
                                                                </td>
                                                            ))}
                                                            <td className="p-1.5 text-center align-middle" rowSpan={3}>
                                                                <button type="button" onClick={() => removeRemuneration(idx)} className="text-[#8E918F] hover:text-[#FFB4AB] p-2 transition-colors rounded-full hover:bg-[#333639]"><Trash2 className="w-4 h-4 mx-auto"/></button>
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b border-[#333639] bg-[#131314]">
                                                            <td colSpan={3} className="p-1.5 border-r border-[#333639] text-right font-medium text-[#8E918F] text-[9px] uppercase">DEDUCT % *</td>
                                                            {remFields.map(f => (
                                                                <td key={`${f.key}_pct`} className="p-1.5 border-r border-[#333639] align-top relative min-w-[85px]">
                                                                    <input type="number" value={rem[`${f.key}_pct`]} onChange={(e) => updateRemuneration(idx, `${f.key}_pct`, e.target.value)} placeholder="0" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] pr-5 focus:border-[#A8C7FA] outline-none text-right transition-all placeholder-[#5F6368] uppercase" />
                                                                    <span className="absolute right-3 top-2.5 text-[9px] text-[#8E918F]">%</span>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                        <tr className="border-b-4 border-b-[#1E1F22] bg-[#0F5223]/20">
                                                            <td colSpan={3} className="p-1.5 border-r border-[#333639] text-right font-bold text-[#6DD58C]/70 text-[9px] uppercase">DEDUCT</td>
                                                            {remFields.map(f => {
                                                                const nominal = Math.round((parseFloat(rem[f.key]) || 0) * ((parseFloat(rem[`${f.key}_pct`]) || 0) / 100));
                                                                return <td key={`${f.key}_nom`} className="p-1.5 border-r border-[#333639] text-right font-bold text-[#6DD58C] min-w-[85px] uppercase">{nominal > 0 ? nominal.toLocaleString('id-ID') : '0'}</td>
                                                            })}
                                                        </tr>
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: OPERATIONS */}
                            {currentStep === 3 && (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    {renderMasterTable("COMMON UNIT", "common_units", "COMMON UNIT")}
                                    {renderMasterTable("COMMON EQUIPMENT", "common_equipments", "COMMON EQUIPMENT")}
                                    {renderMasterTable("SPECIAL EXPERTISE", "special_units", "SPECIAL EXPERTISE")}

                                    <div className="bg-[#1E1F22] p-4 rounded-xl border border-[#333639] space-y-3 shadow-sm">
                                        <div className="flex justify-between items-center border-b border-[#333639] pb-2 mb-1">
                                            <h4 className="font-medium text-[#A8C7FA] text-[11px] uppercase tracking-wider">OTHERS (MANUAL INPUT)</h4>
                                            <button type="button" onClick={() => addOp('others')} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-3 py-1.5 rounded-full flex items-center transition-colors"><Plus className="w-3 h-3 mr-1"/> Add Row</button>
                                        </div>
                                        <div className="overflow-x-auto border border-[#333639] rounded-lg custom-scrollbar pb-2">
                                            <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                                                <thead className="bg-[#1E1F22] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="p-2 border-r border-[#333639] font-medium min-w-[200px]">ITEM NAME *</th>
                                                        <th className="p-2 border-r border-[#333639] font-medium w-24 text-center">QTY *</th>
                                                        <th className="p-2 border-r border-[#333639] font-medium w-32 text-right">HARGA BELI (UNIT) *</th>
                                                        <th className="p-2 border-r border-[#333639] font-medium w-28 text-center">COGS SETT % *</th>
                                                        <th className="p-2 border-r border-[#333639] font-medium text-[#A8C7FA] w-40 text-right">TOTAL HARGA JUAL (AUTO)</th>
                                                        <th className="p-2 text-center font-medium w-12">ACT</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#333639]">
                                                    {formData.operational_items.others.length === 0 && (
                                                        <tr><td colSpan={6} className="p-4 text-center text-[#8E918F] italic">CLICK "ADD ROW" TO ADD OTHERS.</td></tr>
                                                    )}
                                                    {formData.operational_items.others.map((op, idx) => {
                                                        const hb = parseFloat(op.harga_beli) || 0;
                                                        const sett = parseFloat(op.cogs_sett) || 100;
                                                        const q = parseInt(op.qty) || 0;
                                                        const totalJual = Math.round((hb / (sett / 100)) * q);
                                                        return (
                                                        <tr key={idx} className="hover:bg-[#333639]/30 transition-colors">
                                                            <td className="p-1.5 border-r border-[#333639] align-top min-w-[200px]">
                                                                <input type="text" value={op.item_name} onChange={(e) => updateOp('others', idx, 'item_name', e.target.value)} placeholder="E.G. CUSTOM TOOLS" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none uppercase placeholder-[#5F6368]" />
                                                            </td>
                                                            <td className="p-1.5 border-r border-[#333639] align-top w-24">
                                                                <input type="number" min="1" value={op.qty} onChange={(e) => handleOpQtyChange('others', idx, e.target.value)} placeholder="0" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368] text-center" />
                                                            </td>
                                                            <td className="p-1.5 border-r border-[#333639] align-top w-32">
                                                                <input type="number" min="0" value={op.harga_beli} onChange={(e) => updateOp('others', idx, 'harga_beli', e.target.value)} placeholder="0" className="w-full border border-[#333639] bg-[#1E1F22] text-[#C4C7C5] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none text-right placeholder-[#5F6368]" />
                                                            </td>
                                                            <td className="p-1.5 border-r border-[#333639] align-top relative w-28">
                                                                <input type="number" min="0" value={op.cogs_sett} onChange={(e) => updateOp('others', idx, 'cogs_sett', e.target.value)} placeholder="100" className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-md px-2 py-1 text-[11px] pr-5 focus:border-[#A8C7FA] outline-none text-right placeholder-[#5F6368]" />
                                                                <span className="absolute right-3.5 top-2.5 text-[9px] text-[#8E918F]">%</span>
                                                            </td>
                                                            <td className="p-1.5 border-r border-[#333639] align-middle text-right text-[#A8C7FA] font-bold w-40">{totalJual > 0 ? totalJual.toLocaleString('id-ID') : '0'}</td>
                                                            <td className="p-1.5 text-center align-middle w-12"><button type="button" onClick={() => removeOp('others', idx)} className="text-[#8E918F] hover:text-[#FFB4AB] p-1 rounded-full hover:bg-[#333639] transition-colors"><Trash2 className="w-3.5 h-3.5 mx-auto"/></button></td>
                                                        </tr>
                                                    )})}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: MEMBERSHIP */}
                            {currentStep === 4 && (
                                <div className="bg-[#1E1F22] p-4 rounded-xl border border-[#333639] space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div>
                                        <h4 className="font-medium text-[#A8C7FA] border-b border-[#333639] pb-2 mb-2 text-[11px] uppercase tracking-wider">MEMBERSHIP & FINALIZATION</h4>
                                        <p className="text-[10px] text-[#8E918F] mb-4 uppercase">COMPLETE FINAL CONFIGURATION BEFORE SAVING THE PROJECT.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-medium text-[#8E918F] uppercase mb-1.5 tracking-wide">MEMBERSHIP PLAN *</label>
                                            <input type="text" name="membership_plan" value={formData.membership_plan} onChange={handleChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none focus:border-[#A8C7FA] transition-all placeholder-[#5F6368] uppercase" placeholder="E.G. VIP PLAN" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-[#8E918F] uppercase mb-1.5 tracking-wide">MANAGEMENT FEE (RP / PERSON) *</label>
                                            <input type="number" name="management_fee" value={formData.management_fee} onChange={handleChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none focus:border-[#A8C7FA] transition-all placeholder-[#5F6368]" placeholder="E.G. 100000" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#333639]">
                                        <div className="bg-[#131314] p-3 rounded-lg border border-[#333639]">
                                            <label className="block text-[9px] font-medium text-[#8E918F] uppercase mb-1 tracking-wide">TOTAL MANPOWER QTY</label>
                                            <div className="text-sm font-bold text-[#E3E3E3]">{pl.totalManpower} PERSON</div>
                                        </div>
                                        <div className="bg-[#131314] p-3 rounded-lg border border-[#333639]">
                                            <label className="block text-[9px] font-medium text-[#8E918F] uppercase mb-1 tracking-wide">PPN (11% DARI TOTAL MGT FEE)</label>
                                            <div className="text-sm font-bold text-[#FFBCA6]">Rp {pl.ppnFee.toLocaleString('id-ID')}</div>
                                        </div>
                                        <div className="bg-[#131314] p-3 rounded-lg border border-[#333639]">
                                            <label className="block text-[9px] font-medium text-[#8E918F] uppercase mb-1 tracking-wide">PPH 23 (2% DARI TOTAL MGT FEE)</label>
                                            <div className="text-sm font-bold text-[#FFBCA6]">Rp {pl.pph23Fee.toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: P&L SUMMARY */}
                            {currentStep === 5 && (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-[#131314] border border-[#333639] p-4 rounded-xl flex flex-col">
                                            <span className="text-[10px] font-medium text-[#8E918F] uppercase flex items-center mb-1"><Receipt className="w-3.5 h-3.5 mr-1.5"/> GRAND REVENUE</span>
                                            <span className="text-xl font-bold text-[#E3E3E3] tracking-tight">Rp {pl.grandRev.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="bg-[#131314] border border-[#333639] p-4 rounded-xl flex flex-col">
                                            <span className="text-[10px] font-medium text-[#8E918F] uppercase flex items-center mb-1"><TrendingUp className="w-3.5 h-3.5 mr-1.5"/> GRAND COGS</span>
                                            <span className="text-xl font-bold text-[#FFBCA6] tracking-tight">Rp {pl.grandCogs.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="bg-[#131314] border border-[#0F5223] p-4 rounded-xl flex flex-col bg-gradient-to-br from-[#131314] to-[#0F5223]/20">
                                            <span className="text-[10px] font-medium text-[#8E918F] uppercase flex items-center mb-1"><DollarSign className="w-3.5 h-3.5 mr-1.5 text-[#6DD58C]"/> GRAND PROFIT</span>
                                            <span className="text-xl font-bold text-[#6DD58C] tracking-tight">Rp {pl.grandProfit.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="bg-[#131314] border border-[#004A77] p-4 rounded-xl flex flex-col bg-gradient-to-br from-[#131314] to-[#004A77]/20">
                                            <span className="text-[10px] font-medium text-[#8E918F] uppercase flex items-center mb-1"><PieChart className="w-3.5 h-3.5 mr-1.5 text-[#7FCFFF]"/> PROFIT MARGIN</span>
                                            <span className="text-xl font-bold text-[#7FCFFF] tracking-tight">{pl.grandMargin}%</span>
                                        </div>
                                    </div>

                                    <div className="bg-[#1E1F22] p-4 rounded-xl border border-[#333639] shadow-sm">
                                        <h4 className="font-medium text-[#A8C7FA] border-b border-[#333639] pb-2 mb-3 text-[11px] uppercase tracking-wider">PROFIT & LOSS BREAKDOWN</h4>
                                        <div className="overflow-x-auto rounded-lg border border-[#333639]">
                                            <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                                                <thead className="bg-[#1E1F22] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase">
                                                    <tr>
                                                        <th className="p-2.5 border-r border-[#333639] font-medium">PHASE</th>
                                                        <th className="p-2.5 border-r border-[#333639] font-medium text-right">REVENUE (IDR)</th>
                                                        <th className="p-2.5 border-r border-[#333639] font-medium text-right">COGS (IDR)</th>
                                                        <th className="p-2.5 border-r border-[#333639] font-medium text-[#6DD58C] text-right">PROFIT (IDR)</th>
                                                        <th className="p-2.5 font-medium text-[#7FCFFF] text-right">MARGIN (%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-b border-[#333639] hover:bg-[#1E1F22] transition-colors">
                                                        <td className="p-2.5 border-r border-[#333639] font-medium text-[#E3E3E3]">1. REMUNERATION</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right text-[#C4C7C5]">{pl.remRev.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right font-medium text-[#FFBCA6]">{pl.remCogs.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right font-bold text-[#6DD58C]">{pl.remProfit.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 text-right font-bold text-[#7FCFFF]">{pl.remRev > 0 ? ((pl.remProfit/pl.remRev)*100).toFixed(2) : 0}%</td>
                                                    </tr>
                                                    <tr className="border-b border-[#333639] hover:bg-[#1E1F22] transition-colors">
                                                        <td className="p-2.5 border-r border-[#333639] font-medium text-[#E3E3E3]">2. OPERATIONS</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right text-[#C4C7C5]">{pl.opsRev.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right font-medium text-[#FFBCA6]">{pl.opsCogs.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right font-bold text-[#6DD58C]">{pl.opsProfit.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 text-right font-bold text-[#7FCFFF]">{pl.opsRev > 0 ? ((pl.opsProfit/pl.opsRev)*100).toFixed(2) : 0}%</td>
                                                    </tr>
                                                    <tr className="bg-[#1E1F22]">
                                                        <td className="p-2.5 border-r border-[#333639] font-medium text-[#E3E3E3]">3. MEMBERSHIP (FEE)</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right text-[#C4C7C5]">{pl.memRev.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right font-medium text-[#FFBCA6]">{pl.memCogs.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 border-r border-[#333639] text-right font-bold text-[#6DD58C]">{pl.memProfit.toLocaleString('id-ID')}</td>
                                                        <td className="p-2.5 text-right font-bold text-[#7FCFFF]">{pl.memRev > 0 ? 100 : 0}%</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </form>
                        
                        {/* WIZARD NAVIGATION FOOTER */}
                        <div className="px-5 py-3 border-t border-[#333639] bg-[#1E1F22] flex justify-between items-center rounded-b-[16px] shrink-0">
                            
                            {currentStep === 1 ? (
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 text-[11px] font-medium text-[#E3E3E3] bg-transparent hover:bg-[#333639] rounded-full transition-colors uppercase">CANCEL</button>
                            ) : (
                                <button type="button" onClick={handlePrev} className="px-4 py-1.5 text-[11px] font-medium text-[#E3E3E3] bg-[#333639] hover:bg-[#444746] rounded-full transition-colors flex items-center uppercase">
                                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> BACK
                                </button>
                            )}
                            
                            <div className="flex space-x-3 items-center">
                                {currentStep < 5 ? (
                                    <button type="button" onClick={handleNext} className="px-5 py-1.5 text-[11px] font-semibold text-[#072711] bg-[#C4EED0] hover:bg-[#93D7A6] rounded-full transition-colors flex items-center uppercase">
                                        NEXT STEP <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </button>
                                ) : (
                                    <button type="submit" form="projectForm" disabled={submitting} className="px-5 py-1.5 text-[11px] font-semibold text-[#072711] bg-[#C4EED0] hover:bg-[#93D7A6] rounded-full transition-colors disabled:opacity-50 uppercase">
                                        {submitting ? 'SAVING...' : 'SIMPAN SEBAGAI DRAFT'}
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* --- MODAL WIZARD COMMITMENT FEE --- */}
            {isFeeModalOpen && selectedProjForFee && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-5 py-3 border-b border-[#333639] bg-[#1E1F22] flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-semibold text-[#E3E3E3] tracking-wide uppercase">COMMITMENT FEE - {selectedProjForFee.project_id}</h3>
                                <p className="text-[10px] text-[#8E918F] mt-0.5 uppercase">KLIEN: {selectedProjForFee.company_name}</p>
                            </div>
                            <button onClick={() => setIsFeeModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] hover:bg-[#333639] p-1 rounded-full transition-colors"><XCircle className="w-5 h-5"/></button>
                        </div>
                        <div className="p-5 flex-1 bg-[#131314] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-medium text-[#A8C7FA] text-[11px] uppercase tracking-wider">INVOICE LIST</h4>
                                <button type="button" onClick={addFeeRow} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-3 py-1.5 rounded-full flex items-center transition-colors"><Plus className="w-3 h-3 mr-1"/> ADD INVOICE</button>
                            </div>
                            <div className="space-y-4">
                                {feeList.length === 0 && <p className="text-[11px] text-[#8E918F] italic text-center py-4 border border-[#333639] border-dashed rounded-xl">Belum ada Commitment Fee untuk project ini.</p>}
                                {feeList.map((fee, idx) => {
                                    const amount = parseFloat(fee.amount) || 0;
                                    const ppn = amount * 0.11;
                                    const isPublished = fee.status === 'PUBLISHED';
                                    return (
                                        <div key={fee.id} className="bg-[#1E1F22] border border-[#333639] rounded-xl p-4 relative">
                                            {isPublished && <div className="absolute top-4 right-4 bg-[#0F5223]/20 border border-[#0F5223]/50 text-[#6DD58C] px-2 py-0.5 rounded text-[9px] font-bold tracking-wide">PUBLISHED</div>}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">KETERANGAN</label>
                                                    <input type="text" disabled={isPublished} value={fee.description} onChange={(e) => updateFeeRow(idx, 'description', e.target.value)} placeholder="E.G. COMMITMENT FEE TAHUN KE-1" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none disabled:opacity-50 transition-all uppercase" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">TANGGAL INVOICE</label>
                                                        <input type="date" disabled={isPublished} value={fee.date} onChange={(e) => updateFeeRow(idx, 'date', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none disabled:opacity-50 transition-all uppercase" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">REKENING PENERIMA</label>
                                                        <select disabled={isPublished} value={fee.bank_account} onChange={(e) => updateFeeRow(idx, 'bank_account', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none disabled:opacity-50 transition-all uppercase">
                                                            <option value="">- PILIH REKENING -</option>
                                                            {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                                            {fee.bank_account && !bankOptions.includes(fee.bank_account) && <option value={fee.bank_account}>{fee.bank_account}</option>}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">JUMLAH (Rp)</label>
                                                    <input type="number" disabled={isPublished} min="0" value={fee.amount} onChange={(e) => updateFeeRow(idx, 'amount', e.target.value)} placeholder="1000000" className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#A8C7FA] font-bold focus:border-[#A8C7FA] outline-none disabled:opacity-50 transition-all uppercase" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">PPN 11% (AUTO)</label>
                                                    <input type="text" disabled value={ppn.toLocaleString('id-ID')} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#8E918F] font-bold outline-none opacity-70" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">GRAND TOTAL</label>
                                                    <input type="text" disabled value={(amount + ppn).toLocaleString('id-ID')} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#0F5223]/20 text-[#6DD58C] font-bold outline-none" />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex justify-between items-center border-t border-[#333639] pt-3">
                                                <button type="button" onClick={() => removeFeeRow(idx)} disabled={isPublished} className="text-[#FFB4AB] hover:text-[#8C1D18] flex items-center text-[10px] font-medium uppercase disabled:opacity-50 transition-colors"><Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus</button>
                                                {!isPublished && (
                                                    <button type="button" onClick={() => publishAndDownloadFee(idx)} disabled={submitting} className="bg-[#004A77] hover:bg-[#7FCFFF]/20 text-[#7FCFFF] px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center">
                                                        TERBITKAN & DOWNLOAD INVOICE <FileDown className="w-3.5 h-3.5 ml-1.5"/>
                                                    </button>
                                                )}
                                                {isPublished && (
                                                    <button type="button" onClick={() => publishAndDownloadFee(idx)} disabled={submitting} className="bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center">
                                                        DOWNLOAD INVOICE <FileDown className="w-3.5 h-3.5 ml-1.5"/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-[#333639] bg-[#1E1F22] flex justify-end items-center rounded-b-[16px] shrink-0">
                            <button type="button" onClick={saveFeeDrafts} disabled={submitting} className="bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] px-5 py-1.5 rounded-full text-[11px] font-bold uppercase transition-colors">
                                {submitting ? 'MENYIMPAN...' : 'SIMPAN SEBAGAI DRAFT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}