import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Database,
  CalendarClock,
  BarChart3,
  ReceiptText,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

export type ActiveTab = 'pos' | 'master' | 'crm' | 'reports' | 'history';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  overdueCount: number;
  lowStockCount: number;
  onNewPosClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  overdueCount,
  lowStockCount,
}) => {
  return (
    <aside className="w-60 lg:w-64 bg-[#0F172A] flex flex-col shadow-xl shrink-0 border-r border-slate-800/80 z-20 select-none">
      {/* Brand Header */}
      <div className="p-5 lg:p-6 border-b border-slate-700/50">
        <h1 className="text-white font-bold text-xl tracking-tight flex items-center gap-2.5 font-orbitron">
          <span className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-[#0F172A] font-black text-base shadow-sm font-orbitron">
            M
          </span>
          <span className="tracking-wider">MOTO-POS</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1 font-medium tracking-wide">Oil & Sparepart System</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {/* Kasir POS */}
        <button
          id="nav-pos"
          onClick={() => onSelectTab('pos')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-98 ${
            activeTab === 'pos'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className={`w-5 h-5 ${activeTab === 'pos' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Kasir POS</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
            F1
          </span>
        </button>

        {/* CRM Pengingat Servis */}
        <button
          id="nav-crm"
          onClick={() => onSelectTab('crm')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-98 ${
            activeTab === 'crm'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <CalendarClock className={`w-5 h-5 ${activeTab === 'crm' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>CRM Pengingat</span>
          </div>
          {overdueCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white animate-pulse">
              {overdueCount}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-bold">Aktif</span>
          )}
        </button>

        {/* Laporan Bisnis */}
        <button
          id="nav-reports"
          onClick={() => onSelectTab('reports')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-98 ${
            activeTab === 'reports'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <BarChart3 className={`w-5 h-5 ${activeTab === 'reports' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Laporan Bisnis</span>
          </div>
        </button>

        {/* Master Data */}
        <button
          id="nav-master"
          onClick={() => onSelectTab('master')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-98 ${
            activeTab === 'master'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <Database className={`w-5 h-5 ${activeTab === 'master' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Master Data</span>
          </div>
          {lowStockCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950">
              {lowStockCount}
            </span>
          )}
        </button>

        {/* Riwayat Nota */}
        <button
          id="nav-history"
          onClick={() => onSelectTab('history')}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-98 ${
            activeTab === 'history'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <ReceiptText className={`w-5 h-5 ${activeTab === 'history' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Riwayat Nota</span>
          </div>
        </button>
      </nav>

      {/* Bottom Status Block - as specified in design HTML */}
      <div className="p-4 mt-auto border-t border-slate-800/60 space-y-2">
        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-400">Mekanik Aktif</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SQLite OK
            </span>
          </div>
          <p className="text-sm text-white font-semibold flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Joko Susilo (Kepala)</span>
          </p>
        </div>
      </div>
    </aside>
  );
};
