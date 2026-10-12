'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, IndianRupee, X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSuccess: () => void;
}

export default function EditScheduleModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: EditScheduleModalProps) {
  const [orderValue, setOrderValue] = useState('');
  const [advancePercentage, setAdvancePercentage] = useState('30');
  const [productionPaymentPercent, setProductionPaymentPercent] = useState('20');
  const [readinessNotificationPercent, setReadinessNotificationPercent] = useState('20');
  const [dispatchMaterialsPercent, setDispatchMaterialsPercent] = useState('20');
  const [afterInstallationPercent, setAfterInstallationPercent] = useState('10');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setOrderValue(String(project.orderValue ?? ''));
      setAdvancePercentage(String(project.advancePercentage ?? 30));
      setProductionPaymentPercent(String(project.productionPaymentPercent ?? 20));
      setReadinessNotificationPercent(String(project.readinessNotificationPercent ?? 20));
      setDispatchMaterialsPercent(String(project.dispatchMaterialsPercent ?? 20));
      setAfterInstallationPercent(String(project.afterInstallationPercent ?? 10));
      setError(null);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const numOrderValue = Number(orderValue) || 0;
  const numAdv = Number(advancePercentage) || 0;
  const numProd = Number(productionPaymentPercent) || 0;
  const numRead = Number(readinessNotificationPercent) || 0;
  const numDisp = Number(dispatchMaterialsPercent) || 0;
  const numInst = Number(afterInstallationPercent) || 0;

  const totalPercent = numAdv + numProd + numRead + numDisp + numInst;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numOrderValue <= 0) {
      setError('Please provide a valid total order value');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.updateProject(project._id, {
        orderValue: numOrderValue,
        advancePercentage: numAdv,
        productionPaymentPercent: numProd,
        readinessNotificationPercent: numRead,
        dispatchMaterialsPercent: numDisp,
        afterInstallationPercent: numInst,
      });

      toast.success('Payment schedule updated successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment schedule');
    } finally {
      setLoading(false);
    }
  };

  const milestones = [
    { label: 'Booking Advance (%)', val: advancePercentage, set: setAdvancePercentage, num: numAdv },
    { label: 'Production Payment (%)', val: productionPaymentPercent, set: setProductionPaymentPercent, num: numProd },
    { label: 'Readiness Notification (%)', val: readinessNotificationPercent, set: setReadinessNotificationPercent, num: numRead },
    { label: 'Dispatch Materials (%)', val: dispatchMaterialsPercent, set: setDispatchMaterialsPercent, num: numDisp },
    { label: 'After Installation (%)', val: afterInstallationPercent, set: setAfterInstallationPercent, num: numInst },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Edit Payment Schedule & Milestones</h3>
              <p className="text-[11px] text-slate-300">{project.projectName} &bull; {project.projectId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Total Order Value */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Total Order Value (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={orderValue}
                onChange={(e) => setOrderValue(e.target.value)}
                placeholder="e.g. 1500000"
                className="w-full pl-8 pr-3 py-2.5 text-sm font-black text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Total % Indicator */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            totalPercent === 100
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              {totalPercent === 100 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <span className="font-semibold text-xs">
                Total Milestone Allocation:
              </span>
            </div>
            <div className="font-extrabold text-sm">
              {totalPercent}% {totalPercent === 100 ? '(Balanced)' : `(${totalPercent > 100 ? '+' : ''}${totalPercent - 100}% off)`}
            </div>
          </div>

          {/* Milestones Breakdown inputs */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Milestone Percentages & Scheduled Amounts
            </h4>

            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              {milestones.map((m, idx) => {
                const milestoneAmount = Math.round((numOrderValue * m.num) / 100);
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <div className="flex-1">
                      <span className="block font-semibold text-slate-800 text-[11px]">{m.label}</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        ₹{milestoneAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="w-24">
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          value={m.val}
                          onChange={(e) => m.set(e.target.value)}
                          className="w-full pr-6 pl-2.5 py-1.5 text-xs text-right font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                        <span className="absolute right-2 top-1.5 text-slate-400 font-bold text-xs">%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Update Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
