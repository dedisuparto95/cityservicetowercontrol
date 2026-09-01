import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard'; 
import Projects from './pages/Projects';
import Items from './pages/Items';
import Manpower from './pages/Manpower';
import Entitlements from './pages/Entitlements';
import Vendors from './pages/Vendors';
import Requirements from './pages/Requirements';
import Stock from './pages/Stock';
import Allocations from './pages/Allocations';
import StockMovement from './pages/StockMovement';
import PurchaseRequests from './pages/PurchaseRequests';
import PurchaseOrders from './pages/PurchaseOrders';
import Receiving from './pages/Receiving';
import QC from './pages/QC';
import Receipt from './pages/Receipt'; // BARU: Import Receipt

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* HALAMAN PUBLIC: E-Receipt Tanda Terima (Tanpa Sidebar Admin) */}
                <Route path="/receipt/:id" element={<Receipt />} />

                {/* HALAMAN INTERNAL: Control Tower (Dengan Sidebar Admin) */}
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} /> 
                    <Route path="projects" element={<Projects />} />
                    <Route path="manpower" element={<Manpower />} />
                    <Route path="entitlements" element={<Entitlements />} />
                    <Route path="requirements" element={<Requirements />} />
                    <Route path="stock" element={<Stock />} />
                    <Route path="allocations" element={<Allocations />} />
                    <Route path="stock-movements" element={<StockMovement />} />
                    <Route path="purchase-requests" element={<PurchaseRequests />} />
                    <Route path="purchase-orders" element={<PurchaseOrders />} />
                    <Route path="receiving" element={<Receiving />} />
                    <Route path="qc" element={<QC />} />
                    <Route path="items" element={<Items />} />
                    <Route path="vendors" element={<Vendors />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;