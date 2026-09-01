import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Package, Users, Box, FileText, Truck, ClipboardList, ArrowRightLeft, Layers, ShoppingCart, FileSignature, CheckCircle, ArrowDownToLine, Bell, Search, UserCircle2 } from 'lucide-react';

export default function MainLayout() {
    const location = useLocation();
    
    // Gaya "Finotive Dark": Menu aktif sangat *subtle* (abu-abu terang), menu tidak aktif abu-abu gelap.
    const isActive = (path) => location.pathname === path 
        ? "bg-[#2A2A2E] text-white font-medium rounded-lg" 
        : "text-[#8A8A93] hover:bg-[#1E1E22] hover:text-white rounded-lg transition-colors";

    return (
        // Background utama aplikasi sangat gelap (Nyaris hitam)
        <div className="flex h-screen bg-[#09090B] font-sans text-gray-200">
            
            {/* SIDEBAR (Dark & Compact) */}
            <aside className="w-56 bg-[#121214] border-r border-[#27272A] flex flex-col z-10 flex-shrink-0 p-3">
                {/* Logo Area */}
                <div className="h-12 flex items-center px-3 mb-4 rounded-xl bg-[#18181B] border border-[#27272A]">
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-emerald-500 rounded-sm flex items-center justify-center rotate-45"></div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight">City Service</span>
                            <span className="text-[9px] text-gray-500 leading-tight">Control Tower</span>
                        </div>
                    </div>
                </div>
                
                {/* Navigasi - Spasi dan Font diperkecil */}
                <nav className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                    <div className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#52525B]">General</div>
                    <Link to="/" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/')}`}><LayoutDashboard className="w-3.5 h-3.5 mr-2.5" /> Dashboard</Link>
                    
                    <div className="px-3 pt-4 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#52525B]">Operations</div>
                    <Link to="/projects" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/projects')}`}><Briefcase className="w-3.5 h-3.5 mr-2.5" /> Projects</Link>
                    <Link to="/manpower" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/manpower')}`}><Users className="w-3.5 h-3.5 mr-2.5" /> Manpower</Link>
                    <Link to="/entitlements" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/entitlements')}`}><FileText className="w-3.5 h-3.5 mr-2.5" /> Entitlements</Link>
                    <Link to="/requirements" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/requirements')}`}><ClipboardList className="w-3.5 h-3.5 mr-2.5" /> Requirements</Link>
                    
                    <div className="px-3 pt-4 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#52525B]">Supply Chain</div>
                    <Link to="/receiving" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/receiving')}`}><ArrowDownToLine className="w-3.5 h-3.5 mr-2.5" /> Receiving</Link>
                    <Link to="/qc" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/qc')}`}><CheckCircle className="w-3.5 h-3.5 mr-2.5" /> Quality Control</Link>
                    <Link to="/stock" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/stock')}`}><Package className="w-3.5 h-3.5 mr-2.5" /> Stock</Link>
                    <Link to="/allocations" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/allocations')}`}><Layers className="w-3.5 h-3.5 mr-2.5" /> Allocations</Link>
                    <Link to="/stock-movements" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/stock-movements')}`}><ArrowRightLeft className="w-3.5 h-3.5 mr-2.5" /> Movements</Link>
                    
                    <div className="px-3 pt-4 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#52525B]">Procurement</div>
                    <Link to="/purchase-requests" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/purchase-requests')}`}><FileSignature className="w-3.5 h-3.5 mr-2.5" /> Purchase Req</Link>
                    <Link to="/purchase-orders" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/purchase-orders')}`}><ShoppingCart className="w-3.5 h-3.5 mr-2.5" /> Purchase Order</Link>
                    
                    <div className="px-3 pt-4 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#52525B]">Database</div>
                    <Link to="/vendors" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/vendors')}`}><Truck className="w-3.5 h-3.5 mr-2.5" /> Vendors</Link>
                    <Link to="/items" className={`flex items-center px-3 py-1.5 text-[11px] ${isActive('/items')}`}><Box className="w-3.5 h-3.5 mr-2.5" /> Master Items</Link>
                </nav>

                {/* Bagian Bawah Sidebar (Contoh tombol Upgrade ala referensi) */}
                <div className="mt-4 bg-[#18181B] border border-[#27272A] rounded-xl p-3 flex items-center cursor-pointer hover:bg-[#1f1f23]">
                    <div className="w-6 h-6 bg-[#27272A] rounded flex items-center justify-center mr-2.5">
                        <span className="text-emerald-500 text-xs font-bold">⚡</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white">System Status</span>
                        <span className="text-[8px] text-[#8A8A93]">All services operational</span>
                    </div>
                </div>
            </aside>

            {/* AREA KONTEN UTAMA */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#09090B]">
                {/* Header Navbar ala Finotive (Super minimalis, gelap, tombol command search) */}
                <header className="h-16 flex items-center justify-between px-6 z-0 shrink-0 border-b border-[#1f1f23]">
                    <div className="flex items-center space-x-6">
                        <h1 className="text-sm font-semibold text-gray-200">Dashboards</h1>
                        
                        {/* Search Bar ala MacOS/Finotive */}
                        <div className="hidden md:flex items-center bg-[#121214] border border-[#27272A] rounded-lg px-3 py-1.5 w-64 hover:border-gray-600 transition">
                            <Search className="w-3.5 h-3.5 text-gray-500 mr-2" />
                            <input type="text" placeholder="Search or type a command" className="bg-transparent outline-none text-[11px] text-gray-300 w-full placeholder-gray-600" />
                            <div className="flex items-center bg-[#27272A] px-1.5 py-0.5 rounded text-[9px] text-emerald-400 font-bold ml-2">
                                ⌘ + K
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        <button className="relative text-gray-400 hover:text-white transition">
                            <Bell className="w-4 h-4" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full border border-[#09090B]"></span>
                        </button>
                        <div className="flex items-center space-x-2 pl-4 border-l border-[#27272A] cursor-pointer">
                            <div className="flex flex-col text-right">
                                <span className="text-[11px] font-bold text-white">Administrator</span>
                                <span className="text-[9px] text-gray-500">@controltower</span>
                            </div>
                            <UserCircle2 className="w-7 h-7 text-gray-400" />
                        </div>
                    </div>
                </header>
                
                {/* Area Konten (Padding lebih kecil agar memuat banyak) */}
                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}