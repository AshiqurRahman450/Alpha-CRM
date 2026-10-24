'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Info,
  RefreshCw,
  Edit2,
  CalendarCheck2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import {
  formatDateDisplay,
  formatDateISO,
  parseDateString,
  toWorkingDay,
  isWeekend,
  calculateCompleteDate,
  DEFAULT_INSTALLATION_STAGES,
  generateInitialSchedule,
  cascadeScheduleUpdates,
} from '../lib/workingDays';

export interface InstallationStageItem {
  slNo: number;
  stageKey: string;
  stageName: string;
  startDate: string; // YYYY-MM-DD
  completeDate: string; // YYYY-MM-DD
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  durationWorkingDays?: number;
  delayReason?: 'HOLIDAY' | 'TECHNICAL_ISSUE' | null;
  delayNotes?: string;
}

interface InstallationProgrammeTableProps {
  projectId: string;
  projectName?: string;
  projectCode?: string;
  customerName?: string;
  customerCity?: string;
  hasWhatsAppGroup?: boolean;
  currentUserRole?: string;
  onHandoverDateChanged?: (newHandoverDate: string) => void;
}

export default function InstallationProgrammeTable({
  projectId,
  projectName = 'Elevator Project',
  projectCode = 'ALP-001',
  customerName = 'Client',
  customerCity = 'Tamil Nadu',
  hasWhatsAppGroup = true,
  currentUserRole,
  onHandoverDateChanged,
}: InstallationProgrammeTableProps) {
  const [stages, setStages] = useState<InstallationStageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);

  // Initial Schedule setup state
  const [showInitModal, setShowInitModal] = useState<boolean>(false);
  const [initStartDate, setInitStartDate] = useState<string>('');
  const [initCompleteDate, setInitCompleteDate] = useState<string>('');
  const [initializingSchedule, setInitializingSchedule] = useState<boolean>(false);
  const [customPreviewStages, setCustomPreviewStages] = useState<InstallationStageItem[]>([]);
  const [showCustomTable, setShowCustomTable] = useState<boolean>(false);

  // Delay & Date change modal state
  const [selectedStage, setSelectedStage] = useState<InstallationStageItem | null>(null);
  const [newCompleteDate, setNewCompleteDate] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [delayReason, setDelayReason] = useState<'HOLIDAY' | 'TECHNICAL_ISSUE'>('TECHNICAL_ISSUE');
  const [delayNotes, setDelayNotes] = useState<string>('');
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [completingStageKey, setCompletingStageKey] = useState<string | null>(null);

  const canEdit =
    currentUserRole === 'TECHNICAL_LEAD' ||
    currentUserRole === 'TECHNICAL_MANAGER' ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'CRM' ||
    currentUserRole === 'MANAGER';

  // Load project installation stages
  const fetchStages = async () => {
    try {
      setLoading(true);
      const res = await api.getInstallationStages(projectId);
      if (res.data) {
        setStages(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load installation stages:', err);
      toast.error('Could not load installation stages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchStages();
  }, [projectId]);

  // Open modal to set initial start & complete dates for this project
  const handleOpenInitModal = () => {
    const stage1 = stages[0];
    const sDate = stage1?.startDate ? stage1.startDate : formatDateISO(toWorkingDay(new Date()));
    const cDate = stage1?.completeDate ? stage1.completeDate : formatDateISO(calculateCompleteDate(parseDateString(sDate), 2));
    setInitStartDate(sDate);
    setInitCompleteDate(cDate);

    if (stages.length === 11 && stages[0]?.stageName) {
      setCustomPreviewStages(stages.map((s) => ({ ...s })));
    } else {
      const generated = generateInitialSchedule(sDate);
      setCustomPreviewStages(generated as any);
    }
    setShowInitModal(true);
  };

  const handleInitStartDateChange = (val: string) => {
    setInitStartDate(val);
    if (!val) return;
    const s = toWorkingDay(parseDateString(val));
    const c = calculateCompleteDate(s, 2);
    setInitCompleteDate(formatDateISO(c));
    const generated = generateInitialSchedule(val);
    setCustomPreviewStages(generated as any);
  };

  const handleInitCompleteDateChange = (val: string) => {
    setInitCompleteDate(val);
    if (!val || !initStartDate) return;
    const base = generateInitialSchedule(initStartDate);
    const cascaded = cascadeScheduleUpdates(
      base as any,
      'SHAFT_READINESS',
      initStartDate,
      val
    );
    setCustomPreviewStages(cascaded as any);
  };

  const handlePreviewStageDateChange = (index: number, field: 'startDate' | 'completeDate', val: string) => {
    setCustomPreviewStages((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleInitializeSchedule = async () => {
    if (!initStartDate) {
      toast.error('Please enter the initial start date');
      return;
    }
    const safeStart = toWorkingDay(parseDateString(initStartDate));
    const safeComplete = initCompleteDate ? toWorkingDay(parseDateString(initCompleteDate)) : undefined;

    try {
      setInitializingSchedule(true);
      const res = await api.initializeInstallationStages(projectId, {
        installationStartDate: formatDateISO(safeStart),
        stage1CompleteDate: safeComplete ? formatDateISO(safeComplete) : undefined,
        customStages: showCustomTable ? customPreviewStages : undefined,
      });

      if (res.data) {
        setStages(res.data);
        const handover = res.data.find((s: any) => s.stageKey === 'HANDOVER');
        if (handover && onHandoverDateChanged) {
          onHandoverDateChanged(handover.completeDate);
        }
      }

      toast.success('Initial Installation Programme schedule applied! Intermediate stages and Handover generated.');
      setShowInitModal(false);
    } catch (err: any) {
      console.error('Failed to initialize installation schedule:', err);
      toast.error(err.message || 'Failed to initialize installation schedule');
    } finally {
      setInitializingSchedule(false);
    }
  };

  // Open modal with specific reason clicked
  const handleOpenReasonModal = (
    stage: InstallationStageItem,
    presetReason: 'HOLIDAY' | 'TECHNICAL_ISSUE'
  ) => {
    setSelectedStage(stage);
    setDelayReason(presetReason);
    setNewStartDate(stage.startDate);

    // Default to +1 working day from current complete date
    const curComplete = parseDateString(stage.completeDate);
    const nextDay = new Date(curComplete);
    nextDay.setDate(nextDay.getDate() + 1);
    const workingNext = toWorkingDay(nextDay);

    setNewCompleteDate(formatDateISO(workingNext));
    setDelayNotes(
      presetReason === 'HOLIDAY'
        ? 'Official Holiday / Non-working day pause'
        : 'On-site technical alignment adjustment'
    );
    setSendWhatsApp(hasWhatsAppGroup);
    setIsModalOpen(true);
  };

  // Open modal for generic complete date change
  const handleOpenChangeDateModal = (stage: InstallationStageItem) => {
    setSelectedStage(stage);
    setDelayReason(stage.delayReason || 'TECHNICAL_ISSUE');
    setNewStartDate(stage.startDate);
    setNewCompleteDate(stage.completeDate);
    setDelayNotes(stage.delayNotes || '');
    setSendWhatsApp(hasWhatsAppGroup);
    setIsModalOpen(true);
  };

  // Handle stage update submission
  const handleConfirmStageUpdate = async () => {
    if (!selectedStage) return;

    // Validate that dates are not weekends
    const sDate = parseDateString(newStartDate);
    const cDate = parseDateString(newCompleteDate);

    const safeStart = toWorkingDay(sDate);
    const safeComplete = toWorkingDay(cDate);

    if (safeComplete < safeStart) {
      toast.error('Complete date cannot be earlier than start date');
      return;
    }

    try {
      setUpdating(true);
      const toastId = toast.loading('Cascading schedule & preparing WhatsApp update...');

      const res = await api.updateInstallationStage(projectId, {
        stageKey: selectedStage.stageKey,
        startDate: formatDateISO(safeStart),
        completeDate: formatDateISO(safeComplete),
        reason: delayReason,
        notes: delayNotes,
        sendWhatsApp,
      });

      if (res.data) {
        setStages(res.data);
        const handover = res.data.find((s: any) => s.stageKey === 'HANDOVER');
        if (handover && onHandoverDateChanged) {
          onHandoverDateChanged(handover.completeDate);
        }
      }

      toast.success(
        res.whatsappResult?.sent
          ? 'Installation stage updated! Subsequent stages cascaded & WhatsApp sent to group.'
          : 'Installation stage updated! Subsequent stages cascaded.',
        { id: toastId, duration: 5000 }
      );

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Update stage error:', err);
      toast.error(err.message || 'Failed to update stage');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Mark Stage Done button click
  const handleMarkStageDone = async (stage: InstallationStageItem) => {
    if (stage.status === 'COMPLETED') return;

    try {
      setCompletingStageKey(stage.stageKey);
      const toastId = toast.loading(`Marking "${stage.stageName}" as completed & sending WhatsApp update...`);

      const res = await api.updateInstallationStage(projectId, {
        stageKey: stage.stageKey,
        startDate: stage.startDate,
        completeDate: stage.completeDate,
        status: 'COMPLETED',
        sendWhatsApp: true,
      });

      if (res.data) {
        setStages(res.data);
        const handover = res.data.find((s: any) => s.stageKey === 'HANDOVER');
        if (handover && onHandoverDateChanged) {
          onHandoverDateChanged(handover.completeDate);
        }
      }

      toast.success(
        `Stage "${stage.stageName}" marked as completed! WhatsApp update posted to group.`,
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      console.error('Failed to complete stage:', err);
      toast.error(err.message || 'Failed to complete stage');
    } finally {
      setCompletingStageKey(null);
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden text-slate-900 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#173860] via-[#1E4B82] to-[#2B6CB0] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <CalendarCheck2 className="w-6 h-6 text-sky-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-sky-400/20 text-sky-200 border border-sky-300/30">
                11-Stage Programme
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-300/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Working Days (Sat & Sun Excluded)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight font-poppins">
              Stage Installation Programme
            </h2>
            <p className="text-xs text-sky-100/80">
              Installation Start Date ➔ Handover sequential execution • Auto-cascades subsequent stages
            </p>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {(currentUserRole === 'TECHNICAL_LEAD' || currentUserRole === 'TECHNICAL_MANAGER') && (
            <span className="px-3 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {currentUserRole === 'TECHNICAL_MANAGER' ? 'Technical Manager Active' : 'Technical Lead Active'}
            </span>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenInitModal}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Manually set or reset initial Start Date and Complete Date for this project"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-950" />
              <span>Set Initial Dates</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchStages}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/15"
            title="Refresh stages"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Auto-neglect Weekend Notice Banner */}
      <div className="bg-sky-50/70 border-b border-sky-100 px-5 py-2.5 text-xs text-sky-900 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            <strong>Working Day Engine:</strong> Saturdays and Sundays are <em>automatically neglected</em>. When any stage date changes, all following stages push forward sequentially.
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          Handover: <strong className="text-slate-800">{stages.find((s) => s.stageKey === 'HANDOVER')?.completeDate ? formatDateDisplay(stages.find((s) => s.stageKey === 'HANDOVER')!.completeDate) : 'Auto-Calculated'}</strong>
        </div>
      </div>

      {/* The 11-Stage Spreadsheet Table (Exactly matching user format) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#B9D5F2] text-[#0A2540] border-b border-slate-300 font-extrabold uppercase text-[11px]">
              <th className="py-3 px-4 text-center w-16 border-r border-slate-300/80">SL NO</th>
              <th className="py-3 px-5 border-r border-slate-300/80 min-w-[280px]">
                Stage Iinstallation Programme
              </th>
              <th className="py-3 px-4 text-center w-36 border-r border-slate-300/80">Start</th>
              <th className="py-3 px-4 text-center w-36 border-r border-slate-300/80">Complete</th>
              <th className="py-3 px-4 text-center w-36 border-r border-slate-300/80">Status</th>
              {canEdit && <th className="py-3 px-4 text-center min-w-[220px]">Reason & Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {stages.map((stage) => {
              const isHandover = stage.stageKey === 'HANDOVER' || stage.slNo === 11;
              const hasDelay = stage.delayReason != null;

              return (
                <tr
                  key={stage.stageKey}
                  className={`transition-colors ${
                    isHandover
                      ? 'bg-[#FFFF00] font-bold text-slate-950 hover:bg-[#FFF500]'
                      : stage.slNo % 2 === 0
                      ? 'bg-slate-50/60 hover:bg-sky-50/50'
                      : 'bg-white hover:bg-sky-50/50'
                  }`}
                >
                  {/* SL NO */}
                  <td
                    className={`py-3.5 px-4 text-center font-bold border-r border-slate-200 text-sm ${
                      isHandover ? 'text-black font-extrabold' : 'text-slate-700'
                    }`}
                  >
                    {stage.slNo}
                  </td>

                  {/* Stage Installation Programme */}
                  <td
                    className={`py-3.5 px-5 border-r border-slate-200 text-xs sm:text-[13px] ${
                      isHandover ? 'font-black tracking-wide text-black' : 'font-bold text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{stage.stageName}</span>
                      {hasDelay && (
                        <span
                          className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            stage.delayReason === 'HOLIDAY'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {stage.delayReason === 'HOLIDAY' ? '🌴 Holiday' : '⚙️ Technical Issue'}
                        </span>
                      )}
                    </div>
                    {stage.delayNotes && (
                      <div className="text-[11px] text-slate-500 font-normal italic mt-0.5">
                        Note: {stage.delayNotes}
                      </div>
                    )}
                  </td>

                  {/* Start Date */}
                  <td 
                    onClick={() => canEdit && handleOpenChangeDateModal(stage)}
                    className={`py-3.5 px-4 text-center font-mono font-bold text-slate-800 border-r border-slate-200 transition-colors ${
                      canEdit ? 'cursor-pointer hover:bg-sky-100/70 hover:text-sky-950 group/cell' : ''
                    }`}
                    title={canEdit ? 'Click to change Start Date' : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatDateDisplay(stage.startDate)}</span>
                      {canEdit && (
                        <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </td>

                  {/* Complete Date */}
                  <td
                    onClick={() => canEdit && handleOpenChangeDateModal(stage)}
                    className={`py-3.5 px-4 text-center font-mono font-bold border-r border-slate-200 transition-colors ${
                      hasDelay ? 'text-rose-700 underline decoration-rose-400' : 'text-slate-800'
                    } ${canEdit ? 'cursor-pointer hover:bg-sky-100/70 hover:text-sky-950 group/cell' : ''}`}
                    title={canEdit ? 'Click to change Complete Date (or record Holiday / Technical Issue)' : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatDateDisplay(stage.completeDate)}</span>
                      {canEdit && (
                        <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 text-center border-r border-slate-200">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        stage.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : stage.status === 'IN_PROGRESS'
                          ? 'bg-sky-100 text-sky-800 border-sky-300'
                          : stage.status === 'DELAYED'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {stage.status || 'PENDING'}
                    </span>
                  </td>

                  {/* Actions / Reason Buttons */}
                  {canEdit && (
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {/* ✅ Done Button */}
                        <button
                          type="button"
                          disabled={stage.status === 'COMPLETED' || completingStageKey === stage.stageKey}
                          onClick={() => handleMarkStageDone(stage)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1 ${
                            stage.status === 'COMPLETED'
                              ? 'bg-emerald-600 text-white cursor-default opacity-90'
                              : completingStageKey === stage.stageKey
                              ? 'bg-emerald-400 text-white cursor-wait animate-pulse'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-xs active:bg-emerald-700'
                          }`}
                          title={
                            stage.status === 'COMPLETED'
                              ? 'Stage is already completed'
                              : `Mark "${stage.stageName}" as completed and send announcement to WhatsApp group`
                          }
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{stage.status === 'COMPLETED' ? 'Completed' : 'Done'}</span>
                        </button>

                        {/* 🌴 Holiday Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenReasonModal(stage, 'HOLIDAY')}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1"
                          title="Record Holiday and cascade schedule"
                        >
                          <span>🌴</span>
                          <span>Holiday</span>
                        </button>

                        {/* ⚙️ Technical Issue Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenReasonModal(stage, 'TECHNICAL_ISSUE')}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1"
                          title="Record Technical Issue and cascade schedule"
                        >
                          <span>⚙️</span>
                          <span>Technical Issue</span>
                        </button>

                        {/* Change Date button */}
                        <button
                          type="button"
                          onClick={() => handleOpenChangeDateModal(stage)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold transition-all"
                          title="Change Dates manually"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info & WhatsApp status */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>
            WhatsApp updates auto-mention <strong>@Admin</strong> and <strong>@CRM Team</strong> on customer group upon delay/reschedule.
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Showing 11 of 11 Installation Programme Stages
        </div>
      </div>

      {/* ============================================================== */}
      {/* DELAY REASON & DATE MODAL */}
      {/* ============================================================== */}
      {isModalOpen && selectedStage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#0F2744] to-[#1E4B82] text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                  Stage {selectedStage.slNo} of 11
                </div>
                <h3 className="text-base font-bold font-poppins">{selectedStage.stageName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Reason Selector Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Reason for Date Revision:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDelayReason('HOLIDAY');
                      setDelayNotes('Official Holiday / Non-working day');
                    }}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      delayReason === 'HOLIDAY'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <span className="text-lg">🌴</span>
                    <span>Holiday</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDelayReason('TECHNICAL_ISSUE');
                      setDelayNotes('On-site technical alignment adjustment');
                    }}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      delayReason === 'TECHNICAL_ISSUE'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 shadow-sm scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <span className="text-lg">⚙️</span>
                    <span>Technical Issue</span>
                  </button>
                </div>
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Start Date:
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewStartDate(val);
                      if (val && newCompleteDate < val) {
                        setNewCompleteDate(val);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {isWeekend(parseDateString(newStartDate)) && (
                    <span className="text-[10px] text-amber-700 font-bold block mt-1">
                      ⚠️ Weekend date will auto-snap to Monday
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Revised Complete Date:
                  </label>
                  <input
                    type="date"
                    value={newCompleteDate}
                    onChange={(e) => setNewCompleteDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {isWeekend(parseDateString(newCompleteDate)) && (
                    <span className="text-[10px] text-amber-700 font-bold block mt-1">
                      ⚠️ Weekend date will auto-snap to Monday
                    </span>
                  )}
                </div>
              </div>

              {/* Notes / Reason explanation */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Reason Description / Technical Notes:
                </label>
                <textarea
                  rows={2}
                  value={delayNotes}
                  onChange={(e) => setDelayNotes(e.target.value)}
                  placeholder="e.g. Civil shaft opening pending / Diwali holiday break"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Cascading Explanation Callout */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-[11px] text-sky-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Automatic Cascading Schedule:</strong> All subsequent stages (through Stage 11 Handover) will automatically shift to maintain working day order, skipping Saturdays and Sundays!
                </div>
              </div>

              {/* WhatsApp Notification Checkbox */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">
                      Send WhatsApp Notification to Customer Group
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Notifies customer group with revised date and tags @Admin & @CRM Team via Bot.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStageUpdate}
                disabled={updating}
                className="px-5 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <CalendarCheck2 className="w-4 h-4" />
                <span>{updating ? 'Cascading Dates...' : 'Confirm & Cascade Dates'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Initial Dates Setup Modal */}
      {showInitModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#173860] via-[#1E4B82] to-[#2B6CB0] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-inner">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Project Schedule Setup
                  </div>
                  <h3 className="text-base font-bold font-poppins">
                    Set Initial Installation Programme Dates
                  </h3>
                  <p className="text-xs text-sky-200">
                    {projectCode} — {projectName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInitModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Working Days Notice */}
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-950 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Working Day Automatic Engine:</strong> Saturdays and Sundays are <em>strictly neglected</em>. Setting the Initial Start Date automatically computes each of the 11 sequential stages leading up to Final Handover.
                </div>
              </div>

              {/* Start Date and Complete Date Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Installation Start Date (Stage 1):</span>
                  </label>
                  <input
                    type="date"
                    value={initStartDate}
                    onChange={(e) => handleInitStartDateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {initStartDate && isWeekend(parseDateString(initStartDate)) && (
                    <span className="text-[10px] text-amber-700 font-bold block mt-1">
                      ⚠️ Weekend date will auto-snap to Monday
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Stage 1: Shaft readiness start
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Stage 1 Complete Date:</span>
                  </label>
                  <input
                    type="date"
                    value={initCompleteDate}
                    onChange={(e) => handleInitCompleteDateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {initCompleteDate && isWeekend(parseDateString(initCompleteDate)) && (
                    <span className="text-[10px] text-amber-700 font-bold block mt-1">
                      ⚠️ Weekend date will auto-snap to Monday
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Default 2 working days
                  </span>
                </div>
              </div>

              {/* Handover Milestone Preview Badge */}
              <div className="bg-[#FFFF00]/40 border-2 border-[#FFFF00] p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                    Target Handover Date (Stage 11)
                  </div>
                  <div className="text-sm font-extrabold text-slate-950 font-mono">
                    {customPreviewStages.find((s) => s.stageKey === 'HANDOVER')?.completeDate
                      ? formatDateDisplay(customPreviewStages.find((s) => s.stageKey === 'HANDOVER')!.completeDate)
                      : 'Calculating...'}
                  </div>
                </div>
                <div className="px-3 py-1 bg-black text-[#FFFF00] font-black text-xs rounded-xl shadow-xs">
                  ⚡ Auto-Cascaded
                </div>
              </div>

              {/* Toggle to fine-tune individual stages manually */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomTable((prev) => !prev)}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 transition-colors"
                >
                  <span>{showCustomTable ? '▼ Hide' : '▶ Customize'} All 11 Stages Manually (Optional)</span>
                </button>

                {showCustomTable && (
                  <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                          <th className="py-2 px-3 w-12 text-center">#</th>
                          <th className="py-2 px-3">Stage Name</th>
                          <th className="py-2 px-3 w-32 text-center">Start</th>
                          <th className="py-2 px-3 w-32 text-center">Complete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {customPreviewStages.map((st, idx) => (
                          <tr key={st.stageKey} className={st.stageKey === 'HANDOVER' ? 'bg-[#FFFF00]/30 font-bold' : 'hover:bg-slate-50'}>
                            <td className="py-2 px-3 text-center text-slate-500 font-bold">{st.slNo}</td>
                            <td className="py-2 px-3 text-slate-900 font-medium">{st.stageName}</td>
                            <td className="py-1 px-2 text-center">
                              <input
                                type="date"
                                value={st.startDate}
                                onChange={(e) => handlePreviewStageDateChange(idx, 'startDate', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono"
                              />
                            </td>
                            <td className="py-1 px-2 text-center">
                              <input
                                type="date"
                                value={st.completeDate}
                                onChange={(e) => handlePreviewStageDateChange(idx, 'completeDate', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowInitModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitializeSchedule}
                disabled={initializingSchedule}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <CalendarCheck2 className="w-4 h-4 text-slate-950" />
                <span>{initializingSchedule ? 'Applying Schedule...' : 'Apply Initial Dates to Project'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
