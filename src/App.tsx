import React, { useState, useEffect } from 'react';
import { NavigationDrawer } from './components/NavigationDrawer';
import { PosTerminal } from './components/pos/PosTerminal';
import { CrmReminderView } from './components/crm/CrmReminderView';
import { BusinessReportsView } from './components/reports/BusinessReportsView';
import { MasterDataView } from './components/master/MasterDataView';
import { TransactionHistoryView } from './components/history/TransactionHistoryView';
import { SystemSettingsView } from './components/settings/SystemSettingsView';
import { SyncSettingsModal } from './components/sync/SyncSettingsModal';
import { LoginModal } from './components/auth/LoginModal';
import { authService } from './services/authService';
import { api } from './services/api';
import { AppUser, ActiveTab } from './types/pos';
import {
  Menu,
  ShoppingBag,
  Cloud,
  KeyRound,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [selectedVehicleForPos, setSelectedVehicleForPos] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => authService.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => !authService.getCurrentUser());

  // Global indicator counts for header badges
  const [overdueCount, setOverdueCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  const loadBadgeStats = async () => {
    try {
      const [crmData, prodData] = await Promise.all([
        api.getCrmReminders(),
        api.getProducts(),
      ]);
      const due = crmData.filter((r) => r.is_due).length;
      setOverdueCount(due);

      const lowStock = prodData.filter(
        (p) =>
          !p.sku.startsWith('SRV') &&
          !p.category_name?.toLowerCase().includes('jasa') &&
          p.stock <= p.min_stock
      ).length;
      setLowStockCount(lowStock);
    } catch (err) {
      console.error('Failed to load badge stats:', err);
    }
  };

  useEffect(() => {
    loadBadgeStats();
    const userNow = authService.getCurrentUser();
    setCurrentUser(userNow);
    if (!userNow) {
      setIsLoginModalOpen(true);
    }

    const unsub = authService.onUserChange((u) => {
      setCurrentUser(u);
      if (!u) {
        setIsLoginModalOpen(true);
      }
      // Auto-fallback to POS if switched to a user without access to the current view
      if (activeTab === 'reports' && !authService.hasPermission('can_view_profit_report')) {
        setActiveTab('pos');
      } else if (activeTab === 'settings' && !authService.hasPermission('can_manage_users')) {
        setActiveTab('pos');
      } else if (
        activeTab === 'master' &&
        !(
          authService.hasPermission('can_add_product') ||
          authService.hasPermission('can_edit_product') ||
          authService.hasPermission('can_stock_opname')
        )
      ) {
        setActiveTab('pos');
      } else if (activeTab === 'history' && !authService.hasPermission('can_reprint_receipt')) {
        setActiveTab('pos');
      }
    });
    const interval = setInterval(loadBadgeStats, 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [activeTab]);

  const handleSelectVehicleForPos = (vehicleId: number) => {
    setSelectedVehicleForPos(vehicleId);
    setActiveTab('pos');
  };

  const handleSelectTabWithAuth = (tab: ActiveTab) => {
    // Check permission for sensitive tabs
    if (tab === 'reports' && !authService.hasPermission('can_view_profit_report')) {
      alert('Akses Laporan Laba Rugi dibatasi. Memerlukan hak akses Supervisor / Owner.');
      setIsLoginModalOpen(true);
      return;
    }
    if (tab === 'settings' && !authService.hasPermission('can_manage_users')) {
      alert('Pengaturan Sistem & Pengguna dibatasi hanya untuk Owner / Admin Toko.');
      setIsLoginModalOpen(true);
      return;
    }
    if (
      tab === 'master' &&
      !(
        authService.hasPermission('can_add_product') ||
        authService.hasPermission('can_edit_product') ||
        authService.hasPermission('can_stock_opname')
      )
    ) {
      alert('Akses Master Data dibatasi untuk staf berwenang.');
      setIsLoginModalOpen(true);
      return;
    }
    if (tab === 'history' && !authService.hasPermission('can_reprint_receipt')) {
      alert('Akses Riwayat Nota dibatasi.');
      setIsLoginModalOpen(true);
      return;
    }
    setActiveTab(tab);
    loadBadgeStats();
  };

  const getUserRoleBadge = () => {
    if (!currentUser) return 'Tamu';
    switch (currentUser.role) {
      case 'owner':
        return '👑 Owner';
      case 'supervisor':
        return '🛡️ SPV';
      case 'kasir':
        return '🛒 Kasir';
      case 'teknisi':
        return '🔧 Mekanik';
      default:
        return currentUser.role;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#ECEFF1] font-sans text-[#37474F] overflow-hidden select-none">
      {/* Slide-out Navigation Drawer triggered by the Hamburger Menu (☰) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleSelectTabWithAuth}
        overdueCount={overdueCount}
        lowStockCount={lowStockCount}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* If not in POS mode, show the unified Teal Header matching the tablet aesthetic */}
        {activeTab !== 'pos' && (
          <header className="h-14 bg-[#00897B] text-white px-4 flex items-center justify-between shadow-md shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDrawerOpen(true)}
                title="Buka Menu"
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/15 transition cursor-pointer"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Center Brand Domain in Nasalization Font */}
            <div className="flex items-center justify-center">
              <span className="font-black text-lg sm:text-xl text-white tracking-widest font-nasalization drop-shadow-xs lowercase">
                {localStorage.getItem('store_brand_name') || 'www.larizk.com'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Active User Chip or Login Button */}
              {currentUser ? (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  title="Klik untuk ganti pengguna"
                  className="px-2.5 py-1.5 rounded-lg bg-black/25 hover:bg-black/35 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-white/10"
                >
                  <span>{getUserRoleBadge()}</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  title="Masuk / Login"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs animate-pulse"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>
              )}

              {authService.hasPermission('can_access_sync') && (
                <button
                  onClick={() => setIsSyncModalOpen(true)}
                  title="Sinkronisasi Data Transaksi"
                  className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Cloud className="w-4 h-4 text-teal-200" />
                  <span>Sync</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('pos')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Ke Kasir POS</span>
              </button>
            </div>
          </header>
        )}

        {/* View Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'pos' && (
            <PosTerminal
              initialVehicleId={selectedVehicleForPos}
              onVehicleSelectedHandled={() => setSelectedVehicleForPos(null)}
              onOpenDrawer={() => setIsDrawerOpen(true)}
            />
          )}

          {activeTab === 'crm' && (
            <CrmReminderView onSelectVehicleForPos={handleSelectVehicleForPos} />
          )}

          {activeTab === 'reports' && <BusinessReportsView />}

          {activeTab === 'master' && <MasterDataView />}

          {activeTab === 'history' && <TransactionHistoryView />}

          {activeTab === 'settings' && <SystemSettingsView />}
        </div>
      </main>

      {/* Global Sync & Realtime MQTT Settings Modal */}
      <SyncSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={loadBadgeStats}
      />

      {/* Global Login & User Switch Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          loadBadgeStats();
        }}
        canCancel={!!currentUser}
        onCancel={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
