import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { Camera, CheckCircle, Building, ShieldAlert, Trash2, User } from 'lucide-react';

export default function Receipt() {
    const { id } = useParams();
    const allocId = id || window.location.pathname.split('/').pop(); 
    
    const [allocData, setAllocData] = useState(null);
    const [project, setProject] = useState(null);
    const [masterItems, setMasterItems] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [photoProof, setPhotoProof] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    
    const sigCanvas = useRef({});

    useEffect(() => {
        const fetchReceiptData = async () => {
            try {
                const allocRes = await axios.get(`http://localhost:5000/api/allocations/${allocId}`);
                const alloc = allocRes.data.data;
                setAllocData(alloc);

                if (alloc.status === 'RECEIVED') {
                    setIsSuccess(true);
                }

                const [itemRes, projRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/items').catch(() => ({ data: { data: [] } })),
                    axios.get('http://localhost:5000/api/projects').catch(() => ({ data: { data: [] } }))
                ]);
                
                setMasterItems(itemRes.data?.data || []);
                
                if (alloc.project_id) {
                    const foundProj = (projRes.data?.data || []).find(p => p.project_id === alloc.project_id);
                    setProject(foundProj || null);
                }
                
                setLoading(false);
            } catch (err) {
                console.error("Error fetching receipt details:", err);
                setLoading(false);
            }
        };
        fetchReceiptData();
    }, [allocId]);

    const handleClear = () => sigCanvas.current.clear();

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // Kompres ukuran ke 400px agar aman untuk Google Sheets
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Kompres kualitas jadi 30%
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.3);
                setPhotoProof(compressedBase64);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!photoProof) { alert('MOHON AMBIL FOTO BUKTI BARANG TERLEBIH DAHULU!'); return; }
        if (sigCanvas.current.isEmpty()) { alert("MOHON TANDA TANGAN TERLEBIH DAHULU!"); return; }
        
        setSubmitting(true);
        try {
            // KUNCI PERBAIKAN: Format JPEG 30% agar ukuran Base64 sangat kecil
            const signatureBase64 = sigCanvas.current.getCanvas().toDataURL('image/jpeg', 0.3);
            
            await axios.post(`http://localhost:5000/api/allocations/${allocId}/receive`, {
                signature: signatureBase64,
                photo: photoProof
            });
            
            setIsSuccess(true);
        } catch (err) {
            alert(`Gagal memproses penerimaan: ${err.response?.data?.message || err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-[#131314] flex items-center justify-center text-[#8E918F] text-xs font-bold uppercase tracking-widest">MEMUAT DATA...</div>;
    
    if (!allocData) return (
        <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-6 text-center">
            <ShieldAlert className="w-16 h-16 text-[#FFB4AB] mb-4" />
            <h2 className="text-xl font-bold text-[#E3E3E3] mb-2">DATA TIDAK DITEMUKAN</h2>
            <p className="text-sm text-[#8E918F]">Tanda terima untuk ID ini tidak tersedia atau link salah.</p>
        </div>
    );

    if (isSuccess) return (
        <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-6 text-center font-sans">
            <CheckCircle className="w-20 h-20 text-[#6DD58C] mb-6" />
            <h2 className="text-2xl font-bold text-[#E3E3E3] mb-3 uppercase">Barang Diterima!</h2>
            <p className="text-sm text-[#C4C7C5] leading-relaxed max-w-sm">
                Tanda terima penerimaan barang <span className="font-bold text-[#A8C7FA]">#{allocId}</span> telah berhasil direkam ke dalam sistem kontrol.
            </p>
        </div>
    );

    const itemsListToRender = allocData.items || allocData.allocated_items || [];

    return (
        <div className="min-h-screen bg-[#131314] text-[#E3E3E3] p-4 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden">
            <div className="w-full max-w-md">
                
                <div className="mb-6 flex justify-between items-start sm:items-center px-1 gap-3">
                    <img src="/logo.png" alt="Company Logo" className="h-8 sm:h-10 object-contain drop-shadow-lg shrink-0" />
                    <div className="text-right flex-1 min-w-0">
                        <h1 className="font-bold text-base sm:text-lg text-[#A8C7FA] tracking-wider uppercase leading-none mb-1 truncate">TANDA TERIMA</h1>
                        <p className="text-[9px] text-[#8E918F] uppercase font-medium tracking-wider truncate">
                            ID: {allocId}
                        </p>
                    </div>
                </div>
                
                <div className="bg-[#1E1F22] border border-[#333639] rounded-[24px] p-4 sm:p-6 shadow-2xl w-full">
                    
                    <div className="bg-[#131314] border border-[#333639] p-4 rounded-xl mb-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#A8C7FA]"></div>
                        
                        <div className={`flex items-start ${project ? 'mb-3 pb-3 border-b border-[#333639]' : ''}`}>
                            <User className="w-3.5 h-3.5 text-[#8E918F] mr-2 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] text-[#8E918F] uppercase font-bold tracking-wider mb-0.5">PENERIMA BARANG</p>
                                <p className="text-xs font-bold text-[#E3E3E3] uppercase break-words leading-tight">{allocData.recipient_name}</p>
                            </div>
                        </div>

                        {project && (
                            <div className="flex items-start">
                                <Building className="w-3.5 h-3.5 text-[#8E918F] mr-2 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] text-[#8E918F] uppercase font-bold tracking-wider mb-0.5">NAMA PROYEK</p>
                                    <p className="text-xs font-bold text-[#E3E3E3] uppercase break-words leading-tight mb-0.5">{project.project_name}</p>
                                    <p className="text-[10px] text-[#A8C7FA] uppercase font-medium break-words leading-tight">{project.company_name}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-[#131314] border border-[#333639] rounded-xl overflow-hidden overflow-x-auto mb-8 w-full">
                        <table className="w-full text-left min-w-[250px]">
                            <thead className="bg-[#1E1F22] border-b border-[#333639]">
                                <tr>
                                    <th className="px-4 py-2.5 text-[9px] font-bold text-[#8E918F] uppercase tracking-wider">NAMA BARANG</th>
                                    <th className="px-4 py-2.5 text-[9px] font-bold text-[#8E918F] uppercase tracking-wider text-right">DIKIRIM</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333639]">
                                {itemsListToRender.map((item, idx) => {
                                    const mItem = masterItems.find(m => m.item_id === item.item_id);
                                    const itemName = mItem ? mItem.item_name : item.item_id;
                                    const uom = mItem ? mItem.unit : 'PCS'; 
                                    const qty = item.allocated_qty || item.qty || 0;
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-[#1E1F22] transition-colors">
                                            <td className="px-4 py-3 text-[10px] font-bold text-[#E3E3E3] uppercase leading-snug break-words whitespace-normal">{itemName}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-[#6DD58C] text-right whitespace-nowrap">
                                                {qty} <span className="text-[9px] text-[#8E918F] ml-0.5">{uom}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full">
                        <div className="mb-6 w-full">
                            <label className="block text-[10px] font-bold text-[#8E918F] mb-2.5 uppercase tracking-wider">1. FOTO BUKTI BARANG *</label>
                            {photoProof ? (
                                <div className="relative w-full h-40 border-2 border-[#333639] rounded-xl overflow-hidden bg-[#131314]">
                                    <img src={photoProof} alt="Bukti" className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setPhotoProof(null)} className="absolute top-2 right-2 bg-[#8C1D18] hover:bg-red-700 text-[#FFB4AB] p-2 rounded-full transition-colors shadow-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-[#333639] bg-[#131314] hover:bg-[#1E1F22] hover:border-[#A8C7FA] rounded-xl transition-all group">
                                    <div className="bg-[#333639] p-3 rounded-full mb-2 group-hover:bg-[#A8C7FA]/20 transition-colors">
                                        <Camera className="w-5 h-5 text-[#E3E3E3] group-hover:text-[#A8C7FA]" />
                                    </div>
                                    <span className="text-[9px] text-[#A8C7FA] uppercase font-bold tracking-wider">AMBIL FOTO / GALERI</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                                </label>
                            )}
                        </div>

                        <div className="mb-8 w-full">
                            <div className="flex justify-between items-end mb-2.5">
                                <label className="block text-[10px] font-bold text-[#8E918F] uppercase tracking-wider">2. TANDA TANGAN DIGITAL *</label>
                                <button type="button" onClick={handleClear} className="text-[10px] font-bold text-[#FFB4AB] hover:text-red-400 uppercase tracking-wider transition-colors bg-[#8C1D18]/10 px-2 py-1 rounded-md">
                                    HAPUS
                                </button>
                            </div>
                            <div className="w-full h-40 bg-white rounded-xl overflow-hidden shadow-inner border-[3px] border-[#333639]">
                                {/* KUNCI PERBAIKAN: Mengunci width dan height internal ke 500x200 agar Base64 ukurannya kecil.
                                    Lalu gunakan className untuk memaksanya mengikuti ukuran layar HP. 
                                    Ini sangat krusial untuk Google Sheets! */}
                                <SignatureCanvas 
                                    penColor="black" 
                                    backgroundColor="white"
                                    canvasProps={{ width: 500, height: 200, className: 'w-full h-full touch-none' }} 
                                    ref={sigCanvas} 
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full bg-[#A8C7FA] hover:bg-[#D3E3FD] text-[#062E6F] text-xs font-bold px-6 py-4 rounded-xl transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(168,199,250,0.2)] tracking-wider uppercase flex items-center justify-center"
                        >
                            {submitting ? 'MEMPROSES DATA...' : 'KONFIRMASI PENERIMAAN'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}