const express = require('express');
const cors = require('cors');
require('dotenv').config(); 

const projectRoutes = require('./routes/projects');
const itemRoutes = require('./routes/items');
const manpowerRoutes = require('./routes/manpower');
const entitlementRoutes = require('./routes/entitlements');
const vendorRoutes = require('./routes/vendors');
const requirementRoutes = require('./routes/requirements');
const stockRoutes = require('./routes/stock');
const allocationRoutes = require('./routes/allocations');
const stockMovementRoutes = require('./routes/stockMovements');
const purchaseRequestRoutes = require('./routes/purchaseRequests'); 
const purchaseOrderRoutes = require('./routes/purchaseOrders');     
const receivingRoutes = require('./routes/receiving'); 
const qcRoutes = require('./routes/qc');               
const lookupsRoutes = require('./routes/lookups');

const app = express();
app.use(cors());

// --- KUNCI PERBAIKANNYA DI SINI ---
// Kita menaikkan limit dari bawaan 100kb menjadi 10MB 
// agar Base64 Image (Tanda Tangan) bisa diterima oleh server.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// ----------------------------------

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Mesin Backend CITY SERVICE menyala!' });
});

app.use('/api/projects', projectRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/manpower', manpowerRoutes);
app.use('/api/entitlements', entitlementRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes); 
app.use('/api/purchase-orders', purchaseOrderRoutes);     
app.use('/api/receiving', receivingRoutes); 
app.use('/api/qc', qcRoutes);               
app.use('/api/lookups', lookupsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server Backend berjalan di port ${PORT}`);
});

// --- WAJIB UNTUK VERCEL ---
module.exports = app;