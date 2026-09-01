import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowUpRight, ArrowDownRight, MoreVertical, Calendar, Download, FileText, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    // --- STATE EXISTING ---
    const [stats, setStats] = useState({ totalProjects: 0, pendingReqs: 0, lowStocks: 0, recentReqs: [], stockAlerts: [] });
    const [loading, setLoading] = useState(true);

    // --- STATE CHART BARU ---
    const [chartData, setChartData] = useState([]);
    const [chartSummary, setChartSummary] = useState({ totalCogsTarget: 0, totalCogsReal: 0 });

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // MENGGABUNGKAN SEMUA PENGAMBILAN DATA DALAM 1 REQUEST AGAR EFISIEN
                const [projectsRes, reqsRes, stockRes, allocRes, itemsRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/projects').catch(() => ({ data: { data: [] } })),
                    axios.get('http://localhost:5000/api/requirements').catch(() => ({ data: { data: [] } })),
                    axios.get('http://localhost:5000/api/stock').catch(() => ({ data: { data: [] } })),
                    axios.get('http://localhost:5000/api/allocations').catch(() => ({ data: { data: [] } })),
                    axios.get('http://localhost:5000/api/items').catch(() => ({ data: { data: [] } }))
                ]);
                
                const projects = projectsRes.data?.data || [];
                const requirements = reqsRes.data?.data || [];
                const stocks = stockRes.data?.data || [];
                const allocations = allocRes.data?.data || [];
                const items = itemsRes.data?.data || [];

                // ==========================================
                // 1. LOGIKA STATISTIK EXISTING
                // ==========================================
                const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
                const pendingRequirements = requirements.filter(r => r.decision === 'NEED_APPROVAL');
                const lowStockItems = stocks.filter(s => {
                    const available = (parseInt(s.on_hand) || 0) - (parseInt(s.reserved) || 0);
                    return available <= (parseInt(s.minimum_stock) || 0);
                });

                setStats({
                    totalProjects: activeProjects,
                    pendingReqs: pendingRequirements.length,
                    lowStocks: lowStockItems.length,
                    recentReqs: requirements.slice(-5).reverse(),
                    stockAlerts: lowStockItems.slice(0, 5)
                });

                // ==========================================
                // 2. LOGIKA PERHITUNGAN CHART OPERASIONAL
                // ==========================================
                let grandTotalCogsTarget = 0;
                let grandTotalCogsReal = 0;
                const formattedData = [];

                // Fokus ke 5 Project Aktif agar chart rapi
                const activeProjsData = projects.filter(p => p.status === 'ACTIVE').slice(0, 5);

                activeProjsData.forEach(proj => {
                    let targetRev = 0;
                    let targetCogs = 0;
                    let realCogs = 0;

                    let ops = { common_units: [], common_equipments: [], special_units: [], others: [] };
                    try {
                        if (typeof proj.operational_items === 'string') ops = JSON.parse(proj.operational_items);
                        else if (proj.operational_items) ops = proj.operational_items;
                    } catch (e) {}

                    // Hanya ambil Common Unit, Common Equipment, Special Expertise (Tanpa Others)
                    ['common_units', 'common_equipments', 'special_units'].forEach(cat => {
                        if (Array.isArray(ops[cat])) {
                            ops[cat].forEach(item => {
                                const qty = parseInt(item.qty) || 0;
                                targetRev += parseFloat(item.final_sell_total) || 0;
                                targetCogs += (parseFloat(item.cogs_mo) || 0) * qty;
                            });
                        }
                    });

                    // Cari COGS Realisasi dari Allocations
                    const projAllocations = allocations.filter(a => a.project_id === proj.project_id && a.status !== 'REJECTED');
                    projAllocations.forEach(alloc => {
                        let allocItems = [];
                        try {
                            if (typeof alloc.allocated_items === 'string') allocItems = JSON.parse(alloc.allocated_items);
                            else if (Array.isArray(alloc.allocated_items)) allocItems = alloc.allocated_items;
                        } catch (e) {}

                        allocItems.forEach(ai => {
                            const sentQty = parseInt(ai.alloc_qty) || parseInt(ai.allocated_qty) || parseInt(ai.qty) || 0;
                            const masterItem = items.find(m => m.item_id === ai.item_id);
                            if (masterItem) {
                                realCogs += (parseFloat(masterItem.price) || 0) * sentQty;
                            }
                        });
                    });

                    grandTotalCogsTarget += targetCogs;
                    grandTotalCogsReal += realCogs;

                    formattedData.push({
                        name: (proj.project_name || proj.project_id).substring(0, 15) + '...',
                        'Revenue (Target)': targetRev,
                        'COGS (Target)': targetCogs,
                        'COGS (Realisasi)': realCogs
                    });
                });

                setChartData(formattedData);
                setChartSummary({ totalCogsTarget: grandTotalCogsTarget, totalCogsReal: grandTotalCogsReal });

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const formatRupiah = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumSignificantDigits: 3 }).format(value);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#121214] border border-[#27272A] p-3 rounded-lg shadow-2xl">
                    <p className="text-white font-semibold text-[11px] mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center space-x-2 text-[10px] my-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-[#8A8A93]">{entry.name}:</span>
                            <span className="text-white font-bold">{formatRupiah(entry.value)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full text-gray-500 text-xs animate-pulse">
            Syncing data blocks...
        </div>
    );

    const isOverBudget = chartSummary.totalCogsReal > chartSummary.totalCogsTarget;

    return (
        <div className="max-w-[1400px] mx-auto space-y-4">
            
            {/* --- HEADER --- */}
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-medium text-white tracking-tight">Overview</h2>
                <div className="flex space-x-3">
                    <button className="flex items-center text-[11px] text-gray-400 hover:text-white transition">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" /> Last 30 days
                    </button>
                    <button className="flex items-center text-[11px] bg-[#121214] border border-[#27272A] hover:bg-[#18181B] text-white px-3 py-1.5 rounded-lg transition">
                        <Download className="w-3 h-3 mr-1.5" /> Export
                    </button>
                </div>
            </div>

            {/* --- 3 KOTAK SUMMARY --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 relative group hover:border-[#3F3F46] transition">
                    <button className="absolute top-4 right-4 text-gray-500 hover:text-white"><MoreVertical className="w-4 h-4"/></button>
                    <p className="text-[11px] text-[#8A8A93] font-medium mb-3">Active Projects</p>
                    <div className="flex items-end space-x-3">
                        <h3 className="text-3xl font-semibold text-white tracking-tight">{stats.totalProjects}</h3>
                        <div className="flex items-center bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" /> 12.5%
                        </div>
                    </div>
                </div>

                <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 relative group hover:border-[#3F3F46] transition">
                    <button className="absolute top-4 right-4 text-gray-500 hover:text-white"><MoreVertical className="w-4 h-4"/></button>
                    <p className="text-[11px] text-[#8A8A93] font-medium mb-3">Pending Approvals</p>
                    <div className="flex items-end space-x-3">
                        <h3 className="text-3xl font-semibold text-white tracking-tight">{stats.pendingReqs}</h3>
                        <div className="flex items-center bg-red-500/10 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">
                            <ArrowDownRight className="w-3 h-3 mr-0.5" /> Action Needed
                        </div>
                    </div>
                </div>

                <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 relative group hover:border-[#3F3F46] transition">
                    <button className="absolute top-4 right-4 text-gray-500 hover:text-white"><MoreVertical className="w-4 h-4"/></button>
                    <p className="text-[11px] text-[#8A8A93] font-medium mb-3">Stock Alerts</p>
                    <div className="flex items-end space-x-3">
                        <h3 className="text-3xl font-semibold text-white tracking-tight">{stats.lowStocks}</h3>
                        <div className="flex items-center bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" /> Secured
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CHART OPERASIONAL --- */}
            <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-3 sm:space-y-0">
                    <div>
                        <h3 className="text-sm font-medium text-white flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2 text-[#A8C7FA]" /> 
                            Operational Financial Analysis
                        </h3>
                        <p className="text-[10px] text-[#8A8A93] mt-1 uppercase tracking-wide">REVENUE VS COGS (EXCLUDING OTHERS)</p>
                    </div>

                    <div className="flex space-x-3">
                        <div className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5">
                            <p className="text-[9px] text-[#8A8A93] uppercase tracking-wider mb-0.5">OVERALL TARGET COGS</p>
                            <p className="text-[11px] font-bold text-[#A8C7FA]">{formatRupiah(chartSummary.totalCogsTarget)}</p>
                        </div>
                        <div className={`border rounded-lg px-3 py-1.5 flex items-center ${isOverBudget ? 'bg-red-500/10 border-red-900/50' : 'bg-emerald-500/10 border-emerald-900/50'}`}>
                            <div>
                                <p className="text-[9px] text-[#8A8A93] uppercase tracking-wider mb-0.5">OVERALL REALISASI COGS</p>
                                <p className={`text-[11px] font-bold ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>{formatRupiah(chartSummary.totalCogsReal)}</p>
                            </div>
                            {isOverBudget && <AlertCircle className="w-4 h-4 ml-3 text-red-400" title="Over Budget!" />}
                        </div>
                    </div>
                </div>

                <div className="w-full h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis dataKey="name" stroke="#8A8A93" tick={{ fontSize: 9, fill: '#8A8A93' }} tickLine={false} axisLine={false} />
                            <YAxis stroke="#8A8A93" tick={{ fontSize: 9, fill: '#8A8A93' }} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp${val/1000000}M`} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272A', opacity: 0.4 }} />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                            
                            <Bar dataKey="Revenue (Target)" fill="#A8C7FA" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="COGS (Target)" fill="#FFBCA6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="COGS (Realisasi)" fill="#6DD58C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- RECENT REQUIREMENTS & CRITICAL INVENTORY --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-white">Recent Requirements</h3>
                        <select className="bg-[#18181B] border border-[#27272A] text-[10px] text-gray-300 rounded px-2 py-1 outline-none">
                            <option>This week</option>
                            <option>This month</option>
                        </select>
                    </div>
                    
                    <div className="space-y-1 flex-1">
                        {stats.recentReqs.length === 0 ? (
                            <p className="text-[11px] text-gray-600 italic">No recent activity.</p>
                        ) : (
                            stats.recentReqs.map((req, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 border-b border-[#1c1c1f] hover:bg-[#18181B] px-2 rounded transition cursor-pointer">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-[#18181B] border border-[#27272A] flex items-center justify-center text-gray-400">
                                            <FileText className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-medium text-gray-200">{req.project_id}</span>
                                            <span className="text-[9px] text-[#8A8A93]">ID: {req.request_id}</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-[#8A8A93] w-24 truncate">{req.item_id}</div>
                                    <div className="text-right">
                                        <span className={`text-[11px] font-semibold ${
                                            req.decision === 'NEED_APPROVAL' ? 'text-yellow-500' :
                                            req.decision === 'REJECTED' ? 'text-red-500' : 'text-emerald-500'
                                        }`}>
                                            {req.decision}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#121214] border border-[#27272A] rounded-2xl p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-white">Critical Inventory</h3>
                        <button className="text-[10px] text-gray-400 hover:text-white transition">View All</button>
                    </div>
                    
                    <div className="space-y-1 flex-1">
                        {stats.stockAlerts.length === 0 ? (
                            <p className="text-[11px] text-gray-600 italic">All stocks are at safe levels.</p>
                        ) : (
                            stats.stockAlerts.map((stk, idx) => {
                                const available = (parseInt(stk.on_hand) || 0) - (parseInt(stk.reserved) || 0);
                                return (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-[#1c1c1f] hover:bg-[#18181B] px-2 rounded transition cursor-pointer">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-900/50 flex items-center justify-center text-red-500">
                                                <Package className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-medium text-gray-200">{stk.item_id}</span>
                                                <span className="text-[9px] text-[#8A8A93]">Loc: {stk.warehouse}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[12px] font-bold text-white">{available} <span className="text-[9px] font-normal text-gray-500">Qty</span></span>
                                            <span className="text-[9px] text-red-400">Min: {stk.minimum_stock}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}