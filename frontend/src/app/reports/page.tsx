'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  IndianRupee,
  MessageSquare,
  Truck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.getReports();
      setData(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const financials = data?.financials || {};
  const wa = data?.whatsappSummary || {};
  const deliveries = data?.upcomingDeliveries || [];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Executive Management Reports</h2>
        <p className="text-xs text-slate-500">
          Financial cash flow, delivery pipeline schedule, and WhatsApp automation performance analytics
        </p>
      </div>

      {/* Financial Health Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block text-xs font-semibold">Total Order Book</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₹{financials.totalOrderBook?.toLocaleString('en-IN') ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Confirmed contract pipeline</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block text-xs font-semibold">Advance & Payments Collected</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            ₹{financials.totalCollected?.toLocaleString('en-IN') ?? 0}
          </div>
          <span className="text-[11px] text-emerald-600 block mt-1 font-semibold">
            {financials.collectionPercentage}% collected to date
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block text-xs font-semibold">Outstanding Receivables</span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            ₹{financials.totalOutstanding?.toLocaleString('en-IN') ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Milestone & balance invoices</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block text-xs font-semibold">WhatsApp Delivery Success</span>
          <div className="text-2xl font-black text-sky-600 mt-1">
            {wa.deliveryRate ?? 100}%
          </div>
          <span className="text-[11px] text-sky-600 block mt-1 font-semibold">
            {wa.totalDelivered} of {wa.totalSent} messages delivered
          </span>
        </div>
      </div>

      {/* Upcoming Deliveries Timeline Table */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Upcoming Elevator Deliveries</h3>
              <p className="text-xs text-slate-500">Site readiness and factory shipping milestones</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4 font-bold">Project</th>
                <th className="py-3 px-4 font-bold">Customer</th>
                <th className="py-3 px-4 font-bold">Lift Model</th>
                <th className="py-3 px-4 font-bold">Current Stage</th>
                <th className="py-3 px-4 font-bold">Expected Delivery</th>
                <th className="py-3 px-4 font-bold">Days Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.map((d: any) => (
                <tr key={d.projectId} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 font-extrabold text-slate-900">{d.projectName}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">{d.customerName}</td>
                  <td className="py-3.5 px-4 text-slate-600">{d.liftModel}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {d.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {new Date(d.expectedDeliveryDate).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-sky-700">
                    {d.daysRemaining > 0 ? `${d.daysRemaining} Days` : 'Due / Passed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
