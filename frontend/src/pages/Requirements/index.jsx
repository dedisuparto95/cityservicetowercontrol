import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Plus, Check, X, Clock } from 'lucide-react';

export default function Requirements() {
    const [requirements, setRequirements] = useState([]);
    const [projects, setProjects] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ project_id: '', item_id: '', requested_qty: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqRes, projRes, itemRes] = await Promise.all([
                axios.get('http://localhost:5000/api/requirements'),
                axios.get('http://localhost:5000/api/projects'),
                axios.get('http://localhost:5000/api/items')
            ]);
            setRequirements(reqRes.data.data.reverse());
            setProjects(projRes.data.data.filter(p => p.status === 'ACTIVE'));
            setItems(itemRes.data.data.filter(i => i.active === 'TRUE'));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('http://localhost:5000/api/requirements', formData);
            alert("Requirement berhasil dikirim!");
            setIsModalOpen(false);
            setFormData({ project_id: '', item_id: '', requested_qty: '' });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Gagal mengirim requirement.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleApproval = async (reqId, decision) => {
        if(!window.confirm(`Apakah Anda yakin ingin melakukan ${decision} pada request ${reqId}?`)) return;
        try {
            await axios.post('http://localhost:5000/api/requirements/approve', {
                request_id: reqId,
                decision: decision
            });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Gagal memproses persetujuan");
        }
    };

    const filteredReqs = requirements.filter(r => 
        (r.request_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.project_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.item_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && requirements.length === 0) return <div className="text-[#8A8A93] text-xs">Syncing data...</div>;

    return (
        <div className="relative space-y-4 max-w-[1400px] mx-auto">
            <div className="bg-[#121214] rounded-2xl border border-[#27272A] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#27272A] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121214] space-y-4 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Requirements List</h2>
                        <p className="text-[11px] text-[#8A8A93]">{filteredReqs.length} Requests Found</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <input type="text" placeholder="Search Request / Project..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#27272A] rounded-lg bg-[#09090B] text-gray-300 text-[11px] focus:outline-none focus:border-gray-500" />
                        </div>
                        <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm">
                            <Plus className="w-3.5 h-3.5 mr-1" /> New Request
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-[10px] text-[#8A8A93] uppercase bg-[#18181B] border-b border-[#27272A]">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Req ID</th>
                                <th className="px-5 py-3 font-semibold">Project</th>
                                <th className="px-5 py-3 font-semibold">Item</th>
                                <th className="px-5 py-3 font-semibold text-right">Req Qty</th>
                                <th className="px-5 py-3 font-semibold text-right">Contract Qty</th>
                                <th className="px-5 py-3 font-semibold text-center">Variance</th>
                                <th className="px-5 py-3 font-semibold text-center">Decision</th>
                                <th className="px-5 py-3 font-semibold text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1f]">
                            {filteredReqs.map((req, idx) => {
                                const varPct = parseFloat(String(req.variance_pct).replace(',', '.'));
                                return (
                                <tr key={idx} className="hover:bg-[#18181B] transition">
                                    <td className="px-5 py-3 text-[11px] font-bold text-white">{req.request_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-gray-200">{req.project_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-gray-200">{req.item_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-right font-bold text-white">{req.requested_qty}</td>
                                    <td className="px-5 py-3 text-[11px] text-right text-gray-400">{req.expected_qty}</td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${varPct > 0 ? 'bg-red-500/10 text-red-400' : 'bg-[#27272A] text-gray-400'}`}>
                                            {req.variance_pct || '0%'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                            req.decision === 'APPROVED_STOCK' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                            req.decision === 'NEED_APPROVAL' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
                                            req.decision === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        }`}>
                                            {req.decision}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        {req.decision === 'NEED_APPROVAL' ? (
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => handleApproval(req.request_id, 'APPROVED_STOCK')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 p-1.5 rounded transition"><Check className="w-3.5 h-3.5"/></button>
                                                <button onClick={() => handleApproval(req.request_id, 'REJECTED')} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-1.5 rounded transition"><X className="w-3.5 h-3.5"/></button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-[#8A8A93] flex items-center justify-center"><Clock className="w-3 h-3 mr-1"/> Processed</span>
                                        )}
                                    </td>
                                </tr>
                            )})}
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
                                <h3 className="text-sm font-bold text-white">Create Requirement</h3>
                                <p className="text-[10px] text-[#8A8A93]">Request items from central warehouse.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white text-xl">&times;</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#09090B]">
                            <div>
                                <label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Select Project *</label>
                                <select required name="project_id" value={formData.project_id} onChange={handleChange} className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none">
                                    <option value="">-- Choose Project --</option>
                                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name} ({p.project_id})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Select Item *</label>
                                <select required name="item_id" value={formData.item_id} onChange={handleChange} className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none">
                                    <option value="">-- Choose Item --</option>
                                    {items.map(i => <option key={i.item_id} value={i.item_id}>{i.item_name} ({i.item_code})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#8A8A93] uppercase mb-1">Requested Qty *</label>
                                <input required type="number" min="1" name="requested_qty" value={formData.requested_qty} onChange={handleChange} className="w-full border border-[#27272A] rounded-lg px-3 py-2 text-[11px] bg-[#121214] text-white focus:border-gray-500 outline-none" />
                            </div>
                            
                            <div className="pt-4 flex justify-end space-x-3 border-t border-[#27272A]">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[11px] font-medium text-gray-300 bg-[#27272A] hover:bg-[#3F3F46] rounded-lg transition">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition disabled:opacity-50">
                                    {submitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}