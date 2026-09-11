import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  User,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Delete,
  CheckCircle2,
  Wrench,
  ShoppingBag,
  ShieldCheck,
  Crown,
  Loader2,
  AlertTriangle,
  Laptop,
  Clock,
  Unlock,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { AppUser, UserRole } from '../../types/pos';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  canCancel?: boolean;
  onCancel?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onSuccess,
  canCancel = false,
  onCancel,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginMode, setLoginMode] = useState<'pin' | 'password'>('pin');

  // Username/Password mode
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sessionLockData, setSessionLockData] = useState<{
    type: 'pin' | 'password';
    userId?: number;
    pin?: string;
    username?: string;
    password?: string;
    message: string;
    activeDevice?: string;
    lastActivityTime?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadUsers = async () => {
        try {
          const freshUsers = await authService.fetchUsersFromServer();
          const activeUsers = freshUsers.filter((u) => u.is_blocked === 0);
          setUsers(activeUsers);
          const current = authService.getCurrentUser();
          if (current && current.is_blocked === 0) {
            setSelectedUser(activeUsers.find((u) => u.user_id === current.user_id) || activeUsers[0] || null);
          } else if (activeUsers.length > 0) {
            setSelectedUser(activeUsers[0]);
          }
        } catch {
          const allUsers = authService.getUsers().filter((u) => u.is_blocked === 0);
          setUsers(allUsers);
        }
      };

      loadUsers();
      setPinInput('');
      setUsername('');
      setPassword('');
      setErrorMessage('');
      setSuccessMessage('');
      setSessionLockData(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePinDigit = (digit: string) => {
    if (isLoading) return;
    if (pinInput.length < 8) {
      const next = pinInput + digit;
      setPinInput(next);
      setErrorMessage('');
      setSessionLockData(null);
      // Auto-submit if reaches expected pin length
      const expectedLength = selectedUser?.pin?.length || 4;
      if (next.length === expectedLength) {
        if (selectedUser) {
          executePinLogin(selectedUser.user_id, next, false);
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (isLoading) return;
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handlePinClear = () => {
    if (isLoading) return;
    setPinInput('');
    setErrorMessage('');
  };

  const executePinLogin = async (userId: number, pin: string, force = false) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await authService.loginWithPin(userId, pin, force);
      if (res.success) {
        setSessionLockData(null);
        setSuccessMessage(res.message);
        setErrorMessage('');
        setTimeout(() => {
          onSuccess();
        }, 400);
      } else if (res.sessionLocked) {
        setSessionLockData({
          type: 'pin',
          userId,
          pin,
          message: res.message,
          activeDevice: res.activeDevice,
          lastActivityTime: res.lastActivityTime,
        });
        setErrorMessage(res.message);
        setPinInput('');
      } else {
        setSessionLockData(null);
        setErrorMessage(res.message);
        setPinInput('');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses otentikasi login.');
      setPinInput('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!selectedUser) {
      setErrorMessage('Pilih salah satu profil pengguna terlebih dahulu.');
      return;
    }
    executePinLogin(selectedUser.user_id, pinInput, false);
  };

  const handlePasswordSubmit = async (e?: React.FormEvent, force = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isLoading) return;
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Harap masukkan username dan password.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await authService.loginWithCredentials(username, password, force);
      if (res.success) {
        setSessionLockData(null);
        setSuccessMessage(res.message);
        setErrorMessage('');
        setTimeout(() => {
          onSuccess();
        }, 400);
      } else if (res.sessionLocked) {
        setSessionLockData({
          type: 'password',
          username,
          password,
          message: res.message,
          activeDevice: res.activeDevice,
          lastActivityTime: res.lastActivityTime,
        });
        setErrorMessage(res.message);
      } else {
        setSessionLockData(null);
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses otentikasi login.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-amber-400" />;
      case 'supervisor':
        return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      case 'kasir':
        return <ShoppingBag className="w-4 h-4 text-teal-400" />;
      case 'teknisi':
        return <Wrench className="w-4 h-4 text-orange-400" />;
      default:
        return <User className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'supervisor':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'kasir':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'teknisi':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00897B] to-slate-800 p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-orbitron font-black text-lg tracking-wider">MASUK SISTEM POS</h2>
              <p className="text-xs text-teal-100">Otorisasi & Hak Akses Kasir Bengkel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('pin');
                  setErrorMessage('');
                }}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  loginMode === 'pin' ? 'bg-[#00897B] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                PIN Cepat
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('password');
                  setErrorMessage('');
                }}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  loginMode === 'password' ? 'bg-[#00897B] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Username & Pass
              </button>
            </div>

            {canCancel && onCancel && (
              <button
                onClick={onCancel}
                className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Notifications */}
          {sessionLockData && (
            <div className="p-4 bg-amber-500/15 border border-amber-500/40 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/25 rounded-lg text-amber-300 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-xs text-amber-200 space-y-1">
                  <div className="font-bold text-sm text-amber-300">
                    Sesi Akun Sedang Aktif di Perangkat Lain
                  </div>
                  {/*<p className="leading-relaxed text-amber-200/90">{sessionLockData.message}</p>*/}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-amber-300/80 pt-1">
                    {/*<span className="flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                      <Laptop className="w-3.5 h-3.5 text-amber-400" />
                      Perangkat: <strong className="text-amber-100">{sessionLockData.activeDevice || 'Terminal Kasir Lain'}</strong>
                    </span>*/}
                    {sessionLockData.lastActivityTime && (
                      <span className="flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Terakhir Aktif: <strong className="text-amber-100">{sessionLockData.lastActivityTime}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (sessionLockData.type === 'pin' && sessionLockData.userId && sessionLockData.pin) {
                      executePinLogin(sessionLockData.userId, sessionLockData.pin, true);
                    } else if (sessionLockData.type === 'password') {
                      handlePasswordSubmit(undefined, true);
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  <span>Ambil Alih & Keluar dari Perangkat Lain (Force Login)</span>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setSessionLockData(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {!sessionLockData && errorMessage && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {loginMode === 'pin' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: User Profiles Selection */}
              <div className="md:col-span-6 space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  1. Pilih Profil Pengguna:
                </label>
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {users.map((u) => {
                    const isSelected = selectedUser?.user_id === u.user_id;
                    return (
                      <div
                        key={u.user_id}
                        onClick={() => {
                          setSelectedUser(u);
                          setPinInput('');
                          setErrorMessage('');
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#00897B]/20 border-[#00897B] text-white ring-1 ring-[#00897B]'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                              isSelected ? 'bg-[#00897B] text-white' : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {getRoleIcon(u.role)}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span
                                className={`px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase ${getRoleBadge(
                                  u.role
                                )}`}
                              >
                                {u.role}
                              </span>
                              <span>• @{u.username}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <span className="text-xs text-teal-400 font-bold flex items-center gap-1">
                              <span>Aktif</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 hover:text-slate-300">Pilih</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Touch PIN Numpad */}
              <div className="md:col-span-6 flex flex-col items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
                  2. Masukkan PIN ({selectedUser?.full_name || 'Pilih User'}):
                </label>

                {/* PIN Dots Display */}
                <div className="flex items-center justify-center gap-2.5 mb-4 h-12 w-full max-w-[240px] bg-slate-950 border border-slate-700 rounded-xl px-4 shadow-inner">
                  {Array.from({ length: Math.max(4, selectedUser?.pin?.length || 4) }).map((_, idx) => {
                    const hasDigit = pinInput.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                          hasDigit ? 'bg-amber-400 scale-125 shadow-sm shadow-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Numpad Grid */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinDigit(num)}
                      className="h-12 rounded-xl bg-slate-800 hover:bg-[#00897B] text-white font-orbitron font-bold text-lg border border-slate-700 hover:border-teal-400 shadow-sm active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handlePinClear}
                    className="h-12 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-rose-400 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinDigit('0')}
                    className="h-12 rounded-xl bg-slate-800 hover:bg-[#00897B] text-white font-orbitron font-bold text-lg border border-slate-700 hover:border-teal-400 shadow-sm active:scale-95 transition cursor-pointer flex items-center justify-center"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="h-12 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-amber-400 font-bold border border-slate-700 transition cursor-pointer flex items-center justify-center"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!pinInput || isLoading}
                  onClick={() => {
                    if (selectedUser) {
                      executePinLogin(selectedUser.user_id, pinInput, false);
                    }
                  }}
                  className="w-full max-w-[220px] mt-3 py-2.5 bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-teal-600 hover:to-[#00897B] text-white text-xs font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isLoading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Username & Password Form */
            <form onSubmit={(e) => handlePasswordSubmit(e, false)} className="max-w-md mx-auto space-y-4 py-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Username Pengguna</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: owner, supervisor, kasir"
                    disabled={isLoading}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-medium focus:border-teal-500 focus:outline-hidden disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password atau PIN</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password atau PIN"
                    disabled={isLoading}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-medium focus:border-teal-500 focus:outline-hidden disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#00897B] hover:bg-[#00796B] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Masuk ke Akun</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-400" />
            <span>Hak Akses Terenkripsi</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">MotoPOS v2.4</span>
        </div>
      </div>
    </div>
  );
};
