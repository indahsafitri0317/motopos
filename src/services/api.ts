import {
  Category,
  Product,
  Customer,
  Vehicle,
  Mechanic,
  Sale,
  SaleDetail,
  CRMReminder,
  ProfitLossReport,
  MovementReport,
  RecapReport,
} from '../types/pos';
import { wasmDb } from './wasmDb';

let serverAvailable: boolean | null = null;
let lastCheckTime = 0;

export async function checkServerAvailability(): Promise<boolean> {
  const now = Date.now();
  if (serverAvailable !== null && now - lastCheckTime < 10000) {
    return serverAvailable;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeout);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      serverAvailable = !!(data && data.status === 'ok');
    } else {
      serverAvailable = false;
    }
  } catch {
    serverAvailable = false;
  }
  lastCheckTime = now;
  return serverAvailable;
}

// Helper to safely fetch JSON from server without throwing SyntaxError on HTML fallbacks (e.g. Vite preview)
async function safeGetJson<T>(url: string): Promise<T | null> {
  if (!(await checkServerAvailability())) return null;
  try {
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
    if (contentType.includes('text/html') || !res.ok) {
      serverAvailable = false;
    }
    return null;
  } catch {
    serverAvailable = false;
    return null;
  }
}

// Helper to safely mutate JSON
async function safeMutateJson<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: any
): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!(await checkServerAvailability())) {
    return { success: false };
  }
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      serverAvailable = false;
      return { success: false };
    }
    const json = await res.json();
    if (res.ok) {
      return { success: true, data: json };
    } else {
      return { success: false, error: json.error || 'Server error' };
    }
  } catch (e: any) {
    serverAvailable = false;
    return { success: false };
  }
}

export const api = {
  // Categories
  async getCategories(): Promise<Category[]> {
    const remote = await safeGetJson<Category[]>('/api/categories');
    if (remote) return remote;
    return wasmDb.getCategories();
  },

  async addCategory(name: string): Promise<Category> {
    const remote = await safeMutateJson<Category>('/api/categories', 'POST', { name });
    if (remote.success && remote.data) {
      try {
        await wasmDb.addCategory(name);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.addCategory(name);
  },

  async updateCategory(id: number, name: string): Promise<{ message: string }> {
    const remote = await safeMutateJson<{ message: string }>(`/api/categories/${id}`, 'PUT', { name });
    if (remote.success && remote.data) {
      try {
        await wasmDb.updateCategory(id, name);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.updateCategory(id, name);
  },

  async deleteCategory(id: number): Promise<{ message: string }> {
    const remote = await safeMutateJson<{ message: string }>(`/api/categories/${id}`, 'DELETE');
    if (remote.success && remote.data) {
      try {
        await wasmDb.deleteCategory(id);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.deleteCategory(id);
  },

  // Products
  async getProducts(params?: { search?: string; category_id?: number; low_stock?: boolean }): Promise<Product[]> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.category_id) q.append('category_id', String(params.category_id));
    if (params?.low_stock) q.append('low_stock', 'true');
    const queryStr = q.toString() ? `?${q.toString()}` : '';

    const remote = await safeGetJson<Product[]>(`/api/products${queryStr}`);
    if (remote) return remote;
    return wasmDb.getProducts(params);
  },

  async addProduct(productData: Partial<Product>): Promise<{ product_id: number; message: string }> {
    const remote = await safeMutateJson<{ product_id: number; message: string }>(
      '/api/products',
      'POST',
      productData
    );
    if (remote.success && remote.data) {
      try {
        await wasmDb.addProduct({ ...productData, product_id: remote.data.product_id });
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.addProduct(productData);
  },

  async updateProduct(id: number, productData: Partial<Product>): Promise<{ message: string }> {
    const remote = await safeMutateJson<{ message: string }>(`/api/products/${id}`, 'PUT', productData);
    if (remote.success && remote.data) {
      try {
        await wasmDb.updateProduct(id, productData);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.updateProduct(id, productData);
  },

  async deleteProduct(id: number): Promise<{ message: string }> {
    const remote = await safeMutateJson<{ message: string }>(`/api/products/${id}`, 'DELETE');
    if (remote.success && remote.data) {
      try {
        await wasmDb.deleteProduct(id);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.deleteProduct(id);
  },

  async adjustStock(id: number, adjustment?: number, new_stock?: number): Promise<any> {
    const remote = await safeMutateJson<any>(`/api/products/${id}/adjust-stock`, 'POST', {
      adjustment,
      new_stock,
    });
    if (remote.success && remote.data) {
      try {
        await wasmDb.adjustStock(id, adjustment, new_stock);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.adjustStock(id, adjustment, new_stock);
  },

  // Customers (Local browser SQLite only - tidak ditaruh di server)
  async getCustomers(): Promise<Customer[]> {
    return wasmDb.getCustomers();
  },

  async addCustomer(name: string, phone: string): Promise<Customer> {
    return wasmDb.addCustomer(name, phone);
  },

  async updateCustomer(id: number, name: string, phone: string): Promise<{ message: string }> {
    return wasmDb.updateCustomer(id, name, phone);
  },

  // Vehicles (Local browser SQLite only - tidak ditaruh di server)
  async getVehicles(search?: string): Promise<Vehicle[]> {
    return wasmDb.getVehicles(search);
  },

  async addVehicle(vehicleData: Partial<Vehicle>): Promise<{ vehicle_id: number; message: string }> {
    return wasmDb.addVehicle(vehicleData);
  },

  async updateVehicle(id: number, vehicleData: Partial<Vehicle>): Promise<{ message: string }> {
    return wasmDb.updateVehicle(id, vehicleData);
  },

  // Mechanics (Local browser SQLite only - tidak ditaruh di server)
  async getMechanics(): Promise<Mechanic[]> {
    return wasmDb.getMechanics();
  },

  async addMechanic(name: string, phone?: string): Promise<Mechanic> {
    return wasmDb.addMechanic(name, phone);
  },

  async updateMechanic(id: number, name: string, phone?: string): Promise<{ message: string }> {
    return wasmDb.updateMechanic(id, name, phone);
  },

  async deleteMechanic(id: number): Promise<{ message: string }> {
    return wasmDb.deleteMechanic(id);
  },

  // POS Checkout (Atomic Transaction)
  async checkout(payload: {
    vehicle_id?: number | null;
    current_km?: number | null;
    payment_method: string;
    mechanic_id?: number | null;
    items: {
      product_id: number | null;
      item_name: string;
      quantity: number;
      buy_price: number;
      sell_price: number;
      is_service: number;
    }[];
  }): Promise<{ success: boolean; message: string; sale: Sale; details: SaleDetail[] }> {
    const remote = await safeMutateJson<{ success: boolean; message: string; sale: Sale; details: SaleDetail[] }>(
      '/api/checkout',
      'POST',
      payload
    );
    if (remote.success && remote.data) {
      try {
        await wasmDb.checkout(payload);
      } catch {}
      return remote.data;
    }
    if (remote.error) throw new Error(remote.error);
    return wasmDb.checkout(payload);
  },

  // Sales History
  async getSales(limit = 50, search?: string, startDate?: string, endDate?: string): Promise<Sale[]> {
    const q = new URLSearchParams();
    q.append('limit', String(limit));
    if (search) q.append('search', search);
    if (startDate) q.append('start_date', startDate);
    if (endDate) q.append('end_date', endDate);
    const remote = await safeGetJson<Sale[]>(`/api/sales?${q.toString()}`);
    if (remote) return remote;
    return wasmDb.getSales(limit, search, startDate, endDate);
  },

  async getSaleDetail(id: number): Promise<{ sale: Sale; details: SaleDetail[] }> {
    const remote = await safeGetJson<{ sale: Sale; details: SaleDetail[] }>(`/api/sales/${id}`);
    if (remote) return remote;
    return wasmDb.getSaleDetail(id);
  },

  // CRM Reminders
  async getCrmReminders(): Promise<CRMReminder[]> {
    const remote = await safeGetJson<CRMReminder[]>('/api/crm/reminders');
    if (remote) return remote;
    return wasmDb.getCrmReminders();
  },

  // Business Reports
  async getProfitLoss(start_date?: string, end_date?: string): Promise<ProfitLossReport> {
    const q = new URLSearchParams();
    if (start_date) q.append('start_date', start_date);
    if (end_date) q.append('end_date', end_date);
    const remote = await safeGetJson<ProfitLossReport>(`/api/reports/profit-loss?${q.toString()}`);
    if (remote) return remote;
    return wasmDb.getProfitLoss(start_date, end_date);
  },

  async getMovement(start_date?: string, end_date?: string): Promise<MovementReport> {
    const q = new URLSearchParams();
    if (start_date) q.append('start_date', start_date);
    if (end_date) q.append('end_date', end_date);
    const remote = await safeGetJson<MovementReport>(`/api/reports/movement?${q.toString()}`);
    if (remote) return remote;
    return wasmDb.getMovement(start_date, end_date);
  },

  async getRecap(): Promise<RecapReport> {
    const remote = await safeGetJson<RecapReport>('/api/reports/recap');
    if (remote) return remote;
    return wasmDb.getRecap();
  },
};
