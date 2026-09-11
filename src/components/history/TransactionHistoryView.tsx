import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Search,
  Printer,
  Calendar,
  RefreshCw,
  FileDown,
  Filter,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Sale, SaleDetail } from '../../types/pos';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { formatRupiah, formatDateTime } from '../../utils/formatters';
import { ReceiptModal } from '../pos/ReceiptModal';
import { exportTransactionsToPdf } from '../../utils/exportPdf';

export const TransactionHistoryView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState<'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom'>('all');
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Detail Modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<SaleDetail[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);

  const formatYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setQuickPreset = (p: 'all' | 'today' | 'yesterday' | '7days' | 'month') => {
    const now = new Date();
    setPreset(p);
    if (p === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (p === 'today') {
      const todayStr = formatYmd(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (p === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatYmd(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (p === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      setStartDate(formatYmd(past));
      setEndDate(formatYmd(now));
    } else if (p === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYmd(firstDay));
      setEndDate(formatYmd(now));
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    setPreset('custom');
    if (type === 'start') setStartDate(val);
    if (type === 'end') setEndDate(val);
  };

  const handleResetFilter = () => {
    setPreset('all');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await api.getSales(
        250,
        search.trim() || undefined,
        startDate || undefined,
        endDate || undefined
      );
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [search, startDate, endDate]);

  const handleOpenReceipt = async (sale: Sale) => {
    try {
      const detailRes = await api.getSaleDetail(sale.sale_id);
      setSelectedSale(detailRes.sale);
      setSelectedDetails(detailRes.details);
      setShowReceipt(true);
    } catch (err) {
      console.error('Failed to load receipt details:', err);
    }
  };

  const handleExportPdf = () => {
    if (sales.length === 0) return;
    setIsExporting(true);
    try {
      const currentUser = authService.getCurrentUser();
      exportTransactionsToPdf(sales, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchQuery: search.trim() || undefined,
        generatedBy: currentUser?.full_name || currentUser?.username || 'Kasir',
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Export PDF error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Summary statistics for current filtered view
  const totalAmount = sales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
  const isFilterActive = startDate !== '' || endDate !== '' || search !== '';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9] p-4 sm:p-5 lg:p-6 text-[#334155] space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
              <ReceiptText className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Riwayat Nota & Transaksi Kasir
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar seluruh transaksi yang tersimpan aman secara atomic dalam database SQLite.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            disabled={sales.length === 0 || isExporting}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition active:scale-95 cursor-pointer ${
              sales.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={sales.length === 0 ? 'Tidak ada data untuk diekspor' : 'Ekspor hasil filter ke PDF'}
          >
            <FileDown className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Membuat PDF...' : 'Ekspor PDF'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={loadSales}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg shadow-xs cursor-pointer transition active:scale-95"
            title="Refresh Data Transaksi"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Export Success Notification Toast */}
      {exportSuccess && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Laporan transaksi PDF berhasil diunduh ke perangkat Anda.</span>
        </div>
      )}

      {/* Filter & Search Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-xs">
        {/* Row 1: Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor nota, plat nomor motor, atau nama pelanggan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 shadow-xs focus:bg-white focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: Date Filters & Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-100">
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Periode:
            </span>

            {[
              { id: 'all', label: 'Semua' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
            ].map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setQuickPreset(p.id as any)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:border-amber-500 focus:bg-white"
              />
            </div>

            {isFilterActive && (
              <button
                onClick={handleResetFilter}
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Reset Semua Filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stat Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <div>
          Menampilkan <strong className="text-slate-900 font-bold">{sales.length}</strong> transaksi
          {startDate && endDate && (
            <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-medium text-[11px]">
              Rentang: {startDate} s/d {endDate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span>Total Omzet Terfilter:</span>
          <span className="font-mono font-bold text-sm text-amber-600">
            {formatRupiah(totalAmount)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">No. Nota</th>
                <th className="py-2.5 px-3">Waktu Transaksi</th>
                <th className="py-2.5 px-3">Kendaraan & KM</th>
                <th className="py-2.5 px-3">Mekanik</th>
                <th className="py-2.5 px-3 text-center">Metode</th>
                <th className="py-2.5 px-3 text-right">Total Transaksi</th>
                <th className="py-2.5 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                      <span>Memuat data transaksi...</span>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-medium">
                    Tidak ada transaksi yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.sale_id} className="hover:bg-amber-50/30 transition">
                    <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 text-xs sm:text-sm">
                      {s.invoice_number}
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 font-medium text-xs">
                      {formatDateTime(s.sale_date)}
                    </td>

                    <td className="py-2.5 px-3">
                      {s.plate_number ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                              {s.plate_number}
                            </span>
                            <span className="text-slate-600 text-xs font-medium">{s.brand_model}</span>
                          </div>
                          {s.current_km ? (
                            <div className="text-[10px] text-slate-500 font-mono font-medium">
                              KM: {s.current_km.toLocaleString('id-ID')}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium">Umum (Tanpa Motor)</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-slate-800 font-semibold text-xs sm:text-sm">
                      {s.mechanic_name || '-'}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {s.payment_method}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 text-xs sm:text-sm">
                      {formatRupiah(s.total_amount)}
                    </td>

                    <td className="py-2.5 px-3.5 text-right">
                      {authService.hasPermission('can_reprint_receipt') ? (
                        <button
                          onClick={() => handleOpenReceipt(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold text-xs ml-auto transition cursor-pointer active:scale-95 shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-500 hover:text-slate-950" />
                          <span>Cetak Nota</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Tersimpan</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal for Reprinting */}
      {showReceipt && selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          details={selectedDetails}
          onClose={() => setShowReceipt(false)}
          onNewTransaction={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};
