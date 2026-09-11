import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  Radio,
  Server,
  FileCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Send,
  Wifi,
  WifiOff,
  ShieldCheck,
  Check,
  ExternalLink,
  Settings,
  KeyRound,
  Lock,
  Database,
} from 'lucide-react';
import { syncService, SyncStatus } from '../../services/syncService';
import { mqttService, MqttConfig } from '../../services/mqttService';
import { PHP_SYNC_SCRIPT_TEMPLATE, PHP_AUTH_LOCK_SCRIPT_TEMPLATE } from '../../utils/phpTemplate';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

type TabType = 'sync' | 'mqtt' | 'api' | 'php';

const DEV_PIN = '385012';

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('sync');

  // Developer mode unlock state
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // MQTT state
  const [mqttConfig, setMqttConfig] = useState<MqttConfig>(mqttService.getConfig());
  const [mqttStatus, setMqttStatus] = useState(mqttService.getStatus());
  const [mqttTestSuccess, setMqttTestSuccess] = useState<boolean | null>(null);
  const [lastMqttLogs, setLastMqttLogs] = useState<any[]>([]);

  // API Config state
  const [syncConfig, setSyncConfig] = useState(syncService.getConfig());
  const [testApiResult, setTestApiResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedPhpFile, setSelectedPhpFile] = useState<'auth' | 'sync'>('auth');
  const [copiedCode, setCopiedCode] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === DEV_PIN) {
      setIsDevUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      setActiveTab('mqtt');
    } else {
      setPinError('PIN salah! Silakan coba lagi.');
    }
  };

  const loadStatus = async () => {
    try {
      const status = await syncService.getStatus();
      setSyncStatus(status);
    } catch (err) {
      console.warn('Gagal membaca status sync:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setMqttConfig(mqttService.getConfig());
      setSyncConfig(syncService.getConfig());

      const unsubStatus = mqttService.onStatusChange((status) => {
        setMqttStatus(status);
      });

      const unsubMessage = mqttService.onMessage((topic, msg) => {
        setLastMqttLogs((prev) => [
          { time: new Date().toLocaleTimeString(), topic, data: msg },
          ...prev.slice(0, 4),
        ]);
      });

      return () => {
        unsubStatus();
        unsubMessage();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const isForceAll = (syncStatus?.unsynced_count === 0);
      const res = await syncService.syncNow(isForceAll);
      setSyncMessage({
        type: 'success',
        text: res.message || `${res.synced_count} transaksi berhasil disinkronkan ke server!`,
      });
      await loadStatus();
      onSyncComplete?.();
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err.message || 'Gagal menyinkronkan data ke server.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleMqtt = (enabled: boolean) => {
    const updated = { ...mqttConfig, enabled };
    setMqttConfig(updated);
    mqttService.saveConfig(updated);
  };

  const handleSaveMqttConfig = () => {
    mqttService.saveConfig(mqttConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestMqtt = async () => {
    setMqttTestSuccess(null);
    const ok = await mqttService.testPublish();
    setMqttTestSuccess(ok);
    setTimeout(() => setMqttTestSuccess(null), 4000);
  };

  const handleSaveApiConfig = () => {
    syncService.saveConfig(syncConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setTestApiResult(null);
    try {
      const res = await syncService.testPing();
      setTestApiResult(res);
    } catch (err: any) {
      setTestApiResult({
        success: false,
        message: err.message || 'Gagal melakukan tes ping',
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleCopyPhpCode = () => {
    const code = selectedPhpFile === 'auth' ? PHP_AUTH_LOCK_SCRIPT_TEMPLATE : PHP_SYNC_SCRIPT_TEMPLATE;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadPhpFile = () => {
    const code = selectedPhpFile === 'auth' ? PHP_AUTH_LOCK_SCRIPT_TEMPLATE : PHP_SYNC_SCRIPT_TEMPLATE;
    const filename = selectedPhpFile === 'auth' ? 'auth_lock-api.php' : 'sync_report-api.php';
    const blob = new Blob([code], { type: 'application/x-httpd-php' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Modal Header */}
        <div className="bg-[#00897B] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-6 h-6 text-teal-200" />
            <div>
              <h3 className="font-bold text-base leading-tight">Sinkronisasi & Aplikasi Owner</h3>
              <p className="text-xs text-teal-100">
                Sync API larizk.com & Realtime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 text-xs font-bold shrink-0 px-2">
          <div className="flex items-center overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'sync'
                  ? 'border-[#00897B] text-[#00897B] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Sync Manual</span>
              {syncStatus && syncStatus.unsynced_count > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {syncStatus.unsynced_count}
                </span>
              )}
            </button>

            {/* Developer-Only Tabs (Hidden by default, unlocked via PIN) */}
            {isDevUnlocked && (
              <>
                <button
                  onClick={() => setActiveTab('mqtt')}
                  className={`px-4 py-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap animate-in fade-in duration-150 ${
                    activeTab === 'mqtt'
                      ? 'border-[#00897B] text-[#00897B] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>Realtime MQTT</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      mqttStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </button>

                <button
                  onClick={() => setActiveTab('api')}
                  className={`px-4 py-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap animate-in fade-in duration-150 ${
                    activeTab === 'api'
                      ? 'border-[#00897B] text-[#00897B] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  <span>Konfigurasi Server API</span>
                </button>

                <button
                  onClick={() => setActiveTab('php')}
                  className={`px-4 py-3 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap animate-in fade-in duration-150 ${
                    activeTab === 'php'
                      ? 'border-[#00897B] text-[#00897B] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  <span>File PHP Server</span>
                </button>
              </>
            )}
          </div>

          {/* Developer Gear Button */}
          <div className="shrink-0 flex items-center pr-1">
            {!isDevUnlocked ? (
              <button
                onClick={() => {
                  setPinInput('');
                  setPinError('');
                  setShowPinModal(true);
                }}
                title="Akses Menu Developer (PIN)"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsDevUnlocked(false);
                  setActiveTab('sync');
                }}
                title="Kunci Kembali Menu Developer"
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-bold hover:bg-teal-100 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Dev Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="p-5 overflow-y-auto flex-1 text-slate-700 text-sm space-y-4">
          {/* ================= TAB 1: SYNC MANUAL ================= */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-xs text-amber-700 font-semibold mb-1">Belum Disinkronkan</div>
                  <div className="text-2xl font-black text-amber-900">
                    {syncStatus?.unsynced_count ?? '...'}
                  </div>
                  <div className="text-[11px] text-amber-600">transaksi di SQLite</div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-slate-500 font-semibold mb-1">Total Penjualan</div>
                  <div className="text-2xl font-black text-slate-800">
                    {syncStatus?.total_sales ?? '...'}
                  </div>
                  <div className="text-[11px] text-slate-500">keseluruhan nota</div>
                </div>

                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="text-xs text-teal-700 font-semibold mb-1">Sync Terakhir</div>
                  <div className="text-xs font-bold text-teal-900 truncate">
                    {syncStatus?.last_synced_at
                      ? syncStatus.last_synced_at.slice(0, 16)
                      : 'Belum pernah'}
                  </div>
                  <div className="text-[11px] text-teal-600">ke server cloud</div>
                </div>
              </div>

              {/* Action Button */}
              <div className="space-y-2">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="w-full py-3.5 rounded-lg bg-[#00897B] hover:bg-[#00796B] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer active:scale-98"
                >
                  <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing
                      ? 'Menyinkronkan data ke server...'
                      : syncStatus?.unsynced_count === 0
                      ? 'Sinkronkan Ulang Semua Data (Kirim Semua ke Server)'
                      : `Sinkronkan ${syncStatus?.unsynced_count || 0} Data Baru ke Server`}
                  </span>
                </button>

              </div>

              {/* Message Banner */}
              {syncMessage && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    syncMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {syncMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{syncMessage.text}</span>
                </div>
              )}

              {/* Explanation Note */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Jaminan Keamanan Data Kasir:
                </p>
                <p>
                  Aplikasi didesain <strong>100% Offline-First</strong>. Ketika internet tidak ada, kasir tetap lancar mencetak nota. Saat tombol sync ditekan dan terhubung internet, transaksi otomatis terkirim tanpa risiko data hilang atau terduplikasi di server.
                </p>
              </div>
            </div>
          )}

          {/* ================= TAB 2: REALTIME MQTT ================= */}
          {activeTab === 'mqtt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="font-bold text-slate-800">Fitur Real-time MQTT</div>
                  <div className="text-xs text-slate-500">
                    Kirim notifikasi setiap kali ada transaksi kasir baru
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={mqttConfig.enabled}
                    onChange={(e) => handleToggleMqtt(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00897B]"></div>
                </label>
              </div>

              {/* Connection Status Badge */}
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {mqttStatus === 'connected' ? (
                    <Wifi className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Status Koneksi Broker:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      mqttStatus === 'connected'
                        ? 'bg-emerald-100 text-emerald-800'
                        : mqttStatus === 'connecting'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {mqttStatus === 'connected'
                      ? '🟢 TERHUBUNG (LIVE)'
                      : mqttStatus === 'connecting'
                      ? '🟡 MENGHUBUNGKAN...'
                      : '⚪ NONAKTIF / OFFLINE'}
                  </span>
                </div>

                <button
                  onClick={handleTestMqtt}
                  disabled={!mqttConfig.enabled}
                  className="px-3 py-1.5 rounded-md bg-teal-50 text-[#00897B] hover:bg-teal-100 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Kirim Ping</span>
                </button>
              </div>

              {mqttTestSuccess !== null && (
                <div
                  className={`p-2.5 rounded-lg text-xs ${
                    mqttTestSuccess
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {mqttTestSuccess
                    ? '✅ Pesan pengujian berhasil dikirim ke broker.emqx.io!'
                    : '❌ Gagal mengirim pesan pengujian ke MQTT broker.'}
                </div>
              )}

              {/* Configuration Inputs */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Broker WebSocket URL (WSS)
                  </label>
                  <input
                    type="text"
                    value={mqttConfig.brokerUrl}
                    onChange={(e) => setMqttConfig({ ...mqttConfig, brokerUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="wss://broker.emqx.io:8084/mqtt"
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Gunakan port 8084 dengan protokol WSS untuk koneksi aman di webview/browser.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Topic Notifikasi Transaksi
                  </label>
                  <input
                    type="text"
                    value={mqttConfig.topic}
                    onChange={(e) => setMqttConfig({ ...mqttConfig, topic: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="larizk/motopos/sales/live"
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Owner dapat memonitor topik ini dari aplikasi HP seperti MQTT Dash, MQTT Explorer, atau web panel.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Device Client ID</label>
                  <input
                    type="text"
                    value={mqttConfig.clientId}
                    onChange={(e) => setMqttConfig({ ...mqttConfig, clientId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveMqttConfig}
                    className="px-4 py-2 bg-[#00897B] text-white font-bold rounded-lg text-xs hover:bg-[#00796B] transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isSaved ? <Check className="w-4 h-4" /> : null}
                    <span>{isSaved ? 'Tersimpan!' : 'Simpan Pengaturan MQTT'}</span>
                  </button>
                </div>
              </div>

              {/* Realtime Live Broadcast Log */}
              {lastMqttLogs.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 text-slate-200 text-xs font-mono space-y-1.5">
                  <div className="text-teal-400 font-bold text-[11px] uppercase tracking-wider mb-1">
                    Live Event Stream Monitor:
                  </div>
                  {lastMqttLogs.map((log, idx) => (
                    <div key={idx} className="border-b border-slate-800 pb-1">
                      <span className="text-slate-400">[{log.time}]</span>{' '}
                      <span className="text-amber-400">{log.topic}</span>:{' '}
                      <span className="text-emerald-300">
                        {typeof log.data === 'object' ? JSON.stringify(log.data) : log.data}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: KONFIGURASI SERVER API ================= */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  URL Endpoint Server PHP
                </label>
                <input
                  type="url"
                  value={syncConfig.apiUrl}
                  onChange={(e) => setSyncConfig({ ...syncConfig, apiUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="https://larizk.com/api/sync_report-api.php"
                />
                <div className="text-[11px] text-slate-400 mt-0.5">
                  File PHP tujuan di hosting Anda yang bertugas menyimpan data transaksi.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  API Key / Token Keamanan Toko
                </label>
                <input
                  type="text"
                  value={syncConfig.apiKey}
                  onChange={(e) => setSyncConfig({ ...syncConfig, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="LARIZK_BENGKEL_2026"
                />
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Harus sama persis dengan konstanta EXPECTED_API_KEY di file sync_report-api.php Anda.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Identitas Perangkat Kasir (Device ID)</label>
                <input
                  type="text"
                  value={syncConfig.deviceId}
                  onChange={(e) => setSyncConfig({ ...syncConfig, deviceId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="TABLET-KASIR-01"
                />
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Membedakan sumber data jika bengkel Anda memiliki lebih dari 1 tablet kasir.
                </div>
              </div>

              {testApiResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    testApiResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {testApiResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testApiResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  onClick={handleTestApi}
                  disabled={isTestingApi}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingApi ? 'animate-spin' : ''}`} />
                  <span>{isTestingApi ? 'Mengecek...' : 'Test Cek Endpoint PHP'}</span>
                </button>

                <button
                  onClick={handleSaveApiConfig}
                  className="px-4 py-2 bg-[#00897B] text-white font-bold rounded-lg text-xs hover:bg-[#00796B] transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSaved ? <Check className="w-4 h-4" /> : null}
                  <span>{isSaved ? 'Tersimpan!' : 'Simpan Konfigurasi'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 4: FILE PHP SCRIPT ================= */}
          {activeTab === 'php' && (
            <div className="space-y-3">
              {/* File Selector Pills */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  onClick={() => setSelectedPhpFile('auth')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedPhpFile === 'auth'
                      ? 'bg-white text-[#00897B] shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>auth_lock-api.php (Keamanan & Heartbeat)</span>
                </button>
                <button
                  onClick={() => setSelectedPhpFile('sync')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedPhpFile === 'sync'
                      ? 'bg-white text-[#00897B] shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>sync_report-api.php (Laporan Penjualan)</span>
                </button>
              </div>

              {selectedPhpFile === 'auth' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1.5">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>auth_lock-api.php (Versi Aman 2.0 - Anti Bocor PIN & Ringan):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                    <li><strong>PIN & Password Hash Tidak Diekspos:</strong> Data sensitif dihapus dari query get_users publik.</li>
                    <li><strong>Heartbeat Ringan:</strong> Hanya memvalidasi 1 user yang login (tidak memuat seluruh pengguna).</li>
                    <li><strong>Pasang di:</strong> <code>public_html/api/auth_lock-api.php</code> di hosting Anda.</li>
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                  <div className="font-bold text-slate-800">Petunjuk Pemasangan di Hosting larizk.com:</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Buat folder <code>/api/</code> di dalam <code>public_html</code> domain Anda.</li>
                    <li>Unduh atau buat file dengan nama <code>sync_report-api.php</code> di folder tersebut.</li>
                    <li>Tempelkan kode PHP di bawah ini. File ini sudah otomatis membuat database penerima.</li>
                  </ol>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 font-mono">
                  {selectedPhpFile === 'auth' ? 'auth_lock-api.php (~380 baris)' : 'sync_report-api.php (~200 baris)'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPhpCode}
                    className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
                  </button>
                  <button
                    onClick={handleDownloadPhpFile}
                    className="px-3 py-1.5 rounded-md bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .php</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-800 select-all leading-relaxed">
                  {selectedPhpFile === 'auth' ? PHP_AUTH_LOCK_SCRIPT_TEMPLATE : PHP_SYNC_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>MotoPOS Offline-First Sync Gateway v1.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-md transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Modal Prompt PIN Developer */}
      {showPinModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-xs w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00897B]">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900 leading-tight">PIN</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Akses Konfigurasi Lanjutan</p>
                </div>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={10}
                  placeholder="******"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  className="w-full text-center tracking-[0.25em] font-mono text-xl font-black px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-[#00897B] transition"
                />
                {pinError && (
                  <p className="text-red-600 text-xs font-bold mt-1.5 text-center animate-in fade-in duration-150">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#00897B] hover:bg-teal-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Buka Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
