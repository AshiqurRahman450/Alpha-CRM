'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Play, Sparkles, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

export default function Navbar() {
  const pathname = usePathname();
  const [triggering, setTriggering] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

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

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-3">
        <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span className="text-slate-400 font-normal">Alpha CRM /</span>
          {pathname === '/'
            ? 'Dashboard'
            : pathname.startsWith('/projects/') && pathname !== '/projects'
            ? 'Project Details'
            : pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2)}
        </h1>
      </div>

      <div className="flex items-center space-x-3">
        {/* Test Mode pill */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>TEST MODE ENABLED</span>
        </div>

        {/* Webhook Status pill */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Meta Webhooks Active</span>
        </div>

        {/* Run Scheduler Button */}
        <button
          onClick={handleRunScheduler}
          disabled={triggering}
          className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          title="Run Automation Scheduler now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
          <span>{triggering ? 'Checking Due...' : 'Run Scheduler'}</span>
        </button>

        {feedback && (
          <div className="text-xs bg-sky-100 text-sky-800 font-medium px-3 py-1 rounded-lg border border-sky-200 animate-fade-in">
            {feedback}
          </div>
        )}
      </div>
    </header>
  );
}
