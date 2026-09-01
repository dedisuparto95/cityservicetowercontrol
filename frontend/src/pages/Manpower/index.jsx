import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Search, Plus, XCircle, ChevronDown, Package, Download, Layers, Trash2 } from 'lucide-react';

export default function Items() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('SINGLE');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lookups, setLookups] = useState({ categories1: [], categories2: [], categories3: [], types: [], brands: [], uoms: [] });
    const modalRef = useRef(null);

    const initialFormState = {
        item_id: '', item_code: '', item_name: '', category_1: '', category_2: '', category_3: '',
        type: '', brand: '', uom: '', purchase_price: 0, life_time_month: 1,
        cogs_per_month: 0, settlement_percentage: 0, selling_price_per_month: 0, bundle_details: []
    };
    const [formData, setFormData] = useState(initialFormState);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [itemsRes, lookupsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/items'),
                axios.get('http://localhost:5000/api/lookups')
            ]);
            setItems(Array.isArray(itemsRes.data.data) ? itemsRes.data.data.reverse() : []);
            setLookups(lookupsRes.data.data || { categories1: [], categories2: [], categories3: [], types: [], brands: [], uoms: [] });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Tekan ESC untuk menutup modal pop-up
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape' && isModalOpen) setIsModalOpen(false); };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isModalOpen]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            
            // Auto Calculate Financials
            if (['purchase_price', 'life_time_month', 'settlement_percentage'].includes(name)) {
                const price = parseFloat(updated.purchase_price) || 0;
                const life = parseFloat(updated.life_time_month) || 1;
                const sett = parseFloat(updated.settlement_percentage) || 0;
                
                const cogs = Math.round(price / life);
                const sell = Math.round(cogs * (1 + (sett / 100)));
                
                updated.cogs_per_month = cogs;
                updated.selling_price_per_month = sell;
            }
            return updated;
        });
    };

    const handleBundleChange = (index, field, value) => {
        setFormData(prev => {
            const newBundle = [...prev.bundle_details];
            newBundle[index][field] = value;
            return { ...prev, bundle_details: newBundle };
        });
    };

    const addBundleRow = () => {
        setFormData(prev => ({
            ...prev,
            bundle_details: [...prev.bundle_details, { item_id: '', qty: 1 }]
        }));
    };

    const removeBundleRow = (index) => {
        setFormData(prev => {
            const newBundle = [...prev.bundle_details];
            newBundle.splice(index, 1);
            return { ...prev, bundle_details: newBundle };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...formData };
            if (formData.category_1 === 'BUNDLE PACKAGE') {
                payload.bundle_details = JSON.stringify(formData.bundle_details);
            } else {
                payload.bundle_details = '[]';
            }

            if (formData.item_id) await axios.put(`http://localhost:5000/api/items/${formData.item_id}`, payload);
            else await axios.post('http://localhost:5000/api/items', payload);
            
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert(`Gagal menyimpan data!\n${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (item) => {
        let parsedBundle = [];
        if (typeof item.bundle_details === 'string') {
            try { parsedBundle = JSON.parse(item.bundle_details); } catch(e){}
        } else if (Array.isArray(item.bundle_details)) {
            parsedBundle = item.bundle_details;
        }
        
        setFormData({ ...item, bundle_details: parsedBundle });
        setIsModalOpen(true);
    };

    const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

    const filteredItems = items.filter(item => {
        const matchSearch = (item.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.item_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.item_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const isBundle = item.category_1 === 'BUNDLE PACKAGE';
        const matchTab = activeTab === 'BUNDLE' ? isBundle : !isBundle;
        
        return matchSearch && matchTab;
    });

    if (loading && items.length === 0) return <div className="text-[#C4C7C5] text-xs p-4">Syncing data...</div>;

    return (
        <div className="relative space-y-4 w-full mx-auto font-sans antialiased text-[#E3E3E3]">
            <div className="bg-[#1E1F22] rounded-[16px] border border-[#333639] overflow-hidden shadow-sm">
                
                {/* HEADER */}
                <div className="px-5 py-3 border-b border-[#333639] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1E1F22] space-y-3 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-[#E3E3E3] tracking-wide">Master Items</h2>
                        <p className="text-[10px] text-[#8E918F] mt-0.5">{filteredItems.length} Records Found</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-56">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-[#8E918F]" /></div>
                            <input type="text" placeholder="Search Code/Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#333639] rounded-full bg-[#131314] text-[#E3E3E3] text-[11px] focus:outline-none focus:border-[#A8C7FA] transition-all" />
                        </div>
                        <button className="w-full sm:w-auto flex items-center justify-center bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] text-[11px] font-medium px-4 py-1.5 rounded-full transition-colors">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                        </button>
                        <button onClick={() => { setFormData(initialFormState); setIsModalOpen(true); }} className="w-full sm:w-auto flex items-center justify-center bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-semibold px-4 py-1.5 rounded-full transition-colors">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                        </button>
                    </div>
                </div>

                {/* TABS */}
                <div className="px-5 py-1.5 flex space-x-2 bg-[#1E1F22] border-b border-[#333639]">
                    <button onClick={() => setActiveTab('SINGLE')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center ${activeTab === 'SINGLE' ? 'bg-[#D3E3FD] text-[#062E6F]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Layers className="w-3.5 h-3.5 mr-1.5"/> Single Items
                    </button>
                    <button onClick={() => setActiveTab('BUNDLE')} className={`px-4 py-1 text-[11px] font-medium rounded-full transition-all flex items-center ${activeTab === 'BUNDLE' ? 'bg-[#FFBCA6]/20 text-[#FFBCA6]' : 'bg-[#131314] text-[#C4C7C5] hover:bg-[#333639]'}`}>
                        <Package className="w-3.5 h-3.5 mr-1.5"/> Bundle Packages
                    </button>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] text-[#8E918F] uppercase tracking-wider bg-[#131314] border-b border-[#333639]">
                            <tr>
                                <th className="px-4 py-2 font-medium">ID</th>
                                <th className="px-4 py-2 font-medium">Item Details</th>
                                <th className="px-4 py-2 font-medium">Category</th>
                                <th className="px-4 py-2 font-medium text-right">Price</th>
                                <th className="px-4 py-2 font-medium text-center">Life</th>
                                <th className="px-4 py-2 font-medium text-right">COGS/Mo</th>
                                <th className="px-4 py-2 font-medium text-center">Sett</th>
                                <th className="px-4 py-2 font-medium text-right">Sell/Mo</th>
                                <th className="px-4 py-2 font-medium text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333639] text-[11px]">
                            {filteredItems.length === 0 && <tr><td colSpan={9} className="text-center p-6 text-[#8E918F]">No items found.</td></tr>}
                            {filteredItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-[#333639]/30 transition-colors">
                                    <td className="px-4 py-2 font-medium text-[#E3E3E3]">{item.item_id}</td>
                                    <td className="px-4 py-2">
                                        <div className="font-medium text-[#A8C7FA] truncate max-w-[200px]">{item.item_name}</div>
                                        <div className="text-[9px] text-[#8E918F] mt-0.5">{item.item_code}</div>
                                    </td>
                                    <td className="px-4 py-2 space-y-1">
                                        <div className="inline-block bg-[#333639] text-[#E3E3E3] px-2 py-0.5 rounded text-[8px] uppercase tracking-wide mr-1">{item.category_1}</div>
                                        {item.category_2 && <div className="inline-block bg-[#131314] border border-[#333639] text-[#8E918F] px-2 py-0.5 rounded text-[8px] uppercase tracking-wide">{item.category_2}</div>}
                                    </td>
                                    <td className="px-4 py-2 text-right text-[#E3E3E3]">{formatRp(item.purchase_price)}</td>
                                    <td className="px-4 py-2 text-center text-[#8E918F]">{item.life_time_month}</td>
                                    <td className="px-4 py-2 text-right font-medium text-[#FFBCA6]">{formatRp(item.cogs_per_month)}</td>
                                    <td className="px-4 py-2 text-center text-[#E3E3E3]">{item.settlement_percentage}%</td>
                                    <td className="px-4 py-2 text-right font-bold text-[#6DD58C]">{formatRp(item.selling_price_per_month)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => openEditModal(item)} className="text-[#A8C7FA] hover:text-[#062E6F] text-[10px] font-medium bg-[#A8C7FA]/10 hover:bg-[#A8C7FA] px-3 py-1 rounded-full transition-colors">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL ADD/EDIT ITEM */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1E1F22] border border-[#333639] rounded-[16px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" ref={modalRef}>
                        <div className="px-5 py-3 border-b border-[#333639] bg-[#1E1F22] flex justify-between items-center rounded-t-[16px]">
                            <div>
                                <h3 className="text-sm font-semibold text-[#E3E3E3]">{formData.item_id ? `Edit Item: ${formData.item_id}` : 'Add New Item'}</h3>
                                <p className="text-[10px] text-[#8E918F] mt-0.5">Fill in the item specifications and financials</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#8E918F] hover:text-[#E3E3E3] p-1 rounded-full hover:bg-[#333639]"><XCircle className="w-5 h-5" /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#131314] custom-scrollbar">
                            
                            <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-4">
                                <h4 className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider mb-3">1. Basic Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Item Code *</label>
                                        <input type="text" required name="item_code" value={formData.item_code} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none uppercase" placeholder="E.g. UNI-SEC-M" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Item Name *</label>
                                        <input type="text" required name="item_name" value={formData.item_name} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none uppercase" placeholder="E.g. Seragam Security Size M" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-4">
                                <h4 className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider mb-3">2. Classifications</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Main Category *</label>
                                        <select required name="category_1" value={formData.category_1} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            <option value="BUNDLE PACKAGE" className="font-bold text-[#FFBCA6]">BUNDLE PACKAGE</option>
                                            {lookups.categories1.filter(c => c !== 'BUNDLE PACKAGE').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Sub Category</label>
                                        <select name="category_2" value={formData.category_2} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            {lookups.categories2.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Type</label>
                                        <select name="type" value={formData.type} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            {lookups.types.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">UOM *</label>
                                        <select required name="uom" value={formData.uom} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none cursor-pointer">
                                            <option value="">-- Select --</option>
                                            {lookups.uoms.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {formData.category_1 !== 'BUNDLE PACKAGE' && (
                                <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-4">
                                    <h4 className="text-[11px] font-medium text-[#A8C7FA] uppercase tracking-wider mb-3">3. Financials</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Purchase Price (Rp) *</label>
                                            <input type="number" required min="0" name="purchase_price" value={formData.purchase_price} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Life (Months) *</label>
                                            <input type="number" required min="1" name="life_time_month" value={formData.life_time_month} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none text-center" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">COGS/Mo (Rp)</label>
                                            <div className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#FFBCA6] font-bold outline-none cursor-not-allowed opacity-80">{formatRp(formData.cogs_per_month)}</div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-[#8E918F] mb-1.5 uppercase tracking-wide">Settlement (%) *</label>
                                            <input type="number" required min="0" name="settlement_percentage" value={formData.settlement_percentage} onChange={handleInputChange} className="w-full border border-[#333639] rounded-lg px-2.5 py-1.5 text-[11px] bg-[#131314] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none text-center" />
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-[#333639] flex justify-between items-center">
                                        <span className="text-[11px] font-medium text-[#8E918F]">Auto-Calculated Selling Price:</span>
                                        <span className="text-sm font-bold text-[#6DD58C] bg-[#0F5223] px-3 py-1 rounded-md">{formatRp(formData.selling_price_per_month)} / Month</span>
                                    </div>
                                </div>
                            )}

                            {formData.category_1 === 'BUNDLE PACKAGE' && (
                                <div className="bg-[#1E1F22] border border-[#333639] rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[11px] font-medium text-[#FFBCA6] uppercase tracking-wider">Bundle Contents</h4>
                                        <button type="button" onClick={addBundleRow} className="text-[10px] bg-[#333639] hover:bg-[#444746] text-[#E3E3E3] px-2.5 py-1 rounded-full flex items-center transition-colors">
                                            <Plus className="w-3 h-3 mr-1"/> Add Item
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-[#333639]">
                                        <table className="w-full text-[11px] text-left">
                                            <thead className="bg-[#131314] border-b border-[#333639] text-[#8E918F] text-[10px] uppercase">
                                                <tr>
                                                    <th className="p-2 font-medium">Included Item</th>
                                                    <th className="p-2 font-medium text-center w-24">Qty / Set</th>
                                                    <th className="p-2 font-medium text-center w-12">Act</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#333639]">
                                                {formData.bundle_details.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-[#8E918F]">No items added to bundle.</td></tr>}
                                                {formData.bundle_details.map((b, i) => (
                                                    <tr key={i}>
                                                        <td className="p-2">
                                                            <select value={b.item_id} onChange={(e) => handleBundleChange(i, 'item_id', e.target.value)} className="w-full border border-[#333639] rounded-lg px-2 py-1.5 text-[11px] bg-[#1E1F22] text-[#E3E3E3] focus:border-[#A8C7FA] outline-none">
                                                                <option value="">-- Select Sub-Item --</option>
                                                                {items.filter(it => it.category_1 !== 'BUNDLE PACKAGE').map(it => (
                                                                    <option key={it.item_id} value={it.item_id}>{it.item_name} ({it.item_code})</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input type="number" min="1" value={b.qty} onChange={(e) => handleBundleChange(i, 'qty', e.target.value)} className="w-full border border-[#333639] bg-[#1E1F22] text-[#E3E3E3] rounded-lg px-2 py-1.5 text-[11px] focus:border-[#A8C7FA] outline-none text-center font-bold" />
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button type="button" onClick={() => removeBundleRow(i)} className="text-[#8E918F] hover:text-[#FFB4AB] p-1 rounded-full"><Trash2 className="w-3.5 h-3.5 mx-auto"/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </form>

                        <div className="px-5 py-3 border-t border-[#333639] bg-[#1E1F22] flex justify-end space-x-3 rounded-b-[16px]">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#E3E3E3] hover:bg-[#333639] text-[11px] font-medium px-4 py-1.5 rounded-full">Cancel</button>
                            <button type="submit" onClick={handleSubmit} disabled={submitting} className="bg-[#C4EED0] hover:bg-[#93D7A6] text-[#072711] text-[11px] font-medium px-5 py-1.5 rounded-full disabled:opacity-50">
                                {submitting ? 'Saving...' : 'Save Item Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}