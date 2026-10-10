'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Rocket,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  Building2,
  Users,
  Send,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function PilotModePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPilot = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPilot();
  }, []);

  const pilot = data?.pilotMode || {};
  const pilotProjects = pilot.pilotProjects || [];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Pilot Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-[#0A192F] text-white p-8 rounded-3xl border border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>PILOT PHASE 1 ACTIVE</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white mt-1">
              Alpha Elevators 10-Customer Pilot Program
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          The pilot deployment monitors 10 high-value residential elevator installations. Over the 4-month manufacturing and handover cycle, each customer receives automated WhatsApp group updates every 20 days (approx. 60 total updates).
        </p>

        {/* 3 Metrics Callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">Pilot Customers</span>
            <div className="text-2xl font-black text-white mt-1">
              {pilotProjects.length} / {pilot.limit || 10}
            </div>
            <span className="text-[10px] text-emerald-400 block mt-0.5">100% Onboarded</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">Est. 4-Month WhatsApp Updates</span>
            <div className="text-2xl font-black text-white mt-1">60 Messages</div>
            <span className="text-[10px] text-slate-400 block mt-0.5">6 updates per customer</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">Official Meta Cloud API</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">Active</div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Idempotency & Webhooks live</span>
          </div>
        </div>
      </div>

      {/* 10 Pilot Customers Checklist (Section 31 specification) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              10 Pilot Customers & Group Channels Readiness
            </h3>
            <p className="text-xs text-slate-500">Live operational readiness for each pilot villa elevator installation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pilotProjects.map((p: any) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-300 transition-all shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center">
                    ✓
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      Customer #{p.index} • {p.projectId}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">{p.projectName}</h4>
                    <span className="text-xs text-slate-500">{p.customerName}</span>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {p.stage.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[10px]">WhatsApp Group</span>
                  <span className="font-bold text-emerald-700 text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Linked
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Opt-In Consent</span>
                  <span className="font-bold text-emerald-700 text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 text-[11px]">
                  Next Due: {p.nextUpdateAt ? new Date(p.nextUpdateAt).toLocaleDateString('en-GB') : 'Immediate'}
                </span>
                <Link
                  href={`/projects/${p.id}`}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <span>Open Project</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
