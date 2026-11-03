'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RefreshCw, Menu, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import WhatsAppBotModal from './WhatsAppBotModal';

export default function Navbar() {
  const pathname = usePathname();
  const [triggering, setTriggering] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // WhatsApp Web Bot Status
  const [botStatus, setBotStatus] = useState<any>({
    status: 'DISCONNECTED',
    isConnected: false,
    botPhoneNumber: null,
  });
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);

  const checkBotStatus = async () => {
    try {
      const res = await api.getWhatsAppBotStatus();
      if (res && res.success) {
        setBotStatus(res);
      }
    } catch {
      // Quiet fail if network/auth not ready
    }
  };

  useEffect(() => {
    if (pathname === '/login') return;
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 15000); // Check bot status every 15s
    return () => clearInterval(interval);
  }, [pathname]);

  if (pathname === '/login') return null;

  const handleRunScheduler = async () => {
    try {
      setTriggering(true);
      setFeedback('Running WhatsApp scheduler...');
      const res = await api.triggerScheduler();
      setFeedback(res.message || 'Scheduler completed');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setTriggering(false);
    }
  };

  const isBotConnected = botStatus.isConnected || botStatus.status === 'CONNECTED';

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Mobile Hamburger Drawer Toggle */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
            className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400 font-normal hidden sm:inline">Alpha CRM /</span>
            <span className="truncate max-w-[170px] sm:max-w-none">
              {pathname === '/'
                ? 'Dashboard'
                : pathname === '/qc'
                ? 'QC Pre-Production Site Inspection'
                : pathname.startsWith('/projects/') && pathname !== '/projects'
                ? 'Project Details'
                : pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2)}
            </span>
          </h1>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* WhatsApp Web Bot Status Pill (Clickable) */}
          <button
            onClick={() => setIsBotModalOpen(true)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
              isBotConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 animate-pulse'
            }`}
            title="Click to manage WhatsApp Web Bot & QR Code connection"
          >
            {isBotConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="hidden sm:inline">Bot: {botStatus.botPhoneNumber || 'Connected'}</span>
                <span className="sm:hidden">Bot: On</span>
              </>
            ) : (
              <>
                <QrCode className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">WhatsApp Bot: Disconnected (Link)</span>
                <span className="sm:hidden">Link Bot</span>
              </>
            )}
          </button>

          {/* Test Mode pill */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <span>TEST MODE</span>
          </div>

          {/* Run Scheduler Button */}
          <button
            onClick={handleRunScheduler}
            disabled={triggering}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Run Automation Scheduler now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{triggering ? 'Checking Due...' : 'Run Scheduler'}</span>
          </button>

          {feedback && (
            <div className="text-xs bg-sky-100 text-sky-800 font-medium px-3 py-1 rounded-lg border border-sky-200 animate-fade-in">
              {feedback}
            </div>
          )}
        </div>
      </header>

      {/* Global WhatsApp Web Bot Link / QR Code Modal */}
      <WhatsAppBotModal
        isOpen={isBotModalOpen}
        onClose={() => setIsBotModalOpen(false)}
        onStatusChange={(newStatus) => setBotStatus(newStatus)}
      />
    </>
  );
}
