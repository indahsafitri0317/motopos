import React, { useState, useEffect } from 'react';
import {
  Package,
  Users,
  Bike,
  Wrench,
  Tags,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Sliders,
  AlertTriangle,
  FolderEdit,
  Layers,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  RotateCcw,
} from 'lucide-react';
import { Product, Customer, Vehicle, Mechanic, Category } from '../../types/pos';
import { api } from '../../services/api';
import { authService } from '../../services/authService';
import { formatRupiah, formatDate } from '../../utils/formatters';
import { getProductImage } from '../../utils/productImages';

type MasterTab = 'products' | 'customers' | 'vehicles' | 'mechanics' | 'categories';

export const MasterDataView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MasterTab>('products');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [showMechanicModal, setShowMechanicModal] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<Mechanic | null>(null);

  // Category Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryAlertModal, setCategoryAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Restock quick modal
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState<string>('10');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [prod, cust, veh, mech, cat] = await Promise.all([
        api.getProducts(),
        api.getCustomers(),
        api.getVehicles(),
        api.getMechanics(),
        api.getCategories(),
      ]);
      setProducts(prod);
      setCustomers(cust);
      setVehicles(veh);
      setMechanics(mech);
      setCategories(cat);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Product Form state
  const [prodForm, setProdForm] = useState({
    sku: '',
    name: '',
    category_id: '',
    buy_price: '',
    sell_price: '',
    stock: '',
    min_stock: '5',
    compatibility: '',
    image_url: '',
  });

  const openProductForm = (p?: Product) => {
    clearMessages();
    if (p) {
      setEditingProduct(p);
      setProdForm({
        sku: p.sku,
        name: p.name,
        category_id: p.category_id ? String(p.category_id) : '',
        buy_price: String(p.buy_price),
        sell_price: String(p.sell_price),
        stock: String(p.stock),
        min_stock: String(p.min_stock),
        compatibility: p.compatibility || '',
        image_url: p.image_url || '',
      });
    } else {
      setEditingProduct(null);
      setProdForm({
        sku: `PRD-${Date.now().toString().slice(-4)}`,
        name: '',
        category_id: categories.length > 0 ? String(categories[0].category_id) : '',
        buy_price: '',
        sell_price: '',
        stock: '10',
        min_stock: '5',
        compatibility: '',
        image_url: '',
      });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      const payload = {
        sku: prodForm.sku,
        name: prodForm.name,
        category_id: prodForm.category_id ? Number(prodForm.category_id) : null,
        buy_price: Number(prodForm.buy_price) || 0,
        sell_price: Number(prodForm.sell_price) || 0,
        stock: Number(prodForm.stock) || 0,
        min_stock: Number(prodForm.min_stock) || 0,
        compatibility: prodForm.compatibility,
        image_url: prodForm.image_url ? prodForm.image_url.trim() : null,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.product_id, payload);
        setSuccessMsg('Produk berhasil diperbarui');
      } else {
        await api.addProduct(payload);
        setSuccessMsg('Produk baru berhasil ditambahkan');
      }
      setShowProductModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini dari database?')) return;
    clearMessages();
    try {
      await api.deleteProduct(id);
      setSuccessMsg('Produk berhasil dihapus');
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    clearMessages();
    const qty = Number(restockAmount);
    if (!qty || qty <= 0) return;

    try {
      await api.adjustStock(restockProduct.product_id, qty);
      setSuccessMsg(`Berhasil menambahkan +${qty} pcs stok untuk ${restockProduct.name}`);
      setRestockProduct(null);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Customer Form state
  const [custForm, setCustForm] = useState({ name: '', phone: '' });
  const openCustomerForm = (c?: Customer) => {
    clearMessages();
    if (c) {
      setEditingCustomer(c);
      setCustForm({ name: c.name, phone: c.phone });
    } else {
      setEditingCustomer(null);
      setCustForm({ name: '', phone: '' });
    }
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.customer_id, custForm.name, custForm.phone);
        setSuccessMsg('Pelanggan berhasil diperbarui');
      } else {
        await api.addCustomer(custForm.name, custForm.phone);
        setSuccessMsg('Pelanggan baru berhasil ditambahkan');
      }
      setShowCustomerModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Vehicle Form state
  const [vehForm, setVehForm] = useState({
    customer_id: '',
    plate_number: '',
    brand_model: '',
    last_km: '0',
    last_service_date: '',
  });

  const openVehicleForm = (v?: Vehicle) => {
    clearMessages();
    if (v) {
      setEditingVehicle(v);
      setVehForm({
        customer_id: String(v.customer_id),
        plate_number: v.plate_number,
        brand_model: v.brand_model,
        last_km: String(v.last_km),
        last_service_date: v.last_service_date || '',
      });
    } else {
      setEditingVehicle(null);
      setVehForm({
        customer_id: customers.length > 0 ? String(customers[0].customer_id) : '',
        plate_number: '',
        brand_model: '',
        last_km: '0',
        last_service_date: new Date().toISOString().split('T')[0],
      });
    }
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      const payload = {
        customer_id: Number(vehForm.customer_id),
        plate_number: vehForm.plate_number.toUpperCase(),
        brand_model: vehForm.brand_model,
        last_km: Number(vehForm.last_km) || 0,
        last_service_date: vehForm.last_service_date || null,
      };

      if (editingVehicle) {
        await api.updateVehicle(editingVehicle.vehicle_id, payload as any);
        setSuccessMsg('Kendaraan berhasil diperbarui');
      } else {
        await api.addVehicle(payload as any);
        setSuccessMsg('Kendaraan baru berhasil ditambahkan');
      }
      setShowVehicleModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Mechanic Form state
  const [mechForm, setMechForm] = useState({ name: '', phone: '' });
  const openMechanicForm = (m?: Mechanic) => {
    clearMessages();
    if (m) {
      setEditingMechanic(m);
      setMechForm({ name: m.name, phone: m.phone || '' });
    } else {
      setEditingMechanic(null);
      setMechForm({ name: '', phone: '' });
    }
    setShowMechanicModal(true);
  };

  const handleSaveMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      if (editingMechanic) {
        await api.updateMechanic(editingMechanic.mechanic_id, mechForm.name, mechForm.phone);
        setSuccessMsg('Mekanik berhasil diperbarui');
      } else {
        await api.addMechanic(mechForm.name, mechForm.phone);
        setSuccessMsg('Mekanik baru berhasil ditambahkan');
      }
      setShowMechanicModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteMechanic = async (id: number) => {
    if (!confirm('Hapus mekanik ini?')) return;
    try {
      await api.deleteMechanic(id);
      setSuccessMsg('Mekanik berhasil dihapus');
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // ==========================================
  // Category Management Handlers
  // ==========================================
  const openAddCategoryModal = () => {
    clearMessages();
    setEditingCategory(null);
    setCategoryNameInput('');
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    clearMessages();
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryNameInput.trim()) return;
    clearMessages();
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.category_id, categoryNameInput.trim());
        setSuccessMsg(`Kategori berhasil diperbarui menjadi "${categoryNameInput.trim()}"`);
      } else {
        await api.addCategory(categoryNameInput.trim());
        setSuccessMsg(`Kategori baru "${categoryNameInput.trim()}" berhasil ditambahkan`);
      }
      setShowCategoryModal(false);
      setCategoryNameInput('');
      setEditingCategory(null);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    clearMessages();
    // Count how many products are linked to this category
    const linkedProducts = products.filter((p) => p.category_id === cat.category_id);
    const count = linkedProducts.length;

    if (count > 0) {
      setCategoryAlertModal({
        isOpen: true,
        title: 'Kategori Tidak Dapat Dihapus',
        message: `Kategori "${cat.name}" saat ini masih digunakan oleh ${count} produk. Untuk menghapus kategori ini, harap ubah atau hapus produk-produk terkait terlebih dahulu.`,
      });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`)) {
      return;
    }

    try {
      await api.deleteCategory(cat.category_id);
      setSuccessMsg(`Kategori "${cat.name}" berhasil dihapus.`);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 text-slate-800 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Package className="w-6 h-6 text-[#00897B]" />
            <span>Master Data Toko & Bengkel</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Kelola inventaris sparepart, oli, data pelanggan, kendaraan motor, dan tim mekanik.
          </p>
        </div>

        {/* Action button based on active tab */}
        <div>
          {activeTab === 'products' && authService.hasPermission('can_add_product') && (
            <button
              onClick={() => openProductForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-teal-600 hover:to-[#00897B] text-white font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk / Jasa</span>
            </button>
          )}
          {activeTab === 'customers' && (
            <button
              onClick={() => openCustomerForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-teal-600 hover:to-[#00897B] text-white font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pelanggan</span>
            </button>
          )}
          {activeTab === 'vehicles' && (
            <button
              onClick={() => openVehicleForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-teal-600 hover:to-[#00897B] text-white font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Motor</span>
            </button>
          )}
          {activeTab === 'mechanics' && (
            <button
              onClick={() => openMechanicForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-teal-600 hover:to-[#00897B] text-white font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mekanik</span>
            </button>
          )}
          {activeTab === 'categories' && (
            <button
              onClick={openAddCategoryModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-teal-600 hover:to-[#00897B] text-white font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kategori</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="cursor-pointer font-bold px-2 text-slate-500 hover:text-slate-800">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="cursor-pointer font-bold px-2 text-slate-500 hover:text-slate-800">✕</button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto text-sm">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer text-sm ${
            activeTab === 'products'
              ? 'bg-[#00897B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Produk & Stok ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer text-sm ${
            activeTab === 'vehicles'
              ? 'bg-[#00897B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span>Kendaraan Motor ({vehicles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer text-sm ${
            activeTab === 'customers'
              ? 'bg-[#00897B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pelanggan ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mechanics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer text-sm ${
            activeTab === 'mechanics'
              ? 'bg-[#00897B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Mekanik ({mechanics.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer text-sm ${
            activeTab === 'categories'
              ? 'bg-[#00897B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Tags className="w-4 h-4" />
          <span>Kategori ({categories.length})</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Cari data nama, kode, plat nomor, kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm sm:text-base text-slate-800 placeholder-slate-400 shadow-xs focus:outline-hidden focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 transition"
        />
      </div>

      {/* ========================================== */}
      {/* 1. TAB: PRODUK & STOK                      */}
      {/* ========================================== */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5">Nama Produk</th>
                  <th className="py-4 px-4">Kategori</th>
                  <th className="py-4 px-4">Kompatibilitas</th>
                  <th className="py-4 px-4 text-right">HPP</th>
                  <th className="py-4 px-4 text-right">Jual</th>
                  <th className="py-4 px-4 text-center">Stok</th>
                  <th className="py-4 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter((p) => {
                    const q = search.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.sku.toLowerCase().includes(q) ||
                      (p.category_name || '').toLowerCase().includes(q) ||
                      (p.compatibility || '').toLowerCase().includes(q)
                    );
                  })
                  .map((p) => {
                    const isService =
                      p.category_name?.toLowerCase().includes('jasa') || p.sku.startsWith('SRV');
                    const isLowStock = !isService && p.stock <= p.min_stock;
                    const pImg = getProductImage(p.sku, p.category_name, p.image_url);

                    return (
                      <tr key={p.product_id} className="hover:bg-teal-50/40 transition">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                              <img
                                src={pImg}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{p.name}</div>
                              <div className="font-mono text-xs text-slate-500 font-semibold mt-0.5">{p.sku}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 font-medium text-sm">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs">
                            {p.category_name || '-'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 text-xs sm:text-sm max-w-[200px]">
                          {p.compatibility || <span className="text-slate-400 italic">Universal</span>}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-sm font-medium">
                          {formatRupiah(p.buy_price)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-teal-800 text-sm sm:text-base">
                          {formatRupiah(p.sell_price)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isService ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Jasa
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className={`font-mono font-bold text-sm sm:text-base ${
                                  isLowStock ? 'text-red-600 font-black' : 'text-emerald-700'
                                }`}
                              >
                                {p.stock}
                              </span>
                              <span className="text-slate-400 text-xs font-medium">/ min {p.min_stock}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isService && authService.hasPermission('can_stock_opname') && (
                              <button
                                onClick={() => setRestockProduct(p)}
                                title="Tambah Stok Masuk"
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                              >
                                + Stok
                              </button>
                            )}
                            {authService.hasPermission('can_edit_product') && (
                              <>
                                <button
                                  onClick={() => openProductForm(p)}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#00897B] transition cursor-pointer"
                                  title="Edit Produk"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.product_id)}
                                  className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. TAB: KENDARAAN                          */}
      {/* ========================================== */}
      {activeTab === 'vehicles' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5">Plat Nomor Polisi</th>
                  <th className="py-4 px-4">Model & Tipe Motor</th>
                  <th className="py-4 px-4">Nama Pemilik</th>
                  <th className="py-4 px-4">No. WhatsApp / HP</th>
                  <th className="py-4 px-4 text-right">KM Terakhir</th>
                  <th className="py-4 px-4">Tgl Servis Terakhir</th>
                  <th className="py-4 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles
                  .filter((v) => {
                    const q = search.toLowerCase();
                    return (
                      v.plate_number.toLowerCase().includes(q) ||
                      v.brand_model.toLowerCase().includes(q) ||
                      (v.customer_name || '').toLowerCase().includes(q)
                    );
                  })
                  .map((v) => (
                    <tr key={v.vehicle_id} className="hover:bg-teal-50/40 transition">
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-black text-slate-900 text-sm sm:text-base px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md inline-block">
                          {v.plate_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-sm sm:text-base">{v.brand_model}</td>
                      <td className="py-3.5 px-4 text-slate-800 font-semibold text-sm sm:text-base">{v.customer_name}</td>
                      <td className="py-3.5 px-4 text-teal-700 font-mono font-bold text-sm">{v.customer_phone}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm sm:text-base">
                        {v.last_km.toLocaleString('id-ID')} KM
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-sm font-medium">{formatDate(v.last_service_date)}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => openVehicleForm(v)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#00897B] transition cursor-pointer"
                          title="Edit Motor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. TAB: PELANGGAN                          */}
      {/* ========================================== */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5">Nama Pelanggan</th>
                  <th className="py-4 px-4">No. WhatsApp / HP</th>
                  <th className="py-4 px-4">Terdaftar Sejak</th>
                  <th className="py-4 px-4 text-center">Jumlah Motor</th>
                  <th className="py-4 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers
                  .filter((c) => {
                    const q = search.toLowerCase();
                    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                  })
                  .map((c) => (
                    <tr key={c.customer_id} className="hover:bg-teal-50/40 transition">
                      <td className="py-3.5 px-5 font-bold text-slate-900 text-sm sm:text-base">{c.name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-700 text-sm sm:text-base">{c.phone}</td>
                      <td className="py-3.5 px-4 text-slate-600 text-sm font-medium">{formatDate(c.created_at)}</td>
                      <td className="py-3.5 px-4 text-center font-black text-slate-800 text-sm sm:text-base">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                          {c.vehicle_count || 0} Motor
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => openCustomerForm(c)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#00897B] transition cursor-pointer"
                          title="Edit Pelanggan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 4. TAB: MEKANIK                            */}
      {/* ========================================== */}
      {activeTab === 'mechanics' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5">ID</th>
                  <th className="py-4 px-4">Nama Mekanik / Teknisi</th>
                  <th className="py-4 px-4">No. HP / WhatsApp</th>
                  <th className="py-4 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mechanics.map((m) => (
                  <tr key={m.mechanic_id} className="hover:bg-teal-50/40 transition">
                    <td className="py-3.5 px-5 font-mono text-slate-400 font-bold text-sm">#{m.mechanic_id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm sm:text-base">{m.name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 text-sm">{m.phone || '-'}</td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openMechanicForm(m)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#00897B] transition cursor-pointer"
                          title="Edit Mekanik"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMechanic(m.mechanic_id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Hapus Mekanik"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 5. TAB: KATEGORI PRODUK & JASA             */}
      {/* ========================================== */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Tags className="w-5 h-5 text-[#00897B]" />
                <span>Daftar Kategori Produk & Jasa ({categories.length})</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Kategori dapat diedit namanya kapan saja. Kategori hanya dapat dihapus jika sudah tidak ada produk yang menggunakannya.
              </p>
            </div>
            
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5 w-24">ID</th>
                  <th className="py-4 px-4">Nama Kategori</th>
                  <th className="py-4 px-4">Jumlah Produk Terkait</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories
                  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
                  .map((cat) => {
                    const productCount = products.filter((p) => p.category_id === cat.category_id).length;
                    const canDelete = productCount === 0;

                    return (
                      <tr key={cat.category_id} className="hover:bg-teal-50/40 transition">
                        <td className="py-3.5 px-5 font-mono text-slate-400 font-bold text-sm">
                          #{cat.category_id}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-sm sm:text-base">
                          {cat.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            <Layers className="w-3.5 h-3.5 text-[#00897B]" />
                            <span>{productCount} Produk</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs sm:text-sm">
                          {canDelete ? (
                            <span className="inline-block text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                              Kosong (Dapat Dihapus)
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">
                              Digunakan ({productCount} produk aktif)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditCategoryModal(cat)}
                              className="px-3 py-1.5 bg-white hover:bg-teal-50 border border-slate-300 hover:border-[#00897B] text-slate-700 hover:text-[#00897B] font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              title="Ubah Nama Kategori"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Ubah</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className={`px-3 py-1.5 border font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                canDelete
                                  ? 'bg-white hover:bg-red-50 border-red-200 text-red-600 hover:border-red-400'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                              }`}
                              title={
                                canDelete
                                  ? 'Hapus Kategori ini'
                                  : `Tidak dapat dihapus karena masih ada ${productCount} produk`
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: EDIT / TAMBAH KATEGORI              */}
      {/* ========================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <FolderEdit className="w-5 h-5 text-[#00897B]" />
                <span>{editingCategory ? 'Ubah Nama Kategori' : 'Tambah Kategori Baru'}</span>
              </h3>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setCategoryNameInput('');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Nama Kategori *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Aksesoris, Kampas Rem, dll."
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-base font-semibold focus:bg-white focus:outline-hidden focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20"
                />
              </div>

              {editingCategory && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold">Informasi:</div>
                  <div>
                    Mengubah nama kategori ini akan otomatis memperbarui seluruh produk ({products.filter(p => p.category_id === editingCategory.category_id).length} produk) yang tergabung di dalamnya.
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    setCategoryNameInput('');
                  }}
                  className="px-4 py-2.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold bg-[#00897B] hover:bg-teal-700 text-white rounded-xl shadow-md cursor-pointer transition"
                >
                  {editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: PERINGATAN HAPUS KATEGORI TERKAIT   */}
      {/* ========================================== */}
      {categoryAlertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-black text-base text-slate-900">{categoryAlertModal.title}</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {categoryAlertModal.message}
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCategoryAlertModal({ isOpen: false, title: '', message: '' })}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: PRODUK (ADD/EDIT)                   */}
      {/* ========================================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#00897B]" />
                <span>{editingProduct ? 'Edit Produk' : 'Tambah Produk / Jasa Baru'}</span>
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-sm overflow-y-auto">
              {/* Product Photo Upload & Preview Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#00897B]" />
                  <span>Foto Produk / Gambar Thumbnail</span>
                </label>
                
                <div className="flex items-start gap-4">
                  {/* Photo Preview Thumbnail */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0 shadow-xs relative group">
                    <img
                      src={getProductImage(
                        prodForm.sku,
                        categories.find((c) => String(c.category_id) === String(prodForm.category_id))?.name,
                        prodForm.image_url
                      )}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    {prodForm.image_url && (
                      <span className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[9px] px-1 py-0.5 rounded-xs font-bold">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-[#00897B] border border-teal-300 rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Foto dari Perangkat</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Read file as base64 data URL
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setProdForm({ ...prodForm, image_url: String(event.target.result) });
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {prodForm.image_url && (
                        <button
                          type="button"
                          onClick={() => setProdForm({ ...prodForm, image_url: '' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                          title="Hapus foto custom & gunakan gambar bawaan"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Default</span>
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="url"
                        placeholder="Atau tempel Link / URL Gambar (https://...)"
                        value={prodForm.image_url.startsWith('data:') ? '' : prodForm.image_url}
                        onChange={(e) => setProdForm({ ...prodForm, image_url: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#00897B]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">SKU / Kode Barang *</label>
                  <input
                    type="text"
                    required
                    value={prodForm.sku}
                    onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Kategori</label>
                  <select
                    value={prodForm.category_id}
                    onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-semibold text-sm focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Produk / Jasa *</label>
                <input
                  type="text"
                  required
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-sm font-semibold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Kompatibilitas Motor (Cth: BeAT, Vario 125, NMAX, Universal)
                </label>
                <input
                  type="text"
                  value={prodForm.compatibility}
                  onChange={(e) => setProdForm({ ...prodForm, compatibility: e.target.value })}
                  placeholder="Contoh: Honda BeAT ESP, Scoopy, Vario 125"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Harga Beli / HPP (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={prodForm.buy_price}
                    onChange={(e) => setProdForm({ ...prodForm, buy_price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={prodForm.sell_price}
                    onChange={(e) => setProdForm({ ...prodForm, sell_price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-teal-800 font-mono text-sm font-black focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Stok Awal</label>
                  <input
                    type="number"
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Minimal Stok (Peringatan)</label>
                  <input
                    type="number"
                    value={prodForm.min_stock}
                    onChange={(e) => setProdForm({ ...prodForm, min_stock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00897B] hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer transition"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: QUICK RESTOCK (+ STOK)              */}
      {/* ========================================== */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-3.5 shadow-2xl">
            <h3 className="font-black text-base text-slate-900">Tambah Stok Produk Masuk</h3>
            <p className="text-sm font-bold text-slate-800">
              {restockProduct.name} ({restockProduct.sku})
            </p>
            <div className="text-sm text-slate-700">
              Stok saat ini: <span className="font-black text-teal-800">{restockProduct.stock} pcs</span>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Stok Masuk (pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-lg font-black focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md cursor-pointer"
                >
                  Tambah Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CUSTOMER                            */}
      {/* ========================================== */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-base text-slate-900">
              {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
            </h3>
            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Pelanggan *</label>
                <input
                  type="text"
                  required
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">No. WhatsApp / HP *</label>
                <input
                  type="tel"
                  required
                  value={custForm.phone}
                  onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold bg-[#00897B] hover:bg-teal-700 text-white rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: VEHICLE                             */}
      {/* ========================================== */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-base text-slate-900">
              {editingVehicle ? 'Edit Kendaraan' : 'Tambah Kendaraan Motor'}
            </h3>
            <form onSubmit={handleSaveVehicle} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Pemilik / Pelanggan *</label>
                <select
                  required
                  value={vehForm.customer_id}
                  onChange={(e) => setVehForm({ ...vehForm, customer_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Plat Nomor *</label>
                  <input
                    type="text"
                    required
                    placeholder="B 1234 ABC"
                    value={vehForm.plate_number}
                    onChange={(e) => setVehForm({ ...vehForm, plate_number: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm font-black uppercase focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Jenis / Model Motor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Vario 125 / NMAX"
                    value={vehForm.brand_model}
                    onChange={(e) => setVehForm({ ...vehForm, brand_model: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">KM Terakhir</label>
                  <input
                    type="number"
                    value={vehForm.last_km}
                    onChange={(e) => setVehForm({ ...vehForm, last_km: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tanggal Servis Terakhir</label>
                  <input
                    type="date"
                    value={vehForm.last_service_date}
                    onChange={(e) => setVehForm({ ...vehForm, last_service_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold bg-[#00897B] hover:bg-teal-700 text-white rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Motor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: MEKANIK                             */}
      {/* ========================================== */}
      {showMechanicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-base text-slate-900">
              {editingMechanic ? 'Edit Mekanik' : 'Tambah Mekanik Baru'}
            </h3>
            <form onSubmit={handleSaveMechanic} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nama Mekanik *</label>
                <input
                  type="text"
                  required
                  value={mechForm.name}
                  onChange={(e) => setMechForm({ ...mechForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">No. Telepon</label>
                <input
                  type="tel"
                  value={mechForm.phone}
                  onChange={(e) => setMechForm({ ...mechForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm font-bold focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMechanicModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold bg-[#00897B] hover:bg-teal-700 text-white rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Mekanik
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
