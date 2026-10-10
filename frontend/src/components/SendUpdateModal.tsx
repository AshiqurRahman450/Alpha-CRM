'use client';

import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle, X, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { formatProjectStatus } from './Timeline';

interface SendUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSuccess: () => void;
}

export default function SendUpdateModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: SendUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const stageTemplate = `${project.projectStatus}_UPDATE`;

  const handleSend = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.sendWhatsAppUpdate({
        projectId: project._id,
        customNote: customNote.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch WhatsApp update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Confirm WhatsApp Group Update</h3>
              <p className="text-[11px] text-slate-300">Meta WhatsApp Business Cloud API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
              <span className="text-slate-500 font-medium">Customer:</span>
              <span className="font-bold text-slate-900">{project.customerName || project.projectName}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
              <span className="text-slate-500 font-medium">WhatsApp Group:</span>
              <span className="font-semibold text-sky-700">
                {project.whatsappGroupName || project.whatsappGroupId || 'Not Linked'}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
              <span className="text-slate-500 font-medium">Current Stage:</span>
              <span className="font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded">
                {formatProjectStatus(project.projectStatus)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Approved Template:</span>
              <span className="font-mono text-emerald-700 font-semibold">{stageTemplate}</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Optional Note / Site Memo to append:
            </label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Hoistway structural wall civil curing completed by customer."
              rows={2}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-start space-x-2 text-[11px] text-slate-500 bg-sky-50/70 p-3 rounded-xl border border-sky-100">
            <ShieldAlert className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              This will immediately send the official Meta template to the linked WhatsApp group and advance the next update date by {project.updateFrequencyDays || 20} days.
            </span>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !project.whatsappGroupId}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Sending...' : 'Send Update Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
