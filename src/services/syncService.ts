import { wasmDb } from './wasmDb';
import { checkServerAvailability } from './api';

export interface SyncConfig {
  apiUrl: string;
  allDataApiUrl: string;
  apiKey: string;
  deviceId: string;
  autoSyncOnCheckout: boolean;
}

export interface SyncStatus {
  unsynced_count: number;
  total_sales: number;
  last_synced_at: string | null;
}

const DEFAULT_CONFIG: SyncConfig = {
  apiUrl: 'https://larizk.com/api/sync_report-api.php',
  allDataApiUrl: 'https://larizk.com/api/sync_all_data-api.php',
  apiKey: 'LARIZK_BENGKEL_2026',
  deviceId: 'TABLET-KASIR-01',
  autoSyncOnCheckout: false,
};

const STORAGE_KEY = 'motopos_sync_config';

class SyncService {
  private config: SyncConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public getConfig(): SyncConfig {
    return { ...this.config };
  }

  public saveConfig(newConfig: Partial<SyncConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save sync config to localStorage', e);
    }
  }

  private loadConfig(): SyncConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse sync config from localStorage', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Fetch current sync status from local SQLite database (Server or WASM)
   */
  public async getStatus(): Promise<SyncStatus> {
    if (await checkServerAvailability()) {
      try {
        const res = await fetch('/api/sync/status');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Server sync status fetch error, fallback to WASM SQLite:', err);
      }
    }

    try {
      const unsynced = await wasmDb.getUnsyncedSales();
      const allSales = await wasmDb.getSales(1000);
      const syncedSales = allSales.filter((s) => s.is_synced === 1 && s.synced_at);

      return {
        unsynced_count: unsynced.length,
        total_sales: allSales.length,
        last_synced_at: syncedSales[0]?.synced_at || null,
      };
    } catch (err) {
      console.warn('WASM SQLite sync status fallback failed:', err);
      return {
        unsynced_count: 0,
        total_sales: 0,
        last_synced_at: null,
      };
    }
  }

  /**
   * Push unsynced (or all) transactions to https://larizk.com/api/sync_report-api.php
   */
  public async syncNow(forceAll: boolean = false): Promise<{
    success: boolean;
    synced_count: number;
    message: string;
    server_response?: any;
  }> {
    if (await checkServerAvailability()) {
      try {
        const res = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_url: this.config.apiUrl,
            api_key: this.config.apiKey,
            device_id: this.config.deviceId,
            force_all: forceAll,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.status === 'error') {
            throw new Error(data.message || 'Gagal menyinkronkan data di server');
          }
          return data;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('fetch')) {
          throw err;
        }
        // Fallback to direct client-side push in WASM / preview mode
      }
    }

    // Direct Browser Client Push using wasmDb
    let salesToSend: any[] = [];
    if (forceAll) {
      salesToSend = await wasmDb.getAllSalesForSync();
    } else {
      salesToSend = await wasmDb.getUnsyncedSales();
      // If no unsynced data, check if there are any sales at all
      if (salesToSend.length === 0) {
        salesToSend = await wasmDb.getAllSalesForSync();
      }
    }

    if (salesToSend.length === 0) {
      return {
        success: true,
        synced_count: 0,
        message: 'Belum ada data transaksi kasir di database SQLite untuk disinkronkan.',
      };
    }

    const payload = {
      api_key: this.config.apiKey,
      device_id: this.config.deviceId,
      sync_time: new Date().toISOString(),
      transactions: salesToSend,
    };

    const targetUrl = this.config.apiUrl;
    let remoteRes: Response;
    try {
      remoteRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr: any) {
      throw new Error(
        `Gagal menghubungi server tujuan (${targetUrl}). Pastikan hosting aktif, URL benar, dan mengizinkan CORS: ${netErr.message}`
      );
    }

    const contentType = remoteRes.headers.get('content-type') || '';
    let remoteData: any = {};
    if (contentType.includes('application/json')) {
      try {
        remoteData = await remoteRes.json();
      } catch (parseErr) {
        throw new Error('Server mengembalikan respons yang tidak dapat dibaca.');
      }
    } else {
      const text = await remoteRes.text();
      // If server returned HTML error or PHP fatal error
      throw new Error(
        `Server mengembalikan pesan non-JSON (${remoteRes.status}): ${text.replace(/<[^>]*>?/gm, '').trim().slice(0, 150)}`
      );
    }

    if (!remoteRes.ok || remoteData.status === 'error') {
      throw new Error(
        remoteData.message || `Server PHP menolak data (HTTP ${remoteRes.status})`
      );
    }

    const invoicesToMark = salesToSend.map((u) => u.invoice_number);
    await wasmDb.markSalesSynced(invoicesToMark);

    return {
      success: true,
      synced_count: remoteData.synced_count ?? invoicesToMark.length,
      message:
        remoteData.message ||
        `Berhasil menyinkronkan ${invoicesToMark.length} transaksi ke server cloud.`,
      server_response: remoteData,
    };
  }

  /**
   * Test connection to PHP API endpoint
   */
  public async testPing(): Promise<{ success: boolean; message: string }> {
    if (await checkServerAvailability()) {
      try {
        const res = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_url: this.config.apiUrl,
            api_key: this.config.apiKey,
            device_id: this.config.deviceId,
            ping_only: true,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          return {
            success: true,
            message: data.message || 'Koneksi ke endpoint PHP berhasil terverifikasi!',
          };
        }
      } catch {
        // Fallback to direct fetch
      }
    }

    try {
      const pingRes = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          ping_only: true,
        }),
      });
      const contentType = pingRes.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await pingRes.json();
      } else {
        const text = await pingRes.text();
        data = { message: text.slice(0, 120) };
      }
      if (pingRes.ok) {
        return {
          success: true,
          message: data.message || 'Koneksi ke endpoint PHP berhasil terverifikasi!',
        };
      }
      return {
        success: false,
        message: data.message || `HTTP ${pingRes.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Gagal menghubungi endpoint server',
      };
    }
  }

  /**
   * Push ALL Database Tables (Full Replica) to sync_all_data-api.php
   */
  public async syncAllData(allTablesData: {
    categories?: any[];
    products?: any[];
    customers?: any[];
    vehicles?: any[];
    mechanics?: any[];
    sales?: any[];
  }): Promise<{
    success: boolean;
    report: any;
    message: string;
    server_response?: any;
  }> {
    const targetUrl =
      this.config.allDataApiUrl ||
      this.config.apiUrl.replace('sync_report-api.php', 'sync_all_data-api.php');

    const payload = {
      api_key: this.config.apiKey,
      device_id: this.config.deviceId,
      sync_time: new Date().toISOString(),
      ...allTablesData,
    };

    let remoteRes: Response;
    try {
      remoteRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr: any) {
      throw new Error(
        `Gagal menghubungi server Replika Database (${targetUrl}): ${netErr.message}`
      );
    }

    const contentType = remoteRes.headers.get('content-type') || '';
    let remoteData: any = {};
    if (contentType.includes('application/json')) {
      try {
        remoteData = await remoteRes.json();
      } catch (e) {
        throw new Error('Server mengembalikan respons non-JSON.');
      }
    } else {
      const text = await remoteRes.text();
      throw new Error(
        `Server mengembalikan pesan (HTTP ${remoteRes.status}): ${text.replace(/<[^>]*>?/gm, '').trim().slice(0, 150)}`
      );
    }

    if (!remoteRes.ok || remoteData.status === 'error') {
      throw new Error(
        remoteData.message || `Server menolak sinkronisasi database (HTTP ${remoteRes.status})`
      );
    }

    return {
      success: true,
      report: remoteData.report || {},
      message:
        remoteData.message ||
        `Berhasil menyinkronkan replika seluruh tabel database ke server.`,
      server_response: remoteData,
    };
  }
}

export const syncService = new SyncService();
