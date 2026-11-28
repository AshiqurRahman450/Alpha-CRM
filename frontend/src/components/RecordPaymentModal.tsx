'use client';

import React, { useState, useEffect } from 'react';
import { IndianRupee, CheckCircle2, X, Plus, Trash2, Bell } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  existingPayments?: any[];
  initialPaymentNumber?: number;
  onSuccess: (paymentData?: any) => void;
}

interface PaymentEntryRow {
  paymentNumber: number;
  paymentLabel: string;
  amountPaid: string;
  paymentMethod: string;
  transactionReference: string;
  notes: string;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  project,
  existingPayments = [],
  initialPaymentNumber,
  onSuccess,
}: RecordPaymentModalProps) {
  const [fetchedPayments, setFetchedPayments] = useState<any[]>([]);
  const activeExistingPayments = existingPayments.length > 0 ? existingPayments : fetchedPayments;
  const baseNextNumber =
    initialPaymentNumber || (Array.isArray(activeExistingPayments) ? activeExistingPayments.length + 1 : 1);

  const [entries, setEntries] = useState<PaymentEntryRow[]>([
    {
      paymentNumber: baseNextNumber,
      paymentLabel: `Payment ${baseNextNumber}`,
      amountPaid: '',
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: '',
      notes: '',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRequestedByCrm = project?.paymentRequest?.status === 'REQUESTED';

  useEffect(() => {
    if (project && isOpen) {
      const initWithCount = (count: number) => {
        const startNum = initialPaymentNumber || count + 1;
        const defaultAmount =
          project.paymentRequest?.status === 'REQUESTED' && project.paymentRequest?.requestedAmount
            ? String(project.paymentRequest.requestedAmount)
            : '';
        const defaultNotes =
          project.paymentRequest?.status === 'REQUESTED' && project.paymentRequest?.notes
            ? `CRM Request: ${project.paymentRequest.notes}`
            : '';

        setEntries([
          {
            paymentNumber: startNum,
            paymentLabel: `Payment ${startNum}`,
            amountPaid: defaultAmount,
            paymentMethod: 'BANK_TRANSFER',
            transactionReference: '',
            notes: defaultNotes,
          },
        ]);
      };

      initWithCount(existingPayments.length);
      if (existingPayments.length === 0 && project._id) {
        api
          .getPayments(project._id)
          .then((res) => {
            const list = Array.isArray(res?.data) ? res.data : [];
            setFetchedPayments(list);
            initWithCount(list.length);
          })
          .catch(() => {});
      }
      setError(null);
    }
  }, [project, isOpen, initialPaymentNumber, existingPayments.length]);

  if (!isOpen || !project) return null;

  const updateEntry = (index: number, field: keyof PaymentEntryRow, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddNextPaymentRow = () => {
    setEntries((prev) => {
      const lastNum = prev.length > 0 ? prev[prev.length - 1].paymentNumber : baseNextNumber - 1;
      const nextNum = lastNum + 1;
      return [
        ...prev,
        {
          paymentNumber: nextNum,
          paymentLabel: `Payment ${nextNum}`,
          amountPaid: '',
          paymentMethod: 'BANK_TRANSFER',
          transactionReference: '',
          notes: '',
        },
      ];
    });
  };

  const handleRemoveEntryRow = (index: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((item, idx) => {
        const num = baseNextNumber + idx;
        return {
          ...item,
          paymentNumber: num,
          paymentLabel: `Payment ${num}`,
        };
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (const entry of entries) {
      if (!entry.amountPaid || Number(entry.amountPaid) <= 0 || !entry.transactionReference.trim()) {
        setError(`Please enter a valid amount and transaction reference for ${entry.paymentLabel}`);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      let lastRecorded: any = null;

      for (const entry of entries) {
        const response = await api.recordPayment({
          projectId: project._id,
          amountPaid: Number(entry.amountPaid),
          paymentMethod: entry.paymentMethod,
          transactionReference: entry.transactionReference.trim(),
          paymentType: entry.paymentLabel,
          notes: entry.notes.trim(),
        });
        lastRecorded = response?.data;
      }

      const recordedLabels = entries.map((e) => e.paymentLabel).join(', ');
      toast.success(`${recordedLabels} recorded successfully!`);

      onSuccess(lastRecorded);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const sortedExisting = [...(activeExistingPayments || [])].sort(
    (a, b) => new Date(a.paymentDate || a.createdAt || 0).getTime() - new Date(b.paymentDate || b.createdAt || 0).getTime()
  );

  const totalEnteredNow = entries.reduce((sum, item) => sum + (Number(item.amountPaid) || 0), 0);
  const projectedBalance = Math.max(0, (project.balanceAmount || 0) - totalEnteredNow);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up max-h-[95vh] flex flex-col">
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                Record Customer Payment ({entries.map((e) => e.paymentLabel).join(', ')})
              </h3>
              <p className="text-[11px] text-slate-300">
                {project.projectName} • <span className="font-mono text-sky-300">{project.projectId}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 font-medium">
              {error}
            </div>
          )}

          {isRequestedByCrm && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-1.5 text-amber-900">
                  <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                  <span>CRM Collection Request Active</span>
                </div>
                <span className="font-mono text-xs font-black text-amber-800">
                  ₹{(project.paymentRequest.requestedAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-[11px] text-amber-800 flex items-center justify-between">
                <span>Entry: <strong>{project.paymentRequest.paymentType || `Payment ${baseNextNumber}`}</strong></span>
                <span>By: <strong>{project.paymentRequest.requestedBy || 'CRM'}</strong></span>
              </div>
              {project.paymentRequest.notes && (
                <div className="text-[10px] text-amber-900/90 bg-white/80 p-2 rounded-lg border border-amber-200/60 italic">
                  &ldquo;{project.paymentRequest.notes}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Order Value & Balance Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Order Value</span>
              <span className="font-bold text-slate-900 text-sm">
                ₹{(project.orderValue || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Collected So Far</span>
              <span className="font-bold text-emerald-600 text-sm">
                ₹{(project.totalPaid || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Remaining Balance</span>
              <span className="font-bold text-rose-600 text-sm">
                ₹{projectedBalance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Previously Recorded Payments List */}
          {sortedExisting.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                Recorded Payments ({sortedExisting.length})
              </h4>
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-2.5 flex flex-wrap gap-2">
                {sortedExisting.map((p: any, idx: number) => (
                  <div
                    key={p._id || idx}
                    className="px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg flex items-center gap-1.5 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 text-[11px]">
                      {/^payment\s*\d+/i.test(String(p.paymentType || ''))
                        ? p.paymentType
                        : `Payment ${idx + 1}`}
                      :
                    </span>
                    <span className="font-extrabold text-emerald-700 text-[11px]">
                      ₹{(p.amountPaid || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Sequential Payment Entries (Payment 1, click + for Payment 2, Payment 3, ...) */}
          <div className="space-y-3">
            {entries.map((entry, idx) => (
              <div
                key={entry.paymentNumber}
                className="p-4 rounded-2xl border-2 border-sky-200 bg-sky-50/30 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-black text-xs shadow-2xs">
                      {entry.paymentLabel}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      Installment #{entry.paymentNumber}
                    </span>
                  </div>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEntryRow(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove this payment entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {entry.paymentLabel} Amount (₹): *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={entry.amountPaid}
                      onChange={(e) => updateEntry(idx, 'amountPaid', e.target.value)}
                      placeholder="e.g. 250000"
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Payment Method:
                    </label>
                    <select
                      value={entry.paymentMethod}
                      onChange={(e) => updateEntry(idx, 'paymentMethod', e.target.value)}
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Transaction Reference / UTR Number: *
                  </label>
                  <input
                    type="text"
                    required
                    value={entry.transactionReference}
                    onChange={(e) => updateEntry(idx, 'transactionReference', e.target.value)}
                    placeholder="e.g. HDFC0001293847"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Notes (Optional):
                  </label>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) => updateEntry(idx, 'notes', e.target.value)}
                    placeholder={`Optional note for ${entry.paymentLabel}`}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            ))}

            {/* Plus (+) Icon Button to Add Next Payment Entry (Payment 2, Payment 3, ...) */}
            <button
              type="button"
              onClick={handleAddNextPaymentRow}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              title="Click + to add another payment entry"
            >
              <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Plus className="w-3.5 h-3.5" />
              </span>
              <span>
                Add Payment {(entries[entries.length - 1]?.paymentNumber || baseNextNumber) + 1}
              </span>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {loading
                ? 'Recording...'
                : `Record ${entries.map((e) => e.paymentLabel).join(' & ')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
