import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Package,
  Bike,
  User,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  Pause,
  Play,
  RotateCcw,
  Maximize,
  Minimize,
  Wifi,
  Menu,
  X,
  Cloud,
  Radio,
  KeyRound,
  ShieldCheck,
  Crown,
  ShoppingBag,
} from 'lucide-react';
import { Product, Category, Vehicle, Mechanic, CartItem, Sale, SaleDetail, AppUser } from '../../types/pos';
import { api } from '../../services/api';
import { formatRupiah } from '../../utils/formatters';
import { QuickVehicleModal } from './QuickVehicleModal';
import { ReceiptModal } from './ReceiptModal';
import { getProductImage } from '../../utils/productImages';
import { syncService } from '../../services/syncService';
import { mqttService } from '../../services/mqttService';
import { authService } from '../../services/authService';
import { SyncSettingsModal } from '../sync/SyncSettingsModal';
import { LoginModal } from '../auth/LoginModal';

interface PosTerminalProps {
  initialVehicleId?: number | null;
  onVehicleSelectedHandled?: () => void;
  onOpenDrawer?: () => void;
}

interface HeldOrder {
  id: string;
  cart: CartItem[];
  vehicleId: number | '';
  vehiclePlate?: string;
  currentKm: string;
  mechanicId: number | '';
  timestamp: string;
  total: number;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  initialVehicleId,
  onVehicleSelectedHandled,
  onOpenDrawer,
}) => {
  // Master lists
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'PARTS' | 'SERVICES'>('ALL');

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | ''>('');
  const [currentKm, setCurrentKm] = useState<string>('');
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER' | 'DEBIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<number | ''>('');

  // Held Orders (Hold feature from tablet screenshot)
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Modals
  const [isQuickVehicleOpen, setIsQuickVehicleOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedDetails, setCompletedDetails] = useState<SaleDetail[]>([]);

  // Sync & MQTT Monitoring state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [mqttStatus, setMqttStatus] = useState(mqttService.getStatus());

  // Store Brand banner (default Larizk style domain / store name)
  const [storeBrand, setStoreBrand] = useState('www.larizk.com');
  const [isEditingBrand, setIsEditingBrand] = useState(false);

  // Responsive Mobile View Tab (Catalog vs Cart)
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(authService.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser());
    const unsub = authService.onUserChange((u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // Refresh unsynced count
  const refreshSyncCount = async () => {
    try {
      const st = await syncService.getStatus();
      setUnsyncedCount(st.unsynced_count);
    } catch (e) {
      console.warn('Could not fetch sync status', e);
    }
  };

  // Load master data
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, vehRes, mechRes] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getVehicles(),
        api.getMechanics(),
      ]);
      setProducts(prodRes);
      setCategories(catRes);
      setVehicles(vehRes);
      setMechanics(mechRes);

      if (mechRes.length > 0 && !selectedMechanicId) {
        setSelectedMechanicId(mechRes[0].mechanic_id);
      }

      await refreshSyncCount();
    } catch (err: any) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubMqtt = mqttService.onStatusChange(setMqttStatus);
    const interval = setInterval(refreshSyncCount, 25000);
    return () => {
      unsubMqtt();
      clearInterval(interval);
    };
  }, []);

  // Handle incoming vehicle from CRM
  useEffect(() => {
    if (initialVehicleId && vehicles.length > 0) {
      const target = vehicles.find((v) => v.vehicle_id === initialVehicleId);
      if (target) {
        setSelectedVehicleId(target.vehicle_id);
        setCurrentKm(String(target.last_km || ''));
        onVehicleSelectedHandled?.();
      }
    }
  }, [initialVehicleId, vehicles]);

  // Selected vehicle details
  const currentVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehicles.find((v) => v.vehicle_id === Number(selectedVehicleId)) || null;
  }, [selectedVehicleId, vehicles]);

  // When vehicle selected, auto-fill KM if empty
  const handleVehicleChange = (vId: number | '') => {
    setSelectedVehicleId(vId);
    if (vId) {
      const v = vehicles.find((item) => item.vehicle_id === Number(vId));
      if (v && (!currentKm || currentKm === '0')) {
        setCurrentKm(String(v.last_km || ''));
      }
    }
  };

  // Fullscreen toggle for tablet feel
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== 'ALL' && p.category_id !== selectedCategory) {
        return false;
      }

      // Filter type
      const isService = p.category_name?.toLowerCase().includes('jasa') || p.sku.startsWith('SRV');
      if (filterType === 'SERVICES' && !isService) return false;
      if (filterType === 'PARTS' && isService) return false;

      // Text search in name, SKU, or compatibility
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchComp = (p.compatibility || '').toLowerCase().includes(q);
        return matchName || matchSku || matchComp;
      }

      return true;
    });
  }, [products, selectedCategory, filterType, searchQuery]);

  // Add to cart
  const addToCart = (product: Product) => {
    setCheckoutError(null);
    const isService =
      product.category_name?.toLowerCase().includes('jasa') || product.sku.startsWith('SRV') ? 1 : 0;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.product_id);
      if (existingIndex > -1) {
        const item = prev[existingIndex];
        if (!isService && item.quantity + 1 > product.stock) {
          setCheckoutError(`Stok maksimal untuk ${product.name} adalah ${product.stock}`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...item, quantity: item.quantity + 1 };
        return updated;
      } else {
        if (!isService && product.stock <= 0) {
          setCheckoutError(`Stok produk ${product.name} saat ini kosong (0)`);
          return prev;
        }
        return [
          ...prev,
          {
            product_id: product.product_id,
            sku: product.sku,
            item_name: product.name,
            quantity: 1,
            buy_price: product.buy_price,
            sell_price: product.sell_price,
            is_service: isService,
            stock: product.stock,
            compatibility: product.compatibility,
          },
        ];
      }
    });
  };

  // Update item quantity in cart
  const updateQuantity = (index: number, delta: number) => {
    setCheckoutError(null);
    setCart((prev) => {
      const item = prev[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      if (!item.is_service && item.stock !== undefined && newQty > item.stock) {
        setCheckoutError(`Stok maksimal barang ini adalah ${item.stock}`);
        return prev;
      }
      const updated = [...prev];
      updated[index] = { ...item, quantity: newQty };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setCashTendered('');
    setCheckoutError(null);
  };

  // Totals calculations
  const totalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * item.sell_price, 0);
  }, [cart]);

  const totalHpp = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * item.buy_price, 0);
  }, [cart]);

  const grossProfit = totalAmount - totalHpp;

  // Change amount for cash
  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'CASH' || typeof cashTendered !== 'number') return 0;
    return Math.max(0, cashTendered - totalAmount);
  }, [paymentMethod, cashTendered, totalAmount]);

  // Hold Order Feature
  const handleHoldOrder = () => {
    if (cart.length === 0) {
      if (heldOrders.length > 0) {
        setShowHeldModal(true);
      } else {
        setCheckoutError('Keranjang masih kosong, tidak ada order untuk di-Hold.');
      }
      return;
    }

    const newHeld: HeldOrder = {
      id: 'HOLD-' + Date.now().toString().slice(-4),
      cart: [...cart],
      vehicleId: selectedVehicleId,
      vehiclePlate: currentVehicle?.plate_number,
      currentKm,
      mechanicId: selectedMechanicId,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      total: totalAmount,
    };

    setHeldOrders((prev) => [newHeld, ...prev]);
    clearCart();
    setSelectedVehicleId('');
    setCurrentKm('');
    setCheckoutError(null);
  };

  // Resume Held Order
  const handleResumeOrder = (held: HeldOrder) => {
    setCart(held.cart);
    setSelectedVehicleId(held.vehicleId);
    setCurrentKm(held.currentKm);
    setSelectedMechanicId(held.mechanicId);
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
    setShowHeldModal(false);
  };

  // Trigger Payment Modal
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      setCheckoutError('Keranjang belanja masih kosong, pilih produk atau jasa.');
      return;
    }
    setCashTendered(totalAmount);
    setCheckoutError(null);
    setShowPaymentModal(true);
  };

  // Handle atomic checkout execution
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutError('Keranjang belanja masih kosong');
      return;
    }

    if (paymentMethod === 'CASH' && typeof cashTendered === 'number' && cashTendered < totalAmount) {
      setCheckoutError(`Nominal uang tunai kurang (${formatRupiah(totalAmount - cashTendered)})`);
      return;
    }

    setCheckoutError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        vehicle_id: selectedVehicleId ? Number(selectedVehicleId) : null,
        current_km: currentKm ? Number(currentKm) : null,
        payment_method: paymentMethod,
        mechanic_id: selectedMechanicId ? Number(selectedMechanicId) : null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          item_name: item.item_name,
          quantity: item.quantity,
          buy_price: item.buy_price,
          sell_price: item.sell_price,
          is_service: item.is_service,
        })),
      };

      const result = await api.checkout(payload);
      setCompletedSale(result.sale);
      setCompletedDetails(result.details);

      // Non-blocking real-time MQTT broadcast for Owner
      try {
        const selVeh = vehicles.find((v) => v.vehicle_id === Number(selectedVehicleId));
        const selMec = mechanics.find((m) => m.mechanic_id === Number(selectedMechanicId));
        mqttService.publishSale({
          invoice_number: result.sale.invoice_number,
          total_amount: result.sale.total_amount,
          payment_method: result.sale.payment_method,
          plate_number: selVeh?.plate_number,
          customer_name: selVeh?.customer_name,
          mechanic_name: selMec?.name,
          items: cart.map((c) => ({ item_name: c.item_name, quantity: c.quantity })),
        });
      } catch (mqttErr) {
        console.warn('MQTT broadcast non-blocking error:', mqttErr);
      }

      // Clear state and close payment modal
      clearCart();
      setShowPaymentModal(false);

      // Refresh product stock & vehicle list
      await loadData();
    } catch (err: any) {
      setCheckoutError(err.message || 'Gagal menyimpan transaksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset cash shortcuts
  const cashShortcuts = [
    totalAmount,
    Math.ceil(totalAmount / 10000) * 10000,
    Math.ceil(totalAmount / 50000) * 50000,
    100000,
    200000,
  ].filter((v, i, a) => v >= totalAmount && a.indexOf(v) === i);

  // Category Color Palette matching the tablet screenshot tabs
  const getCategoryColor = (catName: string, index: number) => {
    const colors = [
      'bg-[#0091EA] hover:bg-[#0081cb]', // FOOD / Blue
      'bg-[#43A047] hover:bg-[#388e3c]', // DRINK / Green
      'bg-[#0288D1] hover:bg-[#0277bd]', // DESSERT / Sky
      'bg-[#F57C00] hover:bg-[#ef6c00]', // GIFT / Orange
      'bg-[#7B1FA2] hover:bg-[#6a1b9a]', // Purple
      'bg-[#D81B60] hover:bg-[#c2185b]', // Pink/Service
      'bg-[#00897B] hover:bg-[#00796b]', // Teal
      'bg-[#546E7A] hover:bg-[#455a64]', // Slate
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#ECEFF1] text-[#37474F] overflow-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP GREEN/TEAL BANNER HEADER (Larizk / Tablet POS Style)               */}
      {/* ========================================================================= */}
      <header className="h-14 bg-[#00897B] text-white px-4 flex items-center justify-between shadow-md shrink-0 z-20">
        {/* Left: Hamburger Menu Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDrawer}
            title="Buka Menu Navigasi"
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/15 transition cursor-pointer active:scale-95"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Center: Brand Domain / Title Banner */}
        <div className="flex items-center justify-center">
          {isEditingBrand ? (
            <input
              type="text"
              value={storeBrand}
              onChange={(e) => setStoreBrand(e.target.value)}
              onBlur={() => setIsEditingBrand(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingBrand(false)}
              autoFocus
              className="bg-white/20 text-white font-extrabold text-xl px-3 py-0.5 rounded text-center tracking-wide outline-hidden border border-white/40 font-nasalization lowercase"
            />
          ) : (
            <h1
              onClick={() => setIsEditingBrand(true)}
              title="Klik untuk ubah nama banner"
              className="font-black text-xl sm:text-2xl text-white tracking-widest cursor-pointer hover:opacity-90 font-nasalization transition drop-shadow-xs flex items-center gap-2 lowercase"
            >
              <span>{storeBrand}</span>
            </h1>
          )}
        </div>

        {/* Right: Utility & Status Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Active User Chip or Login Button */}
          {currentUser ? (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              title="Pengguna Aktif - Klik untuk Ganti Pengguna"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/25 hover:bg-black/35 text-white font-bold text-xs transition cursor-pointer active:scale-95 border border-white/10"
            >
              {currentUser.role === 'owner' ? (
                <Crown className="w-3.5 h-3.5 text-amber-300" />
              ) : currentUser.role === 'supervisor' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5 text-teal-200" />
              )}
              <span className="hidden sm:inline text-[11px] truncate max-w-[110px]">
                {currentUser.full_name}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              title="Masuk / Login Kasir"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer active:scale-95 animate-pulse shadow-sm"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="text-[11px]">Masuk (PIN)</span>
            </button>
          )}

          {/* Sync Button & Unsynced Badge - Only visible if has can_access_sync */}
          {authService.hasPermission('can_access_sync') && (
            <button
              onClick={() => setShowSyncModal(true)}
              title="Sinkronisasi Data Transaksi ke larizk.com"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white font-bold text-xs transition cursor-pointer active:scale-95"
            >
              <Cloud className="w-4 h-4 text-teal-200" />
              <span className="hidden sm:inline text-[11px]">Sync</span>
              {unsyncedCount > 0 ? (
                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full leading-none animate-pulse">
                  {unsyncedCount}
                </span>
              ) : (
                <span className="text-[10px] text-teal-200">✓</span>
              )}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh (Tablet Mode)'}
            className="p-1.5 sm:p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN SPLIT VIEW (Catalog Grid 68% + Order Bill Panel 32%)              */}
      {/* ========================================================================= */}
      {/* Mobile Top View Switcher (Only on screens < lg) */}
      <div className="lg:hidden flex items-stretch bg-white border-b border-slate-300 shrink-0 font-orbitron text-xs shadow-xs z-10">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 font-black border-b-2 transition cursor-pointer ${
            mobileTab === 'catalog'
              ? 'border-[#00897B] text-[#00897B] bg-teal-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-700 bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Katalog Produk</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 font-black border-b-2 transition cursor-pointer ${
            mobileTab === 'cart'
              ? 'border-[#00897B] text-[#00897B] bg-teal-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-700 bg-slate-50'
          }`}
        >
          <div className="relative flex items-center">
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <span>
            Keranjang {cart.length > 0 ? `(${formatRupiah(totalAmount)})` : ''}
          </span>
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ===================================================================== */}
        {/* LEFT / CENTER: PRODUCT CATALOG & CATEGORY TABS                        */}
        {/* ===================================================================== */}
        <div
          className={`flex-1 flex-col overflow-hidden bg-[#ECEFF1] border-r border-slate-300 ${
            mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* A. CATEGORY TABS BAR (Horizontal Colorful Buttons with Pinned Search Button) */}
          <div className="bg-white border-b border-slate-300 p-2 shadow-xs shrink-0">
            <div className="flex items-center gap-2">
              {/* Scrollable Categories List */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                {/* "SEMUA" Tab */}
                <button
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setFilterType('ALL');
                  }}
                  className={`px-3 py-2 rounded-xs font-black text-xs uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer shrink-0 shadow-xs active:scale-95 ${
                    selectedCategory === 'ALL' && filterType === 'ALL'
                      ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1'
                      : 'bg-slate-700 hover:bg-slate-800 text-white'
                  }`}
                >
                  <span>⭐ SEMUA</span>
                </button>

                {/* Dynamic Colored Categories */}
                {categories.map((cat, idx) => {
                  const colorClass = getCategoryColor(cat.name, idx);
                  const isSelected = selectedCategory === cat.category_id && filterType === 'ALL';
                  return (
                    <button
                      key={cat.category_id}
                      onClick={() => {
                        setSelectedCategory(cat.category_id);
                        setFilterType('ALL');
                      }}
                      className={`px-3.5 py-2 rounded-xs font-black text-xs uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer shrink-0 shadow-xs active:scale-95 text-white ${colorClass} ${
                        isSelected ? 'ring-2 ring-slate-900 ring-offset-1 scale-102 brightness-110' : 'opacity-95'
                      }`}
                    >
                      <span>{cat.name}</span>
                    </button>
                  );
                })}

                {/* JASA SERVIS Fast Tab */}
                <button
                  onClick={() => {
                    setFilterType('SERVICES');
                    setSelectedCategory('ALL');
                  }}
                  className={`px-3.5 py-2 rounded-xs font-black text-xs uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer shrink-0 shadow-xs active:scale-95 text-white bg-[#D81B60] hover:bg-[#C2185B] ${
                    filterType === 'SERVICES' ? 'ring-2 ring-slate-900 ring-offset-1 scale-102 brightness-110' : 'opacity-95'
                  }`}
                >
                  <span>🔧 JASA SERVIS</span>
                </button>
              </div>

              {/* Pinned Search Toggle Button (Fixed on the right, does not scroll) */}
              <div className="shrink-0 pl-1.5 border-l border-slate-200">
                <button
                  onClick={() => setShowSearchInput(!showSearchInput)}
                  title="Cari Produk"
                  className={`px-3 py-2 rounded-xs font-black text-xs uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer shadow-xs active:scale-95 text-white bg-[#00ACC1] hover:bg-[#0097A7] ${
                    showSearchInput ? 'ring-2 ring-slate-900' : ''
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>CARI</span>
                </button>
              </div>
            </div>

            {/* Expandable Search Input Row */}
            {showSearchInput && (
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ketik nama oli, sparepart, SKU, atau jenis motor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xs pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#00897B]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                  {filteredProducts.length} barang ditemukan
                </span>
              </div>
            )}
          </div>

          {/* B. PRODUCT CARDS GRID (Visual Photos + Dark Bottom Overlay + Name) */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-[#00897B]" />
                <span className="text-xs font-bold">Memuat katalog sparepart & oli...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                <Package className="w-12 h-12 stroke-1 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">Tidak ada produk yang cocok dengan pencarian.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setFilterType('ALL');
                  }}
                  className="px-3 py-1.5 bg-[#00897B] text-white text-xs font-bold rounded-xs cursor-pointer shadow-xs"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((product) => {
                  const isService =
                    product.category_name?.toLowerCase().includes('jasa') || product.sku.startsWith('SRV');
                  const isOutOfStock = !isService && product.stock <= 0;
                  const imgSrc = getProductImage(product.sku, product.category_name, product.image_url);

                  return (
                    <div
                      key={product.product_id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`group bg-white rounded-xs border border-slate-300 shadow-xs overflow-hidden flex flex-col transition-all duration-150 cursor-pointer active:scale-97 select-none hover:shadow-md hover:border-slate-400 ${
                        isOutOfStock ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      {/* Product Photo with Dark Overlay Bar at Bottom */}
                      <div className="relative aspect-4/3 w-full bg-slate-200 overflow-hidden">
                        <img
                          src={imgSrc}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />

                        {/* Service / Promo Tag */}
                        {isService && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-xs bg-[#D81B60] text-white font-black text-[10px] shadow-sm uppercase tracking-wider">
                            JASA
                          </span>
                        )}

                        {/* Dark Bottom Overlay on Photo (Larizk Tablet Style) */}
                        <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs text-white px-2 py-1 flex items-center justify-between text-[10px] font-mono leading-tight">
                          {/* Stock Count */}
                          <div className="flex items-center gap-1">
                            <span className="text-amber-400">📦</span>
                            <span className="font-bold">
                              {isService ? '∞' : product.stock}
                            </span>
                          </div>

                          {/* Price Tag */}
                          <div className="font-black text-amber-300 text-xs">
                            {formatRupiah(product.sell_price)}
                          </div>
                        </div>
                      </div>

                      {/* Product Title & Compatibility Below Photo */}
                      <div className="p-2 flex-1 flex flex-col justify-between bg-white text-left">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight group-hover:text-[#00897B] transition">
                          {product.name}
                        </h4>

                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-mono text-slate-400 truncate max-w-[90px]">
                            {product.sku}
                          </span>
                          {product.compatibility ? (
                            <span className="text-[10px] text-teal-700 font-medium truncate max-w-[100px] text-right">
                              {product.compatibility}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile Bottom Floating Cart Bar (Only on < lg screens when in catalog view and cart has items) */}
          {cart.length > 0 && (
            <div className="lg:hidden shrink-0 bg-slate-900 text-white p-3 flex items-center justify-between border-t border-slate-700 shadow-2xl z-20 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col">
                <span className="text-[11px] text-teal-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{cart.reduce((s, i) => s + i.quantity, 0)} Item Terpilih</span>
                </span>
                <span className="text-base font-black font-orbitron text-amber-300">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
              <button
                onClick={() => setMobileTab('cart')}
                className="bg-[#00897B] hover:bg-[#00796B] text-white px-4 py-2.5 rounded-xs font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition font-orbitron"
              >
                <span>Lihat Keranjang</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* RIGHT: ORDER DETAILS, BILLING & CASH CHECKOUT (Larizk Tablet Style)    */}
        {/* ===================================================================== */}
        <div
          className={`w-full lg:w-[380px] xl:w-[420px] bg-white flex-col shrink-0 border-l border-slate-300 shadow-md ${
            mobileTab === 'cart' ? 'flex flex-1 h-full' : 'hidden lg:flex'
          }`}
        >
          {/* Mobile Back Button to Catalog (Only on < lg) */}
          <div className="lg:hidden bg-teal-50 border-b border-teal-200 px-3 py-2 flex items-center justify-between">
            <button
              onClick={() => setMobileTab('catalog')}
              className="text-[#00897B] hover:text-[#00796B] text-xs font-bold flex items-center gap-1.5 cursor-pointer font-orbitron"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tambah Produk Lain</span>
            </button>
            <span className="text-[11px] text-teal-900 font-bold">
              {cart.reduce((s, i) => s + i.quantity, 0)} Item
            </span>
          </div>

          {/* A. CUSTOMER INPUT BAR (Orange person icon + input + search + add) */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-300 space-y-2">
            <div className="flex items-center gap-1.5">
              {/* Orange Person Icon (Exactly like screenshot) */}
              <div className="w-8 h-8 rounded-xs bg-[#FB8C00] text-white flex items-center justify-center shrink-0 shadow-xs">
                <User className="w-4 h-4" />
              </div>

              {/* Customer / Vehicle Dropdown or Input */}
              <div className="flex-1 relative">
                <select
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:outline-hidden focus:border-[#00897B]"
                >
                  <option value="">-- Pilih Pelanggan / Plat Motor --</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.plate_number} - {v.customer_name} ({v.brand_model})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add New Customer / Vehicle Button (Cyan like screenshot) */}
              <button
                onClick={() => setIsQuickVehicleOpen(true)}
                title="Registrasi Motor / Pelanggan Baru"
                className="w-8 h-8 rounded-xs bg-[#00ACC1] hover:bg-[#0097A7] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4 font-bold" />
              </button>
            </div>

            {/* If Vehicle Selected: Show Quick Motor & KM status row */}
            {currentVehicle ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xs p-2 text-[11px] space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-mono text-xs text-slate-900 bg-amber-200/70 px-1 rounded">
                      {currentVehicle.plate_number}
                    </span>
                    <span className="text-slate-600 truncate max-w-[120px]">
                      {currentVehicle.brand_model}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedVehicleId('')}
                    className="text-red-500 hover:text-red-700 text-[10px] font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-white p-1 rounded-xs border border-amber-200">
                    <span className="text-slate-500 block">KM Servis Lalu:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {currentVehicle.last_km.toLocaleString('id-ID')} KM
                    </span>
                  </div>
                  <div className="bg-white p-1 rounded-xs border border-amber-200">
                    <label className="text-slate-500 block">Input KM Masuk *:</label>
                    <input
                      type="number"
                      placeholder="Contoh: 18500"
                      value={currentKm}
                      onChange={(e) => setCurrentKm(e.target.value)}
                      className="w-full text-xs font-mono font-bold text-slate-900 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Mechanic Selector Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Mekanik:</span>
              <select
                value={selectedMechanicId}
                onChange={(e) => setSelectedMechanicId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 bg-white border border-slate-300 rounded-xs px-2 py-1 text-xs text-slate-800 focus:outline-hidden focus:border-[#00897B]"
              >
                <option value="">-- Tanpa Mekanik (Toko) --</option>
                {mechanics.map((m) => (
                  <option key={m.mechanic_id} value={m.mechanic_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* B. ORDER DETAILS HEADER */}
          <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <span>🛒 ORDER DETAILS</span>
              {cart.length > 0 && (
                <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded-full text-[10px]">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item
                </span>
              )}
            </div>
            {heldOrders.length > 0 && (
              <button
                onClick={() => setShowHeldModal(true)}
                className="text-amber-600 hover:text-amber-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>{heldOrders.length} Order Ditahan</span>
              </button>
            )}
          </div>

          {/* C. SCROLLABLE CART ITEMS LIST (Item name + Orange/Green minus/plus controls) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-1.5">
                <span className="text-3xl">🛒</span>
                <p className="text-xs font-bold text-slate-500">Belum ada item dipilih.</p>
                <p className="text-[11px] text-slate-400">Klik produk dari katalog untuk menambah pesanan.</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition"
                >
                  {/* Left: Item Info */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-xs text-slate-900 leading-snug line-clamp-1">
                        {item.item_name}
                      </span>
                      {item.is_service ? (
                        <span className="shrink-0 text-[9px] px-1 py-0.2 bg-pink-100 text-pink-700 font-bold rounded">
                          JASA
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      @ {formatRupiah(item.sell_price)}
                    </div>
                  </div>

                  {/* Center/Right: Quantity Controllers (Orange [-] and Green [+] from screenshot) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Orange Minus Button */}
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      title="Kurangi"
                      className="w-6 h-6 rounded-xs bg-[#FB8C00] hover:bg-[#F57C00] text-white flex items-center justify-center font-black cursor-pointer shadow-xs active:scale-90 transition"
                    >
                      <Minus className="w-3 h-3 stroke-[3]" />
                    </button>

                    {/* Quantity Value */}
                    <span className="w-7 text-center font-mono font-bold text-xs text-slate-900">
                      {item.quantity}
                    </span>

                    {/* Green Plus Button */}
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      title="Tambah"
                      className="w-6 h-6 rounded-xs bg-[#43A047] hover:bg-[#388E3C] text-white flex items-center justify-center font-black cursor-pointer shadow-xs active:scale-90 transition"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="w-20 text-right font-mono font-bold text-xs text-slate-900 shrink-0">
                    {formatRupiah(item.quantity * item.sell_price)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* D. ERROR NOTIFICATION */}
          {checkoutError && (
            <div className="mx-2 my-1 p-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* E. TOTALS & CALCULATIONS (Gray Separator Bar + Subtotal + Total) */}
          <div className="bg-slate-50 border-t border-slate-300 p-3 space-y-1.5 shrink-0">
            {/* Gray Separator Bar like screenshot */}
            <div className="w-full h-1.5 bg-slate-300 rounded-full mb-2 opacity-80" />

            <div className="flex justify-between text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wider">SUB TOTAL</span>
              <span className="font-mono font-bold text-slate-800">
                {formatRupiah(totalAmount)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>PPN (0%) / ESTIMASI HPP</span>
              <span className="font-mono text-slate-600">
                HPP: {formatRupiah(totalHpp)}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
              <span className="text-sm font-black text-slate-800 uppercase tracking-wider font-orbitron">TOTAL</span>
              <span className="text-xl font-black font-orbitron text-slate-950 tracking-tight">
                {formatRupiah(totalAmount)}
              </span>
            </div>
          </div>

          {/* F. BOTTOM ACTION BUTTONS (Hold, Delete, Cash) */}
          <div className="p-2.5 bg-white border-t border-slate-200 space-y-2 shrink-0">
            {/* Row 1: Orange Hold & Red Delete */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleHoldOrder}
                className="py-2 px-3 rounded-xs bg-[#FB8C00] hover:bg-[#F57C00] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition font-orbitron"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>HOLD ({heldOrders.length})</span>
              </button>

              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="py-2 px-3 rounded-xs bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition font-orbitron"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>DELETE</span>
              </button>
            </div>

            {/* Row 2: Full Width Large Teal CASH Checkout Button */}
            <button
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className="w-full py-3.5 px-4 rounded-xs bg-[#00897B] hover:bg-[#00796B] disabled:opacity-50 text-white font-black text-base uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition drop-shadow-sm font-orbitron"
            >
              <Banknote className="w-5 h-5" />
              <span>CASH / BAYAR</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PAYMENT MODAL (Cash Tendered, Change, QRIS / Transfer options)         */}
      {/* ========================================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xs shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#00897B] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                <h3 className="font-bold text-sm">Pembayaran Kasir</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Total Summary */}
              <div className="bg-slate-100 p-3 rounded-xs text-center border border-slate-200">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                  Total Tagihan
                </span>
                <div className="text-2xl font-black font-mono text-slate-900 mt-0.5">
                  {formatRupiah(totalAmount)}
                </div>
              </div>

              {/* Payment Method Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['CASH', 'QRIS', 'TRANSFER', 'DEBIT'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 text-xs font-bold rounded-xs transition cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-[#00897B] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Tendered Input */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Nominal uang diterima"
                    className="w-full px-3 py-2.5 text-base font-mono font-black text-slate-900 border border-slate-300 rounded-xs focus:outline-hidden focus:border-[#00897B]"
                  />

                  {/* Cash Preset Shortcuts */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cashShortcuts.map((amount, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCashTendered(amount)}
                        className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xs border border-slate-200 cursor-pointer"
                      >
                        {formatRupiah(amount)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Calculation */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xs flex items-center justify-between text-xs mt-2">
                    <span className="font-bold text-emerald-800 uppercase">Uang Kembalian:</span>
                    <span className="font-mono font-black text-base text-emerald-700">
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs font-black bg-[#00897B] hover:bg-[#00796B] text-white rounded-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : 'SELESAIKAN & CETAK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HELD ORDERS MODAL                                                      */}
      {/* ========================================================================= */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xs shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden flex flex-col">
            <div className="bg-[#FB8C00] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pause className="w-5 h-5 fill-current" />
                <h3 className="font-bold text-sm">Daftar Order Ditahan (Hold)</h3>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {heldOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Tidak ada order yang sedang di-Hold.</p>
              ) : (
                heldOrders.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xs flex items-center justify-between gap-3 hover:bg-amber-50/50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{h.id}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({h.timestamp})</span>
                      </div>
                      <div className="text-xs text-slate-700 font-bold mt-0.5">
                        {h.vehiclePlate ? `Motor: ${h.vehiclePlate}` : 'Umum / Tanpa Motor'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {h.cart.length} macam barang &middot; Total: {formatRupiah(h.total)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleResumeOrder(h)}
                      className="px-3 py-1.5 bg-[#43A047] hover:bg-[#388E3C] text-white text-xs font-bold rounded-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Buka</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Vehicle / Customer Registration Modal */}
      <QuickVehicleModal
        isOpen={isQuickVehicleOpen}
        onClose={() => setIsQuickVehicleOpen(false)}
        onVehicleCreated={(vId, plate, model, km) => {
          loadData().then(() => {
            setSelectedVehicleId(vId);
            setCurrentKm(String(km || ''));
          });
        }}
      />

      {/* Thermal Receipt Print Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          details={completedDetails}
          onClose={() => setCompletedSale(null)}
          onNewTransaction={() => {
            setCompletedSale(null);
            clearCart();
          }}
        />
      )}

      {/* Sync & Realtime MQTT Settings Modal */}
      <SyncSettingsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncComplete={refreshSyncCount}
      />

      {/* Login & User Switch Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          loadData();
        }}
        canCancel={!!currentUser}
        onCancel={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};
