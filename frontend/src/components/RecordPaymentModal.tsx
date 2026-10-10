'use client';

import React, { useState } from 'react';
import { IndianRupee, CreditCard, CheckCircle2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSuccess: (paymentData?: any) => void;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentType, setPaymentType] = useState('Production Payment');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPaid || !transactionReference) {
      setError('Please provide amount and transaction reference');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.recordPayment({
        projectId: project._id,
        amountPaid: Number(amountPaid),
        paymentMethod,
        transactionReference,
        paymentType,
        notes,
      });
      
      onSuccess(response.data);
      onClose();
      
      // Navigate to the invoice page in the same tab
      router.push(`/projects/${project._id}/invoice/${response.data._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const stages = [
    { name: 'Advance', percent: project.advancePercentage || 0 },
    { name: 'Production', percent: project.productionPaymentPercent || 0 },
    { name: 'Readiness', percent: project.readinessNotificationPercent || 0 },
    { name: 'Dispatch', percent: project.dispatchMaterialsPercent || 0 },
    { name: 'Installation', percent: project.afterInstallationPercent || 0 },
  ];

  let remainingPaid = project.totalPaid || 0;
  const breakdown = stages.map(stage => {
    const requiredAmount = ((project.orderValue || 0) * stage.percent) / 100;
    let paidForStage = 0;
    
    if (remainingPaid >= requiredAmount) {
      paidForStage = requiredAmount;
      remainingPaid -= requiredAmount;
    } else {
      paidForStage = remainingPaid;
      remainingPaid = 0;
    }

    const outstanding = requiredAmount - paidForStage;
    
    return {
      ...stage,
      requiredAmount,
      paidForStage,
      outstanding
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up max-h-[95vh] flex flex-col">
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Record Customer Payment</h3>
              <p className="text-[11px] text-slate-300">{project.projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
            <div>
              <span className="text-slate-500 block">Total Order Value:</span>
              <span className="font-bold text-slate-900 text-sm">
                ₹{project.orderValue?.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Outstanding Balance:</span>
              <span className="font-bold text-rose-600 text-sm">
                ₹{project.balanceAmount?.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Stage-wise Outstanding Breakdown</h4>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {breakdown.filter(b => b.requiredAmount > 0).map((b, i) => (
                <div key={i} className="flex justify-between items-center p-2.5 hover:bg-slate-50">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800">{b.name} ({b.percent}%)</div>
                    <div className="text-[10px] text-slate-500">Req: ₹{b.requiredAmount.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="text-right">
                    {b.outstanding <= 0 ? (
                      <span className="text-emerald-600 font-bold flex items-center justify-end gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid
                      </span>
                    ) : (
                      <>
                        <div className="font-bold text-rose-600">Pending: ₹{b.outstanding.toLocaleString('en-IN')}</div>
                        {b.paidForStage > 0 && <div className="text-[10px] text-slate-500">Paid so far: ₹{b.paidForStage.toLocaleString('en-IN')}</div>}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Amount Received (₹): *
            </label>
            <input
              type="number"
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="e.g. 250000"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Type:
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="Booking Advance">Booking Advance</option>
                <option value="Production Payment">Production Payment</option>
                <option value="Rediness Notification">Rediness Notification</option>
                <option value="Dispatch Materials">Dispatch Materials</option>
                <option value="After Installation">After Installation</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="e.g. HDFC0001293847"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Notes:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received against fabrication stage invoice"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2.5">
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
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
