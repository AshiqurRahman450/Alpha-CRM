import { Router, Response, Request, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import * as XLSX from 'xlsx';
import {
  Project,
  Customer,
  Payment,
  WhatsAppChannel,
  WhatsAppMessage,
  ProjectActivity,
  ProjectStatus,
  WhatsAppMessageLog,
  WhatsAppTemplate,
  User,
} from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logProjectActivity } from '../services/activity/activityService';
import {
  calculateNextUpdateDate,
  triggerAdvancePaymentReminderForCRM,
  triggerAdvancePaymentReminderForCRMAndAdmin,
  dispatchSiteVisitWhatsAppReminders,
  dismissScheduleDateRemindersForProject,
  generateProjectUpdateText,
  APPROVED_MILESTONE_TEMPLATES,
  STAGE_TEMPLATE_MAP,
  POST_PRODUCTION_PAYMENT_STAGES,
  handleDrawingAndCabinApprovedWorkflow,
} from '../services/scheduler/schedulerService';
import { whatsAppWebBot, watiService } from '../services/whatsapp';
import {
  generateInitialSchedule,
  cascadeScheduleUpdates,
  formatDateDisplay,
  parseDateString,
  toWorkingDay,
  formatDateISO,
} from '../services/installation/workingDaysService';
import { DEFAULT_INSTALLATION_STAGES } from '../models/Project';
import { config } from '../config';
import { getNextProjectId } from '../utils/idGenerators';
import { parseAndImportExcel, generateImportTemplateBuffer } from '../services/import/excelImportService';
import { getTlRegexForUser, isProjectAccessibleByTl, isTlUser } from '../utils/tlAuth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists reliably across local, development, and VPS environments
export function ensureUploadsDir(): string {
  const candidateDirs = [
    path.resolve(__dirname, '../../uploads'),
    path.resolve(__dirname, '../uploads'),
    path.resolve(process.cwd(), 'backend/uploads'),
    path.resolve(process.cwd(), 'uploads'),
  ];

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch {}
  }

  const fallbackDir = path.resolve(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
  } catch {}
  return fallbackDir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const targetDir = ensureUploadsDir();
      cb(null, targetDir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = file.originalname ? path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_') : 'drawing';
    const ext = path.extname(safeName) || '.pdf';
    cb(null, `${req.params.id}-drawing-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const handleDrawingUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single('drawing')(req, res, (err: any) => {
    if (err) {
      console.error('[DrawingUpload] Multer error:', err);
      const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        success: false,
        message: isTooLarge
          ? 'Drawing file is too large (max 50MB allowed)'
          : err.message || 'File upload failed',
      });
    }
    next();
  });
};

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/**
 * Dispatches a 1-to-1 WhatsApp message to the assigned BDM
 * requesting Drawing and Cabin Design Approval.
 * Prioritizes connected WhatsApp Web Bot (zero 24-hour Meta limitation)
/**
 * Helper: Automatically dispatch 1-to-1 WhatsApp notification to assigned BDM
 * Primary: Dispatched directly via WhatsApp Web Bot (without WATI dependency).
 * Fallback: Graceful fallback to WATI if Web Bot is disconnected.
 */
async function sendBdmApprovalNotification(project: any, currentUserId?: any, currentUserName?: string, note?: string) {
  try {
    const customer = (project.customerId as any) || (await Customer.findById(project.customerId));
    let bdmPhone = project.bdmPhone || customer?.bdmPhone;
    let bdmName = 'BDM';
    const bdmId = project.bdmId || customer?.bdmId;

    if (bdmId) {
      const bdmUser = await User.findById(bdmId);
      if (bdmUser) {
        bdmName = bdmUser.name || 'BDM';
        if (!bdmPhone && bdmUser.phone) {
          bdmPhone = bdmUser.phone;
        }
      }
    }

    if (!bdmPhone) {
      console.log(`[BDMApproval] Project ${project.projectId} has no BDM phone configured. Skipping 1-to-1 WhatsApp notification.`);
      return { success: false, reason: 'No BDM phone number configured for this project or customer' };
    }

    const customerName = customer?.fullName || 'Client';
    let bdmMessage = `Hello ${bdmName},\n\n`;
    bdmMessage += `🚨 *Action Required: Drawing and Cabin Design Approval*\n\n`;
    bdmMessage += `• Project: *${project.projectName}* (${project.projectId})\n`;
    bdmMessage += `• Customer: ${customerName}\n`;
    bdmMessage += `• Site Address: ${project.siteAddress || 'Site Location'}\n`;
    bdmMessage += `• Lift Model: ${project.liftModel || 'Alpha Elevator'}\n`;
    bdmMessage += `• Current Stage: *Drawing and Cabin Design Approval*\n\n`;
    bdmMessage += `The drawing and cabin design has been finalized. Please follow up with the client to review and secure their formal design approval so production can begin.\n\n`;
    if (project.drawingUrl) {
      const fullDrawingUrl = project.drawingUrl.startsWith('http')
        ? project.drawingUrl
        : `${config.frontendUrl || 'http://localhost:3000'}${project.drawingUrl}`;
      bdmMessage += `📄 Drawing Link: ${fullDrawingUrl}\n\n`;
    }
    if (note) {
      bdmMessage += `Note: ${note}\n\n`;
    }
    bdmMessage += `Thank you,\nAlpha Elevators CRM`;

    let sentSuccess = false;
    let providerMessageId: string | undefined;
    let usedProvider = 'WhatsApp Bot';
    let sendError: string | undefined;

    const botStatus = whatsAppWebBot.getStatus();

    // 1. Primary: Dispatch directly via WhatsApp Web Bot (Zero WATI dependency)
    if (botStatus.isConnected) {
      console.log(`[BDMApproval] Dispatching 1-to-1 WhatsApp message to BDM ${bdmName} (+${bdmPhone}) via WhatsApp Web Bot`);
      const botRes = await whatsAppWebBot.sendDirectMessage(bdmPhone, bdmMessage);
      if (botRes.success) {
        sentSuccess = true;
        providerMessageId = botRes.messageId;
        usedProvider = 'WhatsApp Bot';
        console.log(`[BDMApproval] 1-to-1 message sent directly to BDM (+${bdmPhone}) via WhatsApp Web Bot! ID: ${botRes.messageId}`);

        // If local drawing file exists, also send the actual drawing attachment directly to BDM!
        if (project.drawingUrl) {
          try {
            const filename = path.basename(project.drawingUrl);
            const candidatePath = path.resolve(__dirname, '../../uploads', filename);
            if (fs.existsSync(candidatePath)) {
              await whatsAppWebBot.sendDirectDocument(
                bdmPhone,
                candidatePath,
                filename,
                `📄 Drawing & Cabin Design Document for ${project.projectName}`
              );
              console.log(`[BDMApproval] Drawing attachment also sent directly to BDM (+${bdmPhone}) via WhatsApp Web Bot!`);
            }
          } catch (fileErr: any) {
            console.warn('[BDMApproval] Notice sending drawing file to BDM via Web Bot:', fileErr.message);
          }
        }
      } else {
        sendError = botRes.error || 'Failed to dispatch via WhatsApp Web Bot';
      }
    } else if (config.wati.dryRun) {
      sentSuccess = true;
      providerMessageId = `DRY_BDM_${Date.now()}`;
      usedProvider = 'Dry-Run Bot';
      console.log(`[BDMApproval] [Dry-Run] 1-to-1 message simulated to BDM ${bdmName} (+${bdmPhone})`);
    } else {
      // Graceful fallback to WATI if Web Bot is not connected
      console.warn(`[BDMApproval] WhatsApp Web Bot not connected (${botStatus.status}). Attempting fallback to WATI...`);
      try {
        const textRes = await watiService.sendGroupText({
          groupId: `BDM_${project.projectId}`,
          customerPhone: bdmPhone,
          contactName: bdmName,
          text: bdmMessage,
          targetType: 'DIRECT',
        });
        if (textRes.success) {
          sentSuccess = true;
          providerMessageId = textRes.messageId;
          usedProvider = 'WATI (Fallback)';
        } else {
          sendError = textRes.error || 'WhatsApp Web Bot is not connected. Scan QR code in WhatsApp settings to enable 1-to-1 bot messaging.';
        }
      } catch (watiErr: any) {
        sendError = 'WhatsApp Web Bot is not connected. Scan QR code in WhatsApp settings to enable 1-to-1 bot messaging.';
      }
    }

    await WhatsAppMessageLog.create({
      projectId: project._id,
      groupId: `BDM_${bdmPhone}`,
      messageText: bdmMessage,
      messageType: 'text',
      scheduledAt: new Date(),
      attemptedAt: new Date(),
      sentAt: sentSuccess ? new Date() : undefined,
      providerMessageId,
      status: sentSuccess ? 'SENT' : 'FAILED',
      lastError: sendError,
      attemptCount: 1,
      isDryRun: !botStatus.isConnected && config.wati.dryRun,
    });

    if (sentSuccess) {
      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'WHATSAPP_SENT',
        description: `1-to-1 WhatsApp approval request sent to BDM ${bdmName} (+${bdmPhone}) via ${usedProvider} for Drawing and Cabin Design Approval.`,
        userId: currentUserId,
        userName: currentUserName,
      });
    }

    return {
      success: sentSuccess,
      provider: usedProvider,
      messageId: providerMessageId,
      error: sendError,
    };
  } catch (err: any) {
    console.error('[BDMApproval] Error sending 1-to-1 message to BDM:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically dispatches the "Site Visit Scheduled" message to customer's WhatsApp group
 * when site visit schedule date is set.
 */
export async function dispatchSiteVisitScheduledMessage(
  project: any,
  scheduleDateVal: string | Date,
  timeVal?: string | null,
  user?: any
): Promise<{ success: boolean; sentViaBot: boolean; formattedDate: string; formattedTime: string; error?: string }> {
  try {
    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;
    if (!inviteTarget) {
      console.log(`[SiteVisitScheduled] No WhatsApp group linked for project ${project.projectId}`);
      return { success: false, sentViaBot: false, formattedDate: '', formattedTime: '', error: 'No WhatsApp group linked' };
    }

    // Format Date: e.g. "16 Nov 2026"
    const d = new Date(scheduleDateVal);
    const formattedDate = !isNaN(d.getTime())
      ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : String(scheduleDateVal);

    // Format Time: e.g. "11:00 AM"
    let formattedTime = timeVal?.trim();
    if (!formattedTime) {
      if (typeof scheduleDateVal === 'string' && scheduleDateVal.includes('T')) {
        const timePart = scheduleDateVal.split('T')[1];
        if (timePart && !timePart.startsWith('00:00')) {
          const [hh, mm] = timePart.split(':');
          const hourNum = parseInt(hh, 10);
          const ampm = hourNum >= 12 ? 'PM' : 'AM';
          const hour12 = hourNum % 12 || 12;
          formattedTime = `${String(hour12).padStart(2, '0')}:${mm.slice(0, 2)} ${ampm}`;
        }
      }
    }
    if (!formattedTime) {
      formattedTime = '11:00 AM';
    }

    // Idempotency check: don't dispatch duplicate message within 15 seconds
    const recentLog = await WhatsAppMessage.findOne({
      projectId: project._id,
      templateName: 'SITE_VISIT_SCHEDULE_PM',
      createdAt: { $gte: new Date(Date.now() - 15000) },
    });
    if (recentLog) {
      return { success: true, sentViaBot: recentLog.status === 'SENT', formattedDate, formattedTime };
    }

    const defaultTemplate = `Dear Sir/Madam,

Your site visit has been scheduled for [Date] at [Time]. Our technical team will visit the site for measurement and inspection.
Kindly ensure site accessibility during the scheduled time.

Regards,
Alpha Elevators Team`;

    const template = await WhatsAppTemplate.findOne({ templateName: 'SITE_VISIT_SCHEDULE_PM', templateStatus: 'APPROVED' });
    let rawText = template?.bodyText || defaultTemplate;
    if (!rawText.includes('Your site visit has been scheduled for')) {
      rawText = defaultTemplate;
    }

    const messageText = rawText
      .replace(/\[Date\]/gi, formattedDate)
      .replace(/\[Time\]/gi, formattedTime);

    const botStatus = whatsAppWebBot.getStatus();
    let sentViaBot = false;
    let providerMsgId = `SV_SCHED_${Date.now()}`;

    if (botStatus.isConnected) {
      const botResult = await whatsAppWebBot.sendMessageToGroup(inviteTarget, messageText);
      if (botResult.success) {
        sentViaBot = true;
        providerMsgId = botResult.messageId || providerMsgId;
      }
    }

    // Record WhatsApp message log
    await WhatsAppMessageLog.create({
      projectId: project._id,
      groupId: inviteTarget,
      messageText,
      messageType: 'text',
      scheduledAt: new Date(),
      attemptedAt: new Date(),
      sentAt: sentViaBot ? new Date() : undefined,
      providerMessageId: providerMsgId,
      status: sentViaBot ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
      attemptCount: 1,
      isDryRun: false,
    });

    // Record WhatsAppMessage for UI
    const customer = (project.customerId as any)?._id ? project.customerId : await Customer.findById(project.customerId);
    await WhatsAppMessage.create({
      projectId: project._id,
      projectCode: project.projectId,
      customerId: project.customerId,
      customerName: customer?.fullName || 'Customer',
      groupId: inviteTarget,
      templateName: 'SITE_VISIT_SCHEDULE_PM',
      messageType: 'template',
      recipientType: 'group',
      direction: 'OUTGOING',
      messageContent: messageText,
      status: sentViaBot ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
      isAutomated: true,
      idempotencyKey: `SV_SCHEDULED_${project.projectId}_${Date.now()}`,
    });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'WHATSAPP_SENT',
      description: `Site visit scheduled notification dispatched to group (${project.whatsappGroupName || inviteTarget}) for ${formattedDate} at ${formattedTime}`,
      userId: user?._id,
      userName: user?.name,
    });
    console.log(`[SiteVisitScheduled] WhatsApp message dispatched for project ${project.projectId}: ${formattedDate} at ${formattedTime}`);

    return { success: true, sentViaBot, formattedDate, formattedTime };
  } catch (err: any) {
    console.error('[SiteVisitScheduled] Failed to dispatch site visit scheduled message:', err);
    return { success: false, sentViaBot: false, formattedDate: '', formattedTime: '', error: err.message };
  }
}

/**
 * Automatically dispatches the "Site Visit Completed" message to customer's WhatsApp group
 * when site measurement is executed.
 */
export async function dispatchSiteVisitCompletedMessage(project: any, user?: any, pdfFilePath?: string) {
  try {
    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;
    if (!inviteTarget) {
      console.log(`[SiteVisitCompleted] No WhatsApp group linked for project ${project.projectId}`);
      return;
    }

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

    const defaultMessage = `Dear Sir/Madam,

We have successfully completed the site visit on the scheduled date and shared the site visit report with you via email.

Kindly review the report and confirm your approval by replying to the email so that we can initiate the drawing process based on the site measurements.

Thank you for your support and cooperation.

Regards,
Alpha Elevators Team`;

    const template = await WhatsAppTemplate.findOne({ templateName: 'SITE_VISIT_COMPLETED', templateStatus: 'APPROVED' });
    let messageText = template?.bodyText || defaultMessage;

    const botStatus = whatsAppWebBot.getStatus();
    let sentViaBot = false;
    let providerMsgId = `SV_${Date.now()}`;

    if (botStatus.isConnected) {
      const botResult = await whatsAppWebBot.sendMessageToGroup(inviteTarget, messageText);
      if (botResult.success) {
        sentViaBot = true;
        providerMsgId = botResult.messageId || providerMsgId;
      }

      // If a PDF report file is provided, send the document directly to the group
      if (pdfFilePath && fs.existsSync(pdfFilePath)) {
        const fileName = path.basename(pdfFilePath);
        const docRes = await whatsAppWebBot.sendDocumentToGroup(
          inviteTarget,
          pdfFilePath,
          fileName,
          `📄 Pre-Production Site Visit Report (${project.projectId})`
        );
        if (docRes.success) {
          console.log(`[SiteVisitCompleted] Site visit PDF document successfully posted to group: ${fileName}`);
        } else {
          console.warn(`[SiteVisitCompleted] Notice sending PDF to group:`, docRes.error);
        }
      }
    }

    // Record WhatsApp message log
    await WhatsAppMessageLog.create({
      projectId: project._id,
      groupId: inviteTarget,
      messageText,
      messageType: 'text',
      scheduledAt: new Date(),
      attemptedAt: new Date(),
      sentAt: sentViaBot ? new Date() : undefined,
      providerMessageId: providerMsgId,
      status: sentViaBot ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
      attemptCount: 1,
      isDryRun: false,
    });

    // Record legacy WhatsAppMessage for UI
    const customer = (project.customerId as any)?._id ? project.customerId : await Customer.findById(project.customerId);
    await WhatsAppMessage.create({
      projectId: project._id,
      projectCode: project.projectId,
      customerId: project.customerId,
      customerName: customer?.fullName || 'Customer',
      groupId: inviteTarget,
      templateName: 'SITE_VISIT_COMPLETED',
      messageType: 'template',
      recipientType: 'group',
      direction: 'OUTGOING',
      messageContent: messageText,
      status: sentViaBot ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
      isAutomated: true,
      idempotencyKey: `SV_COMPLETED_${project.projectId}_${Date.now()}`,
    });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'WHATSAPP_SENT',
      description: `Site visit completed notification${pdfFilePath ? ' & PDF report' : ''} dispatched to group (${project.whatsappGroupName || inviteTarget})`,
      userId: user?._id,
      userName: user?.name,
    });
    console.log(`[SiteVisitCompleted] WhatsApp message dispatched for project ${project.projectId}`);
  } catch (err: any) {
    console.error('[SiteVisitCompleted] Failed to dispatch site visit completed message:', err);
  }
}

export const projectRouter = Router();

/**
 * GET /api/projects/import-template
 * Downloads sample Excel import template with guidance (Public / Pre-auth for direct download)
 */
projectRouter.get('/import-template', async (_req: Request, res: Response) => {
  try {
    const buffer = generateImportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Alpha_CRM_Import_Template.xlsx"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

projectRouter.use(authenticate);

/**
 * POST /api/projects/import-excel
 * Imports customers and elevator projects from an uploaded Excel (.xlsx, .xls) spreadsheet
 */
projectRouter.post('/import-excel', excelUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx, .xls) file' });
    }

    const result = await parseAndImportExcel(req.file.buffer, req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err: any) {
    console.error('[import-excel] Error importing spreadsheet:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to process Excel file' });
  }
});

/**
 * GET /api/projects
 */
projectRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, paymentStatus, search, updateDue, employee } = req.query;
    const query: any = {};
    const andConditions: any[] = [];

    if (req.user?.role === 'BDM') {
      const bdmConditions: any[] = [{ bdmId: req.user._id }];
      if (req.user.name) {
        bdmConditions.push({ assignedEmployee: new RegExp(`^${req.user.name.trim()}$`, 'i') });
      }
      if (req.user.phone) {
        const cleanPhone = req.user.phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          bdmConditions.push({ bdmPhone: new RegExp(cleanPhone) });
        }
      }
      andConditions.push({ $or: bdmConditions });
    }

    if (isTlUser(req.user)) {
      const tlRegex = getTlRegexForUser(req.user);
      if (tlRegex) {
        const custConditions: any[] = [
          { assignedTl: tlRegex },
        ];
        if (req.user?._id) {
          custConditions.push({ assignedTlId: req.user._id });
        }
        const matchingCustomers = await Customer.find({ $or: custConditions }).select('_id').lean();
        const custIds = matchingCustomers.map((c) => c._id);

        const tlConditions: any[] = [
          { assignedTl: tlRegex },
          { customerId: { $in: custIds } },
        ];
        if (req.user?._id) {
          tlConditions.push({ assignedTlId: req.user._id });
        }

        andConditions.push({ $or: tlConditions });
      }
    }

    if (status && typeof status === 'string') {
      if (status.includes(',')) {
        query.projectStatus = { $in: status.split(',') };
      } else if (status === 'HANDOVER') {
        query.projectStatus = { $in: ['TESTING', 'COMPLETED'] };
      } else if (status === 'ACTIVE') {
        query.projectStatus = { $nin: ['TESTING', 'COMPLETED', 'CANCELLED'] };
      } else {
        query.projectStatus = status;
      }
    } else if (req.query.excludeHandover === 'true') {
      query.projectStatus = { $nin: ['TESTING', 'COMPLETED', 'CANCELLED'] };
    }

    if (paymentStatus && typeof paymentStatus === 'string') {
      if (paymentStatus.includes(',')) {
        query.paymentStatus = { $in: paymentStatus.split(',') };
      } else if (paymentStatus === 'AWAITING' || paymentStatus === 'PENDING_PARTIAL') {
        query.paymentStatus = { $in: ['PENDING', 'PARTIAL_PAID'] };
      } else {
        query.paymentStatus = paymentStatus;
      }
    }

    if (req.query.crmRequested === 'true') {
      query['paymentRequest.status'] = 'REQUESTED';
    }

    if (employee && typeof employee === 'string') {
      query.assignedEmployee = employee;
    }

    if (updateDue === 'today') {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query.automationEnabled = true;
      query.whatsappGroupId = { $exists: true, $ne: '' };
      query.projectStatus = { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] };
      andConditions.push({
        $or: [
          { nextUpdateAt: { $lte: endOfDay } },
          { nextUpdateAt: { $exists: false } },
          { nextUpdateAt: null },
        ],
      });
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      andConditions.push({
        $or: [
          { projectName: searchRegex },
          { projectId: searchRegex },
          { liftModel: searchRegex },
          { siteAddress: searchRegex },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    let projects = await Project.find(query).populate('customerId').sort({ createdAt: -1 });

    if (isTlUser(req.user)) {
      projects = projects.filter((p) => isProjectAccessibleByTl(p, req.user));
    }
    return res.json({ success: true, count: projects.length, data: projects });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects
 */
projectRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      projectName,
      siteAddress,
      googleMapsLink,
      liftModel,
      liftType,
      numberOfFloors,
      shaftModel,
      liftAmount = 0,
      liftBaseAmount,
      liftDiscountAmount,
      shaftAmount = 0,
      shaftBaseAmount,
      shaftDiscountAmount,
      orderValue,
      advancePercentage,
      advanceAmount: manualAdvanceAmount,
      productionPaymentPercent = 40,
      readinessNotificationPercent = 20,
      dispatchMaterialsPercent = 5,
      afterInstallationPercent = 5,
      expectedDeliveryDate,
      assignedEmployee,
      projectManager,
      updateFrequencyDays = 20,
      whatsappGroupId,
      notes,
    } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const effectiveAddress = (siteAddress || googleMapsLink || customer.address || '').trim();

    if (!customerId || !projectName || !effectiveAddress || !orderValue) {
      return res.status(400).json({
        success: false,
        message: 'Customer, project name, site address or map link, and order value are required',
      });
    }

    const resolvedGoogleMapsLink = (
      googleMapsLink ||
      customer.googleMapsLink ||
      (effectiveAddress.startsWith('http') || effectiveAddress.includes('maps') ? effectiveAddress : undefined)
    )?.trim();

    const projectId = await getNextProjectId();

    const numOrderValue = Number(orderValue);
    let advanceAmount = 0;
    let numAdvPct = 0;

    if (manualAdvanceAmount !== undefined && manualAdvanceAmount !== '' && manualAdvanceAmount !== null) {
      advanceAmount = Number(manualAdvanceAmount);
      numAdvPct = numOrderValue > 0 ? Math.round((advanceAmount / numOrderValue) * 100) : 0;
    } else if (advancePercentage !== undefined && advancePercentage !== '' && advancePercentage !== null) {
      numAdvPct = Number(advancePercentage);
      advanceAmount = Math.round((numOrderValue * numAdvPct) / 100);
    }

    // Next update date defaulted to frequency days from now
    const nextUpdate = calculateNextUpdateDate(Number(updateFrequencyDays), new Date());

    const newProject = await Project.create({
      projectId,
      customerId: customer._id,
      customerCode: customer.customerId,
      projectName: projectName.trim(),
      siteAddress: effectiveAddress,
      googleMapsLink: resolvedGoogleMapsLink,
      liftModel: liftModel || 'Hydraulic Home Series',
      liftType: liftType || 'Home Lift',
      numberOfFloors,
      shaftModel: shaftModel?.trim(),
      liftAmount: Number(liftAmount),
      liftBaseAmount: liftBaseAmount !== undefined && liftBaseAmount !== '' ? Number(liftBaseAmount) : undefined,
      liftDiscountAmount: liftDiscountAmount !== undefined && liftDiscountAmount !== '' ? Number(liftDiscountAmount) : undefined,
      shaftAmount: Number(shaftAmount),
      shaftBaseAmount: shaftBaseAmount !== undefined && shaftBaseAmount !== '' ? Number(shaftBaseAmount) : undefined,
      shaftDiscountAmount: shaftDiscountAmount !== undefined && shaftDiscountAmount !== '' ? Number(shaftDiscountAmount) : undefined,
      orderValue: numOrderValue,
      advancePercentage: numAdvPct,
      productionPaymentPercent: Number(productionPaymentPercent),
      readinessNotificationPercent: Number(readinessNotificationPercent),
      dispatchMaterialsPercent: Number(dispatchMaterialsPercent),
      afterInstallationPercent: Number(afterInstallationPercent),
      advanceAmount,
      totalPaid: 0,
      balanceAmount: numOrderValue,
      paymentStatus: 'PENDING',
      orderDate: new Date(),
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 120);
        return d;
      })(),
      projectStatus: 'PAYMENT_RECEIVED',
      assignedEmployee: assignedEmployee || req.user?.name,
      projectManager,
      bdmId: customer.bdmId,
      bdmPhone: customer.bdmPhone,
      assignedTl: customer.assignedTl,
      assignedTlId: customer.assignedTlId,
      notes,
      whatsappGroupId: whatsappGroupId ? whatsappGroupId.trim() : undefined,
      whatsappGroupName: whatsappGroupId ? `${projectName.trim()} — Alpha Updates` : undefined,
      automationEnabled: true,
      updateFrequencyDays: Number(updateFrequencyDays),
      nextUpdateAt: nextUpdate,
    });

    // Link WhatsApp Channel if provided
    if (whatsappGroupId) {
      await WhatsAppChannel.create({
        whatsappGroupId: whatsappGroupId.trim(),
        groupName: `${projectName.trim()} — Alpha Updates`,
        projectId: newProject._id,
        projectCode: projectId,
        customerId: customer._id,
        customerName: customer.fullName,
        groupStatus: 'ACTIVE',
        automationEnabled: true,
        updateFrequencyDays: Number(updateFrequencyDays),
        nextUpdateDate: nextUpdate,
        participants: [
          { phoneNumber: customer.phoneNumber, name: customer.fullName, role: 'MEMBER' },
        ],
      });
    }

    // Log Activity
    await logProjectActivity({
      projectId: newProject._id,
      projectCode: projectId,
      type: 'STATUS_CHANGE',
      description: `Project ${projectId} created. 30% advance received. Initial status set to PAYMENT_RECEIVED.`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.status(201).json({ success: true, data: newProject });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/projects/export-excel
 * Exports raw data in Excel (.xlsx) format: Customer Name, Project Code, Stage, Schedule Date, Executed Date
 */
projectRouter.get('/export-excel', async (req: AuthRequest, res: Response) => {
  try {
    const { status, paymentStatus, search, employee } = req.query;
    const query: any = {};
    const andConditions: any[] = [];

    if (req.user?.role === 'BDM') {
      const bdmConditions: any[] = [{ bdmId: req.user._id }];
      if (req.user.name) {
        bdmConditions.push({ assignedEmployee: new RegExp(`^${req.user.name.trim()}$`, 'i') });
      }
      if (req.user.phone) {
        const cleanPhone = req.user.phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          bdmConditions.push({ bdmPhone: new RegExp(cleanPhone) });
        }
      }
      andConditions.push({ $or: bdmConditions });
    }

    if (isTlUser(req.user)) {
      const tlRegex = getTlRegexForUser(req.user);
      if (tlRegex) {
        const custConditions: any[] = [
          { assignedTl: tlRegex },
        ];
        if (req.user?._id) {
          custConditions.push({ assignedTlId: req.user._id });
        }
        const matchingCustomers = await Customer.find({ $or: custConditions }).select('_id').lean();
        const custIds = matchingCustomers.map((c) => c._id);

        const tlConditions: any[] = [
          { assignedTl: tlRegex },
          { customerId: { $in: custIds } },
        ];
        if (req.user?._id) {
          tlConditions.push({ assignedTlId: req.user._id });
        }

        andConditions.push({ $or: tlConditions });
      }
    }

    if (status && typeof status === 'string') {
      if (status.includes(',')) {
        const statuses = status.split(',');
        const expandedStatuses = new Set<string>();
        statuses.forEach((st) => {
          const trimmed = st.trim();
          expandedStatuses.add(trimmed);
          if (trimmed === 'DISPATCH' || trimmed === 'MATERIAL_DISPATCHED') {
            expandedStatuses.add('DISPATCH');
            expandedStatuses.add('MATERIAL_DISPATCHED');
          }
          if (trimmed === 'MANUFACTURING' || trimmed === 'PRODUCTION_IN_PROGRESS') {
            expandedStatuses.add('MANUFACTURING');
            expandedStatuses.add('PRODUCTION_IN_PROGRESS');
          }
          if (trimmed === 'MATERIAL_DELIVERY') {
            expandedStatuses.add('MATERIAL_DELIVERY');
          }
        });
        query.projectStatus = { $in: Array.from(expandedStatuses) };
      } else if (status === 'HANDOVER') {
        query.projectStatus = { $in: ['TESTING', 'COMPLETED'] };
      } else if (status === 'ACTIVE') {
        query.projectStatus = { $nin: ['TESTING', 'COMPLETED', 'CANCELLED'] };
      } else if (status === 'DISPATCH' || status === 'MATERIAL_DISPATCHED') {
        query.projectStatus = { $in: ['DISPATCH', 'MATERIAL_DISPATCHED'] };
      } else if (status === 'MANUFACTURING' || status === 'PRODUCTION_IN_PROGRESS') {
        query.projectStatus = { $in: ['MANUFACTURING', 'PRODUCTION_IN_PROGRESS'] };
      } else {
        query.projectStatus = status;
      }
    } else if (req.query.excludeHandover === 'true') {
      query.projectStatus = { $nin: ['TESTING', 'COMPLETED', 'CANCELLED'] };
    }

    if (paymentStatus && typeof paymentStatus === 'string') {
      if (paymentStatus.includes(',')) {
        query.paymentStatus = { $in: paymentStatus.split(',') };
      } else if (paymentStatus === 'AWAITING' || paymentStatus === 'PENDING_PARTIAL') {
        query.paymentStatus = { $in: ['PENDING', 'PARTIAL_PAID'] };
      } else {
        query.paymentStatus = paymentStatus;
      }
    }

    if (employee && typeof employee === 'string') {
      query.assignedEmployee = employee;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      andConditions.push({
        $or: [
          { projectName: searchRegex },
          { projectId: searchRegex },
          { liftModel: searchRegex },
          { siteAddress: searchRegex },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    let projects = await Project.find(query).populate('customerId').sort({ createdAt: -1 });

    if (isTlUser(req.user)) {
      projects = projects.filter((p) => isProjectAccessibleByTl(p, req.user));
    }

    const MILESTONE_STAGES = [
      {
        key: 'PAYMENT_RECEIVED',
        label: 'Advance Payment Received',
        aliases: ['PAYMENT_RECEIVED', 'ADVANCE_PAID'],
      },
      {
        key: 'SITE_MEASUREMENT',
        label: 'Site Visit',
        aliases: ['SITE_MEASUREMENT', 'SITE_VISIT'],
      },
      {
        key: 'DESIGN',
        label: 'Drawing and Cabin',
        aliases: ['DESIGN', 'DRAWING_AND_CABIN', 'DRAWING'],
      },
      {
        key: 'CUSTOMER_APPROVAL',
        label: 'Drawing and Cabin Design Approval',
        aliases: ['CUSTOMER_APPROVAL', 'DRAWING_AND_CABIN_DESIGN_APPROVAL'],
      },
      {
        key: 'ENGINEERING',
        label: 'Production Payment',
        aliases: ['ENGINEERING', 'PRODUCTION_PAYMENT'],
      },
      {
        key: 'MANUFACTURING',
        label: 'Production in progress',
        aliases: ['MANUFACTURING', 'PRODUCTION_IN_PROGRESS', 'PRODUCTION'],
      },
      {
        key: 'QUALITY_CHECK',
        label: 'Readiness Payment',
        aliases: ['QUALITY_CHECK', 'READINESS_PAYMENT', 'QC'],
      },
      {
        key: 'DISPATCH',
        label: 'Material ready to Dispatch',
        aliases: ['DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_READY_TO_DISPATCH', 'READY_TO_DISPATCH'],
      },
      {
        key: 'MATERIAL_IN_TRANSIT',
        label: 'Material in transit',
        aliases: ['MATERIAL_IN_TRANSIT', 'IN_TRANSIT', 'TRANSIT'],
      },
      {
        key: 'DELIVERY',
        label: 'Pre Site Visit',
        aliases: ['DELIVERY', 'PRE_SITE_VISIT', 'PRE_SITEVISIT'],
      },
      {
        key: 'MATERIAL_DELIVERY',
        label: 'Material Delivered',
        aliases: ['MATERIAL_DELIVERY', 'MATERIAL_DELIVERED'],
      },
      {
        key: 'INSTALLATION',
        label: 'Installation in Progress',
        aliases: ['INSTALLATION', 'INSTALLATION_IN_PROGRESS'],
      },
      {
        key: 'TESTING',
        label: 'Handover - Payment Pending',
        aliases: ['TESTING', 'HANDOVER', 'HANDOVER_PAYMENT_PENDING'],
      },
      {
        key: 'COMPLETED',
        label: 'Project Completed',
        aliases: ['COMPLETED', 'PROJECT_COMPLETED'],
      },
    ];

    const formatStageLabel = (status: string | undefined): string => {
      if (!status) return 'N/A';
      if (status === 'PRODUCTION_IN_PROGRESS') return 'Production in progress';
      if (status === 'MATERIAL_DISPATCHED' || status === 'DISPATCH') return 'Material ready to Dispatch';
      if (status === 'MATERIAL_DELIVERY') return 'Material Delivered';
      if (status === 'DELIVERY') return 'Pre Site Visit';
      if (status === 'MATERIAL_IN_TRANSIT') return 'Material in transit';
      if (status === 'TESTING') return 'Handover - Payment Pending';
      if (status === 'COMPLETED') return 'Project Completed';
      const meta = MILESTONE_STAGES.find((s) => s.key === status || s.aliases.includes(status));
      if (meta) return meta.label;
      return status.replace(/_/g, ' ');
    };

    const formatDate = (val: any): string => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const getStageDates = (p: any, stageKey: string, aliases: string[] = []) => {
      if (!p.stageDates) return null;
      const keysToCheck = [stageKey, ...aliases];
      for (const k of keysToCheck) {
        let val = null;
        if (typeof p.stageDates.get === 'function') {
          val = p.stageDates.get(k);
        } else {
          val = p.stageDates[k];
        }
        if (val && (val.scheduleDate || val.executedDate)) {
          return val;
        }
      }
      for (const k of keysToCheck) {
        const val = typeof p.stageDates.get === 'function' ? p.stageDates.get(k) : p.stageDates[k];
        if (val) return val;
      }
      return null;
    };

    // Sheet 1: All Stages Raw Data
    const rawRows: any[] = [];
    // Sheet 2: Current Stage Summary
    const summaryRows: any[] = [];
    // Sheet 3: Installation Programme Stages
    const installationRows: any[] = [];

    const getAutoColumnWidths = (rows: any[]) => {
      if (!rows || rows.length === 0) return [];
      const colNames = Object.keys(rows[0]);
      return colNames.map((key) => {
        let maxLen = key.length;
        const sampleCount = Math.min(rows.length, 100);
        for (let i = 0; i < sampleCount; i++) {
          const val = rows[i][key];
          const strVal = val !== undefined && val !== null ? String(val) : '';
          if (strVal.length > maxLen) {
            maxLen = strVal.length;
          }
        }
        return { wch: Math.min(Math.max(maxLen + 3, 14), 60) };
      });
    };

    const getEmptyRecord = (withStageCols = false) => {
      const base: Record<string, any> = {
        'Customer Code': '',
        'Customer Name': '',
        'Project Code': '',
        'Project Name': '',
        'Current Stage': '',
      };

      if (withStageCols) {
        base['Stage'] = '';
        base['Schedule Date'] = '';
        base['Executed Date'] = '';
        base['Schedule Time'] = '';
      } else {
        base['Schedule Date'] = '';
        base['Executed Date'] = '';
        base['Schedule Time'] = '';
      }

      base['VRL Tracking Number'] = '';
      base['Phone Number'] = '';
      base['WhatsApp Number'] = '';
      base['Email'] = '';
      base['Door No'] = '';
      base['Street Name'] = '';
      base['Landmark'] = '';
      base['City'] = '';
      base['State'] = '';
      base['Pincode'] = '';
      base['Customer Address'] = '';
      base['Customer Google Maps Link'] = '';
      base['Site Address'] = '';
      base['Site Google Maps Link'] = '';
      base['Lift Model'] = '';
      base['Lift Type'] = '';
      base['Number of Floors'] = '';
      base['Shaft Model'] = '';
      base['Drawing URL'] = '';
      base['Order Value'] = 0;
      base['Lift Amount'] = 0;
      base['Lift Base Amount'] = 0;
      base['Lift Discount Amount'] = 0;
      base['Shaft Amount'] = 0;
      base['Shaft Base Amount'] = 0;
      base['Shaft Discount Amount'] = 0;
      base['Advance Percentage (%)'] = 0;
      base['Advance Amount'] = 0;
      base['Total Paid'] = 0;
      base['Balance Amount'] = 0;
      base['Payment Status'] = '';
      base['Production Payment (%)'] = 0;
      base['Readiness Notification (%)'] = 0;
      base['Dispatch Materials (%)'] = 0;
      base['After Installation (%)'] = 0;
      base['Payment Request Status'] = '';
      base['Payment Requested Amount'] = 0;
      base['Payment Request Type'] = '';
      base['Payment Requested By'] = '';
      base['Order Date'] = '';
      base['Expected Delivery Date'] = '';
      base['Actual Delivery Date'] = '';
      base['Installation Date'] = '';
      base['Project Created Date'] = '';
      base['Customer Created Date'] = '';
      base['Assigned Executive'] = '';
      base['Project Manager'] = '';
      base['Project Executive'] = '';
      base['Customer Assigned Employee'] = '';
      base['BDM Phone'] = '';
      base['WhatsApp Opt-In'] = '';
      base['WhatsApp Opt-In Date'] = '';
      base['WhatsApp Opt-In Source'] = '';
      base['WhatsApp Group ID'] = '';
      base['WhatsApp Group Name'] = '';
      base['WhatsApp Automation Enabled'] = '';
      base['Update Frequency (Days)'] = '';
      base['Last Update Date'] = '';
      base['Next Update Date'] = '';
      base['Production Stage'] = '';
      base['Production Timeline Days'] = '';
      base['Escalation Matrix Sent'] = '';
      base['Escalation Matrix Sent Date'] = '';
      base['Pause Reason'] = '';
      base['Postponed Until'] = '';
      base['Customer Type'] = '';
      base['Lead Source'] = '';
      base['Assigned TL'] = '';
      base['Old Customer'] = '';
      base['Customer Notes'] = '';
      base['Project Notes'] = '';

      return base;
    };

    for (const p of projects) {
      const customer = (p.customerId as any) || {};
      const customerCode = customer.customerId || p.customerCode || 'N/A';
      const customerName = customer.fullName || customer.name || p.projectName || 'N/A';
      const phoneNumber = customer.phoneNumber || '';
      const whatsappNumber = customer.whatsappNumber || customer.phoneNumber || '';
      const email = customer.email || '';
      const customerType = customer.customerType || 'Residential';
      const leadSource = customer.leadSource || '';
      const doorNo = customer.doorNo || '';
      const streetName = customer.streetName || '';
      const landmark = customer.landmark || '';
      const city = customer.city || '';
      const state = customer.state || '';
      const pincode = customer.pincode || '';
      const customerAddress = customer.address || '';
      const customerGoogleMapsLink = customer.googleMapsLink || '';
      const whatsappOptIn = customer.whatsappOptIn !== undefined ? (customer.whatsappOptIn ? 'Yes' : 'No') : '';
      const whatsappOptInDate = customer.optInDate ? formatDate(customer.optInDate) : '';
      const whatsappOptInSource = customer.optInSource || '';
      const isOldCustomer = customer.isOldCustomer ? 'Yes' : 'No';
      const customerNotes = customer.notes || '';
      const customerCreatedAt = customer.createdAt ? formatDate(customer.createdAt) : '';

      const projectCode = p.projectId || 'N/A';
      const projectName = p.projectName || 'Elevator Project';
      const siteAddress = p.siteAddress || customer.address || '';
      const siteGoogleMapsLink = p.googleMapsLink || '';
      const liftModel = p.liftModel || 'Elevator';
      const liftType = p.liftType || '';
      const numberOfFloors = p.numberOfFloors || '';
      const shaftModel = p.shaftModel || '';
      const trackingNumber = p.vrlLrNumber || p.trackingNumber || '';
      const curStageLabel = formatStageLabel(p.projectStatus);
      const drawingUrl = p.drawingUrl
        ? (p.drawingUrl.startsWith('http') ? p.drawingUrl : `${config.frontendUrl || 'http://localhost:3000'}${p.drawingUrl}`)
        : '';

      const orderValue = p.orderValue !== undefined && p.orderValue !== null ? p.orderValue : 0;
      const advancePercentage = p.advancePercentage !== undefined && p.advancePercentage !== null ? p.advancePercentage : 0;
      const advanceAmount = p.advanceAmount !== undefined && p.advanceAmount !== null ? p.advanceAmount : 0;
      const totalPaid = p.totalPaid !== undefined && p.totalPaid !== null ? p.totalPaid : 0;
      const balanceAmount = p.balanceAmount !== undefined && p.balanceAmount !== null ? p.balanceAmount : Math.max(0, orderValue - totalPaid);
      const paymentStatus = p.paymentStatus || 'PENDING';
      const liftAmount = p.liftAmount !== undefined && p.liftAmount !== null ? p.liftAmount : 0;
      const liftBaseAmount = p.liftBaseAmount !== undefined && p.liftBaseAmount !== null ? p.liftBaseAmount : 0;
      const liftDiscountAmount = p.liftDiscountAmount !== undefined && p.liftDiscountAmount !== null ? p.liftDiscountAmount : 0;
      const shaftAmount = p.shaftAmount !== undefined && p.shaftAmount !== null ? p.shaftAmount : 0;
      const shaftBaseAmount = p.shaftBaseAmount !== undefined && p.shaftBaseAmount !== null ? p.shaftBaseAmount : 0;
      const shaftDiscountAmount = p.shaftDiscountAmount !== undefined && p.shaftDiscountAmount !== null ? p.shaftDiscountAmount : 0;
      const productionPaymentPercent = p.productionPaymentPercent !== undefined && p.productionPaymentPercent !== null ? p.productionPaymentPercent : 0;
      const readinessNotificationPercent = p.readinessNotificationPercent !== undefined && p.readinessNotificationPercent !== null ? p.readinessNotificationPercent : 0;
      const dispatchMaterialsPercent = p.dispatchMaterialsPercent !== undefined && p.dispatchMaterialsPercent !== null ? p.dispatchMaterialsPercent : 0;
      const afterInstallationPercent = p.afterInstallationPercent !== undefined && p.afterInstallationPercent !== null ? p.afterInstallationPercent : 0;

      const paymentRequestStatus = p.paymentRequest?.status || 'NONE';
      const paymentRequestedAmount = p.paymentRequest?.requestedAmount !== undefined && p.paymentRequest?.requestedAmount !== null ? p.paymentRequest.requestedAmount : 0;
      const paymentRequestType = p.paymentRequest?.paymentType || '';
      const paymentRequestedBy = p.paymentRequest?.requestedBy || '';

      const orderDate = p.orderDate ? formatDate(p.orderDate) : '';
      const expectedDeliveryDate = p.expectedDeliveryDate ? formatDate(p.expectedDeliveryDate) : '';
      const actualDeliveryDate = p.actualDeliveryDate ? formatDate(p.actualDeliveryDate) : '';
      const installationDate = p.installationDate ? formatDate(p.installationDate) : '';
      const projectCreatedAt = p.createdAt ? formatDate(p.createdAt) : '';

      const assignedExec = p.assignedEmployee || customer.assignedEmployee || p.projectExecutive || '';
      const projectManager = p.projectManager || '';
      const projectExecutive = p.projectExecutive || '';
      const customerAssignedEmp = customer.assignedEmployee || '';
      const bdmPhone = p.bdmPhone || customer.bdmPhone || '';

      const whatsappGroupId = p.whatsappGroupId || p.whatsapp?.groupId || '';
      const whatsappGroupName = p.whatsappGroupName || p.whatsapp?.groupName || '';
      const automationEnabled = p.automationEnabled !== undefined ? (p.automationEnabled ? 'Yes' : 'No') : 'No';
      const updateFrequencyDays = p.updateFrequencyDays || 20;
      const lastUpdateAt = p.lastUpdateAt ? formatDate(p.lastUpdateAt) : '';
      const nextUpdateAt = p.nextUpdateAt ? formatDate(p.nextUpdateAt) : '';
      const productionStage = p.productionStage !== undefined && p.productionStage !== null ? p.productionStage : '';
      const productionTimelineDays = p.productionTimelineDays !== undefined && p.productionTimelineDays !== null ? p.productionTimelineDays : '';
      const escalationMatrixSent = p.escalationMatrixSent !== undefined ? (p.escalationMatrixSent ? 'Yes' : 'No') : 'No';
      const escalationMatrixSentDate = p.escalationMatrixSentAt ? formatDate(p.escalationMatrixSentAt) : '';
      const pauseReason = p.pauseReason || '';
      const postponedUntil = p.postponedUntil ? formatDate(p.postponedUntil) : '';
      const projectNotes = p.notes || '';

      // 1. All Stages Raw Data
      for (const st of MILESTONE_STAGES) {
        const datesObj = getStageDates(p, st.key, st.aliases);
        rawRows.push({
          'Customer Code': customerCode,
          'Customer Name': customerName,
          'Project Code': projectCode,
          'Project Name': projectName,
          'Current Stage': curStageLabel,
          'Stage': st.label,
          'Schedule Date': datesObj?.scheduleDate ? formatDate(datesObj.scheduleDate) : '',
          'Executed Date': datesObj?.executedDate ? formatDate(datesObj.executedDate) : '',
          'Schedule Time': datesObj?.scheduleTime || '',
          'VRL Tracking Number': trackingNumber,
          'Phone Number': phoneNumber,
          'WhatsApp Number': whatsappNumber,
          'Email': email,
          'Door No': doorNo,
          'Street Name': streetName,
          'Landmark': landmark,
          'City': city,
          'State': state,
          'Pincode': pincode,
          'Customer Address': customerAddress,
          'Customer Google Maps Link': customerGoogleMapsLink,
          'Site Address': siteAddress,
          'Site Google Maps Link': siteGoogleMapsLink,
          'Lift Model': liftModel,
          'Lift Type': liftType,
          'Number of Floors': numberOfFloors,
          'Shaft Model': shaftModel,
          'Drawing URL': drawingUrl,
          'Order Value': orderValue,
          'Lift Amount': liftAmount,
          'Lift Base Amount': liftBaseAmount,
          'Lift Discount Amount': liftDiscountAmount,
          'Shaft Amount': shaftAmount,
          'Shaft Base Amount': shaftBaseAmount,
          'Shaft Discount Amount': shaftDiscountAmount,
          'Advance Percentage (%)': advancePercentage,
          'Advance Amount': advanceAmount,
          'Total Paid': totalPaid,
          'Balance Amount': balanceAmount,
          'Payment Status': paymentStatus,
          'Production Payment (%)': productionPaymentPercent,
          'Readiness Notification (%)': readinessNotificationPercent,
          'Dispatch Materials (%)': dispatchMaterialsPercent,
          'After Installation (%)': afterInstallationPercent,
          'Payment Request Status': paymentRequestStatus,
          'Payment Requested Amount': paymentRequestedAmount,
          'Payment Request Type': paymentRequestType,
          'Payment Requested By': paymentRequestedBy,
          'Order Date': orderDate,
          'Expected Delivery Date': expectedDeliveryDate,
          'Actual Delivery Date': actualDeliveryDate,
          'Installation Date': installationDate,
          'Project Created Date': projectCreatedAt,
          'Customer Created Date': customerCreatedAt,
          'Assigned Executive': assignedExec,
          'Project Manager': projectManager,
          'Project Executive': projectExecutive,
          'Customer Assigned Employee': customerAssignedEmp,
          'BDM Phone': bdmPhone,
          'WhatsApp Opt-In': whatsappOptIn,
          'WhatsApp Opt-In Date': whatsappOptInDate,
          'WhatsApp Opt-In Source': whatsappOptInSource,
          'WhatsApp Group ID': whatsappGroupId,
          'WhatsApp Group Name': whatsappGroupName,
          'WhatsApp Automation Enabled': automationEnabled,
          'Update Frequency (Days)': updateFrequencyDays,
          'Last Update Date': lastUpdateAt,
          'Next Update Date': nextUpdateAt,
          'Production Stage': productionStage,
          'Production Timeline Days': productionTimelineDays,
          'Escalation Matrix Sent': escalationMatrixSent,
          'Escalation Matrix Sent Date': escalationMatrixSentDate,
          'Pause Reason': pauseReason,
          'Postponed Until': postponedUntil,
          'Customer Type': customerType,
          'Lead Source': leadSource,
          'Assigned TL': p.assignedTl || customer.assignedTl || '',
          'Old Customer': isOldCustomer,
          'Customer Notes': customerNotes,
          'Project Notes': projectNotes,
        });
      }

      // 2. Current Stage Summary
      const curDates = p.projectStatus ? getStageDates(p, p.projectStatus, [
        ...(p.projectStatus === 'MATERIAL_DISPATCHED' ? ['DISPATCH'] : []),
        ...(p.projectStatus === 'DISPATCH' ? ['MATERIAL_DISPATCHED'] : []),
        ...(p.projectStatus === 'PRODUCTION_IN_PROGRESS' ? ['MANUFACTURING'] : []),
        ...(p.projectStatus === 'MANUFACTURING' ? ['PRODUCTION_IN_PROGRESS'] : []),
        ...(p.projectStatus === 'MATERIAL_DELIVERY' ? ['DELIVERY'] : []),
        ...(p.projectStatus === 'DELIVERY' ? ['MATERIAL_DELIVERY'] : []),
      ]) : null;

      summaryRows.push({
        'Customer Code': customerCode,
        'Customer Name': customerName,
        'Project Code': projectCode,
        'Project Name': projectName,
        'Current Stage': curStageLabel,
        'Schedule Date': curDates?.scheduleDate ? formatDate(curDates.scheduleDate) : '',
        'Executed Date': curDates?.executedDate ? formatDate(curDates.executedDate) : '',
        'Schedule Time': curDates?.scheduleTime || '',
        'VRL Tracking Number': trackingNumber,
        'Phone Number': phoneNumber,
        'WhatsApp Number': whatsappNumber,
        'Email': email,
        'Door No': doorNo,
        'Street Name': streetName,
        'Landmark': landmark,
        'City': city,
        'State': state,
        'Pincode': pincode,
        'Customer Address': customerAddress,
        'Customer Google Maps Link': customerGoogleMapsLink,
        'Site Address': siteAddress,
        'Site Google Maps Link': siteGoogleMapsLink,
        'Lift Model': liftModel,
        'Lift Type': liftType,
        'Number of Floors': numberOfFloors,
        'Shaft Model': shaftModel,
        'Drawing URL': drawingUrl,
        'Order Value': orderValue,
        'Lift Amount': liftAmount,
        'Lift Base Amount': liftBaseAmount,
        'Lift Discount Amount': liftDiscountAmount,
        'Shaft Amount': shaftAmount,
        'Shaft Base Amount': shaftBaseAmount,
        'Shaft Discount Amount': shaftDiscountAmount,
        'Advance Percentage (%)': advancePercentage,
        'Advance Amount': advanceAmount,
        'Total Paid': totalPaid,
        'Balance Amount': balanceAmount,
        'Payment Status': paymentStatus,
        'Production Payment (%)': productionPaymentPercent,
        'Readiness Notification (%)': readinessNotificationPercent,
        'Dispatch Materials (%)': dispatchMaterialsPercent,
        'After Installation (%)': afterInstallationPercent,
        'Payment Request Status': paymentRequestStatus,
        'Payment Requested Amount': paymentRequestedAmount,
        'Payment Request Type': paymentRequestType,
        'Payment Requested By': paymentRequestedBy,
        'Order Date': orderDate,
        'Expected Delivery Date': expectedDeliveryDate,
        'Actual Delivery Date': actualDeliveryDate,
        'Installation Date': installationDate,
        'Project Created Date': projectCreatedAt,
        'Customer Created Date': customerCreatedAt,
        'Assigned Executive': assignedExec,
        'Project Manager': projectManager,
        'Project Executive': projectExecutive,
        'Customer Assigned Employee': customerAssignedEmp,
        'BDM Phone': bdmPhone,
        'WhatsApp Opt-In': whatsappOptIn,
        'WhatsApp Opt-In Date': whatsappOptInDate,
        'WhatsApp Opt-In Source': whatsappOptInSource,
        'WhatsApp Group ID': whatsappGroupId,
        'WhatsApp Group Name': whatsappGroupName,
        'WhatsApp Automation Enabled': automationEnabled,
        'Update Frequency (Days)': updateFrequencyDays,
        'Last Update Date': lastUpdateAt,
        'Next Update Date': nextUpdateAt,
        'Production Stage': productionStage,
        'Production Timeline Days': productionTimelineDays,
        'Escalation Matrix Sent': escalationMatrixSent,
        'Escalation Matrix Sent Date': escalationMatrixSentDate,
        'Pause Reason': pauseReason,
        'Postponed Until': postponedUntil,
        'Customer Type': customerType,
        'Lead Source': leadSource,
        'Assigned TL': p.assignedTl || customer.assignedTl || '',
        'Old Customer': isOldCustomer,
        'Customer Notes': customerNotes,
        'Project Notes': projectNotes,
      });

      // 3. Installation Programme Stages
      if (p.installationStages && p.installationStages.length > 0) {
        for (const inst of p.installationStages) {
          installationRows.push({
            'Customer Code': customerCode,
            'Customer Name': customerName,
            'Project Code': projectCode,
            'Project Name': projectName,
            'Phone Number': phoneNumber,
            'WhatsApp Number': whatsappNumber,
            'Email': email,
            'Site Address': siteAddress,
            'Lift Model': liftModel,
            'Lift Type': liftType,
            'Number of Floors': numberOfFloors,
            'Shaft Model': shaftModel,
            'Current Stage': curStageLabel,
            'Sl No': inst.slNo,
            'Installation Stage': inst.stageName,
            'Start Date': inst.startDate ? formatDate(inst.startDate) : '',
            'Complete Date': inst.completeDate ? formatDate(inst.completeDate) : '',
            'Status': inst.status || 'PENDING',
            'Duration (Working Days)': inst.durationWorkingDays || '',
            'Delay Reason': inst.delayReason || '',
            'Delay Notes': inst.delayNotes || '',
            'Assigned Executive': assignedExec,
            'Project Manager': projectManager,
            'Project Executive': projectExecutive,
          });
        }
      }
    }

    const defaultRawEmptyRow = [getEmptyRecord(true)];
    const defaultSummaryEmptyRow = [getEmptyRecord(false)];

    const workbook = XLSX.utils.book_new();

    const wsRawData = rawRows.length > 0 ? rawRows : defaultRawEmptyRow;
    const wsRaw = XLSX.utils.json_to_sheet(wsRawData);
    wsRaw['!cols'] = getAutoColumnWidths(wsRawData);
    XLSX.utils.book_append_sheet(workbook, wsRaw, 'All Stages (Raw Data)');

    const wsSummaryData = summaryRows.length > 0 ? summaryRows : defaultSummaryEmptyRow;
    const wsSummary = XLSX.utils.json_to_sheet(wsSummaryData);
    wsSummary['!cols'] = getAutoColumnWidths(wsSummaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Current Stage Summary');

    if (installationRows.length > 0) {
      const wsInstallation = XLSX.utils.json_to_sheet(installationRows);
      wsInstallation['!cols'] = getAutoColumnWidths(installationRows);
      XLSX.utils.book_append_sheet(workbook, wsInstallation, 'Installation Programme Stages');
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Projects_Raw_Data_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[ExportExcel] Error exporting projects:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/projects/:id
 */
projectRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.id === 'import-template') {
      const buffer = generateImportTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Alpha_CRM_Import_Template.xlsx"');
      return res.send(buffer);
    }

    let project: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id).populate('customerId');
    } else {
      project = await Project.findOne({ projectId: req.params.id.toUpperCase() }).populate('customerId');
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isProjectAccessibleByTl(project, req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied. This project is assigned to another TL.' });
    }

    const channel = await WhatsAppChannel.findOne({ projectId: project._id });
    const payments = await Payment.find({ projectId: project._id }).sort({ paymentDate: -1 });
    const messages = await WhatsAppMessage.find({ projectId: project._id }).sort({ createdAt: -1 });
    const activities = await ProjectActivity.find({ projectId: project._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        project,
        channel,
        payments,
        messages,
        activities,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/projects/:id
 */
projectRouter.put('/:id', authorize('ADMIN', 'CRM', 'MANAGER', 'ACCOUNTANT', 'BDM', 'TECHNICAL_LEAD', 'LOGISTICS', 'LOGISTICS_TL'), async (req: AuthRequest, res: Response) => {
  try {
    let project: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    } else {
      project = await Project.findOne({ projectId: req.params.id.toUpperCase() });
    }
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (req.user?.role === 'LOGISTICS' || req.user?.role === 'LOGISTICS_TL') {
      const LOGISTICS_ALLOWED_STAGES = ['DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_IN_TRANSIT', 'DELIVERY', 'MATERIAL_DELIVERY'];
      if (req.body.projectStatus && !LOGISTICS_ALLOWED_STAGES.includes(req.body.projectStatus)) {
        return res.status(403).json({
          success: false,
          message: 'Logistics team can only set status to: Material ready to Dispatch, Material in transit, Pre sitevisit, or Material Delivered',
        });
      }
      if (req.body.projectExecutive !== undefined) project.projectExecutive = req.body.projectExecutive;
      if (req.body.vrlLrNumber !== undefined) project.vrlLrNumber = req.body.vrlLrNumber;
      if (req.body.trackingNumber !== undefined) project.trackingNumber = req.body.trackingNumber;
      if (req.body.notes !== undefined) project.notes = req.body.notes;
      if (req.body.projectStatus && LOGISTICS_ALLOWED_STAGES.includes(req.body.projectStatus)) {
        project.projectStatus = req.body.projectStatus;
      }
      await project.save();
      return res.json({ success: true, data: project });
    }

    if (req.body.customerId && String(req.body.customerId) !== String(project.customerId)) {
      const cust = await Customer.findById(req.body.customerId);
      if (cust) {
        project.customerId = cust._id;
        project.customerCode = cust.customerId;
      }
    }

    Object.assign(project, req.body);

    if (req.body.googleMapsLink) {
      project.googleMapsLink = req.body.googleMapsLink.trim();
      if (!req.body.siteAddress && project.googleMapsLink) {
        project.siteAddress = project.googleMapsLink;
      }
    } else if (req.body.siteAddress && (req.body.siteAddress.startsWith('http') || req.body.siteAddress.includes('maps'))) {
      project.googleMapsLink = req.body.siteAddress.trim();
    }

    // If orderValue, advanceAmount, or schedule percentages are modified, recalculate financials
    const orderVal = Number(project.orderValue) || 0;
    if (req.body.advanceAmount !== undefined && req.body.advanceAmount !== null && req.body.advanceAmount !== '') {
      project.advanceAmount = Number(req.body.advanceAmount);
      if (orderVal > 0) {
        project.advancePercentage = Math.round((project.advanceAmount / orderVal) * 100);
      }
    } else if (req.body.advancePercentage !== undefined) {
      const advPct = Number(project.advancePercentage) || 0;
      project.advanceAmount = Math.round((orderVal * advPct) / 100);
    }
    project.balanceAmount = Math.max(0, orderVal - (project.totalPaid || 0));

    if (project.totalPaid >= orderVal && orderVal > 0) {
      project.paymentStatus = 'FULLY_PAID';
    } else if (project.totalPaid >= project.advanceAmount && project.advanceAmount > 0) {
      project.paymentStatus = 'ADVANCE_PAID';
    } else if (project.totalPaid > 0) {
      project.paymentStatus = 'PARTIAL_PAID';
    } else {
      project.paymentStatus = 'PENDING';
    }

    await project.save();
    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/status
 */
projectRouter.patch('/:id/status', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'LOGISTICS', 'LOGISTICS_TL'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes, vrlLrNumber, trackingNumber, productionTimelineDays } = req.body;
    let project: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    } else {
      project = await Project.findOne({ projectId: req.params.id.toUpperCase() });
    }
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM') {
      if (status !== 'CUSTOMER_APPROVAL') {
        if (status !== 'ENGINEERING' || project.projectStatus !== 'CUSTOMER_APPROVAL') {
          return res.status(403).json({ success: false, message: 'BDMs can only update the Drawing and Cabin Design Approval stage' });
        }
      }
      if (project.bdmId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
      }
    }

    if (req.user?.role === 'LOGISTICS' || req.user?.role === 'LOGISTICS_TL') {
      const LOGISTICS_ALLOWED_STAGES = ['DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_IN_TRANSIT', 'DELIVERY', 'MATERIAL_DELIVERY'];
      if (!LOGISTICS_ALLOWED_STAGES.includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'Logistics team can only update stages: Material ready to Dispatch, Material in transit, Pre sitevisit, and Material Delivered'
        });
      }
    }

    const prevStatus = project.projectStatus;
    project.projectStatus = status as ProjectStatus;
    if (notes) {
      project.notes = notes;
    }
    if (vrlLrNumber || trackingNumber) {
      const tracking = String(vrlLrNumber || trackingNumber).trim();
      project.vrlLrNumber = tracking;
      project.trackingNumber = tracking;
    }

    if (status === 'CUSTOMER_APPROVAL') {
      const days = Number(productionTimelineDays) > 0 ? Number(productionTimelineDays) : (project.productionTimelineDays || 60);
      project.productionTimelineDays = days;
    }

    // Reset nextUpdateAt: production interval updates apply after Production Payment (in any post-production stage)
    const intervalDays = project.whatsapp?.intervalDays || project.updateFrequencyDays || 10;
    const isPostProduction = POST_PRODUCTION_PAYMENT_STAGES.includes(status);

    if (isPostProduction) {
      // Stop production payment reminders once in manufacturing or beyond
      project.productionPaymentReminderStopped = true;
      project.productionPaymentReminderNextDueAt = undefined;
      project.productionPaymentReminderScheduledAt = undefined;

      if (!project.productionStage || project.productionStage < 1) {
        project.productionStage = 1;
      }
      // If the 6 production updates are still in progress, ensure nextUpdateAt is scheduled
      if (project.productionStage <= 6) {
        if (!project.nextUpdateAt) {
          project.lastUpdateAt = project.lastUpdateAt || new Date();
          project.nextUpdateAt = calculateNextUpdateDate(intervalDays, new Date());
        }
        if (project.whatsapp) {
          project.whatsapp.lastUpdateAt = project.lastUpdateAt || new Date();
          project.whatsapp.nextUpdateAt = project.nextUpdateAt;
        }
      }
    } else {
      // Pre-production stages do not run production interval updates
      project.nextUpdateAt = undefined;
      if (project.whatsapp) {
        project.whatsapp.nextUpdateAt = undefined;
      }
    }

    if (['DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_IN_TRANSIT', 'DELIVERY', 'MATERIAL_DELIVERY', 'INSTALLATION', 'TESTING', 'COMPLETED'].includes(status)) {
      project.readinessPaymentReminderStopped = true;
      project.readinessPaymentReminderNextDueAt = undefined;
    }
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: status === 'CUSTOMER_APPROVAL'
        ? `Project status updated to Drawing and Cabin Design Approval. Production timeline set to ${project.productionTimelineDays || 60} days. ${notes ? `Note: ${notes}` : ''}`
        : (status === 'MANUFACTURING' || status === 'PRODUCTION_IN_PROGRESS')
          ? `Project status updated to Production in progress. Stage 1 Production Update scheduled in ${intervalDays <= 0.003 ? '2 minutes' : intervalDays <= 0.025 ? '30 minutes' : intervalDays < 0.1 ? '1 hour' : intervalDays >= 1.24 && intervalDays <= 1.26 ? '30 hours' : `${intervalDays} days`}.`
          : status === 'MATERIAL_IN_TRANSIT' && project.vrlLrNumber
            ? `Project status updated to Material in transit. VRL Tracking No: ${project.vrlLrNumber}. ${notes ? `Note: ${notes}` : ''}`
          : (status === 'DISPATCH' || status === 'MATERIAL_DISPATCHED') && project.vrlLrNumber
            ? `Project status updated to Material ready to Dispatch. VRL Tracking No: ${project.vrlLrNumber}. ${notes ? `Note: ${notes}` : ''}`
            : `Project status updated from ${prevStatus} to ${status}. ${notes ? `Note: ${notes}` : ''}`,
      userId: req.user?._id,
      userName: req.user?.name,
      metadata: { previousStatus: prevStatus, newStatus: status, intervalDays, vrlLrNumber: project.vrlLrNumber, productionTimelineDays: project.productionTimelineDays },
    });

    // Milestone update messages directly inside WhatsApp group via Web Bot!
    // Note: Production in progress does not send immediate message because Stage 1 is sent after intervalDays
    let groupMessageDispatched = false;
    let groupMessageError: string | null = null;
    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;

    if (inviteTarget && status !== 'MANUFACTURING' && status !== 'PRODUCTION_IN_PROGRESS') {
      try {
        if (status === 'CUSTOMER_APPROVAL') {
          // Drawing and Cabin Approved special workflow:
          // Dispatches 2 sequential WhatsApp messages immediately + schedules 2-day payment follow-up
          const days = Number(productionTimelineDays) > 0 ? Number(productionTimelineDays) : (project.productionTimelineDays || 60);
          const drawWorkflowRes = await handleDrawingAndCabinApprovedWorkflow(project, days, req.user?._id, req.user?.name);
          groupMessageDispatched = drawWorkflowRes.success;
          if (!drawWorkflowRes.success) {
            groupMessageError = drawWorkflowRes.error || 'Failed to dispatch drawing approval messages';
          }
        } else {
          const customer = await Customer.findById(project.customerId);
          const messageText = generateProjectUpdateText(project, customer, notes ? `Stage updated: ${notes}` : undefined);
          const botStatus = whatsAppWebBot.getStatus();

          if (config.wati.dryRun) {
            groupMessageDispatched = true;
            await WhatsAppMessageLog.create({
              projectId: project._id,
              groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
              messageText,
              messageType: 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: `DRY_STAGE_${Date.now()}`,
              status: 'SENT',
              attemptCount: 1,
              isDryRun: true,
            });

            await WhatsAppMessage.create({
              projectId: project._id,
              projectCode: project.projectId,
              customerId: customer?._id,
              customerName: customer?.fullName || 'Client',
              groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
              templateName: STAGE_TEMPLATE_MAP[status] || 'SITE_VISIT_COMPLETED',
              messageType: 'template',
              recipientType: 'group',
              direction: 'OUTGOING',
              messageContent: messageText,
              status: 'SENT',
              sentAt: new Date(),
              isAutomated: true,
              idempotencyKey: `AUTO_STAGE_${project.projectId}_${status}_${Date.now()}`,
            });

            await logProjectActivity({
              projectId: project._id,
              projectCode: project.projectId,
              type: 'WHATSAPP_SENT',
              description: `[Dry Run] Milestone update for stage ${status} simulated for WhatsApp group`,
              userId: req.user?._id,
              userName: req.user?.name,
            });
          } else if (botStatus.isConnected) {
            const botResult = await whatsAppWebBot.sendMessageToGroup(inviteTarget, messageText);
            if (botResult.success) {
              groupMessageDispatched = true;
              await WhatsAppMessageLog.create({
                projectId: project._id,
                groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
                messageText,
                messageType: 'text',
                scheduledAt: new Date(),
                attemptedAt: new Date(),
                sentAt: new Date(),
                providerMessageId: botResult.messageId,
                status: 'SENT',
                attemptCount: 1,
                isDryRun: false,
              });

              await WhatsAppMessage.create({
                projectId: project._id,
                projectCode: project.projectId,
                customerId: customer?._id,
                customerName: customer?.fullName || 'Client',
                groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
                templateName: STAGE_TEMPLATE_MAP[status] || 'SITE_VISIT_COMPLETED',
                messageType: 'template',
                recipientType: 'group',
                direction: 'OUTGOING',
                messageContent: messageText,
                status: 'SENT',
                sentAt: new Date(),
                isAutomated: true,
                idempotencyKey: `AUTO_STAGE_${project.projectId}_${status}_${Date.now()}`,
              });

              await logProjectActivity({
                projectId: project._id,
                projectCode: project.projectId,
                type: 'WHATSAPP_SENT',
                description: `Automated milestone update for stage ${status} dispatched directly inside WhatsApp group via Web Bot (+${botStatus.botPhoneNumber || 'Bot'})`,
                userId: req.user?._id,
                userName: req.user?.name,
              });
              console.log(`[AutoStageUpdate] Milestone update for stage ${status} posted directly inside WhatsApp group for ${project.projectId}`);
            } else {
              groupMessageError = botResult.error || 'Failed to dispatch to group';
            }
          } else {
            // Record message log indicating bot needs connection
            await WhatsAppMessageLog.create({
              projectId: project._id,
              groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
              messageText,
              messageType: 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              status: 'AWAITING_PROVIDER_CAPABILITY',
              lastError: 'WhatsApp Web Bot not connected. Scan QR code to enable automatic group dispatch.',
              attemptCount: 1,
              isDryRun: false,
            });
          }
        }
      } catch (waErr: any) {
        console.error('[AutoStageUpdate] Error dispatching WhatsApp milestone message:', waErr.message);
        groupMessageError = waErr.message;
      }
    }

    // If status is 'CUSTOMER_APPROVAL' (Drawing and Cabin Design Approval),
    // automatically send a 1-to-1 WhatsApp notification message to the assigned BDM for Approval!
    let bdmNotified = false;
    let bdmNotificationResult: any = null;
    if (status === 'CUSTOMER_APPROVAL') {
      const bdmNotifyRes = await sendBdmApprovalNotification(project, req.user?._id, req.user?.name, notes);
      bdmNotified = !!bdmNotifyRes.success;
      bdmNotificationResult = bdmNotifyRes;
    }

    let resultMsg = `Stage updated to ${status}.`;
    if (status === 'CUSTOMER_APPROVAL') {
      const days = project.productionTimelineDays || 60;
      resultMsg = `Drawing & Cabin Approved! 2 WhatsApp messages sent to group (${days} days delivery timeline) and follow-up scheduled for 2 days later.`;
    } else if (status === 'MANUFACTURING' || status === 'PRODUCTION_IN_PROGRESS') {
      resultMsg = `Stage updated to Production in progress. Automated Stage 1 Production Update scheduled in ${intervalDays <= 0.003 ? '2 minutes' : intervalDays <= 0.025 ? '30 minutes' : intervalDays < 0.1 ? '1 hour' : intervalDays >= 1.24 && intervalDays <= 1.26 ? '30 hours' : `${intervalDays} days`}.`;
    } else if (status === 'MATERIAL_IN_TRANSIT' && project.vrlLrNumber && groupMessageDispatched) {
      resultMsg = `Stage updated to Material in transit! VRL Tracking No (${project.vrlLrNumber}) attached and template message posted directly inside WhatsApp group!`;
    } else if (status === 'MATERIAL_IN_TRANSIT' && project.vrlLrNumber) {
      resultMsg = `Stage updated to Material in transit with VRL Tracking No: ${project.vrlLrNumber}.`;
    } else if ((status === 'DISPATCH' || status === 'MATERIAL_DISPATCHED') && project.vrlLrNumber && groupMessageDispatched) {
      resultMsg = `Stage updated to Material ready to Dispatch! VRL Tracking No (${project.vrlLrNumber}) attached and template message posted directly inside WhatsApp group!`;
    } else if ((status === 'DISPATCH' || status === 'MATERIAL_DISPATCHED') && project.vrlLrNumber) {
      resultMsg = `Stage updated to Material ready to Dispatch with VRL Tracking No: ${project.vrlLrNumber}.`;
    } else if (groupMessageDispatched && bdmNotified) {
      resultMsg = `Stage updated to ${status}! Update posted in WhatsApp group & 1-to-1 alert sent to BDM via ${bdmNotificationResult?.provider || 'WhatsApp'}.`;
    } else if (groupMessageDispatched) {
      resultMsg = `Stage updated to ${status} and update posted directly inside WhatsApp group!`;
    } else if (bdmNotified) {
      resultMsg = `Stage updated to ${status} and 1-to-1 approval alert sent to BDM via ${bdmNotificationResult?.provider || 'WhatsApp'}!`;
    }

    return res.json({
      success: true,
      data: project,
      groupMessageDispatched,
      groupMessageError,
      bdmNotified,
      bdmNotificationResult,
      message: resultMsg,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/drawing-approved
 * Direct endpoint triggered when user confirms the Drawing and Cabin Approved modal with delivery days
 */
projectRouter.post('/:id/drawing-approved', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD'), async (req: AuthRequest, res: Response) => {
  try {
    const { productionTimelineDays, notes } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    if (req.user?.role === 'BDM' && project.bdmId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    const prevStatus = project.projectStatus;
    project.projectStatus = 'CUSTOMER_APPROVAL';
    if (notes) project.notes = notes;
    const days = Number(productionTimelineDays) > 0 ? Number(productionTimelineDays) : 60;
    project.productionTimelineDays = days;

    // Record executedDate in stageDates for CUSTOMER_APPROVAL
    if (!project.stageDates) project.stageDates = new Map();
    const currentDates = project.stageDates.get('CUSTOMER_APPROVAL') || {};
    if (!currentDates.executedDate) currentDates.executedDate = new Date();
    project.stageDates.set('CUSTOMER_APPROVAL', currentDates);

    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `Drawing and Cabin Approved confirmed with ${days} days production timeline.`,
      userId: req.user?._id,
      userName: req.user?.name,
      metadata: { previousStatus: prevStatus, newStatus: 'CUSTOMER_APPROVAL', productionTimelineDays: days },
    });

    const workflowRes = await handleDrawingAndCabinApprovedWorkflow(project, days, req.user?._id, req.user?.name);
    const bdmNotifyRes = await sendBdmApprovalNotification(project, req.user?._id, req.user?.name, notes);

    return res.json({
      success: true,
      data: project,
      workflow: workflowRes,
      bdmNotification: bdmNotifyRes,
      message: `Drawing and Cabin Approved! 2 WhatsApp messages dispatched to group (${days} days delivery timeline) and follow-up scheduled for 2 days later.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/stage-dates
 */
projectRouter.patch('/:id/stage-dates', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER', 'LOGISTICS', 'LOGISTICS_TL'), async (req: AuthRequest, res: Response) => {
  try {
    const { stageKey, scheduleDate, executedDate, time } = req.body;
    if (!stageKey) {
      return res.status(400).json({ success: false, message: 'stageKey is required' });
    }

    if (req.user?.role === 'BDM' && stageKey !== 'CUSTOMER_APPROVAL') {
      return res.status(403).json({ success: false, message: 'BDMs can only update dates for the Drawing and Cabin Design Approval stage' });
    }

    if (req.user?.role === 'LOGISTICS' || req.user?.role === 'LOGISTICS_TL') {
      const LOGISTICS_ALLOWED_STAGES = ['DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_IN_TRANSIT', 'DELIVERY', 'MATERIAL_DELIVERY'];
      if (!LOGISTICS_ALLOWED_STAGES.includes(stageKey)) {
        return res.status(403).json({
          success: false,
          message: 'Logistics team can only update dates for Material ready to Dispatch, Material in transit, Pre sitevisit, and Material Delivered stages'
        });
      }
    }

    let project: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    } else {
      project = await Project.findOne({ projectId: req.params.id.toUpperCase() });
    }
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM' && project.bdmId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    if (!project.stageDates) {
      project.stageDates = new Map();
    }

    const currentDates = project.stageDates.get(stageKey) || {};

    if (scheduleDate !== undefined) {
      currentDates.scheduleDate = scheduleDate ? new Date(scheduleDate) : null;
    }

    if (executedDate !== undefined) {
      currentDates.executedDate = executedDate ? new Date(executedDate) : null;
    }

    if (time !== undefined) {
      currentDates.scheduleTime = time ? String(time).trim() : null;
    }

    project.stageDates.set(stageKey, currentDates);
    await project.save();

    let groupMessageDispatched = false;
    let groupMessageError: string | null = null;
    let resultMessage = 'Stage dates updated successfully';

    if (stageKey === 'PAYMENT_RECEIVED' && executedDate) {
      await triggerAdvancePaymentReminderForCRM(project._id);
    } else if (stageKey === 'SITE_MEASUREMENT' && scheduleDate) {
      await dismissScheduleDateRemindersForProject(project._id);
      const schedRes = await dispatchSiteVisitScheduledMessage(project, scheduleDate, time || currentDates.scheduleTime, req.user);
      if (schedRes?.success) {
        groupMessageDispatched = schedRes.sentViaBot;
        resultMessage = `Site visit scheduled for ${schedRes.formattedDate} at ${schedRes.formattedTime} and WhatsApp notification sent to group!`;
      } else if (schedRes?.error) {
        groupMessageError = schedRes.error;
      }
    } else if (stageKey === 'ENGINEERING' && executedDate) {
      project.productionPaymentReminderStopped = true;
      project.productionPaymentReminderNextDueAt = undefined;
      project.productionPaymentReminderScheduledAt = undefined;
      await project.save();
    } else if (stageKey === 'QUALITY_CHECK' && executedDate) {
      project.readinessPaymentReminderStopped = true;
      project.readinessPaymentReminderNextDueAt = undefined;
      await project.save();
    }

    if (stageKey === 'SITE_MEASUREMENT' && executedDate) {
      await dispatchSiteVisitCompletedMessage(project, req.user);
    }

    return res.json({
      success: true,
      data: project,
      groupMessageDispatched,
      groupMessageError,
      message: resultMessage,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/stage-dates-bulk
 */
projectRouter.patch('/:id/stage-dates-bulk', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER', 'LOGISTICS', 'LOGISTICS_TL'), async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'updates must be an array' });
    }

    let project: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    } else {
      project = await Project.findOne({ projectId: req.params.id.toUpperCase() });
    }
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM' && project.bdmId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    if (!project.stageDates) {
      project.stageDates = new Map();
    }

    const LOGISTICS_ALLOWED_STAGES = ['DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_IN_TRANSIT', 'DELIVERY', 'MATERIAL_DELIVERY'];

    for (const update of updates) {
      const { stageKey, scheduleDate, executedDate } = update;

      if (req.user?.role === 'BDM' && stageKey !== 'CUSTOMER_APPROVAL') {
        continue;
      }

      if ((req.user?.role === 'LOGISTICS' || req.user?.role === 'LOGISTICS_TL') && !LOGISTICS_ALLOWED_STAGES.includes(stageKey)) {
        continue;
      }

      const currentDates = project.stageDates.get(stageKey) || {};

      if (scheduleDate !== undefined) {
        currentDates.scheduleDate = scheduleDate ? new Date(scheduleDate) : null;
      }

      if (executedDate !== undefined) {
        currentDates.executedDate = executedDate ? new Date(executedDate) : null;
      }

      project.stageDates.set(stageKey, currentDates);
    }

    await project.save();

    const hasPaymentExecuted = updates.some((u: any) => u.stageKey === 'PAYMENT_RECEIVED' && u.executedDate);
    const hasSiteVisitScheduled = updates.some((u: any) => u.stageKey === 'SITE_MEASUREMENT' && u.scheduleDate);
    const hasSiteVisitExecuted = updates.some((u: any) => u.stageKey === 'SITE_MEASUREMENT' && u.executedDate);

    if (hasPaymentExecuted) {
      await triggerAdvancePaymentReminderForCRM(project._id);
    }
    if (hasSiteVisitScheduled) {
      await dismissScheduleDateRemindersForProject(project._id);
      const siteMeasurementUpdate = updates.find((u: any) => u.stageKey === 'SITE_MEASUREMENT' && u.scheduleDate);
      if (siteMeasurementUpdate) {
        await dispatchSiteVisitScheduledMessage(
          project,
          siteMeasurementUpdate.scheduleDate,
          (siteMeasurementUpdate as any).time,
          req.user
        );
      }
    }
    if (hasSiteVisitExecuted) {
      await dispatchSiteVisitCompletedMessage(project, req.user);
    }

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/notes
 */
projectRouter.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { note } = req.body;
    if (!note) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }

    let project: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    } else {
      project = await Project.findOne({ projectId: req.params.id.toUpperCase() });
    }
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'NOTE',
      description: note,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'Note added successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/drawing
 */
projectRouter.post(
  '/:id/drawing',
  authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER'),
  handleDrawingUploadMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      project.drawingUrl = `/uploads/${req.file.filename}`;

      // Automatically set DESIGN schedule & executed dates to today
      if (!project.stageDates) project.stageDates = new Map();
      const currentDates = project.stageDates.get('DESIGN') || {};
      currentDates.scheduleDate = new Date();
      currentDates.executedDate = new Date();
      project.stageDates.set('DESIGN', currentDates);

      const prevStatus = project.projectStatus;
      // Advance to next stage (CUSTOMER_APPROVAL)
      project.projectStatus = 'CUSTOMER_APPROVAL';

      await project.save();

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'DOCUMENT_UPLOAD',
        description: `Drawing uploaded. DESIGN stage auto-completed. Status advanced from ${prevStatus} to CUSTOMER_APPROVAL.`,
        userId: req.user?._id,
        userName: req.user?.name,
      });

      // Automatically send Drawing and Cabin Design document to the WhatsApp Group!
      let documentSentToGroup = false;
      let documentSendError: string | null = null;
      const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;

      if (inviteTarget) {
        try {
          const customer = await Customer.findById(project.customerId);
          const customerName = customer?.fullName || 'Valued Client';
          const caption = `Dear Sir/Madam,\n\nThe elevator drawing and cabin design are ready for your review and approval.\n\n*Project:* ${project.projectName} (${project.liftModel || 'Elevator'})\n*Stage:* Drawing and Cabin Design Approval\n\nKindly review and confirm your approval to proceed to the next stage.\n\nRegards,\nAlpha Elevators Team`;

          const activeDir = ensureUploadsDir();
          const fullFilePath = req.file.path
            ? path.resolve(req.file.path)
            : path.resolve(activeDir, req.file.filename);
          const botStatus = whatsAppWebBot.getStatus();

        if (botStatus.isConnected) {
          const docRes = await whatsAppWebBot.sendDocumentToGroup(
            inviteTarget,
            fullFilePath,
            req.file.originalname || req.file.filename,
            caption
          );

          if (docRes.success) {
            documentSentToGroup = true;
            await WhatsAppMessageLog.create({
              projectId: project._id,
              groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
              messageText: `[DOCUMENT DISPATCHED]: ${req.file.originalname || req.file.filename}\n${caption}`,
              messageType: 'document',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: docRes.messageId,
              status: 'SENT',
              attemptCount: 1,
              isDryRun: false,
            });

            await logProjectActivity({
              projectId: project._id,
              projectCode: project.projectId,
              type: 'WHATSAPP_SENT',
              description: `Drawing & Cabin Design document "${req.file.originalname}" sent directly to WhatsApp group via Web Bot (+${botStatus.botPhoneNumber || 'Bot'})`,
              userId: req.user?._id,
              userName: req.user?.name,
            });
            console.log(`[DrawingDispatch] Drawing document sent to WhatsApp group for ${project.projectId}`);
          } else {
            documentSendError = docRes.error || 'Failed to dispatch document to WhatsApp group';
          }
        }
      } catch (err: any) {
        console.error('[DrawingDispatch] Error sending document to group:', err.message);
        documentSendError = err.message;
      }
    }

    // Automatically send 1-to-1 WhatsApp notification to assigned BDM via WATI
    await sendBdmApprovalNotification(
      project,
      req.user?._id,
      req.user?.name,
      'Drawing and cabin design uploaded and ready for customer sign-off.'
    );

    return res.json({
      success: true,
      data: project,
      documentSentToGroup,
      documentSendError,
      message: documentSentToGroup
        ? 'Drawing uploaded and automatically sent to WhatsApp group!'
        : 'Drawing uploaded successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/notify-bdm
 * Sends a 1-to-1 WhatsApp approval request to the assigned BDM via WATI
 */
projectRouter.post('/:id/notify-bdm', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const { note } = req.body;
    const result = await sendBdmApprovalNotification(project, req.user?._id, req.user?.name, note);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.reason || result.error || 'Failed to dispatch 1-to-1 WATI message to BDM',
      });
    }

    return res.json({
      success: true,
      message: `1-to-1 WhatsApp approval request sent to BDM successfully via ${result.provider || 'WhatsApp'}!`,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/request-payment
 * Allows CRM / Admin / Manager to request payment collection from the Accountant
 */
projectRouter.post('/:id/request-payment', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const { requestedAmount, paymentType, notes, accountantPhone, accountantName } = req.body;

    // Resolve Accountant contact details
    let targetAccountantPhone = accountantPhone;
    let targetAccountantName = accountantName;
    if (!targetAccountantPhone) {
      const accountantUser = await User.findOne({ role: 'ACCOUNTANT' });
      if (accountantUser) {
        targetAccountantPhone = accountantUser.phone;
        targetAccountantName = accountantUser.name;
      }
    }
    if (!targetAccountantPhone) {
      targetAccountantPhone = '+91 98400 99881';
    }
    if (!targetAccountantName) {
      targetAccountantName = 'Vincy (Accountant)';
    }

    // Resolve CRM contact phone
    let crmPhone = req.user?.phone;
    if (!crmPhone) {
      const crmUser = await User.findOne({ role: 'CRM', phone: { $exists: true, $ne: '' } });
      crmPhone = crmUser?.phone || '+91 93848 20316';
    }

    project.paymentRequest = {
      status: 'REQUESTED',
      requestedAmount: requestedAmount !== undefined && requestedAmount !== null ? Number(requestedAmount) : undefined,
      paymentType: paymentType || 'Milestone Payment',
      requestedBy: req.user?.name || req.user?.email || 'CRM',
      requestedByPhone: crmPhone,
      accountantPhone: targetAccountantPhone,
      accountantName: targetAccountantName,
      requestedAt: new Date(),
      notes: notes ? String(notes).trim() : '',
    };

    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'PAYMENT',
      description: `CRM requested payment collection: ₹${(project.paymentRequest.requestedAmount || 0).toLocaleString('en-IN')} (${project.paymentRequest.paymentType}). Requester: ${project.paymentRequest.requestedBy}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    // Send 1-to-1 WhatsApp alert to the Accountant
    let accountantNotified = false;
    let accountantDispatchError: string | null = null;
    let usedProvider = 'WhatsApp Bot';

    try {
      const customer = await Customer.findById(project.customerId);
      const customerName = customer?.fullName || 'Valued Client';
      const customerPhone = customer?.phoneNumber || 'N/A';
      const reqAmt = (project.paymentRequest.requestedAmount || 0).toLocaleString('en-IN');
      const orderVal = (project.orderValue || 0).toLocaleString('en-IN');
      const totPaid = (project.totalPaid || 0).toLocaleString('en-IN');
      const balAmt = (project.balanceAmount || 0).toLocaleString('en-IN');

      const accountantMsg = `🔔 *Payment Collection Request* 🔔\n\nDear ${targetAccountantName},\nA payment collection request has been submitted by CRM (*${project.paymentRequest.requestedBy}*).\n\n*Project Details:*\n• *Project:* ${project.projectName} (${project.projectId})\n• *Customer Name:* ${customerName}\n• *Customer Phone:* ${customerPhone}\n• *Total Order Value:* ₹${orderVal}\n• *Total Collected:* ₹${totPaid}\n• *Current Balance:* ₹${balAmt}\n\n*Collection Details:*\n• *Amount to Collect:* ₹${reqAmt}\n• *Payment Stage:* ${project.paymentRequest.paymentType}\n• *Requested By:* ${project.paymentRequest.requestedBy}${crmPhone ? ` (+${crmPhone.replace(/\D/g, '')})` : ''}\n${notes ? `• *CRM Notes:* ${notes}\n` : ''}\nPlease follow up with the customer, collect/verify the payment, and record the payment receipt on the Alpha Elevators CRM dashboard.\n\nThank you,\nAlpha Elevators CRM`;

      const botStatus = whatsAppWebBot.getStatus();
      if (botStatus.isConnected) {
        console.log(`[PaymentRequest] Sending 1-to-1 WhatsApp message to Accountant ${targetAccountantName} (+${targetAccountantPhone}) via Web Bot`);
        const botRes = await whatsAppWebBot.sendDirectMessage(targetAccountantPhone, accountantMsg);
        if (botRes.success) {
          accountantNotified = true;
          usedProvider = 'WhatsApp Bot';
          await WhatsAppMessageLog.create({
            projectId: project._id,
            recipientPhone: targetAccountantPhone,
            recipientName: targetAccountantName,
            messageText: accountantMsg,
            messageType: 'text',
            scheduledAt: new Date(),
            attemptedAt: new Date(),
            sentAt: new Date(),
            providerMessageId: botRes.messageId,
            status: 'SENT',
            attemptCount: 1,
            isDryRun: false,
          });
          console.log(`[PaymentRequest] 1-to-1 message sent directly to Accountant (+${targetAccountantPhone}) via Web Bot! ID: ${botRes.messageId}`);
        } else {
          accountantDispatchError = botRes.error || 'Web Bot failed to dispatch direct message';
        }
      }

      // Fallback to WATI if Web Bot is not connected or failed
      if (!accountantNotified) {
        try {
          console.log(`[PaymentRequest] Dispatching 1-to-1 WhatsApp message to Accountant (+${targetAccountantPhone}) via WATI`);
          const watiRes = await watiService.sendGroupText({
            target: targetAccountantPhone,
            targetType: 'DIRECT',
            text: accountantMsg,
            contactName: targetAccountantName,
          });
          if (watiRes.success) {
            accountantNotified = true;
            usedProvider = 'WATI';
            await WhatsAppMessageLog.create({
              projectId: project._id,
              recipientPhone: targetAccountantPhone,
              recipientName: targetAccountantName,
              messageText: accountantMsg,
              messageType: 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: watiRes.messageId,
              status: 'SENT',
              attemptCount: 1,
              isDryRun: false,
            });
            console.log(`[PaymentRequest] 1-to-1 message sent to Accountant (+${targetAccountantPhone}) via WATI! ID: ${watiRes.messageId}`);
          } else {
            accountantDispatchError = watiRes.error || accountantDispatchError;
          }
        } catch (watiErr: any) {
          console.error('[PaymentRequest] WATI fallback error:', watiErr.message);
          accountantDispatchError = watiErr.message;
        }
      }

      if (accountantNotified) {
        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_SENT',
          description: `1-to-1 WhatsApp payment request alert sent to Accountant ${targetAccountantName} (+${targetAccountantPhone}) via ${usedProvider}`,
          userId: req.user?._id,
          userName: req.user?.name,
        });
      }
    } catch (msgErr: any) {
      console.error('[PaymentRequest] Failed to dispatch WhatsApp message to accountant:', msgErr.message);
      accountantDispatchError = msgErr.message;
    }

    return res.json({
      success: true,
      message: accountantNotified
        ? `Payment collection request sent to Accountant (${targetAccountantName}) and 1-to-1 WhatsApp alert dispatched successfully!`
        : `Payment collection request sent to Accountant (${targetAccountantName}) successfully! (WhatsApp note: ${accountantDispatchError || 'Bot queued'})`,
      data: project,
      accountantNotified,
      accountantDispatchError,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/projects/:id/request-payment
 * Cancels a pending payment collection request
 */
projectRouter.delete('/:id/request-payment', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    project.paymentRequest = {
      status: 'NONE',
    };

    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'PAYMENT',
      description: `CRM payment collection request cancelled by ${req.user?.name || 'CRM'}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({
      success: true,
      message: 'Payment collection request cancelled successfully',
      data: project,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/projects/:id/installation-stages
 * Returns the 11-stage installation programme for a project (auto-initialized if empty)
 */
projectRouter.get('/:id/installation-stages', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    let stages = project.installationStages;
    if (!stages || stages.length === 0 || !stages[0]?.stageName) {
      const installDate =
        project.installationDate ||
        project.stageDates?.get('INSTALLATION')?.scheduleDate ||
        new Date();
      stages = generateInitialSchedule(installDate, DEFAULT_INSTALLATION_STAGES) as any;
      project.installationStages = stages;
      await project.save();
    }

    return res.json({ success: true, data: stages });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/installation-stages/update-stage
 * Updates a stage date, handles reason (Holiday / Technical Issue),
 * cascades all subsequent stages (skipping weekends), and sends WhatsApp update.
 */
projectRouter.post(
  '/:id/installation-stages/update-stage',
  authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD', 'LOGISTICS_TL'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { stageKey, startDate, completeDate, status, reason, notes, sendWhatsApp } = req.body;
      const project = await Project.findById(req.params.id).populate('customerId');
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

      let stages: any[] = [];
      if (project.installationStages && project.installationStages.length > 0 && project.installationStages[0]?.stageName) {
        stages = project.installationStages.map((s: any) =>
          typeof s.toObject === 'function' ? s.toObject() : s._doc ? { ...s._doc } : { ...s }
        );
      } else {
        const installDate =
          project.installationDate ||
          project.stageDates?.get('INSTALLATION')?.scheduleDate ||
          new Date();
        stages = generateInitialSchedule(installDate, DEFAULT_INSTALLATION_STAGES) as any;
      }

      const oldStage = stages.find((s: any) => s.stageKey === stageKey);
      const oldCompleteDate = oldStage?.completeDate || '';

      // Run working days cascade update (Saturdays and Sundays automatically neglected)
      const updatedStages = cascadeScheduleUpdates(
        stages as any,
        stageKey,
        startDate,
        completeDate,
        reason,
        notes
      );

      // Status update if provided
      if (status) {
        const st = updatedStages.find((s) => s.stageKey === stageKey);
        if (st) st.status = status;
      }

      project.installationStages = updatedStages as any;

      // Synchronize overall Handover date in project stageDates
      const handoverStage = updatedStages.find((s) => s.stageKey === 'HANDOVER');
      if (handoverStage) {
        if (!project.stageDates) project.stageDates = new Map();
        const existingTesting = project.stageDates.get('TESTING') || {};
        project.stageDates.set('TESTING', {
          ...existingTesting,
          scheduleDate: parseDateString(handoverStage.completeDate),
        });
      }

      // Synchronize Installation Start Date in project stageDates
      const firstStage = updatedStages[0];
      if (firstStage) {
        if (!project.stageDates) project.stageDates = new Map();
        const existingInst = project.stageDates.get('INSTALLATION') || {};
        project.stageDates.set('INSTALLATION', {
          ...existingInst,
          scheduleDate: parseDateString(firstStage.startDate),
        });
      }

      await project.save();

      const updatedStage = updatedStages.find((s) => s.stageKey === stageKey);
      const customer = project.customerId as any;

      // Activity log
      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'CUSTOMER_UPDATE',
        description: `Installation stage "${updatedStage?.stageName}" updated by ${req.user?.name || 'Technical Team Lead'}. Complete: ${updatedStage?.completeDate} (Reason: ${reason || 'Progress Adjustment'}). Cascaded schedule to Handover (${handoverStage?.completeDate}).`,
        userId: req.user?._id,
        userName: req.user?.name,
      });

      let whatsappResult = null;

      // WhatsApp Notification to customer group
      if (sendWhatsApp) {
        const isStageCompleted = status === 'COMPLETED' || reason === 'COMPLETED' || updatedStage?.status === 'COMPLETED';

        let whatsappMessage: string;
        let templateNameToRecord = 'STAGE_SCHEDULE_UPDATE';

        if (isStageCompleted) {
          templateNameToRecord = 'INSTALLATION_STAGE_COMPLETED';
          const nextStage = updatedStages.find((s: any) => s.slNo === (updatedStage?.slNo || 0) + 1);
          const isHandover = updatedStage?.slNo === 11 || updatedStage?.stageKey === 'HANDOVER';

          whatsappMessage =
            `✅ *ALPHA ELEVATORS — INSTALLATION STAGE COMPLETED*

Dear Sir/Madam,

*Project:* ${project.projectName} (${project.projectId})
*Customer:* ${customer?.fullName || 'Client'} (${customer?.city || project.siteAddress || 'Tamil Nadu'})

🎉 *Stage Completed:*
*Stage ${updatedStage?.slNo}/11:* ${updatedStage?.stageName}
*Status:* COMPLETED ✅
*Completion Date:* ${formatDateDisplay(parseDateString(updatedStage?.completeDate || formatDateISO(new Date())))}

${isHandover
              ? '🏆 *Elevator Installation & Final Testing Successfully Completed! Ready for Handover Formalities.*'
              : nextStage
                ? `➡️ *Next Upcoming Stage:* Stage ${nextStage.slNo} — ${nextStage.stageName}\n*Scheduled Start:* ${formatDateDisplay(parseDateString(nextStage.startDate))}\n`
                : ''}
🗓️ *Target Handover Date:* ${handoverStage ? formatDateDisplay(parseDateString(handoverStage.completeDate)) : 'Scheduled'}

Regards,
Alpha Elevators Team`;
        } else {
          const reasonText =
            reason === 'HOLIDAY'
              ? '🌴 Holiday / Official Non-Working Day'
              : reason === 'TECHNICAL_ISSUE'
                ? '⚙️ Technical Issue / On-Site Alignment Delay'
                : 'Operational Schedule Adjustment';

          whatsappMessage =
            `🔔 *ALPHA ELEVATORS — INSTALLATION SCHEDULE UPDATE*

Dear Sir/Madam,

*Project:* ${project.projectName} (${project.projectId})
*Customer:* ${customer?.fullName || 'Client'} (${customer?.city || project.siteAddress || 'Tamil Nadu'})

⚠️ *Stage Schedule Change:*
*Stage ${updatedStage?.slNo}:* ${updatedStage?.stageName}
*Scheduled Start:* ${formatDateDisplay(parseDateString(updatedStage?.startDate || ''))}
*Revised Completion:* ${formatDateDisplay(parseDateString(updatedStage?.completeDate || ''))}${oldCompleteDate ? ` (Previous: ${formatDateDisplay(parseDateString(oldCompleteDate))})` : ''}

📌 *Reason for Revision:* ${reasonText}
${notes ? `*Technical Notes:* ${notes}\n` : ''}
🗓️ *Updated Final Handover Target:* ${handoverStage ? formatDateDisplay(parseDateString(handoverStage.completeDate)) : 'Scheduled'}

Regards,
Alpha Elevators Team`;
        }

        try {
          const targetGroup = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;
          if (targetGroup) {
            const botStatus = whatsAppWebBot.getStatus();
            let sentViaBot = false;
            let providerMsgId = `STAGE_${Date.now()}`;

            if (config.wati.dryRun) {
              sentViaBot = true;
              providerMsgId = `DRY_STAGE_${Date.now()}`;
            } else if (botStatus.isConnected) {
              const botRes = await whatsAppWebBot.sendMessageToGroup(targetGroup, whatsappMessage);
              if (botRes.success) {
                sentViaBot = true;
                providerMsgId = botRes.messageId || providerMsgId;
              }
            }

            await WhatsAppMessageLog.create({
              projectId: project._id,
              groupId: targetGroup,
              messageText: whatsappMessage,
              messageType: 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: sentViaBot ? new Date() : undefined,
              providerMessageId: providerMsgId,
              status: sentViaBot ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
              attemptCount: 1,
              isDryRun: config.wati.dryRun,
            });

            await WhatsAppMessage.create({
              projectId: project._id,
              projectCode: project.projectId,
              customerId: customer?._id,
              customerName: customer?.fullName || 'Client',
              groupId: targetGroup,
              templateName: templateNameToRecord,
              messageType: 'text',
              recipientType: 'group',
              direction: 'OUTGOING',
              messageContent: whatsappMessage,
              status: sentViaBot ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
              sentAt: new Date(),
              isAutomated: false,
            });

            whatsappResult = { sent: true, message: 'WhatsApp update sent to customer group successfully' };
          } else {
            whatsappResult = { sent: false, message: 'No WhatsApp group linked to this project' };
          }
        } catch (wErr: any) {
          console.warn('[WhatsApp Stage Notification Error]:', wErr);
          whatsappResult = { sent: false, error: wErr.message };
        }
      }

      return res.json({
        success: true,
        message: 'Installation stage updated and subsequent stages cascaded successfully',
        data: updatedStages,
        whatsappResult,
      });
    } catch (err: any) {
      console.error('[Update Stage Error]:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/projects/:id/installation-stages/initialize
 * Re-initializes all 11 stages from a specified Installation Start Date
 */
projectRouter.post(
  '/:id/installation-stages/initialize',
  authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD', 'LOGISTICS_TL'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { installationStartDate, stage1CompleteDate, customStages } = req.body;
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

      let stages: any[] = [];
      if (Array.isArray(customStages) && customStages.length > 0) {
        stages = customStages.map((s: any, idx: number) => ({
          slNo: s.slNo || idx + 1,
          stageKey: s.stageKey || DEFAULT_INSTALLATION_STAGES[idx]?.stageKey || `STAGE_${idx + 1}`,
          stageName: s.stageName || DEFAULT_INSTALLATION_STAGES[idx]?.stageName || `Stage ${idx + 1}`,
          startDate: formatDateISO(toWorkingDay(parseDateString(s.startDate))),
          completeDate: formatDateISO(toWorkingDay(parseDateString(s.completeDate))),
          status: s.status || (idx === 0 ? 'IN_PROGRESS' : 'PENDING'),
          delayReason: s.delayReason || null,
          delayNotes: s.delayNotes || '',
        }));
      } else {
        const startDate = installationStartDate || project.installationDate || new Date();
        stages = generateInitialSchedule(startDate, DEFAULT_INSTALLATION_STAGES);

        if (stage1CompleteDate) {
          stages = cascadeScheduleUpdates(
            stages as any,
            'SHAFT_READINESS',
            formatDateISO(toWorkingDay(parseDateString(startDate))),
            formatDateISO(toWorkingDay(parseDateString(stage1CompleteDate)))
          ) as any;
        }
      }

      project.installationStages = stages as any;

      // Also set project stageDates
      if (!project.stageDates) project.stageDates = new Map();
      const existingInst = project.stageDates.get('INSTALLATION') || {};
      project.stageDates.set('INSTALLATION', {
        ...existingInst,
        scheduleDate: parseDateString(stages[0].startDate),
      });

      const handover = stages[stages.length - 1];
      const existingTesting = project.stageDates.get('TESTING') || {};
      project.stageDates.set('TESTING', {
        ...existingTesting,
        scheduleDate: parseDateString(handover.completeDate),
      });

      await project.save();

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'CUSTOMER_UPDATE',
        description: `11-Stage Installation Programme initialized from ${formatDateDisplay(parseDateString(stages[0].startDate))} to Handover ${formatDateDisplay(parseDateString(handover.completeDate))} by ${req.user?.name || 'Technical Team Lead'}.`,
        userId: req.user?._id,
        userName: req.user?.name,
      });

      return res.json({
        success: true,
        message: 'Installation Programme initialized successfully',
        data: stages,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/projects/:id/remind-site-visit
 * Manually trigger the Site Visit Scheduling Reminder for CRM, Admin, and the Connected Bot Number
 */
projectRouter.post(
  '/:id/remind-site-visit',
  authorize('ADMIN', 'CRM', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

      await triggerAdvancePaymentReminderForCRMAndAdmin(project._id);

      return res.json({
        success: true,
        message: `Site visit scheduling reminder dispatched successfully to CRM, Admin, and Connected Bot Number for project ${project.projectName}!`,
      });
    } catch (err: any) {
      console.error('[Remind Site Visit Route Error]:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

