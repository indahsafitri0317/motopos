import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  CalendarClock,
  BarChart3,
  Database,
  ReceiptText,
  ShieldCheck,
  LogOut,
  KeyRound,
  Crown,
  Wrench,
  ChevronRight,
  User,
  Lock,
} from 'lucide-react';
import { authService } from '../services/authService';
import { AppUser, ActiveTab } from '../types/pos';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  overdueCount: number;
  lowStockCount: number;
  onOpenSyncModal?: () => void;
  onOpenLoginModal?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  overdueCount,
  lowStockCount,
  onOpenLoginModal,
}) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(authService.getCurrentUser());

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser());
    const unsub = authService.onUserChange((u) => setCurrentUser(u));
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNav = (tab: ActiveTab) => {
    onSelectTab(tab);
    onClose();
  };

  const handleLogout = () => {
    authService.logout();
    onClose();
    onOpenLoginModal?.();
  };

  const menuItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'Kasir POS Terminal',
      icon: ShoppingBag,
      shortcut: 'F1',
      badge: null,
      permission: true,
      iconColor: 'text-amber-400',
    },
    {
      id: 'crm' as ActiveTab,
      label: 'CRM Pengingat Servis',
      icon: CalendarClock,
      badge: overdueCount > 0 ? (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse">
          {overdueCount}
        </span>
      ) : null,
      permission: true,
      iconColor: 'text-emerald-400',
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Laporan & Laba Rugi',
      icon: BarChart3,
      badge: null,
      permission: authService.hasPermission('can_view_profit_report'),
      iconColor: 'text-sky-400',
    },
    {
      id: 'master' as ActiveTab,
      label: 'Master Data Produk',
      icon: Database,
      badge: lowStockCount > 0 ? (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          {lowStockCount} Menipis
        </span>
      ) : null,
      permission:
        authService.hasPermission('can_add_product') ||
        authService.hasPermission('can_edit_product') ||
        authService.hasPermission('can_stock_opname'),
      iconColor: 'text-purple-400',
    },
    {
      id: 'history' as ActiveTab,
      label: 'Riwayat Transaksi',
      icon: ReceiptText,
      badge: null,
      permission: authService.hasPermission('can_reprint_receipt'),
      iconColor: 'text-teal-400',
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Sistem & Pengguna',
      icon: ShieldCheck,
      badge: (
        <span className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-semibold">
          User
        </span>
      ),
      permission: authService.hasPermission('can_manage_users'),
      iconColor: 'text-indigo-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Slide-out Menu Panel */}
      <div className="relative w-[325px] sm:w-[340px] max-w-[85vw] bg-[#0A1120] text-white flex flex-col h-full shadow-2xl z-10 border-r border-slate-800/80 animate-in slide-in-from-left duration-200">
        
        {/* Drawer Header with Green-to-Black Gradient (as in Gambar 1) */}
        <div className="bg-gradient-to-r from-[#00897B] via-[#005B52] to-[#0A1120] p-5 text-white flex items-center justify-between border-b border-teal-900/60 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner border border-white/20">
              <span className="font-orbitron font-black text-white text-lg tracking-tight">M</span>
            </div>
            <div>
              <h2 className="font-orbitron font-black text-lg tracking-wider text-white">
                MOTO <span className="text-teal-200">POS</span>
              </h2>
              <p className="text-xs text-teal-100 font-medium">Sistem Bengkel & Kasir</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-950/40 hover:bg-slate-950/70 text-teal-100 hover:text-white transition cursor-pointer border border-white/10 active:scale-95 shadow-sm"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active User Card */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800/70">
          <div className="bg-[#111C33] rounded-2xl p-3.5 border border-slate-700/60 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-xs ${
                  currentUser?.role === 'owner'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : currentUser?.role === 'supervisor'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : currentUser?.role === 'kasir'
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                    : currentUser?.role === 'teknisi'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {currentUser?.role === 'owner' ? (
                  <Crown className="w-5 h-5" />
                ) : currentUser?.role === 'supervisor' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : currentUser?.role === 'kasir' ? (
                  <ShoppingBag className="w-5 h-5" />
                ) : currentUser?.role === 'teknisi' ? (
                  <Wrench className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5 text-amber-400 animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                {currentUser ? (
                  <>
                    <div className="font-bold text-sm text-white truncate leading-tight">
                      {currentUser.full_name}
                    </div>
                    <div className="text-[11px] text-amber-400/90 uppercase font-black tracking-wider mt-0.5 truncate">
                      {currentUser.role} • @{currentUser.username}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-sm text-rose-300 truncate leading-tight flex items-center gap-1.5">
                      <span>Belum Login</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold tracking-wider mt-0.5 truncate">
                      Sesi Kasir Terkunci
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenLoginModal?.();
              }}
              className="p-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border border-slate-700/70"
              title={currentUser ? 'Ganti Pengguna / Login' : 'Login Sekarang'}
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items (Neat & Clean list with refined font size) */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-1.5">
          <div className="px-2 py-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
            Menu Utama
          </div>

          <div className="space-y-1">
            {menuItems
              .filter((item) => item.permission)
              .map((item) => {
                const isActive = activeTab === item.id;
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-[13.5px] transition-all duration-150 cursor-pointer text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                        : 'text-slate-200 hover:bg-[#131F38] hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <IconComponent
                        className={`w-4.5 h-4.5 shrink-0 ${
                          isActive ? 'text-slate-950' : item.iconColor
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                      {item.shortcut && (
                        <span
                          className={`text-[11px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isActive
                              ? 'bg-slate-950/20 text-slate-950'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                          }`}
                        >
                          {item.shortcut}
                        </span>
                      )}
                      {item.badge}
                      {!isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-[#070D18] border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          {currentUser ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-rose-400 hover:text-rose-300 font-bold cursor-pointer py-1 px-2 rounded-lg hover:bg-rose-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar / Logout</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOpenLoginModal?.();
              }}
              className="flex items-center gap-2 text-amber-400 hover:text-amber-300 font-bold cursor-pointer py-1 px-2 rounded-lg hover:bg-amber-500/10 transition"
            >
              <KeyRound className="w-4 h-4" />
              <span>Masuk / Login (PIN)</span>
            </button>
          )}
          <span className="font-mono text-slate-400 font-semibold text-[11px]">v2.4.0</span>
        </div>
      </div>
    </div>
  );
};

