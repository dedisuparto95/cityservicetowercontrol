import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, AlertTriangle, PackageCheck } from 'lucide-react';

export default function Stock() {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/stock');
                setStocks(response.data.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStocks();
    }, []);

    const filteredStocks = stocks.filter(s => 
        (s.item_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.warehouse || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="text-[#8A8A93] text-xs">Loading inventory data...</div>;

    return (
        <div className="relative space-y-4 max-w-[1400px] mx-auto">
            <div className="bg-[#121214] rounded-2xl border border-[#27272A] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#27272A] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121214] space-y-4 sm:space-y-0">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Central Inventory</h2>
                        <p className="text-[11px] text-[#8A8A93]">{filteredStocks.length} Items Indexed</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <input type="text" placeholder="Search Item ID / Location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-[#27272A] rounded-lg bg-[#09090B] text-gray-300 text-[11px] focus:outline-none focus:border-gray-500" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-[10px] text-[#8A8A93] uppercase bg-[#18181B] border-b border-[#27272A]">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Item ID</th>
                                <th className="px-5 py-3 font-semibold">Warehouse</th>
                                <th className="px-5 py-3 font-semibold text-right">On Hand</th>
                                <th className="px-5 py-3 font-semibold text-right">Reserved</th>
                                <th className="px-5 py-3 font-semibold text-right text-emerald-400">Available</th>
                                <th className="px-5 py-3 font-semibold text-right">Min Stock</th>
                                <th className="px-5 py-3 font-semibold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1f]">
                            {filteredStocks.map((stk, idx) => {
                                const onHand = parseInt(stk.on_hand) || 0;
                                const reserved = parseInt(stk.reserved) || 0;
                                const available = onHand - reserved;
                                const minStock = parseInt(stk.minimum_stock) || 0;
                                const isCritical = available <= minStock;

                                return (
                                <tr key={idx} className="hover:bg-[#18181B] transition">
                                    <td className="px-5 py-3 text-[11px] font-bold text-white">{stk.item_id}</td>
                                    <td className="px-5 py-3 text-[11px] text-gray-300">{stk.warehouse}</td>
                                    <td className="px-5 py-3 text-[11px] text-right">{onHand}</td>
                                    <td className="px-5 py-3 text-[11px] text-right text-yellow-500">{reserved}</td>
                                    <td className="px-5 py-3 text-[12px] text-right font-bold text-emerald-400">{available}</td>
                                    <td className="px-5 py-3 text-[11px] text-right text-[#8A8A93]">{minStock}</td>
                                    <td className="px-5 py-3 text-center">
                                        {isCritical ? (
                                            <span className="inline-flex items-center bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                                                <AlertTriangle className="w-3 h-3 mr-1" /> CRITICAL
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                                                <PackageCheck className="w-3 h-3 mr-1" /> SAFE
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}