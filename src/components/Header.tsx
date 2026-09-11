import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Database,
  CalendarClock,
  BarChart3,
  ReceiptText,
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export type ActiveTab = 'pos' | 'master' | 'crm' | 'reports' | 'history';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  overdueCount: number;
  lowStockCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  overdueCount,
  lowStockCount,
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

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 select-none shadow-md shrink-0">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-slate-950 font-black">
            <Wrench className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg leading-tight bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent">
                MotoPOS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Tablet POS & CRM
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Toko Oli & Sparepart Motor</p>
          </div>
        </div>

        {/* Navigation Tabs - Large Touch-Friendly Pills for Tablet */}
        <nav className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            id="tab-pos"
            onClick={() => onSelectTab('pos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-95 ${
              activeTab === 'pos'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Kasir POS</span>
          </button>

          <button
            id="tab-crm"
            onClick={() => onSelectTab('crm')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold text-sm transition-all duration-150 relative active:scale-95 ${
              activeTab === 'crm'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Pengingat Servis</span>
            {overdueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-extrabold bg-red-600 text-white animate-pulse">
                {overdueCount}
              </span>
            )}
          </button>

          <button
            id="tab-reports"
            onClick={() => onSelectTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-95 ${
              activeTab === 'reports'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Laporan Bisnis</span>
          </button>

          <button
            id="tab-master"
            onClick={() => onSelectTab('master')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold text-sm transition-all duration-150 relative active:scale-95 ${
              activeTab === 'master'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Master Data</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-amber-600 text-white">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            id="tab-history"
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-95 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            <span>Riwayat Nota</span>
          </button>
        </nav>

        {/* Right Info: Live Time & SQLite Status */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px]">{timeStr}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-[11px]">SQLite Aktif</span>
          </div>
        </div>
      </div>
    </header>
  );
};
