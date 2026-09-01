import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Search, Plus, CheckCircle, AlertTriangle, Clock, XCircle, ChevronDown, Trash2, Receipt, ClipboardList } from 'lucide-react';

export default function PurchaseRequests() {
    const [prs, setPrs] = useState([]);
    const [projects, setProjects] = useState([]);
    const [masterItems, setMasterItems] = useState([]);
    const [minusCategories, setMinusCategories] = useState([]); 
    const [allocations, setAllocations] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('PR_LIST'); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const initialFormState = { pr_id: '', project_id: '', project_name: '', request_date: new Date().toISOString().split('T')[0], requested_items: [], status: 'OPEN FULL', remarks: '' };
    const [formData, setFormData] = useState(initialFormState);
    const [entitlementData, setEntitlementData] = useState([]); 

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prRes, projRes, itemRes, lookupsRes, allocRes] = await Promise.all([
                axios.get('http://localhost:5000/api/purchase-requests').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/projects').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/items').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/lookups').catch(() => ({ data: { data: { minusCategories: [] } } })),
                axios.get('http://localhost:5000/api/allocations').catch(() => ({ data: { data: [] } }))
            ]);
            setPrs(Array.isArray(prRes?.data?.data) ? [...prRes.data.data].reverse() : []);
            setProjects(Array.isArray(projRes?.data?.data) ? projRes.data.data : []);
            setMasterItems(Array.isArray(itemRes?.data?.data) ? itemRes.data.data : []);
            setMinusCategories(lookupsRes?.data?.data?.minusCategories || []);
            setAllocations(Array.isArray(allocRes?.data?.data) ? allocRes.data.data : []);
        } catch (err) {} finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);
    
    useEffect(() => {
        if (isModalOpen && formData.project_id) {
            const calculatedEntitlements = getEntitlements(formData.project_id, formData.pr_id);
            setEntitlementData(calculatedEntitlements);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, prs, allocations]); 
    
    useEffect(() => {
        const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsProjectDropdownOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape' && isModalOpen) setIsModalOpen(false); };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isModalOpen]);

    const getEntitlements = (selectedProjectId, currentPrId = null) => {
        const project = projects.find(p => p?.project_id === selectedProjectId);
        if (!project) return [];
        let opsItems = { common_units: [], common_equipments: [], special_units: [], others: [] };
        let parsed = project?.operational_items;
        if (typeof parsed === 'string' && parsed.trim() !== '') { try { parsed = JSON.parse(parsed); } catch(err) {} }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) opsItems = { ...opsItems, ...parsed };

        let flatItemsMap = {};
        
        // KUNCI PERBAIKAN: Masukkan kembali special_units (Hanya exclude 'others')
        ['common_units', 'common_equipments', 'special_units'].forEach(cat => {
            if (Array.isArray(opsItems[cat])) {
                opsItems[cat].forEach(item => {
                    if (item && (item?.item_id || item?.item_name)) {
                        const mItem = masterItems.find(m => m.item_id === item.item_id);
                        const itemQty = parseInt(item?.qty) || 0;
                        
                        let isBundle = false;
                        let bDetails = [];
                        if (mItem) {
                            if (String(mItem.category_1).toUpperCase() === 'BUNDLE PACKAGE') {
                                isBundle = true;
                                try { bDetails = typeof mItem.bundle_details === 'string' ? JSON.parse(mItem.bundle_details) : (mItem.bundle_details || []); } catch(e) {}
                            } else if (mItem.bundle_details) {
                                try {
                                    const parsedDetails = typeof mItem.bundle_details === 'string' ? JSON.parse(mItem.bundle_details) : mItem.bundle_details;
                                    if (Array.isArray(parsedDetails) && parsedDetails.length > 0) {
                                        isBundle = true;
                                        bDetails = parsedDetails;
                                    }
                                } catch(e) {}
                            }
                        }

                        if (isBundle && Array.isArray(bDetails) && bDetails.length > 0) {
                            bDetails.forEach(b => {
                                const subIdStr = String(b.item_id);
                                const subQtyTotal = (parseInt(b.qty) || 1) * itemQty;
                                if (flatItemsMap[subIdStr]) flatItemsMap[subIdStr].project_qty += subQtyTotal;
                                else flatItemsMap[subIdStr] = { item_id: subIdStr, name: String(masterItems.find(m => m.item_id === b.item_id)?.item_name || b.item_id), project_qty: subQtyTotal };
                            });
                        } else {
                            const itemIdStr = String(item?.item_id || item?.item_name || 'UNKNOWN');
                            if (flatItemsMap[itemIdStr]) flatItemsMap[itemIdStr].project_qty += itemQty;
                            else flatItemsMap[itemIdStr] = { item_id: itemIdStr, name: String(mItem ? mItem.item_name : itemIdStr), project_qty: itemQty };
                        }
                    }
                });
            }
        });

        let flatItems = Object.values(flatItemsMap);
        const existingProjectPRs = prs.filter(pr => pr?.project_id === selectedProjectId && pr?.pr_id !== currentPrId);
        
        return flatItems.map(pItem => {
            let previouslyRequested = 0;
            existingProjectPRs.forEach(pr => {
                let reqItems = [];
                try {
                    if (typeof pr?.requested_items === 'string') reqItems = JSON.parse(pr.requested_items); 
                    else if (Array.isArray(pr?.requested_items)) reqItems = pr.requested_items;
                } catch(e) {}

                if (Array.isArray(reqItems)) {
                    reqItems.forEach(match => { 
                        if (match && String(match.item_id) === pItem.item_id) {
                            const matchStatus = match.line_status || match.status || 'OPEN FULL';
                            if (matchStatus !== 'REJECT FULL' && matchStatus !== 'REJECTED') {
                                const reqQty = parseInt(match.req_qty) || parseInt(match.required_qty) || parseInt(match.qty) || 0;
                                const prStatus = (pr.status || 'OPEN FULL').toUpperCase();
                                
                                if (prStatus.includes('OPEN') || prStatus === 'OVER' || prStatus === 'DRAFT') {
                                    previouslyRequested += reqQty;
                                } else {
                                    let allocatedQty = 0;
                                    allocations.forEach(al => {
                                        if (al.pr_id === pr.pr_id && al.status !== 'REJECTED') {
                                            let aItems = [];
                                            try { aItems = typeof al.allocated_items === 'string' ? JSON.parse(al.allocated_items) : (al.allocated_items || []); } catch(e) {}
                                            aItems.forEach(ai => {
                                                if (String(ai.item_id) === pItem.item_id) {
                                                    allocatedQty += (parseInt(ai.alloc_qty) || parseInt(ai.allocated_qty) || parseInt(ai.qty) || 0);
                                                }
                                            });
                                        }
                                    });
                                    previouslyRequested += allocatedQty;
                                }
                            }
                        }
                    });
                }
            });
            return { ...pItem, previously_requested: previouslyRequested };
        });
    };

    const handleProjectSelect = (selectedProject) => {
        setIsProjectDropdownOpen(false); setProjectSearchTerm('');
        if (!selectedProject || !selectedProject.project_id) { setFormData(prev => ({ ...prev, project_id: '', project_name: '', requested_items: [] })); setEntitlementData([]); return; }
        const calculatedEntitlements = getEntitlements(selectedProject.project_id, formData.pr_id);
        setEntitlementData(calculatedEntitlements);
        setFormData(prev => ({ ...prev, project_id: selectedProject.project_id, project_name: selectedProject.project_name, requested_items: [] }));
    };

    const addRequestLine = () => setFormData(prev => ({ ...prev, requested_items: [...prev.requested_items, { item_id: '', name: '', req_qty: 0, line_notes: '', line_status: 'OPEN FULL', minus_reason: '' }] }));
    const removeRequestLine = (index) => setFormData(prev => { const newItems = [...prev.requested_items]; newItems.splice(index, 1); return calculateStatusUpdate(newItems, prev); });

    const handleLineChange = (index, field, val) => {
        setFormData(prev => {
            const newItems = [...(prev.requested_items || [])];
            if (!newItems[index]) return prev;
            const item = newItems[index];
            if (field === 'item_id') {
                const ent = entitlementData.find(e => e.item_id === val);
                item.item_id = val; item.name = ent ? ent.name : ''; item.req_qty = 0; item.minus_reason = ''; 
            } else if (field === 'req_qty') { item.req_qty = parseInt(val) || 0; } 
            else if (field === 'line_notes') { item.line_notes = val.toUpperCase(); } 
            else if (field === 'minus_reason') { item.minus_reason = val.toUpperCase(); }
            return calculateStatusUpdate(newItems, prev);
        });
    };

    const calculateStatusUpdate = (newItems, prevState) => {
        const currentAgg = {};
        newItems.forEach(i => { 
            if (i.item_id && i.line_status !== 'REJECT FULL' && i.line_status !== 'REJECTED') {
                currentAgg[i.item_id] = (currentAgg[i.item_id] || 0) + (parseInt(i.req_qty) || 0); 
            }
        });
        
        let hasOver = false;
        newItems.forEach(i => {
            if (i.item_id) {
                if (i.line_status === 'REJECT FULL' || i.line_status === 'REJECTED') return;

                const ent = entitlementData.find(e => e.item_id === i.item_id);
                if (ent) {
                    const remaining = ent.project_qty - ent.previously_requested - currentAgg[i.item_id];
                    if (remaining < 0) { i.line_status = 'OVER'; hasOver = true; }
                    else { i.line_status = 'OPEN FULL'; i.minus_reason = ''; }
                }
            }
        });
        
        const newStatus = hasOver ? 'OVER' : (prevState.status.includes('REJECT') ? prevState.status : 'OPEN FULL');

        return { ...prevState, requested_items: newItems, status: newStatus };
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setSubmitting(true);
        try {
            const itemsToSave = (formData.requested_items || [])
                .filter(i => i.item_id && (parseInt(i.req_qty) || 0) > 0)
                .map(i => ({
                    ...i,
                    req_qty: parseInt(i.req_qty) || 0,
                    required_qty: parseInt(i.req_qty) || 0, 
                    qty: parseInt(i.req_qty) || 0, 
                    line_notes: i.line_notes || '',
                    notes: i.line_notes || '', 
                    specs: i.line_notes || '', 
                    line_status: i.line_status || 'OPEN FULL',
                    status: i.line_status || 'OPEN FULL', 
                    minus_reason: i.minus_reason || '',
                    reason: i.minus_reason || '' 
                }));
                
            if (itemsToSave.length === 0) { alert("MINIMAL 1 BARANG!"); setSubmitting(false); return; }
            const hasMissingReason = itemsToSave.some(i => i.line_status === 'OVER' && !i.minus_reason);
            if (hasMissingReason) { alert("LENGKAPI ALASAN OVER!"); setSubmitting(false); return; }
            
            const finalPayload = { ...formData, requested_items: JSON.stringify(itemsToSave) };
            
            if (formData.pr_id) await axios.put(`http://localhost:5000/api/purchase-requests/${formData.pr_id}`, finalPayload);
            else await axios.post('http://localhost:5000/api/purchase-requests', finalPayload);
            
            setIsModalOpen(false); fetchData();
        } catch (err) { alert(`GAGAL!\n${err.message}`); } finally { setSubmitting(false); }
    };

    const openEditModal = async (pr) => {
        await fetchData(); 
        const calculatedEntitlements = getEntitlements(pr.project_id, pr.pr_id);
        setEntitlementData(calculatedEntitlements);
        
        let parsedItems = [];
        if (typeof pr.requested_items === 'string') { try { parsedItems = JSON.parse(pr.requested_items); } catch(e){} } 
        else if (Array.isArray(pr.requested_items)) { parsedItems = pr.requested_items; }
        
        parsedItems = parsedItems.map(item => ({
            ...item,
            req_qty: parseInt(item.req_qty) || parseInt(item.required_qty) || parseInt(item.qty) || 0,
            line_notes: item.line_notes || item.notes || item.specs || '',
            line_status: item.line_status || item.status || 'OPEN FULL',
            minus_reason: item.minus_reason || item.reason || item.over_reason || ''
        }));
        
        const currentAgg = {};
        parsedItems.forEach(i => { 
            if (i.item_id && i.line_status !== 'REJECT FULL' && i.line_status !== 'REJECTED') {
                currentAgg[i.item_id] = (currentAgg[i.item_id] || 0) + (parseInt(i.req_qty) || 0); 
            }
        });
        
        let hasOver = false;
        parsedItems.forEach(i => {
            if (i.item_id && !['CLOSE FULL', 'CLOSE PARTIAL', 'REJECT FULL', 'REJECT PARTIAL'].includes(i.line_status)) {
                const ent = calculatedEntitlements.find(e => e.item_id === i.item_id);
                if (ent) {
                    const remaining = ent.project_qty - ent.previously_requested - currentAgg[i.item_id];
                    if (remaining < 0) { 
                        i.line_status = 'OVER'; 
                        hasOver = true; 
                    } else if (i.line_status === 'OVER' && remaining >= 0) {
                        i.line_status = 'OPEN FULL'; 
                    }
                }
            }
        });

        let newStatus = pr.status || 'OPEN FULL';
        if (hasOver && (newStatus === 'OPEN FULL' || newStatus === 'OPEN PARTIAL')) {
            newStatus = 'OVER';
        } else if (!hasOver && newStatus === 'OVER') {
            newStatus = 'OPEN FULL';
        }

        const project = projects.find(p => p.project_id === pr.project_id);
        setFormData({ ...pr, status: newStatus, project_name: project ? project.project_name : '', requested_items: parsedItems });
        setIsModalOpen(true);
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

    const filteredPRs = prs.filter(pr => (pr?.pr_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (pr?.project_id || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const pendingProjectsList = projects.filter(p => p?.status === 'ACTIVE').map(proj => {
        const entitlements = getEntitlements(proj.project_id);
        const pendingItems = entitlements.filter(e => (e.project_qty - e.previously_requested) > 0);
        return { ...proj, pending_count: pendingItems.length, total_pending_qty: pendingItems.reduce((sum, item) => sum + (item.project_qty - item.previously_requested), 0) };
    }).filter(proj => proj.pending_count > 0);
    
    const filteredPendingProjects = pendingProjectsList.filter(p => (p?.project_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p?.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p?.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const filteredProjectsOptions = projects.filter(p => {
        const matchesSearch = (p?.project_id || '').toLowerCase().includes(projectSearchTerm.toLowerCase()) || (p?.project_name || '').toLowerCase().includes(projectSearchTerm.toLowerCase());
        return formData.pr_id ? matchesSearch : matchesSearch && p?.status === 'ACTIVE';
    });

    const currentAgg = {};
    (formData.requested_items || []).forEach(i => { 
        if (i.item_id && i.line_status !== 'REJECT FULL' && i.line_status !== 'REJECTED') {
            currentAgg[i.item_id] = (currentAgg[i.item_id] || 0) + (parseInt(i.req_qty) || 0); 
        }
    });

    if (loading && prs.length === 0) return <div className="text-[#C4C7C5] text-xs p-4 uppercase">SYNCING DATA...</div>;

    return (
        <div className="relative space-y-4 w-full mx-auto font-sans antialiased text-[#E3E3E3]">
            <div className="bg-[#1E1F22] rounded-[16px] border border-[#333639] overflow-hidden shadow-sm">
                <div className="px-5 py-2 border-b border-[#333639] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1E1F22] space-y-2 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-[#E3E3E3] tracking-wide uppercase">Purchase Requests</h2>
                        <p className="text-[10px] text-[#8E918F] mt-0.5 uppercase">{activeTab === 'PR_LIST' ? `${filteredPRs.length} PR RECORDS` : `${filteredPendingProjects.length} PENDING PROJECTS`}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-56">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-[#8E918F]" /></div>
                            <input type="text" placeholder="SEARCH REFERENCES..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1 border border-[#333639] rounded-full bg-[#131314] text-[#E3E3E3] text-[11px] focus:outline-none focus:border-[#A8C7FA] transition-all uppercase" />
                        </div>
                        <button onClick={async () => { 
                            setFormData(initialFormState); 
                            setProjectSearchTerm(''); 
                            setEntitlementData([]); 
                            setIsModalOpen(true); 
                            await fetchData(); 
                        }} className="w-full sm:w-auto flex items-center justify-center bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-semibold px-4 py-1 rounded-full transition-colors uppercase">
                            <Plus className="w-3.5 h-3.5 mr-1" /> CREATE PR
                        </button>
                    </div>
                </div>

                <div className="px-5 py-1 flex space-x-2 bg-[#1E1F22] border-b border-[#333639]">
                    <button onClick={() => setActiveTab('PR_LIST')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center uppercase ${activeTab === 'PR_LIST' ? 'bg-[#D3E3FD] text-[#062E6F]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Receipt className="w-3.5 h-3.5 mr-1.5"/> PR HISTORY
                    </button>
                    <button onClick={() => setActiveTab('PENDING_PROJECTS')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center uppercase ${activeTab === 'PENDING_PROJECTS' ? 'bg-[#FFBCA6]/20 text-[#FFBCA6]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Clock className="w-3.5 h-3.5 mr-1.5"/> PENDING ORDERS
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'PR_LIST' ? (
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                                <tr>
                                    <th className="px-4 py-1.5 font-medium w-28">PR ID</th>
                                    <th className="px-4 py-1.5 font-medium w-28">DATE</th>
                                    <th className="px-4 py-1.5 font-medium min-w-[200px]">PROJECT</th>
                                    <th className="px-4 py-1.5 font-medium w-24 text-center">ITEMS COUNT</th>
                                    <th className="px-4 py-1.5 font-medium w-28 text-center">STATUS</th>
                                    <th className="px-4 py-1.5 font-medium w-20 text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333639] text-[11px]">
                                {filteredPRs.length === 0 && <tr><td colSpan={6} className="text-center p-4 text-[#8E918F] uppercase">NO PURCHASE REQUESTS FOUND.</td></tr>}
                                {filteredPRs.map((pr, idx) => {
                                    let itemsCount = 0;
                                    if(typeof pr?.requested_items === 'string') { try { itemsCount = JSON.parse(pr.requested_items).length; } catch(e){} } 
                                    else if(Array.isArray(pr?.requested_items)) { itemsCount = pr.requested_items.length; }
                                    
                                    const proj = projects.find(p => p.project_id === pr?.project_id);
                                    const projName = proj ? proj.project_name : pr?.project_id;
                                    const compName = proj ? proj.company_name : '-';

                                    return (
                                    <tr key={idx} className="hover:bg-[#333639]/30 transition-colors uppercase">
                                        <td className="px-4 py-1 font-medium text-[#E3E3E3]">{pr?.pr_id}</td>
                                        <td className="px-4 py-1 text-[#C4C7C5]">{pr?.request_date}</td>
                                        <td className="px-4 py-1">
                                            <div className="font-medium text-[#A8C7FA] truncate max-w-[200px]">{projName}</div>
                                            <div className="text-[9px] text-[#8E918F] truncate max-w-[200px]">{compName}</div>
                                        </td>
                                        <td className="px-4 py-1 text-center text-[#E3E3E3]">{itemsCount} UNIT</td>
                                        <td className="px-4 py-1 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold border tracking-wide uppercase ${getStatusStyle(pr?.status)}`}>{pr?.status || 'OPEN FULL'}</span>
                                        </td>
                                        <td className="px-4 py-1 text-center">
                                            <button onClick={() => openEditModal(pr)} className="text-[#A8C7FA] hover:text-[#062E6F] text-[10px] font-medium bg-[#A8C7FA]/10 hover:bg-[#A8C7FA] px-2.5 py-0.5 rounded-full transition-colors uppercase">DETAIL</button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                                <tr>
                                    <th className="px-4 py-1.5 font-medium w-28">PROJECT ID</th>
                                    <th className="px-4 py-1.5 font-medium min-w-[200px]">PROJECT NAME</th>
                                    <th className="px-4 py-1.5 font-medium min-w-[150px]">CLIENT (PT)</th>
                                    <th className="px-4 py-1.5 font-medium w-32 text-center">PENDING REQUEST</th>
                                    <th className="px-4 py-1.5 font-medium w-20 text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333639] text-[11px]">
                                {filteredPendingProjects.length === 0 && <tr><td colSpan={5} className="text-center p-4 text-[#8E918F] uppercase">SEMUA PROJECT SUDAH DIORDER SESUAI JATAH.</td></tr>}
                                {filteredPendingProjects.map((proj, idx) => (
                                    <tr key={idx} className="hover:bg-[#333639]/30 transition-colors uppercase">
                                        <td className="px-4 py-1 font-medium text-[#A8C7FA]">{proj.project_id}</td>
                                        <td className="px-4 py-1 font-medium text-[#E3E3E3] truncate max-w-[200px]">{proj.project_name}</td>
                                        <td className="px-4 py-1 text-[#C4C7C5] truncate max-w-[200px]">{proj.company_name}</td>
                                        <td className="px-4 py-1 text-center text-[#FFBCA6] font-medium">{proj.pending_count} ITEMS ({proj.total_pending_qty} QTY)</td>
                                        <td className="px-4 py-1 text-center">
                                            <button onClick={async () => { 
                                                setFormData(initialFormState); 
                                                setProjectSearchTerm(''); 
                                                setIsModalOpen(true); 
                                                await fetchData(); 
                                                handleProjectSelect(proj); 
                                            }} className="text-[#072711] font-medium text-[10px] bg-[#C4EED0] hover:bg-[#93D7A6] px-2.5 py-0.5 rounded-full transition-colors uppercase">CREATE PR</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* MODAL POP UP */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                        <div className="px-4 py-2.5 border-b border-[#333639] bg-[#1E1F22] flex justify-between items-center rounded-t-[16px]">
                            <div>
                                <h3 className="text-sm font-semibold text-[#E3E3E3] uppercase">{formData.pr_id ? `PR DETAILS: ${formData.pr_id}` : 'NEW PURCHASE REQUEST'}</h3>
                                <p className="text-[10px] text-[#8E918F] mt-0.5 uppercase">BASED ON PROJECT ENTITLEMENT & BUDGET</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] p-1 rounded-full hover:bg-[#333639]"><XCircle className="w-5 h-5" /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#131314] custom-scrollbar">
                            <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative" ref={dropdownRef}>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">{formData.pr_id ? 'PROJECT REFERENCE' : 'SELECT ACTIVE PROJECT *'}</label>
                                        <div onClick={() => !formData.pr_id && setIsProjectDropdownOpen(!isProjectDropdownOpen)} className={`w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] ${formData.project_id ? 'text-[#A8C7FA]' : 'text-[#8E918F]'} flex justify-between items-center cursor-pointer transition-colors ${formData.pr_id ? 'opacity-50' : ''} uppercase`}>
                                            <span className="truncate">{formData.project_id ? `${formData.project_id} - ${formData.project_name || 'PROJECT'}` : 'SEARCH & SELECT PROJECT...'}</span>
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </div>
                                        {isProjectDropdownOpen && (
                                            <div className="absolute top-full left-0 w-full mt-1 bg-[#1E1F22] border border-[#333639] rounded-lg shadow-xl z-10 overflow-hidden">
                                                <div className="p-1.5 border-b border-[#333639] relative">
                                                    <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-[#8E918F]" />
                                                    <input type="text" autoFocus placeholder="SEARCH ID / NAME..." value={projectSearchTerm} onChange={(e) => setProjectSearchTerm(e.target.value.toUpperCase())} className="w-full bg-[#131314] border border-[#333639] rounded-md text-[11px] text-[#E3E3E3] pl-8 pr-3 py-1 focus:border-[#A8C7FA] outline-none uppercase" />
                                                </div>
                                                <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                                                    {filteredProjectsOptions.map(p => (
                                                        <div key={p.project_id} onClick={() => handleProjectSelect(p)} className="px-2.5 py-1.5 text-[11px] text-[#C4C7C5] hover:bg-[#333639] hover:text-[#E3E3E3] cursor-pointer rounded-md uppercase">
                                                            <span className="font-medium text-[#A8C7FA]">{p.project_id}</span> &bull; {p.project_name}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1 uppercase tracking-wide">REQUEST DATE</label>
                                        <input type="date" disabled={!!formData.pr_id} value={formData.request_date} onChange={(e) => setFormData({...formData, request_date: e.target.value})} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none disabled:opacity-50 uppercase" />
                                    </div>
                                </div>
                            </div>

                            {formData.project_id && Array.isArray(formData.requested_items) && (
                                <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider flex items-center">
                                            <ClipboardList className="w-3.5 h-3.5 mr-1.5"/> ENTITLEMENT ITEMS
                                        </div>
                                        <div className="flex space-x-3 items-center">
                                            {!formData.pr_id && (
                                                <button type="button" onClick={addRequestLine} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-2.5 py-1 rounded-full flex items-center transition-colors uppercase">
                                                    <Plus className="w-3 h-3 mr-1"/> ADD ROW
                                                </button>
                                            )}
                                            <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-medium border tracking-wide uppercase ${getStatusStyle(formData.status)}`}>
                                                PR STATUS: {formData.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-[#333639]">
                                        <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                                            <thead className="bg-[#1E1F22] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-2.5 py-1.5 font-medium min-w-[150px]">ITEM DESCRIPTION</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-16 text-[#A8C7FA]">BUDGET JATAH</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-16 text-[#FFBCA6]">TOTAL ORDER</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-16 text-[#6DD58C]">SISA BUDGET</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center text-[#E3E3E3] w-20">REQ QTY *</th>
                                                    <th className="px-2.5 py-1.5 font-medium min-w-[150px]">NOTES / SPECS</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-[#FFB4AB] min-w-[120px]">OVER REASON</th>
                                                    <th className="px-2.5 py-1.5 font-medium text-center w-14">STATUS</th>
                                                    {!formData.pr_id && <th className="px-2.5 py-1.5 font-medium text-center w-10">ACT</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333639]">
                                                {formData.requested_items.length === 0 && <tr><td colSpan={9} className="p-3 text-center text-[#8E918F] uppercase">CLICK "ADD ROW" TO START.</td></tr>}
                                                {formData.requested_items.map((item, idx) => {
                                                    const ent = entitlementData.find(e => e.item_id === item.item_id);
                                                    
                                                    const isRejected = item?.line_status === 'REJECT FULL' || item?.line_status === 'REJECTED';
                                                    const currentLineSum = isRejected ? 0 : (currentAgg[item.item_id] || 0);
                                                    
                                                    const totalOrdered = ent ? ent.previously_requested + currentLineSum : '-';
                                                    const sisa = ent ? ent.project_qty - totalOrdered : '-';

                                                    const isOver = item?.line_status === 'OVER' || sisa < 0;

                                                    return (
                                                    <tr key={idx} className="hover:bg-[#333639]/20 transition-colors uppercase">
                                                        <td className="p-1.5 align-top">
                                                            <select value={item.item_id} onChange={(e) => handleLineChange(idx, 'item_id', e.target.value)} disabled={!!formData.pr_id} className="w-full border border-[#333639] rounded-lg px-2 py-1 text-[11px] bg-[#1E1F22] text-[#E3E3E3] outline-none cursor-pointer disabled:opacity-70 uppercase">
                                                                <option value="" className="text-[#8E918F]">-- SELECT --</option>
                                                                {entitlementData.map(e => {
                                                                    const sisaGlobal = e.project_qty - e.previously_requested - (currentAgg[e.item_id] || 0);
                                                                    const currentLineQty = item.item_id === e.item_id && !isRejected ? (parseInt(item.req_qty) || 0) : 0;
                                                                    return <option key={e.item_id} value={e.item_id}>{e.name} (SISA BUDGET: {sisaGlobal + currentLineQty})</option>;
                                                                })}
                                                                {!!formData.pr_id && item.item_id && !entitlementData.find(e => e.item_id === item.item_id) && <option value={item.item_id}>{item.name || item.item_id}</option>}
                                                            </select>
                                                        </td>
                                                        <td className="p-1.5 text-center text-[#A8C7FA] font-bold align-middle bg-[#A8C7FA]/5 rounded-l-md">{ent ? ent.project_qty : '-'}</td>
                                                        <td className="p-1.5 text-center text-[#FFBCA6] font-bold align-middle bg-[#FFBCA6]/5">{totalOrdered}</td>
                                                        <td className={`p-1.5 text-center font-bold align-middle bg-[#6DD58C]/5 rounded-r-md ${sisa < 0 ? 'text-[#FFB4AB]' : 'text-[#6DD58C]'}`}>{sisa}</td>
                                                        <td className="p-1.5 align-top">
                                                            <input type="number" min="0" value={item?.req_qty || 0} onChange={(e) => handleLineChange(idx, 'req_qty', e.target.value)} disabled={!!formData.pr_id} className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-lg px-2 py-1 text-[11px] outline-none text-center font-bold disabled:opacity-70 uppercase" />
                                                        </td>
                                                        <td className="p-1.5 align-top">
                                                            <input type="text" value={item?.line_notes || ''} onChange={(e) => handleLineChange(idx, 'line_notes', e.target.value)} placeholder="SIZE L" disabled={!!formData.pr_id || (item?.req_qty || 0) === 0} className="w-full border border-[#333639] bg-[#1E1F22] disabled:opacity-50 text-[#E3E3E3] rounded-lg px-2 py-1 text-[11px] outline-none placeholder-[#5F6368] uppercase" />
                                                        </td>
                                                        <td className="p-1.5 align-top">
                                                            {isOver ? (
                                                                <select value={item?.minus_reason || ''} onChange={(e) => handleLineChange(idx, 'minus_reason', e.target.value)} disabled={!!formData.pr_id} className="w-full border border-[#8C1D18]/50 bg-[#1E1F22] text-[#FFB4AB] rounded-lg px-2 py-1 text-[10px] outline-none disabled:opacity-70 uppercase">
                                                                    <option value="">-- REASON --</option>
                                                                    {minusCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                                    {!!formData.pr_id && item?.minus_reason && !minusCategories.includes(item.minus_reason) && (
                                                                        <option value={item.minus_reason}>{item.minus_reason}</option>
                                                                    )}
                                                                </select>
                                                            ) : <span className="text-[#5F6368] text-[11px] block text-center mt-1 italic">-</span>}
                                                        </td>
                                                        <td className="p-1.5 text-center align-middle">
                                                            {item?.line_status === 'CLOSE FULL' && <CheckCircle className="w-4 h-4 text-[#6DD58C] mx-auto" title="CLOSE FULL" />}
                                                            {item?.line_status === 'CLOSE PARTIAL' && <CheckCircle className="w-4 h-4 text-[#56D6D6] mx-auto" title="CLOSE PARTIAL" />}
                                                            {isOver && !['CLOSE FULL', 'CLOSE PARTIAL', 'REJECT FULL', 'REJECT PARTIAL'].includes(item?.line_status) && <AlertTriangle className="w-4 h-4 text-[#FFB4AB] mx-auto" title="OVER BUDGET" />}
                                                            {item?.line_status === 'REJECT FULL' && <XCircle className="w-4 h-4 text-[#FFB4AB] mx-auto" title="REJECT FULL" />}
                                                            {item?.line_status === 'REJECT PARTIAL' && <XCircle className="w-4 h-4 text-[#FFB3B6] mx-auto" title="REJECT PARTIAL" />}
                                                            {item?.line_status === 'OPEN PARTIAL' && !isOver && <Clock className="w-4 h-4 text-[#FFBCA6] mx-auto" title="OPEN PARTIAL" />}
                                                            {item?.line_status === 'OPEN FULL' && !isOver && <Clock className="w-4 h-4 text-[#7FCFFF] mx-auto" title="OPEN FULL" />}
                                                        </td>
                                                        {!formData.pr_id && <td className="p-1.5 text-center align-middle w-10"><button type="button" onClick={() => removeRequestLine(idx)} className="text-[#8E918F] hover:text-[#FFB4AB] p-1 rounded-full"><Trash2 className="w-3.5 h-3.5 mx-auto"/></button></td>}
                                                    </tr>
                                                )})}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-3">
                                <label className="block text-[10px] font-medium text-[#8E918F] uppercase tracking-wide mb-1">GENERAL REMARKS (OPTIONAL)</label>
                                <textarea rows="2" disabled={!!formData.pr_id} value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value.toUpperCase()})} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] outline-none resize-none disabled:opacity-50 uppercase" placeholder="ENTER ADDITIONAL NOTES..."></textarea>
                            </div>
                        </form>
                        <div className="px-4 py-2.5 border-t border-[#333639] bg-[#1E1F22] flex justify-end space-x-3 rounded-b-[16px]">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#E3E3E3] hover:bg-[#333639] text-[11px] font-medium px-4 py-1.5 rounded-full uppercase">{formData.pr_id ? 'CLOSE' : 'CANCEL'}</button>
                            {!formData.pr_id && (
                                <button type="submit" onClick={handleSubmit} disabled={submitting || !formData.project_id} className="bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-medium px-5 py-1.5 rounded-full disabled:opacity-50 uppercase">
                                    {submitting ? 'SAVING...' : 'SAVE PURCHASE REQUEST'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}