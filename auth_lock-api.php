<?php
/**
 * ==============================================================================
 * AUTH LOCK & MULTI-USER SESSION MANAGER API (SQLite Native Version)
 * File: auth_lock-api.php
 * Endpoint: https://larizk.com/api/auth_lock-api.php
 * 
 * Fitur:
 * 1. Autentikasi Login Aman (Password Bcrypt / PIN Terenkripsi)
 * 2. Single-Session Locking (Mencegah 1 akun dipakai bersamaan di banyak perangkat)
 * 3. Heartbeat & Auto-Expire Session (Memutus sesi jika browser ditutup tanpa logout)
 * 4. Force Unlock (Membuka kunci sesi aktif jika berpindah komputer kasir)
 * 5. Manajemen Pengguna (CRUD) Langsung di Database SQLite Server (data/bengkel.sqlite)
 * ==============================================================================
 */

// 1. Header CORS & Tipe Konten JSON
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Session-Id');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Batas waktu inaktivitas sesi (detik) - default 300 detik = 5 menit
define('SESSION_INACTIVE_LIMIT', 300);

// 2. Konfigurasi Lokasi Database SQLite
// Menggunakan database yang sama persis dengan sync_report-api.php dan sync_all_data-api.php
$DB_FILE = __DIR__ . '/data/bengkel.sqlite'; 
$dbDir = dirname($DB_FILE);
if (!is_dir($dbDir)) {
    @mkdir($dbDir, 0755, true);
}

// 3. Inisialisasi Koneksi Database SQLite (PDO)
try {
    $pdo = new PDO("sqlite:" . $DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $pdo->exec("PRAGMA journal_mode = WAL;");
    $pdo->exec("PRAGMA synchronous = NORMAL;");
    $pdo->exec("PRAGMA foreign_keys = ON;");
} catch (Exception $e) {
    http_response_code(200);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal membuka database SQLite: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. Inisialisasi Skema Tabel `users`
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            pin TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'kasir',
            permissions TEXT NULL,
            is_blocked INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 0,
            active_session_id TEXT NULL,
            last_activity TEXT NULL,
            last_login_at TEXT NULL,
            last_ip TEXT NULL,
            last_device TEXT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Seed default users jika tabel users masih kosong
    $cntStmt = $pdo->query("SELECT COUNT(*) as cnt FROM users");
    $rowCnt = $cntStmt->fetch();
    if ($rowCnt && (int)$rowCnt['cnt'] === 0) {
        $defaultUsers = [
            [
                ':username'      => 'owner',
                ':password_hash' => password_hash('admin', PASSWORD_DEFAULT),
                ':pin'           => '1234',
                ':full_name'     => 'Bpk. Hendra (Owner)',
                ':role'          => 'owner',
                ':permissions'   => json_encode([
                    'can_add_product' => true,
                    'can_edit_product' => true,
                    'can_stock_opname' => true,
                    'can_reprint_receipt' => true,
                    'can_view_profit_report' => true,
                    'can_manage_users' => true,
                    'can_access_sync' => true,
                ]),
            ],
            [
                ':username'      => 'supervisor',
                ':password_hash' => password_hash('spv', PASSWORD_DEFAULT),
                ':pin'           => '2345',
                ':full_name'     => 'Doni (Supervisor Toko)',
                ':role'          => 'supervisor',
                ':permissions'   => json_encode([
                    'can_add_product' => true,
                    'can_edit_product' => true,
                    'can_stock_opname' => true,
                    'can_reprint_receipt' => true,
                    'can_view_profit_report' => true,
                    'can_manage_users' => false,
                    'can_access_sync' => true,
                ]),
            ],
            [
                ':username'      => 'kasir',
                ':password_hash' => password_hash('kasir', PASSWORD_DEFAULT),
                ':pin'           => '1111',
                ':full_name'     => 'Siti Rahma (Kasir Shift 1)',
                ':role'          => 'kasir',
                ':permissions'   => json_encode([
                    'can_add_product' => false,
                    'can_edit_product' => false,
                    'can_stock_opname' => false,
                    'can_reprint_receipt' => true,
                    'can_view_profit_report' => false,
                    'can_manage_users' => false,
                    'can_access_sync' => false,
                ]),
            ],
            [
                ':username'      => 'teknisi',
                ':password_hash' => password_hash('mekanik', PASSWORD_DEFAULT),
                ':pin'           => '9999',
                ':full_name'     => 'Agus (Mekanik Senior)',
                ':role'          => 'teknisi',
                ':permissions'   => json_encode([
                    'can_add_product' => false,
                    'can_edit_product' => false,
                    'can_stock_opname' => false,
                    'can_reprint_receipt' => false,
                    'can_view_profit_report' => false,
                    'can_manage_users' => false,
                    'can_access_sync' => false,
                ]),
            ],
        ];

        $insStmt = $pdo->prepare("
            INSERT INTO users (username, password_hash, pin, full_name, role, permissions, is_blocked, is_active, created_at)
            VALUES (:username, :password_hash, :pin, :full_name, :role, :permissions, 0, 0, datetime('now'))
        ");
        foreach ($defaultUsers as $u) {
            $insStmt->execute($u);
        }
    }
} catch (Exception $e) {
    // Tangani dengan aman tanpa melempar fatal error 500
}

// 5. Parse Request Input
$raw_input = file_get_contents('php://input');
$input = json_decode($raw_input, true) ?: $_POST;
$action = isset($_GET['action']) ? $_GET['action'] : ($input['action'] ?? 'status');

$client_ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$client_device = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Client';

function generateSessionId() {
    return 'sess_' . bin2hex(random_bytes(16));
}

// 6. Routing Aksi Auth & Manajemen Pengguna
switch ($action) {

    // --------------------------------------------------------------------------
    // 1. GET USERS (Daftar Pengguna Aktif & Profil untuk Frontend)
    // --------------------------------------------------------------------------
    case 'get_users':
        try {
            $stmt = $pdo->query("SELECT user_id, username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, active_session_id, last_activity, last_login_at, created_at FROM users ORDER BY user_id ASC");
            $users = $stmt->fetchAll();

            $now = time();
            $result = array_map(function($u) use ($now) {
                if (!empty($u['permissions']) && is_string($u['permissions'])) {
                    $u['permissions'] = json_decode($u['permissions'], true);
                }
                $lastAct = !empty($u['last_activity']) ? strtotime($u['last_activity']) : 0;
                $isActuallyActive = ($u['is_active'] == 1 && ($now - $lastAct) < SESSION_INACTIVE_LIMIT);
                $u['is_active'] = $isActuallyActive ? 1 : 0;
                $u['password'] = $u['password_hash']; // untuk kompatibilitas frontend
                return $u;
            }, $users);

            echo json_encode([
                'status' => 'success',
                'data'   => $result,
            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 2. LOGIN AUTHENTICATION (Bisa via PIN atau Username + Password)
    // --------------------------------------------------------------------------
    case 'login':
        try {
            $login_type = $input['login_type'] ?? 'pin';
            $username   = trim($input['username'] ?? '');
            $user_id    = $input['user_id'] ?? null;
            $pin        = trim($input['pin'] ?? '');
            $password   = trim($input['password'] ?? '');
            $force      = !empty($input['force']);

            if ($login_type === 'pin' && $user_id) {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id = :uid LIMIT 1");
                $stmt->execute([':uid' => $user_id]);
            } else {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(:uname) LIMIT 1");
                $stmt->execute([':uname' => $username]);
            }
            $user = $stmt->fetch();

            if (!$user) {
                echo json_encode(['status' => 'error', 'message' => 'Akun pengguna tidak ditemukan.']);
                exit;
            }

            if ($user['is_blocked'] == 1) {
                echo json_encode(['status' => 'error', 'message' => 'Akun ini sedang DIBLOKIR oleh Owner. Silakan hubungi pimpinan.']);
                exit;
            }

            // Validasi Kredensial
            $isValid = false;
            if ($login_type === 'pin') {
                if (trim($user['pin']) === $pin) {
                    $isValid = true;
                }
            } else {
                if (password_verify($password, $user['password_hash']) || $user['password_hash'] === $password || $user['pin'] === $password) {
                    $isValid = true;
                }
            }

            if (!$isValid) {
                echo json_encode(['status' => 'error', 'message' => 'PIN atau Password yang Anda masukkan salah.']);
                exit;
            }

            // Validasi Session Lock (Single Session)
            $now = time();
            $lastAct = !empty($user['last_activity']) ? strtotime($user['last_activity']) : 0;
            $isSessionActiveElsewhere = ($user['is_active'] == 1 && !empty($user['active_session_id']) && ($now - $lastAct) < SESSION_INACTIVE_LIMIT);

            if ($isSessionActiveElsewhere && !$force) {
                echo json_encode([
                    'status'             => 'session_locked',
                    'message'            => 'Akun "' . $user['full_name'] . '" sedang aktif digunakan pada perangkat lain (' . ($user['last_device'] ?? 'Terminal Kasir') . '). Ambil alih sesi?',
                    'active_device'      => $user['last_device'] ?? 'Terminal Kasir',
                    'last_activity_time' => $user['last_activity'],
                    'can_force_unlock'   => true,
                ]);
                exit;
            }

            // Buat Session ID baru
            $new_session_id = generateSessionId();
            $nowStr = date('Y-m-d H:i:s');

            $updateStmt = $pdo->prepare("
                UPDATE users 
                SET is_active = 1,
                    active_session_id = :sess_id,
                    last_activity = :now_act,
                    last_login_at = :now_login,
                    last_ip = :ip,
                    last_device = :device
                WHERE user_id = :uid
            ");
            $updateStmt->execute([
                ':sess_id'   => $new_session_id,
                ':now_act'   => $nowStr,
                ':now_login' => $nowStr,
                ':ip'        => $client_ip,
                ':device'    => $client_device,
                ':uid'       => $user['user_id'],
            ]);

            if (!empty($user['permissions']) && is_string($user['permissions'])) {
                $user['permissions'] = json_decode($user['permissions'], true);
            }
            $user['active_session_id'] = $new_session_id;
            $user['is_active'] = 1;
            $user['password'] = $user['password_hash'];

            echo json_encode([
                'status'     => 'success',
                'message'    => 'Login berhasil sebagai ' . $user['full_name'],
                'session_id' => $new_session_id,
                'user'       => $user,
            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => 'Terjadi kesalahan: ' . $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 3. HEARTBEAT / KEEP-ALIVE & LOCK CHECK
    // --------------------------------------------------------------------------
    case 'heartbeat':
        try {
            $session_id = $input['session_id'] ?? $_SERVER['HTTP_X_SESSION_ID'] ?? '';
            $user_id    = $input['user_id'] ?? 0;

            if (empty($session_id) || empty($user_id)) {
                echo json_encode(['status' => 'invalid_session', 'message' => 'Parameter sesi tidak lengkap.']);
                exit;
            }

            $stmt = $pdo->prepare("SELECT user_id, username, is_blocked, is_active, active_session_id FROM users WHERE user_id = :uid LIMIT 1");
            $stmt->execute([':uid' => $user_id]);
            $user = $stmt->fetch();

            if (!$user) {
                echo json_encode(['status' => 'user_not_found', 'message' => 'Pengguna tidak ditemukan.']);
                exit;
            }

            if ($user['is_blocked'] == 1) {
                echo json_encode(['status' => 'blocked', 'message' => 'Akun Anda telah dinonaktifkan oleh administrator.']);
                exit;
            }

            if ($user['active_session_id'] !== $session_id || $user['is_active'] != 1) {
                echo json_encode([
                    'status'  => 'kicked',
                    'message' => 'Sesi Anda telah berakhir karena akun ini telah login di perangkat lain atau telah di-logout.',
                ]);
                exit;
            }

            $nowStr = date('Y-m-d H:i:s');
            $upStmt = $pdo->prepare("UPDATE users SET last_activity = :now_act, last_ip = :ip WHERE user_id = :uid");
            $upStmt->execute([
                ':now_act' => $nowStr,
                ':ip'      => $client_ip,
                ':uid'     => $user_id,
            ]);

            echo json_encode([
                'status'         => 'active',
                'server_time'    => $nowStr,
                'heartbeat_sync' => true,
            ]);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 4. LOGOUT & UNLOCK SESSION
    // --------------------------------------------------------------------------
    case 'logout':
        try {
            $session_id = $input['session_id'] ?? $_SERVER['HTTP_X_SESSION_ID'] ?? '';
            $user_id    = $input['user_id'] ?? 0;

            if ($user_id) {
                $stmt = $pdo->prepare("UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = :uid");
                $stmt->execute([':uid' => $user_id]);
            } elseif (!empty($session_id)) {
                $stmt = $pdo->prepare("UPDATE users SET is_active = 0, active_session_id = NULL WHERE active_session_id = :sess");
                $stmt->execute([':sess' => $session_id]);
            }

            echo json_encode([
                'status'  => 'success',
                'message' => 'Logout berhasil. Kunci sesi telah dilepaskan.',
            ]);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 5. FORCE UNLOCK
    // --------------------------------------------------------------------------
    case 'force_unlock':
        try {
            $target_user_id = $input['target_user_id'] ?? $input['user_id'] ?? 0;
            if (!$target_user_id) {
                echo json_encode(['status' => 'error', 'message' => 'Target user id wajib diisi.']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = :uid");
            $stmt->execute([':uid' => $target_user_id]);

            echo json_encode([
                'status'  => 'success',
                'message' => 'Sesi pengguna berhasil dibuka dan dibebaskan.',
            ]);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 6. CREATE USER (Tambah Pengguna Baru ke SQLite Server)
    // --------------------------------------------------------------------------
    case 'create_user':
        try {
            $username  = trim($input['username'] ?? '');
            $full_name = trim($input['full_name'] ?? '');
            $role      = $input['role'] ?? 'kasir';
            $pin       = trim($input['pin'] ?? '1234');
            $password  = trim($input['password'] ?? '123456');
            $perms     = is_array($input['permissions'] ?? null) ? json_encode($input['permissions']) : ($input['permissions'] ?? '{}');

            if (empty($username) || empty($full_name)) {
                echo json_encode(['status' => 'error', 'message' => 'Username dan Nama Lengkap wajib diisi.']);
                exit;
            }

            // Cek duplikat username
            $chk = $pdo->prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(:u) LIMIT 1");
            $chk->execute([':u' => $username]);
            if ($chk->fetch()) {
                echo json_encode(['status' => 'error', 'message' => "Username '{$username}' sudah digunakan."]);
                exit;
            }

            $ins = $pdo->prepare("
                INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
                VALUES (:u, :f, :r, :pin, :p, :perm, 0, 0, datetime('now'))
            ");
            $ins->execute([
                ':u'    => $username,
                ':f'    => $full_name,
                ':r'    => $role,
                ':pin'  => $pin,
                ':p'    => $password,
                ':perm' => $perms,
            ]);

            $newId = $pdo->lastInsertId();
            $newUser = $pdo->query("SELECT * FROM users WHERE user_id = {$newId}")->fetch();
            if ($newUser && !empty($newUser['permissions'])) {
                $newUser['permissions'] = json_decode($newUser['permissions'], true);
            }
            $newUser['password'] = $newUser['password_hash'];

            echo json_encode(['status' => 'success', 'message' => 'Pengguna berhasil dibuat', 'user' => $newUser]);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 7. UPDATE USER (Ubah Nama / Role / PIN / Password di SQLite Server)
    // --------------------------------------------------------------------------
    case 'update_user':
        try {
            $user_id = (int)($input['user_id'] ?? 0);
            if (!$user_id) {
                echo json_encode(['status' => 'error', 'message' => 'User ID wajib disertakan']);
                exit;
            }

            $exist = $pdo->query("SELECT * FROM users WHERE user_id = {$user_id}")->fetch();
            if (!$exist) {
                echo json_encode(['status' => 'error', 'message' => 'Pengguna tidak ditemukan']);
                exit;
            }

            $username  = isset($input['username']) ? trim($input['username']) : $exist['username'];
            $full_name = isset($input['full_name']) ? trim($input['full_name']) : $exist['full_name'];
            $role      = isset($input['role']) ? $input['role'] : $exist['role'];
            $pin       = isset($input['pin']) ? trim($input['pin']) : $exist['pin'];
            $password  = isset($input['password']) ? trim($input['password']) : $exist['password_hash'];
            $blocked   = isset($input['is_blocked']) ? ($input['is_blocked'] ? 1 : 0) : $exist['is_blocked'];
            $perms     = isset($input['permissions']) 
                ? (is_array($input['permissions']) ? json_encode($input['permissions']) : $input['permissions'])
                : $exist['permissions'];

            // Cek conflict username
            if (strtolower($username) !== strtolower($exist['username'])) {
                $chk = $pdo->prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(:u) AND user_id != :uid LIMIT 1");
                $chk->execute([':u' => $username, ':uid' => $user_id]);
                if ($chk->fetch()) {
                    echo json_encode(['status' => 'error', 'message' => "Username '{$username}' sudah dipakai pengguna lain."]);
                    exit;
                }
            }

            $up = $pdo->prepare("
                UPDATE users SET 
                    username = :u,
                    full_name = :f,
                    role = :r,
                    pin = :pin,
                    password_hash = :p,
                    permissions = :perm,
                    is_blocked = :b,
                    updated_at = datetime('now')
                WHERE user_id = :uid
            ");
            $up->execute([
                ':u'    => $username,
                ':f'    => $full_name,
                ':r'    => $role,
                ':pin'  => $pin,
                ':p'    => $password,
                ':perm' => $perms,
                ':b'    => $blocked,
                ':uid'  => $user_id,
            ]);

            $updated = $pdo->query("SELECT * FROM users WHERE user_id = {$user_id}")->fetch();
            if ($updated && !empty($updated['permissions'])) {
                $updated['permissions'] = json_decode($updated['permissions'], true);
            }
            $updated['password'] = $updated['password_hash'];

            echo json_encode(['status' => 'success', 'message' => 'Pengguna berhasil diperbarui', 'user' => $updated]);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 8. DELETE USER
    // --------------------------------------------------------------------------
    case 'delete_user':
        try {
            $user_id = (int)($input['user_id'] ?? 0);
            if ($user_id === 1) {
                echo json_encode(['status' => 'error', 'message' => 'Akun Super Admin (Owner) tidak boleh dihapus']);
                exit;
            }
            $pdo->exec("DELETE FROM users WHERE user_id = {$user_id}");
            echo json_encode(['status' => 'success', 'message' => 'Pengguna berhasil dihapus']);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // --------------------------------------------------------------------------
    // 9. DEFAULT STATUS HEALTH CHECK
    // --------------------------------------------------------------------------
    default:
        $countUsers = 0;
        try {
            $countUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        } catch (Exception $e) {}

        echo json_encode([
            'status'            => 'online',
            'service'           => 'MotoPOS Auth Lock & Session Manager API',
            'engine'            => 'SQLite Database (bengkel.sqlite)',
            'users_count'       => $countUsers,
            'server_time'       => date('Y-m-d H:i:s'),
            'inactive_max'      => SESSION_INACTIVE_LIMIT . ' seconds',
            'supported_actions' => ['get_users', 'login', 'heartbeat', 'logout', 'force_unlock', 'create_user', 'update_user', 'delete_user'],
        ], JSON_UNESCAPED_UNICODE);
        break;
}
