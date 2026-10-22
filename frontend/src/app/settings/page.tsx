'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Building,
  Key,
  RotateCcw,
  Bot,
  QrCode,
  LogOut,
  PhoneCall,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // WhatsApp Web Bot state for group automation
  const [botStatus, setBotStatus] = useState<any>({ isConnected: false, botPhoneNumber: null, qrCode: null });
  const [botLoading, setBotLoading] = useState(false);
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);

  const fetchBotStatus = async () => {
    try {
      const res = await api.getWhatsAppBotStatus();
      if (res && res.success) setBotStatus(res);
    } catch {}
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettings(res.data);
      setDiagnostics(res.metaDiagnostics);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      await api.updateSettings(settings);
      setMessage('Settings updated successfully!');
      setTimeout(() => setMessage(null), 3000);
      fetchSettings();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-4xl">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">System & Automation Settings</h2>
        <p className="text-xs text-slate-500">
          Configure Meta WhatsApp Business Platform credentials, automation timers, and security policies
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* SECTION: WHATSAPP WEB BOT FOR GROUP AUTOMATION */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                WhatsApp Web Bot (Direct Group Automation)
              </h3>
              <p className="text-xs text-slate-500">
                Sends drawing uploads, stage updates, and payment receipts directly inside WhatsApp groups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                botStatus.isConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${botStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {botStatus.isConnected ? `Connected (+${botStatus.botPhoneNumber || 'Active'})` : 'Not Linked'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-800">
              Active Linked Phone Number: <span className="font-mono text-emerald-700">{botStatus.botPhoneNumber ? `+${botStatus.botPhoneNumber}` : 'None'}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              This WhatsApp account connects via WhatsApp Web session to post directly inside your project groups without user interaction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {botStatus.isConnected ? (
              <button
                type="button"
                onClick={() => setIsBotModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Change Linked Number</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsBotModalOpen(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Link WhatsApp Bot (QR Code)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QR Code / Change Number Modal */}
      {isBotModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {botStatus.isConnected ? 'Manage WhatsApp Bot Number' : 'Pair WhatsApp Bot'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBotModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center min-h-[250px]">
              {botStatus.isConnected ? (
                <div className="space-y-4 py-2 text-center w-full max-w-xs mx-auto">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                    <Check className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Bot Connected</h4>
                    <p className="text-sm font-black text-emerald-700 font-mono mt-1">
                      +{botStatus.botPhoneNumber}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Ready to automatically post updates, drawing files, and payment receipts.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Do you want to unlink +${botStatus.botPhoneNumber} and pair a new phone number?`
                        );
                        if (!confirmed) return;
                        try {
                          setBotLoading(true);
                          await api.logoutWhatsAppBot();
                          toast.success('Bot unlinked. Generating fresh QR code for your new number...');
                          await fetchBotStatus();
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to unlink');
                        } finally {
                          setBotLoading(false);
                        }
                      }}
                      disabled={botLoading}
                      className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <LogOut className={`w-4 h-4 ${botLoading ? 'animate-spin' : ''}`} />
                      <span>{botLoading ? 'Disconnecting...' : 'Unlink & Change Phone Number'}</span>
                    </button>
                  </div>
                </div>
              ) : botStatus.qrCode ? (
                <div className="space-y-3 text-center">
                  <img
                    src={botStatus.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 mx-auto rounded-xl shadow-md border border-white"
                  />
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Point your phone camera at the QR code</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device
                  </p>
                </div>
              ) : (
                <div className="space-y-2 py-8 text-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500">Generating WhatsApp QR code for new number...</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setBotLoading(true);
                    await api.initWhatsAppBot();
                    await fetchBotStatus();
                    toast.success('QR Code refreshed');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to refresh QR');
                  } finally {
                    setBotLoading(false);
                  }
                }}
                disabled={botLoading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${botLoading ? 'animate-spin' : ''}`} />
                <span>Refresh QR</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBotModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Meta WhatsApp Cloud API Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Meta WhatsApp Business Cloud API Configuration
                </h3>
                <p className="text-xs text-slate-500">Official Graph API integration parameters</p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                diagnostics?.valid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {diagnostics?.valid ? 'Connected to Meta' : 'Test Mode Enabled'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Meta Graph API Version:
              </label>
              <input
                type="text"
                value={settings.metaApiVersion || 'v20.0'}
                onChange={(e) => setSettings({ ...settings, metaApiVersion: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Meta Phone Number ID:
              </label>
              <input
                type="text"
                value={settings.metaPhoneNumberId || ''}
                onChange={(e) => setSettings({ ...settings, metaPhoneNumberId: e.target.value })}
                placeholder="e.g. 104829104812345"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                WhatsApp Business Account ID (WABA ID):
              </label>
              <input
                type="text"
                value={settings.metaWabaId || ''}
                onChange={(e) => setSettings({ ...settings, metaWabaId: e.target.value })}
                placeholder="e.g. 984719283746123"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Webhook Verification URL:
              </label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 truncate select-all">
                https://your-domain.com/api/webhooks/whatsapp
              </div>
            </div>
          </div>

          {/* Test Mode Switch */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-center justify-between text-xs">
            <div>
              <strong className="text-amber-900 block font-bold">WhatsApp Test Mode (Safe Dry-Run)</strong>
              <p className="text-amber-700 text-[11px] mt-0.5">
                Simulates real Meta message IDs without incurring carrier message charges until live keys are active.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.whatsappTestMode}
              onChange={(e) => setSettings({ ...settings, whatsappTestMode: e.target.checked })}
              className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Global Automation Defaults Card (Section 30) */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Automation Engine Rules</h3>
              <p className="text-xs text-slate-500">Scheduler timing and update frequency policies</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Default Frequency (Days):
              </label>
              <select
                value={settings.defaultUpdateFrequencyDays}
                onChange={(e) => setSettings({ ...settings, defaultUpdateFrequencyDays: Number(e.target.value) })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="1">1 Day (Daily)</option>
                <option value="10">10 Days</option>
                <option value="15">15 Days</option>
                <option value="20">20 Days (Default)</option>
                <option value="30">30 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Scheduled Dispatch Time:
              </label>
              <input
                type="text"
                value={settings.defaultUpdateTime || '09:00'}
                onChange={(e) => setSettings({ ...settings, defaultUpdateTime: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Timezone:
              </label>
              <input
                type="text"
                value={settings.timezone || 'Asia/Kolkata'}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <strong className="text-slate-900 block font-bold">10-Customer Pilot Mode</strong>
              <p className="text-slate-500 text-[11px]">Enables dedicated 10-pilot project dashboard tracker.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.pilotModeEnabled}
              onChange={(e) => setSettings({ ...settings, pilotModeEnabled: e.target.checked })}
              className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Company Profile Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Alpha Elevators Company Profile</h3>
              <p className="text-xs text-slate-500">Corporate details for customer receipts and WhatsApp footers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Company Name:</label>
              <input
                type="text"
                value={settings.companyName || ''}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Support Phone:</label>
              <input
                type="text"
                value={settings.supportPhone || ''}
                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Headquarters Address:</label>
              <input
                type="text"
                value={settings.companyAddress || ''}
                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
