'use client';

import React, { useState } from 'react';
import { Clock, AlertCircle, X } from 'lucide-react';
import { api } from '../lib/api';

interface PostponeModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSuccess: () => void;
}

export default function PostponeModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: PostponeModalProps) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handlePostpone = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.postponeWhatsAppUpdate({
        projectId: project._id,
        postponeDays: days,
        reason: reason.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to postpone update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Postpone WhatsApp Update</h3>
              <p className="text-[11px] text-slate-400">{project.projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-2">
              Postpone By:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 5, 7, 14].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`py-2 text-center rounded-xl font-bold border transition-all ${
                    days === d
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Reason / Internal CRM Memo:
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Awaiting customer civil plastering work on elevator shaft."
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePostpone}
            disabled={loading}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Postponing...' : `Postpone by ${days} Days`}
          </button>
        </div>
      </div>
    </div>
  );
}
