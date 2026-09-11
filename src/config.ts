/**
 * Centralized API & Server Configuration
 * Semua URL API dan endpoint integrasi dikelola di sini agar mudah diganti jika ada perubahan domain / server.
 */

const getStoredConfig = (key: string, defaultValue: string): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const custom = localStorage.getItem(`motopos_config_${key}`);
    if (custom) return custom;
  }
  return defaultValue;
};

export const API_CONFIG = {
  // 1. Auth & Session Lock API (Larizk Cloud)
  get AUTH_LOCK_API_URL(): string {
    return getStoredConfig('auth_lock_api_url', 'https://larizk.com/api/auth_lock-api.php');
  },

  // 2. Data Synchronization API (Produk, Transaksi, Master Data)
  get SYNC_ALL_DATA_API_URL(): string {
    return getStoredConfig('sync_all_data_api_url', 'https://larizk.com/api/sync_all_data-api.php');
  },

  // 3. Cloud Report Sync API (Omzet, Laba Rugi, Laporan Owner)
  get SYNC_REPORT_API_URL(): string {
    return getStoredConfig('sync_report_api_url', 'https://larizk.com/api/sync_report-api.php');
  },

  // 4. Realtime MQTT Broker (WebSocket)
  get REALTIME_MQTT_BROKER(): string {
    return getStoredConfig('mqtt_broker_url', 'wss://broker.emqx.io:8084/mqtt');
  },
  get REALTIME_MQTT_TOPIC_PREFIX(): string {
    return getStoredConfig('mqtt_topic_prefix', 'bengkel_pos/main_store');
  },

  // 5. Session & Network Timeouts
  REQUEST_TIMEOUT_MS: 12000,
  SESSION_HEARTBEAT_INTERVAL_MS: 30000, // Kirim heartbeat per 30 detik
  SESSION_INACTIVE_TIMEOUT_SECONDS: 300, // Sesi dianggap expired jika tidak ada aktivitas > 5 menit
};

/**
 * Helper untuk menyimpan custom config URL
 */
export function setApiConfigOverride(key: keyof typeof API_CONFIG, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(`motopos_config_${key}`, value);
  }
}

/**
 * Helper untuk reset custom config ke default
 */
export function resetApiConfigToDefaults(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    Object.keys(API_CONFIG).forEach((key) => {
      localStorage.removeItem(`motopos_config_${key}`);
    });
  }
}
