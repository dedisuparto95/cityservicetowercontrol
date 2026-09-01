import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, FileText, Plus } from 'lucide-react';

export default function Entitlements() {
    const [entitlements, setEntitlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchEntitlements = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/entitlements');
                setEntitlements(response.data.data.reverse());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchEntitlements();
    }, []);

    const filteredEnt = entitlements.filter(e => 
        (e.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.item_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="text-[#8A8A93] text-xs">Syncing entitlement contracts...</div>;

    return (
        <div className="relative space-y-4 max-w-[1400px] mx-auto">
            <div className="bg-[#121214] rounded-2xl border border-[#27272A] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#27272A] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121214] space-y-4 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-white flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-emerald-400" /> Contract Entitlements
                        </h2>
                        <p className="text-[11px] text-[#8A8A93]">{filteredEnt.length} Records Found</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <input type="text" placeholder="Search EMP ID / Item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#27272A] rounded-lg bg-[#09090B] text-gray-300 text-[11px] focus:outline-none focus:border-gray-500" />
                        </div>
                        <button className="w-full sm:w-auto flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-[10px] text-[#8A8A93] uppercase bg-[#18181B] border-b border-[#27272A]">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Rule ID</th>
                                <th className="px-5 py-3 font-semibold">EMP ID</th>
                                <th className="px-5 py-3 font-semibold">Item ID</th>
                                <th className="px-5 py-3 font-semibold text-right">Quota / Year</th>
                                <th className="px-5 py-3 font-semibold text-right">Used</th>
                                <th className="px-5 py-3 font-semibold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1f]">
                            {filteredEnt.map((ent, idx) => (
                                <tr key={idx} className="hover:bg-[#18181B] transition">
                                    <td className="px-5 py-3 text-[11px] font-bold text-white">{ent.rule_id || '-'}</td>
                                    <td className="px-5 py-3 text-[11px] text-blue-400">{ent.employee_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-gray-200">{ent.item_id}</td>
                                    <td className="px-5 py-3 text-[12px] text-right font-bold text-emerald-400">{ent.quota || 0}</td>
                                    <td className="px-5 py-3 text-[11px] text-right text-yellow-500">{ent.used || 0}</td>
                                    <td className="px-5 py-3 text-center">
                                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                                            ACTIVE
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredEnt.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-600 italic">No entitlement rules found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}