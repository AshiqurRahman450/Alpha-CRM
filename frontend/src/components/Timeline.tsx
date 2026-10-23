'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  PackageCheck,
  Truck,
  Wrench,
  CheckCheck,
  Sparkles,
  ClipboardCheck,
  AlertTriangle,
  X,
  Send,
  MessageSquare,
} from 'lucide-react';

import InstallationProgrammeTable from './InstallationProgrammeTable';

export const STAGES_ORDER = [
  { key: 'PAYMENT_RECEIVED', label: 'Advance Payment Received', icon: CheckCircle2 },
  { key: 'SITE_MEASUREMENT', label: 'Site Visit', icon: ClipboardCheck },
  { key: 'DESIGN', label: 'Drawing and Cabin', icon: Sparkles },
  { key: 'CUSTOMER_APPROVAL', label: 'Drawing and Cabin Design Approval', icon: CheckCircle2 },
  { key: 'ENGINEERING', label: 'Production Payment', icon: Wrench },
  { key: 'MANUFACTURING', label: 'Approval Drawing to factory', icon: Wrench },
  { key: 'QUALITY_CHECK', label: 'Rediness Payment', icon: PackageCheck },
  { key: 'DELIVERY', label: 'Pre Site Visit', icon: ClipboardCheck },
  { key: 'DISPATCH', label: 'Expected Delivery', icon: Truck },
  { key: 'INSTALLATION', label: 'Installation Start Date', icon: Wrench },
  { key: 'TESTING', label: 'Handover', icon: CheckCircle2 },
  { key: 'COMPLETED', label: 'Project Completed', icon: CheckCheck },
];

export function formatProjectStatus(status: string): string {
  if (!status) return 'Unknown';
  const stage = STAGES_ORDER.find((s) => s.key === status);
  if (stage) return stage.label;
  return status.replace(/_/g, ' ');
}

interface TimelineProps {
  currentStatus: string;
  onStatusChange?: (newStatus: string, trackingNumber?: string, productionTimelineDays?: number) => Promise<void> | void;
  isEditable?: boolean;
  stageDates?: Record<string, { scheduleDate?: string | null; executedDate?: string | null }>;
  onDateChange?: (stageKey: string, type: 'scheduleDate' | 'executedDate', date: string) => Promise<void> | void;
  onBulkDateChange?: (updates: { stageKey: string, scheduleDate?: string | null, executedDate?: string | null }[]) => Promise<void> | void;
  currentUserRole?: string;
  customerCity?: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  customerName?: string;
  customerPhone?: string;
  whatsappGroupName?: string;
  vrlLrNumber?: string;
  trackingNumber?: string;
  productionTimelineDays?: number;
  onHandoverDateChanged?: (newHandoverDate: string) => void;
  initiallyOpenInstallation?: boolean;
}

export default function Timeline({
  currentStatus,
  onStatusChange,
  isEditable = true,
  stageDates,
  onDateChange,
  onBulkDateChange,
  currentUserRole,
  customerCity,
  projectId,
  projectName,
  projectCode,
  customerName,
  customerPhone,
  whatsappGroupName,
  vrlLrNumber,
  trackingNumber,
  productionTimelineDays = 60,
  onHandoverDateChanged,
  initiallyOpenInstallation,
}: TimelineProps) {
  const currentIndex = STAGES_ORDER.findIndex((s) => s.key === currentStatus);
  const [showInstallationTable, setShowInstallationTable] = React.useState<boolean>(
    Boolean(initiallyOpenInstallation || currentUserRole === 'TECHNICAL_LEAD')
  );
  const [showVrlAlertModal, setShowVrlAlertModal] = React.useState<boolean>(false);
  const [vrlTrackingInput, setVrlTrackingInput] = React.useState<string>('');
  const [vrlInputError, setVrlInputError] = React.useState<string>('');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = React.useState<boolean>(false);

  // Drawing and Cabin Approved Modal State
  const [showDrawingApprovalModal, setShowDrawingApprovalModal] = React.useState<boolean>(false);
  const [productionDaysInput, setProductionDaysInput] = React.useState<string>(String(productionTimelineDays || 60));
  const [isSubmittingDrawingApproval, setIsSubmittingDrawingApproval] = React.useState<boolean>(false);

  const lastTapRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (productionTimelineDays) {
      setProductionDaysInput(String(productionTimelineDays));
    }
  }, [productionTimelineDays]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showVrlAlertModal && !isSubmittingDispatch) {
          setShowVrlAlertModal(false);
        }
        if (showDrawingApprovalModal && !isSubmittingDrawingApproval) {
          setShowDrawingApprovalModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVrlAlertModal, isSubmittingDispatch, showDrawingApprovalModal, isSubmittingDrawingApproval]);

  const handleConfirmVrlDispatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = vrlTrackingInput.trim();
    if (!trimmed) {
      setVrlInputError('Please enter a valid VRL Tracking Number to proceed.');
      return;
    }

    try {
      setIsSubmittingDispatch(true);
      setVrlInputError('');
      if (onStatusChange) {
        await onStatusChange('DISPATCH', trimmed);
      }
      setShowVrlAlertModal(false);
    } catch (err: any) {
      setVrlInputError(err?.message || 'Failed to update Expected Delivery stage');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  const handleConfirmDrawingApproval = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedDays = parseInt(productionDaysInput, 10);
    const days = (!isNaN(parsedDays) && parsedDays > 0) ? parsedDays : 60;
    try {
      setIsSubmittingDrawingApproval(true);
      if (onStatusChange) {
        await onStatusChange('CUSTOMER_APPROVAL', undefined, days);
      }
      setShowDrawingApprovalModal(false);
    } catch (err: any) {
      console.error('Error updating Drawing and Cabin Design Approval:', err);
    } finally {
      setIsSubmittingDrawingApproval(false);
    }
  };

  const handleTouchEndStage = (stageKey: string, e: React.TouchEvent) => {
    if (stageKey === 'INSTALLATION') {
      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        // Double tap detected!
        e.preventDefault();
        e.stopPropagation();
        setShowInstallationTable((prev) => !prev);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
    }
  };

  const handleDateChangeLocal = async (key: string, type: 'scheduleDate' | 'executedDate', val: string) => {
    if (!onDateChange) return;
    
    await onDateChange(key, type, val);

    // If user sets scheduleDate manually at Site Visit (SITE_MEASUREMENT),
    // automatically calculate and fix all balance milestone schedule dates from Site Visit.
    if (key === 'SITE_MEASUREMENT' && type === 'scheduleDate' && val) {
      const siteVisitDate = new Date(val);
      
      const addDays = (d: Date, days: number) => {
        const r = new Date(d);
        r.setDate(r.getDate() + days);
        return r.toISOString().split('T')[0];
      };
      
      const addMonths = (d: Date, months: number) => {
        const r = new Date(d);
        r.setMonth(r.getMonth() + months);
        return r.toISOString().split('T')[0];
      };

      const d2_design = addDays(siteVisitDate, 4);
      const d3_approval = addDays(new Date(d2_design), 4);
      const d4_production = addDays(new Date(d3_approval), 3);
      const d5_factory = addDays(new Date(d4_production), 1);
      const d6_readiness = addMonths(new Date(d5_factory), 1);
      const d7_preSite = addDays(new Date(d6_readiness), 3); // DELIVERY
      const d8_expected = addDays(new Date(d7_preSite), 4); // DISPATCH
      const d9_install = addDays(new Date(d8_expected), 7);
      const d10_handover = addMonths(new Date(d9_install), 1);

      const updates = [
        { key: 'DESIGN', val: d2_design },
        { key: 'CUSTOMER_APPROVAL', val: d3_approval },
        { key: 'ENGINEERING', val: d4_production },
        { key: 'MANUFACTURING', val: d5_factory },
        { key: 'QUALITY_CHECK', val: d6_readiness },
        { key: 'DELIVERY', val: d7_preSite },
        { key: 'DISPATCH', val: d8_expected },
        { key: 'INSTALLATION', val: d9_install },
        { key: 'TESTING', val: d10_handover },
      ];

      const bulkUpdates = updates
        .map(u => ({ stageKey: u.key, scheduleDate: u.val }));

      if (bulkUpdates.length > 0) {
        if (onBulkDateChange) {
          await onBulkDateChange(bulkUpdates);
        } else {
          for (const update of bulkUpdates) {
            await onDateChange(update.stageKey, 'scheduleDate', update.scheduleDate);
          }
        }
      }
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Project Execution Timeline</h3>
          <p className="text-xs text-slate-500">
            Current Stage: <span className="font-semibold text-sky-600">{formatProjectStatus(currentStatus)}</span>
          </p>
        </div>
        {isEditable && onStatusChange && (
          <div className="text-[11px] text-slate-400 font-medium">
            Click on any milestone to advance project stage
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto pb-28 pt-2 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="flex items-center min-w-[900px] justify-between">
          {STAGES_ORDER.map((stage, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isUpcoming = idx > currentIndex;
            const dates = stageDates?.[stage.key];
            
            let canEditThisStage = isEditable;
            if (currentUserRole === 'BDM') {
              canEditThisStage = stage.key === 'CUSTOMER_APPROVAL';
            }

            return (
              <div
                key={stage.key}
                onClick={() => {
                  if (canEditThisStage && onStatusChange) {
                    if (stage.key === 'DISPATCH') {
                      // Expected Delivery stage: first get the VRL Tracking No through alert pop-up
                      setVrlTrackingInput(vrlLrNumber || trackingNumber || '');
                      setVrlInputError('');
                      setShowVrlAlertModal(true);
                      return;
                    }

                    if (stage.key === 'CUSTOMER_APPROVAL') {
                      // Drawing and Cabin Approved stage: open pop-up to input delivery days & preview WhatsApp messages
                      setProductionDaysInput(String(productionTimelineDays || 60));
                      setShowDrawingApprovalModal(true);
                      return;
                    }

                    if (stage.key !== currentStatus) {
                      if (confirm(`Update project status to "${stage.label}"?`)) {
                        onStatusChange(stage.key);
                      }
                    }
                  }
                }}
                onDoubleClick={(e) => {
                  if (stage.key === 'INSTALLATION') {
                    e.stopPropagation();
                    setShowInstallationTable((prev) => !prev);
                  }
                }}
                onTouchEnd={(e) => handleTouchEndStage(stage.key, e)}
                className={`flex flex-col items-center group relative z-10 transition-transform ${
                  canEditThisStage ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-80'
                }`}
                style={{ width: `${100 / STAGES_ORDER.length}%` }}
              >
                {/* Node Circle */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-sm ${
                    isCompleted
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                      : isCurrent
                      ? 'bg-sky-600 text-white ring-4 ring-sky-100 animate-pulse'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 group-hover:bg-slate-200'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <ArrowRight className="w-4 h-4" />
                  ) : (
                    <span className="text-[11px] font-semibold">{idx + 1}</span>
                  )}
                </div>

                {/* Stage Label */}
                <div className="mt-2 text-center relative z-20 bg-white px-1 rounded">
                  <div
                    className={`text-[11px] leading-tight font-semibold tracking-tight transition-colors ${
                      isCurrent
                        ? 'text-sky-600 font-bold'
                        : isCompleted
                        ? 'text-emerald-700 font-medium'
                        : 'text-slate-500'
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isCompleted ? '✓ Done' : isCurrent ? '● Active' : '○ Pending'}
                  </div>

                  {/* Special Badge for Installation Start Date (Intermediate 11 Stages Programme) */}
                  {stage.key === 'INSTALLATION' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInstallationTable((prev) => !prev);
                      }}
                      className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide border shadow-2xs transition-all active:scale-95 ${
                        showInstallationTable
                          ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-200'
                          : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      }`}
                      title="Double-tap or click to reveal 11-Stage Installation Programme (Installation Start Date ➔ Handover)"
                    >
                      <span>⚡ 11 Stages</span>
                      <span>{showInstallationTable ? '▲' : '▼'}</span>
                    </button>
                  )}
                </div>

                {/* Mindmap Hover Options */}
                <div className={`absolute top-[80px] left-1/2 -translate-x-1/2 w-48 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 flex flex-col items-center ${canEditThisStage ? 'pointer-events-none group-hover:pointer-events-auto' : 'pointer-events-none'}`}>
                  {/* Vertical stem */}
                  <div className="w-px h-6 bg-slate-300"></div>
                  {/* Horizontal branch */}
                  <div className="w-32 h-px bg-slate-300"></div>
                  {/* Left and Right drops */}
                  <div className="flex w-32 justify-between">
                    <div className="w-px h-3 bg-slate-300"></div>
                    <div className="w-px h-3 bg-slate-300"></div>
                  </div>
                  
                  {/* Data containers */}
                  <div className={`flex ${stage.key === 'PAYMENT_RECEIVED' ? 'w-24 justify-center' : 'w-40 justify-between'} -mt-0.5`}>
                    {stage.key !== 'PAYMENT_RECEIVED' && (
                    <div className="flex flex-col items-center w-1/2 px-1 relative">
                      <span className="text-[9px] font-bold text-slate-500 uppercase z-10 pointer-events-none">Schedule</span>
                      <div className="relative w-full flex justify-center mt-0.5">
                        <div className={`text-[10px] px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap w-full text-center ${
                          dates?.scheduleDate 
                            ? 'bg-sky-50 border-sky-400 text-sky-700 shadow-sky-100 animate-pulse' 
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                          {dates?.scheduleDate ? new Date(dates.scheduleDate).toLocaleDateString('en-GB') : 'Not Set'}
                        </div>
                        {isEditable && (currentUserRole !== 'BDM' || stage.key === 'CUSTOMER_APPROVAL') && onDateChange && (
                          <input 
                            type="date" 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                            onChange={(e) => handleDateChangeLocal(stage.key, 'scheduleDate', e.target.value)}
                            value={dates?.scheduleDate ? new Date(dates.scheduleDate).toISOString().split('T')[0] : ''}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </div>
                    )}
                    
                    <div className={`flex flex-col items-center ${stage.key === 'PAYMENT_RECEIVED' ? 'w-full' : 'w-1/2'} px-1 relative`}>
                      <span className="text-[9px] font-bold text-slate-500 uppercase z-10 pointer-events-none">Executed</span>
                      <div className="relative w-full flex justify-center mt-0.5">
                        <div className={`text-[10px] px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap w-full text-center ${
                          dates?.executedDate 
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-emerald-100' 
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                          {dates?.executedDate ? new Date(dates.executedDate).toLocaleDateString('en-GB') : 'Not Set'}
                        </div>
                        {isEditable && (currentUserRole !== 'BDM' || stage.key === 'CUSTOMER_APPROVAL') && onDateChange && (
                          <input 
                            type="date" 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                            onChange={(e) => handleDateChangeLocal(stage.key, 'executedDate', e.target.value)}
                            value={dates?.executedDate ? new Date(dates.executedDate).toISOString().split('T')[0] : ''}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Connecting Line */}
        <div className="absolute top-[26px] left-6 right-6 h-0.5 bg-slate-200 z-0">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${Math.max(0, (currentIndex / (STAGES_ORDER.length - 1)) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Intermediate Stages Table between Installation Start Date and Handover */}
      {showInstallationTable && projectId && (
        <div className="mt-8 pt-6 border-t border-slate-200/90">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Intermediate Stages: Installation Start Date ➔ Handover (11 Stages Programme)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowInstallationTable(false)}
              className="text-xs text-slate-400 hover:text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium transition-colors"
            >
              Hide 11 Stages ▲
            </button>
          </div>
          <InstallationProgrammeTable
            projectId={projectId}
            projectName={projectName}
            projectCode={projectCode}
            customerName={customerName}
            customerCity={customerCity}
            currentUserRole={currentUserRole}
            onHandoverDateChanged={onHandoverDateChanged}
          />
        </div>
      )}

      {/* VRL Tracking Number Alert Pop-up Modal for Expected Delivery stage */}
      {showVrlAlertModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingDispatch) {
              setShowVrlAlertModal(false);
            }
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="vrl-modal-title"
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with High-Visibility Alert Gradient */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white relative">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black tracking-wider uppercase">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Action Required: Expected Delivery</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmittingDispatch}
                  onClick={() => setShowVrlAlertModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 id="vrl-modal-title" className="text-base font-extrabold text-white leading-snug">
                    Enter VRL Tracking Number
                  </h3>
                  <p className="text-xs text-amber-100 font-medium">
                    Material Dispatch & Official WhatsApp Template Message
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmVrlDispatch} className="p-5 md:p-6 space-y-4">
              {/* Project & Group metadata strip */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Project</span>
                  <span className="font-bold text-slate-800">{projectCode || projectName || 'Alpha Project'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Target WhatsApp Group</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {whatsappGroupName || 'Dedicated Project Group'}
                  </span>
                </div>
              </div>

              {/* Informational context */}
              <p className="text-xs text-slate-600 leading-relaxed">
                When advancing to <strong className="text-slate-900">Expected Delivery</strong>, elevator materials are dispatched via <strong className="text-slate-900">VRL Logistics</strong>. Please enter the tracking number below to attach it to this project and dispatch the approved WhatsApp template to the group.
              </p>

              {/* Input Field */}
              <div className="space-y-1.5">
                <label htmlFor="vrl-tracking-input" className="block text-xs font-bold text-slate-800">
                  VRL Tracking / LR Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="vrl-tracking-input"
                    type="text"
                    autoFocus
                    value={vrlTrackingInput}
                    onChange={(e) => {
                      setVrlTrackingInput(e.target.value);
                      if (vrlInputError) setVrlInputError('');
                    }}
                    placeholder="e.g. VRL-BLR-987654 or 123456789"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 font-mono text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-400 shadow-2xs"
                    disabled={isSubmittingDispatch}
                  />
                  {vrlTrackingInput && !isSubmittingDispatch && (
                    <button
                      type="button"
                      onClick={() => setVrlTrackingInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {vrlInputError && (
                  <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1 bg-rose-50 border border-rose-200/80 px-3 py-1.5 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{vrlInputError}</span>
                  </p>
                )}
              </div>

              {/* WhatsApp Template Message Live Preview */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    WhatsApp Template Preview
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">MATERIAL_DISPATCHED_PM</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 text-xs text-slate-800 space-y-2 relative shadow-2xs font-sans">
                  <div className="text-emerald-950 leading-relaxed whitespace-pre-line">
                    Dear Sir/Madam,
                    {'\n'}Your elevator material has been dispatched through VRL Logistics.
                    {'\n'}VRL Tracking No.:{' '}
                    <span className="font-mono font-bold bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded border border-amber-300 inline-block">
                      {vrlTrackingInput.trim() || '[Tracking Number]'}
                    </span>
                    {'\n'}You can use the above tracking number to track the material movement. We will keep you updated on the delivery status.
                    {'\n'}Note: Kindly ensure proper space and access for safe unloading and material storage.
                  </div>
                  <div className="text-[10px] text-emerald-700/80 text-right font-medium">
                    ✓✓ Automated Group Delivery
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingDispatch}
                  onClick={() => setShowVrlAlertModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDispatch ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Dispatching Update...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm & Send to WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWING AND CABIN DESIGN APPROVAL POP-UP MODAL */}
      {showDrawingApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Drawing and Cabin Approved
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set production timeline & dispatch WhatsApp notifications
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingDrawingApproval}
                onClick={() => setShowDrawingApprovalModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDrawingApproval} className="space-y-4">
              {/* Days Input */}
              <div className="space-y-1.5">
                <label htmlFor="production-timeline-input" className="block text-xs font-bold text-slate-800">
                  Number of Days from Production Payment to Material Delivery <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="production-timeline-input"
                    type="number"
                    min="1"
                    max="365"
                    autoFocus
                    value={productionDaysInput}
                    onChange={(e) => setProductionDaysInput(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all placeholder:text-slate-400 shadow-2xs"
                    disabled={isSubmittingDrawingApproval}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    days
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  This timeline will be dynamically mentioned in both the initial production payment notice and the 2-day reminder.
                </p>
              </div>

              {/* Message 1 Live Preview */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                    Message 1 (Sent Immediately to WhatsApp Group)
                  </span>
                  <span className="text-[10px] text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    Step 1
                  </span>
                </div>
                <div className="bg-sky-50/70 border border-sky-200/90 rounded-2xl p-3.5 text-xs text-slate-800 space-y-1 relative shadow-2xs">
                  <div className="text-slate-900 leading-relaxed font-sans">
                    Dear Sir/Madam,<br />
                    This is a gentle reminder to kindly review and approves the elevator drawing and cabin design shared with you, so that we can proceed with the next stage without delay.
                  </div>
                  <div className="text-[10px] text-sky-700 text-right font-medium">
                    ✓✓ Immediate Group Dispatch
                  </div>
                </div>
              </div>

              {/* Message 2 Live Preview */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    Message 2 (Sent Immediately to WhatsApp Group)
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Step 2
                  </span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 text-xs text-slate-800 space-y-1 relative shadow-2xs">
                  <div className="text-slate-900 leading-relaxed font-sans">
                    Dear Sir/Madam,<br />
                    Kindly release the production payment to initiate the production process. Please note that the production timeline is approximately{' '}
                    <span className="font-bold bg-emerald-200/90 text-emerald-950 px-1.5 py-0.5 rounded border border-emerald-300">
                      {productionDaysInput.trim() || '60'} days
                    </span>{' '}
                    from the date of payment and approval.
                  </div>
                  <div className="text-[10px] text-emerald-700 text-right font-medium">
                    ✓✓ Immediate Group Dispatch
                  </div>
                </div>
              </div>

              {/* Message 3 Live Preview (After 2 days) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Message 3 (Scheduled Automatically After 2 Days)
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    In 48 Hours
                  </span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 text-xs text-slate-800 space-y-1 relative shadow-2xs">
                  <div className="text-slate-900 leading-relaxed font-sans">
                    Dear Sir/Madam,<br />
                    This is a gentle reminder to kindly release the production payment to initiate the production process.<br />
                    Please note that the production timeline is approximately{' '}
                    <span className="font-bold bg-amber-200/90 text-amber-950 px-1.5 py-0.5 rounded border border-amber-300">
                      {productionDaysInput.trim() || '60'} days
                    </span>{' '}
                    from the date of payment and approval. Kindly complete the payment at the earliest to avoid any delay in the production schedule.
                  </div>
                  <div className="text-[10px] text-amber-800 text-right font-medium">
                    ⏱ Auto-scheduled • Skipped if production payment received
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingDrawingApproval}
                  onClick={() => setShowDrawingApprovalModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDrawingApproval}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDrawingApproval ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Dispatching WhatsApp Messages...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm & Send WhatsApp Messages</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

