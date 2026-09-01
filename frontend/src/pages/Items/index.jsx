import React, { useEffect, useState, Fragment } from 'react';
import axios from 'axios';
import { Search, Plus, Download, Trash2, Package, Layers, XCircle, PowerOff } from 'lucide-react';

export default function Items() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeViewTab, setActiveViewTab] = useState('SINGLE'); 

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [itemType, setItemType] = useState('SINGLE'); 
    
    const [lookups, setLookups] = useState({ categories1: [], categories2Map: [], services: [], uoms: [] });
    const [displayPrice, setDisplayPrice] = useState(''); 

    const initialFormState = {
        item_id: '', item_code: '', item_name: '', category_1: '', category_2: '',
        service_type: '', unit: '', price: '', lifespan_months: '',
        cogs_sett: '', minimum_stock: '', reorder_point: '', active: 'TRUE',
        bundle_details: [] 
    };

    const [formData, setFormData] = useState(initialFormState);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [itemsRes, lookupsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/items').catch(() => ({ data: { data: [] } })),
                axios.get('http://localhost:5000/api/lookups').catch(() => ({ data: { data: { categories1: [], categories2Map: [], services: [], uoms: [] } } }))
            ]);
            setItems(Array.isArray(itemsRes?.data?.data) ? itemsRes.data.data.reverse() : []);
            setLookups(lookupsRes?.data?.data || { categories1: [], categories2Map: [], services: [], uoms: [] });
        } catch (err) {} finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape' && isModalOpen) setIsModalOpen(false); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

    useEffect(() => {
        const cat1 = itemType === 'BUNDLE' ? 'BUNDLE PACKAGE' : formData.category_1;
        const cat2 = formData.category_2;

        if (!isEditing && cat1 && cat2) {
            const prefix1 = cat1.substring(0, 3).toUpperCase();
            const prefix2 = cat2.substring(0, 3).toUpperCase();
            const prefixCode = `${prefix1}-${prefix2}-`;
            
            const existingCodes = items.filter(i => i.item_code && i.item_code.startsWith(prefixCode));
            let maxUrutan = 0;
            
            existingCodes.forEach(i => {
                const parts = i.item_code.split('-');
                if (parts.length >= 3) {
                    const num = parseInt(parts[2], 10);
                    if (!isNaN(num) && num > maxUrutan) maxUrutan = num;
                }
            });
            
            const nextUrutan = String(maxUrutan + 1).padStart(3, '0');
            const newCode = `${prefixCode}${nextUrutan}`;
            
            setFormData(prev => prev.item_code !== newCode ? { ...prev, item_code: newCode } : prev);
        }
    }, [formData.category_1, formData.category_2, isEditing, itemType, items]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prev => {
            const updated = { ...prev, [name]: value.toUpperCase() };
            if (name === 'category_2') {
                const searchVal = value.trim().toUpperCase();
                const foundCat2 = lookups.categories2Map.find(c => c.name.trim().toUpperCase() === searchVal);
                if (foundCat2) {
                    updated.cogs_sett = foundCat2.sett;
                } else {
                    updated.cogs_sett = ''; 
                }
            }
            return updated;
        });
    };

    const handlePriceTyping = (e) => {
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        if (!rawValue) {
            setDisplayPrice('');
            setFormData(prev => ({ ...prev, price: '' }));
            return;
        }
        const numericValue = parseInt(rawValue, 10);
        setDisplayPrice(numericValue.toLocaleString('id-ID'));
        setFormData(prev => ({ ...prev, price: numericValue }));
    };

    const openAddModal = () => {
        setIsEditing(false);
        setItemType(activeViewTab); 
        setFormData(initialFormState);
        setDisplayPrice('');
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setIsEditing(true);
        let parsedBundle = [];
        if (item.bundle_details) {
            if (typeof item.bundle_details === 'string') { try { parsedBundle = JSON.parse(item.bundle_details); } catch(e){} } 
            else if (Array.isArray(item.bundle_details)) { parsedBundle = item.bundle_details; }
        }
        setItemType(parsedBundle.length > 0 || item.category_1 === 'BUNDLE PACKAGE' ? 'BUNDLE' : 'SINGLE');
        
        setDisplayPrice(item.price ? parseInt(item.price).toLocaleString('id-ID') : '');
        setFormData({
            ...item,
            cogs_sett: String(item.cogs_sett || item.penambah_harga_jual || '40').replace('%', ''),
            bundle_details: parsedBundle
        });
        setIsModalOpen(true);
    };

    const addBundleItem = () => setFormData(prev => ({ ...prev, bundle_details: [...prev.bundle_details, { item_id: '', qty: 1, unit_price: 0, subtotal: 0 }] }));
    const removeBundleItem = (index) => setFormData(prev => { const newBundle = [...prev.bundle_details]; newBundle.splice(index, 1); return { ...prev, bundle_details: newBundle }; });
    const updateBundleItem = (index, field, value) => {
        setFormData(prev => {
            const newBundle = [...prev.bundle_details];
            if (field === 'item_id') {
                const selectedItem = items.find(i => i.item_id === value);
                const unitPrice = selectedItem ? (parseFloat(selectedItem.price) || 0) : 0;
                newBundle[index] = { ...newBundle[index], item_id: value, unit_price: unitPrice, subtotal: unitPrice * (parseInt(newBundle[index].qty) || 1) };
            } else if (field === 'qty') {
                const qty = parseInt(value) || 0;
                newBundle[index] = { ...newBundle[index], qty: qty, subtotal: (newBundle[index].unit_price || 0) * qty };
            }
            return { ...prev, bundle_details: newBundle };
        });
    };

    const isBundle = itemType === 'BUNDLE';
    const totalBundlePrice = formData.bundle_details.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const finalBuyPrice = isBundle ? totalBundlePrice : (parseFloat(formData.price) || 0);

    const lifeNum = parseInt(formData.lifespan_months) || 1;
    const calcCogs = Math.round(finalBuyPrice / lifeNum);
    const cogsSettNum = parseFloat(formData.cogs_sett) || 100;
    const calcHargaJualTotal = Math.round(finalBuyPrice / (cogsSettNum / 100));
    const calcHargaJualPerBulan = Math.round(calcCogs / (cogsSettNum / 100));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.category_2) { alert("ERROR: Kategori 2 belum dipilih!"); return; }
        if (!formData.service_type) { alert("ERROR: Service Type belum dipilih!"); return; }
        if (!formData.unit) { alert("ERROR: Unit / UOM belum dipilih!"); return; }
        if (!formData.item_name || formData.item_name.trim() === '') { alert("ERROR: Nama Item tidak boleh kosong!"); return; }
        if (!formData.item_code || formData.item_code.trim() === '') { alert("ERROR: Item Code belum terbentuk! Pastikan Kategori sudah lengkap."); return; }
        if (!formData.lifespan_months || String(formData.lifespan_months).trim() === '') { alert("ERROR: Life (Months) tidak boleh kosong!"); return; }
        if (!formData.cogs_sett || String(formData.cogs_sett).trim() === '') { alert("ERROR: COGS Sett (%) tidak boleh kosong!"); return; }
        if (!formData.minimum_stock || String(formData.minimum_stock).trim() === '') { alert("ERROR: Min Stock tidak boleh kosong!"); return; }
        if (!formData.reorder_point || String(formData.reorder_point).trim() === '') { alert("ERROR: ROP (Reorder Point) tidak boleh kosong!"); return; }

        if (!isBundle) {
            if (!formData.category_1) { alert("ERROR: Kategori 1 belum dipilih!"); return; }
            if (!formData.price || String(formData.price).trim() === '') { alert("ERROR: Harga Beli (Buy Price) tidak boleh kosong!"); return; }
        }

        if (isBundle) {
            if (formData.bundle_details.length === 0) { alert("ERROR: Bundle masih kosong! Mohon masukkan minimal 1 barang pendukung."); return; }
            const hasEmptyBundleItem = formData.bundle_details.some(b => !b.item_id || !b.qty);
            if (hasEmptyBundleItem) { alert("ERROR: Ada isi Bundle yang belum lengkap (Item belum dipilih atau Qty kosong)!"); return; }
        }

        if (!isEditing) {
            const inputName = formData.item_name.trim().toUpperCase();
            const isNameExist = items.some(i => i.item_name && i.item_name.trim().toUpperCase() === inputName);
            if (isNameExist) {
                alert(`ERROR: Nama Item "${inputName}" sudah terdaftar di sistem! Harap gunakan nama lain.`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                price: finalBuyPrice,
                cogs_per_month: calcCogs,
                harga_jual_per_month: calcHargaJualPerBulan,
                bundle_details: isBundle ? formData.bundle_details : []
            };

            if (isBundle) payload.category_1 = 'BUNDLE PACKAGE';

            if (isEditing) await axios.put(`http://localhost:5000/api/items/${formData.item_id}`, payload);
            else await axios.post('http://localhost:5000/api/items', payload);
            
            setIsModalOpen(false);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || "Gagal menyimpan data item."); } 
        finally { setSubmitting(false); }
    };

    const handleDeactivateExpertise = async () => {
        if(window.confirm('PERINGATAN: Semua Item di kategori "SPECIAL EXPERTISE" akan dinonaktifkan secara massal. Lanjutkan?')) {
            setSubmitting(true);
            try {
                await axios.post('http://localhost:5000/api/items/deactivate-expertise');
                alert("Berhasil! Semua item Special Expertise telah dinonaktifkan.");
                fetchData();
            } catch (err) {
                alert("Gagal menonaktifkan: " + (err.response?.data?.message || err.message));
            } finally {
                setSubmitting(false);
            }
        }
    };

    const displayedItems = items.filter(item => {
        const matchesSearch = (item.item_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.category_1 || '').toLowerCase().includes(searchTerm.toLowerCase());
        let isItemBundle = false;
        if (item.category_1 === 'BUNDLE PACKAGE') isItemBundle = true;
        if (item.bundle_details && typeof item.bundle_details === 'string' && item.bundle_details.length > 2) isItemBundle = true;
        if (item.bundle_details && Array.isArray(item.bundle_details) && item.bundle_details.length > 0) isItemBundle = true;
        const matchesTab = activeViewTab === 'BUNDLE' ? isItemBundle : !isItemBundle;
        return matchesSearch && matchesTab;
    });

    const handleExport = () => {
        const headers = ['Item ID', 'Item Code', 'Item Name', 'Kategori I', 'Kategori II', 'Service Type', 'Unit', 'Harga Beli', 'Life (Bln)', 'COGS/Bln', 'COGS Sett', 'Harga Jual/Bln', 'Min Stock', 'ROP', 'Status'];
        const csvData = displayedItems.map(item => [
            item.item_id, item.item_code, `"${item.item_name}"`, item.category_1, item.category_2, 
            item.service_type, item.unit, item.price, item.lifespan_months, item.cogs_per_month, 
            item.cogs_sett, item.harga_jual_per_month || item.harga_jual_per_moth, item.minimum_stock, item.reorder_point, item.active
        ]);
        const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
        link.download = `Master_${activeViewTab}_Items_${new Date().toISOString().split('T')[0]}.csv`; link.click();
    };

    if (loading && items.length === 0) return <div className="text-[#C4C7C5] text-xs p-4">Syncing data...</div>;

    return (
        <div className="relative space-y-4 w-full mx-auto font-sans antialiased text-[#E3E3E3]">
            <div className="bg-[#1E1F22] rounded-[16px] border border-[#333639] overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-[#333639] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1E1F22] space-y-3 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-[#E3E3E3] tracking-wide">Master Items</h2>
                        <p className="text-[10px] text-[#8E918F] mt-0.5">{displayedItems.length} Records Found</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-56">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-[#8E918F]" />
                            </div>
                            <input type="text" placeholder="Search Code/Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#333639] rounded-full bg-[#131314] text-[#E3E3E3] text-[11px] focus:outline-none focus:border-[#A8C7FA] transition-all" />
                        </div>

                        <button onClick={handleDeactivateExpertise} disabled={submitting} className="w-full sm:w-auto flex items-center justify-center bg-[#8C1D18]/20 hover:bg-[#8C1D18]/40 border border-[#8C1D18]/40 text-[#FFB4AB] text-[11px] font-medium px-4 py-1.5 rounded-full transition-colors">
                            <PowerOff className="w-3.5 h-3.5 mr-1.5" /> Deactivate Expertise
                        </button>
                        
                        <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] text-[11px] font-medium px-4 py-1.5 rounded-full transition-colors">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                        </button>
                        <button onClick={openAddModal} className="w-full sm:w-auto flex items-center justify-center bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-semibold px-4 py-1.5 rounded-full transition-colors">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add {activeViewTab === 'BUNDLE' ? 'Bundle' : 'Item'}
                        </button>
                    </div>
                </div>

                <div className="px-5 py-1.5 flex space-x-2 bg-[#1E1F22] border-b border-[#333639]">
                    <button 
                        onClick={() => setActiveViewTab('SINGLE')}
                        className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center ${activeViewTab === 'SINGLE' ? 'bg-[#D3E3FD] text-[#062E6F]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}
                    >
                        <Layers className="w-3.5 h-3.5 mr-1.5"/> Single Items
                    </button>
                    <button 
                        onClick={() => setActiveViewTab('BUNDLE')}
                        className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center ${activeViewTab === 'BUNDLE' ? 'bg-[#FFBCA6]/20 text-[#FFBCA6]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}
                    >
                        <Package className="w-3.5 h-3.5 mr-1.5"/> Bundle Packages
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                            <tr>
                                {/* PERBAIKAN: Padding di th diperkecil menjadi py-1.5 */}
                                <th className="px-4 py-1.5 font-medium w-24">ID</th>
                                <th className="px-4 py-1.5 font-medium min-w-[200px]">{activeViewTab === 'BUNDLE' ? 'Bundle Details' : 'Item Details'}</th>
                                <th className="px-4 py-1.5 font-medium w-32">Category</th>
                                <th className="px-4 py-1.5 font-medium w-24 text-right">Price</th>
                                <th className="px-4 py-1.5 font-medium w-12 text-center">Life</th>
                                <th className="px-4 py-1.5 font-medium w-24 text-right">COGS/Mo</th>
                                <th className="px-4 py-1.5 font-medium w-12 text-center">Sett</th>
                                <th className="px-4 py-1.5 font-medium w-24 text-right">Sell/Mo</th>
                                <th className="px-4 py-1.5 font-medium w-20 text-center">Status</th>
                                <th className="px-4 py-1.5 font-medium w-16 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333639] text-[11px]">
                            {displayedItems.length === 0 && (
                                <tr><td colSpan={10} className="p-4 text-center text-[#8E918F]">No {activeViewTab} items found.</td></tr>
                            )}
                            {displayedItems.map((item, idx) => {
                                const isItemBundle = activeViewTab === 'BUNDLE';
                                const isActive = item.active === 'TRUE' || item.active === true || item.active === 'ACTIVE';
                                
                                return (
                                <tr key={idx} className={`transition-colors ${isActive ? 'hover:bg-[#333639]/30' : 'bg-[#131314] opacity-60'}`}>
                                    {/* PERBAIKAN: Padding di td diperkecil menjadi py-1 */}
                                    <td className="px-4 py-1 font-medium text-[#E3E3E3]">{item.item_id || '-'}</td>
                                    <td className="px-4 py-1">
                                        <div className="flex items-center space-x-2">
                                            {isItemBundle && <Package className="w-3.5 h-3.5 text-[#A8C7FA] shrink-0" title="Bundle Item"/>}
                                            <div className="truncate">
                                                <div className={`font-medium truncate ${isActive ? 'text-[#A8C7FA]' : 'text-[#8E918F]'}`}>{item.item_name}</div>
                                                <div className="text-[9px] text-[#8E918F] mt-0.5">{item.item_code}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-1">
                                        <div className="flex flex-col space-y-1 w-max">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide ${isItemBundle ? 'bg-[#004A77] text-[#7FCFFF]' : 'bg-[#333639] text-[#E3E3E3]'}`}>{item.category_1}</span>
                                            {item.category_2 && <span className="text-[9px] text-[#8E918F] pl-1 tracking-wide">{item.category_2}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-1 text-right text-[#E3E3E3]">Rp {parseInt(item.price || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-1 text-center text-[#8E918F]">{item.lifespan_months || 0}</td>
                                    <td className="px-4 py-1 text-right font-medium text-[#FFBCA6]">Rp {parseInt(item.cogs_per_month || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-1 text-center font-semibold text-[#C4C7C5]">{String(item.cogs_sett || '100').replace('%', '')}%</td>
                                    <td className="px-4 py-1 text-right font-bold text-[#6DD58C]">Rp {parseInt(item.harga_jual_per_month || item.harga_jual_per_moth || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-1 text-center">
                                        {isActive ? (
                                            <span className="bg-[#0F5223] text-[#6DD58C] px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide">ACTIVE</span>
                                        ) : (
                                            <span className="bg-[#8C1D18] text-[#FFB4AB] px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide">INACTIVE</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-1 text-center">
                                        <button onClick={() => openEditModal(item)} className="text-[#A8C7FA] hover:text-[#062E6F] text-[10px] font-medium bg-[#A8C7FA]/10 hover:bg-[#A8C7FA] px-2.5 py-0.5 rounded-full transition-colors">Edit</button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL EDIT & ADD */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                        <div className="px-4 py-3 border-b border-[#333639] bg-[#1E1F22] flex justify-between items-center rounded-t-[16px] shrink-0">
                            <div>
                                <h3 className="text-sm font-semibold text-[#E3E3E3]">{isEditing ? `Edit Item: ${formData.item_name || formData.item_id}` : 'New Master Item'}</h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] p-1 rounded-full hover:bg-[#333639]"><XCircle className="w-5 h-5" /></button>
                        </div>
                        
                        {!isEditing && (
                            <div className="px-4 pt-3 bg-[#131314] shrink-0">
                                <div className="flex p-1 bg-[#1E1F22] border border-[#333639] rounded-lg max-w-[240px]">
                                    <button 
                                        type="button" onClick={() => setItemType('SINGLE')}
                                        className={`flex-1 flex items-center justify-center py-1 text-[10px] font-medium rounded-md transition-colors ${!isBundle ? 'bg-[#333639] text-[#E3E3E3]' : 'text-[#8E918F] hover:text-[#C4C7C5]'}`}
                                    >
                                        <Layers className="w-3.5 h-3.5 mr-1.5"/> Single Item
                                    </button>
                                    <button 
                                        type="button" onClick={() => setItemType('BUNDLE')}
                                        className={`flex-1 flex items-center justify-center py-1 text-[10px] font-medium rounded-md transition-colors ${isBundle ? 'bg-[#004A77] text-[#7FCFFF]' : 'text-[#8E918F] hover:text-[#C4C7C5]'}`}
                                    >
                                        <Package className="w-3.5 h-3.5 mr-1.5"/> Bundle
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#131314] custom-scrollbar">
                            <div className="p-4 bg-[#1E1F22] border border-[#333639] rounded-xl space-y-3">
                                <div className="text-[11px] font-medium text-[#6DD58C] uppercase tracking-wider mb-1">1. Identity & Classification</div>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Category 1 *</label>
                                        <select name="category_1" disabled={isBundle} value={isBundle ? 'BUNDLE PACKAGE' : formData.category_1} onChange={handleInputChange} className={`w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] outline-none cursor-pointer ${isBundle ? 'bg-[#1E1F22] text-[#A8C7FA] font-medium opacity-80' : 'bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA]'}`}>
                                            <option value="">-- Select --</option>
                                            <option value="BUNDLE PACKAGE" className="font-bold text-[#FFBCA6]">BUNDLE PACKAGE</option>
                                            {lookups.categories1.filter(c => c !== 'BUNDLE PACKAGE').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Category 2 *</label>
                                        <select name="category_2" value={formData.category_2} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            {lookups.categories2Map.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Service *</label>
                                        <select name="service_type" value={formData.service_type} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            {lookups.services.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Unit / UOM *</label>
                                        <select name="unit" value={formData.unit} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            {lookups.uoms.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Item Code * (Auto Generated)</label>
                                        <input type="text" readOnly name="item_code" value={formData.item_code} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#1E1F22] text-[#A8C7FA] font-medium outline-none uppercase placeholder-[#5F6368]" placeholder="Generated from Category" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Item Name * (Must be Unique)</label>
                                        <input type="text" name="item_name" value={formData.item_name} onChange={handleInputChange} placeholder="E.g. KEMEJA SECURITY SIZE M" className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none uppercase placeholder-[#5F6368]" />
                                    </div>
                                </div>
                            </div>

                            {isBundle && (
                                <div className="p-4 bg-[#1E1F22] border border-[#333639] rounded-xl space-y-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="text-[11px] font-medium text-[#7FCFFF] uppercase tracking-wider">2. Bundle Contents</div>
                                        <button type="button" onClick={addBundleItem} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-3 py-1 rounded-full flex items-center transition-colors"><Plus className="w-3 h-3 mr-1"/> Add Item</button>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-[#333639]">
                                        <table className="w-full text-[11px] text-left whitespace-nowrap bg-[#131314]">
                                            <thead className="bg-[#1E1F22] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-2 font-medium">Select Item *</th>
                                                    <th className="p-2 font-medium w-20 text-center">Qty *</th>
                                                    <th className="p-2 font-medium w-32 text-right">Unit Price</th>
                                                    <th className="p-2 font-medium text-[#A8C7FA] w-32 text-right">Subtotal</th>
                                                    <th className="p-2 font-medium text-center w-12">Act</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333639]">
                                                {formData.bundle_details.length === 0 && (
                                                    <tr><td colSpan={5} className="p-3 text-center text-[#8E918F]">No items added yet.</td></tr>
                                                )}
                                                {formData.bundle_details.map((bItem, idx) => (
                                                    <tr key={idx} className="hover:bg-[#333639]/20 transition-colors">
                                                        <td className="p-1.5 align-top">
                                                            <select value={bItem.item_id} onChange={(e) => updateBundleItem(idx, 'item_id', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2 py-1 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none uppercase cursor-pointer">
                                                                <option value="" className="text-[#8E918F]">-- SELECT ITEM --</option>
                                                                {items.filter(i => i.category_1 !== 'BUNDLE PACKAGE' && i.item_id !== formData.item_id && (i.active === 'TRUE' || i.active === true || i.active === 'ACTIVE')).map(item => (
                                                                    <option key={item.item_id} value={item.item_id}>{item.item_name} (Rp {parseInt(item.price||0).toLocaleString('id-ID')})</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-1.5 align-top w-20">
                                                            <input type="number" min="1" value={bItem.qty} onChange={(e) => updateBundleItem(idx, 'qty', e.target.value)} className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-lg px-2 py-1 text-[11px] focus:border-[#A8C7FA] outline-none text-center" />
                                                        </td>
                                                        <td className="p-1.5 align-middle text-right text-[#C4C7C5]">Rp {(bItem.unit_price || 0).toLocaleString('id-ID')}</td>
                                                        <td className="p-1.5 align-middle text-right font-medium text-[#A8C7FA]">Rp {(bItem.subtotal || 0).toLocaleString('id-ID')}</td>
                                                        <td className="p-1.5 text-center align-middle w-10"><button type="button" onClick={() => removeBundleItem(idx)} className="text-[#8E918F] hover:text-[#FFB4AB] p-1 transition-colors"><Trash2 className="w-3.5 h-3.5 mx-auto"/></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end p-2 bg-[#004A77]/20 rounded-lg border border-[#004A77]/30">
                                        <span className="text-[11px] font-medium text-[#C4C7C5] mr-4 uppercase">Total Bundle Cost:</span>
                                        <span className="text-[11px] font-bold text-[#7FCFFF]">Rp {totalBundlePrice.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bg-[#1E1F22] rounded-xl border border-[#333639] space-y-3">
                                <div className="text-[11px] font-medium text-[#FFBCA6] uppercase tracking-wider mb-1">{isBundle ? '3.' : '2.'} Financial Params</div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Buy Price (Rp) *</label>
                                        <input type="text" disabled={isBundle} value={isBundle ? totalBundlePrice.toLocaleString('id-ID') : displayPrice} onChange={handlePriceTyping} placeholder="E.g. 1.000.000" className={`w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] outline-none placeholder-[#5F6368] ${isBundle ? 'bg-[#131314] text-[#A8C7FA] font-medium opacity-80' : 'bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA]'}`} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Life (Months) *</label>
                                        <input type="number" min="1" name="lifespan_months" value={formData.lifespan_months} onChange={handleInputChange} placeholder="E.g. 12" className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">COGS / Month</label>
                                        <input type="text" disabled value={`Rp ${calcCogs.toLocaleString('id-ID')}`} className="w-full border border-[#5C3F00]/50 rounded-lg px-2.5 py-1 text-[11px] bg-[#5C3F00]/20 text-[#FFBCA6] font-bold outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#333639]">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#A8C7FA] mb-1.5 uppercase tracking-wide">COGS Sett (%) * (Auto Filled)</label>
                                        <input type="number" name="cogs_sett" value={formData.cogs_sett} onChange={handleInputChange} className="w-full border border-[#004A77]/50 rounded-lg px-2.5 py-1 text-[11px] bg-[#004A77]/20 text-[#7FCFFF] focus:border-[#A8C7FA] outline-none font-bold" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Total Sell Price</label>
                                        <input type="text" disabled value={`Rp ${calcHargaJualTotal.toLocaleString('id-ID')}`} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#C4C7C5] font-medium outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Sell Price / Month</label>
                                        <input type="text" disabled value={`Rp ${calcHargaJualPerBulan.toLocaleString('id-ID')}`} className="w-full border border-[#0F5223]/50 rounded-lg px-2.5 py-1 text-[11px] bg-[#0F5223]/20 text-[#6DD58C] font-bold outline-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-[#1E1F22] border border-[#333639] rounded-xl space-y-3">
                                <div className="text-[11px] font-medium text-[#E3E3E3] uppercase tracking-wider mb-1">{isBundle ? '4.' : '3.'} Warehouse Settings</div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Min Stock *</label>
                                        <input type="number" name="minimum_stock" value={formData.minimum_stock} onChange={handleInputChange} placeholder="E.g. 10" className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">ROP *</label>
                                        <input type="number" name="reorder_point" value={formData.reorder_point} onChange={handleInputChange} placeholder="E.g. 20" className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none placeholder-[#5F6368]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Status *</label>
                                        <select name="active" value={formData.active} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none">
                                            <option value="TRUE">ACTIVE</option>
                                            <option value="FALSE">INACTIVE</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-5 py-3 border-t border-[#333639] bg-[#1E1F22] flex justify-end space-x-3 rounded-b-[16px] shrink-0">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#E3E3E3] hover:bg-[#333639] text-[11px] font-medium px-4 py-1.5 rounded-full">Cancel</button>
                            <button type="button" onClick={handleSubmit} disabled={submitting} className="bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-medium px-5 py-1.5 rounded-full disabled:opacity-50">
                                {submitting ? 'Saving...' : (isEditing ? 'Update Item' : 'Save Item')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}