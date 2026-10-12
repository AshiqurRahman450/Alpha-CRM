'use client';

import React, { useState, useEffect } from 'react';
import { IndianRupee, Trash2, AlertTriangle, X, Check, Save } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  project: any;
  onSuccess: () => void;
}

export default function EditPaymentModal({
  isOpen,
  onClose,
  payment,
  project,
  onSuccess,
}: EditPaymentModalProps) {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentType, setPaymentType] = useState('Booking Advance');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('SUCCESS');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (payment) {
      setAmountPaid(String(payment.amountPaid ?? ''));
      setPaymentMethod(payment.paymentMethod || 'BANK_TRANSFER');
      setTransactionReference(payment.transactionReference || '');
      setPaymentType(payment.paymentType || 'Booking Advance');
      
      const dateStr = payment.paymentDate
        ? new Date(payment.paymentDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      setPaymentDate(dateStr);
      
      setPaymentStatus(payment.paymentStatus || 'SUCCESS');
      setReceiptNumber(payment.receiptNumber || '');
      setNotes(payment.notes || '');
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [payment, isOpen]);

  if (!isOpen || !payment) return null;

  const originalAmount = Number(payment.amountPaid) || 0;
  const currentEnteredAmount = Number(amountPaid) || 0;
  const difference = currentEnteredAmount - originalAmount;

  // Estimate new balance
  const currentTotalPaid = Number(project?.totalPaid) || 0;
  const orderValue = Number(project?.orderValue) || 0;
  const estimatedNewTotalPaid = Math.max(0, currentTotalPaid + difference);
  const estimatedNewBalance = Math.max(0, orderValue - estimatedNewTotalPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPaid || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) {
      setError('Please provide a valid payment amount greater than 0');
      return;
    }
    if (!transactionReference.trim()) {
      setError('Please provide a transaction reference');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.updatePayment(payment._id, {
        amountPaid: Number(amountPaid),
        paymentMethod,
        transactionReference: transactionReference.trim(),
        paymentType,
        paymentDate,
        paymentStatus,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: notes.trim(),
      });

      toast.success('Payment updated successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await api.deletePayment(payment._id);
      toast.success('Payment deleted successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete payment');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Edit Recorded Payment</h3>
              <p className="text-[11px] text-slate-300">{project?.projectName} &bull; {payment.receiptNumber || 'Receipt'}</p>
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

        {/* Delete Confirmation Banner */}
        {showDeleteConfirm && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col gap-2">
            <div className="flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to delete this payment?</p>
                <p className="text-rose-600 mt-0.5">
                  This will remove the ₹{originalAmount.toLocaleString('en-IN')} payment and recalculate the project balance.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount and Difference Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Currently Recorded Amount:</span>
              <span className="font-bold text-slate-800 text-sm">
                ₹{originalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Recorded Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full pl-8 pr-3 py-2.5 text-sm font-black text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {difference !== 0 && !isNaN(difference) && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Adjustment Difference:</span>
                  <span className={`font-bold ${difference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {difference > 0 ? `+₹${difference.toLocaleString('en-IN')}` : `-₹${Math.abs(difference).toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Projected New Balance:</span>
                  <span className="font-bold text-slate-900">
                    ₹{estimatedNewBalance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Type and Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Type:
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium"
              >
                <option value="Booking Advance">Booking Advance</option>
                <option value="Production Payment">Production Payment</option>
                <option value="Rediness Notification">Rediness Notification</option>
                <option value="Dispatch Materials">Dispatch Materials</option>
                <option value="After Installation">After Installation</option>
                <option value="OTHER">Other / Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="RTGS_NEFT">RTGS / NEFT</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>

          {/* Date and Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Date:
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Status:
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium"
              >
                <option value="SUCCESS">SUCCESS (Collected)</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          {/* Transaction Ref and Receipt Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Transaction Ref / UTR: *
              </label>
              <input
                type="text"
                required
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="e.g. HDFC0001293847"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Receipt Number:
              </label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="e.g. REC-ALP-001"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Notes:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Adjusted advance payment after bank clearance"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deleting}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
