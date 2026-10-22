'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Send, AlertCircle, CheckCircle, X, ShieldAlert, Sparkles, MessageSquare, Calendar, Clock, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { formatProjectStatus } from './Timeline';

interface SendUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSuccess: () => void;
}

// Stage to default template mapping
const STAGE_DEFAULT_TEMPLATE: Record<string, string> = {
  PAYMENT_RECEIVED: 'SITE_VISIT_SCHEDULE_PM',
  SITE_MEASUREMENT: 'SITE_VISIT_COMPLETED',
  DESIGN: 'DRAWING_CABIN_APPROVAL',
  CUSTOMER_APPROVAL: 'DRAWING_CABIN_APPROVAL_REMINDER',
  ENGINEERING: 'PRODUCTION_PAYMENT_RECEIVED',
  MANUFACTURING: 'PRODUCTION_UPDATE_STAGE_1',
  QUALITY_CHECK: 'READINESS_PAYMENT',
  DELIVERY: 'PRE_INSTALLATION_SITE_VISIT_PM',
  DISPATCH: 'MATERIAL_DISPATCHED_PM',
  INSTALLATION: 'INSTALLATION_TEAM_ARRIVAL_PM',
  TESTING: 'HAND_OVER_PM',
  COMPLETED: 'HAND_OVER_PM',
};

export default function SendUpdateModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: SendUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');
  const [customNote, setCustomNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Dynamic variable states for [Date], [Time], [Tracking Number]
  const [varDate, setVarDate] = useState('');
  const [varTime, setVarTime] = useState('11:00 AM');
  const [varTrackingNumber, setVarTrackingNumber] = useState('');

  // Fetch all templates on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadTemplates() {
      try {
        setLoadingTemplates(true);
        const res = await api.getTemplates();
        if (isMounted) {
          const list = res.data || [];
          setTemplates(list);

          // Find default template for project status
          let defName = STAGE_DEFAULT_TEMPLATE[project?.projectStatus] || 'SITE_VISIT_COMPLETED';
          if (project?.projectStatus === 'ENGINEERING') {
            defName = 'PRODUCTION_PAYMENT_RECEIVED';
          } else if (project?.projectStatus === 'MANUFACTURING') {
            if (project?.productionStage === 2) defName = 'PRODUCTION_UPDATE_STAGE_2';
            else if (project?.productionStage >= 3) defName = 'PRODUCTION_UPDATE_STAGE_3';
            else defName = 'PRODUCTION_UPDATE_STAGE_1';
          } else if (project?.projectStatus === 'SITE_MEASUREMENT') {
            defName = 'SITE_VISIT_COMPLETED';
          }
          const exists = list.find((t: any) => t.templateName === defName);
          setSelectedTemplateName(exists ? defName : (list[0]?.templateName || ''));
        }
      } catch (err: any) {
        console.error('Failed to load templates:', err);
      } finally {
        if (isMounted) setLoadingTemplates(false);
      }
    }

    loadTemplates();

    // Initialize defaults from project
    const siteVisitStage = project?.stageDates?.get ? project?.stageDates?.get('SITE_MEASUREMENT') : project?.stageDates?.['SITE_MEASUREMENT'];
    if (siteVisitStage?.scheduleDate) {
      const d = new Date(siteVisitStage.scheduleDate);
      setVarDate(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
    } else {
      setVarDate(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
    }

    setVarTime('11:00 AM');
    setVarTrackingNumber((project as any)?.vrlLrNumber || (project as any)?.trackingNumber || '');
    setCustomNote('');
    setError(null);

    return () => {
      isMounted = false;
    };
  }, [isOpen, project]);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.templateName === selectedTemplateName) || null;
  }, [templates, selectedTemplateName]);

  const needsDate = useMemo(() => {
    return Boolean(selectedTemplate?.bodyText?.includes('[Date]'));
  }, [selectedTemplate]);

  const needsTime = useMemo(() => {
    return Boolean(selectedTemplate?.bodyText?.includes('[Time]'));
  }, [selectedTemplate]);

  const needsTracking = useMemo(() => {
    return Boolean(selectedTemplate?.bodyText?.includes('[Tracking Number]'));
  }, [selectedTemplate]);

  // Formatted preview text
  const previewText = useMemo(() => {
    if (!selectedTemplate) return 'Select a template to preview...';
    let text = selectedTemplate.bodyText;
    if (needsDate) {
      text = text.replace(/\[Date\]/g, varDate || '[Date]');
    }
    if (needsTime) {
      text = text.replace(/\[Time\]/g, varTime || '[Time]');
    }
    if (needsTracking) {
      text = text.replace(/\[Tracking Number\]/g, varTrackingNumber || '[Tracking Number]');
    }
    if (customNote.trim()) {
      text += `\n\nNote: ${customNote.trim()}`;
    }
    return text;
  }, [selectedTemplate, needsDate, needsTime, needsTracking, varDate, varTime, varTrackingNumber, customNote]);

  if (!isOpen || !project) return null;

  const handleSend = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.sendWhatsAppUpdate({
        projectId: project._id,
        templateNameOverride: selectedTemplateName || undefined,
        customNote: customNote.trim() || undefined,
        variables: {
          date: varDate,
          time: varTime,
          trackingNumber: varTrackingNumber,
        },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up my-auto">
        {/* Header */}
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black">Send WhatsApp Milestone Update</h3>
              <p className="text-[11px] text-slate-300">Meta WhatsApp Business Cloud API & Direct Group Bot</p>
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
        <div className="p-5 space-y-4 text-xs max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">Customer & Project:</span>
              <span className="font-bold text-slate-900">{project.customerName || project.projectName}</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">WhatsApp Group:</span>
              <span className="font-semibold text-sky-700 font-mono text-[11px]">
                {project.whatsappGroupName || project.whatsappGroupId || 'Not Linked'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">Current Timeline Stage:</span>
              <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-lg text-[11px]">
                {formatProjectStatus(project.projectStatus)}
              </span>
            </div>
          </div>

          {/* Template Selector Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-slate-800 flex items-center justify-between">
              <span>Select WhatsApp Template ({templates.length} Approved):</span>
              {selectedTemplate?.stageMapping && (
                <span className="text-[10px] text-sky-600 font-semibold">
                  Stage: {formatProjectStatus(selectedTemplate.stageMapping)}
                </span>
              )}
            </label>
            <select
              value={selectedTemplateName}
              onChange={(e) => setSelectedTemplateName(e.target.value)}
              disabled={loadingTemplates || templates.length === 0}
              className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {templates.map((tmpl) => (
                <option key={tmpl.templateName} value={tmpl.templateName}>
                  {tmpl.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Variable Inputs */}
          {(needsDate || needsTime || needsTracking) && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2.5">
              <span className="text-[11px] font-bold text-amber-900 block">
                Fill Template Variables:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {needsDate && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      Date:
                    </label>
                    <input
                      type="text"
                      value={varDate}
                      onChange={(e) => setVarDate(e.target.value)}
                      placeholder="e.g. 25 Oct 2026"
                      className="w-full p-2 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                  </div>
                )}
                {needsTime && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-700" />
                      Time:
                    </label>
                    <input
                      type="text"
                      value={varTime}
                      onChange={(e) => setVarTime(e.target.value)}
                      placeholder="e.g. 11:00 AM"
                      className="w-full p-2 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                  </div>
                )}
                {needsTracking && (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-amber-700" />
                      VRL Tracking Number:
                    </label>
                    <input
                      type="text"
                      value={varTrackingNumber}
                      onChange={(e) => setVarTrackingNumber(e.target.value)}
                      placeholder="e.g. VRL-BLR-9988123"
                      className="w-full p-2 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live WhatsApp Bubble Preview */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              Live Customer WhatsApp Preview:
            </span>
            <div className="bg-[#EFEAE2] p-3.5 rounded-2xl border border-slate-300/70 shadow-inner">
              <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm text-slate-800 text-xs font-sans whitespace-pre-line leading-relaxed border border-slate-200">
                {previewText}
                <div className="text-[9px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1 font-mono">
                  <span>Just now</span>
                  <CheckCircle className="w-2.5 h-2.5 text-sky-500 inline" />
                </div>
              </div>
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Optional Note / Site Memo to append:
            </label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Hoistway structural wall civil curing completed by customer."
              rows={2}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div className="flex items-start space-x-2 text-[11px] text-slate-500 bg-sky-50/70 p-3 rounded-2xl border border-sky-100">
            <ShieldAlert className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              This will send this template to the linked WhatsApp group and advance the next update date by {project.updateFrequencyDays || 20} {Number(project.updateFrequencyDays) === 1 ? 'day' : 'days'}.
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
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Sending...' : 'Send Update Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
