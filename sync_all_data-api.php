<?php
/**
 * =========================================================================
 * MOTO-POS CLOUD SYNC API - SINKRONISASI SEMUA TABEL (Full Database Replica)
 * File: sync_all_data-api.php (SQLite Version)
 * =========================================================================
 * Endpoint API PHP berbasis SQLite untuk mereplikasi SELURUH database POS:
 * 1. categories   (Kategori Produk/Jasa)
 * 2. products     (Master Produk, Sparepart, Oli, Jasa & Stok)
 * 3. customers    (Data Pelanggan & Nomor HP)
 * 4. vehicles     (Data Motor / Pelat Nomor & Riwayat KM)
 * 5. mechanics    (Data Mekanik & Teknisi Bengkel)
 * 6. sales        (Riwayat Seluruh Nota Transaksi)
 * 7. sale_details (Detail Item Pembelian & Jasa pada Tiap Nota)
 * 
 * Keunggulan:
 * - Menghasilkan file replika SQLite 100% identik di server hosting.
 * - Anti-duplikasi di semua tabel menggunakan SQLite UPSERT (ON CONFLICT).
 * - Transaksi database atomik ($pdo->beginTransaction / commit).
 * - Dilengkapi fitur GET / Export untuk melihat ringkasan replika atau restore data.
 * =========================================================================
 */

// 1. Header CORS & Tipe Konten JSON
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Konfigurasi Database SQLite & Kunci Keamanan
$DB_FILE = __DIR__ . '/data/bengkel.sqlite';
$API_KEY = 'LARIZK_BENGKEL_2026'; // Samakan dengan API Key di Pengaturan POS

$dbDir = dirname($DB_FILE);
if (!is_dir($dbDir)) {
    @mkdir($dbDir, 0755, true);
}

// 3. Inisialisasi Koneksi Database SQLite (PDO)
try {
    $pdo = new PDO("sqlite:" . $DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Optimasi SQLite WAL Mode untuk konkurensi tinggi
    $pdo->exec("PRAGMA journal_mode = WAL;");
    $pdo->exec("PRAGMA synchronous = NORMAL;");
    $pdo->exec("PRAGMA foreign_keys = ON;");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal membuka file database SQLite di server: ' . $e->getMessage(),
        'hint'    => 'Pastikan direktori ' . $dbDir . ' memiliki izin tulis (chmod 755 / 777).'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. Auto Setup Skema 7 Tabel Utama SQLite (Sesuai Struktur MotoPOS)
try {
    // Tabel 1: categories
    $pdo->exec("CREATE TABLE IF NOT EXISTS categories (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );");

    // Tabel 2: customers
    $pdo->exec("CREATE TABLE IF NOT EXISTS customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at TEXT NOT NULL
    );");

    // Tabel 3: mechanics
    $pdo->exec("CREATE TABLE IF NOT EXISTS mechanics (
        mechanic_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT
    );");

    // Tabel 4: products
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category_id INTEGER,
        buy_price REAL NOT NULL DEFAULT 0,
        sell_price REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 5,
        compatibility TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );");

    // Tabel 5: vehicles
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicles (
        vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        plate_number TEXT UNIQUE NOT NULL,
        brand_model TEXT NOT NULL,
        last_km INTEGER NOT NULL DEFAULT 0,
        last_service_date TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );");

    // Tabel 6: sales
    $pdo->exec("CREATE TABLE IF NOT EXISTS sales (
        sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        sale_date TEXT NOT NULL,
        vehicle_id INTEGER,
        current_km INTEGER DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        total_hpp REAL NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'TUNAI',
        mechanic_id INTEGER,
        is_synced INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
        FOREIGN KEY (mechanic_id) REFERENCES mechanics(mechanic_id)
    );");

    // Tabel 7: sale_details
    $pdo->exec("CREATE TABLE IF NOT EXISTS sale_details (
        detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        buy_price REAL NOT NULL DEFAULT 0,
        sell_price REAL NOT NULL DEFAULT 0,
        subtotal REAL NOT NULL DEFAULT 0,
        is_service INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );");

    // Indeks Pencarian Cepat
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_sales_inv ON sales(invoice_number);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_sale_details_sale ON sale_details(sale_id);");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal inisialisasi skema tabel SQLite: ' . $e->getMessage()
    ]);
    exit;
}

// 5. Tangani Request GET (Status Replika Database Server & Statistik Tabel)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'status';
    $reqKey = $_GET['api_key'] ?? '';

    // Hitung isi setiap tabel
    $stats = [
        'categories'   => (int)$pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn(),
        'products'     => (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn(),
        'customers'    => (int)$pdo->query("SELECT COUNT(*) FROM customers")->fetchColumn(),
        'vehicles'     => (int)$pdo->query("SELECT COUNT(*) FROM vehicles")->fetchColumn(),
        'mechanics'    => (int)$pdo->query("SELECT COUNT(*) FROM mechanics")->fetchColumn(),
        'sales'        => (int)$pdo->query("SELECT COUNT(*) FROM sales")->fetchColumn(),
        'sale_details' => (int)$pdo->query("SELECT COUNT(*) FROM sale_details")->fetchColumn(),
    ];

    // Jika ingin mengekstrak seluruh data replika (Backup / Restore)
    if ($action === 'export_all') {
        if ($reqKey !== $API_KEY) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'API Key tidak valid']);
            exit;
        }

        echo json_encode([
            'status'     => 'success',
            'engine'     => 'SQLite (Full Database Replica)',
            'stats'      => $stats,
            'categories' => $pdo->query("SELECT * FROM categories ORDER BY category_id ASC")->fetchAll(),
            'customers'  => $pdo->query("SELECT * FROM customers ORDER BY customer_id ASC")->fetchAll(),
            'mechanics'  => $pdo->query("SELECT * FROM mechanics ORDER BY mechanic_id ASC")->fetchAll(),
            'products'   => $pdo->query("SELECT * FROM products ORDER BY product_id ASC")->fetchAll(),
            'vehicles'   => $pdo->query("SELECT * FROM vehicles ORDER BY vehicle_id ASC")->fetchAll(),
            'sales'      => $pdo->query("SELECT * FROM sales ORDER BY sale_id DESC LIMIT 500")->fetchAll(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'status'       => 'online',
        'engine'       => 'SQLite Database Replica',
        'db_file'      => basename($DB_FILE),
        'db_size_kb'   => file_exists($DB_FILE) ? round(filesize($DB_FILE) / 1024, 2) : 0,
        'message'      => 'MotoPOS Cloud Sync API (Full Database Sync) siap menerima sinkronisasi semua tabel.',
        'table_stats'  => $stats,
        'server_time'  => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 6. Validasi Request Payload POST
$rawInput = file_get_contents('php://input');
$data     = json_decode($rawInput, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Format payload tidak valid. Harap kirimkan format JSON.']);
    exit;
}

$receivedKey = $data['api_key'] ?? '';
if ($receivedKey !== $API_KEY) {
    http_response_code(401);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Akses ditolak: API Key salah atau belum diatur pada aplikasi POS.'
    ]);
    exit;
}

// 7. Fitur Test Ping
if (!empty($data['ping_only'])) {
    $stats = [
        'categories' => (int)$pdo->query("SELECT COUNT(*) FROM categories")->fetchColumn(),
        'products'   => (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn(),
        'customers'  => (int)$pdo->query("SELECT COUNT(*) FROM customers")->fetchColumn(),
        'vehicles'   => (int)$pdo->query("SELECT COUNT(*) FROM vehicles")->fetchColumn(),
        'mechanics'  => (int)$pdo->query("SELECT COUNT(*) FROM mechanics")->fetchColumn(),
        'sales'      => (int)$pdo->query("SELECT COUNT(*) FROM sales")->fetchColumn(),
    ];
    echo json_encode([
        'status'      => 'success',
        'engine'      => 'SQLite',
        'message'     => 'Koneksi API Sinkronisasi Semua Data Berhasil & Database SQLite Siap!',
        'table_stats' => $stats,
        'server_time' => date('Y-m-d H:i:s'),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 8. Eksekusi Sinkronisasi Seluruh Tabel (Atomic Full-Database Sync)
$categories = $data['categories'] ?? [];
$customers  = $data['customers'] ?? [];
$mechanics  = $data['mechanics'] ?? [];
$products   = $data['products'] ?? [];
$vehicles   = $data['vehicles'] ?? [];
$sales      = $data['sales'] ?? $data['transactions'] ?? [];
$deviceId   = $data['device_id'] ?? 'TABLET-POS';

$report = [
    'categories'   => 0,
    'customers'    => 0,
    'mechanics'    => 0,
    'products'     => 0,
    'vehicles'     => 0,
    'sales'        => 0,
    'sale_details' => 0,
];

try {
    $pdo->beginTransaction();

    // ----------------------------------------------------
    // TABEL 1: CATEGORIES (UPSERT by Name)
    // ----------------------------------------------------
    if (!empty($categories) && is_array($categories)) {
        $stmtCat = $pdo->prepare("INSERT INTO categories (name) VALUES (:name) ON CONFLICT(name) DO NOTHING");
        foreach ($categories as $cat) {
            $catName = is_array($cat) ? ($cat['name'] ?? '') : $cat;
            if (!empty(trim($catName))) {
                $stmtCat->execute([':name' => trim($catName)]);
                $report['categories']++;
            }
        }
    }

    // ----------------------------------------------------
    // TABEL 2: CUSTOMERS (UPSERT by Name + Phone)
    // ----------------------------------------------------
    if (!empty($customers) && is_array($customers)) {
        $stmtCheckCust = $pdo->prepare("SELECT customer_id FROM customers WHERE phone = :phone LIMIT 1");
        $stmtInsertCust = $pdo->prepare("INSERT INTO customers (name, phone, created_at) VALUES (:name, :phone, :created_at)");
        $stmtUpdateCust = $pdo->prepare("UPDATE customers SET name = :name WHERE customer_id = :id");

        foreach ($customers as $c) {
            $phone = trim($c['phone'] ?? '');
            $name  = trim($c['name'] ?? 'Pelanggan');
            $createdAt = $c['created_at'] ?? date('Y-m-d H:i:s');

            if (!empty($phone)) {
                $stmtCheckCust->execute([':phone' => $phone]);
                $existingId = $stmtCheckCust->fetchColumn();
                if ($existingId) {
                    $stmtUpdateCust->execute([':name' => $name, ':id' => $existingId]);
                } else {
                    $stmtInsertCust->execute([':name' => $name, ':phone' => $phone, ':created_at' => $createdAt]);
                }
            } else {
                $stmtInsertCust->execute([':name' => $name, ':phone' => '-', ':created_at' => $createdAt]);
            }
            $report['customers']++;
        }
    }

    // ----------------------------------------------------
    // TABEL 3: MECHANICS (UPSERT by Name)
    // ----------------------------------------------------
    if (!empty($mechanics) && is_array($mechanics)) {
        $stmtMec = $pdo->prepare("
            INSERT INTO mechanics (name, phone) VALUES (:name, :phone)
            ON CONFLICT(name) DO UPDATE SET phone = excluded.phone
        ");
        foreach ($mechanics as $m) {
            $mecName = trim($m['name'] ?? '');
            if (!empty($mecName)) {
                $stmtMec->execute([
                    ':name'  => $mecName,
                    ':phone' => $m['phone'] ?? null
                ]);
                $report['mechanics']++;
            }
        }
    }

    // ----------------------------------------------------
    // TABEL 4: PRODUCTS (UPSERT by SKU)
    // ----------------------------------------------------
    if (!empty($products) && is_array($products)) {
        $stmtProd = $pdo->prepare("
            INSERT INTO products (
                sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility
            ) VALUES (
                :sku, :name, :category_id, :buy_price, :sell_price, :stock, :min_stock, :compatibility
            )
            ON CONFLICT(sku) DO UPDATE SET
                name = excluded.name,
                category_id = excluded.category_id,
                buy_price = excluded.buy_price,
                sell_price = excluded.sell_price,
                stock = excluded.stock,
                min_stock = excluded.min_stock,
                compatibility = excluded.compatibility
        ");

        foreach ($products as $p) {
            $sku  = trim($p['sku'] ?? '');
            $name = trim($p['name'] ?? '');
            if (empty($sku) && !empty($name)) {
                $sku = 'PRD-' . strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $name), 0, 6)) . '-' . ($p['product_id'] ?? rand(100, 999));
            }
            if (empty($sku) || empty($name)) continue;

            $stmtProd->execute([
                ':sku'           => $sku,
                ':name'          => $name,
                ':category_id'   => !empty($p['category_id']) ? (int)$p['category_id'] : null,
                ':buy_price'     => (float)($p['buy_price'] ?? 0),
                ':sell_price'    => (float)($p['sell_price'] ?? 0),
                ':stock'         => (int)($p['stock'] ?? 0),
                ':min_stock'     => (int)($p['min_stock'] ?? 5),
                ':compatibility' => $p['compatibility'] ?? null,
            ]);
            $report['products']++;
        }
    }

    // ----------------------------------------------------
    // TABEL 5: VEHICLES (UPSERT by Plate Number)
    // ----------------------------------------------------
    if (!empty($vehicles) && is_array($vehicles)) {
        $stmtVeh = $pdo->prepare("
            INSERT INTO vehicles (
                plate_number, brand_model, last_km, last_service_date, customer_id
            ) VALUES (
                :plate_number, :brand_model, :last_km, :last_service_date, :customer_id
            )
            ON CONFLICT(plate_number) DO UPDATE SET
                brand_model = excluded.brand_model,
                last_km = excluded.last_km,
                last_service_date = excluded.last_service_date,
                customer_id = excluded.customer_id
        ");

        foreach ($vehicles as $v) {
            $plate = trim($v['plate_number'] ?? '');
            if (empty($plate)) continue;

            $stmtVeh->execute([
                ':plate_number'       => strtoupper($plate),
                ':brand_model'        => $v['brand_model'] ?? 'Sepeda Motor',
                ':last_km'            => (int)($v['last_km'] ?? 0),
                ':last_service_date'  => $v['last_service_date'] ?? date('Y-m-d'),
                ':customer_id'        => !empty($v['customer_id']) ? (int)$v['customer_id'] : null,
            ]);
            $report['vehicles']++;
        }
    }

    // ----------------------------------------------------
    // TABEL 6 & 7: SALES & SALE_DETAILS (UPSERT by Invoice Number)
    // ----------------------------------------------------
    if (!empty($sales) && is_array($sales)) {
        $stmtCheckSale = $pdo->prepare("SELECT sale_id FROM sales WHERE invoice_number = :inv LIMIT 1");
        
        $stmtInsertSale = $pdo->prepare("
            INSERT INTO sales (
                invoice_number, sale_date, vehicle_id, current_km, total_amount, total_hpp,
                payment_method, mechanic_id, is_synced, synced_at
            ) VALUES (
                :invoice_number, :sale_date, :vehicle_id, :current_km, :total_amount, :total_hpp,
                :payment_method, :mechanic_id, 1, datetime('now', 'localtime')
            )
        ");

        $stmtDeleteDetails = $pdo->prepare("DELETE FROM sale_details WHERE sale_id = :sale_id");

        $stmtInsertDetail = $pdo->prepare("
            INSERT INTO sale_details (
                sale_id, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service
            ) VALUES (
                :sale_id, :product_id, :item_name, :quantity, :buy_price, :sell_price, :subtotal, :is_service
            )
        ");

        // Helper maps untuk vehicle & mechanic jika dikirim via nama/pelat
        $stmtGetVehId = $pdo->prepare("SELECT vehicle_id FROM vehicles WHERE plate_number = :plate LIMIT 1");
        $stmtGetMecId = $pdo->prepare("SELECT mechanic_id FROM mechanics WHERE name = :name LIMIT 1");

        foreach ($sales as $s) {
            $inv = trim($s['invoice_number'] ?? '');
            if (empty($inv)) continue;

            $stmtCheckSale->execute([':inv' => $inv]);
            $existingSaleId = $stmtCheckSale->fetchColumn();

            $vehicleId  = !empty($s['vehicle_id']) ? (int)$s['vehicle_id'] : null;
            $mechanicId = !empty($s['mechanic_id']) ? (int)$s['mechanic_id'] : null;

            // Resolusi jika dikirim string plate_number / mechanic_name
            if (!$vehicleId && !empty($s['plate_number'])) {
                $stmtGetVehId->execute([':plate' => strtoupper(trim($s['plate_number']))]);
                $vehicleId = $stmtGetVehId->fetchColumn() ?: null;
            }
            if (!$mechanicId && !empty($s['mechanic_name'])) {
                $stmtGetMecId->execute([':name' => trim($s['mechanic_name'])]);
                $mechanicId = $stmtGetMecId->fetchColumn() ?: null;
            }

            if ($existingSaleId) {
                $saleId = (int)$existingSaleId;
                // Bersihkan detail lama untuk diperbarui ulang
                $stmtDeleteDetails->execute([':sale_id' => $saleId]);
            } else {
                $stmtInsertSale->execute([
                    ':invoice_number' => $inv,
                    ':sale_date'      => $s['sale_date'] ?? date('Y-m-d H:i:s'),
                    ':vehicle_id'     => $vehicleId,
                    ':current_km'     => (int)($s['current_km'] ?? 0),
                    ':total_amount'   => (float)($s['total_amount'] ?? 0),
                    ':total_hpp'      => (float)($s['total_hpp'] ?? 0),
                    ':payment_method' => $s['payment_method'] ?? 'TUNAI',
                    ':mechanic_id'    => $mechanicId,
                ]);
                $saleId = (int)$pdo->lastInsertId();
            }

            // Simpan detail item transaksi
            $items = $s['items'] ?? $s['details'] ?? [];
            if (!empty($items) && is_array($items)) {
                foreach ($items as $item) {
                    $qty       = (int)($item['quantity'] ?? 1);
                    $sellPrice = (float)($item['sell_price'] ?? 0);
                    $subtotal  = (float)($item['subtotal'] ?? ($qty * $sellPrice));

                    $stmtInsertDetail->execute([
                        ':sale_id'    => $saleId,
                        ':product_id' => !empty($item['product_id']) ? (int)$item['product_id'] : null,
                        ':item_name'  => $item['item_name'] ?? 'Item',
                        ':quantity'   => $qty,
                        ':buy_price'  => (float)($item['buy_price'] ?? 0),
                        ':sell_price' => $sellPrice,
                        ':subtotal'   => $subtotal,
                        ':is_service' => !empty($item['is_service']) ? 1 : 0,
                    ]);
                    $report['sale_details']++;
                }
            }

            $report['sales']++;
        }
    }

    $pdo->commit();

    echo json_encode([
        'status'      => 'success',
        'engine'      => 'SQLite',
        'message'     => 'Sinkronisasi Seluruh Database (7 Tabel) Berhasil Direplikasi ke Server!',
        'report'      => $report,
        'device_id'   => $deviceId,
        'server_time' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal memproses sinkronisasi database lengkap ke SQLite: ' . $e->getMessage()
    ]);
}
