'use client';

import React, { useState, useEffect } from 'react';
import { IndianRupee, Send, X, AlertCircle, CheckCircle2, Clock, MessageSquare, Phone } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';

interface RequestPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSuccess: (updatedProject: any) => void;
}

export default function RequestPaymentModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: RequestPaymentModalProps) {
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('Booking Advance');
  const [accountantName, setAccountantName] = useState<string>('Vincy (Accountant)');
  const [accountantPhone, setAccountantPhone] = useState<string>('+91 98400 99881');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project && isOpen) {
      if (project.paymentRequest?.status === 'REQUESTED') {
        setPaymentType(project.paymentRequest.paymentType || 'Booking Advance');
        setRequestedAmount(project.paymentRequest.requestedAmount ? String(project.paymentRequest.requestedAmount) : '');
        setNotes(project.paymentRequest.notes || '');
        if (project.paymentRequest.accountantPhone) {
          setAccountantPhone(project.paymentRequest.accountantPhone);
        }
        if (project.paymentRequest.accountantName) {
          setAccountantName(project.paymentRequest.accountantName);
        }
      } else {
        // Default to remaining advance or first milestone
        const remainingAdv = Math.max(0, (project.advanceAmount || 0) - (project.totalPaid || 0));
        if (remainingAdv > 0) {
          setPaymentType('Booking Advance');
          setRequestedAmount(String(remainingAdv));
        } else {
          setPaymentType('Production Milestone');
          const prodAmt = Math.round(((project.orderValue || 0) * (project.productionPaymentPercent || 40)) / 100);
          setRequestedAmount(prodAmt > 0 ? String(prodAmt) : '');
        }
        setNotes('');
      }

      // Try fetching active accountant from system users
      api.getUsers().then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          const accountants = res.data.filter((u: any) => u.role === 'ACCOUNTANT');
          if (accountants.length > 0 && !project.paymentRequest?.accountantPhone) {
            setAccountantName(accountants[0].name || 'Vincy (Accountant)');
            if (accountants[0].phone) setAccountantPhone(accountants[0].phone);
          }
        }
      }).catch(() => {});

      setError(null);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const orderVal = Number(project.orderValue || 0);
  const milestones = [
    { label: 'Booking Advance', pct: project.advancePercentage || 30 },
    { label: 'Production Milestone', pct: project.productionPaymentPercent || 0 },
    { label: 'Readiness Milestone', pct: project.readinessNotificationPercent || 0 },
    ...(Number(project.dispatchMaterialsPercent) > 0 ? [{ label: 'Dispatch Milestone', pct: project.dispatchMaterialsPercent }] : []),
    ...(Number(project.afterInstallationPercent) > 0 ? [{ label: 'Installation Milestone', pct: project.afterInstallationPercent }] : []),
  ];

  const handleSelectMilestone = (m: { label: string; pct: number }) => {
    setPaymentType(m.label);
    const calculated = Math.round((orderVal * m.pct) / 100);
    setRequestedAmount(String(calculated));
  };

  const handleSelectBalance = () => {
    setPaymentType('Full Remaining Balance');
    setRequestedAmount(String(project.balanceAmount || 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(requestedAmount);
    if (!requestedAmount || isNaN(numAmt) || numAmt <= 0) {
      setError('Please provide a valid requested amount greater than 0');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.requestProjectPayment(project._id, {
        requestedAmount: numAmt,
        paymentType,
        notes: notes.trim(),
        accountantPhone: accountantPhone.trim(),
        accountantName: accountantName.trim(),
      });

      toast.success(res.message || 'Payment request sent to Accountant and 1-to-1 WhatsApp alert dispatched!');
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment request');
      toast.error(err.message || 'Failed to submit payment request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F2744] via-[#163861] to-[#1E497C] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold font-poppins">Request Payment Collection</h3>
              <p className="text-[11px] text-slate-300">
                {project.projectName} • <span className="font-mono text-sky-300">{project.projectId}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Info Box */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Order Value</span>
              <p className="font-extrabold text-slate-900 text-xs mt-0.5">₹{orderVal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Total Collected</span>
              <p className="font-extrabold text-emerald-600 text-xs mt-0.5">₹{(project.totalPaid || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Balance Due</span>
              <p className="font-extrabold text-rose-600 text-xs mt-0.5">₹{(project.balanceAmount || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Quick Milestone Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold text-slate-700">
              Select Milestone Allocation:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {milestones.map((m, idx) => {
                const amt = Math.round((orderVal * m.pct) / 100);
                const isSelected = paymentType === m.label;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectMilestone(m)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-400/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-800">{m.label}</span>
                      <span className="text-[10px] font-extrabold text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded-md">
                        {m.pct}%
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 mt-1">
                      ₹{amt.toLocaleString('en-IN')}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleSelectBalance}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  paymentType === 'Full Remaining Balance'
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-800">Full Remaining Balance</span>
                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-md">
                    Due
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-rose-600 mt-1">
                  ₹{(project.balanceAmount || 0).toLocaleString('en-IN')}
                </div>
              </button>
            </div>
          </div>

          {/* Payment Type Name */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Payment Stage / Description:
            </label>
            <input
              type="text"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              placeholder="e.g. Booking Advance or Fabrication Milestone"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              required
            />
          </div>

          {/* Requested Amount Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Amount to Collect (₹):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                min="1"
                max={project.balanceAmount || orderVal}
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="Enter amount to request from accountant"
                className="w-full pl-8 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold text-slate-900"
                required
              />
            </div>
          </div>

          {/* Accountant 1-to-1 WhatsApp Contact Card */}
          <div className="space-y-1.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 p-3.5 rounded-2xl border border-emerald-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-emerald-950 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Accountant 1-to-1 WhatsApp Alert:</span>
              </label>
              <span className="text-[10px] bg-emerald-200/70 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" />
                <span>Direct WhatsApp</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-emerald-800 font-semibold block mb-0.5">Accountant Name:</span>
                <input
                  type="text"
                  value={accountantName}
                  onChange={(e) => setAccountantName(e.target.value)}
                  placeholder="e.g. Vincy (Accountant)"
                  className="w-full p-2 text-xs border border-emerald-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <span className="text-[10px] text-emerald-800 font-semibold block mb-0.5">WhatsApp Number:</span>
                <input
                  type="text"
                  value={accountantPhone}
                  onChange={(e) => setAccountantPhone(e.target.value)}
                  placeholder="+91 98400 99881"
                  className="w-full p-2 text-xs border border-emerald-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-emerald-950"
                  required
                />
              </div>
            </div>
            <p className="text-[10.5px] text-emerald-700 leading-relaxed pt-0.5">
              ✓ Upon submission, a personalized 1-to-1 WhatsApp message with project details, collection amount, and CRM notes will be automatically dispatched to this number.
            </p>
          </div>

          {/* Notes for Accountant */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Notes for Accountant:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer promised RTGS by 4 PM, or Cheque received at site"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
            />
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Once requested, this customer will appear on the <strong>Accountant&apos;s Dashboard</strong> under active payment collection requests, enabling the Accountant to record payment and issue receipts.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2.5">
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
              className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-xl text-xs font-extrabold transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting Request...' : 'Send Request to Accountant'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
