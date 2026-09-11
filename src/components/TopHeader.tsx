import React, { useState, useEffect } from 'react';
import {
  Plus,
  Clock,
  CheckCircle2,
  CalendarClock,
  ShoppingBag,
  BarChart3,
  Database,
  ReceiptText,
  Search,
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface TopHeaderProps {
  activeTab: ActiveTab;
  onNewPosClick: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onNewPosClick,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      setTimeStr(formatted);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  // Title configuration based on active operational screen
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'pos':
        return {
          title: 'Kasir POS Terminal',
          subtitle: 'Katalog sparepart, oli mesin, jasa servis berkala & nota thermal',
          icon: ShoppingBag,
        };
      case 'crm':
        return {
          title: 'Antrian Pengingat Servis (CRM)',
          subtitle: 'Monitoring otomatis kendaraan jatuh tempo & kirim pesan WhatsApp',
          icon: CalendarClock,
        };
      case 'reports':
        return {
          title: 'Laporan Bisnis & Margin',
          subtitle: 'Analisis laba rugi kotor, fast-moving items, dan rekapitulasi harian',
          icon: BarChart3,
        };
      case 'master':
        return {
          title: 'Master Data Inventaris',
          subtitle: 'Katalog suku cadang, kendaraan motor pelanggan, dan staf mekanik',
          icon: Database,
        };
      case 'history':
        return {
          title: 'Riwayat Nota & Transaksi Kasir',
          subtitle: 'Arsip seluruh penjualan yang tercatat secara atomik di database SQLite',
          icon: ReceiptText,
        };
      default:
        return {
          title: 'Operational Overview',
          subtitle: 'MotoPOS Oil & Sparepart System',
          icon: ShoppingBag,
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const IconComp = headerInfo.icon;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between shadow-xs shrink-0 select-none z-10">
      {/* Title & Context */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 shrink-0">
          <IconComp className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base lg:text-lg font-bold text-slate-800 tracking-tight leading-tight">
            {headerInfo.title}
          </h2>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            {headerInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>{timeStr}</span>
        </div>

        {/* Database Status Tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SQLite OK</span>
        </div>

        {/* POS Baru Quick Button (as specified in Design HTML) */}
        <button
          id="btn-header-new-pos"
          onClick={onNewPosClick}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg font-bold text-xs lg:text-sm flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          <span>POS Baru</span>
        </button>
      </div>
    </header>
  );
};
