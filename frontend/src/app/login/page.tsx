'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@alphaelevators.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await api.login({ email, password });
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (userType: 'admin' | 'crm' | 'accountant' | 'qc' | 'techlead') => {
    if (userType === 'admin') {
      setEmail('admin@alphaelevators.com');
      setPassword('admin123');
    } else if (userType === 'crm') {
      setEmail('crm@alphaelevators.com');
      setPassword('crm123');
    } else if (userType === 'accountant') {
      setEmail('vincy@alphaelevators.com');
      setPassword('vincy123');
    } else if (userType === 'qc') {
      setEmail('qc@alphaelevators.com');
      setPassword('qc123');
    } else {
      setEmail('techlead@alphaelevators.com');
      setPassword('tech123');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#071322] p-4 text-slate-100">
      <div className="max-w-md w-full bg-[#0F2038] border border-slate-700/80 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-full flex items-center justify-center mx-auto mb-1">
            <img src="/logo.png" alt="Alpha Elevators Logo" className="h-16 w-auto object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white font-poppins">
            ALPHA <span className="text-cyan-400">ELEVATORS</span>
          </h1>
          <p className="text-xs text-slate-400">
            Customer Project CRM & Meta WhatsApp Automation
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Work Email Address:
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Password:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Alpha CRM'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Demo Login helpers */}
        <div className="pt-4 border-t border-slate-800 text-center space-y-2 text-[11px]">
          <span className="text-slate-400 block font-medium">Quick Demo Credentials:</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg border border-slate-700 transition-colors"
            >
              Admin (Full)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('crm')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
            >
              CRM Agent
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('accountant')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition-colors"
            >
              Vincy (Accountant)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('qc')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 transition-colors"
            >
              Dinesh (QC)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('techlead')}
              className="px-3 py-1 bg-sky-900/60 hover:bg-sky-800 text-sky-300 rounded-lg border border-sky-600/50 transition-colors font-semibold"
            >
              Suresh (Tech Lead)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
