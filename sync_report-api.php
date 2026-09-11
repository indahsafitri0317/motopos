<?php
/**
 * =========================================================================
 * MOTO-POS CLOUD SYNC API - LAPORAN & TRANSAKSI (SQLite Version)
 * File: sync_report-api.php
 * =========================================================================
 * Endpoint API PHP berbasis SQLite untuk sinkronisasi riwayat transaksi kasir,
 * nota, detail item, pelanggan, kendaraan, dan mekanik dari POS Terminal ke Server.
 * 
 * Keunggulan Versi SQLite:
 * 1. Tanpa perlu setup database MySQL/MariaDB terpisah (file .sqlite dibuat otomatis).
 * 2. Menggunakan `invoice_number` UNIQUE untuk mencegah nota duplikat / ganda.
 * 3. Transaksi atomik SQLite ($pdo->beginTransaction / commit) menjamin keutuhan data nota & detail item.
 * 4. Mendukung Test Ping dan CORS lengkap.
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

// 2. Konfigurasi Lokasi File SQLite & Kunci API Keamanan
$DB_FILE = __DIR__ . '/data/bengkel.sqlite'; 
$API_KEY = 'LARIZK_BENGKEL_2026'; // Samakan dengan API Key di Pengaturan POS

$dbDir = dirname($DB_FILE);
if (!is_dir($dbDir)) {
    @mkdir($dbDir, 0755, true);
}

// 3. Inisialisasi Koneksi Database PDO SQLite
try {
    $pdo = new PDO("sqlite:" . $DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Aktifkan WAL & Foreign Keys
    $pdo->exec("PRAGMA journal_mode = WAL;");
    $pdo->exec("PRAGMA synchronous = NORMAL;");
    $pdo->exec("PRAGMA foreign_keys = ON;");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal membuka file database SQLite di server: ' . $e->getMessage(),
        'hint'    => 'Pastikan folder ' . $dbDir . ' memiliki izin tulis (write permission 755/777).'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. Auto Setup Tabel Transaksi & Detail di SQLite
try {
    // Tabel Pelanggan
    $pdo->exec("CREATE TABLE IF NOT EXISTS customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );");

    // Tabel Kendaraan
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicles (
        vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT NOT NULL UNIQUE,
        brand_model TEXT NULL,
        last_km INTEGER DEFAULT 0,
        last_service_date TEXT NULL,
        customer_id INTEGER NULL
    );");

    // Tabel Penjualan (Header Nota) - Unik berdasarkan invoice_number
    $pdo->exec("CREATE TABLE IF NOT EXISTS sales (
        sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        sale_date DATETIME NOT NULL,
        plate_number TEXT NULL,
        brand_model TEXT NULL,
        customer_name TEXT NULL,
        customer_phone TEXT NULL,
        mechanic_name TEXT NULL,
        current_km INTEGER DEFAULT 0,
        total_amount REAL DEFAULT 0,
        total_hpp REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'TUNAI',
        device_id TEXT NULL,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );");

    // Tabel Detail Item Transaksi
    $pdo->exec("CREATE TABLE IF NOT EXISTS sale_details (
        detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        invoice_number TEXT NOT NULL,
        product_id INTEGER NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        buy_price REAL DEFAULT 0,
        sell_price REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        is_service INTEGER DEFAULT 0
    );");

    // Index pencarian cepat
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_details_sale_id ON sale_details(sale_id);");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal inisialisasi tabel SQLite: ' . $e->getMessage()
    ]);
    exit;
}

// 5. Tangani Request GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $countStmt = $pdo->query("SELECT COUNT(*) as total FROM sales");
    $totalSales = $countStmt->fetchColumn();

    echo json_encode([
        'status'      => 'online',
        'engine'      => 'SQLite Database',
        'db_file'     => basename($DB_FILE),
        'message'     => 'MotoPOS Cloud Sync API (Laporan & Transaksi) siap menerima data.',
        'total_sales' => (int)$totalSales,
        'server_time' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 6. Validasi API Key pada Request POST
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
    $countStmt = $pdo->query("SELECT COUNT(*) as total FROM sales");
    $totalSales = $countStmt->fetchColumn();
    echo json_encode([
        'status'      => 'success',
        'engine'      => 'SQLite',
        'message'     => 'Koneksi API Laporan & Transaksi Berhasil & Database SQLite Siap!',
        'total_sales' => (int)$totalSales,
        'server_time' => date('Y-m-d H:i:s'),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 8. Proses Simpan Transaksi ke SQLite (Atomic & Anti-Duplikasi)
$transactions = $data['transactions'] ?? [];
$deviceId     = $data['device_id'] ?? 'TABLET-POS';

if (empty($transactions)) {
    echo json_encode([
        'status'       => 'success',
        'synced_count' => 0,
        'message'      => 'Tidak ada data transaksi yang dikirim.'
    ]);
    exit;
}

$insertedCount = 0;
$skippedCount  = 0;

try {
    $pdo->beginTransaction();

    $stmtCheck = $pdo->prepare("SELECT sale_id FROM sales WHERE invoice_number = :inv LIMIT 1");

    $stmtSale = $pdo->prepare("
        INSERT INTO sales (
            invoice_number, sale_date, plate_number, brand_model, customer_name, customer_phone,
            mechanic_name, current_km, total_amount, total_hpp, payment_method, device_id, synced_at
        ) VALUES (
            :invoice_number, :sale_date, :plate_number, :brand_model, :customer_name, :customer_phone,
            :mechanic_name, :current_km, :total_amount, :total_hpp, :payment_method, :device_id, datetime('now', 'localtime')
        )
    ");

    $stmtDetail = $pdo->prepare("
        INSERT INTO sale_details (
            sale_id, invoice_number, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service
        ) VALUES (
            :sale_id, :invoice_number, :product_id, :item_name, :quantity, :buy_price, :sell_price, :subtotal, :is_service
        )
    ");

    foreach ($transactions as $t) {
        $inv = trim($t['invoice_number'] ?? '');
        if (empty($inv)) continue;

        // Cek invoice sudah ada atau belum (Mencegah Duplikasi)
        $stmtCheck->execute([':inv' => $inv]);
        $existing = $stmtCheck->fetchColumn();

        if ($existing) {
            $skippedCount++;
            continue;
        }

        $stmtSale->execute([
            ':invoice_number' => $inv,
            ':sale_date'      => $t['sale_date'] ?? date('Y-m-d H:i:s'),
            ':plate_number'   => $t['plate_number'] ?? null,
            ':brand_model'    => $t['brand_model'] ?? null,
            ':customer_name'  => $t['customer_name'] ?? null,
            ':customer_phone' => $t['customer_phone'] ?? null,
            ':mechanic_name'  => $t['mechanic_name'] ?? null,
            ':current_km'     => (int)($t['current_km'] ?? 0),
            ':total_amount'   => (float)($t['total_amount'] ?? 0),
            ':total_hpp'      => (float)($t['total_hpp'] ?? 0),
            ':payment_method' => $t['payment_method'] ?? 'TUNAI',
            ':device_id'      => $deviceId
        ]);

        $saleId = (int)$pdo->lastInsertId();

        // Simpan Detail Item
        if (!empty($t['items']) && is_array($t['items'])) {
            foreach ($t['items'] as $item) {
                $qty       = (int)($item['quantity'] ?? 1);
                $sellPrice = (float)($item['sell_price'] ?? 0);
                $subtotal  = (float)($item['subtotal'] ?? ($qty * $sellPrice));

                $stmtDetail->execute([
                    ':sale_id'        => $saleId,
                    ':invoice_number' => $inv,
                    ':product_id'     => !empty($item['product_id']) ? (int)$item['product_id'] : null,
                    ':item_name'      => $item['item_name'] ?? 'Item',
                    ':quantity'       => $qty,
                    ':buy_price'      => (float)($item['buy_price'] ?? 0),
                    ':sell_price'     => $sellPrice,
                    ':subtotal'       => $subtotal,
                    ':is_service'     => !empty($item['is_service']) ? 1 : 0
                ]);
            }
        }

        $insertedCount++;
    }

    $pdo->commit();

    echo json_encode([
        'status'         => 'success',
        'engine'         => 'SQLite',
        'message'        => "Sinkronisasi Berhasil! ($insertedCount transaksi baru disimpan ke SQLite, $skippedCount sudah ada/dilewati).",
        'synced_count'   => $insertedCount,
        'skipped_count'  => $skippedCount,
        'total_received' => count($transactions),
        'device_id'      => $deviceId,
        'server_time'    => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal memproses sinkronisasi transaksi ke SQLite: ' . $e->getMessage()
    ]);
}
