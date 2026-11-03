'use client';

import React, { useEffect, useState } from 'react';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  X,
  Smartphone,
  Server,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface WhatsAppBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: any) => void;
}

export default function WhatsAppBotModal({
  isOpen,
  onClose,
  onStatusChange,
}: WhatsAppBotModalProps) {
  const [botStatus, setBotStatus] = useState<any>({
    status: 'DISCONNECTED',
    isConnected: false,
    qrCode: null,
    botPhoneNumber: null,
  });
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showVpsHelp, setShowVpsHelp] = useState(false);

  const fetchStatus = async (autoInit = false) => {
    try {
      const res = await api.getWhatsAppBotStatus(autoInit);
      if (res && res.success) {
        setBotStatus(res);
        if (onStatusChange) onStatusChange(res);
      }
    } catch (err: any) {
      console.warn('[WhatsAppBotModal] Status check notice:', err.message);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchStatus(true);
    // Poll every 3 seconds while modal is open and not connected
    const timer = setInterval(() => {
      fetchStatus(false);
    }, 3000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleRestart = async () => {
    try {
      setRestarting(true);
      toast.loading('Restarting WhatsApp Bot session...', { id: 'bot-action' });
      const res = await api.initWhatsAppBot();
      if (res && res.success) {
        toast.success('WhatsApp Bot initialized! Awaiting QR scan.', { id: 'bot-action' });
        setBotStatus(res);
        if (onStatusChange) onStatusChange(res);
      } else {
        toast.error(res?.message || 'Failed to initialize bot', { id: 'bot-action' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error restarting bot', { id: 'bot-action' });
    } finally {
      setRestarting(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to unlink and log out the WhatsApp bot session?')) return;
    try {
      setLoading(true);
      toast.loading('Logging out WhatsApp Bot session...', { id: 'bot-action' });
      const res = await api.logoutWhatsAppBot();
      if (res && res.success) {
        toast.success('WhatsApp session unlinked. You can now link a new number.', { id: 'bot-action' });
        setBotStatus(res);
        if (onStatusChange) onStatusChange(res);
      } else {
        toast.error(res?.message || 'Failed to logout bot', { id: 'bot-action' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error logging out bot', { id: 'bot-action' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = botStatus.isConnected || botStatus.status === 'CONNECTED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <QrCode className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>WhatsApp Web Bot Manager</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    isConnected ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-400 text-amber-950'
                  }`}
                >
                  {isConnected ? 'Active & Live' : botStatus.status || 'Offline'}
                </span>
              </h3>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                Powers real-time WhatsApp group notifications, reminders & milestone updates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Display Banner */}
          {isConnected ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-emerald-900">Bot is Connected & Listening!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Logged in phone: <strong className="font-mono">{botStatus.botPhoneNumber || 'Active Device'}</strong>
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  Incoming group messages are automatically monitored and real-time reminders will trigger instantly for CRM.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900">WhatsApp Web Bot Not Connected</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Please link a WhatsApp device below so the server can listen to customer group messages and trigger reminders.
                </p>
              </div>
            </div>
          )}

          {/* QR Code Section (if not connected) */}
          {!isConnected && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Scan with WhatsApp on your Phone</span>
              </div>

              {botStatus.qrCode ? (
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 inline-block shadow-sm">
                    <img
                      src={botStatus.qrCode}
                      alt="WhatsApp Web Bot QR Code"
                      className="w-56 h-56 mx-auto rounded-xl"
                    />
                  </div>
                  <ol className="text-left text-xs text-slate-600 space-y-1.5 max-w-xs mx-auto bg-white p-3 rounded-xl border border-slate-200 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">1</span>
                      <span>Open WhatsApp on your phone</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">2</span>
                      <span>Tap <strong>Settings</strong> or <strong>Menu (⋮)</strong> &gt; <strong>Linked Devices</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">3</span>
                      <span>Tap <strong>Link a Device</strong> and point your camera here</span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="py-8 space-y-3">
                  <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold text-slate-600">Generating fresh WhatsApp QR Code...</p>
                  <p className="text-[11px] text-slate-400">If it takes more than 5 seconds, click Regenerate below.</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
                  <span>Regenerate QR Code</span>
                </button>
              </div>
            </div>
          )}

          {/* VPS Hostinger Deployment Tip */}
          <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 space-y-2">
            <button
              onClick={() => setShowVpsHelp(!showVpsHelp)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 hover:text-slate-900"
            >
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-600" />
                <span>Deployed on Hostinger VPS? Read This</span>
              </div>
              <span className="text-xs text-sky-600">{showVpsHelp ? 'Hide ▲' : 'Show Guide ▼'}</span>
            </button>

            {showVpsHelp && (
              <div className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-200 leading-relaxed font-sans animate-fade-in">
                <p>
                  <strong>Why was it disconnected on VPS?</strong> When code is pushed via git, the local authentication folder (<code>backend/data/baileys_auth</code>) is gitignored for security.
                </p>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                  <p className="font-bold text-slate-800">Two Easy Ways to Connect on Live VPS:</p>
                  <p>
                    <strong>Option 1 (Easiest):</strong> Simply scan the QR code above from this live browser page. Once scanned, the session is stored permanently on your VPS disk.
                  </p>
                  <p>
                    <strong>Option 2 (Copy local session):</strong> Copy your local folder <code>backend/data/baileys_auth</code> directly to your VPS at <code>/var/www/Alpha-CRM/backend/data/baileys_auth</code> via FileZilla / SCP and run <code>pm2 restart all</code>. It will connect instantly without scanning!
                  </p>
                  <p>
                    <strong>Option 3 (Terminal):</strong> In your VPS SSH terminal, run <code>pm2 logs</code>. The QR code will also be displayed directly in your terminal window!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {isConnected ? (
            <button
              onClick={handleLogout}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Unlink / Log Out Bot</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">
              Listening socket will start automatically once scanned.
            </span>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

