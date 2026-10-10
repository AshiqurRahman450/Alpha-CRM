'use client';

import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.getTemplates();
      setTemplates(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            WhatsApp Business Message Templates ({templates.length})
          </h2>
          <p className="text-xs text-slate-500">
            Pre-approved Meta WhatsApp Cloud API templates mapped to elevator engineering milestones
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <div
              key={t._id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-sky-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-sky-600 block">
                      {t.templateName}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-0.5">{t.displayName}</h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.templateStatus === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {t.templateStatus}
                  </span>
                </div>

                <div className="bg-[#EFEAE2]/30 p-3.5 rounded-2xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-line max-h-48 overflow-y-auto">
                  {t.bodyText}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-medium">Stage: <strong>{t.stageMapping || 'General'}</strong></span>
                <span className="font-mono text-[10px]">{t.templateLanguage || 'en_US'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
