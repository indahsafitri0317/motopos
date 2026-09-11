import { StoreReceiptSettings } from '../types/pos';

export const DEFAULT_STORE_SETTINGS: StoreReceiptSettings = {
  store_name: 'BENGKEL & TOKO OLI MOTOR',
  store_address: 'Jl. Raya Otomotif No. 88, Sentra Onderdil',
  store_phone: '0812-3456-7890',
  receipt_footer_1: '*** TERIMA KASIH ***',
  receipt_footer_2: 'Perawatan rutin menjaga performa & keselamatan motor Anda.',
  receipt_footer_3: 'Servis berikutnya: 2.000 KM / 60 Hari.',
};

const STORAGE_KEY = 'motopos_store_receipt_settings';
const EVENT_NAME = 'motopos_store_settings_changed';

class StoreSettingsService {
  private currentSettings: StoreReceiptSettings;
  private listeners: Array<(settings: StoreReceiptSettings) => void> = [];

  constructor() {
    this.currentSettings = this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.currentSettings = JSON.parse(e.newValue);
            this.notifyListeners();
          } catch {}
        }
      });
    }
  }

  private loadFromStorage(): StoreReceiptSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_STORE_SETTINGS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          store_name: parsed.store_name || DEFAULT_STORE_SETTINGS.store_name,
          store_address: parsed.store_address ?? DEFAULT_STORE_SETTINGS.store_address,
          store_phone: parsed.store_phone ?? DEFAULT_STORE_SETTINGS.store_phone,
          receipt_footer_1: parsed.receipt_footer_1 ?? DEFAULT_STORE_SETTINGS.receipt_footer_1,
          receipt_footer_2: parsed.receipt_footer_2 ?? DEFAULT_STORE_SETTINGS.receipt_footer_2,
          receipt_footer_3: parsed.receipt_footer_3 ?? DEFAULT_STORE_SETTINGS.receipt_footer_3,
        };
      }
    } catch {}
    return { ...DEFAULT_STORE_SETTINGS };
  }

  public getSettings(): StoreReceiptSettings {
    return { ...this.currentSettings };
  }

  public async fetchSettings(): Promise<StoreReceiptSettings> {
    try {
      const res = await fetch('/api/settings/store');
      if (res.ok) {
        const data = await res.json();
        if (data && data.store_name) {
          this.currentSettings = {
            store_name: data.store_name || DEFAULT_STORE_SETTINGS.store_name,
            store_address: data.store_address ?? DEFAULT_STORE_SETTINGS.store_address,
            store_phone: data.store_phone ?? DEFAULT_STORE_SETTINGS.store_phone,
            receipt_footer_1: data.receipt_footer_1 ?? DEFAULT_STORE_SETTINGS.receipt_footer_1,
            receipt_footer_2: data.receipt_footer_2 ?? DEFAULT_STORE_SETTINGS.receipt_footer_2,
            receipt_footer_3: data.receipt_footer_3 ?? DEFAULT_STORE_SETTINGS.receipt_footer_3,
          };
          this.saveToStorage(this.currentSettings);
          this.notifyListeners();
          return { ...this.currentSettings };
        }
      }
    } catch (err) {
      console.warn('[StoreSettings] Failed to fetch settings from server, using local:', err);
    }
    return { ...this.currentSettings };
  }

  public async saveSettings(newSettings: StoreReceiptSettings): Promise<{ success: boolean; message: string }> {
    const cleaned: StoreReceiptSettings = {
      store_name: newSettings.store_name.trim() || DEFAULT_STORE_SETTINGS.store_name,
      store_address: newSettings.store_address.trim(),
      store_phone: newSettings.store_phone.trim(),
      receipt_footer_1: newSettings.receipt_footer_1.trim(),
      receipt_footer_2: newSettings.receipt_footer_2.trim(),
      receipt_footer_3: newSettings.receipt_footer_3.trim(),
    };

    this.currentSettings = cleaned;
    this.saveToStorage(cleaned);
    this.notifyListeners();

    // Also send to SQLite server
    try {
      const res = await fetch('/api/settings/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, message: json.message || 'Pengaturan nota toko berhasil disimpan.' };
      }
    } catch (err: any) {
      console.warn('[StoreSettings] Error saving to server (saved to local device):', err);
    }

    return { success: true, message: 'Pengaturan nota toko berhasil disimpan di perangkat ini.' };
  }

  public async resetToDefault(): Promise<StoreReceiptSettings> {
    await this.saveSettings(DEFAULT_STORE_SETTINGS);
    return { ...DEFAULT_STORE_SETTINGS };
  }

  private saveToStorage(settings: StoreReceiptSettings): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: settings }));
      } catch {}
    }
  }

  public subscribe(callback: (settings: StoreReceiptSettings) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    const copy = { ...this.currentSettings };
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch {}
    }
  }
}

export const storeSettingsService = new StoreSettingsService();
