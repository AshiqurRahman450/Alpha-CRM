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
} from 'lucide-react';

export const STAGES_ORDER = [
  { key: 'PAYMENT_RECEIVED', label: 'Advance Payment Received', icon: CheckCircle2 },
  { key: 'SITE_MEASUREMENT', label: 'Site Visit', icon: ClipboardCheck },
  { key: 'DESIGN', label: 'Drawing and Cabin', icon: Sparkles },
  { key: 'CUSTOMER_APPROVAL', label: 'Drawing and Cabin Design Approval', icon: CheckCircle2 },
  { key: 'ENGINEERING', label: 'Production Payment', icon: Wrench },
  { key: 'MANUFACTURING', label: 'Approval Drawing to factory', icon: Wrench },
  { key: 'QUALITY_CHECK', label: 'Rediness Payment', icon: PackageCheck },
  { key: 'DISPATCH', label: 'Expected Delivery', icon: Truck },
  { key: 'DELIVERY', label: 'Pre Site Visit', icon: Truck },
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
  onStatusChange?: (newStatus: string) => void;
  isEditable?: boolean;
  stageDates?: Record<string, { scheduleDate?: string | null; executedDate?: string | null }>;
  onDateChange?: (stageKey: string, type: 'scheduleDate' | 'executedDate', date: string) => Promise<void> | void;
  onBulkDateChange?: (updates: { stageKey: string, scheduleDate?: string | null, executedDate?: string | null }[]) => Promise<void> | void;
  currentUserRole?: string;
  customerCity?: string;
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
}: TimelineProps) {
  const currentIndex = STAGES_ORDER.findIndex((s) => s.key === currentStatus);

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
                  if (canEditThisStage && onStatusChange && stage.key !== currentStatus) {
                    if (confirm(`Update project status to "${stage.label}"?`)) {
                      onStatusChange(stage.key);
                    }
                  }
                }}
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
    </div>
  );
}
