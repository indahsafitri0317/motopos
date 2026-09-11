import initSqlJs, { Database } from 'sql.js';
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
  MovementItem,
} from '../types/pos';

const DB_STORAGE_NAME = 'motopos_sqlite_db';
const DB_STORE_TABLE = 'db_file';
const DB_KEY = 'sqlite_binary';

// IndexedDB Helper for SQLite Persistence in Browser
function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_STORAGE_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE_TABLE)) {
        db.createObjectStore(DB_STORE_TABLE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadDbFromIndexedDb(): Promise<Uint8Array | null> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_TABLE, 'readonly');
      const store = tx.objectStore(DB_STORE_TABLE);
      const req = store.get(DB_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
        } else if (val instanceof Uint8Array) {
          resolve(val);
        } else if (val instanceof ArrayBuffer) {
          resolve(new Uint8Array(val));
        } else {
          try {
            resolve(new Uint8Array(val));
          } catch {
            resolve(null);
          }
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[WASM SQLite] Could not read from IndexedDB, using new DB in memory:', err);
    return null;
  }
}

async function saveDbToIndexedDb(data: Uint8Array): Promise<void> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_TABLE, 'readwrite');
      const store = tx.objectStore(DB_STORE_TABLE);
      // Store clean Uint8Array copy
      const copy = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      const req = store.put(copy, DB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[WASM SQLite] Failed to persist SQLite to IndexedDB:', err);
  }
}

let wasmDbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function getWasmDb(): Promise<Database> {
  if (wasmDbInstance) return wasmDbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[WASM SQLite] Initializing SQLite WebAssembly Engine in browser...');
    const SQL = await initSqlJs({
      locateFile: (file) => {
        if (file.endsWith('.wasm')) {
          return '/sql-wasm.wasm';
        }
        return file;
      },
    });

    const savedBinary = await loadDbFromIndexedDb();
    let db: Database;
    let isNew = false;

    if (savedBinary && savedBinary.length > 0) {
      try {
        db = new SQL.Database(savedBinary);
        console.log('[WASM SQLite] Restored existing SQLite database from IndexedDB.');
      } catch (err) {
        console.warn('[WASM SQLite] Failed to parse saved DB, creating fresh DB:', err);
        db = new SQL.Database();
        isNew = true;
      }
    } else {
      db = new SQL.Database();
      isNew = true;
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON;');

    // Schema migration / creation
    db.run(`
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
    `);

    // Check if empty
    const checkCat = db.exec('SELECT COUNT(*) as count FROM categories');
    const count = checkCat[0]?.values[0]?.[0] as number;

    if (isNew || !count || count === 0) {
      console.log('[WASM SQLite] Seeding default sample data for Offline / Preview mode...');
      seedWasmDatabase(db);
      await saveDbToIndexedDb(db.export());
    }

    wasmDbInstance = db;
    return db;
  })();

  return initPromise;
}

async function persistCurrentDb() {
  if (wasmDbInstance) {
    const data = wasmDbInstance.export();
    await saveDbToIndexedDb(data);
  }
}

function resultToObjects<T = any>(res: initSqlJs.QueryExecResult[]): T[] {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as T;
  });
}

function seedWasmDatabase(db: Database) {
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
  for (const c of categories) {
    db.run('INSERT INTO categories (name) VALUES (?)', [c]);
  }

  // 2. Products
  const products = [
    { sku: 'OLI-001', name: 'Astra Honda Motor MPX-2 Matic 0.8L 10W-30', cat: 'Oli Mesin', buy: 44000, sell: 55000, stock: 32, min: 10, comp: 'Honda BeAT, Vario, Scoopy, Genio' },
    { sku: 'OLI-002', name: 'Yamalube Matic Motor Oil 0.8L 20W-40', cat: 'Oli Mesin', buy: 42000, sell: 52000, stock: 24, min: 8, comp: 'Mio Series, Fazzio, Gear 125' },
    { sku: 'OLI-003', name: 'Shell Advance AX7 Matic 10W-40 0.8L', cat: 'Oli Mesin', buy: 53000, sell: 66000, stock: 18, min: 6, comp: 'Universal Matic (Honda, Yamaha, Suzuki)' },
    { sku: 'OLI-004', name: 'Motul Scooter Expert LE 10W-30 0.8L', cat: 'Oli Mesin', buy: 68000, sell: 85000, stock: 12, min: 5, comp: 'Vario 150/160, PCX 160, ADV 160' },
    { sku: 'OLI-005', name: 'Yamalube Super Matic 1.0L 10W-40', cat: 'Oli Mesin', buy: 62000, sell: 76000, stock: 15, min: 5, comp: 'NMAX 155, Aerox 155, Lexi' },
    { sku: 'OLI-006', name: 'Federal Oil Ultratec 20W-50 0.8L Bebek', cat: 'Oli Mesin', buy: 34000, sell: 43000, stock: 20, min: 5, comp: 'Supra X, Revo, Jupiter Z, Smash' },
    { sku: 'GRD-001', name: 'AHM Scooter Gear Oil 120ml', cat: 'Oli Gardan & Transmisi', buy: 13000, sell: 18000, stock: 40, min: 10, comp: 'Semua Motor Matic Honda' },
    { sku: 'GRD-002', name: 'Yamalube Gear Motor Oil 100ml', cat: 'Oli Gardan & Transmisi', buy: 12000, sell: 17000, stock: 35, min: 10, comp: 'Semua Motor Matic Yamaha' },
    { sku: 'GRD-003', name: 'Motul Scooter Gear 80W-90 120ml', cat: 'Oli Gardan & Transmisi', buy: 23000, sell: 32000, stock: 14, min: 4, comp: 'Universal Matic Performance' },
    { sku: 'REM-001', name: 'Kampas Rem Depan Cakram Honda Matic/Bebek (KTM)', cat: 'Kampas & Rem', buy: 26000, sell: 38000, stock: 22, min: 6, comp: 'BeAT, Vario 110/125/150, Scoopy' },
    { sku: 'REM-002', name: 'Kampas Rem Belakang Tromol Honda Matic (KZL)', cat: 'Kampas & Rem', buy: 38000, sell: 52000, stock: 16, min: 5, comp: 'BeAT FI, Scoopy FI, Vario 125' },
    { sku: 'REM-003', name: 'Kampas Rem Depan Yamaha NMAX/Aerox Ori', cat: 'Kampas & Rem', buy: 54000, sell: 72000, stock: 9, min: 4, comp: 'NMAX 155, Aerox 155' },
    { sku: 'REM-004', name: 'Minyak Rem Dot 4 Jumbo 50ml', cat: 'Kampas & Rem', buy: 9000, sell: 15000, stock: 25, min: 5, comp: 'Semua Rem Cakram' },
    { sku: 'BSI-001', name: 'Busi NGK CPR9EA-9 Nickel', cat: 'Busi & Kelistrikan', buy: 18000, sell: 26000, stock: 30, min: 8, comp: 'BeAT ESP, Vario 125/150, NMAX, Aerox' },
    { sku: 'BSI-002', name: 'Busi Denso U24EPR9', cat: 'Busi & Kelistrikan', buy: 17000, sell: 25000, stock: 18, min: 5, comp: 'Scoopy, Sonic 150R, CB150R' },
    { sku: 'BSI-003', name: 'Aki Motor GS Astra GTZ-5S Kering MF', cat: 'Busi & Kelistrikan', buy: 195000, sell: 245000, stock: 6, min: 3, comp: 'BeAT, Vario 110, Mio M3, Soul GT' },
    { sku: 'CVT-001', name: 'Vanbelt V-Belt Kit + Roller Honda BeAT FI K25', cat: 'CVT & Drivetrain', buy: 110000, sell: 145000, stock: 8, min: 3, comp: 'BeAT FI Starter Kasar 2012-2014' },
    { sku: 'CVT-002', name: 'Vanbelt V-Belt Kit + Roller Vario 125 LED K35', cat: 'CVT & Drivetrain', buy: 135000, sell: 175000, stock: 7, min: 3, comp: 'Vario 125 LED 2015-2023' },
    { sku: 'CVT-003', name: 'Gemuk CVT Honda Grease 10gr Double Pack', cat: 'CVT & Drivetrain', buy: 8000, sell: 14000, stock: 45, min: 10, comp: 'Universal Pulley CVT' },
    { sku: 'FLT-001', name: 'Filter Udara AHM BeAT / Scoopy ESP K44', cat: 'Filter & Cairan', buy: 38000, sell: 50000, stock: 15, min: 5, comp: 'BeAT ESP, Scoopy ESP 2015-2019' },
    { sku: 'FLT-002', name: 'Air Radiator Coolant AHM 500ml', cat: 'Filter & Cairan', buy: 16000, sell: 24000, stock: 20, min: 5, comp: 'Vario, PCX, NMAX, Aerox' },
    { sku: 'SRV-001', name: 'Jasa Ganti Oli Mesin & Transmisi', cat: 'Jasa Servis', buy: 0, sell: 10000, stock: 999, min: 0, comp: 'Semua Motor' },
    { sku: 'SRV-002', name: 'Jasa Servis Ringan / Tune-Up Injeksi', cat: 'Jasa Servis', buy: 5000, sell: 45000, stock: 999, min: 0, comp: 'Motor Bebek & Matic' },
    { sku: 'SRV-003', name: 'Jasa Servis CVT Lengkap & Pembersihan', cat: 'Jasa Servis', buy: 5000, sell: 55000, stock: 999, min: 0, comp: 'Semua Motor Matic' },
    { sku: 'SRV-004', name: 'Jasa Pasang Kampas Rem Depan / Belakang', cat: 'Jasa Servis', buy: 0, sell: 15000, stock: 999, min: 0, comp: 'Semua Motor' },
    { sku: 'SRV-005', name: 'Jasa Kuras Radiator & Refill Coolant', cat: 'Jasa Servis', buy: 0, sell: 20000, stock: 999, min: 0, comp: 'Motor Berpendingin Cairan' },
    { sku: 'SRV-006', name: 'Jasa Servis Besar / Skir Klep / Turun Mesin', cat: 'Jasa Servis', buy: 20000, sell: 250000, stock: 999, min: 0, comp: 'Semua Motor' },
  ];

  for (const p of products) {
    const catRes = db.exec('SELECT category_id FROM categories WHERE name = ?', [p.cat]);
    const catId = catRes[0]?.values[0]?.[0] || null;
    db.run(
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
    db.run('INSERT INTO mechanics (name, phone) VALUES (?, ?)', [m.name, m.phone]);
  }

  // 4. Customers & Vehicles
  const customers = [
    {
      name: 'Hendra Gunawan',
      phone: '081289123456',
      created_at: '2026-06-10',
      plate: 'B 3829 TKR',
      brand: 'Honda Vario 125 CBS 2021',
      km: 18450,
      service_date: '2026-06-25',
    },
    {
      name: 'Siti Rahmawati',
      phone: '085712349988',
      created_at: '2026-05-15',
      plate: 'B 6124 KLU',
      brand: 'Honda BeAT Street 2022',
      km: 12200,
      service_date: '2026-07-02',
    },
    {
      name: 'Dimas Aditya',
      phone: '082199887766',
      created_at: '2026-07-20',
      plate: 'D 4091 ZBA',
      brand: 'Yamaha NMAX 155 Connected 2023',
      km: 24500,
      service_date: '2026-08-15',
    },
    {
      name: 'Bambang Irawan',
      phone: '081377889900',
      created_at: '2026-08-01',
      plate: 'B 5543 SJD',
      brand: 'Honda PCX 160 ABS 2022',
      km: 8500,
      service_date: '2026-08-30',
    },
    {
      name: 'Rian Pratama',
      phone: '087811223344',
      created_at: '2026-04-10',
      plate: 'B 4182 UFX',
      brand: 'Yamaha Aerox 155 VVA 2020',
      km: 32000,
      service_date: '2026-06-10',
    },
  ];

  for (const c of customers) {
    db.run('INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)', [c.name, c.phone, c.created_at]);
    const cidRes = db.exec('SELECT last_insert_rowid()');
    const cid = cidRes[0]?.values[0]?.[0];
    db.run(
      `INSERT INTO vehicles (customer_id, plate_number, brand_model, last_km, last_service_date)
       VALUES (?, ?, ?, ?, ?)`,
      [cid, c.plate, c.brand, c.km, c.service_date]
    );
  }

  // 5. Past Sample Sales
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
        { name: 'Air Radiator Coolant AHM 500ml', qty: 1, buy: 16000, sell: 24000, is_service: 0 },
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
        { name: 'Jasa Servis CVT Lengkap & Pembersihan', qty: 1, buy: 5000, sell: 55000, is_service: 1 },
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
        { name: 'Jasa Ganti Oli Mesin & Transmisi', qty: 1, buy: 0, sell: 11000, is_service: 1 },
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
        { name: 'Jasa Servis Ringan / Tune-Up Injeksi', qty: 1, buy: 5000, sell: 45000, is_service: 1 },
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
        { name: 'Jasa Ganti Oli Mesin & Transmisi', qty: 1, buy: 0, sell: 10000, is_service: 1 },
      ],
    },
  ];

  for (const s of sampleSales) {
    const vehRes = db.exec('SELECT vehicle_id FROM vehicles WHERE plate_number = ?', [s.plate]);
    const vehId = vehRes[0]?.values[0]?.[0] || null;

    db.run(
      `INSERT INTO sales (invoice_number, sale_date, vehicle_id, current_km, total_amount, total_hpp, payment_method, mechanic_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.inv, s.date, vehId, s.km, s.total_amount, s.total_hpp, s.payment, s.mechanic_id]
    );
    const sidRes = db.exec('SELECT last_insert_rowid()');
    const sid = sidRes[0]?.values[0]?.[0];

    for (const it of s.items) {
      const prodRes = db.exec('SELECT product_id FROM products WHERE name = ?', [it.name]);
      const prodId = prodRes[0]?.values[0]?.[0] || null;
      const subtotal = it.qty * it.sell;

      db.run(
        `INSERT INTO sale_details (sale_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sid, prodId, it.name, it.qty, it.buy, it.sell, subtotal, it.is_service]
      );
    }
  }
}

// ==========================================
// WASM CLIENT-SIDE DATABASE REPOSITORY
// ==========================================
export const wasmDb = {
  // Categories
  async getCategories(): Promise<Category[]> {
    const db = await getWasmDb();
    const res = db.exec('SELECT * FROM categories ORDER BY name ASC');
    return resultToObjects<Category>(res);
  },

  async addCategory(name: string): Promise<Category> {
    const db = await getWasmDb();
    db.run('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    const idRes = db.exec('SELECT last_insert_rowid()');
    const category_id = Number(idRes[0]?.values[0]?.[0]);
    await persistCurrentDb();
    return { category_id, name: name.trim() };
  },

  async updateCategory(id: number, name: string): Promise<{ message: string }> {
    const db = await getWasmDb();
    db.run('UPDATE categories SET name = ? WHERE category_id = ?', [name.trim(), id]);
    await persistCurrentDb();
    return { message: 'Kategori berhasil diperbarui' };
  },

  async deleteCategory(id: number): Promise<{ message: string }> {
    const db = await getWasmDb();
    const countRes = db.exec('SELECT COUNT(*) FROM products WHERE category_id = ?', [id]);
    const count = Number(countRes[0]?.values[0]?.[0] || 0);
    if (count > 0) {
      throw new Error(`Kategori tidak dapat dihapus karena masih digunakan oleh ${count} produk.`);
    }
    db.run('DELETE FROM categories WHERE category_id = ?', [id]);
    await persistCurrentDb();
    return { message: 'Kategori berhasil dihapus' };
  },

  // Products
  async getProducts(params?: { search?: string; category_id?: number; low_stock?: boolean }): Promise<Product[]> {
    const db = await getWasmDb();
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE 1=1
    `;
    const sqlParams: any[] = [];

    if (params?.search) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.compatibility LIKE ?)`;
      const q = `%${params.search}%`;
      sqlParams.push(q, q, q);
    }

    if (params?.category_id) {
      sql += ` AND p.category_id = ?`;
      sqlParams.push(Number(params.category_id));
    }

    if (params?.low_stock) {
      sql += ` AND p.stock <= p.min_stock`;
    }

    sql += ` ORDER BY p.name ASC`;
    const res = db.exec(sql, sqlParams);
    return resultToObjects<Product>(res);
  },

  async addProduct(productData: Partial<Product>): Promise<{ product_id: number; message: string }> {
    const db = await getWasmDb();
    try {
      db.run('ALTER TABLE products ADD COLUMN image_url TEXT;');
    } catch {}
    db.run(
      `INSERT INTO products (sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productData.sku?.trim() || '',
        productData.name?.trim() || '',
        productData.category_id ? Number(productData.category_id) : null,
        Number(productData.buy_price) || 0,
        Number(productData.sell_price) || 0,
        Number(productData.stock) || 0,
        Number(productData.min_stock) || 5,
        productData.compatibility?.trim() || '',
        productData.image_url ? productData.image_url.trim() : null,
      ]
    );
    const idRes = db.exec('SELECT last_insert_rowid()');
    const product_id = Number(idRes[0]?.values[0]?.[0]);
    await persistCurrentDb();
    return { product_id, message: 'Produk berhasil ditambahkan ke SQLite WASM' };
  },

  async updateProduct(id: number, productData: Partial<Product>): Promise<{ message: string }> {
    const db = await getWasmDb();
    try {
      db.run('ALTER TABLE products ADD COLUMN image_url TEXT;');
    } catch {}
    db.run(
      `UPDATE products 
       SET sku = ?, name = ?, category_id = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, compatibility = ?, image_url = ?
       WHERE product_id = ?`,
      [
        productData.sku?.trim(),
        productData.name?.trim(),
        productData.category_id ? Number(productData.category_id) : null,
        Number(productData.buy_price) || 0,
        Number(productData.sell_price) || 0,
        Number(productData.stock) || 0,
        Number(productData.min_stock) || 5,
        productData.compatibility?.trim() || '',
        productData.image_url !== undefined ? (productData.image_url ? productData.image_url.trim() : null) : null,
        id,
      ]
    );
    await persistCurrentDb();
    return { message: 'Produk berhasil diperbarui' };
  },

  async deleteProduct(id: number): Promise<{ message: string }> {
    const db = await getWasmDb();
    db.run('DELETE FROM products WHERE product_id = ?', [id]);
    await persistCurrentDb();
    return { message: 'Produk berhasil dihapus' };
  },

  async adjustStock(id: number, adjustment?: number, new_stock?: number): Promise<any> {
    const db = await getWasmDb();
    if (new_stock !== undefined) {
      db.run('UPDATE products SET stock = ? WHERE product_id = ?', [new_stock, id]);
    } else if (adjustment !== undefined) {
      db.run('UPDATE products SET stock = stock + ? WHERE product_id = ?', [adjustment, id]);
    }
    await persistCurrentDb();
    return { success: true };
  },

  // Customers
  async getCustomers(): Promise<Customer[]> {
    const db = await getWasmDb();
    const res = db.exec('SELECT * FROM customers ORDER BY name ASC');
    return resultToObjects<Customer>(res);
  },

  async addCustomer(name: string, phone: string): Promise<Customer> {
    const db = await getWasmDb();
    const now = new Date().toISOString().split('T')[0];
    db.run('INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)', [name.trim(), phone.trim(), now]);
    const idRes = db.exec('SELECT last_insert_rowid()');
    const customer_id = Number(idRes[0]?.values[0]?.[0]);
    await persistCurrentDb();
    return { customer_id, name: name.trim(), phone: phone.trim(), created_at: now };
  },

  async updateCustomer(id: number, name: string, phone: string): Promise<{ message: string }> {
    const db = await getWasmDb();
    db.run('UPDATE customers SET name = ?, phone = ? WHERE customer_id = ?', [name.trim(), phone.trim(), id]);
    await persistCurrentDb();
    return { message: 'Data pelanggan berhasil diperbarui' };
  },

  // Vehicles
  async getVehicles(search?: string): Promise<Vehicle[]> {
    const db = await getWasmDb();
    let sql = `
      SELECT v.*, c.name as customer_name, c.phone as customer_phone
      FROM vehicles v
      LEFT JOIN customers c ON v.customer_id = c.customer_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      sql += ` AND (v.plate_number LIKE ? OR v.brand_model LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    sql += ` ORDER BY v.plate_number ASC`;
    const res = db.exec(sql, params);
    return resultToObjects<Vehicle>(res);
  },

  async addVehicle(vehicleData: Partial<Vehicle>): Promise<{ vehicle_id: number; message: string }> {
    const db = await getWasmDb();
    let customerId = vehicleData.customer_id;

    if (!customerId && (vehicleData as any).customer_name) {
      const now = new Date().toISOString().split('T')[0];
      db.run('INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)', [
        (vehicleData as any).customer_name,
        (vehicleData as any).customer_phone || '',
        now,
      ]);
      const cidRes = db.exec('SELECT last_insert_rowid()');
      customerId = Number(cidRes[0]?.values[0]?.[0]);
    }

    db.run(
      `INSERT INTO vehicles (customer_id, plate_number, brand_model, last_km, last_service_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        customerId || null,
        vehicleData.plate_number?.toUpperCase().trim() || '',
        vehicleData.brand_model?.trim() || '',
        Number(vehicleData.last_km) || 0,
        vehicleData.last_service_date || null,
      ]
    );
    const vidRes = db.exec('SELECT last_insert_rowid()');
    const vehicle_id = Number(vidRes[0]?.values[0]?.[0]);
    await persistCurrentDb();
    return { vehicle_id, message: 'Kendaraan berhasil didaftarkan' };
  },

  async updateVehicle(id: number, vehicleData: Partial<Vehicle>): Promise<{ message: string }> {
    const db = await getWasmDb();
    db.run(
      `UPDATE vehicles 
       SET plate_number = ?, brand_model = ?, last_km = ?, last_service_date = ?
       WHERE vehicle_id = ?`,
      [
        vehicleData.plate_number?.toUpperCase().trim(),
        vehicleData.brand_model?.trim(),
        Number(vehicleData.last_km) || 0,
        vehicleData.last_service_date || null,
        id,
      ]
    );
    await persistCurrentDb();
    return { message: 'Data kendaraan berhasil diperbarui' };
  },

  // Mechanics
  async getMechanics(): Promise<Mechanic[]> {
    const db = await getWasmDb();
    const res = db.exec('SELECT * FROM mechanics ORDER BY name ASC');
    return resultToObjects<Mechanic>(res);
  },

  async addMechanic(name: string, phone?: string): Promise<Mechanic> {
    const db = await getWasmDb();
    db.run('INSERT INTO mechanics (name, phone) VALUES (?, ?)', [name.trim(), phone?.trim() || null]);
    const idRes = db.exec('SELECT last_insert_rowid()');
    const mechanic_id = Number(idRes[0]?.values[0]?.[0]);
    await persistCurrentDb();
    return { mechanic_id, name: name.trim(), phone: phone?.trim() || '' };
  },

  async updateMechanic(id: number, name: string, phone?: string): Promise<{ message: string }> {
    const db = await getWasmDb();
    db.run('UPDATE mechanics SET name = ?, phone = ? WHERE mechanic_id = ?', [name.trim(), phone?.trim() || null, id]);
    await persistCurrentDb();
    return { message: 'Data mekanik berhasil diperbarui' };
  },

  async deleteMechanic(id: number): Promise<{ message: string }> {
    const db = await getWasmDb();
    db.run('DELETE FROM mechanics WHERE mechanic_id = ?', [id]);
    await persistCurrentDb();
    return { message: 'Mekanik berhasil dihapus' };
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
    const db = await getWasmDb();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const invoiceNumber = `INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalAmount = 0;
    let totalHpp = 0;

    for (const item of payload.items) {
      totalAmount += item.quantity * item.sell_price;
      totalHpp += item.quantity * item.buy_price;
    }

    // Insert Sale
    db.run(
      `INSERT INTO sales (invoice_number, sale_date, vehicle_id, current_km, total_amount, total_hpp, payment_method, mechanic_id, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        invoiceNumber,
        dateStr,
        payload.vehicle_id || null,
        payload.current_km || null,
        totalAmount,
        totalHpp,
        payload.payment_method,
        payload.mechanic_id || null,
      ]
    );

    const saleIdRes = db.exec('SELECT last_insert_rowid()');
    const saleId = Number(saleIdRes[0]?.values[0]?.[0]);

    const createdDetails: SaleDetail[] = [];

    // Insert items & deduct inventory
    for (const item of payload.items) {
      const subtotal = item.quantity * item.sell_price;
      db.run(
        `INSERT INTO sale_details (sale_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          item.product_id || null,
          item.item_name,
          item.quantity,
          item.buy_price,
          item.sell_price,
          subtotal,
          item.is_service,
        ]
      );

      const detIdRes = db.exec('SELECT last_insert_rowid()');
      createdDetails.push({
        detail_id: Number(detIdRes[0]?.values[0]?.[0]),
        sale_id: saleId,
        product_id: item.product_id || null,
        item_name: item.item_name,
        quantity: item.quantity,
        buy_price: item.buy_price,
        sell_price: item.sell_price,
        subtotal,
        is_service: item.is_service,
      });

      // Deduct stock if not a service
      if (item.product_id && item.is_service === 0) {
        db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    // Update vehicle km and service date
    if (payload.vehicle_id) {
      const dateOnly = dateStr.split(' ')[0];
      if (payload.current_km) {
        db.run(
          `UPDATE vehicles 
           SET last_km = MAX(COALESCE(last_km, 0), ?), last_service_date = ? 
           WHERE vehicle_id = ?`,
          [payload.current_km, dateOnly, payload.vehicle_id]
        );
      } else {
        db.run(`UPDATE vehicles SET last_service_date = ? WHERE vehicle_id = ?`, [dateOnly, payload.vehicle_id]);
      }
    }

    await persistCurrentDb();

    const createdSale: Sale = {
      sale_id: saleId,
      invoice_number: invoiceNumber,
      sale_date: dateStr,
      vehicle_id: payload.vehicle_id || null,
      current_km: payload.current_km || null,
      total_amount: totalAmount,
      total_hpp: totalHpp,
      payment_method: payload.payment_method,
      mechanic_id: payload.mechanic_id || null,
      is_synced: 0,
      synced_at: null,
    };

    return {
      success: true,
      message: 'Transaksi kasir berhasil disimpan ke SQLite WASM',
      sale: createdSale,
      details: createdDetails,
    };
  },

  // Sales History
  async getSales(limit = 50, search?: string, startDate?: string, endDate?: string): Promise<Sale[]> {
    const db = await getWasmDb();
    let sql = `
      SELECT 
        s.*,
        v.plate_number,
        v.brand_model,
        c.name as customer_name,
        c.phone as customer_phone,
        m.name as mechanic_name
      FROM sales s
      LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
      LEFT JOIN customers c ON v.customer_id = c.customer_id
      LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      sql += ` AND (s.invoice_number LIKE ? OR v.plate_number LIKE ? OR c.name LIKE ?)`;
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (startDate) {
      sql += ` AND date(s.sale_date) >= date(?)`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND date(s.sale_date) <= date(?)`;
      params.push(endDate);
    }
    sql += ` ORDER BY s.sale_date DESC LIMIT ?`;
    params.push(limit);

    const res = db.exec(sql, params);
    return resultToObjects<Sale>(res);
  },

  async getSaleDetail(id: number): Promise<{ sale: Sale; details: SaleDetail[] }> {
    const db = await getWasmDb();
    const saleRes = db.exec(
      `SELECT s.*, v.plate_number, v.brand_model, c.name as customer_name, c.phone as customer_phone, m.name as mechanic_name
       FROM sales s
       LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
       LEFT JOIN customers c ON v.customer_id = c.customer_id
       LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
       WHERE s.sale_id = ?`,
      [id]
    );
    const sales = resultToObjects<Sale>(saleRes);
    if (!sales || sales.length === 0) throw new Error('Transaksi tidak ditemukan');

    const detailsRes = db.exec(
      `SELECT sd.*, p.sku, p.compatibility 
       FROM sale_details sd
       LEFT JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [id]
    );
    const details = resultToObjects<SaleDetail>(detailsRes);
    return { sale: sales[0], details };
  },

  // CRM Reminders
  async getCrmReminders(): Promise<CRMReminder[]> {
    const db = await getWasmDb();
    const sql = `
      SELECT 
        v.vehicle_id,
        v.plate_number,
        v.brand_model,
        v.last_km,
        v.last_service_date,
        c.customer_id,
        c.name as customer_name,
        c.phone as customer_phone
      FROM vehicles v
      JOIN customers c ON v.customer_id = c.customer_id
      ORDER BY v.last_service_date ASC
    `;
    const res = db.exec(sql);
    const rows = resultToObjects(res);

    const today = new Date();
    const reminders: CRMReminder[] = [];

    for (const v of rows) {
      let daysSinceService = 999;
      if (v.last_service_date) {
        const sDate = new Date(v.last_service_date);
        const diffMs = today.getTime() - sDate.getTime();
        daysSinceService = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      const estimatedKmIncrease = Math.round(daysSinceService * 35);
      const estimatedCurrentKm = (v.last_km || 0) + estimatedKmIncrease;

      const isOverdueDays = daysSinceService >= 60;
      const isOverdueKm = estimatedKmIncrease >= 2000;
      const isDue = isOverdueDays || isOverdueKm;

      let status: 'OVERDUE' | 'DUE_SOON' | 'GOOD' = 'GOOD';
      if (daysSinceService >= 60 || estimatedKmIncrease >= 2000) {
        status = 'OVERDUE';
      } else if (daysSinceService >= 45 || estimatedKmIncrease >= 1500) {
        status = 'DUE_SOON';
      }

      const waMsg =
        `Halo Kak ${v.customer_name}, kami dari Bengkel & Toko Sparepart Motor. Mengingatkan bahwa motor ${v.brand_model} (${v.plate_number}) sudah saatnya servis berkala / ganti oli.\n\n` +
        `📌 Terakhir Servis: ${v.last_service_date || '-'}\n` +
        `📌 KM Terakhir: ${(v.last_km || 0).toLocaleString('id-ID')} KM\n` +
        `📌 Estimasi KM Saat Ini: ~${estimatedCurrentKm.toLocaleString('id-ID')} KM (+${estimatedKmIncrease.toLocaleString('id-ID')} KM)\n` +
        `📌 Waktu Berlalu: ${daysSinceService} hari yang lalu\n\n` +
        `Jadwalkan servis Anda sekarang untuk menjaga performa mesin tetap prima! Hubungi kami untuk reservasi atau langsung datang ke bengkel. Terima kasih! 🙏`;

      let cleanPhone = (v.customer_phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;

      reminders.push({
        vehicle_id: v.vehicle_id,
        customer_id: v.customer_id,
        customer_name: v.customer_name,
        customer_phone: v.customer_phone,
        plate_number: v.plate_number,
        brand_model: v.brand_model,
        last_km: v.last_km || 0,
        last_service_date: v.last_service_date || '',
        days_since_service: daysSinceService,
        estimated_km_increase: estimatedKmIncrease,
        estimated_current_km: estimatedCurrentKm,
        is_overdue_days: isOverdueDays,
        is_overdue_km: isOverdueKm,
        is_due: isDue,
        status,
        wa_message: waMsg,
        wa_url: waUrl,
      });
    }

    return reminders;
  },

  // Business Reports
  async getProfitLoss(start_date?: string, end_date?: string): Promise<ProfitLossReport> {
    const db = await getWasmDb();
    let sqlSales = `SELECT * FROM sales WHERE 1=1`;
    const params: any[] = [];
    if (start_date) {
      sqlSales += ` AND date(sale_date) >= date(?)`;
      params.push(start_date);
    }
    if (end_date) {
      sqlSales += ` AND date(sale_date) <= date(?)`;
      params.push(end_date);
    }

    const salesList = resultToObjects<Sale>(db.exec(sqlSales, params));

    let totalOmzet = 0;
    let totalHpp = 0;
    salesList.forEach((s) => {
      totalOmzet += s.total_amount;
      totalHpp += s.total_hpp;
    });

    const grossProfit = totalOmzet - totalHpp;
    const profitMarginPct = totalOmzet > 0 ? (grossProfit / totalOmzet) * 100 : 0;

    let sqlDetails = `
      SELECT sd.is_service,
             SUM(sd.subtotal) as total_omzet,
             SUM(sd.buy_price * sd.quantity) as total_hpp,
             SUM(sd.quantity) as total_qty
      FROM sale_details sd
      JOIN sales s ON sd.sale_id = s.sale_id
      WHERE 1=1
    `;
    const detailParams: any[] = [];
    if (start_date) {
      sqlDetails += ` AND date(s.sale_date) >= date(?)`;
      detailParams.push(start_date);
    }
    if (end_date) {
      sqlDetails += ` AND date(s.sale_date) <= date(?)`;
      detailParams.push(end_date);
    }
    sqlDetails += ` GROUP BY sd.is_service`;

    const breakdownRows = resultToObjects(db.exec(sqlDetails, detailParams));
    const goodsRow = breakdownRows.find((r) => r.is_service === 0) || { total_omzet: 0, total_hpp: 0, total_qty: 0 };
    const serviceRow = breakdownRows.find((r) => r.is_service === 1) || { total_omzet: 0, total_hpp: 0, total_qty: 0 };

    return {
      total_transactions: salesList.length,
      total_omzet: totalOmzet,
      total_hpp: totalHpp,
      gross_profit: grossProfit,
      profit_margin_pct: Number(profitMarginPct.toFixed(2)),
      goods: {
        omzet: goodsRow.total_omzet || 0,
        hpp: goodsRow.total_hpp || 0,
        profit: (goodsRow.total_omzet || 0) - (goodsRow.total_hpp || 0),
        qty: goodsRow.total_qty || 0,
      },
      services: {
        omzet: serviceRow.total_omzet || 0,
        hpp: serviceRow.total_hpp || 0,
        profit: (serviceRow.total_omzet || 0) - (serviceRow.total_hpp || 0),
        qty: serviceRow.total_qty || 0,
      },
    };
  },

  async getMovement(start_date?: string, end_date?: string): Promise<MovementReport> {
    const db = await getWasmDb();
    let sql = `
      SELECT
        p.product_id,
        COALESCE(p.sku, 'SRV') as sku,
        COALESCE(p.name, sd.item_name) as item_name,
        c.name as category_name,
        p.stock as current_stock,
        p.min_stock,
        sd.is_service,
        SUM(sd.quantity) as total_sold_qty,
        SUM(sd.subtotal) as total_revenue,
        SUM((sd.sell_price - sd.buy_price) * sd.quantity) as total_profit
      FROM sale_details sd
      JOIN sales s ON sd.sale_id = s.sale_id
      LEFT JOIN products p ON sd.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (start_date) {
      sql += ` AND date(s.sale_date) >= date(?)`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND date(s.sale_date) <= date(?)`;
      params.push(end_date);
    }
    sql += ` GROUP BY sd.item_name ORDER BY total_sold_qty DESC`;

    const rows = resultToObjects(db.exec(sql, params));

    const allProducts = resultToObjects(
      db.exec(`
        SELECT p.product_id, p.sku, p.name as item_name, c.name as category_name, p.stock as current_stock, p.min_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
      `)
    );

    const soldItemNames = new Set(rows.map((r) => r.item_name));
    const zeroSalesProducts: MovementItem[] = allProducts
      .filter((p) => !soldItemNames.has(p.item_name))
      .map((p) => ({
        product_id: p.product_id,
        sku: p.sku,
        item_name: p.item_name,
        category_name: p.category_name || 'Uncategorized',
        current_stock: p.current_stock || 0,
        min_stock: p.min_stock || 5,
        is_service: 0,
        total_sold_qty: 0,
        total_revenue: 0,
        total_profit: 0,
        movement_class: 'SLOW_OR_ZERO' as const,
      }));

    const enrichedRows: MovementItem[] = rows.map((r) => {
      let movementClass: 'FAST' | 'NORMAL' | 'SLOW' = 'SLOW';
      if (r.total_sold_qty >= 3) {
        movementClass = 'FAST';
      } else if (r.total_sold_qty >= 1) {
        movementClass = 'NORMAL';
      }
      return {
        product_id: r.product_id || null,
        sku: r.sku || '',
        item_name: r.item_name,
        category_name: r.category_name || 'Jasa / Servis',
        current_stock: r.current_stock ?? 999,
        min_stock: r.min_stock ?? 0,
        is_service: r.is_service || 0,
        total_sold_qty: Number(r.total_sold_qty) || 0,
        total_revenue: Number(r.total_revenue) || 0,
        total_profit: Number(r.total_profit) || 0,
        movement_class: movementClass,
      };
    });

    return {
      items: [...enrichedRows, ...zeroSalesProducts],
      fast_moving: enrichedRows.filter((r) => r.movement_class === 'FAST'),
      slow_moving: [...enrichedRows.filter((r) => r.movement_class === 'SLOW'), ...zeroSalesProducts],
    };
  },

  async getRecap(): Promise<RecapReport> {
    const db = await getWasmDb();

    const dailyRows = resultToObjects(
      db.exec(`
        SELECT
          date(sale_date) as date_label,
          COUNT(sale_id) as transaction_count,
          SUM(total_amount) as omzet,
          SUM(total_hpp) as hpp,
          SUM(total_amount - total_hpp) as gross_profit
        FROM sales
        GROUP BY date(sale_date)
        ORDER BY date(sale_date) DESC
        LIMIT 30
      `)
    );

    const monthlyRows = resultToObjects(
      db.exec(`
        SELECT
          strftime('%Y-%m', sale_date) as month_label,
          COUNT(sale_id) as transaction_count,
          SUM(total_amount) as omzet,
          SUM(total_hpp) as hpp,
          SUM(total_amount - total_hpp) as gross_profit
        FROM sales
        GROUP BY strftime('%Y-%m', sale_date)
        ORDER BY month_label DESC
        LIMIT 12
      `)
    );

    const paymentRows = resultToObjects(
      db.exec(`
        SELECT
          payment_method,
          COUNT(sale_id) as count,
          SUM(total_amount) as total_amount
        FROM sales
        GROUP BY payment_method
      `)
    );

    return {
      daily: dailyRows,
      monthly: monthlyRows,
      payment_methods: paymentRows,
    };
  },

  // Sync helpers
  async getUnsyncedSales(): Promise<any[]> {
    const db = await getWasmDb();
    const salesRes = db.exec(
      `SELECT 
        s.*,
        v.plate_number,
        v.brand_model,
        c.name as customer_name,
        c.phone as customer_phone,
        m.name as mechanic_name
       FROM sales s
       LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
       LEFT JOIN customers c ON v.customer_id = c.customer_id
       LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
       WHERE s.is_synced = 0
       ORDER BY s.sale_date ASC`
    );
    const sales = resultToObjects(salesRes);

    const fullSales = [];
    for (const sale of sales) {
      const itemsRes = db.exec(
        `SELECT product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service
         FROM sale_details
         WHERE sale_id = ?`,
        [sale.sale_id]
      );
      fullSales.push({
        ...sale,
        items: resultToObjects(itemsRes),
      });
    }

    return fullSales;
  },

  async getAllSalesForSync(): Promise<any[]> {
    const db = await getWasmDb();
    const salesRes = db.exec(
      `SELECT 
        s.*,
        v.plate_number,
        v.brand_model,
        c.name as customer_name,
        c.phone as customer_phone,
        m.name as mechanic_name
       FROM sales s
       LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
       LEFT JOIN customers c ON v.customer_id = c.customer_id
       LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
       ORDER BY s.sale_date ASC`
    );
    const sales = resultToObjects(salesRes);

    const fullSales = [];
    for (const sale of sales) {
      const itemsRes = db.exec(
        `SELECT product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service
         FROM sale_details
         WHERE sale_id = ?`,
        [sale.sale_id]
      );
      fullSales.push({
        ...sale,
        items: resultToObjects(itemsRes),
      });
    }

    return fullSales;
  },

  async markSalesSynced(invoices: string[]): Promise<void> {
    const db = await getWasmDb();
    const now = new Date().toISOString();
    for (const inv of invoices) {
      db.run('UPDATE sales SET is_synced = 1, synced_at = ? WHERE invoice_number = ?', [now, inv]);
    }
    await persistCurrentDb();
  },
};
