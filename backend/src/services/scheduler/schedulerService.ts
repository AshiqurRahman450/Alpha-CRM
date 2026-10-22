import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import {
  Project,
  Customer,
  WhatsAppMessage,
  WhatsAppMessageLog,
  WhatsAppTemplate,
  IProject,
  WhatsAppChannel,
  User,
  Reminder,
} from '../../models';
import { whatsappService, watiService, whatsAppWebBot, normalizeWhatsAppPhone } from '../whatsapp';
import { logProjectActivity } from '../activity/activityService';
import { config } from '../../config';

let isJobRunning = false;

// Project Status to friendly timeline stage names (matching Project Execution Timeline)
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PAYMENT_RECEIVED: 'Advance Payment Received',
  SITE_MEASUREMENT: 'Site Visit',
  DESIGN: 'Drawing and Cabin',
  CUSTOMER_APPROVAL: 'Drawing and Cabin Design Approval',
  ENGINEERING: 'Production Payment',
  MANUFACTURING: 'Approval Drawing to factory',
  QUALITY_CHECK: 'Rediness Payment',
  DELIVERY: 'Pre Site Visit',
  DISPATCH: 'Expected Delivery',
  INSTALLATION: 'Installation Start Date',
  TESTING: 'Handover',
  COMPLETED: 'Project Completed',
};

export function formatProjectStatus(status: string): string {
  if (!status) return 'General';
  return PROJECT_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

// Map Project Status to Approved WhatsApp Template Name
export const STAGE_TEMPLATE_MAP: Record<string, string> = {
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

// Map current stage to Next Milestone description based on Project Execution Timeline
export const STAGE_NEXT_MILESTONE_MAP: Record<string, string> = {
  PAYMENT_RECEIVED: 'Site Visit',
  SITE_MEASUREMENT: 'Drawing and Cabin',
  DESIGN: 'Drawing and Cabin Design Approval',
  CUSTOMER_APPROVAL: 'Production Payment',
  ENGINEERING: 'Approval Drawing to factory',
  MANUFACTURING: 'Rediness Payment',
  QUALITY_CHECK: 'Pre Site Visit',
  DELIVERY: 'Expected Delivery',
  DISPATCH: 'Installation Start Date',
  INSTALLATION: 'Handover',
  TESTING: 'Project Completed',
  COMPLETED: 'Project Completed',
};

/**
 * Formats a date as YYYY-MM-DD for idempotency tracking
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculates next update date given frequency days (1, 10, 15, 20 or custom days)
 */
export function calculateNextUpdateDate(days: number = 15, fromDate: Date = new Date()): Date {
  const validDays = [1, 10, 15, 20].includes(Number(days))
    ? Number(days)
    : Number(days) > 0
    ? Number(days)
    : 15;
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + validDays);
  // Default to 09:00 AM local time
  nextDate.setHours(9, 0, 0, 0);
  return nextDate;
}

// Full dictionary of the 20 approved Alpha Elevators WhatsApp milestone templates
export const APPROVED_MILESTONE_TEMPLATES: Record<string, string> = {
  SITE_VISIT_SCHEDULE_PM: `Dear Sir/Madam,
Your site visit has been scheduled for [Date] at [Time]. Our technical team will visit the site for measurement and inspection.
Kindly ensure site accessibility during the scheduled time.`,

  SITE_VISIT_COMPLETED: `Good Afternoon Sir,

We have successfully completed the site visit on the scheduled date and shared the site visit report with you via email.

Kindly review the report and confirm your approval by replying to the email so that we can initiate the drawing process based on the site measurements.

Thank you for your support and cooperation.

Regards,  
CRM Department  
Alpha Elevators`,

  DRAWING_CABIN_APPROVAL: `Dear Sir/Madam,
The elevator drawing and cabin design are ready for your review and approval. Kindly review and confirm your approval to proceed to the next stage.`,

  DRAWING_CABIN_APPROVAL_REMINDER: `Dear Sir/Madam,
This is a gentle reminder to kindly review and approves the elevator drawing and cabin design shared with you, so that we can proceed with the next stage without delay.`,

  THANK_YOU_FOR_APPROVAL: `Dear Sir/Madam,
We have received your drawing and cabin approval. Kindly request you to make the production payment to initiate the production process.`,

  PRODUCTION_PAYMENT: `Dear Sir/Madam,
Thank you for the production payment. We have received the payment and will proceed with the production process accordingly.`,

  PRODUCTION_PAYMENT_REMINDER: `Dear Sir/Madam,
This is a gentle reminder to kindly release the production payment to initiate the production process.
Please note that the production timeline is approximately 60 days from the date of payment and approval. Kindly complete the payment at the earliest to avoid any delay in the production schedule.`,

  PRODUCTION_PAYMENT_RECEIVED: `Dear Sir/Madam,
Thank you for the production payment. We have received the payment and will proceed with the production process accordingly.`,

  PRODUCTION_UPDATE_STAGE_1: `Dear Sir/Madam,
Your elevator production is currently in the fabrication and material processing stage, including structure, cabin, and door fabrication.
We will share the next production update within 10 days.`,

  PRODUCTION_UPDATE_STAGE_2: `Dear Sir/Madam,
Your elevator is currently in the finishing and assembly stage, including painting, cabin finishing, and electrical & mechanical assembly.
We will share the next production update within 10 days.`,

  PRODUCTION_UPDATE_STAGE_3: `Dear Sir/Madam,
Your elevator is in the final inspection stage. Quality checks are being completed, and the material will be prepared for dispatch upon completion.`,

  READINESS_PAYMENT: `Dear Sir/Madam,
Your elevator is ready for dispatch. Kindly release the readiness payment to proceed with the material dispatch process.
We request you to complete the payment at the earliest to avoid any delay in dispatch.`,

  READINESS_PAYMENT_REMINDER: `Dear Sir/Madam,
This is a gentle reminder to kindly release the Readiness payment to proceed with the Material dispatch.
We request you to complete the payment at the earliest to avoid any delay in the dispatch schedule.`,

  READINESS_PAYMENT_RECEIVED: `Dear Sir/Madam,
Thank you for the readiness payment. We have received the payment and will proceed with the material dispatch process accordingly.`,

  MATERIAL_DISPATCHED_PM: `Dear Sir/Madam,
Your elevator material has been dispatched through VRL Logistics.
VRL Tracking No.: [Tracking Number]
You can use the above tracking number to track the material movement. We will keep you updated on the delivery status.
Note: Kindly ensure proper space and access for safe unloading and material storage.`,

  PRE_INSTALLATION_SITE_VISIT_PM: `Dear Sir/Madam,
Our technical team will visit the site for a pre-installation inspection to verify site readiness and installation requirements.
Kindly ensure the site is ready and accessible for the scheduled visit.`,

  MATERIAL_UNLOADING: `Dear Sir/Madam,
Your elevator material has been Delivered to the site and unloading is in progress. We will keep you Updated on our installation team arrival shortly.`,

  INSTALLATION_TEAM_ARRIVAL_PM: `Dear Sir/Madam,
Our installation team has arrived at the site and will commence the elevator installation work as per the planned schedule.`,

  INSTALLATION_FEEDBACK: `Dear Sir/Madam,
As the installation work is in progress, kindly share your feedback or any concerns regarding the work. Our team will be happy to assist and address them promptly.`,

  HAND_OVER_PM: `Dear Sir/Madam,
This is to inform you that the elevator installation work is expected to be completed by tomorrow. Kindly share a convenient date and time for the handover, so that we can plan and complete the necessary handover formalities accordingly.`,
};

/**
 * Generates verified, fact-checked project update message text from database attributes
 * using the 20 approved Alpha Elevators WhatsApp templates.
 */
// Stages working after the Production Payment stage
export const POST_PRODUCTION_PAYMENT_STAGES: string[] = [
  'MANUFACTURING',
  'QUALITY_CHECK',
  'DELIVERY',
  'DISPATCH',
  'INSTALLATION',
  'TESTING',
];

export function generateProjectUpdateText(
  project: any,
  customer: any,
  customNote?: string,
  overrideTemplateKey?: string
): string {
  const status = project?.projectStatus || 'SITE_MEASUREMENT';

  // Determine corresponding template key
  let templateKey = overrideTemplateKey;
  if (!templateKey) {
    if (status === 'ENGINEERING') {
      templateKey = 'PRODUCTION_PAYMENT_RECEIVED';
    } else if (status === 'MANUFACTURING') {
      const pStage = project?.productionStage || 1;
      if (pStage === 2) {
        templateKey = 'PRODUCTION_UPDATE_STAGE_2';
      } else if (pStage >= 3) {
        templateKey = 'PRODUCTION_UPDATE_STAGE_3';
      } else {
        templateKey = 'PRODUCTION_UPDATE_STAGE_1';
      }
    } else if (status === 'SITE_MEASUREMENT') {
      templateKey = 'SITE_VISIT_COMPLETED';
    } else {
      templateKey = STAGE_TEMPLATE_MAP[status] || 'SITE_VISIT_COMPLETED';
    }
  }

  let text = APPROVED_MILESTONE_TEMPLATES[templateKey] || APPROVED_MILESTONE_TEMPLATES.SITE_VISIT_COMPLETED;

  // Substitute interval days into production stage 1 & 2 templates if interval is not 10 days
  const intervalDays = project?.whatsapp?.intervalDays || project?.updateFrequencyDays || 10;
  const intervalText = intervalDays === 1 ? 'within 1 day' : `within ${intervalDays} days`;
  text = text.replace(/within 10 days/gi, intervalText);

  // Substitute [Date] placeholder
  if (text.includes('[Date]')) {
    const stageDatesAny = project?.stageDates as any;
    const siteVisitStage = stageDatesAny?.get ? stageDatesAny.get('SITE_MEASUREMENT') : stageDatesAny?.['SITE_MEASUREMENT'];
    const dateVal = siteVisitStage?.scheduleDate || siteVisitStage?.executedDate || project?.installationDate || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    text = text.replace(/\[Date\]/gi, formattedDate);
  }

  // Substitute [Time] placeholder
  if (text.includes('[Time]')) {
    text = text.replace(/\[Time\]/gi, '11:00 AM');
  }

  // Substitute [Tracking Number] placeholder
  if (text.includes('[Tracking Number]')) {
    const tracking = project?.vrlLrNumber || project?.trackingNumber || 'VRL-PENDING';
    text = text.replace(/\[Tracking Number\]/gi, tracking);
  }

  if (customNote && customNote.trim()) {
    text += `\n\nNote: ${customNote.trim()}`;
  }

  return text;
}

/**
 * Core automation processor: checks and executes due WhatsApp updates
 * Features atomic job claiming, MongoDB job persistence, idempotency, and WATI provider integration.
 * Interval group messages are executed for any stages working after the Production Payment stage
 * in a 3-stage sequence:
 * - Interval 1: Production Update – Stage 1 Production & Fabrication
 * - Interval 2: Production Update – Stage 2 Finishing & Assembly
 * - Interval 3: Production Update – Stage 3 Final Inspection
 * After Stage 3, interval updates cease.
 */
export async function processDueWhatsAppUpdates(): Promise<{
  processed: number;
  sent: number;
  awaitingCapability: number;
  skipped: number;
  failed: number;
  details: any[];
}> {
  if (isJobRunning) {
    console.log('[Scheduler] Previous execution still active. Skipping concurrent cycle.');
    return { processed: 0, sent: 0, awaitingCapability: 0, skipped: 0, failed: 0, details: [] };
  }

  isJobRunning = true;
  const now = new Date();
  const results: any[] = [];
  let sentCount = 0;
  let awaitingCapabilityCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    // 1. Find candidate projects:
    // Production interval updates work across any active stages after Production Payment
    const dueProjects = await Project.find({
      $and: [
        { projectStatus: { $in: POST_PRODUCTION_PAYMENT_STAGES } },
        {
          $or: [
            { productionStage: { $in: [1, 2, 3] } },
            { productionStage: { $exists: false } },
            { productionStage: null },
          ],
        },
        {
          $or: [
            { 'whatsapp.groupId': { $exists: true, $ne: '' } },
            { whatsappGroupId: { $exists: true, $ne: '' } },
            { 'whatsapp.inviteLink': { $exists: true, $ne: '' } },
          ],
        },
        {
          $or: [
            { 'whatsapp.updatesEnabled': true },
            { automationEnabled: true },
          ],
        },
        {
          $or: [
            { 'whatsapp.paused': false },
            { 'whatsapp.paused': { $exists: false } },
            { isPaused: false },
            { isPaused: { $exists: false } },
          ],
        },
        {
          $or: [
            { nextUpdateAt: { $lte: now } },
            { 'whatsapp.nextUpdateAt': { $lte: now } },
            { nextUpdateAt: { $exists: false } },
            { nextUpdateAt: null },
          ],
        },
      ],
    }).populate('customerId');

    console.log(`[Scheduler] Evaluated ${dueProjects.length} candidate projects due for WhatsApp update at ${now.toISOString()}`);

    for (const project of dueProjects) {
      const customer = project.customerId as any;
      const groupId = project.whatsapp?.groupId || project.whatsappGroupId || project.whatsapp?.inviteLink;
      const intervalDays = project.whatsapp?.intervalDays || project.updateFrequencyDays || 10;

      // Ensure customer exists and has opted in
      if (!customer || !customer.whatsappOptIn) {
        console.log(`[Scheduler] Skipping project ${project.projectId}: WhatsApp opt-in is FALSE or customer not found.`);
        skippedCount++;
        results.push({
          projectId: project.projectId,
          status: 'SKIPPED',
          reason: 'Customer WhatsApp opt-in disabled',
        });
        continue;
      }

      // Check postpone date
      if (project.postponedUntil && project.postponedUntil > now) {
        console.log(`[Scheduler] Skipping project ${project.projectId}: Postponed until ${project.postponedUntil.toISOString()}`);
        skippedCount++;
        results.push({
          projectId: project.projectId,
          status: 'SKIPPED',
          reason: `Postponed until ${project.postponedUntil.toISOString()}`,
        });
        continue;
      }

      // Check pause reason
      if (project.whatsapp?.paused || project.pauseReason) {
        skippedCount++;
        results.push({
          projectId: project.projectId,
          status: 'SKIPPED',
          reason: project.pauseReason || 'Automation paused',
        });
        continue;
      }

      // Determine current production update stage (1, 2, or 3)
      let currentStage = project.productionStage || 1;
      if (!project.productionStage || project.productionStage === 1) {
        const stage1Sent = await WhatsAppMessageLog.findOne({
          projectId: project._id,
          $or: [
            { idempotencyKey: new RegExp(`^${project.projectId}_prod_stage_1`) },
            { messageText: new RegExp('fabrication and material processing', 'i') },
          ],
          status: { $in: ['SENT', 'DELIVERED', 'READ'] },
        });
        if (stage1Sent) {
          currentStage = 2;
        }
      }
      if (currentStage === 2) {
        const stage2Sent = await WhatsAppMessageLog.findOne({
          projectId: project._id,
          $or: [
            { idempotencyKey: new RegExp(`^${project.projectId}_prod_stage_2`) },
            { messageText: new RegExp('finishing and assembly', 'i') },
          ],
          status: { $in: ['SENT', 'DELIVERED', 'READ'] },
        });
        if (stage2Sent) {
          currentStage = 3;
        }
      }
      if (currentStage === 3) {
        const stage3Sent = await WhatsAppMessageLog.findOne({
          projectId: project._id,
          $or: [
            { idempotencyKey: new RegExp(`^${project.projectId}_prod_stage_3`) },
            { messageText: new RegExp('final inspection stage', 'i') },
          ],
          status: { $in: ['SENT', 'DELIVERED', 'READ'] },
        });
        if (stage3Sent) {
          currentStage = 4;
        }
      }

      if (currentStage >= 4) {
        console.log(`[Scheduler] Project ${project.projectId}: All 3 production update stages completed. Clearing nextUpdateAt.`);
        project.productionStage = 4;
        project.nextUpdateAt = undefined;
        if (project.whatsapp) {
          project.whatsapp.nextUpdateAt = undefined;
        }
        await project.save();
        skippedCount++;
        results.push({
          projectId: project.projectId,
          status: 'SKIPPED',
          reason: 'All 3 production update stages completed',
        });
        continue;
      }

      const templateKey =
        currentStage === 1
          ? 'PRODUCTION_UPDATE_STAGE_1'
          : currentStage === 2
          ? 'PRODUCTION_UPDATE_STAGE_2'
          : 'PRODUCTION_UPDATE_STAGE_3';

      // 2. Build atomic Idempotency Key per stage: `${projectId}_prod_stage_${currentStage}_interval${intervalDays}`
      const idempotencyKey = `${project.projectId}_prod_stage_${currentStage}_interval${intervalDays}`;

      // Check if already completed in WhatsAppMessageLog
      const existingSuccess = await WhatsAppMessageLog.findOne({
        idempotencyKey,
        status: { $in: ['SENT', 'DELIVERED', 'READ'] },
      });

      if (existingSuccess) {
        console.log(`[Scheduler] Idempotency protected: Project ${project.projectId} stage ${currentStage} already completed.`);
        skippedCount++;
        // Advance stage if stuck
        project.productionStage = currentStage + 1;
        if (project.productionStage >= 4) {
          project.nextUpdateAt = undefined;
          if (project.whatsapp) project.whatsapp.nextUpdateAt = undefined;
        } else {
          project.nextUpdateAt = calculateNextUpdateDate(intervalDays, now);
          if (project.whatsapp) project.whatsapp.nextUpdateAt = project.nextUpdateAt;
        }
        await project.save();
        results.push({
          projectId: project.projectId,
          status: 'IDEMPOTENT_SKIPPED',
          reason: `Stage ${currentStage} already sent successfully`,
        });
        continue;
      }

      // 3. Generate Fact-Checked Message Text for this specific stage
      const messageContent = generateProjectUpdateText(project, customer, undefined, templateKey);

      // 4. Atomic Job Claiming via WhatsAppMessageLog
      let messageLog: any = null;
      try {
        messageLog = await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId: groupId!,
          messageText: messageContent,
          messageType: 'text',
          scheduledAt: now,
          attemptedAt: now,
          status: 'SENDING',
          attemptCount: 1,
          idempotencyKey,
          isDryRun: config.wati.dryRun,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          // Another instance concurrently claimed this job
          console.log(`[Scheduler] Job collision avoided for ${project.projectId} (idempotency key: ${idempotencyKey})`);
          skippedCount++;
          continue;
        }
        throw err;
      }

      // Also create WhatsAppMessage record for backward-compatibility with UI stream
      const legacyMessageDoc = await WhatsAppMessage.create({
        projectId: project._id,
        projectCode: project.projectId,
        customerId: customer._id,
        customerName: customer.fullName,
        groupId: groupId!,
        templateName: templateKey,
        messageType: 'text',
        recipientType: 'group',
        direction: 'OUTGOING',
        messageContent,
        status: 'SENDING',
        isAutomated: true,
        idempotencyKey,
      });

      // 5. Dispatch directly inside group via WhatsApp Web Bot (Use Bot for group interval messages, do not use WATI)
      const inviteTarget = project.whatsapp?.inviteLink || groupId!;
      const botStatus = whatsAppWebBot.getStatus();

      let anySuccess = false;
      let lastMsgId = '';
      let sendResult: any = null;

      if (config.wati.dryRun) {
        anySuccess = true;
        lastMsgId = `DRY_SCHED_${Date.now()}`;
        sendResult = { success: true, messageId: lastMsgId };
      } else if (botStatus.isConnected) {
        console.log(`[Scheduler] Dispatching automated inside-group update (Stage ${currentStage}) for ${project.projectId} via Web Bot`);
        sendResult = await whatsAppWebBot.sendMessageToGroup(inviteTarget, messageContent);
        if (sendResult.success) {
          anySuccess = true;
          lastMsgId = sendResult.messageId || `BOT_${Date.now()}`;
        }
      } else {
        // WhatsApp Web Bot is disconnected. Do NOT invoke WATI for group interval messages.
        console.warn(`[Scheduler] WhatsApp Web Bot not connected for group ${groupId}. Bot status: ${botStatus.status}. Retaining job in AWAITING_PROVIDER_CAPABILITY.`);
        sendResult = {
          success: false,
          status: 'AWAITING_PROVIDER_CAPABILITY',
          error: 'WhatsApp Web Bot is disconnected. Scan the QR code in WhatsApp settings to enable automated group updates.',
        };
      }

      if (anySuccess) {
        sentCount++;
        messageLog.status = 'SENT';
        messageLog.sentAt = new Date();
        messageLog.providerMessageId = lastMsgId || `BOT_${Date.now()}`;
        messageLog.lastError = undefined;
        await messageLog.save();

        legacyMessageDoc.status = 'SENT';
        legacyMessageDoc.metaMessageId = lastMsgId || `BOT_${Date.now()}`;
        legacyMessageDoc.sentAt = new Date();
        await legacyMessageDoc.save();

        // Advance to next production update stage
        const nextStage = currentStage + 1;
        project.productionStage = nextStage;
        project.lastUpdateAt = new Date();
        project.postponedUntil = undefined;

        if (nextStage >= 4) {
          // All 3 stages completed: clear nextUpdateAt so no further interval messages occur!
          project.nextUpdateAt = undefined;
          if (project.whatsapp) {
            project.whatsapp.lastUpdateAt = project.lastUpdateAt;
            project.whatsapp.nextUpdateAt = undefined;
          }
          console.log(`[Scheduler] Project ${project.projectId}: Finished final production stage (Stage 3). Stopped interval updates.`);
        } else {
          // Advance nextUpdateAt by configured interval for next stage
          project.nextUpdateAt = calculateNextUpdateDate(intervalDays, now);
          if (project.whatsapp) {
            project.whatsapp.lastUpdateAt = project.lastUpdateAt;
            project.whatsapp.nextUpdateAt = project.nextUpdateAt;
          }
          console.log(`[Scheduler] Project ${project.projectId}: Stage ${currentStage} sent. Stage ${nextStage} scheduled for ${project.nextUpdateAt.toISOString()}`);
        }
        await project.save();

        // Update WhatsAppChannel
        await WhatsAppChannel.findOneAndUpdate(
          { whatsappGroupId: groupId },
          { lastUpdateDate: new Date(), nextUpdateDate: project.nextUpdateAt }
        );

        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_SENT',
          description: `Automated WhatsApp update sent to group (${groupId}) for Production Update Stage ${currentStage}`,
          metadata: {
            providerMessageId: sendResult.messageId,
            productionStage: currentStage,
            nextProductionStage: nextStage <= 3 ? nextStage : 'COMPLETED',
            intervalDays,
          },
        });

        results.push({
          projectId: project.projectId,
          status: 'SENT',
          messageId: sendResult.messageId,
          stage: currentStage,
        });
      } else if (sendResult.status === 'AWAITING_PROVIDER_CAPABILITY') {
        // As per Section 8:
        // Keep scheduled jobs in awaiting-provider-capability state and appear in the CRM for review.
        // Do NOT mark them as sent, and DO NOT advance nextUpdateAt.
        awaitingCapabilityCount++;
        messageLog.status = 'AWAITING_PROVIDER_CAPABILITY';
        messageLog.lastError = sendResult.error;
        await messageLog.save();

        legacyMessageDoc.status = 'FAILED';
        legacyMessageDoc.errorMessage = sendResult.error;
        await legacyMessageDoc.save();

        console.log(`[Scheduler] Project ${project.projectId}: Saved update in AWAITING_PROVIDER_CAPABILITY state.`);

        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'STATUS_CHANGE',
          description: `Scheduled WhatsApp update logged in AWAITING_PROVIDER_CAPABILITY state: ${sendResult.error}`,
          metadata: { error: sendResult.error },
        });

        results.push({
          projectId: project.projectId,
          status: 'AWAITING_PROVIDER_CAPABILITY',
          error: sendResult.error,
        });
      } else {
        // Transient or fatal error: Handle exponential retry
        failedCount++;
        messageLog.status = 'FAILED';
        messageLog.lastError = sendResult.error;
        messageLog.attemptCount += 1;
        await messageLog.save();

        legacyMessageDoc.status = 'FAILED';
        legacyMessageDoc.errorMessage = sendResult.error;
        await legacyMessageDoc.save();

        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_FAILED',
          description: `Failed to dispatch WhatsApp group update: ${sendResult.error}`,
          metadata: { error: sendResult.error },
        });

        results.push({
          projectId: project.projectId,
          status: 'FAILED',
          error: sendResult.error,
        });
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Fatal error during update check:', err);
  } finally {
    isJobRunning = false;
  }

  return {
    processed: results.length,
    sent: sentCount,
    awaitingCapability: awaitingCapabilityCount,
    skipped: skippedCount,
    failed: failedCount,
    details: results,
  };
}

/**
 * Dispatches 1-to-1 WhatsApp reminder to CRM, Admin, AND the Connected WhatsApp Bot Number
 * to update the Site Visit (PM) schedule date & time.
 * Deduplicates phone numbers so each recipient receives the alert once.
 */
export async function dispatchSiteVisitWhatsAppReminders(
  projectId: any,
  paidAmount?: number,
  reason: string = 'ADVANCE_RECORDED'
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  const errors: string[] = [];
  let sentCount = 0;

  try {
    const project = await Project.findById(projectId).populate('customerId');
    if (!project) {
      return { success: false, sentCount: 0, errors: ['Project not found'] };
    }

    const customer = project.customerId as any;
    const customerName = customer?.fullName || 'Valued Client';
    const customerPhone = customer?.phoneNumber || 'N/A';
    const customerLocation = customer?.city || customer?.address || 'Site Address';
    const amtStr = (paidAmount || project.totalPaid || 0).toLocaleString('en-IN');

    // 1. Gather all active CRM & Admin users
    const notifyUsers = await User.find({
      role: { $in: ['CRM', 'ADMIN'] },
      isActive: { $ne: false },
    });

    // 2. Build deduplicated map of target phone numbers: cleanPhone -> { name, role }
    const targetMap = new Map<string, { phone: string; name: string; role: string }>();

    for (const u of notifyUsers) {
      if (u.phone) {
        const clean = normalizeWhatsAppPhone(u.phone);
        if (clean) {
          targetMap.set(clean, {
            phone: clean,
            name: u.name || 'CRM Team',
            role: u.role || 'CRM',
          });
        }
      }
    }

    // 3. Include the LIVE Connected WhatsApp Bot phone number
    const botStatus = whatsAppWebBot.getStatus();
    if (botStatus.botPhoneNumber) {
      const cleanBot = normalizeWhatsAppPhone(botStatus.botPhoneNumber);
      if (cleanBot) {
        const existing = targetMap.get(cleanBot);
        targetMap.set(cleanBot, {
          phone: cleanBot,
          name: existing ? `${existing.name} (Connected Bot)` : 'Connected Bot',
          role: 'CONNECTED_BOT',
        });
      }
    }

    // 4. Include project configured bot phone number or default Alpha Elevators bot phone
    const candidateBotPhones = [
      project.whatsapp?.botPhoneNumber,
      (project as any).botPhoneNumber,
      process.env.WHATSAPP_BOT_PHONE_NUMBER,
      process.env.BOT_PHONE_NUMBER,
      '+91 93848 20316',
    ].filter(Boolean) as string[];

    for (const bp of candidateBotPhones) {
      const cleanBp = normalizeWhatsAppPhone(bp);
      if (cleanBp && !targetMap.has(cleanBp)) {
        targetMap.set(cleanBp, {
          phone: cleanBp,
          name: 'Alpha WhatsApp Bot',
          role: 'PROJECT_BOT',
        });
      }
    }

    if (targetMap.size === 0) {
      console.warn('[SiteVisitReminder] No target phone numbers found for dispatch.');
      return { success: false, sentCount: 0, errors: ['No valid phone numbers found'] };
    }

    console.log(`[SiteVisitReminder] Dispatching 1-to-1 WhatsApp reminders for ${project.projectName} to ${targetMap.size} recipients:`, Array.from(targetMap.keys()));

    const now = new Date();

    for (const recipient of targetMap.values()) {
      const siteVisitMsg = `🔔 *Action Required: Schedule Site Visit* 🔔\n\nDear ${recipient.name},\nAdvance payment has been officially recorded for Project *${project.projectName}* (${project.projectId})!\n\n*Project & Customer Summary:*\n• *Customer Name:* ${customerName}\n• *Customer Phone:* ${customerPhone}\n• *Location:* ${customerLocation}\n• *Advance Received:* ₹${amtStr}\n• *Current Stage:* Advance Payment Received ✅\n\n👉 *Next Step Required:*\nPlease contact the customer and schedule the date & time for the *Site Visit (PM)* measurement on the Alpha Elevators CRM timeline.\n\nThank you,\nAlpha Elevators CRM`;

      let sent = false;
      let messageId: string | undefined;

      // Primary: Send via connected Web Bot (Baileys)
      if (botStatus.isConnected) {
        try {
          const res = await whatsAppWebBot.sendDirectMessage(recipient.phone, siteVisitMsg);
          if (res.success) {
            sent = true;
            messageId = res.messageId;
            console.log(`[SiteVisitReminder] 1-to-1 WhatsApp reminder sent to ${recipient.role} ${recipient.name} (+${recipient.phone}) via Web Bot`);
          } else {
            console.warn(`[SiteVisitReminder] Web Bot failed for ${recipient.phone}: ${res.error}`);
            errors.push(`WebBot ${recipient.phone}: ${res.error}`);
          }
        } catch (botErr: any) {
          console.error(`[SiteVisitReminder] Web Bot exception for ${recipient.phone}:`, botErr.message);
          errors.push(`WebBot Exception ${recipient.phone}: ${botErr.message}`);
        }
      }

      // Fallback: Send via WATI if Web Bot is offline or delivery failed
      if (!sent) {
        try {
          const watiRes = await watiService.sendGroupText({
            target: recipient.phone,
            targetType: 'DIRECT',
            text: siteVisitMsg,
            contactName: recipient.name,
          });
          if (watiRes.success) {
            sent = true;
            messageId = watiRes.messageId;
            console.log(`[SiteVisitReminder] 1-to-1 WhatsApp reminder sent to ${recipient.role} ${recipient.name} (+${recipient.phone}) via WATI`);
          } else {
            errors.push(`WATI ${recipient.phone}: ${watiRes.error}`);
          }
        } catch (wErr: any) {
          console.warn(`[SiteVisitReminder] WATI exception for ${recipient.phone}:`, wErr.message);
          errors.push(`WATI Exception ${recipient.phone}: ${wErr.message}`);
        }
      }

      if (sent) {
        sentCount++;
        try {
          await WhatsAppMessageLog.create({
            projectId: project._id,
            recipientPhone: recipient.phone,
            recipientName: recipient.name,
            messageText: `[SITE VISIT REMINDER 1-TO-1 (${reason})]:\n${siteVisitMsg}`,
            messageType: 'text',
            scheduledAt: now,
            attemptedAt: now,
            sentAt: now,
            providerMessageId: messageId,
            status: 'SENT',
            attemptCount: 1,
            isDryRun: false,
          });
        } catch (logErr: any) {
          console.warn('[SiteVisitReminder] Failed to create message log:', logErr.message);
        }
      }
    }

    if (sentCount > 0) {
      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'WHATSAPP_SENT',
        description: `Site visit scheduling reminder WhatsApp alert dispatched to ${sentCount} recipients (including CRM, Admin, and Connected Bot Number).`,
      });
    }

    return { success: sentCount > 0, sentCount, errors };
  } catch (err: any) {
    console.error('[SiteVisitReminder] Error dispatching site visit reminders:', err);
    return { success: false, sentCount: 0, errors: [err.message] };
  }
}

/**
 * Triggers initial reminder for CRM and Admin users when Advance Payment Received is marked executed,
 * creating in-app reminders AND dispatching 1-to-1 WhatsApp alert messages to CRM, Admin,
 * and the connected WhatsApp bot number.
 */
export async function triggerAdvancePaymentReminderForCRMAndAdmin(projectId: any, paidAmount?: number): Promise<void> {
  try {
    const project = await Project.findById(projectId).populate('customerId');
    if (!project) return;

    const customer = project.customerId as any;
    const customerName = customer?.fullName || 'Valued Client';
    const customerPhone = customer?.phoneNumber || 'N/A';
    const amtStr = (paidAmount || project.totalPaid || 0).toLocaleString('en-IN');

    // Notify all active CRM and Admin team members
    const notifyUsers = await User.find({
      role: { $in: ['CRM', 'ADMIN'] },
      isActive: { $ne: false },
    });

    const now = new Date();

    for (const user of notifyUsers) {
      // 1. In-App CRM & Admin Reminder
      const existing = await Reminder.findOne({
        userId: user._id,
        relatedProjectId: project._id,
        status: 'PENDING',
        title: { $regex: /Schedule Site Visit/i },
      });

      if (!existing) {
        await Reminder.create({
          userId: user._id,
          title: `Schedule Site Visit - ${project.projectName}`,
          notes: `Advance payment has been received (₹${amtStr}) for ${project.projectName} (${project.projectId}). Please schedule the Site Visit (PM) date & time with customer ${customerName} (+${customerPhone}).`,
          dueAt: now,
          relatedProjectId: project._id,
          status: 'PENDING',
        });
        console.log(`[SiteVisitReminder] In-app reminder created for ${user.role} ${user.name}`);
      }
    }

    // 2. Dispatch 1-to-1 WhatsApp alert to CRM, Admin, AND the Connected Bot Number
    await dispatchSiteVisitWhatsAppReminders(project._id, paidAmount, 'ADVANCE_RECORDED');
  } catch (err: any) {
    console.error('[SiteVisitReminder] Error triggering advance payment reminder for CRM & Admin:', err);
  }
}

/**
 * Backward compatibility alias for triggerAdvancePaymentReminderForCRM
 */
export async function triggerAdvancePaymentReminderForCRM(projectId: any): Promise<void> {
  await triggerAdvancePaymentReminderForCRMAndAdmin(projectId);
}

/**
 * Sends the Customer Concern Escalation Matrix image directly to the project WhatsApp group
 */
export async function sendEscalationMatrixToProjectGroup(projectId: any): Promise<boolean> {
  try {
    const project = await Project.findById(projectId).populate('customerId');
    if (!project) return false;
    if (project.escalationMatrixSent) {
      console.log(`[EscalationMatrix] Already dispatched for project ${project.projectId}, skipping.`);
      return true;
    }

    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;
    if (!inviteTarget) {
      console.warn(`[EscalationMatrix] No WhatsApp group target configured for ${project.projectId}`);
      return false;
    }

    const customer = project.customerId as any;
    const customerName = customer?.fullName || 'Valued Client';

    // Locate the Customer Concern Escalation Matrix image across all standard locations
    const candidatePaths = [
      path.resolve(__dirname, '../../../src/assets/escalation_matrix.jpg'),
      path.resolve(__dirname, '../../assets/escalation_matrix.jpg'),
      path.resolve(__dirname, '../../../uploads/assets/escalation_matrix.jpg'),
      path.resolve(process.cwd(), 'src/assets/escalation_matrix.jpg'),
      path.resolve(process.cwd(), 'backend/src/assets/escalation_matrix.jpg'),
      path.resolve(process.cwd(), 'uploads/assets/escalation_matrix.jpg'),
      path.resolve(process.cwd(), 'backend/uploads/assets/escalation_matrix.jpg'),
    ];

    let imagePath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        imagePath = p;
        break;
      }
    }

    if (!imagePath) {
      console.error('[EscalationMatrix] Escalation matrix image file not found in any candidate path.');
      return false;
    }

    const matrixCaption = `*Alpha Elevators - Customer Concern Escalation Matrix* 📞\n\nDear ${customerName},\nThank you for your advance payment confirmation. For your complete peace of mind and transparent project execution, please find our official Customer Concern Escalation Matrix attached above.\n\n• *Step 1 (Customer Relationship Manager):* Renuka (+91 93848 20044 | crm@alphaelevators.in) - TAT: Within 24 Hours\n• *Step 2 (Technical Incharge):* Sundram (+91 80560 41386 | sundaram@alphaelevators.in) - TAT: Within 24-48 Hours\n• *Step 3 (Technical Manager):* Kishore (+91 93848 20214 | kishore@alphaelevators.in) - TAT: Within 48 Hours\n• *Step 4 (Operational Head):* Abeal (+91 93848 20499 | abeal@alphaelevators.in) - TAT: Within 48 Hours\n\nKindly follow the escalation process step by step to ensure timely resolution of your concern.\n\nThank you for choosing Alpha Elevators!`;

    const botStatus = whatsAppWebBot.getStatus();
    let sentSuccess = false;
    let messageId: string | undefined;

    if (botStatus.isConnected) {
      console.log(`[EscalationMatrix] Dispatching Escalation Matrix image to group ${inviteTarget} via WhatsApp Web Bot...`);
      const botRes = await whatsAppWebBot.sendDocumentToGroup(
        inviteTarget,
        imagePath,
        'Customer-Concern-Escalation-Matrix.jpg',
        matrixCaption
      );
      if (botRes.success) {
        sentSuccess = true;
        messageId = botRes.messageId;
      } else {
        console.warn('[EscalationMatrix] Bot dispatch notice:', botRes.error);
      }
    }

    // Fallback to WATI group message if Web Bot not connected or failed
    if (!sentSuccess) {
      try {
        console.log(`[EscalationMatrix] Dispatching Escalation Matrix notification to group via WATI...`);
        const watiRes = await watiService.sendGroupText({
          target: inviteTarget,
          targetType: 'GROUP',
          text: matrixCaption,
        });
        if (watiRes.success) {
          sentSuccess = true;
          messageId = watiRes.messageId;
        }
      } catch (wErr: any) {
        console.error('[EscalationMatrix] WATI group dispatch error:', wErr.message);
      }
    }

    if (sentSuccess) {
      project.escalationMatrixSent = true;
      project.escalationMatrixSentAt = new Date();
      await project.save();

      await WhatsAppMessageLog.create({
        projectId: project._id,
        groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
        messageText: `[CUSTOMER CONCERN ESCALATION MATRIX DISPATCHED]:\n${matrixCaption}`,
        messageType: 'image',
        scheduledAt: new Date(),
        attemptedAt: new Date(),
        sentAt: new Date(),
        providerMessageId: messageId,
        status: 'SENT',
        attemptCount: 1,
        isDryRun: false,
      });

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'WHATSAPP_SENT',
        description: `Customer Concern Escalation Matrix image dispatched automatically to WhatsApp group (${project.whatsappGroupName || inviteTarget})`,
      });

      console.log(`[EscalationMatrix] Successfully posted Customer Concern Escalation Matrix for project ${project.projectId}`);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('[EscalationMatrix] Error sending escalation matrix:', err);
    return false;
  }
}

/**
 * Schedules Escalation Matrix dispatch 30 minutes after advance payment is recorded
 */
export async function scheduleEscalationMatrixDispatch(project: any): Promise<void> {
  try {
    const scheduledAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    project.escalationMatrixScheduledAt = scheduledAt;
    project.escalationMatrixSent = false;
    await project.save();

    console.log(`[EscalationMatrix] Scheduled 30-minute escalation matrix auto-dispatch for ${project.projectId} at ${scheduledAt.toISOString()}`);

    // Set in-process timeout for exact 30-minute execution
    setTimeout(async () => {
      try {
        await sendEscalationMatrixToProjectGroup(project._id);
      } catch (tErr: any) {
        console.error('[EscalationMatrix] Timer execution error:', tErr.message);
      }
    }, 30 * 60 * 1000);
  } catch (err: any) {
    console.error('[EscalationMatrix] Error scheduling escalation matrix:', err);
  }
}

/**
 * Background processor that sends any due escalation matrices (checked every 15 minutes)
 */
export async function processDueEscalationMatrixUpdates(): Promise<void> {
  try {
    const now = new Date();
    const dueProjects = await Project.find({
      escalationMatrixScheduledAt: { $lte: now },
      escalationMatrixSent: { $ne: true },
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
    });

    for (const project of dueProjects) {
      await sendEscalationMatrixToProjectGroup(project._id);
    }
  } catch (err: any) {
    console.error('[EscalationMatrix] Error in processDueEscalationMatrixUpdates:', err);
  }
}

/**
 * Dismisses pending "Update Schedule Date" reminders for a project once Site Visit schedule date is set.
 */
export async function dismissScheduleDateRemindersForProject(projectId: any): Promise<void> {
  try {
    await Reminder.updateMany(
      {
        relatedProjectId: projectId,
        status: 'PENDING',
        title: { $regex: /Update Schedule Date|Schedule Site Visit/i },
      },
      { status: 'DISMISSED' }
    );
  } catch (err: any) {
    console.error('[Scheduler] Error dismissing schedule date reminders:', err);
  }
}

/**
 * Checks for projects where Advance Payment Received executedDate is set,
 * but Site Visit scheduleDate is not set. Sends/creates a reminder for CRM & Admin
 * every 3 hours until the schedule date is updated.
 */
export async function checkScheduleDateReminders(): Promise<void> {
  try {
    const now = new Date();
    const projects = await Project.find({
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
    });

    const notifyUsers = await User.find({
      role: { $in: ['CRM', 'ADMIN'] },
      isActive: { $ne: false },
    });
    if (!notifyUsers || notifyUsers.length === 0) return;

    for (const project of projects) {
      if (!project.stageDates) continue;

      const paymentStage = project.stageDates.get('PAYMENT_RECEIVED');
      const siteVisitStage = project.stageDates.get('SITE_MEASUREMENT');

      const isAdvanceExecuted = paymentStage && paymentStage.executedDate;
      const isSiteVisitScheduled = siteVisitStage && siteVisitStage.scheduleDate;

      if (isAdvanceExecuted && !isSiteVisitScheduled) {
        let shouldDispatchWhatsApp = false;
        for (const user of notifyUsers) {
          const lastReminder = await Reminder.findOne({
            userId: user._id,
            relatedProjectId: project._id,
            title: { $regex: /Update Schedule Date|Schedule Site Visit/i },
          }).sort({ createdAt: -1 });

          const threeHoursMs = 3 * 60 * 60 * 1000;
          if (!lastReminder || now.getTime() - new Date(lastReminder.createdAt).getTime() >= threeHoursMs) {
            await Reminder.create({
              userId: user._id,
              title: `Schedule Site Visit - ${project.projectName}`,
              notes: `Reminder: Please update the Site Visit (PM) schedule date & time for project ${project.projectName}. Advance payment has been received.`,
              dueAt: now,
              relatedProjectId: project._id,
              status: 'PENDING',
            });
            console.log(`[Scheduler] Dispatched 3-hour schedule date update reminder for ${user.role} (${user.name}) on project ${project.projectName}`);
            shouldDispatchWhatsApp = true;
          }
        }

        // When reminder is triggered/due, also dispatch 1-to-1 WhatsApp messages to CRM, Admin, and Connected Bot Number
        if (shouldDispatchWhatsApp) {
          await dispatchSiteVisitWhatsAppReminders(project._id, undefined, '3-HOUR_RECURRING');
        }
      } else if (isSiteVisitScheduled) {
        await dismissScheduleDateRemindersForProject(project._id);
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Error checking schedule date reminders:', err);
  }
}

/**
 * Initializes server-side scheduler (runs every morning at 09:00, with a periodic 15-minute check)
 */
export function initScheduler(): void {
  console.log('[Scheduler] Initializing Alpha Elevators WhatsApp automation scheduler...');

  // Standard production schedule: Runs every day at 09:00 AM Asia/Kolkata
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('[Scheduler] Running daily 09:00 AM WhatsApp automation cycle...');
      await processDueWhatsAppUpdates();
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // Periodic heartbeat: Checks every 15 minutes for any manually triggered, scheduled, or newly un-postponed updates, plus 3-hour CRM reminders and due escalation matrices
  cron.schedule('*/15 * * * *', async () => {
    await processDueWhatsAppUpdates();
    await checkScheduleDateReminders();
    await processDueEscalationMatrixUpdates();
  });

  // Initial check on server start
  checkScheduleDateReminders().catch((err) => console.error('[Scheduler] Initial checkScheduleDateReminders error:', err));
  processDueEscalationMatrixUpdates().catch((err) => console.error('[Scheduler] Initial processDueEscalationMatrixUpdates error:', err));

  console.log('[Scheduler] Daily 09:00 AM IST & 15-minute heartbeat scheduler active.');
}
