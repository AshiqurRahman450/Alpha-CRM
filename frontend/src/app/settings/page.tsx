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
} from 'lucide-react';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
