/**
 * Working Days utility for Alpha Elevators Installation Programme (Frontend)
 * Automatically excludes Saturday and Sunday.
 */

export function parseDateString(dateStr: string | null | undefined): Date {
  if (!dateStr) return toWorkingDay(new Date());
  try {
    if (typeof dateStr !== 'string') return toWorkingDay(new Date(dateStr));
    const clean = dateStr.trim();
    if (!clean) return toWorkingDay(new Date());
    if (clean.includes('-') && clean.split('-')[0].length === 2) {
      const [dd, mm, yyyy] = clean.split('-');
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      return isNaN(d.getTime()) ? toWorkingDay(new Date()) : d;
    }
    const parts = clean.slice(0, 10).split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      return isNaN(d.getTime()) ? toWorkingDay(new Date()) : d;
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? toWorkingDay(new Date()) : d;
  } catch {
    return toWorkingDay(new Date());
  }
}

export function formatDateISO(d: Date | string | null | undefined): string {
  if (!d) return '';
  try {
    const dateObj = typeof d === 'string' ? parseDateString(d) : d;
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

export function formatDateDisplay(d: Date | string | null | undefined): string {
  if (!d) return '-';
  try {
    const dateObj = typeof d === 'string' ? parseDateString(d) : d;
    if (!dateObj || isNaN(dateObj.getTime())) return '-';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return '-';
  }
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function toWorkingDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  const day = res.getDay();
  if (day === 6) {
    res.setDate(res.getDate() + 2); // Sat -> Mon
  } else if (day === 0) {
    res.setDate(res.getDate() + 1); // Sun -> Mon
  }
  return res;
}

export function getNextWorkingDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  res.setDate(res.getDate() + 1);
  return toWorkingDay(res);
}

export function calculateCompleteDate(startDate: Date, workingDays: number): Date {
  let cur = toWorkingDay(startDate);
  if (workingDays <= 1) return cur;

  let remaining = workingDays - 1;
  while (remaining > 0) {
    cur.setDate(cur.getDate() + 1);
    if (!isWeekend(cur)) {
      remaining--;
    }
  }
  return cur;
}

export function countWorkingDays(startDate: Date, endDate: Date): number {
  const start = toWorkingDay(startDate);
  const end = toWorkingDay(endDate);
  if (start > end) return 1;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

export const DEFAULT_INSTALLATION_STAGES: Array<{
  slNo: number;
  stageKey: string;
  stageName: string;
  defaultWorkingDays: number;
}> = [
  { slNo: 1, stageKey: 'SHAFT_READINESS', stageName: 'Shaft readiness,', defaultWorkingDays: 2 },
  { slNo: 2, stageKey: 'SITE_SURVEY', stageName: 'Site survey, shaft measurement', defaultWorkingDays: 1 },
  { slNo: 3, stageKey: 'BRACKETS_GUIDE_RAILS', stageName: 'Installation of brackets and guide rails Alingment', defaultWorkingDays: 2 },
  { slNo: 4, stageKey: 'MACHINE_CAR_CWT', stageName: 'Machine , Car and Cwt Frame Instalation', defaultWorkingDays: 1 },
  { slNo: 5, stageKey: 'BELT_STARTUP', stageName: 'Belt installation And Startup Prepration', defaultWorkingDays: 1 },
  { slNo: 6, stageKey: 'PLATFORM_ALIGNMENT', stageName: 'Platform Instalation and Alignment', defaultWorkingDays: 1 },
  { slNo: 7, stageKey: 'DOOR_FRAME', stageName: 'Door Frame Instalation', defaultWorkingDays: 1 },
  { slNo: 8, stageKey: 'CABIN_DOOR_ALIGNMENT', stageName: 'Cabin Installation  and Door Alignment', defaultWorkingDays: 1 },
  { slNo: 9, stageKey: 'SHAFT_GLASS_FIXING', stageName: 'Shaft Glass Fixing', defaultWorkingDays: 2 },
  { slNo: 10, stageKey: 'HIGH_SPEED_OPERATION', stageName: 'Preparing for high speed operation', defaultWorkingDays: 2 },
  { slNo: 11, stageKey: 'HANDOVER', stageName: 'HANDOVER', defaultWorkingDays: 1 },
];

export function generateInitialSchedule(
  installationStartDate: string | Date
) {
  const baseStart = toWorkingDay(
    typeof installationStartDate === 'string'
      ? parseDateString(installationStartDate)
      : installationStartDate
  );

  let currentStart = new Date(baseStart);

  return DEFAULT_INSTALLATION_STAGES.map((def) => {
    const start = new Date(currentStart);
    const complete = calculateCompleteDate(start, def.defaultWorkingDays);

    currentStart = getNextWorkingDay(complete);

    return {
      slNo: def.slNo,
      stageKey: def.stageKey,
      stageName: def.stageName,
      startDate: formatDateISO(start),
      completeDate: formatDateISO(complete),
      status: 'PENDING' as const,
      durationWorkingDays: def.defaultWorkingDays,
      delayReason: null,
      delayNotes: '',
    };
  });
}

/**
 * Recalculates and cascades all subsequent stages when a stage date is modified
 */
export function cascadeScheduleUpdates(
  stages: Array<{
    slNo: number;
    stageKey: string;
    stageName: string;
    startDate: string;
    completeDate: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
    durationWorkingDays?: number;
    delayReason?: 'HOLIDAY' | 'TECHNICAL_ISSUE' | null;
    delayNotes?: string;
  }>,
  updatedStageKey: string,
  newStartDateStr: string,
  newCompleteDateStr: string,
  reason?: 'HOLIDAY' | 'TECHNICAL_ISSUE' | null,
  notes?: string
) {
  const cloned = stages.map((s: any, idx: number) => {
    const plain = typeof s.toObject === 'function' ? s.toObject() : s._doc ? { ...s._doc } : { ...s };
    const def = DEFAULT_INSTALLATION_STAGES[idx] || DEFAULT_INSTALLATION_STAGES.find((d: any) => d.stageKey === plain.stageKey);
    return {
      slNo: plain.slNo || def?.slNo || idx + 1,
      stageKey: plain.stageKey || def?.stageKey || `STAGE_${idx + 1}`,
      stageName: plain.stageName || def?.stageName || `Stage ${idx + 1}`,
      startDate: plain.startDate || formatDateISO(new Date()),
      completeDate: plain.completeDate || formatDateISO(new Date()),
      status: plain.status || 'PENDING',
      durationWorkingDays: plain.durationWorkingDays || def?.defaultWorkingDays || 1,
      delayReason: plain.delayReason || null,
      delayNotes: plain.delayNotes || '',
    };
  });

  const targetIdx = cloned.findIndex((s) => s.stageKey === updatedStageKey);
  if (targetIdx === -1) return cloned;

  const validStart = toWorkingDay(parseDateString(newStartDateStr));
  let validComplete = toWorkingDay(parseDateString(newCompleteDateStr));
  if (validComplete < validStart) {
    validComplete = new Date(validStart);
  }

  const newDuration = countWorkingDays(validStart, validComplete);

  // Update target stage
  cloned[targetIdx].startDate = formatDateISO(validStart);
  cloned[targetIdx].completeDate = formatDateISO(validComplete);
  cloned[targetIdx].durationWorkingDays = newDuration;
  if (reason) {
    cloned[targetIdx].delayReason = reason;
    cloned[targetIdx].status = 'DELAYED';
  }
  if (notes) {
    cloned[targetIdx].delayNotes = notes;
  }

  // Cascade subsequent stages
  let nextAvailableStart = getNextWorkingDay(validComplete);

  for (let i = targetIdx + 1; i < cloned.length; i++) {
    const stage = cloned[i];
    const stageStart = new Date(nextAvailableStart);
    const duration = stage.durationWorkingDays || 1;
    const stageComplete = calculateCompleteDate(stageStart, duration);

    stage.startDate = formatDateISO(stageStart);
    stage.completeDate = formatDateISO(stageComplete);

    // Prepare for next stage
    nextAvailableStart = getNextWorkingDay(stageComplete);
  }

  return cloned;
}

