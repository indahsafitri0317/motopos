import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

export interface AppDatabase {
  all<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  get<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;
  run(sql: string, ...params: any[]): Promise<{ changes: number; lastID: number }>;
  exec(sql: string): Promise<void>;
}

let appDbInstance: AppDatabase | null = null;

function flattenParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export async function getDb(): Promise<AppDatabase> {
  if (appDbInstance) return appDbInstance;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'motopos.sqlite');
  const syncDb = new DatabaseSync(dbPath);

  // Enable foreign keys
  syncDb.exec('PRAGMA foreign_keys = ON;');

  // Create tables as required
  syncDb.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(category_id),
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      compatibility TEXT,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(customer_id),
      plate_number TEXT UNIQUE NOT NULL,
      brand_model TEXT NOT NULL,
      last_km INTEGER NOT NULL DEFAULT 0,
      last_service_date TEXT
    );

    CREATE TABLE IF NOT EXISTS mechanics (
      mechanic_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      sale_date TEXT NOT NULL,
      vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
      current_km INTEGER,
      total_amount REAL NOT NULL,
      total_hpp REAL NOT NULL,
      payment_method TEXT NOT NULL,
      mechanic_id INTEGER REFERENCES mechanics(mechanic_id),
      is_synced INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_details (
      detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(sale_id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(product_id),
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      is_service INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pin TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'kasir',
      permissions TEXT,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      active_session_id TEXT,
      last_activity TEXT,
      last_login_at TEXT,
      last_ip TEXT,
      last_device TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      store_name TEXT NOT NULL DEFAULT 'BENGKEL & TOKO OLI MOTOR',
      store_address TEXT NOT NULL DEFAULT 'Jl. Raya Otomotif No. 88, Sentra Onderdil',
      store_phone TEXT NOT NULL DEFAULT '0812-3456-7890',
      receipt_footer_1 TEXT NOT NULL DEFAULT '*** TERIMA KASIH ***',
      receipt_footer_2 TEXT NOT NULL DEFAULT 'Perawatan rutin menjaga performa & keselamatan motor Anda.',
      receipt_footer_3 TEXT NOT NULL DEFAULT 'Servis berikutnya: 2.000 KM / 60 Hari.',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default store settings if not exists
  try {
    syncDb.exec(`
      INSERT OR IGNORE INTO store_settings (id, store_name, store_address, store_phone, receipt_footer_1, receipt_footer_2, receipt_footer_3)
      VALUES (1, 'BENGKEL & TOKO OLI MOTOR', 'Jl. Raya Otomotif No. 88, Jombang', '0812-3456-7890', '*** TERIMA KASIH ***', 'Perawatan rutin menjaga performa & keselamatan motor Anda.', 'Servis berikutnya: 2.000 KM / 60 Hari.');
    `);
  } catch {}

  // Also support motopos.sqlite
  try {
    const altDbPath = path.join(dataDir, 'motopos.sqlite');
    if (!fs.existsSync(altDbPath)) {
      fs.copyFileSync(dbPath, altDbPath);
    }
  } catch {}

  // Safe migration for existing tables
  try {
    syncDb.exec('ALTER TABLE sales ADD COLUMN is_synced INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    syncDb.exec('ALTER TABLE sales ADD COLUMN synced_at TEXT;');
  } catch {}
  try {
    syncDb.exec('ALTER TABLE products ADD COLUMN image_url TEXT;');
  } catch {}
  try {
    syncDb.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    syncDb.exec('ALTER TABLE users ADD COLUMN active_session_id TEXT;');
  } catch {}
  try {
    syncDb.exec('ALTER TABLE users ADD COLUMN last_activity TEXT;');
  } catch {}

  const wrappedDb: AppDatabase = {
    async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
      const p = flattenParams(params);
      const stmt = syncDb.prepare(sql);
      return stmt.all(...p) as T[];
    },
    async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
      const p = flattenParams(params);
      const stmt = syncDb.prepare(sql);
      return stmt.get(...p) as T | undefined;
    },
    async run(sql: string, ...params: any[]): Promise<{ changes: number; lastID: number }> {
      const p = flattenParams(params);
      const stmt = syncDb.prepare(sql);
      const res = stmt.run(...p);
      return {
        changes: Number(res.changes),
        lastID: Number(res.lastInsertRowid),
      };
    },
    async exec(sql: string): Promise<void> {
      syncDb.exec(sql);
    },
  };

  // Seed default data if database is empty
  await seedInitialData(wrappedDb);
  await seedInitialUsers(wrappedDb);

  appDbInstance = wrappedDb;
  return appDbInstance;
}

async function seedInitialUsers(db: AppDatabase) {
  try {
    const userCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (!userCount || userCount.count === 0) {
      console.log('[SQLite] Seeding initial users into SQLite...');
      const defaultUsers = [
        {
          username: 'owner',
          full_name: 'Bpk. Hendra (Owner)',
          role: 'owner',
          pin: '1234',
          password: 'admin',
          permissions: JSON.stringify({
            can_add_product: true,
            can_edit_product: true,
            can_stock_opname: true,
            can_reprint_receipt: true,
            can_view_profit_report: true,
            can_manage_users: true,
            can_access_sync: true,
          }),
        },
        {
          username: 'supervisor',
          full_name: 'Doni (Supervisor Toko)',
          role: 'supervisor',
          pin: '2345',
          password: 'spv',
          permissions: JSON.stringify({
            can_add_product: true,
            can_edit_product: true,
            can_stock_opname: true,
            can_reprint_receipt: true,
            can_view_profit_report: true,
            can_manage_users: false,
            can_access_sync: true,
          }),
        },
        {
          username: 'kasir',
          full_name: 'Siti Rahma (Kasir Shift 1)',
          role: 'kasir',
          pin: '1111',
          password: 'kasir',
          permissions: JSON.stringify({
            can_add_product: false,
            can_edit_product: false,
            can_stock_opname: false,
            can_reprint_receipt: true,
            can_view_profit_report: false,
            can_manage_users: false,
            can_access_sync: false,
          }),
        },
        {
          username: 'teknisi',
          full_name: 'Agus (Mekanik Senior)',
          role: 'teknisi',
          pin: '9999',
          password: 'mekanik',
          permissions: JSON.stringify({
            can_add_product: false,
            can_edit_product: false,
            can_stock_opname: false,
            can_reprint_receipt: false,
            can_view_profit_report: false,
            can_manage_users: false,
            can_access_sync: false,
          }),
        },
      ];

      for (const u of defaultUsers) {
        await db.run(
          `INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`,
          [u.username, u.full_name, u.role, u.pin, u.password, u.permissions]
        );
      }
      console.log('[SQLite] Initial users seeded successfully into users table.');
    }
  } catch (err: any) {
    console.error('[SQLite] Error seeding initial users:', err?.message);
  }
}

async function seedInitialData(db: AppDatabase) {
  const catCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (catCount && catCount.count > 0) {
    return;
  }

  console.log('[SQLite] Seeding initial sample data for Bengkel Toko Oli & Sparepart...');

  // 1. Categories
  const categories = [
    'Oli Mesin',
    'Oli Gardan & Transmisi',
    'Kampas & Rem',
    'Busi & Kelistrikan',
    'CVT & Drivetrain',
    'Ban & Velg',
    'Filter & Cairan',
    'Jasa Servis',
  ];

  for (const cat of categories) {
    await db.run('INSERT INTO categories (name) VALUES (?)', [cat]);
  }

  // 2. Products & Services
  const products = [
    // Oli Mesin
    { sku: 'OLI-001', name: 'Astra Honda Motor MPX-2 Matic 0.8L 10W-30', cat: 'Oli Mesin', buy: 44000, sell: 55000, stock: 32, min: 10, comp: 'Honda BeAT, Vario, Scoopy, Genio' },
    { sku: 'OLI-002', name: 'Yamalube Matic Motor Oil 0.8L 20W-40', cat: 'Oli Mesin', buy: 42000, sell: 52000, stock: 24, min: 8, comp: 'Mio Series, Fazzio, Gear 125' },
    { sku: 'OLI-003', name: 'Shell Advance AX7 Matic 10W-40 0.8L', cat: 'Oli Mesin', buy: 53000, sell: 66000, stock: 18, min: 6, comp: 'Universal Matic (Honda, Yamaha, Suzuki)' },
    { sku: 'OLI-004', name: 'Motul Scooter Expert LE 10W-30 0.8L', cat: 'Oli Mesin', buy: 68000, sell: 85000, stock: 12, min: 5, comp: 'Vario 150/160, PCX 160, ADV 160' },
    { sku: 'OLI-005', name: 'Yamalube Super Matic 1.0L 10W-40', cat: 'Oli Mesin', buy: 62000, sell: 76000, stock: 15, min: 5, comp: 'NMAX 155, Aerox 155, Lexi' },
    { sku: 'OLI-006', name: 'Federal Oil Ultratec 20W-50 0.8L Bebek', cat: 'Oli Mesin', buy: 34000, sell: 43000, stock: 20, min: 5, comp: 'Supra X, Revo, Jupiter Z, Smash' },

    // Oli Gardan
    { sku: 'GRD-001', name: 'AHM Scooter Gear Oil 120ml', cat: 'Oli Gardan & Transmisi', buy: 13000, sell: 18000, stock: 40, min: 10, comp: 'Semua Motor Matic Honda' },
    { sku: 'GRD-002', name: 'Yamalube Gear Motor Oil 100ml', cat: 'Oli Gardan & Transmisi', buy: 12000, sell: 17000, stock: 35, min: 10, comp: 'Semua Motor Matic Yamaha' },
    { sku: 'GRD-003', name: 'Motul Scooter Gear 80W-90 120ml', cat: 'Oli Gardan & Transmisi', buy: 23000, sell: 32000, stock: 14, min: 4, comp: 'Universal Matic Performance' },

    // Kampas & Rem
    { sku: 'REM-001', name: 'Kampas Rem Depan Cakram Honda Matic/Bebek (KTM)', cat: 'Kampas & Rem', buy: 26000, sell: 38000, stock: 22, min: 6, comp: 'BeAT, Vario 110/125/150, Scoopy' },
    { sku: 'REM-002', name: 'Kampas Rem Belakang Tromol Honda Matic (KZL)', cat: 'Kampas & Rem', buy: 38000, sell: 52000, stock: 16, min: 5, comp: 'BeAT FI, Scoopy FI, Vario 125' },
    { sku: 'REM-003', name: 'Kampas Rem Depan Yamaha NMAX/Aerox Ori', cat: 'Kampas & Rem', buy: 54000, sell: 72000, stock: 9, min: 4, comp: 'NMAX 155, Aerox 155' },
    { sku: 'REM-004', name: 'Minyak Rem Dot 4 Jumbo 50ml', cat: 'Kampas & Rem', buy: 9000, sell: 15000, stock: 25, min: 5, comp: 'Semua Rem Cakram' },

    // Busi & Kelistrikan
    { sku: 'BSI-001', name: 'Busi NGK CPR9EA-9 Nickel', cat: 'Busi & Kelistrikan', buy: 18000, sell: 26000, stock: 30, min: 8, comp: 'BeAT ESP, Vario 125/150, NMAX, Aerox' },
    { sku: 'BSI-002', name: 'Busi Denso U24EPR9', cat: 'Busi & Kelistrikan', buy: 17000, sell: 25000, stock: 18, min: 5, comp: 'Scoopy, Sonic 150R, CB150R' },
    { sku: 'BSI-003', name: 'Aki Motor GS Astra GTZ-5S Kering MF', cat: 'Busi & Kelistrikan', buy: 195000, sell: 245000, stock: 6, min: 3, comp: 'BeAT, Vario 110, Mio M3, Soul GT' },

    // CVT & Drivetrain
    { sku: 'CVT-001', name: 'Vanbelt V-Belt Kit + Roller Honda BeAT FI K25', cat: 'CVT & Drivetrain', buy: 110000, sell: 145000, stock: 8, min: 3, comp: 'BeAT FI Starter Kasar 2012-2014' },
    { sku: 'CVT-002', name: 'Vanbelt V-Belt Kit + Roller Vario 125 LED K35', cat: 'CVT & Drivetrain', buy: 135000, sell: 175000, stock: 7, min: 3, comp: 'Vario 125 LED 2015-2023' },
    { sku: 'CVT-003', name: 'Gemuk CVT Honda Grease 10gr Double Pack', cat: 'CVT & Drivetrain', buy: 8000, sell: 14000, stock: 45, min: 10, comp: 'Universal Pulley CVT' },

    // Filter & Cairan
    { sku: 'FLT-001', name: 'Filter Udara AHM BeAT / Scoopy ESP K44', cat: 'Filter & Cairan', buy: 38000, sell: 50000, stock: 15, min: 5, comp: 'BeAT ESP, Scoopy ESP 2015-2019' },
    { sku: 'FLT-002', name: 'Air Radiator Coolant AHM 500ml', cat: 'Filter & Cairan', buy: 16000, sell: 24000, stock: 20, min: 5, comp: 'Vario, PCX, NMAX, Aerox' },

    // Jasa Servis (Stok 999, buy_price 0 atau biaya operasional)
    { sku: 'SRV-001', name: 'Jasa Ganti Oli Mesin & Transmisi', cat: 'Jasa Servis', buy: 0, sell: 10000, stock: 999, min: 0, comp: 'Semua Motor' },
    { sku: 'SRV-002', name: 'Jasa Servis Ringan / Tune-Up Injeksi', cat: 'Jasa Servis', buy: 5000, sell: 45000, stock: 999, min: 0, comp: 'Motor Bebek & Matic' },
    { sku: 'SRV-003', name: 'Jasa Servis CVT Lengkap & Pembersihan', cat: 'Jasa Servis', buy: 5000, sell: 55000, stock: 999, min: 0, comp: 'Semua Motor Matic' },
    { sku: 'SRV-004', name: 'Jasa Pasang Kampas Rem Depan / Belakang', cat: 'Jasa Servis', buy: 0, sell: 15000, stock: 999, min: 0, comp: 'Semua Motor' },
    { sku: 'SRV-005', name: 'Jasa Kuras Radiator & Refill Coolant', cat: 'Jasa Servis', buy: 0, sell: 20000, stock: 999, min: 0, comp: 'Motor Berpendingin Cairan' },
    { sku: 'SRV-006', name: 'Jasa Servis Besar / Skir Klep / Turun Mesin', cat: 'Jasa Servis', buy: 20000, sell: 250000, stock: 999, min: 0, comp: 'Semua Motor' },
  ];

  for (const p of products) {
    const catRow = await db.get<{ category_id: number }>('SELECT category_id FROM categories WHERE name = ?', [p.cat]);
    const catId = catRow ? catRow.category_id : null;
    await db.run(
      `INSERT INTO products (sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.sku, p.name, catId, p.buy, p.sell, p.stock, p.min, p.comp]
    );
  }

  // 3. Mechanics
  const mechanics = [
    { name: 'Joko Susilo (Kepala Mekanik)', phone: '081234567801' },
    { name: 'Wahyu Ramadhan', phone: '081234567802' },
    { name: 'Deni Kurniawan', phone: '081234567803' },
  ];
  for (const m of mechanics) {
    await db.run('INSERT INTO mechanics (name, phone) VALUES (?, ?)', [m.name, m.phone]);
  }

  // 4. Customers & Vehicles (Simulate various service dates and km for CRM demo)
  const customersData = [
    {
      name: 'Hendra Gunawan',
      phone: '081289123456',
      created_at: '2026-06-10',
      vehicle: {
        plate: 'B 3829 TKR',
        brand_model: 'Honda Vario 125 CBS 2021',
        last_km: 18450,
        // Serviced 75 days ago -> overdue >= 60 days
        last_service_date: '2026-06-25',
      },
    },
    {
      name: 'Siti Rahmawati',
      phone: '085712349988',
      created_at: '2026-05-15',
      vehicle: {
        plate: 'B 6124 KLU',
        brand_model: 'Honda BeAT Street 2022',
        last_km: 12200,
        // Serviced 68 days ago -> overdue >= 60 days
        last_service_date: '2026-07-02',
      },
    },
    {
      name: 'Dimas Aditya',
      phone: '082199887766',
      created_at: '2026-07-20',
      vehicle: {
        plate: 'D 4091 ZBA',
        brand_model: 'Yamaha NMAX 155 Connected 2023',
        last_km: 24500,
        // Serviced 25 days ago, but high km accumulation -> estimated km over 2,000 km
        last_service_date: '2026-08-15',
      },
    },
    {
      name: 'Bambang Irawan',
      phone: '081377889900',
      created_at: '2026-08-01',
      vehicle: {
        plate: 'B 5543 SJD',
        brand_model: 'Honda PCX 160 ABS 2022',
        last_km: 8500,
        // Serviced recently (10 days ago) -> not overdue
        last_service_date: '2026-08-30',
      },
    },
    {
      name: 'Rian Pratama',
      phone: '087811223344',
      created_at: '2026-04-10',
      vehicle: {
        plate: 'B 4182 UFX',
        brand_model: 'Yamaha Aerox 155 VVA 2020',
        last_km: 32000,
        // Serviced 90 days ago -> overdue
        last_service_date: '2026-06-10',
      },
    },
  ];

  for (const c of customersData) {
    const custRes = await db.run(
      'INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)',
      [c.name, c.phone, c.created_at]
    );
    const customerId = custRes.lastID;

    await db.run(
      `INSERT INTO vehicles (customer_id, plate_number, brand_model, last_km, last_service_date)
       VALUES (?, ?, ?, ?, ?)`,
      [customerId, c.vehicle.plate, c.vehicle.brand_model, c.vehicle.last_km, c.vehicle.last_service_date]
    );
  }

  // 5. Seed some past sales so reports (Laba Rugi, Fast/Slow moving, Omzet) have rich data
  const sampleSales = [
    {
      inv: 'INV-20260901-001',
      date: '2026-09-01 09:30:00',
      plate: 'B 5543 SJD',
      km: 8400,
      total_amount: 117000,
      total_hpp: 84000,
      payment: 'CASH',
      mechanic_id: 1,
      items: [
        { name: 'Motul Scooter Expert LE 10W-30 0.8L', qty: 1, buy: 68000, sell: 85000, is_service: 0 },
        { name: 'AHM Scooter Gear Oil 120ml', qty: 1, buy: 13000, sell: 18000, is_service: 0 },
        { name: 'Jasa Ganti Oli Mesin & Transmisi', qty: 1, buy: 0, sell: 10000, is_service: 1 },
        { name: 'Air Radiator Coolant AHM 500ml', qty: 1, buy: 16000, sell: 24000, is_service: 0 }
      ],
    },
    {
      inv: 'INV-20260903-002',
      date: '2026-09-03 14:15:00',
      plate: 'B 3829 TKR',
      km: 18100,
      total_amount: 258000,
      total_hpp: 187000,
      payment: 'QRIS',
      mechanic_id: 2,
      items: [
        { name: 'Astra Honda Motor MPX-2 Matic 0.8L 10W-30', qty: 1, buy: 44000, sell: 55000, is_service: 0 },
        { name: 'Vanbelt V-Belt Kit + Roller Vario 125 LED K35', qty: 1, buy: 135000, sell: 175000, is_service: 0 },
        { name: 'Gemuk CVT Honda Grease 10gr Double Pack', qty: 1, buy: 8000, sell: 14000, is_service: 0 },
        { name: 'Jasa Servis CVT Lengkap & Pembersihan', qty: 1, buy: 5000, sell: 55000, is_service: 1 }
      ],
    },
    {
      inv: 'INV-20260905-003',
      date: '2026-09-05 11:20:00',
      plate: 'D 4091 ZBA',
      km: 24200,
      total_amount: 174000,
      total_hpp: 116000,
      payment: 'TRANSFER',
      mechanic_id: 3,
      items: [
        { name: 'Yamalube Super Matic 1.0L 10W-40', qty: 1, buy: 62000, sell: 76000, is_service: 0 },
        { name: 'Kampas Rem Depan Yamaha NMAX/Aerox Ori', qty: 1, buy: 54000, sell: 72000, is_service: 0 },
        { name: 'Jasa Pasang Kampas Rem Depan / Belakang', qty: 1, buy: 0, sell: 15000, is_service: 1 },
        { name: 'Jasa Ganti Oli Mesin & Transmisi', qty: 1, buy: 0, sell: 11000, is_service: 1 }
      ],
    },
    {
      inv: 'INV-20260907-004',
      date: '2026-09-07 16:45:00',
      plate: 'B 6124 KLU',
      km: 12150,
      total_amount: 141000,
      total_hpp: 93000,
      payment: 'CASH',
      mechanic_id: 1,
      items: [
        { name: 'Astra Honda Motor MPX-2 Matic 0.8L 10W-30', qty: 1, buy: 44000, sell: 55000, is_service: 0 },
        { name: 'AHM Scooter Gear Oil 120ml', qty: 1, buy: 13000, sell: 18000, is_service: 0 },
        { name: 'Busi NGK CPR9EA-9 Nickel', qty: 1, buy: 18000, sell: 26000, is_service: 0 },
        { name: 'Jasa Servis Ringan / Tune-Up Injeksi', qty: 1, buy: 5000, sell: 45000, is_service: 1 }
      ],
    },
    {
      inv: 'INV-20260908-005',
      date: '2026-09-08 10:10:00',
      plate: 'B 5543 SJD',
      km: 8480,
      total_amount: 65000,
      total_hpp: 44000,
      payment: 'QRIS',
      mechanic_id: 2,
      items: [
        { name: 'Astra Honda Motor MPX-2 Matic 0.8L 10W-30', qty: 1, buy: 44000, sell: 55000, is_service: 0 },
        { name: 'Jasa Ganti Oli Mesin & Transmisi', qty: 1, buy: 0, sell: 10000, is_service: 1 }
      ],
    }
  ];

  for (const s of sampleSales) {
    const veh = await db.get<{ vehicle_id: number }>('SELECT vehicle_id FROM vehicles WHERE plate_number = ?', [s.plate]);
    const vehId = veh ? veh.vehicle_id : null;

    const saleRes = await db.run(
      `INSERT INTO sales (invoice_number, sale_date, vehicle_id, current_km, total_amount, total_hpp, payment_method, mechanic_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.inv, s.date, vehId, s.km, s.total_amount, s.total_hpp, s.payment, s.mechanic_id]
    );
    const saleId = saleRes.lastID;

    for (const it of s.items) {
      const prod = await db.get<{ product_id: number }>('SELECT product_id FROM products WHERE name = ?', [it.name]);
      const prodId = prod ? prod.product_id : null;
      const subtotal = it.qty * it.sell;

      await db.run(
        `INSERT INTO sale_details (sale_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, prodId, it.name, it.qty, it.buy, it.sell, subtotal, it.is_service]
      );
    }
  }

  console.log('[SQLite] Seed finished successfully.');
}
