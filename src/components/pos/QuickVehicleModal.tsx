import React, { useState, useEffect } from 'react';
import { X, Plus, Bike, User, Phone, Check } from 'lucide-react';
import { Customer } from '../../types/pos';
import { api } from '../../services/api';

interface QuickVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVehicleCreated: (vehicleId: number, plateNumber: string, brandModel: string, lastKm: number) => void;
}

export const QuickVehicleModal: React.FC<QuickVehicleModalProps> = ({
  isOpen,
  onClose,
  onVehicleCreated,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mode, setMode] = useState<'existing_customer' | 'new_customer'>('new_customer');

  // New Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');

  // Vehicle Form
  const [plateNumber, setPlateNumber] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [lastKm, setLastKm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getCustomers().then(setCustomers).catch(console.error);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let custId: number;

      if (mode === 'new_customer') {
        if (!customerName.trim() || !customerPhone.trim()) {
          throw new Error('Nama dan No. HP Pelanggan wajib diisi');
        }
        const newCust = await api.addCustomer(customerName.trim(), customerPhone.trim());
        custId = newCust.customer_id;
      } else {
        if (!selectedCustomerId) {
          throw new Error('Silakan pilih pelanggan yang sudah terdaftar');
        }
        custId = Number(selectedCustomerId);
      }

      if (!plateNumber.trim() || !brandModel.trim()) {
        throw new Error('Nomor Polisi dan Jenis Motor wajib diisi');
      }

      const kmVal = Number(lastKm) || 0;
      const vehRes = await api.addVehicle({
        customer_id: custId,
        plate_number: plateNumber.trim().toUpperCase(),
        brand_model: brandModel.trim(),
        last_km: kmVal,
        last_service_date: new Date().toISOString().split('T')[0],
      });

      onVehicleCreated(vehRes.vehicle_id, plateNumber.trim().toUpperCase(), brandModel.trim(), kmVal);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm">Registrasi Kendaraan & Pelanggan</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Customer Selection Mode */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('new_customer')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'new_customer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              + Pelanggan Baru
            </button>
            <button
              type="button"
              onClick={() => setMode('existing_customer')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'existing_customer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pelanggan Terdaftar
            </button>
          </div>

          {mode === 'new_customer' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pemilik / Pelanggan *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. WhatsApp / HP *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="08123456789"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih Pelanggan *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-amber-500 text-slate-800"
              >
                <option value="">-- Pilih Nama Pelanggan --</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Data Motor / Kendaraan
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plat Nomor Polisi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: B 3829 TKR"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-bold tracking-wider uppercase rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-amber-500 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis / Tipe Motor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Vario 125 CBS 2021"
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-amber-500 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kilometer (KM) Saat Ini
              </label>
              <input
                type="number"
                placeholder="Contoh: 18450"
                value={lastKm}
                onChange={(e) => setLastKm(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-amber-500 text-slate-800"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Akan otomatis digunakan sebagai KM awal untuk pengingat servis berikutnya (2.000 KM).
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Simpan & Pilih Motor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
