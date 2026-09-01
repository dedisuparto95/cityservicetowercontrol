import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Plus, Truck } from 'lucide-react';

export default function Vendors() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const initialFormState = { vendor_id: '', vendor_name: '', contact_person: '', phone: '', email: '', address: '', categories: '', active: 'TRUE' };
    const [formData, setFormData] = useState(initialFormState);

    const fetchVendors = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/vendors');
            setVendors(response.data.data.reverse());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchVendors(); }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('http://localhost:5000/api/vendors', formData);
            alert("Vendor berhasil ditambahkan!");
            setIsModalOpen(false);
            fetchVendors();
        } catch (err) {
            alert(err.response?.data?.message || "Gagal menyimpan vendor.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredVendors = vendors.filter(v => 
        (v.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.vendor_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="text-[#8A8A93] text-xs">Syncing vendor database...</div>;

    return (
        <div className="relative space-y-4 max-w-[1400px] mx-auto">
            <div className="bg-[#121214] rounded-2xl border border-[#27272A] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#27272A] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121214] space-y-4 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-white flex items-center">
                            <Truck className="w-4 h-4 mr-2 text-emerald-400" /> Vendor Database
                        </h2>
                        <p className="text-[11px] text-[#8A8A93]">{filteredVendors.length} Registered Suppliers</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <input type="text" placeholder="Search Vendor Name / ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#27272A] rounded-lg bg-[#09090B] text-gray-300 text-[11px] focus:outline-none focus:border-gray-500" />
                        </div>
                        <button onClick={() => { setFormData(initialFormState); setIsModalOpen(true); }} className="w-full sm:w-auto flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm">
                            <Plus className="w-3.5 h-3.5 mr-1" /> New Vendor
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-[10px] text-[#8A8A93] uppercase bg-[#18181B] border-b border-[#27272A]">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Vendor ID</th>
                                <th className="px-5 py-3 font-semibold">Vendor Name</th>
                                <th className="px-5 py-3 font-semibold">Contact Person</th>
                                <th className="px-5 py-3 font-semibold">Categories</th>
                                <th className="px-5 py-3 font-semibold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1f]">
                            {filteredVendors.map((v, idx) => (
                                <tr key={idx} className="hover:bg-[#18181B] transition">
                                    <td className="px-5 py-3 text-[11px] font-bold text-white">{v.vendor_id || '-'}</td>
                                    <td className="px-5 py-3 text-[11px] font-semibold text-gray-200">{v.vendor_name}</td>
                                    <td className="px-5 py-3 text-[11px]">
                                        <div className="text-gray-300">{v.contact_person}</div>
                                        <div className="text-[9px] text-gray-500">{v.phone}</div>
                                    </td>
                                    <td className="px-5 py-3 text-[11px] text-gray-400">{v.categories || '-'}</td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${v.active === 'TRUE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#27272A] text-gray-400 border-transparent'}`}>
                                            {v.active === 'TRUE' ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredVendors.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-600 italic">No vendors found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DARK THEME */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#121214] border border-[#27272A] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-[#27272A] bg-[#18181B] flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-white">Register New Vendor</h3>
                                <p className="text-[10px] text-[#8A8A93]">Add a new supplier to the system.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white text-xl">&times;</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#09090B]">
                            <div>
                                <label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Company / Vendor Name *</label>
                                <input required type="text" name="vendor_name" value={formData.vendor_name} onChange={handleChange} className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Contact Person</label><input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none" /></div>
                                <div><label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Phone Number</label><input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none" /></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Supplied Categories</label>
                                <input type="text" name="categories" value={formData.categories} onChange={handleChange} placeholder="e.g. UNIFORM, CHEMICALS" className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none" />
                            </div>
                            
                            <div className="pt-4 flex justify-end space-x-3 border-t border-[#27272A]">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[11px] font-medium text-gray-300 bg-[#27272A] hover:bg-[#3F3F46] rounded-lg transition">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition disabled:opacity-50">
                                    {submitting ? 'Processing...' : 'Register Vendor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}