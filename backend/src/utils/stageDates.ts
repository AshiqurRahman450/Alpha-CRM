/**
 * Utilities for project stage dates and progression.
 */

export const ORDERED_STAGE_KEYS = [
  'PAYMENT_RECEIVED',
  'SITE_MEASUREMENT',
  'DESIGN',
  'CUSTOMER_APPROVAL',
  'ENGINEERING',
  'MANUFACTURING',
  'QUALITY_CHECK',
  'DISPATCH',
  'MATERIAL_IN_TRANSIT',
  'DELIVERY',
  'MATERIAL_DELIVERY',
  'INSTALLATION',
  'TESTING',
  'COMPLETED',
] as const;

export function normalizeStageKey(status: string | undefined): string | null {
  if (!status) return null;
  const s = String(status).trim();
  if (s === 'PRODUCTION_IN_PROGRESS') return 'MANUFACTURING';
  if (s === 'MATERIAL_DISPATCHED') return 'DISPATCH';
  if (s === 'MATERIAL_DELIVERED') return 'MATERIAL_DELIVERY';
  if (s === 'SITE_VISIT') return 'SITE_MEASUREMENT';
  if (s === 'DRAWING' || s === 'DRAWING_AND_CABIN') return 'DESIGN';
  if (s === 'DRAWING_AND_CABIN_DESIGN_APPROVAL') return 'CUSTOMER_APPROVAL';
  if (s === 'PRODUCTION_PAYMENT') return 'ENGINEERING';
  if (s === 'READINESS_PAYMENT' || s === 'QC') return 'QUALITY_CHECK';
  if (s === 'PRE_SITE_VISIT' || s === 'PRE_SITEVISIT') return 'DELIVERY';
  if (s === 'INSTALLATION_IN_PROGRESS') return 'INSTALLATION';
  if (s === 'HANDOVER' || s === 'HANDOVER_PAYMENT_PENDING') return 'TESTING';
  if (s === 'PROJECT_COMPLETED') return 'COMPLETED';
  return s;
}

/**
 * Ensures that any completed/done stage has its executedDate automatically filled.
 * Never overwrites an existing executedDate.
 * Returns true if any stage dates were modified on the project.
 */
export function autoFillExecutedDatesForCompletedStages(project: any): boolean {
  if (!project) return false;
  if (!project.stageDates) {
    project.stageDates = new Map();
  }

  const currentKey = normalizeStageKey(project.projectStatus);
  const currentIdx = currentKey ? ORDERED_STAGE_KEYS.indexOf(currentKey as any) : -1;
  let modified = false;
  const now = new Date();

  // Set of stages that are completed and must have an executed date
  const completedKeys = new Set<string>();

  // 1. All stages prior to the current project status are completed
  if (currentIdx !== -1) {
    const maxIdx = currentKey === 'COMPLETED' ? ORDERED_STAGE_KEYS.length : currentIdx;
    for (let i = 0; i < maxIdx; i++) {
      completedKeys.add(ORDERED_STAGE_KEYS[i]);
    }
  }

  // 2. If any stage already has executedDate, every stage prior to it is completed
  for (let i = 0; i < ORDERED_STAGE_KEYS.length; i++) {
    const key = ORDERED_STAGE_KEYS[i];
    let stageObj: any = null;
    if (typeof project.stageDates.get === 'function') {
      stageObj = project.stageDates.get(key);
    } else {
      stageObj = project.stageDates[key];
    }
    if (stageObj?.executedDate && !isNaN(new Date(stageObj.executedDate).getTime())) {
      for (let j = 0; j <= i; j++) {
        completedKeys.add(ORDERED_STAGE_KEYS[j]);
      }
    }
  }

  // 3. Special business milestones:
  // Payment received is done if any payment has been recorded
  if (
    project.paymentStatus === 'ADVANCE_PAID' ||
    project.paymentStatus === 'PARTIAL_PAID' ||
    project.paymentStatus === 'COMPLETED' ||
    project.advancePaymentDate ||
    (project.totalPaid && project.totalPaid > 0)
  ) {
    completedKeys.add('PAYMENT_RECEIVED');
  }

  // If drawing approved was recorded or timeline set and project reached beyond customer approval
  if (
    project.drawingApprovedAt ||
    (project.productionTimelineDays && currentIdx > ORDERED_STAGE_KEYS.indexOf('CUSTOMER_APPROVAL'))
  ) {
    completedKeys.add('CUSTOMER_APPROVAL');
  }

  // 4. Auto-fill executedDate for each completed stage if missing
  for (const stageKey of completedKeys) {
    let stageObj: any = null;
    if (typeof project.stageDates.get === 'function') {
      stageObj = project.stageDates.get(stageKey);
    } else {
      stageObj = project.stageDates[stageKey];
    }

    const hasExecutedDate =
      stageObj &&
      stageObj.executedDate &&
      !isNaN(new Date(stageObj.executedDate).getTime());

    if (!hasExecutedDate) {
      const dates = stageObj ? { ...(stageObj.toObject ? stageObj.toObject() : stageObj) } : {};
      let autoDate: Date = now;

      if (dates.scheduleDate && !isNaN(new Date(dates.scheduleDate).getTime())) {
        const sched = new Date(dates.scheduleDate);
        if (sched <= now) {
          autoDate = sched;
        } else {
          autoDate = now;
        }
      } else if (stageKey === 'PAYMENT_RECEIVED') {
        if (project.advancePaymentDate && !isNaN(new Date(project.advancePaymentDate).getTime())) {
          autoDate = new Date(project.advancePaymentDate);
        } else if (project.createdAt && !isNaN(new Date(project.createdAt).getTime())) {
          autoDate = new Date(project.createdAt);
        }
      } else if (stageKey === 'DESIGN' && project.drawingUploadedAt && !isNaN(new Date(project.drawingUploadedAt).getTime())) {
        autoDate = new Date(project.drawingUploadedAt);
      } else if (stageKey === 'CUSTOMER_APPROVAL' && project.drawingApprovedAt && !isNaN(new Date(project.drawingApprovedAt).getTime())) {
        autoDate = new Date(project.drawingApprovedAt);
      }

      dates.executedDate = autoDate;
      if (!dates.scheduleDate) {
        dates.scheduleDate = autoDate;
      }

      if (typeof project.stageDates.set === 'function') {
        project.stageDates.set(stageKey, dates);
      } else {
        project.stageDates[stageKey] = dates;
      }
      modified = true;
    }
  }

  if (modified && typeof project.markModified === 'function') {
    project.markModified('stageDates');
  }

  return modified;
}
