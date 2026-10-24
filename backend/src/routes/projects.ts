import { Router, Response } from 'express';
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
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, req.params.id + '-drawing-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

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

    const defaultMessage = `${greeting} Sir,

We have successfully completed the site visit on the scheduled date and shared the site visit report with you via email.

Kindly review the report and confirm your approval by replying to the email so that we can initiate the drawing process based on the site measurements.

Thank you for your support and cooperation.

Regards,  
CRM Department  
Alpha Elevators`;

    const template = await WhatsAppTemplate.findOne({ templateName: 'SITE_VISIT_COMPLETED', templateStatus: 'APPROVED' });
    let messageText = defaultMessage;
    if (template?.bodyText) {
      // Dynamic time-based replacement of the greeting
      messageText = template.bodyText.replace(/Good (Morning|Afternoon|Evening)/i, greeting);
    }

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

projectRouter.use(authenticate);

/**
 * GET /api/projects
 */
projectRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, paymentStatus, search, updateDue, employee } = req.query;
    const query: any = {};

    if (req.user?.role === 'BDM') {
      query.bdmId = req.user._id;
    }

    if (status && typeof status === 'string') {
      if (status.includes(',')) {
        query.projectStatus = { $in: status.split(',') };
      } else if (status === 'ACTIVE') {
        query.projectStatus = { $nin: ['COMPLETED', 'CANCELLED'] };
      } else {
        query.projectStatus = status;
      }
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
      query.$or = [
        { nextUpdateAt: { $lte: endOfDay } },
        { nextUpdateAt: { $exists: false } },
        { nextUpdateAt: null },
      ];
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { projectName: searchRegex },
        { projectId: searchRegex },
        { liftModel: searchRegex },
        { siteAddress: searchRegex },
      ];
    }

    const projects = await Project.find(query).populate('customerId').sort({ createdAt: -1 });
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
      liftModel,
      liftType,
      numberOfFloors,
      shaftModel,
      liftAmount = 0,
      shaftAmount = 0,
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

    if (!customerId || !projectName || !siteAddress || !orderValue || !expectedDeliveryDate) {
      return res.status(400).json({
        success: false,
        message: 'Customer, project name, site address, order value, and expected delivery date are required',
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const count = await Project.countDocuments();
    const projectId = `ALP-${String(count + 1).padStart(3, '0')}`;

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
      siteAddress: siteAddress.trim(),
      liftModel: liftModel || 'Hydraulic Home Series',
      liftType: liftType || 'Home Lift',
      numberOfFloors,
      shaftModel: shaftModel?.trim(),
      liftAmount: Number(liftAmount),
      shaftAmount: Number(shaftAmount),
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
      expectedDeliveryDate: new Date(expectedDeliveryDate),
      projectStatus: 'PAYMENT_RECEIVED',
      assignedEmployee: assignedEmployee || req.user?.name,
      projectManager,
      bdmId: customer.bdmId,
      bdmPhone: customer.bdmPhone,
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
 * GET /api/projects/:id
 */
projectRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
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
projectRouter.put('/:id', authorize('ADMIN', 'CRM', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    Object.assign(project, req.body);

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
projectRouter.patch('/:id/status', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes, vrlLrNumber, trackingNumber, productionTimelineDays } = req.body;
    const project = await Project.findById(req.params.id);
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
      if (!project.productionStage || project.productionStage < 1) {
        project.productionStage = 1;
      }
      // If the 3 production updates are still in progress, ensure nextUpdateAt is scheduled
      if (project.productionStage <= 3) {
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
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: status === 'CUSTOMER_APPROVAL'
        ? `Project status updated to Drawing and Cabin Design Approval. Production timeline set to ${project.productionTimelineDays || 60} days. ${notes ? `Note: ${notes}` : ''}`
        : status === 'MANUFACTURING'
        ? `Project status updated to MANUFACTURING (Approval Drawing to factory). Stage 1 Production Update scheduled in ${intervalDays} days.`
        : status === 'DISPATCH' && project.vrlLrNumber
        ? `Project status updated to DISPATCH (Expected Delivery). VRL Tracking No: ${project.vrlLrNumber}. ${notes ? `Note: ${notes}` : ''}`
        : `Project status updated from ${prevStatus} to ${status}. ${notes ? `Note: ${notes}` : ''}`,
      userId: req.user?._id,
      userName: req.user?.name,
      metadata: { previousStatus: prevStatus, newStatus: status, intervalDays, vrlLrNumber: project.vrlLrNumber, productionTimelineDays: project.productionTimelineDays },
    });

    // Milestone update messages directly inside WhatsApp group via Web Bot!
    // Note: MANUFACTURING does not send immediate message because Stage 1 is sent after intervalDays
    let groupMessageDispatched = false;
    let groupMessageError: string | null = null;
    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;

    if (inviteTarget && status !== 'MANUFACTURING') {
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
    } else if (status === 'MANUFACTURING') {
      resultMsg = `Stage updated to Approval Drawing to factory. Automated Stage 1 Production Update scheduled in ${intervalDays} days.`;
    } else if (status === 'DISPATCH' && project.vrlLrNumber && groupMessageDispatched) {
      resultMsg = `Stage updated to Expected Delivery! VRL Tracking No (${project.vrlLrNumber}) attached and template message posted directly inside WhatsApp group!`;
    } else if (status === 'DISPATCH' && project.vrlLrNumber) {
      resultMsg = `Stage updated to Expected Delivery with VRL Tracking No: ${project.vrlLrNumber}.`;
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
projectRouter.patch('/:id/stage-dates', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { stageKey, scheduleDate, executedDate } = req.body;
    if (!stageKey) {
      return res.status(400).json({ success: false, message: 'stageKey is required' });
    }

    if (req.user?.role === 'BDM' && stageKey !== 'CUSTOMER_APPROVAL') {
      return res.status(403).json({ success: false, message: 'BDMs can only update dates for the Drawing and Cabin Design Approval stage' });
    }

    const project = await Project.findById(req.params.id);
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

    project.stageDates.set(stageKey, currentDates);
    await project.save();

    if (stageKey === 'PAYMENT_RECEIVED' && executedDate) {
      await triggerAdvancePaymentReminderForCRM(project._id);
    } else if (stageKey === 'SITE_MEASUREMENT' && scheduleDate) {
      await dismissScheduleDateRemindersForProject(project._id);
    }

    if (stageKey === 'SITE_MEASUREMENT' && executedDate) {
      await dispatchSiteVisitCompletedMessage(project, req.user);
    }

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/stage-dates-bulk
 */
projectRouter.patch('/:id/stage-dates-bulk', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'updates must be an array' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM' && project.bdmId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    if (!project.stageDates) {
      project.stageDates = new Map();
    }

    for (const update of updates) {
      const { stageKey, scheduleDate, executedDate } = update;
      
      if (req.user?.role === 'BDM' && stageKey !== 'CUSTOMER_APPROVAL') {
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

    const project = await Project.findById(req.params.id);
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
projectRouter.post('/:id/drawing', authorize('ADMIN', 'CRM', 'MANAGER'), upload.single('drawing'), async (req: AuthRequest, res: Response) => {
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
        const caption = `Hello ${customerName}! 📄\n\n*Drawing & Cabin Design Uploaded*\nProject: ${project.projectName} (${project.liftModel || 'Elevator'})\nStage: Drawing and Cabin Design Approval\n\nPlease find the approved drawing and cabin design document attached above for your review and sign-off.\n\nThank you,\nAlpha Elevators Team`;
        
        const fullFilePath = req.file.path
          ? path.resolve(req.file.path)
          : path.resolve(__dirname, '../../uploads', req.file.filename);
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
      crmPhone = crmUser?.phone || '+91 98200 54321';
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
  authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD'),
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

_Alpha Elevators Technical Installation Team is executing on-site work as per standards._`;
        } else {
          const reasonText =
            reason === 'HOLIDAY'
              ? '🌴 Holiday / Official Non-Working Day'
              : reason === 'TECHNICAL_ISSUE'
              ? '⚙️ Technical Issue / On-Site Alignment Delay'
              : 'Operational Schedule Adjustment';

          whatsappMessage = 
`🔔 *ALPHA ELEVATORS — INSTALLATION SCHEDULE UPDATE*

*Project:* ${project.projectName} (${project.projectId})
*Customer:* ${customer?.fullName || 'Client'} (${customer?.city || project.siteAddress || 'Tamil Nadu'})

⚠️ *Stage Schedule Change:*
*Stage ${updatedStage?.slNo}:* ${updatedStage?.stageName}
*Scheduled Start:* ${formatDateDisplay(parseDateString(updatedStage?.startDate || ''))}
*Revised Completion:* ${formatDateDisplay(parseDateString(updatedStage?.completeDate || ''))}${oldCompleteDate ? ` (Previous: ${formatDateDisplay(parseDateString(oldCompleteDate))})` : ''}

📌 *Reason for Revision:* ${reasonText}
${notes ? `*Technical Notes:* ${notes}\n` : ''}
🗓️ *Updated Final Handover Target:* ${handoverStage ? formatDateDisplay(parseDateString(handoverStage.completeDate)) : 'Scheduled'}

Notice: @Admin @CRM Team

_Alpha Elevators Technical Installation Team is monitoring on-site progress._`;
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
  authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD'),
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

