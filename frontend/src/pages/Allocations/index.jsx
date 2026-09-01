import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Search, Plus, CheckCircle, Clock, XCircle, ChevronDown, Package, Mail, User, FileDown, Receipt, Truck } from 'lucide-react';
import { jsPDF } from 'jspdf'; 

export default function Allocations() {
    const [allocations, setAllocations] = useState([]);
    const [prs, setPrs] = useState([]);
    const [projects, setProjects] = useState([]); 
    const [masterItems, setMasterItems] = useState([]);
    const [deliveryMethods, setDeliveryMethods] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('DELIVERY_HISTORY');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [receiptToPrint, setReceiptToPrint] = useState(null); 
    const [isPrDropdownOpen, setIsPrDropdownOpen] = useState(false);
    const [prSearchTerm, setPrSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const initialFormState = {
        pr_id: '', project_id: '', allocation_date: new Date().toISOString().split('T')[0],
        recipient_name: '', recipient_email: '', 
        delivery_method: '', tracking_number: '', 
        items: [], remarks: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [allocRes, prRes, itemRes, projRes, lookupsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/allocations').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/purchase-requests').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/items').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/projects').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/lookups').catch(() => ({ data: { data: { deliveryMethods: [] } } }))
            ]);
            setAllocations(allocRes?.data?.data || []);
            setPrs(Array.isArray(prRes?.data?.data) ? [...prRes.data.data].reverse() : []);
            setMasterItems(itemRes?.data?.data || []);
            setProjects(Array.isArray(projRes?.data?.data) ? projRes.data.data : []);
            setDeliveryMethods(lookupsRes?.data?.data?.deliveryMethods || []);
        } catch (err) {} finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);
    
    useEffect(() => {
        const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsPrDropdownOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape' && isModalOpen) setIsModalOpen(false); };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isModalOpen]);

    const availablePRs = prs.filter(pr => ['OPEN FULL', 'OPEN PARTIAL', 'OVER'].includes(pr.status));
    const filteredPROptions = availablePRs.filter(pr => (pr.pr_id || '').toLowerCase().includes(prSearchTerm.toLowerCase()) || (pr.project_id || '').toLowerCase().includes(prSearchTerm.toLowerCase()));

    // =========================================================================
    // KUNCI PERBAIKAN: PARSER JSON SUPER AMAN (ANTI-0)
    // =========================================================================
    const handlePRSelect = (selectedPR) => {
        setIsPrDropdownOpen(false); setPrSearchTerm('');
        if (!selectedPR) return;
        
        const prAllocations = allocations.filter(a => a.pr_id === selectedPR.pr_id);
        const sentPool = {};
        
        // 1. Ekstrak data pengiriman masa lalu (Allocations) dengan paksa
        prAllocations.forEach(a => {
            if (a.status !== 'REJECTED' && a.status !== 'REJECT FULL') {
                let aItems = [];
                try {
                    let rawAlloc = a.allocated_items || a.items;
                    if (typeof rawAlloc === 'string') rawAlloc = JSON.parse(rawAlloc);
                    if (typeof rawAlloc === 'string') rawAlloc = JSON.parse(rawAlloc); // Jaga-jaga double stringify
                    if (Array.isArray(rawAlloc)) {
                        aItems = rawAlloc.map(i => typeof i === 'string' ? JSON.parse(i) : i);
                    }
                } catch(e) {}
                
                aItems.forEach(ai => {
                    let id = ai.item_id || ai.id;
                    if (id) {
                        if (!sentPool[id]) sentPool[id] = 0;
                        sentPool[id] += (parseInt(ai.alloc_qty) || parseInt(ai.allocated_qty) || parseInt(ai.qty) || 0);
                    }
                });
            }
        });

        // 2. Ekstrak data dari Purchase Request dengan paksa
        let reqItems = [];
        try {
            let rawItems = selectedPR.requested_items || selectedPR.items;
            if (typeof rawItems === 'string') rawItems = JSON.parse(rawItems);
            if (typeof rawItems === 'string') rawItems = JSON.parse(rawItems); // Jaga-jaga double stringify
            if (Array.isArray(rawItems)) {
                reqItems = rawItems.map(i => typeof i === 'string' ? JSON.parse(i) : i);
            }
        } catch(e) {}

        // 3. Mapping data dan menghilangkan item REJECT
        const mappedItems = reqItems
            .filter(r => r && r.line_status !== 'REJECT FULL' && r.line_status !== 'REJECTED')
            .map(reqItem => {
                const mItem = masterItems.find(m => m.item_id === reqItem.item_id);
                // Pastikan nama selalu terbaca
                const itemName = mItem ? mItem.item_name : (reqItem.name || reqItem.item_id || 'UNKNOWN ITEM');
                
                // MENDETEKSI ANGKA SUPER AKURAT (req_qty / qty / pr_qty)
                let reqQty = parseInt(reqItem.req_qty);
                if (isNaN(reqQty)) reqQty = parseInt(reqItem.qty);
                if (isNaN(reqQty)) reqQty = parseInt(reqItem.pr_qty);
                if (isNaN(reqQty)) reqQty = 0;
                
                let availableSent = sentPool[reqItem.item_id] || 0;
                let appliedToThisLine = 0;
                
                // Distribusikan barang yang sudah dikirim ke line item ini
                if (availableSent >= reqQty) { 
                    appliedToThisLine = reqQty; 
                    sentPool[reqItem.item_id] -= reqQty; 
                } else { 
                    appliedToThisLine = availableSent; 
                    sentPool[reqItem.item_id] = 0; 
                }
                
                const remaining = Math.max(0, reqQty - appliedToThisLine);
                
                return {
                    item_id: reqItem.item_id, 
                    name: itemName, 
                    specs: reqItem.line_notes || reqItem.specs || '-',
                    pr_qty: reqQty, 
                    sent_previously: appliedToThisLine,
                    remaining_qty: remaining, 
                    alloc_qty: '', 
                    new_status: remaining === 0 ? 'CLOSE FULL' : 'OPEN FULL' 
                };
            });
            
        setFormData({ ...initialFormState, pr_id: selectedPR.pr_id, project_id: selectedPR.project_id, items: mappedItems });
    };

    const handleQtyChange = (index, val) => {
        let newQty = val === '' ? '' : parseInt(val);
        if (isNaN(newQty)) newQty = '';
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = newItems[index];
            if (newQty !== '' && newQty > item.remaining_qty) newQty = item.remaining_qty;
            item.alloc_qty = newQty;
            const numericQty = newQty === '' ? 0 : newQty;
            const totalSent = item.sent_previously + numericQty;
            if (totalSent >= item.pr_qty) item.new_status = 'CLOSE FULL';
            else if (totalSent > 0) item.new_status = 'OPEN PARTIAL';
            else item.new_status = 'OPEN FULL';
            return { ...prev, items: newItems };
        });
    };

    const handleSubmit = async (action) => {
        setSubmitting(true);
        try {
            const payload = { ...formData, action };
            if (action === 'ALLOCATE') {
                const validItems = formData.items.filter(i => (parseInt(i.alloc_qty) || 0) > 0).map(i => ({ ...i, alloc_qty: parseInt(i.alloc_qty) || 0 }));
                if (validItems.length === 0) { alert("ISI MINIMAL 1 BARANG!"); setSubmitting(false); return; }
                if (!formData.recipient_name || !formData.recipient_email) { alert("LENGKAPI NAMA & EMAIL PENERIMA!"); setSubmitting(false); return; }
                
                if (!formData.delivery_method) { alert("PILIH METODE PENGIRIMAN TERLEBIH DAHULU!"); setSubmitting(false); return; }
                if (formData.delivery_method !== 'LANGSUNG' && !formData.tracking_number) { alert(`NOMOR RESI WAJIB DIISI UNTUK METODE PENGIRIMAN ${formData.delivery_method}!`); setSubmitting(false); return; }

                payload.items = JSON.stringify(validItems);
            }
            await axios.post('http://localhost:5000/api/allocations', payload);
            setIsModalOpen(false); fetchData();
        } catch (err) { alert(`GAGAL!\n${err.message}`); } finally { setSubmitting(false); }
    };

    const handleDownloadPDF = async (alloc) => {
        setReceiptToPrint(alloc);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            
            const img = new Image();
            img.src = '/logo.png';
            
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; 
            });

            if (img.width !== 0) {
                const imgWidth = 45; 
                const imgHeight = (img.height * imgWidth) / img.width;
                doc.addImage(img, 'PNG', 20, 15, imgWidth, imgHeight);
            } else {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.setTextColor(41, 91, 167);
                doc.text("CITY SERVICE", 20, 25);
            }

            doc.setFont("helvetica", "bold"); 
            doc.setFontSize(22); 
            doc.setTextColor(41, 91, 167); 
            doc.text("DELIVERY RECEIPT", pageWidth - 20, 28, { align: "right" });
            
            doc.setDrawColor(218, 220, 224); 
            doc.setLineWidth(0.3); 
            doc.line(20, 40, pageWidth - 20, 40);
            
            const proj = projects.find(p => p.project_id === alloc.project_id);
            const projName = proj ? proj.project_name : alloc.project_id;
            const compName = proj ? proj.company_name : '-';

            doc.setFontSize(9); doc.setTextColor(128, 134, 139);
            doc.text("DELIVERY ID", 20, 50); 
            doc.text("DATE", 65, 50); 
            doc.text("PR SOURCE", 110, 50); 
            
            doc.setTextColor(32, 33, 36); doc.setFont("helvetica", "bold"); 
            doc.text((alloc.allocation_id || "-").toUpperCase(), 20, 55);
            doc.text((alloc.allocation_date || "-").toUpperCase(), 65, 55);
            doc.text((alloc.pr_id || "-").toUpperCase(), 110, 55);
            
            doc.setFont("helvetica", "normal"); doc.setTextColor(128, 134, 139);
            doc.text("METHOD", 20, 65); 
            doc.text("TRACKING NO.", 65, 65); 
            
            doc.setTextColor(32, 33, 36); doc.setFont("helvetica", "bold"); 
            doc.text((alloc.delivery_method || "LANGSUNG").toUpperCase(), 20, 70);
            doc.text((alloc.tracking_number || "-").toUpperCase(), 65, 70);

            doc.setFont("helvetica", "normal"); doc.setTextColor(128, 134, 139);
            doc.text("RECIPIENT", pageWidth - 20, 50, { align: "right" });
            doc.setTextColor(32, 33, 36); doc.setFont("helvetica", "bold"); 
            doc.text((alloc.recipient_name || "-").toUpperCase(), pageWidth - 20, 55, { align: "right" });
            doc.setFont("helvetica", "normal"); doc.setTextColor(128, 134, 139); 
            doc.text((alloc.recipient_email || "-").toUpperCase(), pageWidth - 20, 60, { align: "right" }); 
            
            doc.setTextColor(32, 33, 36); doc.setFont("helvetica", "bold");
            doc.text(projName.toUpperCase(), pageWidth - 20, 70, { align: "right" });
            doc.setFont("helvetica", "normal"); doc.setTextColor(128, 134, 139);
            doc.text(compName.toUpperCase(), pageWidth - 20, 75, { align: "right" });
            
            let startY = 85; 
            doc.setFillColor(241, 243, 244); 
            doc.rect(20, startY, pageWidth - 40, 8, 'F');
            doc.setTextColor(95, 99, 104); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
            doc.text("ITEM DESCRIPTION", 25, startY + 5.5); 
            doc.text("QTY", pageWidth - 25, startY + 5.5, { align: "right" });
            
            startY += 8; doc.setFontSize(9);
            
            let aItems = [];
            try { 
                if (typeof alloc.allocated_items === 'string') {
                    aItems = JSON.parse(alloc.allocated_items);
                    if (typeof aItems === 'string') aItems = JSON.parse(aItems);
                } else if (Array.isArray(alloc.allocated_items)) {
                    aItems = alloc.allocated_items;
                }
            } catch(e){}
            
            aItems.forEach((it, index) => {
                const mItem = masterItems.find(m => m.item_id === it.item_id); 
                const itemName = mItem ? mItem.item_name : (it.name || it.item_id || 'UNKNOWN ITEM');
                const uom = mItem ? mItem.unit : 'PCS'; 
                
                if (index % 2 !== 0) { doc.setFillColor(250, 250, 250); doc.rect(20, startY, pageWidth - 40, 8, 'F'); }
                doc.setTextColor(32, 33, 36); doc.setFont("helvetica", "normal"); 
                doc.text(itemName.toUpperCase(), 25, startY + 5.5);
                
                doc.setFont("helvetica", "bold"); 
                const qtyVal = parseInt(it.alloc_qty) || parseInt(it.allocated_qty) || parseInt(it.qty) || 0;
                doc.text(`${qtyVal} ${uom}`.toUpperCase(), pageWidth - 25, startY + 5.5, { align: "right" });
                startY += 8;
            });
            
            doc.setDrawColor(218, 220, 224); doc.line(20, startY + 5, pageWidth - 20, startY + 5);
            
            startY += 20; 
            const leftCenter = pageWidth / 4 + 10; 
            const rightCenter = (pageWidth * 3) / 4 - 10;
            
            doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(128, 134, 139); 
            doc.text("PHOTO PROOF", leftCenter, startY, { align: "center" });
            if (alloc.receipt_data?.photo) { 
                try { doc.addImage(alloc.receipt_data.photo, 'JPEG', leftCenter - 25, startY + 5, 50, 38); } catch(e) {} 
            } else { 
                doc.setDrawColor(218, 220, 224); doc.rect(leftCenter - 25, startY + 5, 50, 38); doc.text("NO PHOTO", leftCenter, startY + 25, { align: "center" }); 
            }
            
            doc.text("AUTHORIZED SIGNATURE", rightCenter, startY, { align: "center" });
            if (alloc.receipt_data?.signature) { 
                try { doc.addImage(alloc.receipt_data.signature, 'JPEG', rightCenter - 25, startY + 5, 50, 25); } catch(e) { 
                    try { doc.addImage(alloc.receipt_data.signature, 'PNG', rightCenter - 25, startY + 5, 50, 25); } catch(err) {} 
                } 
            } else { 
                doc.setDrawColor(218, 220, 224); doc.rect(rightCenter - 25, startY + 5, 50, 25); 
            }
            
            doc.setFontSize(9); doc.setTextColor(32, 33, 36); 
            doc.text((alloc.recipient_name || "-").toUpperCase(), rightCenter, startY + 38, { align: "center" });
            doc.setFontSize(7); doc.setTextColor(128, 134, 139); doc.setFont("helvetica", "normal");
            
            let dateStr = alloc.receipt_data?.date ? new Date(alloc.receipt_data.date).toLocaleString('id-ID') : "-";
            doc.text(dateStr.toUpperCase(), rightCenter, startY + 43, { align: "center" });
            
            doc.save(`Delivery_Receipt_${alloc.allocation_id}.pdf`);
        } catch (error) { 
            console.error(error);
            alert("GAGAL MENGUNDUH PDF!"); 
        } finally {
            setReceiptToPrint(null);
        }
    };

    const getStatusStyle = (status) => {
        if (status === 'CLOSE FULL') return 'bg-[#0F5223] text-[#6DD58C] border-[#0F5223]';
        if (status === 'CLOSE PARTIAL') return 'bg-[#005353] text-[#56D6D6] border-[#005353]';
        if (status === 'OPEN FULL') return 'bg-[#004A77] text-[#7FCFFF] border-[#004A77]';
        if (status === 'OPEN PARTIAL') return 'bg-[#5C3F00] text-[#FFBCA6] border-[#5C3F00]';
        if (status === 'REJECT FULL') return 'bg-[#8C1D18] text-[#FFB4AB] border-[#8C1D18]';
        if (status === 'REJECT PARTIAL') return 'bg-[#680014] text-[#FFB3B6] border-[#680014]';
        if (status === 'OVER') return 'bg-[#8C1D18] text-[#FFB4AB] border-[#8C1D18]';
        return 'bg-[#333639] text-[#E3E3E3] border-[#333639]'; 
    };

    const filteredAllocations = allocations.filter(a => (a.allocation_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (a.pr_id || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredPendingPRs = availablePRs.filter(pr => (pr.pr_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (pr.project_id || '').toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading && allocations.length === 0) return <div className="text-[#C4C7C5] text-xs p-4 uppercase">SYNCING DATA...</div>;

    return (
        <div className="relative space-y-4 w-full mx-auto font-sans antialiased text-[#E3E3E3]">
            <div className="bg-[#1E1F22] rounded-[16px] border border-[#333639] overflow-hidden shadow-sm">
                
                <div className="px-5 py-2 border-b border-[#333639] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1E1F22] space-y-2 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-[#E3E3E3] tracking-wide uppercase">OUTBOUND DELIVERIES</h2>
                        <p className="text-[10px] text-[#8E918F] mt-0.5 uppercase">{activeTab === 'DELIVERY_HISTORY' ? `${filteredAllocations.length} RECORDS PROCESSED` : `${filteredPendingPRs.length} PRS READY TO SHIP`}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-56">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-[#8E918F]" /></div>
                            <input type="text" placeholder="SEARCH REFERENCES..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1 border border-[#333639] rounded-full bg-[#131314] text-[#E3E3E3] text-[11px] focus:outline-none focus:border-[#A8C7FA] transition-all uppercase" />
                        </div>
                        <button onClick={async () => { 
                            setFormData(initialFormState); 
                            setIsModalOpen(true); 
                            await fetchData(); // Sinkronisasi sebelum buka modal
                        }} className="w-full sm:w-auto flex items-center justify-center bg-[#A8C7FA] hover:bg-[#D3E3FD] text-[#062E6F] text-[11px] font-semibold px-4 py-1 rounded-full transition-colors uppercase">
                            <Package className="w-3.5 h-3.5 mr-1.5" /> PROCESS DELIVERY
                        </button>
                    </div>
                </div>

                <div className="px-5 py-1 flex space-x-2 bg-[#1E1F22] border-b border-[#333639]">
                    <button onClick={() => setActiveTab('DELIVERY_HISTORY')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center uppercase ${activeTab === 'DELIVERY_HISTORY' ? 'bg-[#D3E3FD] text-[#062E6F]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Receipt className="w-3.5 h-3.5 mr-1.5"/> DELIVERY HISTORY
                    </button>
                    <button onClick={() => setActiveTab('PENDING_DELIVERIES')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center uppercase ${activeTab === 'PENDING_DELIVERIES' ? 'bg-[#C4EED0] text-[#072711]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Truck className="w-3.5 h-3.5 mr-1.5"/> PENDING TO DELIVER
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'DELIVERY_HISTORY' ? (
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                                <tr>
                                    <th className="px-4 py-1.5 font-medium w-28">DELIVERY ID</th>
                                    <th className="px-4 py-1.5 font-medium w-28">DATE</th>
                                    <th className="px-4 py-1.5 font-medium w-36">PR SOURCE</th>
                                    <th className="px-4 py-1.5 font-medium min-w-[200px]">PROJECT & RECIPIENT</th>
                                    <th className="px-4 py-1.5 font-medium w-28 text-center">STATUS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333639] text-[11px]">
                                {filteredAllocations.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-[#8E918F] uppercase">NO RECORDS FOUND.</td></tr>}
                                {filteredAllocations.map((alloc, idx) => {
                                    const proj = projects.find(p => p.project_id === alloc.project_id);
                                    return(
                                    <tr key={idx} className="hover:bg-[#333639]/30 transition-colors uppercase">
                                        <td className="px-4 py-1 font-medium text-[#E3E3E3]">{alloc.allocation_id}</td>
                                        <td className="px-4 py-1 text-[#C4C7C5]">{alloc.allocation_date}</td>
                                        <td className="px-4 py-1 font-medium text-[#A8C7FA]">{alloc.pr_id}</td>
                                        <td className="px-4 py-1">
                                            <div className="text-[#E3E3E3] truncate max-w-[250px]">{proj ? `${proj.project_name}` : alloc.project_id} - {alloc.recipient_name || '-'}</div>
                                            <div className="text-[9px] text-[#8E918F] mt-0.5 truncate max-w-[250px]">{proj ? proj.company_name : '-'}</div>
                                        </td>
                                        <td className="px-4 py-1 text-center">
                                            {alloc.status === 'RECEIVED' ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <span className="bg-[#0F5223] text-[#6DD58C] px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide">RECEIVED</span>
                                                    <button onClick={() => handleDownloadPDF(alloc)} title="Download PDF" className="bg-[#333639] hover:bg-[#A8C7FA] hover:text-[#062E6F] text-[#C4C7C5] p-1.5 rounded-full"><FileDown className="w-3.5 h-3.5" /></button>
                                                </div>
                                            ) : alloc.status === 'REJECTED' ? (
                                                <span className="bg-[#8C1D18] text-[#FFB4AB] px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide">REJECTED</span>
                                            ) : (
                                                <span className="bg-[#004A77] text-[#7FCFFF] px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide animate-pulse">IN TRANSIT</span>
                                            )}
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                                <tr>
                                    <th className="px-4 py-1.5 font-medium w-28">PR ID</th>
                                    <th className="px-4 py-1.5 font-medium w-28">DATE</th>
                                    <th className="px-4 py-1.5 font-medium min-w-[200px]">PROJECT</th>
                                    <th className="px-4 py-1.5 font-medium w-28 text-center">STATUS</th>
                                    <th className="px-4 py-1.5 font-medium w-24 text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333639] text-[11px]">
                                {filteredPendingPRs.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-[#8E918F] uppercase">NO PENDING ITEMS TO DELIVER.</td></tr>}
                                {filteredPendingPRs.map((pr, idx) => {
                                    const proj = projects.find(p => p.project_id === pr.project_id);
                                    return(
                                    <tr key={idx} className="hover:bg-[#333639]/30 transition-colors uppercase">
                                        <td className="px-4 py-1 font-medium text-[#E3E3E3]">{pr.pr_id}</td>
                                        <td className="px-4 py-1 text-[#C4C7C5]">{pr.request_date}</td>
                                        <td className="px-4 py-1">
                                            <div className="font-medium text-[#A8C7FA] truncate max-w-[250px]">{proj ? proj.project_name : pr.project_id}</div>
                                            <div className="text-[9px] text-[#8E918F] truncate max-w-[250px]">{proj ? proj.company_name : '-'}</div>
                                        </td>
                                        <td className="px-4 py-1 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border ${getStatusStyle(pr.status)}`}>{pr.status}</span>
                                        </td>
                                        <td className="px-4 py-1 text-center">
                                            <button onClick={async () => { 
                                                setFormData(initialFormState); 
                                                setPrSearchTerm(''); 
                                                setIsModalOpen(true); 
                                                await fetchData(); // Sinkronisasi sebelum load PR
                                                handlePRSelect(pr); 
                                            }} className="text-[#072711] font-medium text-[10px] bg-[#C4EED0] hover:bg-[#93D7A6] px-3 py-1 rounded-full transition-colors uppercase">DELIVER</button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* MODAL PENGIRIMAN */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                        <div className="px-4 py-2.5 border-b border-[#333639] bg-[#1E1F22] flex justify-between items-center rounded-t-[16px]">
                            <div>
                                <h3 className="text-sm font-semibold text-[#E3E3E3] uppercase">PROCESS OUTBOUND DELIVERY</h3>
                                <p className="text-[10px] text-[#8E918F] mt-0.5 uppercase">ALLOCATE ITEMS AND DISPATCH E-RECEIPTS</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] p-1 rounded-full hover:bg-[#333639]"><XCircle className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#131314] custom-scrollbar">
                            <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative" ref={dropdownRef}>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">SELECT OPEN PR *</label>
                                        <div onClick={() => setIsPrDropdownOpen(!isPrDropdownOpen)} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] flex justify-between items-center cursor-pointer uppercase">
                                            <span className="truncate">{formData.pr_id ? `${formData.pr_id} (PROJECT: ${formData.project_id})` : 'SEARCH & SELECT PR...'}</span>
                                            <ChevronDown className="w-3.5 h-3.5 text-[#8E918F]" />
                                        </div>
                                        {isPrDropdownOpen && (
                                            <div className="absolute top-full left-0 w-full mt-1 bg-[#1E1F22] border border-[#333639] rounded-lg shadow-xl z-10 overflow-hidden">
                                                <div className="p-1.5 border-b border-[#333639] relative">
                                                    <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-[#8E918F]" />
                                                    <input type="text" autoFocus placeholder="TYPE PR ID..." value={prSearchTerm} onChange={(e) => setPrSearchTerm(e.target.value.toUpperCase())} className="w-full bg-[#131314] border border-[#333639] rounded-md text-[11px] text-[#E3E3E3] pl-8 pr-3 py-1 focus:border-[#A8C7FA] outline-none uppercase" />
                                                </div>
                                                <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                                                    {filteredPROptions.map(pr => (
                                                        <div key={pr.pr_id} onClick={() => handlePRSelect(pr)} className="px-2.5 py-1.5 text-[11px] text-[#C4C7C5] hover:bg-[#333639] hover:text-[#E3E3E3] cursor-pointer rounded-md uppercase">
                                                            <span className="font-medium text-[#A8C7FA]">{pr.pr_id}</span> &bull; {pr.project_id}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">DISPATCH DATE</label>
                                        <input type="date" value={formData.allocation_date} onChange={(e) => setFormData({...formData, allocation_date: e.target.value})} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none uppercase" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 mt-3 border-t border-[#333639]">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">RECIPIENT NAME *</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2 w-3.5 h-3.5 text-[#8E918F]" />
                                            <input type="text" placeholder="BUDI SANTOSO" value={formData.recipient_name} onChange={(e) => setFormData({...formData, recipient_name: e.target.value.toUpperCase()})} className="w-full border border-[#333639] rounded-lg pl-8 pr-3 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none focus:border-[#A8C7FA] uppercase" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">RECIPIENT EMAIL *</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2 w-3.5 h-3.5 text-[#8E918F]" />
                                            <input type="email" placeholder="BUDI@CLIENT.COM" value={formData.recipient_email} onChange={(e) => setFormData({...formData, recipient_email: e.target.value.toUpperCase()})} className="w-full border border-[#333639] rounded-lg pl-8 pr-3 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none focus:border-[#A8C7FA] uppercase" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 pt-3 mt-3 border-t border-[#333639]">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">DELIVERY METHOD *</label>
                                        <select 
                                            name="delivery_method" 
                                            value={formData.delivery_method || ''} 
                                            onChange={(e) => setFormData({...formData, delivery_method: e.target.value.toUpperCase()})} 
                                            className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none focus:border-[#A8C7FA] uppercase"
                                        >
                                            <option value="">-- SELECT METHOD --</option>
                                            {deliveryMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                            {!deliveryMethods.includes('LANGSUNG') && <option value="LANGSUNG">LANGSUNG</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">
                                            TRACKING / RECEIPT NO. {formData.delivery_method !== 'LANGSUNG' && <span className="text-[#FFB4AB]">*</span>}
                                        </label>
                                        <input 
                                            type="text" 
                                            placeholder={formData.delivery_method === 'LANGSUNG' ? "NOT REQUIRED" : "E.G. JNE-123456789"} 
                                            value={formData.tracking_number || ''} 
                                            onChange={(e) => setFormData({...formData, tracking_number: e.target.value.toUpperCase()})} 
                                            disabled={formData.delivery_method === 'LANGSUNG'} 
                                            className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none focus:border-[#A8C7FA] disabled:opacity-50 uppercase" 
                                        />
                                    </div>
                                </div>

                            </div>

                            {formData.pr_id && (
                                <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-3">
                                    <h4 className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider mb-2">ALLOCATION ITEMS</h4>
                                    <div className="overflow-x-auto rounded-lg border border-[#333639]">
                                        <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                                            <thead className="bg-[#1E1F22] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-2.5 py-1.5 font-medium min-w-[150px]">ITEM DESCRIPTION</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-16">PR QTY</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-16">SENT</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-16">REMAIN</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center text-[#A8C7FA] w-24">DELIVER NOW *</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333639]">
                                                {formData.items.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-[#8E918F] uppercase">SEMUA BARANG SUDAH DIKIRIM ATAU DITOLAK.</td></tr>}
                                                {formData.items.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-[#333639]/20 transition-colors uppercase">
                                                        <td className="p-1.5 text-[#E3E3E3] pl-2.5">{item.name}</td>
                                                        <td className="p-1.5 text-center text-[#8E918F]">{item.pr_qty}</td>
                                                        <td className="p-1.5 text-center text-[#C4C7C5]">{item.sent_previously}</td>
                                                        <td className="p-1.5 text-center text-[#E3E3E3] font-medium">{item.remaining_qty}</td>
                                                        <td className="p-1.5">
                                                            <input 
                                                                type="number" min="0" max={item.remaining_qty} 
                                                                value={item.alloc_qty} placeholder={String(item.remaining_qty)}
                                                                onChange={(e) => handleQtyChange(idx, e.target.value)} 
                                                                className="w-full border border-[#333639] bg-[#1E1F22] text-[#A8C7FA] rounded-md px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none text-center font-bold placeholder-[#5F6368]" 
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="px-4 py-2.5 border-t border-[#333639] bg-[#1E1F22] flex justify-between items-center rounded-b-[16px]">
                            <div>
                                {formData.pr_id && (
                                    <button type="button" onClick={() => handleSubmit('REJECT')} disabled={submitting} className="text-[#FFB4AB] bg-[#8C1D18]/20 hover:bg-[#8C1D18]/40 text-[10px] font-medium px-3 py-1.5 rounded-full flex items-center uppercase">
                                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> REJECT PR
                                    </button>
                                )}
                            </div>
                            <div className="flex space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#E3E3E3] hover:bg-[#333639] text-[11px] font-medium px-3 py-1.5 rounded-full uppercase">CANCEL</button>
                                <button type="button" onClick={() => handleSubmit('ALLOCATE')} disabled={submitting || !formData.pr_id} className="bg-[#A8C7FA] hover:bg-[#D3E3FD] text-[#062E6F] text-[11px] font-semibold px-4 py-1.5 rounded-full disabled:opacity-50 uppercase">
                                    {submitting ? 'PROCESSING...' : 'CONFIRM & DISPATCH'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}