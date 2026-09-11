export interface Category {
  category_id: number;
  name: string;
}

export interface Product {
  product_id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category_name?: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  min_stock: number;
  compatibility: string;
  image_url?: string | null;
}

export interface Customer {
  customer_id: number;
  name: string;
  phone: string;
  created_at: string;
  vehicle_count?: number;
}

export interface Vehicle {
  vehicle_id: number;
  customer_id: number;
  plate_number: string;
  brand_model: string;
  last_km: number;
  last_service_date: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface Mechanic {
  mechanic_id: number;
  name: string;
  phone?: string;
}

export interface CartItem {
  product_id: number | null;
  sku?: string;
  item_name: string;
  quantity: number;
  buy_price: number;
  sell_price: number;
  is_service: number; // 0 = physical product, 1 = service
  stock?: number;
  compatibility?: string;
}

export interface Sale {
  sale_id: number;
  invoice_number: string;
  sale_date: string;
  vehicle_id: number | null;
  current_km: number | null;
  total_amount: number;
  total_hpp: number;
  payment_method: string;
  mechanic_id: number | null;
  plate_number?: string;
  brand_model?: string;
  customer_name?: string;
  customer_phone?: string;
  mechanic_name?: string;
  is_synced?: number;
  synced_at?: string | null;
}

export interface SaleDetail {
  detail_id: number;
  sale_id: number;
  product_id: number | null;
  item_name: string;
  quantity: number;
  buy_price: number;
  sell_price: number;
  subtotal: number;
  is_service: number;
}

export interface CRMReminder {
  vehicle_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  plate_number: string;
  brand_model: string;
  last_km: number;
  last_service_date: string;
  days_since_service: number;
  estimated_km_increase: number;
  estimated_current_km: number;
  is_overdue_days: boolean;
  is_overdue_km: boolean;
  is_due: boolean;
  status: 'OVERDUE' | 'DUE_SOON' | 'GOOD';
  wa_message: string;
  wa_url: string;
}

export interface ProfitLossReport {
  total_transactions: number;
  total_omzet: number;
  total_hpp: number;
  gross_profit: number;
  profit_margin_pct: number;
  goods: {
    omzet: number;
    hpp: number;
    profit: number;
    qty: number;
  };
  services: {
    omzet: number;
    hpp: number;
    profit: number;
    qty: number;
  };
}

export interface MovementItem {
  product_id: number | null;
  sku: string;
  item_name: string;
  category_name: string;
  current_stock: number;
  min_stock: number;
  is_service: number;
  total_sold_qty: number;
  total_revenue: number;
  total_profit: number;
  movement_class: 'FAST' | 'NORMAL' | 'SLOW' | 'SLOW_OR_ZERO';
}

export interface MovementReport {
  items: MovementItem[];
  fast_moving: MovementItem[];
  slow_moving: MovementItem[];
}

export interface DailyRecap {
  date_label: string;
  transaction_count: number;
  omzet: number;
  hpp: number;
  gross_profit: number;
}

export interface MonthlyRecap {
  month_label: string;
  transaction_count: number;
  omzet: number;
  hpp: number;
  gross_profit: number;
}

export interface RecapReport {
  daily: DailyRecap[];
  monthly: MonthlyRecap[];
  payment_methods: {
    payment_method: string;
    count: number;
    total_amount: number;
  }[];
}

export type UserRole = 'owner' | 'supervisor' | 'kasir' | 'teknisi';

export interface UserPermissions {
  can_add_product: boolean;
  can_edit_product: boolean;
  can_stock_opname: boolean;
  can_reprint_receipt: boolean;
  can_view_profit_report: boolean;
  can_manage_users: boolean;
  can_access_sync: boolean;
}

export interface AppUser {
  user_id: number;
  username: string;
  full_name: string;
  role: UserRole;
  pin: string;
  password?: string;
  is_blocked: number;
  is_active?: number;
  active_session_id?: string | null;
  last_activity?: string | null;
  permissions: UserPermissions;
  created_at: string;
  last_login_at?: string | null;
}

export type ActiveTab = 'pos' | 'crm' | 'reports' | 'master' | 'history' | 'settings';

export interface StoreReceiptSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  receipt_footer_1: string;
  receipt_footer_2: string;
  receipt_footer_3: string;
}
