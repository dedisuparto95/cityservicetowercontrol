import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, ShoppingCart, Download } from 'lucide-react';

export default function PurchaseOrders() {
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchPOs = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/purchase-orders');
                setPos(response.data.data.reverse());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchPOs();
    }, []);

    const filteredPOs = pos.filter(po => 
        (po.po_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (po.vendor_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="text-[#8A8A93] text-xs">Syncing PO documents...</div>;

    return (
        <div className="relative space-y-4 max-w-[1400px] mx-auto">
            <div className="bg-[#121214] rounded-2xl border border-[#27272A] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#27272A] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121214] space-y-4 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-white flex items-center">
                            <ShoppingCart className="w-4 h-4 mr-2 text-emerald-400" /> Purchase Orders
                        </h2>
                        <p className="text-[11px] text-[#8A8A93]">{filteredPOs.length} Active Orders</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <input type="text" placeholder="Search PO ID / Vendor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#27272A] rounded-lg bg-[#09090B] text-gray-300 text-[11px] focus:outline-none focus:border-gray-500" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-[10px] text-[#8A8A93] uppercase bg-[#18181B] border-b border-[#27272A]">
                            <tr>
                                <th className="px-5 py-3 font-semibold">PO ID</th>
                                <th className="px-5 py-3 font-semibold">PR Source</th>
                                <th className="px-5 py-3 font-semibold">Vendor ID</th>
                                <th className="px-5 py-3 font-semibold text-right">Total Price</th>
                                <th className="px-5 py-3 font-semibold text-center">Date</th>
                                <th className="px-5 py-3 font-semibold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1f]">
                            {filteredPOs.map((po, idx) => (
                                <tr key={idx} className="hover:bg-[#18181B] transition">
                                    <td className="px-5 py-3 text-[11px] font-bold text-white">{po.po_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-gray-500">{po.pr_id}</td>
                                    <td className="px-5 py-3 text-[11px] font-medium text-gray-200">{po.vendor_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-right text-emerald-400 font-bold">Rp {parseInt(po.total_price || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-5 py-3 text-[11px] text-center text-gray-400">{po.po_date || '-'}</td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                            po.status === 'SENT' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                            po.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                            'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                        }`}>
                                            {po.status || 'DRAFT'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredPOs.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-600 italic">No PO documents found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}