import cron from 'node-cron';
import { Project, Customer, WhatsAppMessage, WhatsAppTemplate, IProject, WhatsAppChannel, User, Reminder } from '../../models';
import { whatsappService } from '../whatsapp';
import { logProjectActivity } from '../activity/activityService';

let isJobRunning = false;

// Map Project Status to Approved WhatsApp Template Name
export const STAGE_TEMPLATE_MAP: Record<string, string> = {
  PAYMENT_RECEIVED: 'PAYMENT_CONFIRMATION',
  SITE_MEASUREMENT: 'SITE_MEASUREMENT',
  DESIGN: 'DESIGN_UPDATE',
  CUSTOMER_APPROVAL: 'CUSTOMER_APPROVAL',
  ENGINEERING: 'ENGINEERING_UPDATE',
  MANUFACTURING: 'MANUFACTURING_UPDATE',
  QUALITY_CHECK: 'QUALITY_CHECK',
  DISPATCH: 'DISPATCH_UPDATE',
  DELIVERY: 'DELIVERY_UPDATE',
  INSTALLATION: 'INSTALLATION_UPDATE',
  TESTING: 'PROGRESS_UPDATE',
  COMPLETED: 'PROJECT_COMPLETED',
};

// Map current stage to Next Milestone description
export const STAGE_NEXT_MILESTONE_MAP: Record<string, string> = {
  PAYMENT_RECEIVED: 'Site Measurement & Shaft Inspection',
  SITE_MEASUREMENT: '3D Cabin Design & Customer Approval',
  DESIGN: 'Engineering Drawings & Component Planning',
  CUSTOMER_APPROVAL: 'Factory Fabrication & Production Scheduling',
  ENGINEERING: 'Guide Rail & Traction Motor Manufacturing',
  MANUFACTURING: 'Factory Quality Inspection & Testing',
  QUALITY_CHECK: 'Safe Crating & Transport Dispatch',
  DISPATCH: 'Site Delivery & Material Inspection',
  DELIVERY: 'Site Rigging & Mechanical Installation',
  INSTALLATION: 'Safety Testing & Electrical Commissioning',
  TESTING: 'Final Handover & Client Certification',
  COMPLETED: 'Annual Maintenance Service Kickoff',
};

/**
 * Formats a date as YYYY-MM-DD for idempotency tracking
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculates next update date given frequency days
 */
export function calculateNextUpdateDate(days: number = 20, fromDate: Date = new Date()): Date {
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + days);
  // Default to 09:00 AM local time
  nextDate.setHours(9, 0, 0, 0);
  return nextDate;
}

/**
 * Core automation processor: checks and executes due WhatsApp updates
 */
export async function processDueWhatsAppUpdates(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: any[];
}> {
  if (isJobRunning) {
    console.log('[Scheduler] Previous execution still active. Skipping concurrent cycle.');
    return { processed: 0, sent: 0, skipped: 0, failed: 0, details: [] };
  }

  isJobRunning = true;
  const now = new Date();
  const results: any[] = [];
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    // 1. Find eligible projects
    const dueProjects = await Project.find({
      automationEnabled: true,
      whatsappGroupId: { $exists: true, $ne: '' },
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
      $or: [
        { nextUpdateAt: { $lte: now } },
        { nextUpdateAt: { $exists: false } },
        { nextUpdateAt: null },
      ],
    }).populate('customerId');

    console.log(`[Scheduler] Evaluated ${dueProjects.length} candidate projects due for WhatsApp update at ${now.toISOString()}`);

    for (const project of dueProjects) {
      const customer = project.customerId as any;

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

      // 2. Determine appropriate template
      const targetTemplateName = STAGE_TEMPLATE_MAP[project.projectStatus] || 'PROGRESS_UPDATE';

      // Verify template is approved in CRM
      const approvedTemplate = await WhatsAppTemplate.findOne({
        templateName: targetTemplateName,
        templateStatus: 'APPROVED',
      });

      if (!approvedTemplate) {
        console.warn(`[Scheduler] Template ${targetTemplateName} is not marked APPROVED in CRM. Skipping dispatch.`);
        skippedCount++;
        results.push({
          projectId: project.projectId,
          status: 'SKIPPED',
          reason: `Template ${targetTemplateName} is not approved`,
        });
        continue;
      }

      // 3. Build Idempotency Key: `${projectId}_${cycleDate}_${templateName}`
      const dateKey = formatDateKey(now);
      const idempotencyKey = `${project.projectId}_${dateKey}_${targetTemplateName}`;

      // 4. Check for duplicate send in this update cycle
      const existingSuccess = await WhatsAppMessage.findOne({
        idempotencyKey,
        status: { $in: ['SENT', 'DELIVERED', 'READ'] },
      });

      if (existingSuccess) {
        console.log(`[Scheduler] Idempotency protected: Project ${project.projectId} already received update for cycle ${dateKey}.`);
        skippedCount++;

        // Advance nextUpdateAt if stuck
        project.nextUpdateAt = calculateNextUpdateDate(project.updateFrequencyDays || 20, now);
        await project.save();

        results.push({
          projectId: project.projectId,
          status: 'IDEMPOTENT_SKIPPED',
          reason: 'Already sent successfully in this cycle',
        });
        continue;
      }

      // 5. Construct Template Variables
      const stageNameFormatted = project.projectStatus.replace(/_/g, ' ');
      const nextMilestone = STAGE_NEXT_MILESTONE_MAP[project.projectStatus] || 'Next milestone in progress';

      const variableValues: Record<string, string> = {
        customer_name: customer.fullName || 'Valued Client',
        project_name: project.projectName || `${customer.fullName} Residence`,
        project_stage: stageNameFormatted,
        next_milestone: nextMilestone,
        lift_model: project.liftModel || 'Alpha EV',
      };

      const components = [
        {
          type: 'body' as const,
          parameters: [
            { type: 'text' as const, text: variableValues.customer_name },
            { type: 'text' as const, text: variableValues.project_name },
            { type: 'text' as const, text: variableValues.project_stage },
            { type: 'text' as const, text: variableValues.next_milestone },
          ],
        },
      ];

      // Formulate readable text for message record
      const readableContent = `Hello ${variableValues.customer_name},\n\nProject Update — ${variableValues.project_name}\n\nCurrent Stage: ${variableValues.project_stage}\nNext Milestone: ${variableValues.next_milestone}\n\nWe will continue to keep you updated.\nThank you,\nAlpha Elevators`;

      // 6. Record message as SENDING
      const messageDoc = await WhatsAppMessage.create({
        projectId: project._id,
        projectCode: project.projectId,
        customerId: customer._id,
        customerName: customer.fullName,
        groupId: project.whatsappGroupId,
        templateName: targetTemplateName,
        messageType: 'template',
        recipientType: 'group',
        direction: 'OUTGOING',
        messageContent: readableContent,
        status: 'SENDING',
        isAutomated: true,
        idempotencyKey,
        variablesPayload: variableValues,
      });

      // 7. Dispatch via WhatsApp Service
      const sendResult = await whatsappService.sendGroupTemplateMessage({
        recipientType: 'group',
        to: project.whatsappGroupId!,
        templateName: targetTemplateName,
        languageCode: approvedTemplate.templateLanguage || 'en_US',
        components,
      });

      if (sendResult.success) {
        sentCount++;
        messageDoc.status = 'SENT';
        messageDoc.metaMessageId = sendResult.messageId;
        messageDoc.sentAt = new Date();
        messageDoc.rawResponse = sendResult.metaResponse;
        await messageDoc.save();

        // 8. Update Project dates
        project.lastUpdateAt = new Date();
        project.nextUpdateAt = calculateNextUpdateDate(project.updateFrequencyDays || 20, now);
        project.postponedUntil = undefined;
        await project.save();

        // 9. Update WhatsAppChannel lastUpdateDate
        await WhatsAppChannel.findOneAndUpdate(
          { whatsappGroupId: project.whatsappGroupId },
          { lastUpdateDate: new Date(), nextUpdateDate: project.nextUpdateAt }
        );

        // 10. Log Activity
        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_SENT',
          description: `Automated WhatsApp update sent to group (${project.whatsappGroupName || project.whatsappGroupId}) for stage ${project.projectStatus}. Template: ${targetTemplateName}`,
          metadata: {
            metaMessageId: sendResult.messageId,
            templateName: targetTemplateName,
            isTestMode: sendResult.isTestMode,
          },
        });

        results.push({
          projectId: project.projectId,
          status: 'SENT',
          metaMessageId: sendResult.messageId,
          template: targetTemplateName,
        });
      } else {
        failedCount++;
        messageDoc.status = 'FAILED';
        messageDoc.failedAt = new Date();
        messageDoc.errorCode = 'META_DISPATCH_ERROR';
        messageDoc.errorMessage = sendResult.error || 'Failed to dispatch via Meta API';
        messageDoc.rawResponse = sendResult.metaResponse;
        messageDoc.retryCount = (messageDoc.retryCount || 0) + 1;
        messageDoc.lastRetryAt = new Date();
        await messageDoc.save();

        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_FAILED',
          description: `Failed to dispatch automated WhatsApp update: ${sendResult.error}`,
          metadata: { templateName: targetTemplateName, error: sendResult.error },
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
    skipped: skippedCount,
    failed: failedCount,
    details: results,
  };
}

/**
 * Triggers initial reminder for CRM users when Advance Payment Received is marked executed,
 * provided Site Visit schedule date is not yet fixed.
 */
export async function triggerAdvancePaymentReminderForCRM(projectId: any): Promise<void> {
  try {
    const project = await Project.findById(projectId);
    if (!project || !project.stageDates) return;

    const paymentStage = project.stageDates.get('PAYMENT_RECEIVED');
    const siteVisitStage = project.stageDates.get('SITE_MEASUREMENT');

    const isAdvanceExecuted = paymentStage && paymentStage.executedDate;
    const isSiteVisitScheduled = siteVisitStage && siteVisitStage.scheduleDate;

    if (isAdvanceExecuted && !isSiteVisitScheduled) {
      const crmUsers = await User.find({ role: 'CRM', isActive: { $ne: false } });
      const now = new Date();
      for (const crmUser of crmUsers) {
        const existing = await Reminder.findOne({
          userId: crmUser._id,
          relatedProjectId: project._id,
          status: 'PENDING',
          title: { $regex: /Update Schedule Date/i },
        });

        if (!existing) {
          await Reminder.create({
            userId: crmUser._id,
            title: `Update Schedule Date - ${project.projectName}`,
            notes: `Advance payment received has been recorded. Please update the schedule date (Site Visit) for ${project.projectName}.`,
            dueAt: now,
            relatedProjectId: project._id,
            status: 'PENDING',
          });
          console.log(`[Scheduler] Dispatched initial schedule date update reminder for CRM (${crmUser.name}) on project ${project.projectName}`);
        }
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Error triggering advance payment reminder for CRM:', err);
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
        title: { $regex: /Update Schedule Date/i },
      },
      { status: 'DISMISSED' }
    );
  } catch (err: any) {
    console.error('[Scheduler] Error dismissing schedule date reminders:', err);
  }
}

/**
 * Checks for projects where Advance Payment Received executedDate is set,
 * but Site Visit scheduleDate is not set. Sends/creates a reminder for CRM
 * every 3 hours until the schedule date is updated.
 */
export async function checkScheduleDateReminders(): Promise<void> {
  try {
    const now = new Date();
    const projects = await Project.find({
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
    });

    const crmUsers = await User.find({ role: 'CRM', isActive: { $ne: false } });
    if (!crmUsers || crmUsers.length === 0) return;

    for (const project of projects) {
      if (!project.stageDates) continue;

      const paymentStage = project.stageDates.get('PAYMENT_RECEIVED');
      const siteVisitStage = project.stageDates.get('SITE_MEASUREMENT');

      const isAdvanceExecuted = paymentStage && paymentStage.executedDate;
      const isSiteVisitScheduled = siteVisitStage && siteVisitStage.scheduleDate;

      if (isAdvanceExecuted && !isSiteVisitScheduled) {
        for (const crmUser of crmUsers) {
          const lastReminder = await Reminder.findOne({
            userId: crmUser._id,
            relatedProjectId: project._id,
            title: { $regex: /Update Schedule Date/i },
          }).sort({ createdAt: -1 });

          const threeHoursMs = 3 * 60 * 60 * 1000;
          if (!lastReminder || (now.getTime() - new Date(lastReminder.createdAt).getTime()) >= threeHoursMs) {
            await Reminder.create({
              userId: crmUser._id,
              title: `Update Schedule Date - ${project.projectName}`,
              notes: `Reminder: Please update the schedule date for project ${project.projectName}. Advance payment has been received.`,
              dueAt: now,
              relatedProjectId: project._id,
              status: 'PENDING',
            });
            console.log(`[Scheduler] Dispatched 3-hour schedule date update reminder for CRM (${crmUser.name}) on project ${project.projectName}`);
          }
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

  // Periodic heartbeat: Checks every 15 minutes for any manually triggered, scheduled, or newly un-postponed updates, plus 3-hour CRM reminders
  cron.schedule('*/15 * * * *', async () => {
    await processDueWhatsAppUpdates();
    await checkScheduleDateReminders();
  });

  // Initial check on server start
  checkScheduleDateReminders().catch((err) => console.error('[Scheduler] Initial checkScheduleDateReminders error:', err));

  console.log('[Scheduler] Daily 09:00 AM IST & 15-minute heartbeat scheduler active.');
}
