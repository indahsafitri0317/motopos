import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Ban,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
  Search,
  Server,
  Cloud,
  Database,
  Radio,
  ExternalLink,
  Crown,
  ShoppingBag,
  Wrench,
  UserCheck,
  Check,
  X,
  Package,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { syncService, SyncStatus } from '../../services/syncService';
import { mqttService, MqttConfig } from '../../services/mqttService';
import { api } from '../../services/api';
import { AppUser, UserRole, UserPermissions, Product } from '../../types/pos';

export const SystemSettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'privileges' | 'sync' | 'db_info'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Modal Create / Edit User State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('kasir');
  const [formPin, setFormPin] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>({
    can_add_product: false,
    can_edit_product: false,
    can_stock_opname: false,
    can_reprint_receipt: true,
    can_view_profit_report: false,
    can_manage_users: false,
    can_access_sync: false,
  });

  // Selected User for Privileges Tab
  const [selectedPrivilegeUserId, setSelectedPrivilegeUserId] = useState<number>(1);
  const [privilegeForm, setPrivilegeForm] = useState<UserPermissions>({
    can_add_product: true,
    can_edit_product: true,
    can_stock_opname: true,
    can_reprint_receipt: true,
    can_view_profit_report: true,
    can_manage_users: true,
    can_access_sync: true,
  });

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncConfig, setSyncConfig] = useState(syncService.getConfig());
  const [productsCount, setProductsCount] = useState(0);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setUsers(authService.getUsers());
    setCurrentUser(authService.getCurrentUser());
    try {
      const status = await syncService.getStatus();
      setSyncStatus(status);
      const prods = await api.getProducts();
      setProductsCount(prods.length);
    } catch (err) {
      console.error('Error loading settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
    authService.fetchUsersFromServer().then((fresh) => {
      setUsers(fresh);
    }).catch(() => {});
    const unsub = authService.onUserChange((user) => {
      setCurrentUser(user);
      setUsers(authService.getUsers());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const targetUser = users.find((u) => u.user_id === selectedPrivilegeUserId);
    if (targetUser) {
      setPrivilegeForm({ ...targetUser.permissions });
    }
  }, [selectedPrivilegeUserId, users]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setFormFullName('');
    setFormUsername('');
    setFormRole('kasir');
    setFormPin('1111');
    setFormPassword('123456');
    setFormPermissions({
      can_add_product: false,
      can_edit_product: false,
      can_stock_opname: false,
      can_reprint_receipt: true,
      can_view_profit_report: false,
      can_manage_users: false,
      can_access_sync: false,
    });
    setIsUserModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u: AppUser) => {
    setEditingUserId(u.user_id);
    setFormFullName(u.full_name);
    setFormUsername(u.username);
    setFormRole(u.role);
    setFormPin(''); // Keamanan: Jangan isi form dengan PIN lama
    setFormPassword('');
    setFormPermissions({ ...u.permissions });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formUsername.trim()) {
      showToast('Harap lengkapi Nama Lengkap dan Username.', 'error');
      return;
    }

    if (!editingUserId && !formPin.trim()) {
      showToast('PIN cepat (4-6 digit) wajib diisi untuk pengguna baru.', 'error');
      return;
    }

    try {
      if (editingUserId) {
        const updatePayload: Partial<AppUser> = {
          full_name: formFullName.trim(),
          username: formUsername.trim(),
          role: formRole,
          permissions: formPermissions,
        };
        // Hanya update PIN jika owner memasukkan PIN baru
        if (formPin.trim()) {
          updatePayload.pin = formPin.trim();
        }
        if (formPassword.trim()) {
          updatePayload.password = formPassword.trim();
        }

        authService.updateUser(editingUserId, updatePayload);
        showToast(`Data pengguna "${formFullName}" berhasil diperbarui!`);
      } else {
        authService.createUser({
          full_name: formFullName.trim(),
          username: formUsername.trim(),
          role: formRole,
          pin: formPin.trim(),
          password: formPassword.trim() || '123456',
          permissions: formPermissions,
        });
        showToast(`Pengguna baru "${formFullName}" berhasil didaftarkan!`);
      }
      setIsUserModalOpen(false);
      setUsers(authService.getUsers());
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengguna.', 'error');
    }
  };

  const handleToggleBlock = (u: AppUser) => {
    try {
      const updated = authService.toggleBlockUser(u.user_id);
      setUsers(authService.getUsers());
      showToast(
        updated.is_blocked === 1
          ? `Akun ${u.full_name} berhasil DINONAKTIFKAN / DIBLOKIR.`
          : `Akun ${u.full_name} AKTIF kembali.`
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUser = (u: AppUser) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pengguna "${u.full_name}" (@${u.username})?`)) {
      try {
        authService.deleteUser(u.user_id);
        setUsers(authService.getUsers());
        showToast(`Pengguna ${u.full_name} telah dihapus.`);
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  const handleSavePrivileges = () => {
    try {
      authService.updatePermissions(selectedPrivilegeUserId, privilegeForm);
      setUsers(authService.getUsers());
      const u = users.find((x) => x.user_id === selectedPrivilegeUserId);
      showToast(`Hak akses untuk ${u?.full_name || 'pengguna'} berhasil disimpan!`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan hak akses', 'error');
    }
  };

  // Sync Handlers
  const handleSyncDelta = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Delta sync = only unsynced sales (isForceAll = false)
      const res = await syncService.syncNow(false);
      setSyncMessage({
        type: 'success',
        text: res.message || `${res.synced_count} transaksi berhasil disinkronkan!`,
      });
      const st = await syncService.getStatus();
      setSyncStatus(st);
      showToast(`Sinkronisasi selesai: ${res.synced_count} data terkirim.`);
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err.message || 'Gagal menyinkronkan transaksi.',
      });
      showToast(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncForceAll = async () => {
    if (!confirm('Kirim ulang seluruh riwayat penjualan ke server? Data tidak akan ganda.')) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncService.syncNow(true);
      setSyncMessage({
        type: 'success',
        text: `Sukses kirim ulang: ${res.synced_count} total transaksi diselaraskan ke server.`,
      });
      const st = await syncService.getStatus();
      setSyncStatus(st);
      showToast(`Semua data penjualan berhasil diselaraskan.`);
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err.message || 'Gagal kirim ulang semua transaksi.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isSyncingAllData, setIsSyncingAllData] = useState(false);

  const handleSyncAllDatabase = async () => {
    setIsSyncingAllData(true);
    setSyncMessage(null);
    try {
      const [prods, cats, custs, vehs, mecs, sales] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getCategories().catch(() => []),
        api.getCustomers().catch(() => []),
        api.getVehicles().catch(() => []),
        api.getMechanics().catch(() => []),
        api.getSales(1000).catch(() => []),
      ]);

      const res = await syncService.syncAllData({
        products: prods,
        categories: cats,
        customers: custs,
        vehicles: vehs,
        mechanics: mecs,
        sales: sales,
      });

      setSyncMessage({
        type: 'success',
        text: res.message || `Replika seluruh database (${prods.length} produk, ${custs.length} pelanggan, ${vehs.length} motor, ${sales.length} transaksi) berhasil diselaraskan ke SQLite server.`,
      });
      showToast(`Replika 7 tabel database berhasil disinkronkan ke server!`);
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `Gagal sinkronkan seluruh database: ${err.message}`,
      });
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setIsSyncingAllData(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/20 text-amber-700 border-amber-300 font-black';
      case 'supervisor':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold';
      case 'kasir':
        return 'bg-teal-50 text-teal-700 border-teal-200 font-bold';
      case 'teknisi':
        return 'bg-orange-50 text-orange-700 border-orange-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    }
  };

  return (
    <div className="flex-1 bg-[#ECEFF1] p-4 lg:p-6 overflow-y-auto flex flex-col gap-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-bottom-5 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-600'
              : 'bg-rose-900 text-rose-100 border-rose-600'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#00897B] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span>Pusat Sistem, Pengguna & Pengaturan POS</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola data staf kasir, hak akses wewenang toko, dan sinkronisasi server hosting larizk.com.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'users' ? 'bg-[#00897B] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kelola Pengguna ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('privileges')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'privileges'
                ? 'bg-[#00897B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Hak Akses (Privilege)</span>
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sync' ? 'bg-[#00897B] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Sinkronisasi Server</span>
            {syncStatus && syncStatus.unsynced_count > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full">
                {syncStatus.unsynced_count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ================= TAB 1: KELOLA PENGGUNA ================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama atau username pengguna..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:border-teal-600 focus:outline-hidden"
                />
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="all">Semua Role</option>
                <option value="owner">Owner / Super Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="kasir">Kasir</option>
                <option value="teknisi">Teknisi / Mekanik</option>
              </select>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pengguna Baru</span>
            </button>
          </div>

          {/* User Data List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Pengguna</th>
                    <th className="py-3 px-3">Role / Jabatan</th>
                    <th className="py-3 px-3 text-center">PIN Akses</th>
                    <th className="py-3 px-4">Hak Akses Sistem</th>
                    <th className="py-3 px-3 text-center">Status Akun</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada data pengguna yang sesuai dengan pencarian atau filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isBlocked = u.is_blocked === 1;
                      const isCurrent = currentUser?.user_id === u.user_id;

                      return (
                        <tr
                          key={u.user_id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isBlocked
                              ? 'bg-rose-50/30 text-slate-500'
                              : isCurrent
                              ? 'bg-teal-50/20'
                              : ''
                          }`}
                        >
                          {/* 1. Pengguna */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                                  u.role === 'owner'
                                    ? 'bg-amber-100 text-amber-700'
                                    : u.role === 'supervisor'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : u.role === 'kasir'
                                    ? 'bg-teal-100 text-teal-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {u.role === 'owner' && <Crown className="w-4 h-4" />}
                                {u.role === 'supervisor' && <ShieldCheck className="w-4 h-4" />}
                                {u.role === 'kasir' && <ShoppingBag className="w-4 h-4" />}
                                {u.role === 'teknisi' && <Wrench className="w-4 h-4" />}
                              </div>

                              <div>
                                <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                                  <span>{u.full_name}</span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 text-[10px] font-black rounded">
                                      Aktif
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono font-medium">@{u.username}</div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Role */}
                          <td className="py-3 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg border text-[11px] uppercase font-bold ${getRoleBadge(u.role)}`}>
                              {u.role}
                            </span>
                          </td>

                          {/* 3. PIN Keamanan (Tersensor / Tersembunyi) */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-xs font-mono font-bold tracking-widest" title="PIN Terenkripsi & Terlindungi">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>••••••</span>
                            </span>
                          </td>

                          {/* 4. Hak Akses */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs sm:max-w-md">
                              {u.permissions?.can_add_product && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                                  +Produk
                                </span>
                              )}
                              {u.permissions?.can_edit_product && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                                  Edit Harga
                                </span>
                              )}
                              {u.permissions?.can_stock_opname && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                                  Opname
                                </span>
                              )}
                              {u.permissions?.can_reprint_receipt && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                                  Cetak Ulang
                                </span>
                              )}
                              {u.permissions?.can_view_profit_report && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                                  Laba Rugi
                                </span>
                              )}
                              {u.permissions?.can_access_sync && (
                                <span className="px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[10px] font-bold">
                                  Sync Cloud
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. Status Akun */}
                          <td className="py-3 px-3 text-center">
                            {isBlocked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Ban className="w-3 h-3 text-rose-600" />
                                DIBLOKIR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                AKTIF
                              </span>
                            )}
                          </td>

                          {/* 6. Aksi */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 transition cursor-pointer"
                                title="Edit Pengguna"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit</span>
                              </button>

                              {u.role !== 'owner' && (
                                <button
                                  onClick={() => handleToggleBlock(u)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                                    isBlocked
                                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                  }`}
                                  title={isBlocked ? 'Buka Blokir' : 'Blokir Pengguna'}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>{isBlocked ? 'Buka' : 'Blokir'}</span>
                                </button>
                              )}

                              {u.role !== 'owner' && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-400 rounded-lg transition cursor-pointer"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: HAK AKSES (PRIVILEGES) ================= */}
      {activeTab === 'privileges' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Pengaturan Hak Akses & Wewenang Toko</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur hak operasional setiap staf. Kasir hanya diizinkan transaksi, sedangkan manipulasi harga atau laporan dilindungi wewenang.
            </p>
          </div>

          {/* User Selector Dropdown */}
          <div className="max-w-md bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Pengguna yang Ingin Diatur:</label>
            <select
              value={selectedPrivilegeUserId}
              onChange={(e) => setSelectedPrivilegeUserId(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} (@{u.username}) — Role: {u.role.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Privilege Checkboxes Matrix */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Daftar Izin Operasional:
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* can_add_product */}
              <label className="p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={privilegeForm.can_add_product}
                  onChange={(e) =>
                    setPrivilegeForm({ ...privilegeForm, can_add_product: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900">Tambah Produk & Jasa Baru</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mengizinkan staf menginput barang, oli, sparepart, atau jasa servis baru ke master database.
                  </div>
                </div>
              </label>

              {/* can_edit_product */}
              <label className="p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={privilegeForm.can_edit_product}
                  onChange={(e) =>
                    setPrivilegeForm({ ...privilegeForm, can_edit_product: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900">Edit Produk & Harga Jual</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mengizinkan perubahan harga modal (HPP), harga jual eceran, dan nama produk di katalog.
                  </div>
                </div>
              </label>

              {/* can_stock_opname */}
              <label className="p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={privilegeForm.can_stock_opname}
                  onChange={(e) =>
                    setPrivilegeForm({ ...privilegeForm, can_stock_opname: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900">Stok Opname / Penyesuaian Stok</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mengizinkan penambahan atau koreksi jumlah stok barang fisik di gudang/etalase.
                  </div>
                </div>
              </label>

              {/* can_reprint_receipt */}
              <label className="p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={privilegeForm.can_reprint_receipt}
                  onChange={(e) =>
                    setPrivilegeForm({ ...privilegeForm, can_reprint_receipt: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900">Cetak Ulang Nota Lama</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mengizinkan kasir mencetak ulang struk transaksi lama di menu riwayat transaksi.
                  </div>
                </div>
              </label>

              {/* can_view_profit_report */}
              <label className="p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-2.5 bg-amber-50/40">
                <input
                  type="checkbox"
                  checked={privilegeForm.can_view_profit_report}
                  onChange={(e) =>
                    setPrivilegeForm({ ...privilegeForm, can_view_profit_report: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                    <span>Lihat Laporan Omzet, HPP & Laba Rugi</span>
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Melihat angka margin keuntungan bersih bengkel, rekap harian/bulanan, dan data finansial.
                  </div>
                </div>
              </label>

              {/* can_access_sync */}
              <label className="p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={privilegeForm.can_access_sync}
                  onChange={(e) =>
                    setPrivilegeForm({ ...privilegeForm, can_access_sync: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900">Akses Sinkronisasi Cloud Server</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mengizinkan memicu tombol sync data transaksi ke server hosting larizk.com.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={handleSavePrivileges}
              className="px-5 py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan Hak Akses</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: SINKRONISASI LENGKAP ================= */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                Transaksi Belum Disinkronkan
              </span>
              <div className="text-2xl sm:text-3xl font-black font-orbitron text-[#00897B] mt-1.5">
                {syncStatus?.unsynced_count || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Data nota baru di SQLite yang belum dikirim ke hosting.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                Total Riwayat Penjualan
              </span>
              <div className="text-2xl sm:text-3xl font-black font-orbitron text-slate-800 mt-1.5">
                {syncStatus?.total_sales || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Keseluruhan nota penjualan tersimpan di tablet.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                Total Master Produk & Jasa
              </span>
              <div className="text-2xl sm:text-3xl font-black font-orbitron text-slate-800 mt-1.5">
                {productsCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Barang, sparepart & oli di katalog.</p>
            </div>
          </div>

          {/* Sync Actions Box */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Operasi Sinkronisasi Data</h2>

            {/* Sync Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-0.5">
              {/* Option 1: Delta Sync (Unsynced only) */}
              <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-teal-900 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                    <span>1. Sync Transaksi Baru (Delta)</span>
                  </div>
                  <p className="text-[11px] text-teal-800 mt-1 leading-relaxed">
                    Mengirim <strong>{syncStatus?.unsynced_count || 0} nota kasir</strong> yang belum tersinkron. Sangat cepat & hemat bandwidth!
                  </p>
                </div>
                <button
                  onClick={handleSyncDelta}
                  disabled={isSyncing}
                  className="w-full py-2 bg-[#00897B] hover:bg-[#00796B] disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition cursor-pointer active:scale-95 mt-1"
                >
                  {isSyncing ? 'Mengirim...' : `Kirim ${syncStatus?.unsynced_count || 0} Nota Baru`}
                </button>
              </div>

              {/* Option 2: Full Database Replica Sync (7 Tables) */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-indigo-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Sync Replika Database Lengkap</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 mt-1 leading-relaxed">
                    Sinkronkan seluruh <strong>7 tabel SQLite</strong> (Produk, Kategori, Pelanggan, Motor, Mekanik & Riwayat) menjadi mirror identik di server.
                  </p>
                </div>
                <button
                  onClick={handleSyncAllDatabase}
                  disabled={isSyncingAllData}
                  className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition cursor-pointer active:scale-95 mt-1"
                >
                  {isSyncingAllData ? 'Menyelaraskan Replika...' : 'Sync Semua 7 Tabel'}
                </button>
              </div>

              {/* Option 3: Force Resync All Sales History */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                    <span>3. Kirim Ulang Semua Nota</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Kirim ulang seluruh {syncStatus?.total_sales || 0} riwayat nota untuk memastikan database transaksi server 100% lengkap.
                  </p>
                </div>
                <button
                  onClick={handleSyncForceAll}
                  disabled={isSyncing}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs transition cursor-pointer active:scale-95 mt-1"
                >
                  Kirim Ulang Semua ({syncStatus?.total_sales || 0})
                </button>
              </div>
            </div>

            {/* Message Banner */}
            {syncMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  syncMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {syncMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{syncMessage.text}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL TAMBAH / EDIT PENGGUNA ================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#00897B] p-5 text-white flex items-center justify-between">
              <h3 className="font-black text-base flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>{editingUserId ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}</span>
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 overflow-y-auto space-y-4 text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Staf *</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-white focus:border-teal-600 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="budikasi1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-white focus:border-teal-600 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role / Jabatan *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                  >
                    <option value="kasir">Kasir</option>
                    <option value="teknisi">Teknisi / Mekanik</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="owner">Owner / Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editingUserId ? 'Ubah PIN Cepat (4-6 digit)' : 'PIN Cepat Tablet (4-6 digit) *'}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={editingUserId ? 'Kosongkan jika tidak diubah' : 'Contoh: 1234'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold focus:bg-white focus:border-teal-600 focus:outline-hidden"
                    required={!editingUserId}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password Tambahan</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Opsional"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-white focus:border-teal-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block font-bold text-slate-700 mb-2">Pilih Hak Akses Pengguna Ini:</label>
                <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={formPermissions.can_add_product}
                      onChange={(e) =>
                        setFormPermissions({ ...formPermissions, can_add_product: e.target.checked })
                      }
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <span>Tambah Produk</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={formPermissions.can_edit_product}
                      onChange={(e) =>
                        setFormPermissions({ ...formPermissions, can_edit_product: e.target.checked })
                      }
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <span>Edit Produk & Harga</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={formPermissions.can_stock_opname}
                      onChange={(e) =>
                        setFormPermissions({ ...formPermissions, can_stock_opname: e.target.checked })
                      }
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <span>Stok Opname</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={formPermissions.can_reprint_receipt}
                      onChange={(e) =>
                        setFormPermissions({ ...formPermissions, can_reprint_receipt: e.target.checked })
                      }
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <span>Cetak Ulang Nota</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={formPermissions.can_view_profit_report}
                      onChange={(e) =>
                        setFormPermissions({
                          ...formPermissions,
                          can_view_profit_report: e.target.checked,
                        })
                      }
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <span>Laporan Laba Rugi</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={formPermissions.can_access_sync}
                      onChange={(e) =>
                        setFormPermissions({ ...formPermissions, can_access_sync: e.target.checked })
                      }
                      className="rounded text-teal-600 w-4 h-4"
                    />
                    <span>Sinkronisasi Server</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#00897B] hover:bg-[#00796B] text-white font-black rounded-xl shadow-xs cursor-pointer text-sm"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
