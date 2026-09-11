import { AppUser, UserRole, UserPermissions } from '../types/pos';
import { API_CONFIG } from '../config';

const STORAGE_USERS_KEY = 'motopos_users_data';
const STORAGE_CURRENT_USER_KEY = 'motopos_current_active_user';
const STORAGE_SESSION_ID_KEY = 'motopos_active_session_id';

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  owner: {
    can_add_product: true,
    can_edit_product: true,
    can_stock_opname: true,
    can_reprint_receipt: true,
    can_view_profit_report: true,
    can_manage_users: true,
    can_access_sync: true,
  },
  supervisor: {
    can_add_product: true,
    can_edit_product: true,
    can_stock_opname: true,
    can_reprint_receipt: true,
    can_view_profit_report: true,
    can_manage_users: false,
    can_access_sync: true,
  },
  kasir: {
    can_add_product: false,
    can_edit_product: false,
    can_stock_opname: false,
    can_reprint_receipt: true,
    can_view_profit_report: false,
    can_manage_users: false,
    can_access_sync: false,
  },
  teknisi: {
    can_add_product: false,
    can_edit_product: false,
    can_stock_opname: false,
    can_reprint_receipt: false,
    can_view_profit_report: false,
    can_manage_users: false,
    can_access_sync: false,
  },
};

const DEFAULT_INITIAL_USERS: AppUser[] = [
  {
    user_id: 1,
    username: 'owner',
    full_name: 'Bpk. Hendra (Owner)',
    role: 'owner',
    pin: '1234',
    password: 'admin',
    is_blocked: 0,
    is_active: 0,
    active_session_id: null,
    last_activity: null,
    permissions: { ...DEFAULT_PERMISSIONS.owner },
    created_at: '2026-01-01 08:00:00',
    last_login_at: new Date().toISOString(),
  },
  {
    user_id: 2,
    username: 'supervisor',
    full_name: 'Doni (Supervisor Toko)',
    role: 'supervisor',
    pin: '2345',
    password: 'spv',
    is_blocked: 0,
    is_active: 0,
    active_session_id: null,
    last_activity: null,
    permissions: { ...DEFAULT_PERMISSIONS.supervisor },
    created_at: '2026-01-01 08:00:00',
    last_login_at: null,
  },
  {
    user_id: 3,
    username: 'kasir',
    full_name: 'Siti Rahma (Kasir Shift 1)',
    role: 'kasir',
    pin: '1111',
    password: 'kasir',
    is_blocked: 0,
    is_active: 0,
    active_session_id: null,
    last_activity: null,
    permissions: { ...DEFAULT_PERMISSIONS.kasir },
    created_at: '2026-01-01 08:00:00',
    last_login_at: null,
  },
  {
    user_id: 4,
    username: 'teknisi',
    full_name: 'Agus (Mekanik Senior)',
    role: 'teknisi',
    pin: '9999',
    password: 'mekanik',
    is_blocked: 0,
    is_active: 0,
    active_session_id: null,
    last_activity: null,
    permissions: { ...DEFAULT_PERMISSIONS.teknisi },
    created_at: '2026-01-01 08:00:00',
    last_login_at: null,
  },
];

export interface LoginResult {
  success: boolean;
  message: string;
  user?: AppUser;
  sessionLocked?: boolean;
  activeDevice?: string;
  lastActivityTime?: string;
  canForceUnlock?: boolean;
}

class AuthService {
  private users: AppUser[] = [];
  private currentUser: AppUser | null = null;
  private currentSessionId: string | null = null;
  private listeners: ((user: AppUser | null) => void)[] = [];
  private heartbeatTimer: any = null;
  private syncTimer: any = null;

  constructor() {
    this.loadFromStorage();
    this.fetchUsersFromServer();
    this.startHeartbeatLoop();
    this.startPeriodicUserSync();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_KEY);
      if (stored) {
        this.users = JSON.parse(stored);
      } else {
        this.users = [...DEFAULT_INITIAL_USERS];
        this.saveUsersToStorage();
      }

      const activeStored = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      const sessionIdStored = localStorage.getItem(STORAGE_SESSION_ID_KEY);

      if (activeStored) {
        const parsed = JSON.parse(activeStored);
        const matched = this.users.find((u) => u.user_id === parsed.user_id);
        if (matched && matched.is_blocked === 0) {
          this.currentUser = matched;
          this.currentSessionId = sessionIdStored || null;
        } else {
          this.currentUser = null;
          this.currentSessionId = null;
        }
      }
    } catch {
      this.users = [...DEFAULT_INITIAL_USERS];
      this.currentUser = null;
      this.currentSessionId = null;
    }
  }

  private saveUsersToStorage() {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(this.users));
    } catch (err) {
      console.warn('Failed to persist users to localStorage:', err);
    }
  }

  private syncCurrentUserWithList() {
    if (this.currentUser) {
      const matched = this.users.find((u) => u.user_id === this.currentUser!.user_id);
      if (!matched || matched.is_blocked === 1) {
        console.warn('[AuthService] Current user removed or blocked on server, logging out...');
        this.logout();
      } else {
        this.currentUser = {
          ...matched,
          active_session_id: this.currentSessionId,
        };
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(this.currentUser));
        this.notify();
      }
    }
  }

  /**
   * Fetch live users directly from AUTH_LOCK_API_URL (https://larizk.com/api/auth_lock-api.php)
   * Primary: Cloud SQLite server API
   * Secondary: Local server /api/users
   * Tertiary: Local storage cache
   */
  public async fetchUsersFromServer(): Promise<AppUser[]> {
    const authUrl = API_CONFIG.AUTH_LOCK_API_URL;

    // 1. Primary: Ambil langsung dari AUTH_LOCK_API_URL (Cloud SQLite API Server)
    if (authUrl) {
      try {
        const url = authUrl.includes('?') ? `${authUrl}&action=get_users` : `${authUrl}?action=get_users`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json.data && Array.isArray(json.data) ? json.data : null);
          if (list && list.length > 0) {
            const mappedUsers: AppUser[] = list.map((u: any) => ({
              user_id: Number(u.user_id),
              username: u.username,
              full_name: u.full_name,
              role: u.role,
              pin: '', // KEAMANAN: PIN tidak dikirim/disimpan dalam get_users publik
              password: '', // KEAMANAN: Password tidak dikirim
              is_blocked: Number(u.is_blocked || 0),
              is_active: Number(u.is_active || 0),
              active_session_id: u.active_session_id || null,
              last_activity: u.last_activity || null,
              last_login_at: u.last_login_at || null,
              permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {}),
              created_at: u.created_at || new Date().toISOString(),
            }));

            this.users = mappedUsers;
            this.saveUsersToStorage();
            this.syncCurrentUserWithList();
            return [...this.users];
          }
        }
      } catch (cloudErr) {
        console.warn('[AuthService] Fetch from AUTH_LOCK_API_URL failed, trying secondary fallback:', cloudErr);
      }
    }

    // 2. Secondary: Ambil dari endpoint lokal /api/users
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const serverUsers: AppUser[] = await res.json();
        if (Array.isArray(serverUsers) && serverUsers.length > 0) {
          this.users = serverUsers.map((u: any) => ({
            ...u,
            pin: '', // KEAMANAN: Jangan simpan PIN di state publik
            password: '',
          }));
          this.saveUsersToStorage();
          this.syncCurrentUserWithList();
          return [...this.users];
        }
      }
    } catch (err) {
      console.warn('[AuthService] Local /api/users failed, using cached users from localStorage:', err);
    }

    return [...this.users];
  }

  private startPeriodicUserSync() {
    if (typeof window === 'undefined') return;
    if (this.syncTimer) clearInterval(this.syncTimer);

    // PERBAIKAN PERFORMA & BANDWIDTH:
    // Tidak melakukan polling get_users setiap 10 detik.
    // Pengecekan sesi hanya dilakukan oleh Heartbeat untuk 1 user yang login agar server tidak berat.
    let lastFocusSync = 0;
    window.addEventListener('focus', () => {
      const now = Date.now();
      if (!this.currentUser && now - lastFocusSync > 300000) {
        lastFocusSync = now;
        this.fetchUsersFromServer();
      }
    });
  }

  public onUserChange(listener: (user: AppUser | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentUser));
  }

  public getCurrentUser(): AppUser | null {
    return this.currentUser;
  }

  public getSessionId(): string | null {
    return this.currentSessionId;
  }

  public getUsers(): AppUser[] {
    return [...this.users];
  }

  /**
   * Heartbeat loop: periodically notifies server that session is alive,
   * and listens for kick/session invalidation from other devices.
   */
  private startHeartbeatLoop() {
    if (typeof window === 'undefined') return;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(async () => {
      if (!this.currentUser || !this.currentSessionId) return;

      const payload = {
        action: 'heartbeat',
        user_id: this.currentUser.user_id,
        session_id: this.currentSessionId,
      };

      const authUrl = API_CONFIG.AUTH_LOCK_API_URL;
      let handled = false;

      // 1. Try AUTH_LOCK_API_URL
      if (authUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            handled = true;
            if (json.status === 'kicked' || json.status === 'blocked' || json.status === 'invalid_session') {
              console.warn('[AuthLock] Sesi dibatalkan oleh server:', json.message);
              this.logout();
              alert(`Sesi Berakhir: ${json.message || 'Akun Anda telah login pada perangkat lain.'}`);
              return;
            }
          }
        } catch {
          // fallback to secondary
        }
      }

      // 2. Secondary: /api/users/session
      if (!handled) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch('/api/users/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            if (json.status === 'kicked' || json.status === 'blocked' || json.status === 'invalid_session') {
              console.warn('[AuthLock] Sesi dibatalkan oleh server:', json.message);
              this.logout();
              alert(`Sesi Berakhir: ${json.message || 'Akun Anda telah login pada perangkat lain.'}`);
            }
          }
        } catch {
          // toleransi offline
        }
      }
    }, API_CONFIG.SESSION_HEARTBEAT_INTERVAL_MS);
  }

  private applyLoginSuccess(userData: any, sessionIdFromServer: string | null, customMsg?: string): LoginResult {
    const user: AppUser = {
      user_id: Number(userData.user_id),
      username: userData.username,
      full_name: userData.full_name,
      role: userData.role,
      pin: String(userData.pin || '1234'),
      password: userData.password || userData.password_hash || '123456',
      is_blocked: Number(userData.is_blocked || 0),
      is_active: 1,
      active_session_id: sessionIdFromServer || `sess_${Date.now()}`,
      last_activity: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      permissions: typeof userData.permissions === 'string' ? JSON.parse(userData.permissions || '{}') : (userData.permissions || {}),
      created_at: userData.created_at || new Date().toISOString(),
    };

    const sessionId = user.active_session_id!;

    // Update local memory list
    const idx = this.users.findIndex((u) => u.user_id === user.user_id);
    if (idx !== -1) {
      this.users[idx] = user;
    } else {
      this.users.push(user);
    }

    this.currentUser = user;
    this.currentSessionId = sessionId;

    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_SESSION_ID_KEY, sessionId);
    this.saveUsersToStorage();
    this.notify();

    return {
      success: true,
      message: customMsg || `Selamat datang, ${user.full_name}!`,
      user,
    };
  }

  /**
   * Login with PIN - handled directly by AUTH_LOCK_API_URL or server SQLite
   */
  public async loginWithPin(userId: number, pin: string, force = false): Promise<LoginResult> {
    const authUrl = API_CONFIG.AUTH_LOCK_API_URL;
    const pinPayload = {
      action: 'login',
      login_type: 'pin',
      user_id: userId,
      pin: pin.trim(),
      force: force,
    };

    // 1. First priority: Try AUTH_LOCK_API_URL (Cloud SQLite API Server)
    if (authUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

        const resp = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pinPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();

          if (data.status === 'session_locked') {
            return {
              success: false,
              message: data.message,
              sessionLocked: true,
              activeDevice: data.active_device,
              lastActivityTime: data.last_activity_time,
              canForceUnlock: true,
            };
          }

          if (data.status === 'success' && data.user) {
            return this.applyLoginSuccess(data.user, data.session_id, data.message);
          }

          if (data.status === 'error') {
            return { success: false, message: data.message || 'Login gagal.' };
          }
        }
      } catch (cloudErr) {
        console.warn('[AuthService] AUTH_LOCK_API_URL login failed, trying secondary fallback:', cloudErr);
      }
    }

    // 2. Secondary priority: Local Server API (/api/users/session)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

      const resp = await fetch('/api/users/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();

        if (data.status === 'session_locked') {
          return {
            success: false,
            message: data.message,
            sessionLocked: true,
            activeDevice: data.active_device,
            lastActivityTime: data.last_activity_time,
            canForceUnlock: true,
          };
        }

        if (data.status === 'success' && data.user) {
          return this.applyLoginSuccess(data.user, data.session_id, data.message);
        }

        if (data.status === 'error') {
          return { success: false, message: data.message || 'Login gagal.' };
        }
      }
    } catch (networkErr) {
      console.warn('[AuthService] Local server login unreachable, using offline fallback:', networkErr);
    }

    // 3. Offline fallback if both servers are unreachable
    const userLocal = this.users.find((u) => u.user_id === userId);
    if (!userLocal) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }
    if (userLocal.is_blocked === 1) {
      return { success: false, message: 'Akun ini sedang dinonaktifkan / diblokir oleh Owner.' };
    }
    if (userLocal.pin.trim() !== pin.trim()) {
      return { success: false, message: 'PIN yang Anda masukkan salah!' };
    }

    const localSessionId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    userLocal.last_login_at = new Date().toISOString();
    userLocal.active_session_id = localSessionId;
    userLocal.is_active = 1;

    this.currentUser = userLocal;
    this.currentSessionId = localSessionId;

    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(userLocal));
    localStorage.setItem(STORAGE_SESSION_ID_KEY, localSessionId);
    this.saveUsersToStorage();
    this.notify();

    return { success: true, message: `Selamat datang, ${userLocal.full_name}! (Mode Offline)`, user: userLocal };
  }

  /**
   * Login with Username & Password / PIN - handled directly by AUTH_LOCK_API_URL or server SQLite
   */
  public async loginWithCredentials(username: string, passOrPin: string, force = false): Promise<LoginResult> {
    const cleanU = username.trim();
    const cleanP = passOrPin.trim();
    const authUrl = API_CONFIG.AUTH_LOCK_API_URL;
    const credPayload = {
      action: 'login',
      login_type: 'password',
      username: cleanU,
      password: cleanP,
      force: force,
    };

    // 1. First priority: Try AUTH_LOCK_API_URL
    if (authUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

        const resp = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();

          if (data.status === 'session_locked') {
            return {
              success: false,
              message: data.message,
              sessionLocked: true,
              activeDevice: data.active_device,
              lastActivityTime: data.last_activity_time,
              canForceUnlock: true,
            };
          }

          if (data.status === 'success' && data.user) {
            return this.applyLoginSuccess(data.user, data.session_id, data.message);
          }

          if (data.status === 'error') {
            return { success: false, message: data.message || 'Username atau password salah!' };
          }
        }
      } catch (cloudErr) {
        console.warn('[AuthService] AUTH_LOCK_API_URL credentials login failed, trying secondary fallback:', cloudErr);
      }
    }

    // 2. Secondary priority: /api/users/session
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

      const resp = await fetch('/api/users/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();

        if (data.status === 'session_locked') {
          return {
            success: false,
            message: data.message,
            sessionLocked: true,
            activeDevice: data.active_device,
            lastActivityTime: data.last_activity_time,
            canForceUnlock: true,
          };
        }

        if (data.status === 'success' && data.user) {
          return this.applyLoginSuccess(data.user, data.session_id, data.message);
        }

        if (data.status === 'error') {
          return { success: false, message: data.message || 'Username atau password salah!' };
        }
      }
    } catch (err) {
      console.warn('[AuthService] Local server login offline fallback:', err);
    }

    // 3. Offline fallback
    const user = this.users.find((u) => u.username.toLowerCase() === cleanU.toLowerCase());
    if (!user) {
      return { success: false, message: 'Username tidak ditemukan.' };
    }
    if (user.is_blocked === 1) {
      return { success: false, message: 'Akun ini sedang diblokir oleh Owner.' };
    }
    if (user.pin !== cleanP && user.password !== cleanP) {
      return { success: false, message: 'Password atau PIN salah!' };
    }

    const localSessionId = `local_${Date.now()}`;
    user.last_login_at = new Date().toISOString();
    user.active_session_id = localSessionId;
    user.is_active = 1;

    this.currentUser = user;
    this.currentSessionId = localSessionId;

    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_SESSION_ID_KEY, localSessionId);
    this.saveUsersToStorage();
    this.notify();

    return { success: true, message: `Login berhasil sebagai ${user.full_name}`, user };
  }

  /**
   * Force Unlock Session on Server SQLite
   */
  public async forceUnlockUser(targetUserId: number): Promise<{ success: boolean; message: string }> {
    const authUrl = API_CONFIG.AUTH_LOCK_API_URL;
    const payload = {
      action: 'force_unlock',
      target_user_id: targetUserId,
    };

    // 1. Primary: AUTH_LOCK_API_URL
    if (authUrl) {
      try {
        const resp = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.status === 'success') {
            const target = this.users.find((u) => u.user_id === targetUserId);
            if (target) {
              target.is_active = 0;
              target.active_session_id = null;
              this.saveUsersToStorage();
            }
            return { success: true, message: json.message || 'Sesi berhasil dibuka.' };
          }
        }
      } catch (err) {
        console.warn('[AuthService] Force unlock on AUTH_LOCK_API_URL failed:', err);
      }
    }

    // 2. Secondary: /api/users/session
    try {
      const resp = await fetch('/api/users/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const json = await resp.json();
        return { success: json.status === 'success', message: json.message };
      }
    } catch (e) {
      // Offline fallback
    }

    const target = this.users.find((u) => u.user_id === targetUserId);
    if (target) {
      target.is_active = 0;
      target.active_session_id = null;
      this.saveUsersToStorage();
    }
    return { success: true, message: 'Kunci sesi pengguna berhasil dibebaskan.' };
  }

  public async logout(): Promise<void> {
    const prevSession = this.currentSessionId;
    const prevUser = this.currentUser;

    this.currentUser = null;
    this.currentSessionId = null;
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    localStorage.removeItem(STORAGE_SESSION_ID_KEY);
    this.notify();

    // Release session lock on Server SQLite
    if (prevSession || prevUser) {
      const payload = {
        action: 'logout',
        session_id: prevSession,
        user_id: prevUser?.user_id,
      };

      // 1. Try AUTH_LOCK_API_URL
      if (API_CONFIG.AUTH_LOCK_API_URL) {
        fetch(API_CONFIG.AUTH_LOCK_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }

      // 2. Try /api/users/session
      fetch('/api/users/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  }

  public hasPermission(permission: keyof UserPermissions): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'owner') return true;
    return !!this.currentUser.permissions?.[permission];
  }

  public createUser(userData: {
    username: string;
    full_name: string;
    role: UserRole;
    pin: string;
    password?: string;
    permissions?: Partial<UserPermissions>;
  }): AppUser {
    const existing = this.users.find((u) => u.username.toLowerCase() === userData.username.trim().toLowerCase());
    if (existing) {
      throw new Error(`Username "${userData.username}" sudah digunakan. Silakan pilih username lain.`);
    }

    const nextId = this.users.length > 0 ? Math.max(...this.users.map((u) => u.user_id)) + 1 : 1;
    const defaultPerm = DEFAULT_PERMISSIONS[userData.role] || DEFAULT_PERMISSIONS.kasir;

    const newUser: AppUser = {
      user_id: nextId,
      username: userData.username.trim(),
      full_name: userData.full_name.trim(),
      role: userData.role,
      pin: userData.pin.trim() || '1234',
      password: userData.password?.trim() || '123456',
      is_blocked: 0,
      is_active: 0,
      active_session_id: null,
      last_activity: null,
      permissions: {
        ...defaultPerm,
        ...(userData.permissions || {}),
      },
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      last_login_at: null,
    };

    this.users.push(newUser);
    this.saveUsersToStorage();

    // 1. Sync to AUTH_LOCK_API_URL
    if (API_CONFIG.AUTH_LOCK_API_URL) {
      fetch(API_CONFIG.AUTH_LOCK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_user',
          username: newUser.username,
          full_name: newUser.full_name,
          role: newUser.role,
          pin: newUser.pin,
          password: newUser.password,
          permissions: newUser.permissions,
        }),
      })
        .then((res) => res.json())
        .then((serverData) => {
          if (serverData && serverData.user && serverData.user.user_id) {
            newUser.user_id = serverData.user.user_id;
            this.saveUsersToStorage();
            this.notify();
          }
        })
        .catch(() => {});
    }

    // 2. Sync to local /api/users
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUser.username,
        full_name: newUser.full_name,
        role: newUser.role,
        pin: newUser.pin,
        password: newUser.password,
        permissions: newUser.permissions,
      }),
    })
      .then((res) => res.json())
      .then((serverUser) => {
        if (serverUser && serverUser.user_id) {
          newUser.user_id = serverUser.user_id;
          this.saveUsersToStorage();
          this.notify();
        }
      })
      .catch((err) => console.warn('[AuthService] Create user on server SQLite failed:', err));

    return newUser;
  }

  public updateUser(
    userId: number,
    updates: Partial<Omit<AppUser, 'user_id' | 'created_at'>>
  ): AppUser {
    const index = this.users.findIndex((u) => u.user_id === userId);
    if (index === -1) throw new Error('Pengguna tidak ditemukan');

    if (updates.username) {
      const conflict = this.users.find(
        (u) => u.user_id !== userId && u.username.toLowerCase() === updates.username!.trim().toLowerCase()
      );
      if (conflict) {
        throw new Error(`Username "${updates.username}" sudah digunakan oleh pengguna lain.`);
      }
    }

    this.users[index] = {
      ...this.users[index],
      ...updates,
      permissions: {
        ...this.users[index].permissions,
        ...(updates.permissions || {}),
      },
    };

    if (this.currentUser && this.currentUser.user_id === userId) {
      this.currentUser = this.users[index];
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(this.currentUser));
      this.notify();
    }

    this.saveUsersToStorage();

    // 1. Sync to AUTH_LOCK_API_URL
    if (API_CONFIG.AUTH_LOCK_API_URL) {
      fetch(API_CONFIG.AUTH_LOCK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          user_id: userId,
          ...updates,
        }),
      }).catch(() => {});
    }

    // 2. Sync to local /api/users
    fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch((err) => console.warn('[AuthService] Update user on server SQLite failed:', err));

    return this.users[index];
  }

  public updatePermissions(userId: number, permissions: UserPermissions): AppUser {
    const user = this.users.find((u) => u.user_id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan');

    user.permissions = { ...permissions };
    if (user.role === 'owner') {
      user.permissions = { ...DEFAULT_PERMISSIONS.owner };
    }

    if (this.currentUser && this.currentUser.user_id === userId) {
      this.currentUser = user;
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
      this.notify();
    }

    this.saveUsersToStorage();

    // 1. Sync to AUTH_LOCK_API_URL
    if (API_CONFIG.AUTH_LOCK_API_URL) {
      fetch(API_CONFIG.AUTH_LOCK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          user_id: userId,
          permissions: user.permissions,
        }),
      }).catch(() => {});
    }

    // 2. Sync to local /api/users
    fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: user.permissions }),
    }).catch((err) => console.warn('[AuthService] Update perms on server SQLite failed:', err));

    return user;
  }

  public toggleBlockUser(userId: number): AppUser {
    const user = this.users.find((u) => u.user_id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan');
    if (user.role === 'owner' && user.user_id === 1) {
      throw new Error('Akun Super Admin (Owner) tidak dapat diblokir!');
    }

    user.is_blocked = user.is_blocked === 1 ? 0 : 1;

    if (this.currentUser && this.currentUser.user_id === userId && user.is_blocked === 1) {
      this.logout();
    }

    this.saveUsersToStorage();

    // 1. Sync to AUTH_LOCK_API_URL
    if (API_CONFIG.AUTH_LOCK_API_URL) {
      fetch(API_CONFIG.AUTH_LOCK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          user_id: userId,
          is_blocked: user.is_blocked,
        }),
      }).catch(() => {});
    }

    // 2. Sync to local /api/users
    fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_blocked: user.is_blocked }),
    }).catch((err) => console.warn('[AuthService] Toggle block on server SQLite failed:', err));

    return user;
  }

  public deleteUser(userId: number): void {
    const user = this.users.find((u) => u.user_id === userId);
    if (!user) throw new Error('Pengguna tidak ditemukan');
    if (user.role === 'owner' && user.user_id === 1) {
      throw new Error('Akun Super Admin (Owner) utama tidak dapat dihapus!');
    }

    this.users = this.users.filter((u) => u.user_id !== userId);

    if (this.currentUser && this.currentUser.user_id === userId) {
      this.logout();
    }

    this.saveUsersToStorage();

    // 1. Sync to AUTH_LOCK_API_URL
    if (API_CONFIG.AUTH_LOCK_API_URL) {
      fetch(API_CONFIG.AUTH_LOCK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_user',
          user_id: userId,
        }),
      }).catch(() => {});
    }

    // 2. Sync to local /api/users
    fetch(`/api/users/${userId}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('[AuthService] Delete user on server SQLite failed:', err));
  }

  public resetToDefaultUsers() {
    this.users = [...DEFAULT_INITIAL_USERS];
    this.saveUsersToStorage();
  }
}

export const authService = new AuthService();
