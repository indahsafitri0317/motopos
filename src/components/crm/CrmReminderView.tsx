import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Search,
  MessageSquare,
  Bike,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Phone,
  User,
  ShoppingBag,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { CRMReminder } from '../../types/pos';
import { api } from '../../services/api';
import { formatDate, formatRupiah } from '../../utils/formatters';

interface CrmReminderViewProps {
  onSelectVehicleForPos: (vehicleId: number) => void;
}

export const CrmReminderView: React.FC<CrmReminderViewProps> = ({
  onSelectVehicleForPos,
}) => {
  const [reminders, setReminders] = useState<CRMReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'GOOD'>('OVERDUE');

  const loadReminders = async () => {
    setLoading(true);
    try {
      const data = await api.getCrmReminders();
      setReminders(data);
    } catch (err) {
      console.error('Failed to load CRM reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    return reminders.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          r.plate_number.toLowerCase().includes(q) ||
          r.brand_model.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.customer_phone.includes(q)
        );
      }
      return true;
    });
  }, [reminders, statusFilter, searchQuery]);

  // KPIs
  const overdueCount = reminders.filter((r) => r.is_due).length;
  const dueSoonCount = reminders.filter((r) => r.status === 'DUE_SOON').length;
  const potentialRevenue = overdueCount * 125000; // estimated avg service ticket (Oil + Service)

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9] p-5 lg:p-6 text-[#334155] space-y-5">
      {/* Header & Stats Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
              <CalendarClock className="w-4 h-4" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              CRM & Pengingat Servis Motor
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar otomatis kendaraan dengan masa servis &ge; 60 hari atau estimasi pertambahan &ge; 2.000 KM.
          </p>
        </div>

        <button
          onClick={loadReminders}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 shadow-xs transition self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs relative overflow-hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Wajib Servis (Jatuh Tempo)
            </span>
            <span className="p-1.5 rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
            {overdueCount}{' '}
            <span className="text-xs font-bold text-slate-500">Kendaraan</span>
          </div>
          <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
            Sudah &ge; 60 hari atau &ge; 2.000 KM
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs relative overflow-hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mendekati Waktu Servis
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-0.5">
            {dueSoonCount}{' '}
            <span className="text-xs font-bold text-slate-500">Kendaraan</span>
          </div>
          <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
            45-59 hari atau 1.500 - 1.999 KM
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs relative overflow-hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Potensi Omzet Servis
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono mt-0.5">
            {formatRupiah(potentialRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Estimasi tiket servis rutin (Oli + Jasa)
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari plat nomor, model motor, atau nama pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
          <button
            onClick={() => setStatusFilter('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer text-xs ${
              statusFilter === 'OVERDUE'
                ? 'bg-red-600 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Jatuh Tempo ({overdueCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('DUE_SOON')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer text-xs ${
              statusFilter === 'DUE_SOON'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <span>Mendekati ({dueSoonCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('GOOD')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer text-xs ${
              statusFilter === 'GOOD'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <span>Aman</span>
          </button>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer text-xs ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs font-black'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Semua ({reminders.length})
          </button>
        </div>
      </div>

      {/* Reminders Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-xs sm:text-sm font-medium">Memuat data pengingat servis...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs space-y-2">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-slate-900 text-base sm:text-lg">Tidak Ada Kendaraan Pada Kategori Ini</h3>
          <p className="text-xs text-slate-500">
            Semua kendaraan dalam kondisi prima atau tidak ada yang cocok dengan pencarian Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <div
              key={item.vehicle_id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between bg-white shadow-xs hover:shadow-md ${
                item.status === 'OVERDUE'
                  ? 'border-red-300'
                  : item.status === 'DUE_SOON'
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Top: Plate number & Status badge */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white font-mono font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg tracking-wider shadow-inner">
                      {item.plate_number}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                      {item.brand_model}
                    </span>
                  </div>

                  {item.status === 'OVERDUE' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      JATUH TEMPO
                    </span>
                  ) : item.status === 'DUE_SOON' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      SEGERA SERVIS
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      TERAWAT
                    </span>
                  )}
                </div>

                {/* Customer Info */}
                <div className="flex items-center justify-between text-xs text-slate-600 py-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{item.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-semibold text-slate-700 text-xs">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.customer_phone}</span>
                  </div>
                </div>

                {/* Mileage & Days Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">
                      Tgl Servis Terakhir
                    </span>
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                      {formatDate(item.last_service_date)}
                    </span>
                    <div className="text-[11px] font-bold mt-0.5">
                      <span className={item.days_since_service >= 60 ? 'text-red-600' : 'text-slate-600'}>
                        {item.days_since_service} Hari yang lalu
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">
                      KM Terakhir & Estimasi
                    </span>
                    <span className="font-bold font-mono text-slate-800 text-xs sm:text-sm">
                      {item.last_km.toLocaleString('id-ID')} KM
                    </span>
                    <div className="text-[11px] font-bold mt-0.5">
                      <span className={item.estimated_km_increase >= 2000 ? 'text-red-600 font-mono' : 'text-slate-600 font-mono'}>
                        Est. +{item.estimated_km_increase.toLocaleString('id-ID')} KM (~{item.estimated_current_km.toLocaleString('id-ID')} KM)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: 1-Click WhatsApp & POS Checkout */}
              <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                <a
                  href={item.wa_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition shadow-xs active:scale-95 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Kirim WA Pengingat</span>
                </a>

                <button
                  type="button"
                  onClick={() => onSelectVehicleForPos(item.vehicle_id)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-xs active:scale-95 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buka di Kasir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
