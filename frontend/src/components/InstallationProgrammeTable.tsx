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
  Camera,
  Upload,
  Eye,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, getApiBaseUrl } from '../lib/api';
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
  imageUrl?: string;
  images?: string[];
  approvalStatus?: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  submittedBy?: string;
  submittedByRole?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  whatsappSent?: boolean;
  whatsappSentAt?: string;
}

export function resolveStageImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = getApiBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function compressFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return reject(new Error('Failed to read image file'));
      const img = new window.Image();
      img.onload = () => {
        const MAX_DIM = 1400;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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

  // Stage Photo Upload & Completion Modal State
  const [photoModalStage, setPhotoModalStage] = useState<InstallationStageItem | null>(null);
  const [stagedPhotoDataUrls, setStagedPhotoDataUrls] = useState<string[]>([]);
  const [isProcessingPhotoFiles, setIsProcessingPhotoFiles] = useState<boolean>(false);
  const [isSubmittingPhotoStage, setIsSubmittingPhotoStage] = useState<boolean>(false);

  // Photo Lightbox Preview Modal State
  const [previewStage, setPreviewStage] = useState<InstallationStageItem | null>(null);
  const [previewImageIdx, setPreviewImageIdx] = useState<number>(0);

  // Technical Manager (Kishore) Approval / Rejection State
  const [approvingStageKey, setApprovingStageKey] = useState<string | null>(null);
  const [rejectModalStage, setRejectModalStage] = useState<InstallationStageItem | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [isRejectingStage, setIsRejectingStage] = useState<boolean>(false);

  const canEdit =
    currentUserRole === 'TECHNICAL_LEAD' ||
    currentUserRole === 'TECHNICAL_MANAGER' ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'CRM' ||
    currentUserRole === 'MANAGER' ||
    currentUserRole === 'LOGISTICS_TL';

  const isKishoreOrAdmin =
    currentUserRole === 'TECHNICAL_MANAGER' || currentUserRole === 'ADMIN';

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

  // Helper: Get array of image URLs for a stage
  const getStageImages = (stage: InstallationStageItem): string[] => {
    if (Array.isArray(stage.images) && stage.images.length > 0) {
      return stage.images;
    }
    if (stage.imageUrl) {
      return [stage.imageUrl];
    }
    return [];
  };

  // Open Stage Photo Upload & Completion Modal
  const handleOpenPhotoModal = (stage: InstallationStageItem) => {
    setPhotoModalStage(stage);
    setStagedPhotoDataUrls(getStageImages(stage));
  };

  // Handle selecting image files in the upload modal
  const handleSelectPhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsProcessingPhotoFiles(true);
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await compressFileToDataUrl(file);
        compressedList.push(dataUrl);
      }
      if (compressedList.length > 0) {
        setStagedPhotoDataUrls((prev) => [...prev, ...compressedList]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not process selected photo');
    } finally {
      setIsProcessingPhotoFiles(false);
      e.target.value = '';
    }
  };

  const handleRemoveStagedPhoto = (indexToRemove: number) => {
    setStagedPhotoDataUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Save uploaded photos (and optionally mark stage Done -> Pending Kishore Approval)
  const handleSubmitPhotoAndStage = async (markAsDone: boolean) => {
    if (!photoModalStage) return;

    if (stagedPhotoDataUrls.length === 0) {
      toast.error(`Please select/upload at least one photo for Stage ${photoModalStage.slNo} ("${photoModalStage.stageName}")`);
      return;
    }

    try {
      setIsSubmittingPhotoStage(true);
      const toastId = toast.loading(
        markAsDone
          ? `Uploading stage photo & routing "${photoModalStage.stageName}" to Kishore for approval...`
          : `Uploading photo for "${photoModalStage.stageName}"...`
      );

      const res = await api.updateInstallationStage(projectId, {
        stageKey: photoModalStage.stageKey,
        startDate: photoModalStage.startDate,
        completeDate: photoModalStage.completeDate,
        status: markAsDone ? 'COMPLETED' : undefined,
        reason: markAsDone ? 'COMPLETED' : 'PHOTO_UPLOAD',
        imagesBase64: stagedPhotoDataUrls,
        replaceImages: true,
        sendWhatsApp: false, // Never send to WhatsApp group on TL Done — only after Kishore approves!
      });

      if (res.data) {
        setStages(res.data);
        const handover = res.data.find((s: any) => s.stageKey === 'HANDOVER');
        if (handover && onHandoverDateChanged) {
          onHandoverDateChanged(handover.completeDate);
        }
      }

      toast.success(
        markAsDone
          ? `Photo uploaded & Stage ${photoModalStage.slNo} marked Done! Routed to Technical Manager (Kishore) for approval (WhatsApp group message will be sent after approval).`
          : `Photo saved for Stage ${photoModalStage.slNo} ("${photoModalStage.stageName}").`,
        { id: toastId, duration: 5500 }
      );
      setPhotoModalStage(null);
      setStagedPhotoDataUrls([]);
    } catch (err: any) {
      console.error('Failed to submit stage photo:', err);
      toast.error(err.message || 'Failed to upload stage photo');
    } finally {
      setIsSubmittingPhotoStage(false);
    }
  };

  // Handle Mark Stage Done button click on row
  const handleMarkStageDone = async (stage: InstallationStageItem) => {
    if (stage.approvalStatus === 'APPROVED') return;

    const existingPhotos = getStageImages(stage);
    // If no photo uploaded yet, open the Photo Upload & Mark Done Modal
    if (existingPhotos.length === 0) {
      handleOpenPhotoModal(stage);
      return;
    }

    // If photo is already uploaded on this stage, submit Done -> Pending Kishore Approval (NO WhatsApp group send)
    try {
      setCompletingStageKey(stage.stageKey);
      const toastId = toast.loading(`Marking "${stage.stageName}" as Done & routing to Kishore for approval...`);

      const res = await api.updateInstallationStage(projectId, {
        stageKey: stage.stageKey,
        startDate: stage.startDate,
        completeDate: stage.completeDate,
        status: 'COMPLETED',
        reason: 'COMPLETED',
        sendWhatsApp: false,
      });

      if (res.data) {
        setStages(res.data);
        const handover = res.data.find((s: any) => s.stageKey === 'HANDOVER');
        if (handover && onHandoverDateChanged) {
          onHandoverDateChanged(handover.completeDate);
        }
      }

      toast.success(
        `Stage "${stage.stageName}" marked Done! Routed to Technical Manager (Kishore) for approval before sending with photo to WhatsApp group.`,
        { id: toastId, duration: 5500 }
      );
    } catch (err: any) {
      console.error('Failed to complete stage:', err);
      toast.error(err.message || 'Failed to complete stage');
    } finally {
      setCompletingStageKey(null);
    }
  };

  // Technical Manager (Kishore) approves stage & dispatches message WITH image to WhatsApp group
  const handleKishoreApproveStage = async (stage: InstallationStageItem) => {
    try {
      setApprovingStageKey(stage.stageKey);
      const toastId = toast.loading(
        `Approving Stage ${stage.slNo} ("${stage.stageName}") & sending completion message with photo to WhatsApp group...`
      );

      const res = await api.approveInstallationStage(projectId, {
        stageKey: stage.stageKey,
      });

      if (res.data) {
        setStages(res.data);
        if (previewStage?.stageKey === stage.stageKey) {
          const updatedPreview = res.data.find((s: any) => s.stageKey === stage.stageKey);
          if (updatedPreview) setPreviewStage(updatedPreview);
        }
      }

      toast.success(
        res.message || `Stage ${stage.slNo} approved! Completion message with photo sent to customer WhatsApp group.`,
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error('Approve stage error:', err);
      toast.error(err.message || 'Failed to approve stage');
    } finally {
      setApprovingStageKey(null);
    }
  };

  // Technical Manager (Kishore) rejects stage photo / requests revision
  const handleConfirmRejectStage = async () => {
    if (!rejectModalStage) return;
    try {
      setIsRejectingStage(true);
      const toastId = toast.loading(`Requesting photo revision for Stage ${rejectModalStage.slNo}...`);

      const res = await api.rejectInstallationStage(projectId, {
        stageKey: rejectModalStage.stageKey,
        reason: rejectReasonInput.trim() || 'Please upload a clearer stage completion photo.',
      });

      if (res.data) {
        setStages(res.data);
      }

      toast.success(
        res.message || `Stage ${rejectModalStage.slNo} returned to Team Lead for photo revision.`,
        { id: toastId, duration: 5000 }
      );
      setRejectModalStage(null);
      setRejectReasonInput('');
      if (previewStage?.stageKey === rejectModalStage.stageKey) {
        setPreviewStage(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject stage');
    } finally {
      setIsRejectingStage(false);
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
              Installation in Progress ➔ Handover - Payment Pending sequential execution • Auto-cascades subsequent stages
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
              <th className="py-3 px-5 border-r border-slate-300/80 min-w-[260px]">
                Stage Iinstallation Programme
              </th>
              <th className="py-3 px-4 text-center w-32 border-r border-slate-300/80">Start</th>
              <th className="py-3 px-4 text-center w-32 border-r border-slate-300/80">Complete</th>
              <th className="py-3 px-4 text-center w-44 border-r border-slate-300/80">Stage Photo</th>
              <th className="py-3 px-4 text-center w-44 border-r border-slate-300/80">Status & Approval</th>
              {canEdit && <th className="py-3 px-4 text-center min-w-[260px]">Reason & Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {stages.map((stage) => {
              const isHandover = stage.stageKey === 'HANDOVER' || stage.slNo === 11;
              const hasDelay = stage.delayReason != null;
              const stageImages = getStageImages(stage);
              const isPendingKishore = stage.approvalStatus === 'PENDING_APPROVAL';
              const isApprovedByKishore = stage.approvalStatus === 'APPROVED';
              const isRejectedByKishore = stage.approvalStatus === 'REJECTED';

              return (
                <tr
                  key={stage.stageKey}
                  className={`transition-colors ${
                    isHandover
                      ? 'bg-[#FFFF00] font-bold text-slate-950 hover:bg-[#FFF500]'
                      : isPendingKishore
                      ? 'bg-amber-50/70 hover:bg-amber-100/50'
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
                    {isRejectedByKishore && stage.rejectionReason && (
                      <div className="text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 mt-1">
                        ⚠️ Kishore Feedback: {stage.rejectionReason}
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

                  {/* Stage Photo Column */}
                  <td className="py-2.5 px-3 text-center border-r border-slate-200">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {stageImages.length > 0 ? (
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewStage(stage);
                              setPreviewImageIdx(0);
                            }}
                            className="relative group/img rounded-xl overflow-hidden border-2 border-sky-400 shadow-xs w-12 h-12 bg-slate-100 shrink-0 cursor-pointer"
                            title="Click to view full-size stage photo(s)"
                          >
                            <img
                              src={resolveStageImageUrl(stageImages[0])}
                              alt={`Stage ${stage.slNo}`}
                              className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                            {stageImages.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 bg-slate-900/85 text-white text-[9px] font-extrabold px-1 rounded">
                                +{stageImages.length - 1}
                              </span>
                            )}
                          </button>

                          {canEdit && !isApprovedByKishore && (
                            <button
                              type="button"
                              onClick={() => handleOpenPhotoModal(stage)}
                              className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Upload or change stage photo"
                            >
                              <Camera className="w-3 h-3 text-sky-600" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      ) : canEdit ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPhotoModal(stage)}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-dashed border-sky-400 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                          title={`Upload photo for Stage ${stage.slNo}: ${stage.stageName}`}
                        >
                          <Camera className="w-3.5 h-3.5 text-sky-600" />
                          <span>Upload Img</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No photo</span>
                      )}
                    </div>
                  </td>

                  {/* Status & Approval */}
                  <td className="py-3.5 px-3 text-center border-r border-slate-200">
                    <div className="flex flex-col items-center justify-center gap-1">
                      {isPendingKishore ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Awaiting Kishore Approval</span>
                          </span>
                          {stage.submittedBy && (
                            <span className="text-[9px] text-slate-500 font-semibold">
                              By: {stage.submittedBy}
                            </span>
                          )}
                        </>
                      ) : isApprovedByKishore ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-400 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Approved & Sent ✅</span>
                          </span>
                          <span className="text-[9px] text-emerald-700 font-semibold">
                            WhatsApp Group Sent
                          </span>
                        </>
                      ) : isRejectedByKishore ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                          <XCircle className="w-3 h-3 text-rose-700" />
                          <span>Rejected (Re-upload)</span>
                        </span>
                      ) : (
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
                      )}
                    </div>
                  </td>

                  {/* Actions / Reason Buttons */}
                  {canEdit && (
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {/* KISHORE (TECHNICAL_MANAGER) / ADMIN APPROVE & REJECT BUTTONS */}
                        {isKishoreOrAdmin && isPendingKishore && (
                          <>
                            <button
                              type="button"
                              disabled={approvingStageKey === stage.stageKey}
                              onClick={() => handleKishoreApproveStage(stage)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                              title="Approve stage photo & send completion message with photo to customer WhatsApp group"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {approvingStageKey === stage.stageKey
                                  ? 'Approving & Sending...'
                                  : 'Approve & Send Group'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalStage(stage);
                                setRejectReasonInput('');
                              }}
                              className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                              title="Reject photo and ask TL to re-upload"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {/* ✅ Upload Photo & Done Button (For TLs & Editors) */}
                        {!isPendingKishore && (
                          <button
                            type="button"
                            disabled={isApprovedByKishore || completingStageKey === stage.stageKey}
                            onClick={() => handleMarkStageDone(stage)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer ${
                              isApprovedByKishore
                                ? 'bg-emerald-600 text-white cursor-default opacity-90'
                                : completingStageKey === stage.stageKey
                                ? 'bg-emerald-400 text-white cursor-wait animate-pulse'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-xs active:bg-emerald-700'
                            }`}
                            title={
                              isApprovedByKishore
                                ? 'Stage is approved and sent to WhatsApp group'
                                : stageImages.length === 0
                                ? `Upload photo for "${stage.stageName}" & mark Done (Routes to Kishore for approval)`
                                : `Mark "${stage.stageName}" as Done (Routes to Kishore for approval before WhatsApp group send)`
                            }
                          >
                            {isApprovedByKishore ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approved</span>
                              </>
                            ) : stageImages.length === 0 ? (
                              <>
                                <Camera className="w-3.5 h-3.5" />
                                <span>Upload & Done</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Done</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* 🌴 Holiday Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenReasonModal(stage, 'HOLIDAY')}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Record Holiday and cascade schedule"
                        >
                          <span>🌴</span>
                          <span>Holiday</span>
                        </button>

                        {/* ⚙️ Technical Issue Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenReasonModal(stage, 'TECHNICAL_ISSUE')}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Record Technical Issue and cascade schedule"
                        >
                          <span>⚙️</span>
                          <span>Technical Issue</span>
                        </button>

                        {/* Change Date button */}
                        <button
                          type="button"
                          onClick={() => handleOpenChangeDateModal(stage)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
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
                    <span>Installation in Progress (Start Date):</span>
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

      {/* ============================================================== */}
      {/* STAGE PHOTO UPLOAD & MARK DONE MODAL (FOR TLs & EDITORS) */}
      {/* ============================================================== */}
      {photoModalStage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#0F2744] to-[#1E4B82] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                    Stage {photoModalStage.slNo} of 11 • Photo Upload
                  </div>
                  <h3 className="text-base font-bold font-poppins">{photoModalStage.stageName}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhotoModalStage(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Approval Workflow Notice */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Technical Manager Approval Workflow:</strong> Uploading a stage photo and clicking{' '}
                  <strong>Upload & Mark Done</strong> will <em>not</em> send the message to the WhatsApp group immediately.
                  It will route to <strong>Kishore (Technical Manager)</strong> for approval, and upon his approval the
                  completion message <strong>with this photo</strong> will be sent to the customer WhatsApp group.
                </div>
              </div>

              {/* File Upload Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Select Stage Completion Photo(s):
                </label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50 rounded-2xl cursor-pointer transition-all p-4 text-center">
                  <Upload className="w-6 h-6 text-sky-600 mb-1.5" />
                  <span className="text-xs font-bold text-sky-900">
                    {isProcessingPhotoFiles ? 'Processing photo(s)...' : 'Click to Upload Stage Photo(s)'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP (Camera or Gallery)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSelectPhotoFiles}
                    disabled={isProcessingPhotoFiles || isSubmittingPhotoStage}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Staged Photo Thumbnails */}
              {stagedPhotoDataUrls.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Uploaded Photo(s) ({stagedPhotoDataUrls.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setStagedPhotoDataUrls([])}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {stagedPhotoDataUrls.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-300 aspect-square bg-slate-100 shadow-xs"
                      >
                        <img
                          src={resolveStageImageUrl(imgUrl)}
                          alt={`Stage upload ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedPhoto(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPhotoModalStage(null)}
                disabled={isSubmittingPhotoStage}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmitPhotoAndStage(false)}
                disabled={isSubmittingPhotoStage || stagedPhotoDataUrls.length === 0}
                className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Save Photo Only
              </button>
              <button
                type="button"
                onClick={() => handleSubmitPhotoAndStage(true)}
                disabled={isSubmittingPhotoStage || stagedPhotoDataUrls.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmittingPhotoStage ? 'Uploading & Submitting...' : 'Upload Photo & Mark Done'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PHOTO LIGHTBOX PREVIEW & KISHORE APPROVAL MODAL */}
      {/* ============================================================== */}
      {previewStage && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewStage(null);
          }}
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F2744] to-[#1E4B82] text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                  Stage {previewStage.slNo} of 11 • {projectCode} ({projectName})
                </div>
                <h3 className="text-base font-bold font-poppins">{previewStage.stageName}</h3>
                {previewStage.submittedBy && (
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Uploaded by: <strong>{previewStage.submittedBy}</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewStage(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 bg-slate-900 flex-1 flex flex-col items-center justify-center overflow-y-auto min-h-[300px]">
              {(() => {
                const imgs = getStageImages(previewStage);
                const activeUrl = imgs[previewImageIdx] || imgs[0];
                if (!activeUrl) {
                  return <div className="text-slate-400 text-xs">No photo available</div>;
                }
                return (
                  <>
                    <img
                      src={resolveStageImageUrl(activeUrl)}
                      alt={`Stage ${previewStage.slNo}`}
                      className="max-h-[58vh] w-auto object-contain rounded-xl shadow-lg border border-slate-700"
                    />
                    {imgs.length > 1 && (
                      <div className="flex items-center gap-2 mt-4">
                        {imgs.map((u, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPreviewImageIdx(idx)}
                            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                              idx === previewImageIdx ? 'border-amber-400 scale-105' : 'border-slate-600 opacity-60'
                            }`}
                          >
                            <img src={resolveStageImageUrl(u)} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                {previewStage.approvalStatus === 'PENDING_APPROVAL' ? (
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
                    ⏳ Awaiting Technical Manager (Kishore) Approval
                  </span>
                ) : previewStage.approvalStatus === 'APPROVED' ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px]">
                    ✅ Approved by {previewStage.approvedBy || 'Kishore'} & Sent to WhatsApp Group
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {isKishoreOrAdmin && previewStage.approvalStatus === 'PENDING_APPROVAL' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectModalStage(previewStage);
                        setRejectReasonInput('');
                      }}
                      className="px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      ✕ Reject Photo
                    </button>
                    <button
                      type="button"
                      disabled={approvingStageKey === previewStage.stageKey}
                      onClick={() => handleKishoreApproveStage(previewStage)}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {approvingStageKey === previewStage.stageKey
                          ? 'Approving & Sending...'
                          : 'Approve & Send with Image to WhatsApp Group'}
                      </span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewStage(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* KISHORE REJECT STAGE PHOTO MODAL */}
      {/* ============================================================== */}
      {rejectModalStage && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-rose-700 to-rose-900 text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-rose-200 uppercase tracking-wider">
                  Stage {rejectModalStage.slNo} of 11 • Request Photo Revision
                </div>
                <h3 className="text-base font-bold font-poppins">{rejectModalStage.stageName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalStage(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Reason / Feedback for Team Lead:
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="e.g. Photo is blurry, please upload a clear photo showing the completed alignment."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalStage(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejectingStage}
                onClick={handleConfirmRejectStage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                {isRejectingStage ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
