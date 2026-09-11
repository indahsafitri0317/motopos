import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Clock,
  PieChart,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { ProfitLossReport, MovementReport, RecapReport } from '../../types/pos';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/formatters';

type ReportTab = 'profit_loss' | 'movement' | 'recap';

export const BusinessReportsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<ReportTab>('profit_loss');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'this_month' | 'all'>('all');
  const [loading, setLoading] = useState(false);

  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);
  const [movement, setMovement] = useState<MovementReport | null>(null);
  const [recap, setRecap] = useState<RecapReport | null>(null);

  // Movement filter
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'FAST' | 'SLOW'>('ALL');

  // Compute dates based on range
  const getDateParams = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (dateRange === 'today') {
      const s = toDateString(today);
      return { start_date: s, end_date: s };
    } else if (dateRange === '7days') {
      const past = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start_date: toDateString(past), end_date: toDateString(today) };
    } else if (dateRange === '30days') {
      const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start_date: toDateString(past), end_date: toDateString(today) };
    } else if (dateRange === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: toDateString(firstDay), end_date: toDateString(today) };
    }
    return {};
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getDateParams();
      const [plRes, movRes, recapRes] = await Promise.all([
        api.getProfitLoss(start_date, end_date),
        api.getMovement(start_date, end_date),
        api.getRecap(),
      ]);
      setProfitLoss(plRes);
      setMovement(movRes);
      setRecap(recapRes);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9] p-5 lg:p-6 text-[#334155] space-y-5">
      {/* Top Header & Sub-tab navigation */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Laporan Bisnis & Analitik Toko
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring laba rugi kotor, perputaran stok sparepart & oli, serta rekapitulasi omzet berkala.
          </p>
        </div>

        {/* Sub-tab Switches */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start lg:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('profit_loss')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'profit_loss'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Laba Rugi Kotor</span>
          </button>

          <button
            onClick={() => setActiveSubTab('movement')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'movement'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Fast vs Slow Moving</span>
          </button>

          <button
            onClick={() => setActiveSubTab('recap')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'recap'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Rekap Harian & Bulanan</span>
          </button>
        </div>
      </div>

      {/* Date Filter Toolbar (applicable to profit_loss and movement) */}
      {activeSubTab !== 'recap' && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 text-xs shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-slate-800">Periode Waktu:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari Terakhir' },
                { id: '30days', label: '30 Hari Terakhir' },
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'all', label: 'Semua Waktu' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                onClick={() => setDateRange(d.id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap border cursor-pointer text-xs ${
                  dateRange === d.id
                    ? 'bg-amber-500/15 text-amber-900 border-amber-400 shadow-xs font-black'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}

            <button
              onClick={loadReportData}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg ml-1 border border-slate-200 cursor-pointer transition active:scale-95"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. SUB-TAB: LABA RUGI KOTOR (GROSS PROFIT)           */}
      {/* ==================================================== */}
      {activeSubTab === 'profit_loss' && profitLoss && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Main Financial KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Omzet */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Total Omzet (Penjualan)</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
                {formatRupiah(profitLoss.total_omzet)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Dari {profitLoss.total_transactions} transaksi kasir
              </p>
            </div>

            {/* Total HPP */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Total Modal (HPP)</span>
                <span className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-700 font-mono mt-0.5">
                {formatRupiah(profitLoss.total_hpp)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Biaya pokok kulakan sparepart & oli
              </p>
            </div>

            {/* Laba Rugi Kotor */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <span>Laba Kotor (Gross Profit)</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono mt-0.5">
                {formatRupiah(profitLoss.gross_profit)}
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold">
                Omzet dikurangi Total HPP
              </p>
            </div>

            {/* Margin Laba Kotor */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Margin Laba Kotor</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <PieChart className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono mt-0.5">
                {profitLoss.profit_margin_pct}%
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Persentase keuntungan terhadap omzet
              </p>
            </div>
          </div>

          {/* Breakdown Section: Sparepart vs Jasa Servis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Goods (Spareparts & Oils) */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">Barang Fisik (Oli & Sparepart)</h3>
                    <p className="text-xs text-slate-500">Penjualan produk fisik inventaris</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 border border-slate-200">
                  {profitLoss.goods.qty} Item Terjual
                </span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Omzet Barang:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm sm:text-base">
                    {formatRupiah(profitLoss.goods.omzet)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total HPP Barang:</span>
                  <span className="font-mono text-slate-600 text-sm sm:text-base">
                    {formatRupiah(profitLoss.goods.hpp)}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold text-emerald-600 pt-2 border-t border-slate-100">
                  <span className="text-xs sm:text-sm">Keuntungan Kotor:</span>
                  <span className="font-mono text-base sm:text-lg">
                    {formatRupiah(profitLoss.goods.profit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Services (Jasa Servis) */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-700 flex items-center justify-center font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">Jasa Servis & Perawatan</h3>
                    <p className="text-xs text-slate-500">Pendapatan jasa mekanik & bengkel</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-blue-50 px-2.5 py-1 rounded-lg text-blue-800 border border-blue-200">
                  {profitLoss.services.qty} Servis Dilayani
                </span>
              </div>

              <div className="space-y-2 text-xs sm:text-sm pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Omzet Jasa:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm sm:text-base">
                    {formatRupiah(profitLoss.services.omzet)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Biaya Operasional Jasa:</span>
                  <span className="font-mono text-slate-600 text-sm sm:text-base">
                    {formatRupiah(profitLoss.services.hpp)}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold text-emerald-600 pt-2 border-t border-slate-100">
                  <span className="text-xs sm:text-sm">Keuntungan Jasa Murni:</span>
                  <span className="font-mono text-base sm:text-lg">
                    {formatRupiah(profitLoss.services.profit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. SUB-TAB: FAST-MOVING VS SLOW-MOVING ITEMS         */}
      {/* ==================================================== */}
      {activeSubTab === 'movement' && movement && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs sm:text-sm font-bold text-slate-700">Filter Analisis:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setMovementFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    movementFilter === 'ALL'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  Semua ({movement.items.length})
                </button>
                <button
                  onClick={() => setMovementFilter('FAST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    movementFilter === 'FAST'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs font-black'
                      : 'bg-slate-100 text-amber-800 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Fast-Moving ({movement.fast_moving.length})</span>
                </button>
                <button
                  onClick={() => setMovementFilter('SLOW')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    movementFilter === 'SLOW'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Slow-Moving / Dead Stock ({movement.slow_moving.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Movement Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">SKU / Nama Produk</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-center">Status Gerak</th>
                    <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                    <th className="py-2.5 px-3 text-right">Qty Terjual</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet</th>
                    <th className="py-2.5 px-4 text-right">Total Laba Kotor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(movementFilter === 'ALL'
                    ? movement.items
                    : movementFilter === 'FAST'
                    ? movement.fast_moving
                    : movement.slow_moving
                  ).map((item, idx) => {
                    const isFast = item.movement_class === 'FAST';
                    const isZero = item.movement_class === 'SLOW_OR_ZERO';
                    const needsReorder = isFast && item.current_stock <= (item.min_stock || 5);

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.item_name}</div>
                          <div className="font-mono text-[11px] text-slate-500 font-medium">{item.sku}</div>
                          {needsReorder && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200 mt-0.5">
                              ⚠️ Stok Menipis (Segera Re-order!)
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 font-medium text-xs">
                          {item.category_name || '-'}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {isFast ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              <Zap className="w-3 h-3 text-amber-600" />
                              FAST-MOVING
                            </span>
                          ) : isZero ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Belum Terjual
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              SLOW-MOVING
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm">
                          {item.is_service ? (
                            <span className="text-slate-400">-</span>
                          ) : item.current_stock <= item.min_stock ? (
                            <span className="text-red-600 font-bold">{item.current_stock}</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">{item.current_stock}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 text-xs sm:text-sm">
                          {item.total_sold_qty}x
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 text-xs sm:text-sm">
                          {formatRupiah(item.total_revenue)}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 text-xs sm:text-sm">
                          {formatRupiah(item.total_profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. SUB-TAB: REKAP OMZET HARIAN & BULANAN             */}
      {/* ==================================================== */}
      {activeSubTab === 'recap' && recap && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Payment Method Breakdown */}
          <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Distribusi Metode Pembayaran Kasir
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recap.payment_methods.map((p, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                    {p.payment_method}
                  </span>
                  <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-0.5">
                    {formatRupiah(p.total_amount)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{p.count} Transaksi</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Recap Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center justify-between">
                <span>Rekap Omzet Harian (30 Hari Terakhir)</span>
                <Calendar className="w-4 h-4 text-amber-500" />
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-2 text-center">Trx</th>
                      <th className="py-2 px-3 text-right">Omzet</th>
                      <th className="py-2 px-3 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recap.daily.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">{d.date_label}</td>
                        <td className="py-2 px-2 text-center font-bold text-slate-600">
                          {d.transaction_count}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-600">
                          {formatRupiah(d.omzet)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {formatRupiah(d.gross_profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Recap Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center justify-between">
                <span>Rekap Omzet Bulanan</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="py-2 px-3">Bulan</th>
                      <th className="py-2 px-2 text-center">Trx</th>
                      <th className="py-2 px-3 text-right">Omzet</th>
                      <th className="py-2 px-3 text-right">HPP</th>
                      <th className="py-2 px-3 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recap.monthly.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-bold font-mono text-slate-900">
                          {m.month_label}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-600">
                          {m.transaction_count}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-600">
                          {formatRupiah(m.omzet)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {formatRupiah(m.hpp)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {formatRupiah(m.gross_profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
