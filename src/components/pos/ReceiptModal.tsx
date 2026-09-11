import React, { useRef, useState, useEffect } from 'react';
import { Printer, Share2, CheckCircle, X, ArrowRight, Settings2 } from 'lucide-react';
import { Sale, SaleDetail, StoreReceiptSettings } from '../../types/pos';
import { formatRupiah, formatDateTime } from '../../utils/formatters';
import { storeSettingsService } from '../../services/storeSettingsService';

interface ReceiptModalProps {
  sale: Sale | null;
  details: SaleDetail[];
  onClose: () => void;
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  details,
  onClose,
  onNewTransaction,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [storeSettings, setStoreSettings] = useState<StoreReceiptSettings>(() =>
    storeSettingsService.getSettings()
  );
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(() => {
    return (localStorage.getItem('motopos_receipt_paper_size') as '58mm' | '80mm') || '58mm';
  });

  useEffect(() => {
    localStorage.setItem('motopos_receipt_paper_size', paperSize);
  }, [paperSize]);

  useEffect(() => {
    storeSettingsService.fetchSettings().then(setStoreSettings);
    const unsub = storeSettingsService.subscribe((updated) => {
      setStoreSettings(updated);
    });
    return () => unsub();
  }, []);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWa = () => {
    const lines = [
      `*${(storeSettings.store_name || 'BENGKEL & TOKO OLI MOTOR').toUpperCase()}*`,
      storeSettings.store_address ? `${storeSettings.store_address}` : '',
      storeSettings.store_phone ? `Telp / WA: ${storeSettings.store_phone}` : '',
      `--------------------------------`,
      `No. Nota: ${sale.invoice_number}`,
      `Waktu: ${formatDateTime(sale.sale_date)}`,
      sale.plate_number ? `Motor: ${sale.brand_model || ''} (${sale.plate_number})` : '',
      sale.current_km ? `KM Terakhir: ${sale.current_km.toLocaleString('id-ID')} KM` : '',
      sale.mechanic_name ? `Mekanik: ${sale.mechanic_name}` : '',
      `Metode Bayar: ${sale.payment_method}`,
      `--------------------------------`,
      `*RINCIAN TRANSAKSI:*`,
      ...details.map(
        (d) =>
          `- ${d.item_name} (${d.quantity}x @${formatRupiah(d.sell_price)}) = ${formatRupiah(d.subtotal)} ${
            d.is_service ? '[JASA]' : ''
          }`
      ),
      `--------------------------------`,
      `*TOTAL: ${formatRupiah(sale.total_amount)}*`,
      `--------------------------------`,
      storeSettings.receipt_footer_1 ? `${storeSettings.receipt_footer_1}` : '',
      storeSettings.receipt_footer_2 ? `${storeSettings.receipt_footer_2}` : '',
      storeSettings.receipt_footer_3 ? `${storeSettings.receipt_footer_3}` : '',
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join('\n'));
    let cleanPhone = (sale.customer_phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">Pratinjau Nota Kasir</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Size Selector & Printing Tip */}
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider">Ukuran Kertas:</span>
            <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 shadow-2xs">
              <button
                onClick={() => setPaperSize('58mm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  paperSize === '58mm'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                58 mm (POS-58)
              </button>
              <button
                onClick={() => setPaperSize('80mm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  paperSize === '80mm'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80 mm (Lebar)
              </button>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            Tips: Pilih <strong>Margins: None / Tidak ada</strong> di dialog cetak.
          </span>
        </div>

        {/* Thermal Receipt Paper Style Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50 flex-1 flex justify-center">
          <div
            ref={printRef}
            id="printable-receipt"
            className={`w-full bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-slate-200 font-mono text-xs text-slate-900 leading-tight ${
              paperSize === '58mm'
                ? 'paper-58mm max-w-[270px] text-[11px]'
                : 'paper-80mm max-w-[360px] text-xs'
            }`}
          >
            {/* Bengkel Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2.5 mb-2.5">
              <h2 className="font-black text-xs sm:text-sm tracking-wider uppercase text-slate-950">
                BENGKEL & TOKO OLI MOTOR
              </h2>
              <p className="text-[10px] text-slate-600 mt-0.5">Jl. Raya Otomotif No. 88, Sentra Onderdil</p>
              <p className="text-[10px] text-slate-600">Telp / WA: 0812-3456-7890</p>
            </div>

            {/* Transaction Info */}
            <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-400 pb-2.5 mb-2.5">
              <div className="flex justify-between gap-1">
                <span className="text-slate-600">No. Nota:</span>
                <span className="font-bold text-slate-950 truncate">{sale.invoice_number}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-slate-600">Waktu:</span>
                <span className="text-slate-900 text-right">{formatDateTime(sale.sale_date)}</span>
              </div>
              {sale.plate_number && (
                <div className="flex justify-between gap-1">
                  <span className="text-slate-600">No. Pol:</span>
                  <span className="font-bold uppercase text-slate-950">{sale.plate_number}</span>
                </div>
              )}
              {sale.brand_model && (
                <div className="flex justify-between gap-1">
                  <span className="text-slate-600">Motor:</span>
                  <span className="text-slate-900 text-right truncate max-w-[140px]">{sale.brand_model}</span>
                </div>
              )}
              {sale.current_km ? (
                <div className="flex justify-between gap-1">
                  <span className="text-slate-600">KM Masuk:</span>
                  <span className="font-bold text-slate-900">{sale.current_km.toLocaleString('id-ID')} KM</span>
                </div>
              ) : null}
              {sale.mechanic_name && (
                <div className="flex justify-between gap-1">
                  <span className="text-slate-600">Mekanik:</span>
                  <span className="font-semibold text-slate-900 text-right">{sale.mechanic_name}</span>
                </div>
              )}
              <div className="flex justify-between gap-1">
                <span className="text-slate-600">Metode:</span>
                <span className="font-bold text-slate-950 uppercase">{sale.payment_method}</span>
              </div>
            </div>

            {/* Items List */}
            <div className="border-b border-dashed border-slate-400 pb-2.5 mb-2.5 space-y-2">
              <div className="text-[9.5px] uppercase font-bold text-slate-500 flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span>ITEM / QTY</span>
                <span>SUBTOTAL</span>
              </div>
              {details.map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-[11px]">
                  {/* Line 1: Item name & Badge */}
                  <div className="font-medium text-slate-950 leading-snug break-words">
                    {item.item_name}
                    {item.is_service ? (
                      <span className="ml-1 text-[8.5px] px-1 py-0.2 rounded bg-slate-200 text-slate-800 font-bold border border-slate-300">
                        JASA
                      </span>
                    ) : null}
                  </div>
                  {/* Line 2: Quantity x Price (left) and Subtotal (right) */}
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <span>
                      {item.quantity} x {formatRupiah(item.sell_price)}
                    </span>
                    <span className="font-bold text-slate-950">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Calculation */}
            <div className="space-y-1 mb-2.5">
              <div className="flex justify-between font-bold text-xs sm:text-sm text-slate-950 pt-1">
                <span>TOTAL AKHIR:</span>
                <span className="font-black text-slate-950">{formatRupiah(sale.total_amount)}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-2.5 border-t border-dashed border-slate-400 text-[9.5px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-900">*** TERIMA KASIH ***</p>
              <p>Perawatan rutin menjaga performa & keselamatan motor Anda.</p>
              <p className="font-semibold text-slate-800">
                Servis berikutnya: 2.000 KM / 60 Hari.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Cetak Thermal</span>
            </button>

            <button
              onClick={handleShareWa}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Kirim WhatsApp</span>
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              onNewTransaction();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ml-auto"
          >
            <span>Transaksi Baru</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
