'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  FileCode2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ShieldCheck,
  Eye,
  Edit2,
  RotateCw,
  Sparkles,
  X,
  Check,
  Send,
  Search,
  Copy,
  Tag,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';
import { STAGES_ORDER, formatProjectStatus } from '../../components/Timeline';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Edit / Rename Modal State
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formTemplateName, setFormTemplateName] = useState('');
  const [formStageMapping, setFormStageMapping] = useState('');
  const [formBodyText, setFormBodyText] = useState('');
  const [formStatus, setFormStatus] = useState('APPROVED');

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.getTemplates();
      setTemplates(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSyncStages = async () => {
    try {
      setSyncing(true);
      const res = await api.syncTemplateStages();
      toast.success(res.message || 'WhatsApp templates synchronized successfully!');
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenEdit = (t: any) => {
    setEditingTemplate(t);
    setFormDisplayName(t.displayName || '');
    setFormTemplateName(t.templateName || '');
    setFormStageMapping(t.stageMapping || '');
    setFormBodyText(t.bodyText || '');
    setFormStatus(t.templateStatus || 'APPROVED');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      setSavingEdit(true);
      await api.updateTemplate(editingTemplate._id, {
        displayName: formDisplayName.trim(),
        templateName: formTemplateName.trim().toUpperCase(),
        stageMapping: formStageMapping || undefined,
        bodyText: formBodyText,
        templateStatus: formStatus,
      });

      toast.success('Template updated successfully!');
      setEditingTemplate(null);
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update template');
    } finally {
      setSavingEdit(false);
    }
  };

  const copyTemplateBody = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Template text copied to clipboard!');
  };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        searchQuery === '' ||
        t.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.templateName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.bodyText?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'SITE_VISIT') {
        return t.templateName.includes('SITE_VISIT');
      }
      if (selectedCategory === 'APPROVAL') {
        return t.templateName.includes('APPROVAL');
      }
      if (selectedCategory === 'PRODUCTION') {
        return t.templateName.includes('PRODUCTION') || t.templateName.includes('READINESS');
      }
      if (selectedCategory === 'DISPATCH_DELIVERY') {
        return t.templateName.includes('DISPATCH') || t.templateName.includes('DELIVERY') || t.templateName.includes('UNLOADING');
      }
      if (selectedCategory === 'INSTALLATION_HANDOVER') {
        return t.templateName.includes('INSTALLATION') || t.templateName.includes('HAND_OVER');
      }

      return true;
    });
  }, [templates, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>WhatsApp Project Milestone Templates</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-100 text-sky-800">
              {templates.length} Active
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Standard customer communication templates for site visits, drawings, production payments, dispatches, and handover
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleSyncStages}
            disabled={syncing || loading}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-60"
            title="Reset and synchronize all 20 default milestone templates"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Reset Default 20 Templates'}</span>
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 border border-sky-100 rounded-2xl flex items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <span className="font-bold text-sky-950 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-600" />
            20 Customer Communication Milestones
          </span>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            These templates cover the end-to-end journey: from scheduled site measurements and drawing approvals to 3-stage fabrication updates, VRL logistics dispatch, installation arrivals, feedback, and handover.
          </p>
        </div>
      </div>

      {/* Search & Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: `All (${templates.length})` },
            { id: 'SITE_VISIT', label: 'Site Visits' },
            { id: 'APPROVAL', label: 'Drawing & Approval' },
            { id: 'PRODUCTION', label: 'Production & Payments' },
            { id: 'DISPATCH_DELIVERY', label: 'Dispatch & Delivery' },
            { id: 'INSTALLATION_HANDOVER', label: 'Installation & Handover' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates or content..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
          <div className="w-7 h-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-3xl">
          No templates found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((t: any) => {
            const friendlyStage = t.stageMapping ? formatProjectStatus(t.stageMapping) : 'General';
            const hasDateVar = t.bodyText?.includes('[Date]');
            const hasTimeVar = t.bodyText?.includes('[Time]');
            const hasTrackingVar = t.bodyText?.includes('[Tracking Number]');

            return (
              <div
                key={t._id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-sky-300 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] font-bold text-sky-600 block truncate">
                        {t.templateName}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 mt-0.5 leading-snug">
                        {t.displayName}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.templateStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {t.templateStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(t)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                        title="Edit / Customize Template"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Variables pills if any */}
                  {(hasDateVar || hasTimeVar || hasTrackingVar) && (
                    <div className="flex flex-wrap gap-1">
                      {hasDateVar && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-mono font-bold">
                          [Date]
                        </span>
                      )}
                      {hasTimeVar && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-mono font-bold">
                          [Time]
                        </span>
                      )}
                      {hasTrackingVar && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 text-[9px] font-mono font-bold">
                          [Tracking Number]
                        </span>
                      )}
                    </div>
                  )}

                  {/* WhatsApp Message Preview Bubble */}
                  <div className="bg-[#EFEAE2]/40 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-line max-h-48 overflow-y-auto">
                    {t.bodyText}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-slate-400">Stage:</span>
                    <strong className="text-slate-800 font-semibold truncate">{friendlyStage}</strong>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyTemplateBody(t.bodyText)}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                      title="Copy message text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(t)}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 ml-1"
                    >
                      <span>Edit</span>
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Customize Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-scale-up my-auto">
            <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Customize Milestone Template</h3>
                  <p className="text-[11px] text-slate-300">Update Title, Milestone Mapping & Body Text</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Template Title (Display Name):
                </label>
                <input
                  type="text"
                  required
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g. Site Visit Schedule P M"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Timeline Stage Mapping:
                  </label>
                  <select
                    value={formStageMapping}
                    onChange={(e) => setFormStageMapping(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
                  >
                    <option value="">General / None</option>
                    {STAGES_ORDER.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Internal Identifier Code:
                  </label>
                  <input
                    type="text"
                    required
                    value={formTemplateName}
                    onChange={(e) => setFormTemplateName(e.target.value.toUpperCase())}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Approval Status:
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  WhatsApp Message Body:
                </label>
                <textarea
                  rows={5}
                  required
                  value={formBodyText}
                  onChange={(e) => setFormBodyText(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-sans leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports dynamic placeholders: [Date], [Time], [Tracking Number]
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
