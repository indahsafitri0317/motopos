export const PHP_SYNC_SCRIPT_TEMPLATE = `<?php
/**
 * MotoPOS Sync Report API
 * Endpoint: https://larizk.com/api/sync_report-api.php
 * Digunakan untuk menerima sinkronisasi data transaksi penjualan dari tablet kasir POS.
 */

// 1. Header CORS & Content-Type
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Konfigurasi Keamanan (Sesuaikan API KEY Toko Anda)
define('EXPECTED_API_KEY', 'LARIZK_BENGKEL_2026');

// 3. GET Request -> Health Check
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'online',
        'app' => 'MotoPOS Sync Gateway',
        'server_time' => date('Y-m-d H:i:s'),
        'message' => 'API Sinkronisasi aktif dan siap menerima data transaksi dari tablet.'
    ]);
    exit();
}

// 4. POST Request -> Menerima Data Sinkronisasi
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Hanya menerima method POST']);
    exit();
}

// Baca raw payload JSON
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Payload JSON tidak valid']);
    exit();
}

// Validasi API Key
$apiKey = isset($data['api_key']) ? trim($data['api_key']) : '';
if ($apiKey !== EXPECTED_API_KEY) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'API Key toko salah atau tidak diizinkan']);
    exit();
}

// Jika request hanya untuk tes ping
if (!empty($data['ping_only'])) {
    echo json_encode([
        'status' => 'success',
        'message' => 'Koneksi ke server larizk.com berhasil terverifikasi!',
        'server_time' => date('Y-m-d H:i:s')
    ]);
    exit();
}

$transactions = isset($data['transactions']) ? $data['transactions'] : [];
$deviceId = isset($data['device_id']) ? $data['device_id'] : 'UNKNOWN';

if (empty($transactions)) {
    echo json_encode([
        'status' => 'success',
        'message' => 'Tidak ada transaksi yang perlu disinkronkan',
        'synced_count' => 0
    ]);
    exit();
}

// 5. Inisialisasi Database SQLite di Server Hosting
// (Otomatis dibuat di folder yang sama: data_sales_sync.sqlite)
$dbFile = __DIR__ . '/data_sales_sync.sqlite';

try {
    $pdo = new PDO("sqlite:" . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");

    // Buat tabel jika belum ada
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS synced_sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            invoice_number TEXT UNIQUE NOT NULL,
            sale_date TEXT,
            total_amount REAL,
            total_hpp REAL,
            payment_method TEXT,
            plate_number TEXT,
            brand_model TEXT,
            customer_name TEXT,
            customer_phone TEXT,
            mechanic_name TEXT,
            current_km INTEGER,
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS synced_sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT,
            product_id INTEGER,
            item_name TEXT,
            quantity INTEGER,
            buy_price REAL,
            sell_price REAL,
            subtotal REAL,
            is_service INTEGER
        );
    ");

    $pdo->beginTransaction();

    $stmtSale = $pdo->prepare("
        INSERT OR REPLACE INTO synced_sales 
        (device_id, invoice_number, sale_date, total_amount, total_hpp, payment_method, plate_number, brand_model, customer_name, customer_phone, mechanic_name, current_km, synced_at)
        VALUES (:device_id, :invoice_number, :sale_date, :total_amount, :total_hpp, :payment_method, :plate_number, :brand_model, :customer_name, :customer_phone, :mechanic_name, :current_km, :synced_at)
    ");

    $stmtItem = $pdo->prepare("
        INSERT INTO synced_sale_items
        (invoice_number, product_id, item_name, quantity, buy_price, sell_price, subtotal, is_service)
        VALUES (:invoice_number, :product_id, :item_name, :quantity, :buy_price, :sell_price, :subtotal, :is_service)
    ");

    $stmtClearItems = $pdo->prepare("DELETE FROM synced_sale_items WHERE invoice_number = :invoice_number");

    $syncedInvoices = [];
    $now = date('Y-m-d H:i:s');

    foreach ($transactions as $tx) {
        $inv = trim($tx['invoice_number']);
        if (!$inv) continue;

        $stmtSale->execute([
            ':device_id' => $deviceId,
            ':invoice_number' => $inv,
            ':sale_date' => isset($tx['sale_date']) ? $tx['sale_date'] : $now,
            ':total_amount' => isset($tx['total_amount']) ? floatval($tx['total_amount']) : 0,
            ':total_hpp' => isset($tx['total_hpp']) ? floatval($tx['total_hpp']) : 0,
            ':payment_method' => isset($tx['payment_method']) ? $tx['payment_method'] : 'CASH',
            ':plate_number' => isset($tx['plate_number']) ? $tx['plate_number'] : '',
            ':brand_model' => isset($tx['brand_model']) ? $tx['brand_model'] : '',
            ':customer_name' => isset($tx['customer_name']) ? $tx['customer_name'] : '',
            ':customer_phone' => isset($tx['customer_phone']) ? $tx['customer_phone'] : '',
            ':mechanic_name' => isset($tx['mechanic_name']) ? $tx['mechanic_name'] : '',
            ':current_km' => isset($tx['current_km']) ? intval($tx['current_km']) : null,
            ':synced_at' => $now
        ]);

        // Hapus rincian lama jika invoice di-update
        $stmtClearItems->execute([':invoice_number' => $inv]);

        // Masukkan rincian item
        if (!empty($tx['items']) && is_array($tx['items'])) {
            foreach ($tx['items'] as $item) {
                $stmtItem->execute([
                    ':invoice_number' => $inv,
                    ':product_id' => isset($item['product_id']) ? $item['product_id'] : null,
                    ':item_name' => isset($item['item_name']) ? $item['item_name'] : 'Item',
                    ':quantity' => isset($item['quantity']) ? intval($item['quantity']) : 1,
                    ':buy_price' => isset($item['buy_price']) ? floatval($item['buy_price']) : 0,
                    ':sell_price' => isset($item['sell_price']) ? floatval($item['sell_price']) : 0,
                    ':subtotal' => isset($item['subtotal']) ? floatval($item['subtotal']) : 0,
                    ':is_service' => !empty($item['is_service']) ? 1 : 0
                ]);
            }
        }

        $syncedInvoices[] = $inv;
    }

    $pdo->commit();

    // Berikan respons sukses ke tablet
    echo json_encode([
        'status' => 'success',
        'message' => 'Berhasil menyinkronkan ' . count($syncedInvoices) . ' transaksi ke server larizk.com',
        'synced_count' => count($syncedInvoices),
        'invoices' => $syncedInvoices,
        'server_time' => $now
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Terjadi kesalahan database di server PHP: ' . $e->getMessage()
    ]);
}
`;

export const PHP_AUTH_LOCK_SCRIPT_TEMPLATE = `<?php
/**
 * MotoPOS Auth & Multi-Device Session Lock Gateway
 * Endpoint: https://larizk.com/api/auth_lock-api.php
 * 
 * KEAMANAN TINGGI (SECURE HARDENED):
 * 1. Tidak pernah mengekspos PIN atau Password Hash pada action get_users atau login.
 * 2. Heartbeat hanya memvalidasi status 1 user yang sedang aktif (ringan, cepat, hemat bandwidth server).
 * 3. Mencegah bentrok login ganda (Single Session Enforcement) antar-tablet/PC.
 */

// 1. Header CORS & Content-Type
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Inisialisasi Database SQLite Lokal di Server
$dbFile = __DIR__ . '/data_auth_users.sqlite';
try {
    $db = new PDO('sqlite:' . $dbFile);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Buat tabel users jika belum ada
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'kasir',
        pin TEXT NOT NULL,
        password_hash TEXT,
        permissions TEXT,
        is_blocked INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 0,
        active_session_id TEXT,
        last_device TEXT,
        last_activity DATETIME,
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
    )");

    // Seed pengguna awal jika masih kosong
    $chk = $db->query("SELECT COUNT(*) as cnt FROM users")->fetch();
    if (!$chk || (int)$chk['cnt'] === 0) {
        $ownerPerms = json_encode([
            'can_add_product' => true,
            'can_edit_product' => true,
            'can_stock_opname' => true,
            'can_reprint_receipt' => true,
            'can_view_profit_report' => true,
            'can_manage_users' => true,
            'can_access_sync' => true
        ]);
        $kasirPerms = json_encode([
            'can_add_product' => false,
            'can_edit_product' => false,
            'can_stock_opname' => false,
            'can_reprint_receipt' => true,
            'can_view_profit_report' => false,
            'can_manage_users' => false,
            'can_access_sync' => false
        ]);

        $stmt = $db->prepare("INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
            VALUES (:u, :fn, :role, :pin, :pwd, :perm, 0, 0, datetime('now'))");
        
        $stmt->execute([
            ':u' => 'owner',
            ':fn' => 'Roni-o (Owner)',
            ':role' => 'owner',
            ':pin' => '1234',
            ':pwd' => password_hash('123456', PASSWORD_DEFAULT),
            ':perm' => $ownerPerms
        ]);
        $stmt->execute([
            ':u' => 'kasir1',
            ':fn' => 'Kasir Utama',
            ':role' => 'kasir',
            ':pin' => '2345',
            ':pwd' => password_hash('123456', PASSWORD_DEFAULT),
            ':perm' => $kasirPerms
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gagal menghubungkan database SQLite: ' . $e->getMessage()]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// A. GET REQUEST: DAFTAR PENGGUNA (AMAN TANPA PIN & PASSWORD)
// =========================================================================
if ($method === 'GET') {
    $action = isset($_GET['action']) ? trim($_GET['action']) : 'health';

    if ($action === 'health') {
        echo json_encode([
            'status' => 'ok',
            'app' => 'MotoPOS Auth Lock Gateway (Secure v2.0)',
            'server_time' => date('Y-m-d H:i:s'),
            'message' => 'Layanan autentikasi aman aktif.'
        ]);
        exit();
    }

    if ($action === 'get_users') {
        // PENTING: Jangan sertakan kolom 'pin' atau 'password_hash' pada SELECT!
        $stmt = $db->query("SELECT 
            user_id, username, full_name, role, permissions, 
            is_blocked, is_active, active_session_id, last_activity, last_login_at, created_at 
            FROM users ORDER BY user_id ASC");
        $rows = $stmt->fetchAll();

        $cleanUsers = [];
        foreach ($rows as $r) {
            $cleanUsers[] = [
                'user_id' => (int)$r['user_id'],
                'username' => $r['username'],
                'full_name' => $r['full_name'],
                'role' => $r['role'],
                // PIN dan password disembunyikan total demi keamanan!
                'is_blocked' => (int)$r['is_blocked'],
                'is_active' => (int)$r['is_active'],
                'active_session_id' => $r['active_session_id'],
                'last_activity' => $r['last_activity'],
                'last_login_at' => $r['last_login_at'],
                'permissions' => json_decode($r['permissions'] ?: '{}', true),
                'created_at' => $r['created_at']
            ];
        }

        echo json_encode(['status' => 'success', 'data' => $cleanUsers]);
        exit();
    }

    echo json_encode(['status' => 'error', 'message' => 'Action GET tidak valid.']);
    exit();
}

// =========================================================================
// B. POST REQUEST: LOGIN, HEARTBEAT (1 USER), LOGOUT, MANAGEMENT
// =========================================================================
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data || !isset($data['action'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Action wajib disertakan dalam payload JSON.']);
    exit();
}

$action = $data['action'];

// 1. HEARTBEAT (HANYA CEK 1 USER LOGIN - SANGAT RINGAN & CEPAT)
if ($action === 'heartbeat') {
    $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $sessionId = isset($data['session_id']) ? trim($data['session_id']) : '';

    if ($userId <= 0 || empty($sessionId)) {
        echo json_encode(['status' => 'invalid_params', 'message' => 'Parameter user_id atau session_id kosong']);
        exit();
    }

    // Hanya ambil 1 baris record user yang sedang aktif
    $stmt = $db->prepare("SELECT user_id, active_session_id, is_blocked, is_active FROM users WHERE user_id = :uid");
    $stmt->execute([':uid' => $userId]);
    $user = $stmt->fetch();

    if (!$user || (int)$user['is_blocked'] === 1) {
        echo json_encode(['status' => 'blocked', 'message' => 'Akun Anda dinonaktifkan / diblokir oleh Owner.']);
        exit();
    }

    if ($user['active_session_id'] !== $sessionId) {
        echo json_encode(['status' => 'kicked', 'message' => 'Sesi login telah dialihkan ke perangkat lain.']);
        exit();
    }

    // Perbarui waktu aktivitas terakhir (hanya 1 baris)
    $upd = $db->prepare("UPDATE users SET last_activity = datetime('now'), is_active = 1 WHERE user_id = :uid");
    $upd->execute([':uid' => $userId]);

    echo json_encode(['status' => 'ok']);
    exit();
}

// 2. LOGIN (VERIFIKASI PIN / PASSWORD RAHASIA DI SERVER)
if ($action === 'login') {
    $loginType = isset($data['login_type']) ? $data['login_type'] : 'pin';
    $force = !empty($data['force']);
    $user = null;

    if ($loginType === 'pin') {
        $userId = (int)($data['user_id'] ?? 0);
        $pinInput = trim((string)($data['pin'] ?? ''));

        $stmt = $db->prepare("SELECT * FROM users WHERE user_id = :uid");
        $stmt->execute([':uid' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Pengguna tidak ditemukan']);
            exit();
        }

        // Verifikasi PIN
        if (trim($user['pin']) !== $pinInput) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'PIN yang Anda masukkan salah!']);
            exit();
        }
    } else {
        // Login Username + Password
        $uname = trim((string)($data['username'] ?? ''));
        $pwdInput = trim((string)($data['password'] ?? ''));

        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(:u)");
        $stmt->execute([':u' => $uname]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Username tidak ditemukan']);
            exit();
        }

        $isValid = false;
        if (!empty($user['password_hash']) && password_verify($pwdInput, $user['password_hash'])) {
            $isValid = true;
        } elseif (trim($user['pin']) === $pwdInput) {
            $isValid = true;
        }

        if (!$isValid) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Password atau PIN salah!']);
            exit();
        }
    }

    if ((int)$user['is_blocked'] === 1) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Akun ini sedang dinonaktifkan oleh Owner.']);
        exit();
    }

    // Cek Bentrok Multi-Device (Session Lock 5 Menit)
    $isActive = (int)$user['is_active'] === 1;
    $hasSession = !empty($user['active_session_id']);
    $isTimeout = true;

    if (!empty($user['last_activity'])) {
        $lastTime = strtotime($user['last_activity']);
        if ((time() - $lastTime) < 300) {
            $isTimeout = false;
        }
    }

    if ($isActive && $hasSession && !$isTimeout && !$force) {
        echo json_encode([
            'status' => 'session_locked',
            'message' => 'Akun "' . $user['full_name'] . '" sedang aktif digunakan pada tablet/PC lain.',
            'active_device' => $user['last_device'] ?: 'Perangkat Kasir Lain',
            'last_activity_time' => $user['last_activity'] ?: 'Baru saja',
            'can_force_unlock' => true
        ]);
        exit();
    }

    // Buat Session ID Baru
    $newSessionId = 'sess_' . bin2hex(random_bytes(16));
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 50) : 'Tablet Kasir';

    $upd = $db->prepare("UPDATE users SET 
        is_active = 1, 
        active_session_id = :sid, 
        last_activity = datetime('now'), 
        last_login_at = datetime('now'), 
        last_device = :dev 
        WHERE user_id = :uid");
    $upd->execute([
        ':sid' => $newSessionId,
        ':dev' => $userAgent,
        ':uid' => (int)$user['user_id']
    ]);

    // Respon sukses (TIDAK MENYERTAKAN PIN ATAU PASSWORD!)
    echo json_encode([
        'status' => 'success',
        'message' => 'Selamat datang, ' . $user['full_name'] . '!',
        'session_id' => $newSessionId,
        'user' => [
            'user_id' => (int)$user['user_id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'is_blocked' => (int)$user['is_blocked'],
            'is_active' => 1,
            'active_session_id' => $newSessionId,
            'permissions' => json_decode($user['permissions'] ?: '{}', true),
            'created_at' => $user['created_at'],
            'last_login_at' => date('Y-m-d H:i:s')
        ]
    ]);
    exit();
}

// 3. LOGOUT
if ($action === 'logout') {
    $userId = (int)($data['user_id'] ?? 0);
    $sessionId = trim((string)($data['session_id'] ?? ''));

    if ($userId > 0) {
        $stmt = $db->prepare("UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = :uid");
        $stmt->execute([':uid' => $userId]);
    } elseif (!empty($sessionId)) {
        $stmt = $db->prepare("UPDATE users SET is_active = 0, active_session_id = NULL WHERE active_session_id = :sid");
        $stmt->execute([':sid' => $sessionId]);
    }

    echo json_encode(['status' => 'success', 'message' => 'Sesi berhasil diakhiri.']);
    exit();
}

// 4. FORCE UNLOCK SESI
if ($action === 'force_unlock') {
    $targetId = (int)($data['target_user_id'] ?? ($data['user_id'] ?? 0));
    if ($targetId > 0) {
        $stmt = $db->prepare("UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = :uid");
        $stmt->execute([':uid' => $targetId]);
    }
    echo json_encode(['status' => 'success', 'message' => 'Kunci sesi berhasil dibuka paksa.']);
    exit();
}

// 5. TAMBAH USER (DARI OWNER)
if ($action === 'create_user') {
    $u = trim((string)($data['username'] ?? ''));
    $fn = trim((string)($data['full_name'] ?? ''));
    $role = trim((string)($data['role'] ?? 'kasir'));
    $pin = trim((string)($data['pin'] ?? '1234'));
    $pwd = trim((string)($data['password'] ?? '123456'));
    $perm = is_array($data['permissions'] ?? null) ? json_encode($data['permissions']) : (string)($data['permissions'] ?? '{}');

    if (empty($u) || empty($fn)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Username dan Nama Lengkap wajib diisi']);
        exit();
    }

    $chk = $db->prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(:u)");
    $chk->execute([':u' => $u]);
    if ($chk->fetch()) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Username sudah digunakan']);
        exit();
    }

    $ins = $db->prepare("INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
        VALUES (:u, :fn, :role, :pin, :pwd, :perm, 0, 0, datetime('now'))");
    $ins->execute([
        ':u' => $u,
        ':fn' => $fn,
        ':role' => $role,
        ':pin' => $pin,
        ':pwd' => password_hash($pwd, PASSWORD_DEFAULT),
        ':perm' => $perm
    ]);

    $newId = (int)$db->lastInsertId();
    echo json_encode([
        'status' => 'success',
        'message' => 'Pengguna berhasil dibuat',
        'user' => ['user_id' => $newId, 'username' => $u, 'full_name' => $fn, 'role' => $role]
    ]);
    exit();
}

// 6. UPDATE USER
if ($action === 'update_user') {
    $uid = (int)($data['user_id'] ?? 0);
    $existing = $db->prepare("SELECT * FROM users WHERE user_id = :uid");
    $existing->execute([':uid' => $uid]);
    $curr = $existing->fetch();

    if (!$curr) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Pengguna tidak ditemukan']);
        exit();
    }

    $u = isset($data['username']) ? trim($data['username']) : $curr['username'];
    $fn = isset($data['full_name']) ? trim($data['full_name']) : $curr['full_name'];
    $role = isset($data['role']) ? trim($data['role']) : $curr['role'];
    $pin = (!empty($data['pin']) && trim($data['pin']) !== '') ? trim($data['pin']) : $curr['pin'];
    $pwd = (!empty($data['password']) && trim($data['password']) !== '') ? password_hash(trim($data['password']), PASSWORD_DEFAULT) : $curr['password_hash'];
    $perm = isset($data['permissions']) ? (is_array($data['permissions']) ? json_encode($data['permissions']) : $data['permissions']) : $curr['permissions'];
    $isBlocked = isset($data['is_blocked']) ? ((int)$data['is_blocked'] ? 1 : 0) : (int)$curr['is_blocked'];

    $upd = $db->prepare("UPDATE users SET 
        username = :u, full_name = :fn, role = :role, pin = :pin, password_hash = :pwd, permissions = :perm, is_blocked = :blk, updated_at = datetime('now')
        WHERE user_id = :uid");
    $upd->execute([
        ':u' => $u, ':fn' => $fn, ':role' => $role, ':pin' => $pin, ':pwd' => $pwd, ':perm' => $perm, ':blk' => $isBlocked, ':uid' => $uid
    ]);

    echo json_encode(['status' => 'success', 'message' => 'Data pengguna berhasil diperbarui']);
    exit();
}

// 7. TOGGLE BLOCK USER
if ($action === 'toggle_block') {
    $uid = (int)($data['user_id'] ?? 0);
    $curr = $db->query("SELECT is_blocked FROM users WHERE user_id = " . $uid)->fetch();
    if ($curr) {
        $newVal = (int)$curr['is_blocked'] === 1 ? 0 : 1;
        $db->exec("UPDATE users SET is_blocked = $newVal, is_active = 0, active_session_id = NULL WHERE user_id = " . $uid);
        echo json_encode(['status' => 'success', 'is_blocked' => $newVal]);
        exit();
    }
}

echo json_encode(['status' => 'error', 'message' => 'Action tidak dikenali.']);
`;

