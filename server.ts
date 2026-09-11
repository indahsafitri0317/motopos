import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'sqlite-node', timestamp: new Date().toISOString() });
  });

  // Initialize SQLite database
  const db = await getDb();
  console.log('[Server] SQLite database initialized successfully.');

  // ==========================================
  // STORE & RECEIPT SETTINGS API (SQLite Server)
  // ==========================================
  app.get('/api/settings/store', async (req, res) => {
    try {
      const row = await db.get('SELECT * FROM store_settings WHERE id = 1');
      if (!row) {
        return res.json({
          store_name: 'BENGKEL & TOKO OLI MOTOR',
          store_address: 'Jl. Raya Otomotif No. 88, Sentra Onderdil',
          store_phone: '0812-3456-7890',
          receipt_footer_1: '*** TERIMA KASIH ***',
          receipt_footer_2: 'Perawatan rutin menjaga performa & keselamatan motor Anda.',
          receipt_footer_3: 'Servis berikutnya: 2.000 KM / 60 Hari.',
        });
      }
      res.json({
        store_name: row.store_name,
        store_address: row.store_address,
        store_phone: row.store_phone,
        receipt_footer_1: row.receipt_footer_1,
        receipt_footer_2: row.receipt_footer_2,
        receipt_footer_3: row.receipt_footer_3,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings/store', async (req, res) => {
    try {
      const {
        store_name,
        store_address,
        store_phone,
        receipt_footer_1,
        receipt_footer_2,
        receipt_footer_3,
      } = req.body;

      const sName = (store_name || '').trim() || 'BENGKEL & TOKO OLI MOTOR';
      const sAddr = (store_address || '').trim();
      const sPhone = (store_phone || '').trim();
      const f1 = receipt_footer_1 !== undefined ? String(receipt_footer_1).trim() : '*** TERIMA KASIH ***';
      const f2 = receipt_footer_2 !== undefined ? String(receipt_footer_2).trim() : 'Perawatan rutin menjaga performa & keselamatan motor Anda.';
      const f3 = receipt_footer_3 !== undefined ? String(receipt_footer_3).trim() : 'Servis berikutnya: 2.000 KM / 60 Hari.';

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

      res.json({ success: true, message: 'Pengaturan nota toko berhasil disimpan di server.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 0. USERS & AUTH MANAGEMENT API (SQLite Server)
  // ==========================================
  app.get('/api/users', async (req, res) => {
    try {
      const rows = await db.all('SELECT * FROM users ORDER BY user_id ASC');
      const users = rows.map((r: any) => ({
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
        permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '{}') : (r.permissions || {}),
        created_at: r.created_at,
      }));
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { username, full_name, role, pin, password, permissions } = req.body;
      if (!username || !username.trim() || !full_name || !full_name.trim()) {
        return res.status(400).json({ error: 'Username dan Nama Lengkap wajib diisi' });
      }
      const existing = await db.get('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
      if (existing) {
        return res.status(400).json({ error: `Username "${username}" sudah digunakan.` });
      }
      const permJson = typeof permissions === 'object' ? JSON.stringify(permissions) : (permissions || '{}');
      const result = await db.run(
        `INSERT INTO users (username, full_name, role, pin, password_hash, permissions, is_blocked, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`,
        [username.trim(), full_name.trim(), role || 'kasir', pin?.trim() || '1234', password?.trim() || '123456', permJson]
      );
      const newUser = await db.get('SELECT * FROM users WHERE user_id = ?', [result.lastID]);
      res.status(201).json({
        user_id: newUser.user_id,
        username: newUser.username,
        full_name: newUser.full_name,
        role: newUser.role,
        is_blocked: newUser.is_blocked,
        is_active: 0,
        permissions: typeof newUser.permissions === 'string' ? JSON.parse(newUser.permissions || '{}') : (newUser.permissions || {}),
        created_at: newUser.created_at
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.get('SELECT * FROM users WHERE user_id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }
      const { username, full_name, role, pin, password, permissions, is_blocked } = req.body;
      if (username && username.trim().toLowerCase() !== existing.username.toLowerCase()) {
        const conflict = await db.get('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) AND user_id != ?', [username.trim(), id]);
        if (conflict) {
          return res.status(400).json({ error: `Username "${username}" sudah digunakan pengguna lain.` });
        }
      }
      const newUsername = username !== undefined ? username.trim() : existing.username;
      const newFullName = full_name !== undefined ? full_name.trim() : existing.full_name;
      const newRole = role !== undefined ? role : existing.role;
      const newPin = (pin !== undefined && pin.trim() !== '') ? pin.trim() : existing.pin;
      const newPass = (password !== undefined && password.trim() !== '') ? password.trim() : existing.password_hash;
      const newBlocked = is_blocked !== undefined ? (is_blocked ? 1 : 0) : existing.is_blocked;
      const newPerms = permissions !== undefined ? (typeof permissions === 'object' ? JSON.stringify(permissions) : permissions) : existing.permissions;

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

      const updated = await db.get('SELECT * FROM users WHERE user_id = ?', [id]);
      res.json({
        user_id: updated.user_id,
        username: updated.username,
        full_name: updated.full_name,
        role: updated.role,
        is_blocked: updated.is_blocked,
        is_active: updated.is_active,
        permissions: typeof updated.permissions === 'string' ? JSON.parse(updated.permissions || '{}') : (updated.permissions || {}),
        updated_at: updated.updated_at
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (id === 1) {
        return res.status(400).json({ error: 'Akun Super Admin (Owner) utama tidak dapat dihapus!' });
      }
      const existing = await db.get('SELECT user_id FROM users WHERE user_id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }
      await db.run('DELETE FROM users WHERE user_id = ?', [id]);
      res.json({ success: true, message: 'Pengguna berhasil dihapus' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users/session', async (req, res) => {
    try {
      const { action, user_id, session_id, force, login_type, pin, username, password } = req.body;
      const nowIso = new Date().toISOString();

      if (action === 'login') {
        let user: any = null;
        if (login_type === 'pin' && user_id) {
          user = await db.get('SELECT * FROM users WHERE user_id = ?', [user_id]);
          if (!user) return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
          if (user.pin.trim() !== String(pin || '').trim()) {
            return res.status(401).json({ status: 'error', message: 'PIN yang Anda masukkan salah!' });
          }
        } else if (username) {
          user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [String(username).trim()]);
          if (!user) return res.status(404).json({ status: 'error', message: 'Username tidak ditemukan' });
          const cleanP = String(password || '').trim();
          if (user.password_hash !== cleanP && user.pin !== cleanP) {
            return res.status(401).json({ status: 'error', message: 'Password atau PIN salah!' });
          }
        } else {
          return res.status(400).json({ status: 'error', message: 'Parameter login tidak lengkap' });
        }

        if (user.is_blocked === 1) {
          return res.status(403).json({ status: 'error', message: 'Akun ini sedang diblokir oleh Owner.' });
        }

        // Check if session is already active in another device
        const isActive = user.is_active === 1;
        const hasSession = !!user.active_session_id;
        let isTimeout = true;
        if (user.last_activity) {
          const lastTime = new Date(user.last_activity).getTime();
          const diffSec = (Date.now() - lastTime) / 1000;
          if (diffSec < 300) {
            isTimeout = false;
          }
        }

        if (isActive && hasSession && !isTimeout && !force) {
          return res.json({
            status: 'session_locked',
            message: `Akun "${user.full_name}" sedang aktif pada perangkat lain.`,
            active_device: user.last_device || 'Terminal Kasir Lain',
            last_activity_time: user.last_activity || 'Baru saja',
            can_force_unlock: true,
          });
        }

        // Grant session
        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await db.run(
          `UPDATE users SET
             is_active = 1,
             active_session_id = ?,
             last_activity = datetime('now'),
             last_login_at = datetime('now'),
             last_device = ?
           WHERE user_id = ?`,
          [newSessionId, (req.headers['user-agent'] as string)?.slice(0, 50) || 'Browser Terminal', user.user_id]
        );

        const perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : (user.permissions || {});
        return res.json({
          status: 'success',
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
            last_login_at: nowIso,
          },
        });
      }

      if (action === 'heartbeat') {
        if (!user_id || !session_id) {
          return res.json({ status: 'invalid_params' });
        }
        const user = await db.get('SELECT user_id, active_session_id, is_blocked, is_active FROM users WHERE user_id = ?', [user_id]);
        if (!user || user.is_blocked === 1) {
          return res.json({ status: 'blocked', message: 'Akun telah dinonaktifkan.' });
        }
        if (user.active_session_id !== session_id) {
          return res.json({ status: 'kicked', message: 'Akun telah login di perangkat lain.' });
        }
        await db.run("UPDATE users SET last_activity = datetime('now') WHERE user_id = ?", [user_id]);
        return res.json({ status: 'ok' });
      }

      if (action === 'logout') {
        if (user_id) {
          await db.run('UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = ?', [user_id]);
        } else if (session_id) {
          await db.run('UPDATE users SET is_active = 0, active_session_id = NULL WHERE active_session_id = ?', [session_id]);
        }
        return res.json({ status: 'success', message: 'Logout berhasil' });
      }

      if (action === 'force_unlock') {
        const targetId = req.body.target_user_id || user_id;
        if (targetId) {
          await db.run('UPDATE users SET is_active = 0, active_session_id = NULL WHERE user_id = ?', [targetId]);
        }
        return res.json({ status: 'success', message: 'Kunci sesi berhasil dibebaskan' });
      }

      return res.status(400).json({ error: 'Aksi sesi tidak dikenal' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 1. CATEGORIES API
  // ==========================================
  app.get('/api/categories', async (req, res) => {
    try {
      const rows = await db.all('SELECT * FROM categories ORDER BY name ASC');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nama kategori wajib diisi' });
      }
      const result = await db.run('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
      res.status(201).json({ category_id: result.lastID, name: name.trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nama kategori wajib diisi' });
      }
      await db.run('UPDATE categories SET name = ? WHERE category_id = ?', [name.trim(), id]);
      res.json({ message: 'Kategori berhasil diperbarui', category_id: Number(id), name: name.trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      // Check if category is used by any products
      const count = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
        [id]
      );
      if (count && count.count > 0) {
        return res.status(400).json({
          error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${count.count} produk. Hapus atau pindahkan produk terkait terlebih dahulu.`,
        });
      }
      await db.run('DELETE FROM categories WHERE category_id = ?', [id]);
      res.json({ message: 'Kategori berhasil dihapus' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 2. PRODUCTS API
  // ==========================================
  app.get('/api/products', async (req, res) => {
    try {
      const { search, category_id, low_stock } = req.query;
      let sql = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search) {
        sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.compatibility LIKE ?)`;
        const q = `%${search}%`;
        params.push(q, q, q);
      }

      if (category_id) {
        sql += ` AND p.category_id = ?`;
        params.push(Number(category_id));
      }

      if (low_stock === 'true') {
        sql += ` AND p.stock <= p.min_stock`;
      }

      sql += ` ORDER BY p.name ASC`;
      const rows = await db.all(sql, params);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', async (req, res) => {
    try {
      const { sku, name, category_id, buy_price, sell_price, stock, min_stock, compatibility, image_url } = req.body;
      if (!sku || !name) {
        return res.status(400).json({ error: 'SKU dan Nama produk wajib diisi' });
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
          compatibility ? compatibility.trim() : '',
          image_url ? String(image_url).trim() : null,
        ]
      );
      res.status(201).json({ product_id: result.lastID, message: 'Produk berhasil ditambahkan' });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed: products.sku')) {
        return res.status(400).json({ error: 'SKU produk sudah terdaftar, gunakan kode lain' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', async (req, res) => {
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
          compatibility ? compatibility.trim() : '',
          image_url !== undefined ? (image_url ? String(image_url).trim() : null) : null,
          id,
        ]
      );
      res.json({ message: 'Produk berhasil diperbarui' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      // Check if product used in sales
      const count = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM sale_details WHERE product_id = ?',
        [id]
      );
      if (count && count.count > 0) {
        return res.status(400).json({
          error: 'Produk tidak dapat dihapus karena sudah memiliki riwayat transaksi penjualan.',
        });
      }
      await db.run('DELETE FROM products WHERE product_id = ?', [id]);
      res.json({ message: 'Produk berhasil dihapus' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/adjust-stock', async (req, res) => {
    try {
      const { id } = req.params;
      const { adjustment, new_stock } = req.body;
      if (new_stock !== undefined) {
        await db.run('UPDATE products SET stock = ? WHERE product_id = ?', [Number(new_stock), id]);
      } else if (adjustment !== undefined) {
        await db.run('UPDATE products SET stock = stock + ? WHERE product_id = ?', [Number(adjustment), id]);
      }
      const updated = await db.get('SELECT * FROM products WHERE product_id = ?', [id]);
      res.json({ message: 'Stok berhasil diperbarui', product: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 3. CUSTOMERS & VEHICLES API
  // ==========================================
  app.get('/api/customers', async (req, res) => {
    try {
      const rows = await db.all(`
        SELECT c.*, COUNT(v.vehicle_id) as vehicle_count
        FROM customers c
        LEFT JOIN vehicles v ON c.customer_id = v.customer_id
        GROUP BY c.customer_id
        ORDER BY c.name ASC
      `);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ error: 'Nama dan nomor telepon pelanggan wajib diisi' });
      }
      const today = new Date().toISOString().split('T')[0];
      const result = await db.run(
        'INSERT INTO customers (name, phone, created_at) VALUES (?, ?, ?)',
        [name.trim(), phone.trim(), today]
      );
      res.status(201).json({ customer_id: result.lastID, name, phone });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      await db.run('UPDATE customers SET name = ?, phone = ? WHERE customer_id = ?', [
        name.trim(),
        phone.trim(),
        id,
      ]);
      res.json({ message: 'Pelanggan berhasil diperbarui' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/vehicles', async (req, res) => {
    try {
      const { search } = req.query;
      let sql = `
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v
        JOIN customers c ON v.customer_id = c.customer_id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (search) {
        sql += ` AND (v.plate_number LIKE ? OR v.brand_model LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
        const q = `%${search}%`;
        params.push(q, q, q, q);
      }
      sql += ` ORDER BY v.plate_number ASC`;
      const rows = await db.all(sql, params);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/vehicles', async (req, res) => {
    try {
      const { customer_id, plate_number, brand_model, last_km, last_service_date } = req.body;
      if (!customer_id || !plate_number || !brand_model) {
        return res.status(400).json({ error: 'Pelanggan, Plat Nomor, dan Tipe Motor wajib diisi' });
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
          last_service_date || new Date().toISOString().split('T')[0],
        ]
      );
      res.status(201).json({ vehicle_id: result.lastID, message: 'Kendaraan berhasil ditambahkan' });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed: vehicles.plate_number')) {
        return res.status(400).json({ error: 'Plat nomor motor sudah terdaftar di sistem' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/vehicles/:id', async (req, res) => {
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
          id,
        ]
      );
      res.json({ message: 'Data kendaraan berhasil diperbarui' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 4. MECHANICS API
  // ==========================================
  app.get('/api/mechanics', async (req, res) => {
    try {
      const rows = await db.all('SELECT * FROM mechanics ORDER BY name ASC');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/mechanics', async (req, res) => {
    try {
      const { name, phone } = req.body;
      if (!name) return res.status(400).json({ error: 'Nama mekanik wajib diisi' });
      const result = await db.run('INSERT INTO mechanics (name, phone) VALUES (?, ?)', [
        name.trim(),
        phone ? phone.trim() : '',
      ]);
      res.status(201).json({ mechanic_id: result.lastID, name, phone });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/mechanics/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      await db.run('UPDATE mechanics SET name = ?, phone = ? WHERE mechanic_id = ?', [
        name.trim(),
        phone ? phone.trim() : '',
        id,
      ]);
      res.json({ message: 'Data mekanik berhasil diperbarui' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/mechanics/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM mechanics WHERE mechanic_id = ?', [id]);
      res.json({ message: 'Mekanik berhasil dihapus' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 5. KASIR POS CHECKOUT (ATOMIC TRANSACTION)
  // ==========================================
  app.post('/api/checkout', async (req, res) => {
    const { vehicle_id, current_km, payment_method, mechanic_id, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja tidak boleh kosong' });
    }

    if (!payment_method) {
      return res.status(400).json({ error: 'Metode pembayaran wajib dipilih' });
    }

    // Begin atomic SQLite transaction
    await db.exec('BEGIN TRANSACTION;');

    try {
      // 1. Stock validation for physical goods (is_service == 0)
      for (const item of items) {
        if (!item.is_service && item.product_id) {
          const product = await db.get<{ stock: number; name: string }>(
            'SELECT stock, name FROM products WHERE product_id = ?',
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

      // 2. Generate unique invoice number: INV-YYYYMMDD-XXXX
      const todayStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 8);
      const countRes = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM sales WHERE invoice_number LIKE ?`,
        [`INV-${todayStr}-%`]
      );
      const sequence = String((countRes?.count || 0) + 1).padStart(3, '0');
      const invoiceNumber = `INV-${todayStr}-${sequence}`;

      // 3. Compute totals
      let totalAmount = 0;
      let totalHpp = 0;

      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const sellPrice = Number(item.sell_price) || 0;
        const buyPrice = Number(item.buy_price) || 0;
        totalAmount += qty * sellPrice;
        totalHpp += qty * buyPrice;
      }

      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

      // 4. Insert into sales table
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
          mechanic_id ? Number(mechanic_id) : null,
        ]
      );
      const saleId = saleResult.lastID;

      // 5. Insert details and update product stocks atomically
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
            item.item_name || 'Item',
            qty,
            buyPrice,
            sellPrice,
            subtotal,
            isService,
          ]
        );

        // Deduct inventory only for physical products
        if (!isService && item.product_id) {
          await db.run(
            `UPDATE products SET stock = stock - ? WHERE product_id = ?`,
            [qty, item.product_id]
          );
        }
      }

      // 6. Update Vehicle KM and Last Service Date atomically if vehicle provided
      if (vehicle_id) {
        const todayDate = new Date().toISOString().split('T')[0];
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

      // All good -> commit transaction!
      await db.exec('COMMIT;');

      // Fetch complete sale for receipt response
      const saleRecord = await db.get(
        `SELECT s.*, v.plate_number, v.brand_model, m.name as mechanic_name
         FROM sales s
         LEFT JOIN vehicles v ON s.vehicle_id = v.vehicle_id
         LEFT JOIN mechanics m ON s.mechanic_id = m.mechanic_id
         WHERE s.sale_id = ?`,
        [saleId]
      );
      const saleDetails = await db.all(
        'SELECT * FROM sale_details WHERE sale_id = ?',
        [saleId]
      );

      res.status(201).json({
        success: true,
        message: 'Transaksi berhasil disimpan secara atomic!',
        sale: saleRecord,
        details: saleDetails,
      });
    } catch (err: any) {
      // Rollback on any failure to preserve DB integrity
      console.error('[Checkout Error - Rollback triggered]:', err.message);
      await db.exec('ROLLBACK;');
      res.status(400).json({ error: err.message || 'Gagal memproses transaksi kasir' });
    }
  });

  // ==========================================
  // 6. SALES & TRANSACTIONS HISTORY API
  // ==========================================
  app.get('/api/sales', async (req, res) => {
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
      const params: any[] = [];
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sales/:id', async (req, res) => {
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
      if (!sale) return res.status(404).json({ error: 'Nota tidak ditemukan' });

      const details = await db.all(
        'SELECT * FROM sale_details WHERE sale_id = ?',
        [id]
      );
      res.json({ sale, details });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 7. CRM PENGINGAT SERVIS API
  // ==========================================
  app.get('/api/crm/reminders', async (req, res) => {
    try {
      const vehicles = await db.all(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM vehicles v
        JOIN customers c ON v.customer_id = c.customer_id
        ORDER BY v.last_service_date ASC
      `);

      const today = new Date();
      const reminders = vehicles.map((v) => {
        let daysSinceService = 999;
        if (v.last_service_date) {
          const sDate = new Date(v.last_service_date);
          const diffMs = today.getTime() - sDate.getTime();
          daysSinceService = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }

        // Daily usage estimation for motorcycles in Indonesia: ~35 km/day
        const estimatedKmIncrease = Math.round(daysSinceService * 35);
        const estimatedCurrentKm = v.last_km + estimatedKmIncrease;

        const isOverdueDays = daysSinceService >= 60;
        const isOverdueKm = estimatedKmIncrease >= 2000;
        const isDue = isOverdueDays || isOverdueKm;

        let status: 'OVERDUE' | 'DUE_SOON' | 'GOOD' = 'GOOD';
        if (daysSinceService >= 60 || estimatedKmIncrease >= 2000) {
          status = 'OVERDUE';
        } else if (daysSinceService >= 45 || estimatedKmIncrease >= 1500) {
          status = 'DUE_SOON';
        }

        // Format friendly WhatsApp reminder text
        const waMsg = `Halo Kak ${v.customer_name}, kami dari Bengkel & Toko Sparepart Motor. Mengingatkan bahwa motor ${v.brand_model} (${v.plate_number}) sudah saatnya servis berkala / ganti oli.\n\n` +
          `📌 Terakhir Servis: ${v.last_service_date || '-'}\n` +
          `📌 KM Terakhir: ${v.last_km.toLocaleString('id-ID')} KM\n` +
          `📌 Estimasi KM Saat Ini: ~${estimatedCurrentKm.toLocaleString('id-ID')} KM (+${estimatedKmIncrease.toLocaleString('id-ID')} KM)\n` +
          `📌 Waktu Berlalu: ${daysSinceService} hari yang lalu\n\n` +
          `Jadwalkan servis Anda sekarang untuk menjaga performa mesin tetap prima! Hubungi kami untuk reservasi atau langsung datang ke bengkel. Terima kasih! 🙏`;

        // Clean phone number (convert 08... to 628...)
        let cleanPhone = (v.customer_phone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.slice(1);
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
          wa_url: waUrl,
        };
      });

      res.json(reminders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 8. LAPORAN BISNIS API
  // ==========================================
  // A. Laba Rugi Kotor & Ringkasan Penjualan
  app.get('/api/reports/profit-loss', async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
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

      const salesList = await db.all(sqlSales, params);

      let totalOmzet = 0;
      let totalHpp = 0;
      salesList.forEach((s) => {
        totalOmzet += s.total_amount;
        totalHpp += s.total_hpp;
      });

      const grossProfit = totalOmzet - totalHpp;
      const profitMarginPct = totalOmzet > 0 ? (grossProfit / totalOmzet) * 100 : 0;

      // Breakdown by items vs services
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
          qty: goodsRow.total_qty || 0,
        },
        services: {
          omzet: serviceRow.total_omzet || 0,
          hpp: serviceRow.total_hpp || 0,
          profit: (serviceRow.total_omzet || 0) - (serviceRow.total_hpp || 0),
          qty: serviceRow.total_qty || 0,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // B. Fast-Moving vs Slow-Moving items
  app.get('/api/reports/movement', async (req, res) => {
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

      const rows = await db.all(sql, params);

      // Also get all products that have 0 sales in the period (Dead/Slow stock)
      const allProducts = await db.all(`
        SELECT p.product_id, p.sku, p.name as item_name, c.name as category_name, p.stock as current_stock, p.min_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
      `);

      const soldItemNames = new Set(rows.map((r) => r.item_name));
      const zeroSalesProducts = allProducts
        .filter((p) => !soldItemNames.has(p.item_name))
        .map((p) => ({
          product_id: p.product_id,
          sku: p.sku,
          item_name: p.item_name,
          category_name: p.category_name || 'Uncategorized',
          current_stock: p.current_stock,
          min_stock: p.min_stock,
          is_service: 0,
          total_sold_qty: 0,
          total_revenue: 0,
          total_profit: 0,
          movement_class: 'SLOW_OR_ZERO',
        }));

      // Classify items into Fast vs Normal vs Slow moving
      const enrichedRows = rows.map((r) => {
        let movementClass = 'SLOW';
        if (r.total_sold_qty >= 3) {
          movementClass = 'FAST';
        } else if (r.total_sold_qty >= 1) {
          movementClass = 'NORMAL';
        }
        return {
          ...r,
          movement_class: movementClass,
        };
      });

      res.json({
        items: [...enrichedRows, ...zeroSalesProducts],
        fast_moving: enrichedRows.filter((r) => r.movement_class === 'FAST'),
        slow_moving: [...enrichedRows.filter((r) => r.movement_class === 'SLOW'), ...zeroSalesProducts],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // C. Rekap Omzet Harian & Bulanan
  app.get('/api/reports/recap', async (req, res) => {
    try {
      // Daily recap for current/recent 30 days
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

      // Monthly recap
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

      // Payment method breakdown
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
        payment_methods: paymentRows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 9. SYNC & MONITORING API (FOR LARIZK.COM & APK)
  // ==========================================
  app.get('/api/sync/status', async (req, res) => {
    try {
      const unsyncedRow = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM sales WHERE is_synced = 0'
      );
      const totalRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM sales');
      const lastSyncedRow = await db.get<{ last_synced_at: string }>(
        'SELECT MAX(synced_at) as last_synced_at FROM sales WHERE is_synced = 1'
      );

      res.json({
        unsynced_count: unsyncedRow?.count || 0,
        total_sales: totalRow?.count || 0,
        last_synced_at: lastSyncedRow?.last_synced_at || null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sync/unsynced', async (req, res) => {
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
            items,
          };
        })
      );

      res.json(fullSales);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sync/mark-synced', async (req, res) => {
    try {
      const { sale_ids } = req.body;
      if (!sale_ids || !Array.isArray(sale_ids) || sale_ids.length === 0) {
        return res.status(400).json({ error: 'Daftar sale_ids wajib disertakan' });
      }

      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
      for (const id of sale_ids) {
        await db.run(
          `UPDATE sales SET is_synced = 1, synced_at = ? WHERE sale_id = ?`,
          [nowIso, Number(id)]
        );
      }

      res.json({
        success: true,
        message: `${sale_ids.length} transaksi berhasil ditandai tersinkron`,
        synced_at: nowIso,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Push to external sync API (e.g., https://larizk.com/api/sync_report-api.php)
  app.post('/api/sync/push', async (req, res) => {
    try {
      const {
        api_url = 'https://larizk.com/api/sync_report-api.php',
        api_key = 'LARIZK_BENGKEL_2026',
        device_id = 'TABLET-KASIR-01',
        force_all = false,
      } = req.body;

      // 1. Fetch transactions (unsynced only, or ALL if force_all is true)
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
          message: 'Belum ada data transaksi kasir di database lokal.',
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
            items,
          };
        })
      );

      const payload = {
        api_key,
        device_id,
        timestamp: new Date().toISOString(),
        total_records: fullSales.length,
        transactions: fullSales,
      };

      // Send to server
      let serverResponseText = '';
      let serverJson: any = null;

      try {
        const response = await fetch(api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MotoPOS-Tablet/1.0',
          },
          body: JSON.stringify(payload),
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
      } catch (fetchErr: any) {
        return res.status(502).json({
          error: `Gagal menghubungi server sync (${api_url}): ${fetchErr.message}`,
          payload_preview: payload,
        });
      }

      // 2. If server succeeded, mark transactions as synced
      const syncedSaleIds = fullSales.map((s) => s.sale_id);
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

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
        server_response: serverJson,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE (DEV) & STATIC (PROD)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MotoPOS Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MotoPOS Server Failed to Start]:', err);
  process.exit(1);
});
