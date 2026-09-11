var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/db.ts
var import_node_sqlite = require("node:sqlite");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var appDbInstance = null;
function flattenParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}
async function getDb() {
  if (appDbInstance) return appDbInstance;
  const dataDir = import_path.default.join(process.cwd(), "data");
  if (!import_fs.default.existsSync(dataDir)) {
    import_fs.default.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = import_path.default.join(dataDir, "motopos.sqlite");
  const syncDb = new import_node_sqlite.DatabaseSync(dbPath);
  syncDb.exec("PRAGMA foreign_keys = ON;");
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
  try {
    syncDb.exec(`
      INSERT OR IGNORE INTO store_settings (id, store_name, store_address, store_phone, receipt_footer_1, receipt_footer_2, receipt_footer_3)
      VALUES (1, 'BENGKEL & TOKO OLI MOTOR', 'Jl. Raya Otomotif No. 88, Sentra Onderdil', '0812-3456-7890', '*** TERIMA KASIH ***', 'Perawatan rutin menjaga performa & keselamatan motor Anda.', 'Servis berikutnya: 2.000 KM / 60 Hari.');
    `);
  } catch {
  }
  try {
    const altDbPath = import_path.default.join(dataDir, "motopos.sqlite");
    if (!import_fs.default.existsSync(altDbPath)) {
      import_fs.default.copyFileSync(dbPath, altDbPath);
    }
  } catch {
  }
  try {
    syncDb.exec("ALTER TABLE sales ADD COLUMN is_synced INTEGER NOT NULL DEFAULT 0;");
  } catch {
  }
  try {
    syncDb.exec("ALTER TABLE sales ADD COLUMN synced_at TEXT;");
  } catch {
  }
  try {
    syncDb.exec("ALTER TABLE products ADD COLUMN image_url TEXT;");
  } catch {
  }
  try {
    syncDb.exec("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;");
  } catch {
  }
  try {
    syncDb.exec("ALTER TABLE users ADD COLUMN active_session_id TEXT;");
  } catch {
  }
  try {
    syncDb.exec("ALTER TABLE users ADD COLUMN last_activity TEXT;");
  } catch {
  }
  const wrappedDb = {
    async all(sql, ...params) {
      const p = flattenParams(params);
      const stmt = syncDb.prepare(sql);
      return stmt.all(...p);
    },
    async get(sql, ...params) {
      const p = flattenParams(params);
      const stmt = syncDb.prepare(sql);
      return stmt.get(...p);
    },
    async run(sql, ...params) {
      const p = flattenParams(params);
      const stmt = syncDb.prepare(sql);
      const res = stmt.run(...p);
      return {
        changes: Number(res.changes),
        lastID: Number(res.lastInsertRowid)
      };
    },
    async exec(sql) {
      syncDb.exec(sql);
    }
  };
  await seedInitialData(wrappedDb);
  await seedInitialUsers(wrappedDb);
  appDbInstance = wrappedDb;
  return appDbInstance;
}
async function seedInitialUsers(db) {
  try {
    const userCount = await db.get("SELECT COUNT(*) as count FROM users");
    if (!userCount || userCount.count === 0) {
      console.log("[SQLite] Seeding initial users into SQLite...");
      const defaultUsers = [
        {
          username: "owner",
          full_name: "Bpk. Hendra (Owner)",
          role: "owner",
          pin: "1234",
          password: "admin",
          permissions: JSON.stringify({
            can_add_product: true,
            can_edit_product: true,
            can_stock_opname: true,
            can_reprint_receipt: true,
            can_view_profit_report: true,
            can_manage_users: true,
            can_access_sync: true
          })
        },
        {
          username: "supervisor",
          full_name: "Doni (Supervisor Toko)",
          role: "supervisor",
          pin: "2345",
          password: "spv",
          permissions: JSON.stringify({
            can_add_product: true,
            can_edit_product: true,
            can_stock_opname: true,
            can_reprint_receipt: true,
            can_view_profit_report: true,
            can_manage_users: false,
            can_access_sync: true
          })
        },
        {
          username: "kasir",
          full_name: "Siti Rahma (Kasir Shift 1)",
          role: "kasir",
          pin: "1111",
          password: "kasir",
          permissions: JSON.stringify({
            can_add_product: false,
            can_edit_product: false,
            can_stock_opname: false,
            can_reprint_receipt: true,
            can_view_profit_report: false,
            can_manage_users: false,
            can_access_sync: false
          })
        },
        {
          username: "teknisi",
          full_name: "Agus (Mekanik Senior)",
          role: "teknisi",
          pin: "9999",
          password: "mekanik",
          permissions: JSON.stringify({
            can_add_product: false,
            can_edit_product: false,
            can_stock_opname: false,
            can_reprint_receipt: false,
            can_view_profit_report: false,
            can_manage_users: false,
            can_access_sync: false
          })
        }
      ];
      for (const u of defaultUsers) {
        await db.run(
          `INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`,
          [u.username, u.full_name, u.role, u.pin, u.password, u.permissions]
        );
      }
      console.log("[SQLite] Initial users seeded successfully into users table.");
    }
  } catch (err) {
    console.error("[SQLite] Error seeding initial users:", err?.message);
  }
}
async function seedInitialData(db) {
  const catCount = await db.get("SELECT COUNT(*) as count FROM categories");
  if (catCount && catCount.count > 0) {
    return;
  }
  console.log("[SQLite] Seeding initial sample data for Bengkel Toko Oli & Sparepart...");
  const categories = [
    "Oli Mesin",
    "Oli Gardan & Transmisi",
    "Kampas & Rem",
    "Busi & Kelistrikan",
    "CVT & Drivetrain",
    "Ban & Velg",
    "Filter & Cairan",
    "Jasa Servis"
  ];
  for (const cat of categories) {
    await db.run("INSERT INTO categories (name) VALUES (?)", [cat]);
  }
  const products = [
    // Oli Mesin
    { sku: "OLI-001", name: "Astra Honda Motor MPX-2 Matic 0.8L 10W-30", cat: "Oli Mesin", buy: 44e3, sell: 55e3, stock: 32, min: 10, comp: "Honda BeAT, Vario, Scoopy, Genio" },
    { sku: "OLI-002", name: "Yamalube Matic Motor Oil 0.8L 20W-40", cat: "Oli Mesin", buy: 42e3, sell: 52e3, stock: 24, min: 8, comp: "Mio Series, Fazzio, Gear 125" },
    { sku: "OLI-003", name: "Shell Advance AX7 Matic 10W-40 0.8L", cat: "Oli Mesin", buy: 53e3, sell: 66e3, stock: 18, min: 6, comp: "Universal Matic (Honda, Yamaha, Suzuki)" },
    { sku: "OLI-004", name: "Motul Scooter Expert LE 10W-30 0.8L", cat: "Oli Mesin", buy: 68e3, sell: 85e3, stock: 12, min: 5, comp: "Vario 150/160, PCX 160, ADV 160" },
    { sku: "OLI-005", name: "Yamalube Super Matic 1.0L 10W-40", cat: "Oli Mesin", buy: 62e3, sell: 76e3, stock: 15, min: 5, comp: "NMAX 155, Aerox 155, Lexi" },
    { sku: "OLI-006", name: "Federal Oil Ultratec 20W-50 0.8L Bebek", cat: "Oli Mesin", buy: 34e3, sell: 43e3, stock: 20, min: 5, comp: "Supra X, Revo, Jupiter Z, Smash" },
    // Oli Gardan
    { sku: "GRD-001", name: "AHM Scooter Gear Oil 120ml", cat: "Oli Gardan & Transmisi", buy: 13e3, sell: 18e3, stock: 40, min: 10, comp: "Semua Motor Matic Honda" },
    { sku: "GRD-002", name: "Yamalube Gear Motor Oil 100ml", cat: "Oli Gardan & Transmisi", buy: 12e3, sell: 17e3, stock: 35, min: 10, comp: "Semua Motor Matic Yamaha" },
    { sku: "GRD-003", name: "Motul Scooter Gear 80W-90 120ml", cat: "Oli Gardan & Transmisi", buy: 23e3, sell: 32e3, stock: 14, min: 4, comp: "Universal Matic Performance" },
    // Kampas & Rem
    { sku: "REM-001", name: "Kampas Rem Depan Cakram Honda Matic/Bebek (KTM)", cat: "Kampas & Rem", buy: 26e3, sell: 38e3, stock: 22, min: 6, comp: "BeAT, Vario 110/125/150, Scoopy" },
    { sku: "REM-002", name: "Kampas Rem Belakang Tromol Honda Matic (KZL)", cat: "Kampas & Rem", buy: 38e3, sell: 52e3, stock: 16, min: 5, comp: "BeAT FI, Scoopy FI, Vario 125" },
    { sku: "REM-003", name: "Kampas Rem Depan Yamaha NMAX/Aerox Ori", cat: "Kampas & Rem", buy: 54e3, sell: 72e3, stock: 9, min: 4, comp: "NMAX 155, Aerox 155" },
    { sku: "REM-004", name: "Minyak Rem Dot 4 Jumbo 50ml", cat: "Kampas & Rem", buy: 9e3, sell: 15e3, stock: 25, min: 5, comp: "Semua Rem Cakram" },
    // Busi & Kelistrikan
    { sku: "BSI-001", name: "Busi NGK CPR9EA-9 Nickel", cat: "Busi & Kelistrikan", buy: 18e3, sell: 26e3, stock: 30, min: 8, comp: "BeAT ESP, Vario 125/150, NMAX, Aerox" },
    { sku: "BSI-002", name: "Busi Denso U24EPR9", cat: "Busi & Kelistrikan", buy: 17e3, sell: 25e3, stock: 18, min: 5, comp: "Scoopy, Sonic 150R, CB150R" },
    { sku: "BSI-003", name: "Aki Motor GS Astra GTZ-5S Kering MF", cat: "Busi & Kelistrikan", buy: 195e3, sell: 245e3, stock: 6, min: 3, comp: "BeAT, Vario 110, Mio M3, Soul GT" },
    // CVT & Drivetrain
    { sku: "CVT-001", name: "Vanbelt V-Belt Kit + Roller Honda BeAT FI K25", cat: "CVT & Drivetrain", buy: 11e4, sell: 145e3, stock: 8, min: 3, comp: "BeAT FI Starter Kasar 2012-2014" },
    { sku: "CVT-002", name: "Vanbelt V-Belt Kit + Roller Vario 125 LED K35", cat: "CVT & Drivetrain", buy: 135e3, sell: 175e3, stock: 7, min: 3, comp: "Vario 125 LED 2015-2023" },
    { sku: "CVT-003", name: "Gemuk CVT Honda Grease 10gr Double Pack", cat: "CVT & Drivetrain", buy: 8e3, sell: 14e3, stock: 45, min: 10, comp: "Universal Pulley CVT" },
    // Filter & Cairan
    { sku: "FLT-001", name: "Filter Udara AHM BeAT / Scoopy ESP K44", cat: "Filter & Cairan", buy: 38e3, sell: 5e4, stock: 15, min: 5, comp: "BeAT ESP, Scoopy ESP 2015-2019" },
    { sku: "FLT-002", name: "Air Radiator Coolant AHM 500ml", cat: "Filter & Cairan", buy: 16e3, sell: 24e3, stock: 20, min: 5, comp: "Vario, PCX, NMAX, Aerox" },
    // Jasa Servis (Stok 999, buy_price 0 atau biaya operasional)
    { sku: "SRV-001", name: "Jasa Ganti Oli Mesin & Transmisi", cat: "Jasa Servis", buy: 0, sell: 1e4, stock: 999, min: 0, comp: "Semua Motor" },
    { sku: "SRV-002", name: "Jasa Servis Ringan / Tune-Up Injeksi", cat: "Jasa Servis", buy: 5e3, sell: 45e3, stock: 999, min: 0, comp: "Motor Bebek & Matic" },
    { sku: "SRV-003", name: "Jasa Servis CVT Lengkap & Pembersihan", cat: "Jasa Servis", buy: 5e3, sell: 55e3, stock: 999, min: 0, comp: "Semua Motor Matic" },
    { sku: "SRV-004", name: "Jasa Pasang Kampas Rem Depan / Belakang", cat: "Jasa Servis", buy: 0, sell: 15e3, stock: 999, min: 0, comp: "Semua Motor" },
    { sku: "SRV-005", name: "Jasa Kuras Radiator & Refill Coolant", cat: "Jasa Servis", buy: 0, sell: 2e4, stock: 999, min: 0, comp: "Motor Berpendingin Cairan" },
    { sku: "SRV-006", name: "Jasa Servis Besar / Skir Klep / Turun Mesin", cat: "Jasa Servis", buy: 2e4, sell: 25e4, stock: 999, min: 0, comp: "Semua Motor" }
  ];
  for (const p of products) {
    const catRow = await db.get("SELECT category_id FROM categories WHERE name = ?", [p.cat]);
    const catId = catRow ? catRow.category_id : null;
    await db.run(
      `INSERT INTO products (sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.sku, p.name, catId, p.buy, p.sell, p.stock, p.min, p.comp]
    );
  }
  const mechanics = [
    { name: "Joko Susilo (Kepala Mekanik)", phone: "081234567801" },
    { name: "Wahyu Ramadhan", phone: "081234567802" },
    { name: "Deni Kurniawan", phone: "081234567803" }
  ];
  for (const m of mechanics) {
    await db.run("INSERT INTO mechanics (name, phone) VALUES (?, ?)", [m.name, m.phone]);
  }
  const customersData = [
    {
      name: "Hendra Gunawan",
      phone: "081289123456",
      created_at: "2026-06-10",
      vehicle: {
        plate: "B 3829 TKR",
        brand_model: "Honda Vario 125 CBS 2021",
        last_km: 18450,
        // Serviced 75 days ago -> overdue >= 60 days
        last_service_date: "2026-06-25"
      }
    },
    {
      name: "Siti Rahmawati",
      phone: "085712349988",
      created_at: "2026-05-15",
      vehicle: {
        plate: "B 6124 KLU",
        brand_model: "Honda BeAT Street 2022",
        last_km: 12200,
        // Serviced 68 days ago -> overdue >= 60 days
        last_service_date: "2026-07-02"
      }
    },
    {
      name: "Dimas Aditya",
      phone: "082199887766",
      created_at: "2026-07-20",
      vehicle: {
        plate: "D 4091 ZBA",
        brand_model: "Yamaha NMAX 155 Connected 2023",
        last_km: 24500,
        // Serviced 25 days ago, but high km accumulation -> estimated km over 2,000 km
        last_service_date: "2026-08-15"
      }
    },
    {
      name: "Bambang Irawan",
      phone: "081377889900",
      created_at: "2026-08-01",
      vehicle: {
        plate: "B 5543 SJD",
        brand_model: "Honda PCX 160 ABS 2022",
        last_km: 8500,
        // Serviced recently (10 days ago) -> not overdue
        last_service_date: "2026-08-30"
      }
    },
    {
      name: "Rian Pratama",
      phone: "087811223344",
      created_at: "2026-04-10",
      vehicle: {
        plate: "B 4182 UFX",
        brand_model: "Yamaha Aerox 155 VVA 2020",
        last_km: 32e3,
        // Serviced 90 days ago -> overdue
        last_service_date: "2026-06-10"
      }
    }
  ];
  for (const c of customersData) {
    const custRes = await db.run(
      "INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)",
      [c.name, c.phone, c.created_at]
    );
    const customerId = custRes.lastID;
    await db.run(
      `INSERT INTO vehicles (customer_id, plate_number, brand_model, last_km, last_service_date)
       VALUES (?, ?, ?, ?, ?)`,
      [customerId, c.vehicle.plate, c.vehicle.brand_model, c.vehicle.last_km, c.vehicle.last_service_date]
    );
  }
  const sampleSales = [
    {
      inv: "INV-20260901-001",
      date: "2026-09-01 09:30:00",
      plate: "B 5543 SJD",
      km: 8400,
      total_amount: 117e3,
      total_hpp: 84e3,
      payment: "CASH",
      mechanic_id: 1,
      items: [
        { name: "Motul Scooter Expert LE 10W-30 0.8L", qty: 1, buy: 68e3, sell: 85e3, is_service: 0 },
        { name: "AHM Scooter Gear Oil 120ml", qty: 1, buy: 13e3, sell: 18e3, is_service: 0 },
        { name: "Jasa Ganti Oli Mesin & Transmisi", qty: 1, buy: 0, sell: 1e4, is_service: 1 },
        { name: "Air Radiator Coolant AHM 500ml", qty: 1, buy: 16e3, sell: 24e3, is_service: 0 }
      ]
    },
    {
      inv: "INV-20260903-002",
      date: "2026-09-03 14:15:00",
      plate: "B 3829 TKR",
      km: 18100,
      total_amount: 258e3,
      total_hpp: 187e3,
      payment: "QRIS",
      mechanic_id: 2,
      items: [
        { name: "Astra Honda Motor MPX-2 Matic 0.8L 10W-30", qty: 1, buy: 44e3, sell: 55e3, is_service: 0 },
        { name: "Vanbelt V-Belt Kit + Roller Vario 125 LED K35", qty: 1, buy: 135e3, sell: 175e3, is_service: 0 },
        { name: "Gemuk CVT Honda Grease 10gr Double Pack", qty: 1, buy: 8e3, sell: 14e3, is_service: 0 },
        { name: "Jasa Servis CVT Lengkap & Pembersihan", qty: 1, buy: 5e3, sell: 55e3, is_service: 1 }
      ]
    },
    {
      inv: "INV-20260905-003",
      date: "2026-09-05 11:20:00",
      plate: "D 4091 ZBA",
      km: 24200,
      total_amount: 174e3,
      total_hpp: 116e3,
      payment: "TRANSFER",
      mechanic_id: 3,
      items: [
        { name: "Yamalube Super Matic 1.0L 10W-40", qty: 1, buy: 62e3, sell: 76e3, is_service: 0 },
        { name: "Kampas Rem Depan Yamaha NMAX/Aerox Ori", qty: 1, buy: 54e3, sell: 72e3, is_service: 0 },
        { name: "Jasa Pasang Kampas Rem Depan / Belakang", qty: 1, buy: 0, sell: 15e3, is_service: 1 },
        { name: "Jasa Ganti Oli Mesin & Transmisi", qty: 1, buy: 0, sell: 11e3, is_service: 1 }
      ]
    },
    {
      inv: "INV-20260907-004",
      date: "2026-09-07 16:45:00",
      plate: "B 6124 KLU",
      km: 12150,
      total_amount: 141e3,
      total_hpp: 93e3,
      payment: "CASH",
      mechanic_id: 1,
      items: [
        { name: "Astra Honda Motor MPX-2 Matic 0.8L 10W-30", qty: 1, buy: 44e3, sell: 55e3, is_service: 0 },
        { name: "AHM Scooter Gear Oil 120ml", qty: 1, buy: 13e3, sell: 18e3, is_service: 0 },
        { name: "Busi NGK CPR9EA-9 Nickel", qty: 1, buy: 18e3, sell: 26e3, is_service: 0 },
        { name: "Jasa Servis Ringan / Tune-Up Injeksi", qty: 1, buy: 5e3, sell: 45e3, is_service: 1 }
      ]
    },
    {
      inv: "INV-20260908-005",
      date: "2026-09-08 10:10:00",
      plate: "B 5543 SJD",
      km: 8480,
      total_amount: 65e3,
      total_hpp: 44e3,
      payment: "QRIS",
      mechanic_id: 2,
      items: [
        { name: "Astra Honda Motor MPX-2 Matic 0.8L 10W-30", qty: 1, buy: 44e3, sell: 55e3, is_service: 0 },
        { name: "Jasa Ganti Oli Mesin & Transmisi", qty: 1, buy: 0, sell: 1e4, is_service: 1 }
      ]
    }
  ];
  for (const s of sampleSales) {
    const veh = await db.get("SELECT vehicle_id FROM vehicles WHERE plate_number = ?", [s.plate]);
    const vehId = veh ? veh.vehicle_id : null;
    const saleRes = await db.run(
      `INSERT INTO sales (invoice_number, sale_date, vehicle_id, current_km, total_amount, total_hpp, payment_method, mechanic_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.inv, s.date, vehId, s.km, s.total_amount, s.total_hpp, s.payment, s.mechanic_id]
    );
    const saleId = saleRes.lastID;
    for (const it of s.items) {
      const prod = await db.get("SELECT product_id FROM products WHERE name = ?", [it.name]);
      const prodId = prod ? prod.product_id : null;
      const subtotal = it.qty * it.sell;
      await db.run(
        `INSERT INTO sale_details (sale_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, prodId, it.name, it.qty, it.buy, it.sell, subtotal, it.is_service]
      );
    }
  }
  console.log("[SQLite] Seed finished successfully.");
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", engine: "sqlite-node", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const db = await getDb();
  console.log("[Server] SQLite database initialized successfully.");
  app.get("/api/settings/store", async (req, res) => {
    try {
      const row = await db.get("SELECT * FROM store_settings WHERE id = 1");
      if (!row) {
        return res.json({
          store_name: "BENGKEL & TOKO OLI MOTOR",
          store_address: "Jl. Raya Otomotif No. 88, Sentra Onderdil",
          store_phone: "0812-3456-7890",
          receipt_footer_1: "*** TERIMA KASIH ***",
          receipt_footer_2: "Perawatan rutin menjaga performa & keselamatan motor Anda.",
          receipt_footer_3: "Servis berikutnya: 2.000 KM / 60 Hari."
        });
      }
      res.json({
        store_name: row.store_name,
        store_address: row.store_address,
        store_phone: row.store_phone,
        receipt_footer_1: row.receipt_footer_1,
        receipt_footer_2: row.receipt_footer_2,
        receipt_footer_3: row.receipt_footer_3
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/settings/store", async (req, res) => {
    try {
      const {
        store_name,
        store_address,
        store_phone,
        receipt_footer_1,
        receipt_footer_2,
        receipt_footer_3
      } = req.body;
      const sName = (store_name || "").trim() || "BENGKEL & TOKO OLI MOTOR";
      const sAddr = (store_address || "").trim();
      const sPhone = (store_phone || "").trim();
      const f1 = receipt_footer_1 !== void 0 ? String(receipt_footer_1).trim() : "*** TERIMA KASIH ***";
      const f2 = receipt_footer_2 !== void 0 ? String(receipt_footer_2).trim() : "Perawatan rutin menjaga performa & keselamatan motor Anda.";
      const f3 = receipt_footer_3 !== void 0 ? String(receipt_footer_3).trim() : "Servis berikutnya: 2.000 KM / 60 Hari.";
      await db.run(
        `INSERT INTO store_settings (id, store_name, store_address, store_phone, receipt_footer_1, receipt_footer_2, receipt_footer_3, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           store_name = excluded.store_name,
           store_address = excluded.store_address,
           store_phone = excluded.store_phone,
           receipt_footer_1 = excluded.receipt_footer_1,
           receipt_footer_2 = excluded.receipt_footer_2,
           receipt_footer_3 = excluded.receipt_footer_3,
           updated_at = datetime('now')`,
        [sName, sAddr, sPhone, f1, f2, f3]
      );
      res.json({ success: true, message: "Pengaturan nota toko berhasil disimpan di server." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/users", async (req, res) => {
    try {
      const rows = await db.all("SELECT * FROM users ORDER BY user_id ASC");
      const users = rows.map((r) => ({
        user_id: r.user_id,
        username: r.username,
        full_name: r.full_name,
        role: r.role,
        // KEAMANAN: Jangan pernah mengekspos PIN atau password_hash ke publik!
        is_blocked: Number(r.is_blocked),
        is_active: Number(r.is_active || 0),
        active_session_id: r.active_session_id || null,
        last_activity: r.last_activity || null,
        last_login_at: r.last_login_at || null,
        permissions: typeof r.permissions === "string" ? JSON.parse(r.permissions || "{}") : r.permissions || {},
        created_at: r.created_at
      }));
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/users", async (req, res) => {
    try {
      const { username, full_name, role, pin, password, permissions } = req.body;
      if (!username || !username.trim() || !full_name || !full_name.trim()) {
        return res.status(400).json({ error: "Username dan Nama Lengkap wajib diisi" });
      }
      const existing = await db.get("SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)", [username.trim()]);
      if (existing) {
        return res.status(400).json({ error: `Username "${username}" sudah digunakan.` });
      }
      const permJson = typeof permissions === "object" ? JSON.stringify(permissions) : permissions || "{}";
      const result = await db.run(
        `INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`,
        [username.trim(), full_name.trim(), role || "kasir", pin?.trim() || "1234", password?.trim() || "123456", permJson]
      );
      const newUser = await db.get("SELECT * FROM users WHERE user_id = ?", [result.lastID]);
      res.status(201).json({
        user_id: newUser.user_id,
        username: newUser.username,
        full_name: newUser.full_name,
        role: newUser.role,
        is_blocked: newUser.is_blocked,
        is_active: 0,
        permissions: typeof newUser.permissions === "string" ? JSON.parse(newUser.permissions || "{}") : newUser.permissions || {},
        created_at: newUser.created_at
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/users/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get("SELECT * FROM users WHERE user_id = ?", [id]);
      if (!existing) {
        return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      }
      const { username, full_name, role, pin, password, permissions, is_blocked } = req.body;
      if (username && username.trim().toLowerCase() !== existing.username.toLowerCase()) {
        const conflict = await db.get("SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) AND user_id != ?", [username.trim(), id]);
        if (conflict) {
          return res.status(400).json({ error: `Username "${username}" sudah digunakan pengguna lain.` });
        }
      }
      const newUsername = username !== void 0 ? username.trim() : existing.username;
      const newFullName = full_name !== void 0 ? full_name.trim() : existing.full_name;
      const newRole = role !== void 0 ? role : existing.role;
      const newPin = pin !== void 0 && pin.trim() !== "" ? pin.trim() : existing.pin;
      const newPass = password !== void 0 && password.trim() !== "" ? password.trim() : existing.password_hash;
      const newBlocked = is_blocked !== void 0 ? is_blocked ? 1 : 0 : existing.is_blocked;
      const newPerms = permissions !== void 0 ? typeof permissions === "object" ? JSON.stringify(permissions) : permissions : existing.permissions;
      await db.run(
        `UPDATE users SET
           username = ?,
           full_name = ?,
           role = ?,
           pin = ?,
           password_hash = ?,
           permissions = ?,
           is_blocked = ?,
           updated_at = datetime('now')
         WHERE user_id = ?`,
        [newUsername, newFullName, newRole, newPin, newPass, newPerms, newBlocked, id]
      );
      const updated = await db.get("SELECT * FROM users WHERE user_id = ?", [id]);
      res.json({
        user_id: updated.user_id,
        username: updated.username,
        full_name: updated.full_name,
        role: updated.role,
        is_blocked: updated.is_blocked,
        is_active: updated.is_active,
        permissions: typeof updated.permissions === "string" ? JSON.parse(updated.permissions || "{}") : updated.permissions || {},
        updated_at: updated.updated_at
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (id === 1) {
        return res.status(400).json({ error: "Akun Super Admin (Owner) utama tidak dapat dihapus!" });
      }
      const existing = await db.get("SELECT user_id FROM users WHERE user_id = ?", [id]);
      if (!existing) {
        return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      }
      await db.run("DELETE FROM users WHERE user_id = ?", [id]);
      res.json({ success: true, message: "Pengguna berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/users/session", async (req, res) => {
    try {
      const { action, user_id, session_id, force, login_type, pin, username, password } = req.body;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      if (action === "login") {
        let user = null;
        if (login_type === "pin" && user_id) {
          user = await db.get("SELECT * FROM users WHERE user_id = ?", [user_id]);
          if (!user) return res.status(404).json({ status: "error", message: "Pengguna tidak ditemukan" });
          if (user.pin.trim() !== String(pin || "").trim()) {
            return res.status(401).json({ status: "error", message: "PIN yang Anda masukkan salah!" });
          }
        } else if (username) {
          user = await db.get("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [String(username).trim()]);
          if (!user) return res.status(404).json({ status: "error", message: "Username tidak ditemukan" });
          const cleanP = String(password || "").trim();
          if (user.password_hash !== cleanP && user.pin !== cleanP) {
            return res.status(401).json({ status: "error", message: "Password atau PIN salah!" });
          }
        } else {
          return res.status(400).json({ status: "error", message: "Parameter login tidak lengkap" });
        }
        if (user.is_blocked === 1) {
          return res.status(403).json({ status: "error", message: "Akun ini sedang diblokir oleh Owner." });
        }
        const isActive = user.is_active === 1;
        const hasSession = !!user.active_session_id;
        let isTimeout = true;
        if (user.last_activity) {
          const lastTime = new Date(user.last_activity).getTime();
          const diffSec = (Date.now() - lastTime) / 1e3;
          if (diffSec < 300) {
            isTimeout = false;
          }
        }
        if (isActive && hasSession && !isTimeout && !force) {
          return res.json({
            status: "session_locked",
            message: `Akun "${user.full_name}" sedang aktif pada perangkat lain.`,
            active_device: user.last_device || "Terminal Kasir Lain",
            last_activity_time: user.last_activity || "Baru saja",
            can_force_unlock: true
          });
        }
        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await db.run(
          `UPDATE users SET
             is_active = 1,
             active_session_id = ?,
             last_activity = datetime('now'),
             last_login_at = datetime('now'),
             last_device = ?
           WHERE user_id = ?`,
          [newSessionId, req.headers["user-agent"]?.slice(0, 50) || "Browser Terminal", user.user_id]
        );
        const perms = typeof user.permissions === "string" ? JSON.parse(user.permissions || "{}") : user.permissions || {};
        return res.json({
          status: "success",
          message: `Selamat datang, ${user.full_name}!`,
          session_id: newSessionId,
          user: {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            is_blocked: user.is_blocked,
            is_active: 1,
            active_session_id: newSessionId,
            permissions: perms,
            created_at: user.created_at,
            last_login_at: nowIso
          }
        });
      }
      if (action === "heartbeat") {
        if (!user_id || !session_id) {
          return res.json({ status: "invalid_params" });
        }
        const user = await db.get("SELECT user_id, active_session_id, is_blocked, is_active FROM users WHERE user_id = ?", [user_id]);
        if (!user || user.is_blocked === 1) {
          return res.json({ status: "blocked", message: "Akun telah dinonaktifkan." });
        }
        if (user.active_session_id !== session_id) {
          return res.json({ status: "kicked", message: "Akun telah login di perangkat lain." });
        }
        await db.run("UPDATE users SET last_activity = datetime('now') WHERE user_id = ?", [user_id]);
        return res.json({ status: "ok" });
      }
      if (action === "logout") {
        if (user_id) {
          await db.run("UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = ?", [user_id]);
        } else if (session_id) {
          await db.run("UPDATE users SET is_active = 0, active_session_id = NULL WHERE active_session_id = ?", [session_id]);
        }
        return res.json({ status: "success", message: "Logout berhasil" });
      }
      if (action === "force_unlock") {
        const targetId = req.body.target_user_id || user_id;
        if (targetId) {
          await db.run("UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = ?", [targetId]);
        }
        return res.json({ status: "success", message: "Kunci sesi berhasil dibebaskan" });
      }
      return res.status(400).json({ error: "Aksi sesi tidak dikenal" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/categories", async (req, res) => {
    try {
      const rows = await db.all("SELECT * FROM categories ORDER BY name ASC");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/categories", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nama kategori wajib diisi" });
      }
      const result = await db.run("INSERT INTO categories (name) VALUES (?)", [name.trim()]);
      res.status(201).json({ category_id: result.lastID, name: name.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nama kategori wajib diisi" });
      }
      await db.run("UPDATE categories SET name = ? WHERE category_id = ?", [name.trim(), id]);
      res.json({ message: "Kategori berhasil diperbarui", category_id: Number(id), name: name.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const count = await db.get(
        "SELECT COUNT(*) as count FROM products WHERE category_id = ?",
        [id]
      );
      if (count && count.count > 0) {
        return res.status(400).json({
          error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${count.count} produk. Hapus atau pindahkan produk terkait terlebih dahulu.`
        });
      }
      await db.run("DELETE FROM categories WHERE category_id = ?", [id]);
      res.json({ message: "Kategori berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/products", async (req, res) => {
    try {
      const { search, category_id, low_stock } = req.query;
      let sql = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.compatibility LIKE ?)`;
        const q = `%${search}%`;
        params.push(q, q, q);
      }
      if (category_id) {
        sql += ` AND p.category_id = ?`;
        params.push(Number(category_id));
      }
      if (low_stock === "true") {
        sql += ` AND p.stock <= p.min_stock`;
      }
      sql += ` ORDER BY p.name ASC`;
      const rows = await db.all(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/products", async (req, res) => {
    try {
      const { sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility, image_url } = req.body;
      if (!sku || !name) {
        return res.status(400).json({ error: "SKU dan Nama produk wajib diisi" });
      }
      const result = await db.run(
        `INSERT INTO products (sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sku.trim(),
          name.trim(),
          category_id ? Number(category_id) : null,
          Number(buy_price) || 0,
          Number(sell_price) || 0,
          Number(stock) || 0,
          Number(min_stock) || 5,
          compatibility ? compatibility.trim() : "",
          image_url ? String(image_url).trim() : null
        ]
      );
      res.status(201).json({ product_id: result.lastID, message: "Produk berhasil ditambahkan" });
    } catch (err) {
      if (err.message.includes("UNIQUE constraint failed: products.sku")) {
        return res.status(400).json({ error: "SKU produk sudah terdaftar, gunakan kode lain" });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility, image_url } = req.body;
      await db.run(
        `UPDATE products
         SET sku = ?, name = ?, category_id = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, compatibility = ?, image_url = ?
         WHERE product_id = ?`,
        [
          sku.trim(),
          name.trim(),
          category_id ? Number(category_id) : null,
          Number(buy_price) || 0,
          Number(sell_price) || 0,
          Number(stock) || 0,
          Number(min_stock) || 0,
          compatibility ? compatibility.trim() : "",
          image_url !== void 0 ? image_url ? String(image_url).trim() : null : null,
          id
        ]
      );
      res.json({ message: "Produk berhasil diperbarui" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const count = await db.get(
        "SELECT COUNT(*) as count FROM sale_details WHERE product_id = ?",
        [id]
      );
      if (count && count.count > 0) {
        return res.status(400).json({
          error: "Produk tidak dapat dihapus karena sudah memiliki riwayat transaksi penjualan."
        });
      }
      await db.run("DELETE FROM products WHERE product_id = ?", [id]);
      res.json({ message: "Produk berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/products/:id/adjust-stock", async (req, res) => {
    try {
      const { id } = req.params;
      const { adjustment, new_stock } = req.body;
      if (new_stock !== void 0) {
        await db.run("UPDATE products SET stock = ? WHERE product_id = ?", [Number(new_stock), id]);
      } else if (adjustment !== void 0) {
        await db.run("UPDATE products SET stock = stock + ? WHERE product_id = ?", [Number(adjustment), id]);
      }
      const updated = await db.get("SELECT * FROM products WHERE product_id = ?", [id]);
      res.json({ message: "Stok berhasil diperbarui", product: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/customers", async (req, res) => {
    try {
      const rows = await db.all(`
        SELECT c.*, COUNT(v.vehicle_id) as vehicle_count
        FROM customers c
        LEFT JOIN vehicles v ON c.customer_id = v.customer_id
        GROUP BY c.customer_id
        ORDER BY c.name ASC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/customers", async (req, res) => {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ error: "Nama dan nomor telepon pelanggan wajib diisi" });
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const result = await db.run(
        "INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)",
        [name.trim(), phone.trim(), today]
      );
      res.status(201).json({ customer_id: result.lastID, name, phone });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      await db.run("UPDATE customers SET name = ?, phone = ? WHERE customer_id = ?", [
        name.trim(),
        phone.trim(),
        id
      ]);
      res.json({ message: "Pelanggan berhasil diperbarui" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/vehicles", async (req, res) => {
    try {
      const { search } = req.query;
      let sql = `
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v
        JOIN customers c ON v.customer_id = c.customer_id
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        sql += ` AND (v.plate_number LIKE ? OR v.brand_model LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
        const q = `%${search}%`;
        params.push(q, q, q, q);
      }
      sql += ` ORDER BY v.plate_number ASC`;
      const rows = await db.all(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/vehicles", async (req, res) => {
    try {
      const { customer_id, plate_number, brand_model, last_km, last_service_date } = req.body;
      if (!customer_id || !plate_number || !brand_model) {
        return res.status(400).json({ error: "Pelanggan, Plat Nomor, dan Tipe Motor wajib diisi" });
      }
      const cleanPlate = plate_number.trim().toUpperCase();
      const result = await db.run(
        `INSERT INTO vehicles (customer_id, plate_number, brand_model, last_km, last_service_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          Number(customer_id),
          cleanPlate,
          brand_model.trim(),
          Number(last_km) || 0,
          last_service_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
        ]
      );
      res.status(201).json({ vehicle_id: result.lastID, message: "Kendaraan berhasil ditambahkan" });
    } catch (err) {
      if (err.message.includes("UNIQUE constraint failed: vehicles.plate_number")) {
        return res.status(400).json({ error: "Plat nomor motor sudah terdaftar di sistem" });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/vehicles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_id, plate_number, brand_model, last_km, last_service_date } = req.body;
      await db.run(
        `UPDATE vehicles
         SET customer_id = ?, plate_number = ?, brand_model = ?, last_km = ?, last_service_date = ?
         WHERE vehicle_id = ?`,
        [
          Number(customer_id),
          plate_number.trim().toUpperCase(),
          brand_model.trim(),
          Number(last_km) || 0,
          last_service_date,
          id
        ]
      );
      res.json({ message: "Data kendaraan berhasil diperbarui" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/mechanics", async (req, res) => {
    try {
      const rows = await db.all("SELECT * FROM mechanics ORDER BY name ASC");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/mechanics", async (req, res) => {
    try {
      const { name, phone } = req.body;
      if (!name) return res.status(400).json({ error: "Nama mekanik wajib diisi" });
      const result = await db.run("INSERT INTO mechanics (name, phone) VALUES (?, ?)", [
        name.trim(),
        phone ? phone.trim() : ""
      ]);
      res.status(201).json({ mechanic_id: result.lastID, name, phone });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/mechanics/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      await db.run("UPDATE mechanics SET name = ?, phone = ? WHERE mechanic_id = ?", [
        name.trim(),
        phone ? phone.trim() : "",
        id
      ]);
      res.json({ message: "Data mekanik berhasil diperbarui" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/mechanics/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.run("DELETE FROM mechanics WHERE mechanic_id = ?", [id]);
      res.json({ message: "Mekanik berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/checkout", async (req, res) => {
    const { vehicle_id, current_km, payment_method, mechanic_id, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Keranjang belanja tidak boleh kosong" });
    }
    if (!payment_method) {
      return res.status(400).json({ error: "Metode pembayaran wajib dipilih" });
    }
    await db.exec("BEGIN TRANSACTION;");
    try {
      for (const item of items) {
        if (!item.is_service && item.product_id) {
          const product = await db.get(
            "SELECT stock, name FROM products WHERE product_id = ?",
            [item.product_id]
          );
          if (!product) {
            throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan`);
          }
          if (product.stock < item.quantity) {
            throw new Error(
              `Stok barang "${product.name}" tidak mencukupi! Tersedia: ${product.stock}, Diminta: ${item.quantity}`
            );
          }
        }
      }
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T.]/g, "").slice(0, 8);
      const countRes = await db.get(
        `SELECT COUNT(*) as count FROM sales WHERE invoice_number LIKE ?`,
        [`INV-${todayStr}-%`]
      );
      const sequence = String((countRes?.count || 0) + 1).padStart(3, "0");
      const invoiceNumber = `INV-${todayStr}-${sequence}`;
      let totalAmount = 0;
      let totalHpp = 0;
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const sellPrice = Number(item.sell_price) || 0;
        const buyPrice = Number(item.buy_price) || 0;
        totalAmount += qty * sellPrice;
        totalHpp += qty * buyPrice;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
      const saleResult = await db.run(
        `INSERT INTO sales (invoice_number, sale_date, vehicle_id, current_km, total_amount, total_hpp, payment_method, mechanic_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber,
          nowIso,
          vehicle_id ? Number(vehicle_id) : null,
          current_km ? Number(current_km) : null,
          totalAmount,
          totalHpp,
          payment_method,
          mechanic_id ? Number(mechanic_id) : null
        ]
      );
      const saleId = saleResult.lastID;
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const buyPrice = Number(item.buy_price) || 0;
        const sellPrice = Number(item.sell_price) || 0;
        const subtotal = qty * sellPrice;
        const isService = item.is_service ? 1 : 0;
        await db.run(
          `INSERT INTO sale_details (sale_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            item.product_id ? Number(item.product_id) : null,
            item.item_name || "Item",
            qty,
            buyPrice,
            sellPrice,
            subtotal,
            isService
          ]
        );
        if (!isService && item.product_id) {
          await db.run(
            `UPDATE products SET stock = stock - ? WHERE product_id = ?`,
            [qty, item.product_id]
          );
        }
      }
      if (vehicle_id) {
        const todayDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        if (current_km) {
          await db.run(
            `UPDATE vehicles
             SET last_km = ?, last_service_date = ?
             WHERE vehicle_id = ?`,
            [Number(current_km), todayDate, vehicle_id]
          );
        } else {
          await db.run(
            `UPDATE vehicles
             SET last_service_date = ?
             WHERE vehicle_id = ?`,
            [todayDate, vehicle_id]
          );
        }
      }
      await db.exec("COMMIT;");
      const saleRecord = await db.get(
        `SELECT s.*, v.plate_number, v.brand_model, m.name as mechanic_name
         FROM sales s
         LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
         LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
         WHERE s.sale_id = ?`,
        [saleId]
      );
      const saleDetails = await db.all(
        "SELECT * FROM sale_details WHERE sale_id = ?",
        [saleId]
      );
      res.status(201).json({
        success: true,
        message: "Transaksi berhasil disimpan secara atomic!",
        sale: saleRecord,
        details: saleDetails
      });
    } catch (err) {
      console.error("[Checkout Error - Rollback triggered]:", err.message);
      await db.exec("ROLLBACK;");
      res.status(400).json({ error: err.message || "Gagal memproses transaksi kasir" });
    }
  });
  app.get("/api/sales", async (req, res) => {
    try {
      const { limit = 100, search, start_date, end_date } = req.query;
      let sql = `
        SELECT s.*, v.plate_number, v.brand_model, c.name as customer_name, m.name as mechanic_name
        FROM sales s
        LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
        LEFT JOIN customers c ON v.customer_id = c.customer_id
        LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        sql += ` AND (s.invoice_number LIKE ? OR v.plate_number LIKE ? OR c.name LIKE ?)`;
        const q = `%${search}%`;
        params.push(q, q, q);
      }
      if (start_date) {
        sql += ` AND date(s.sale_date) >= date(?)`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(s.sale_date) <= date(?)`;
        params.push(end_date);
      }
      sql += ` ORDER BY s.sale_id DESC LIMIT ?`;
      params.push(Number(limit));
      const rows = await db.all(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/sales/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sale = await db.get(
        `SELECT s.*, v.plate_number, v.brand_model, c.name as customer_name, c.phone as customer_phone, m.name as mechanic_name
         FROM sales s
         LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
         LEFT JOIN customers c ON v.customer_id = c.customer_id
         LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
         WHERE s.sale_id = ?`,
        [id]
      );
      if (!sale) return res.status(404).json({ error: "Nota tidak ditemukan" });
      const details = await db.all(
        "SELECT * FROM sale_details WHERE sale_id = ?",
        [id]
      );
      res.json({ sale, details });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/crm/reminders", async (req, res) => {
    try {
      const vehicles = await db.all(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v
        JOIN customers c ON v.customer_id = c.customer_id
        ORDER BY v.last_service_date ASC
      `);
      const today = /* @__PURE__ */ new Date();
      const reminders = vehicles.map((v) => {
        let daysSinceService = 999;
        if (v.last_service_date) {
          const sDate = new Date(v.last_service_date);
          const diffMs = today.getTime() - sDate.getTime();
          daysSinceService = Math.max(0, Math.floor(diffMs / (1e3 * 60 * 60 * 24)));
        }
        const estimatedKmIncrease = Math.round(daysSinceService * 35);
        const estimatedCurrentKm = v.last_km + estimatedKmIncrease;
        const isOverdueDays = daysSinceService >= 60;
        const isOverdueKm = estimatedKmIncrease >= 2e3;
        const isDue = isOverdueDays || isOverdueKm;
        let status = "GOOD";
        if (daysSinceService >= 60 || estimatedKmIncrease >= 2e3) {
          status = "OVERDUE";
        } else if (daysSinceService >= 45 || estimatedKmIncrease >= 1500) {
          status = "DUE_SOON";
        }
        const waMsg = `Halo Kak ${v.customer_name}, kami dari Bengkel & Toko Sparepart Motor. Mengingatkan bahwa motor ${v.brand_model} (${v.plate_number}) sudah saatnya servis berkala / ganti oli.

\u{1F4CC} Terakhir Servis: ${v.last_service_date || "-"}
\u{1F4CC} KM Terakhir: ${v.last_km.toLocaleString("id-ID")} KM
\u{1F4CC} Estimasi KM Saat Ini: ~${estimatedCurrentKm.toLocaleString("id-ID")} KM (+${estimatedKmIncrease.toLocaleString("id-ID")} KM)
\u{1F4CC} Waktu Berlalu: ${daysSinceService} hari yang lalu

Jadwalkan servis Anda sekarang untuk menjaga performa mesin tetap prima! Hubungi kami untuk reservasi atau langsung datang ke bengkel. Terima kasih! \u{1F64F}`;
        let cleanPhone = (v.customer_phone || "").replace(/[^0-9]/g, "");
        if (cleanPhone.startsWith("0")) {
          cleanPhone = "62" + cleanPhone.slice(1);
        }
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;
        return {
          vehicle_id: v.vehicle_id,
          customer_id: v.customer_id,
          customer_name: v.customer_name,
          customer_phone: v.customer_phone,
          plate_number: v.plate_number,
          brand_model: v.brand_model,
          last_km: v.last_km,
          last_service_date: v.last_service_date,
          days_since_service: daysSinceService,
          estimated_km_increase: estimatedKmIncrease,
          estimated_current_km: estimatedCurrentKm,
          is_overdue_days: isOverdueDays,
          is_overdue_km: isOverdueKm,
          is_due: isDue,
          status,
          wa_message: waMsg,
          wa_url: waUrl
        };
      });
      res.json(reminders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/reports/profit-loss", async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      let sqlSales = `SELECT * FROM sales WHERE 1=1`;
      const params = [];
      if (start_date) {
        sqlSales += ` AND date(sale_date) >= date(?)`;
        params.push(start_date);
      }
      if (end_date) {
        sqlSales += ` AND date(sale_date) <= date(?)`;
        params.push(end_date);
      }
      const salesList = await db.all(sqlSales, params);
      let totalOmzet = 0;
      let totalHpp = 0;
      salesList.forEach((s) => {
        totalOmzet += s.total_amount;
        totalHpp += s.total_hpp;
      });
      const grossProfit = totalOmzet - totalHpp;
      const profitMarginPct = totalOmzet > 0 ? grossProfit / totalOmzet * 100 : 0;
      let sqlDetails = `
        SELECT sd.is_service,
               SUM(sd.subtotal) as total_omzet,
               SUM(sd.buy_price * sd.quantity) as total_hpp,
               SUM(sd.quantity) as total_qty
        FROM sale_details sd
        JOIN sales s ON sd.sale_id = s.sale_id
        WHERE 1=1
      `;
      const detailParams = [];
      if (start_date) {
        sqlDetails += ` AND date(s.sale_date) >= date(?)`;
        detailParams.push(start_date);
      }
      if (end_date) {
        sqlDetails += ` AND date(s.sale_date) <= date(?)`;
        detailParams.push(end_date);
      }
      sqlDetails += ` GROUP BY sd.is_service`;
      const breakdownRows = await db.all(sqlDetails, detailParams);
      const goodsRow = breakdownRows.find((r) => r.is_service === 0) || { total_omzet: 0, total_hpp: 0, total_qty: 0 };
      const serviceRow = breakdownRows.find((r) => r.is_service === 1) || { total_omzet: 0, total_hpp: 0, total_qty: 0 };
      res.json({
        total_transactions: salesList.length,
        total_omzet: totalOmzet,
        total_hpp: totalHpp,
        gross_profit: grossProfit,
        profit_margin_pct: Number(profitMarginPct.toFixed(2)),
        goods: {
          omzet: goodsRow.total_omzet || 0,
          hpp: goodsRow.total_hpp || 0,
          profit: (goodsRow.total_omzet || 0) - (goodsRow.total_hpp || 0),
          qty: goodsRow.total_qty || 0
        },
        services: {
          omzet: serviceRow.total_omzet || 0,
          hpp: serviceRow.total_hpp || 0,
          profit: (serviceRow.total_omzet || 0) - (serviceRow.total_hpp || 0),
          qty: serviceRow.total_qty || 0
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/reports/movement", async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
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
      const params = [];
      if (start_date) {
        sql += ` AND date(s.sale_date) >= date(?)`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(s.sale_date) <= date(?)`;
        params.push(end_date);
      }
      sql += ` GROUP BY sd.item_name ORDER BY total_sold_qty DESC`;
      const rows = await db.all(sql, params);
      const allProducts = await db.all(`
        SELECT p.product_id, p.sku, p.name as item_name, c.name as category_name, p.stock as current_stock, p.min_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
      `);
      const soldItemNames = new Set(rows.map((r) => r.item_name));
      const zeroSalesProducts = allProducts.filter((p) => !soldItemNames.has(p.item_name)).map((p) => ({
        product_id: p.product_id,
        sku: p.sku,
        item_name: p.item_name,
        category_name: p.category_name || "Uncategorized",
        current_stock: p.current_stock,
        min_stock: p.min_stock,
        is_service: 0,
        total_sold_qty: 0,
        total_revenue: 0,
        total_profit: 0,
        movement_class: "SLOW_OR_ZERO"
      }));
      const enrichedRows = rows.map((r) => {
        let movementClass = "SLOW";
        if (r.total_sold_qty >= 3) {
          movementClass = "FAST";
        } else if (r.total_sold_qty >= 1) {
          movementClass = "NORMAL";
        }
        return {
          ...r,
          movement_class: movementClass
        };
      });
      res.json({
        items: [...enrichedRows, ...zeroSalesProducts],
        fast_moving: enrichedRows.filter((r) => r.movement_class === "FAST"),
        slow_moving: [...enrichedRows.filter((r) => r.movement_class === "SLOW"), ...zeroSalesProducts]
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/reports/recap", async (req, res) => {
    try {
      const dailyRows = await db.all(`
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
      `);
      const monthlyRows = await db.all(`
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
      `);
      const paymentRows = await db.all(`
        SELECT
          payment_method,
          COUNT(sale_id) as count,
          SUM(total_amount) as total_amount
        FROM sales
        GROUP BY payment_method
      `);
      res.json({
        daily: dailyRows,
        monthly: monthlyRows,
        payment_methods: paymentRows
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/sync/status", async (req, res) => {
    try {
      const unsyncedRow = await db.get(
        "SELECT COUNT(*) as count FROM sales WHERE is_synced = 0"
      );
      const totalRow = await db.get("SELECT COUNT(*) as count FROM sales");
      const lastSyncedRow = await db.get(
        "SELECT MAX(synced_at) as last_synced_at FROM sales WHERE is_synced = 1"
      );
      res.json({
        unsynced_count: unsyncedRow?.count || 0,
        total_sales: totalRow?.count || 0,
        last_synced_at: lastSyncedRow?.last_synced_at || null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/sync/unsynced", async (req, res) => {
    try {
      const sales = await db.all(`
        SELECT
          s.sale_id,
          s.invoice_number,
          s.sale_date,
          s.current_km,
          s.total_amount,
          s.total_hpp,
          s.payment_method,
          s.is_synced,
          s.synced_at,
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
        ORDER BY s.sale_id ASC
      `);
      const fullSales = await Promise.all(
        sales.map(async (sale) => {
          const items = await db.all(
            `SELECT * FROM sale_details WHERE sale_id = ? ORDER BY detail_id ASC`,
            [sale.sale_id]
          );
          return {
            ...sale,
            items
          };
        })
      );
      res.json(fullSales);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/sync/mark-synced", async (req, res) => {
    try {
      const { sale_ids } = req.body;
      if (!sale_ids || !Array.isArray(sale_ids) || sale_ids.length === 0) {
        return res.status(400).json({ error: "Daftar sale_ids wajib disertakan" });
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
      for (const id of sale_ids) {
        await db.run(
          `UPDATE sales SET is_synced = 1, synced_at = ? WHERE sale_id = ?`,
          [nowIso, Number(id)]
        );
      }
      res.json({
        success: true,
        message: `${sale_ids.length} transaksi berhasil ditandai tersinkron`,
        synced_at: nowIso
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/sync/push", async (req, res) => {
    try {
      const {
        api_url = "https://larizk.com/api/sync_report-api.php",
        api_key = "LARIZK_BENGKEL_2026",
        device_id = "TABLET-KASIR-01",
        force_all = false
      } = req.body;
      let sql = `
        SELECT
          s.sale_id,
          s.invoice_number,
          s.sale_date,
          s.current_km,
          s.total_amount,
          s.total_hpp,
          s.payment_method,
          v.plate_number,
          v.brand_model,
          c.name as customer_name,
          c.phone as customer_phone,
          m.name as mechanic_name
        FROM sales s
        LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
        LEFT JOIN customers c ON v.customer_id = c.customer_id
        LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
      `;
      if (!force_all) {
        sql += ` WHERE s.is_synced = 0`;
      }
      sql += ` ORDER BY s.sale_id ASC`;
      const sales = await db.all(sql);
      if (sales.length === 0) {
        return res.json({
          success: true,
          synced_count: 0,
          message: "Belum ada data transaksi kasir di database lokal."
        });
      }
      const fullSales = await Promise.all(
        sales.map(async (sale) => {
          const items = await db.all(
            `SELECT detail_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service
             FROM sale_details WHERE sale_id = ?`,
            [sale.sale_id]
          );
          return {
            ...sale,
            items
          };
        })
      );
      const payload = {
        api_key,
        device_id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        total_records: fullSales.length,
        transactions: fullSales
      };
      let serverResponseText = "";
      let serverJson = null;
      try {
        const response = await fetch(api_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "MotoPOS-Tablet/1.0"
          },
          body: JSON.stringify(payload)
        });
        serverResponseText = await response.text();
        try {
          serverJson = JSON.parse(serverResponseText);
        } catch {
          serverJson = { raw: serverResponseText };
        }
        if (!response.ok) {
          throw new Error(
            `Server merespons status ${response.status}: ${serverResponseText.slice(0, 150)}`
          );
        }
      } catch (fetchErr) {
        return res.status(502).json({
          error: `Gagal menghubungi server sync (${api_url}): ${fetchErr.message}`,
          payload_preview: payload
        });
      }
      const syncedSaleIds = fullSales.map((s) => s.sale_id);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
      for (const id of syncedSaleIds) {
        await db.run(
          `UPDATE sales SET is_synced = 1, synced_at = ? WHERE sale_id = ?`,
          [nowIso, id]
        );
      }
      res.json({
        success: true,
        synced_count: syncedSaleIds.length,
        message: `Sukses menyinkronkan ${syncedSaleIds.length} transaksi ke server cloud.`,
        server_response: serverJson
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MotoPOS Server] Running at http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("[MotoPOS Server Failed to Start]:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
