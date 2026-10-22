import { Router, Response } from 'express';
import {
  Project,
  Customer,
  WhatsAppChannel,
  WhatsAppMessage,
  WhatsAppMessageLog,
  WhatsAppTemplate,
} from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { whatsappService, watiService, whatsAppWebBot } from '../services/whatsapp';
import { logProjectActivity } from '../services/activity/activityService';
import {
  STAGE_TEMPLATE_MAP,
  STAGE_NEXT_MILESTONE_MAP,
  calculateNextUpdateDate,
  formatDateKey,
  generateProjectUpdateText,
  formatProjectStatus,
  POST_PRODUCTION_PAYMENT_STAGES,
} from '../services/scheduler/schedulerService';
import { config } from '../config';

/**
 * Format phone number to international E.164 standard (e.g. +919820011101)
 */
export function formatInternationalPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`; // Default to Indian regional dialing
  }
  return `+${digits}`;
}

export const whatsappRouter = Router();

whatsappRouter.use(authenticate);

/**
 * GET /api/whatsapp/channels
 */
whatsappRouter.get('/channels', async (req: AuthRequest, res: Response) => {
  try {
    const channels = await WhatsAppChannel.find().populate('projectId customerId').sort({ updatedAt: -1 });
    return res.json({ success: true, count: channels.length, data: channels });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/link
 * Links a unique WhatsApp Group ID to a project
 */
whatsappRouter.post('/link', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, whatsappGroupId, groupName } = req.body;

    if (!projectId || !whatsappGroupId) {
      return res.status(400).json({ success: false, message: 'Project ID and WhatsApp Group ID are required' });
    }

    const cleanGroupId = whatsappGroupId.trim();

    // Check if group is already assigned to a DIFFERENT project
    const existing = await WhatsAppChannel.findOne({
      whatsappGroupId: cleanGroupId,
      projectId: { $ne: projectId },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Group ID "${cleanGroupId}" is already assigned to project ${existing.projectCode}. Each project must have a unique WhatsApp Group ID.`,
      });
    }

    const project = await Project.findById(projectId).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const customer = project.customerId as any;
    const finalGroupName = groupName?.trim() || `${project.projectName} — Alpha Updates`;

    // Upsert WhatsAppChannel
    const channel = await WhatsAppChannel.findOneAndUpdate(
      { projectId: project._id },
      {
        whatsappGroupId: cleanGroupId,
        groupName: finalGroupName,
        projectCode: project.projectId,
        customerId: customer._id,
        customerName: customer.fullName,
        groupStatus: 'ACTIVE',
        automationEnabled: project.automationEnabled,
        updateFrequencyDays: project.updateFrequencyDays || 20,
        nextUpdateDate: project.nextUpdateAt,
        $addToSet: {
          participants: {
            phoneNumber: customer.phoneNumber,
            name: customer.fullName,
            role: 'MEMBER',
          },
        },
      },
      { upsert: true, new: true }
    );

    project.whatsappGroupId = cleanGroupId;
    project.whatsappGroupName = finalGroupName;
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `WhatsApp group linked: "${finalGroupName}" (Group ID: ${cleanGroupId})`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, data: channel, project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/send
 * Manual Override: Send stage update message immediately
 */
whatsappRouter.post('/send', authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, templateNameOverride, customNote, variables } = req.body;

    const project = await Project.findById(projectId).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const customer = project.customerId as any;

    if (!customer.whatsappOptIn) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send WhatsApp message: Customer WhatsApp opt-in is disabled.',
      });
    }

    if (!project.whatsappGroupId) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp group not linked. A valid WhatsApp Group ID is required before messaging.',
      });
    }

    const templateName = templateNameOverride || STAGE_TEMPLATE_MAP[project.projectStatus] || 'SITE_VISIT_SCHEDULE_PM';

    const approvedTemplate = await WhatsAppTemplate.findOne({
      templateName,
      templateStatus: 'APPROVED',
    });

    if (!approvedTemplate) {
      return res.status(400).json({
        success: false,
        message: `Template "${templateName}" is not marked APPROVED in the CRM.`,
      });
    }

    const stageNameFormatted = formatProjectStatus(project.projectStatus);
    const nextMilestone = STAGE_NEXT_MILESTONE_MAP[project.projectStatus] || 'Next project milestone';

    const variableValues = {
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

    let readableContent = approvedTemplate.bodyText;

    // Apply variable replacements if provided
    if (variables) {
      if (variables.date || variables.Date) {
        readableContent = readableContent.replace(/\[Date\]/gi, variables.date || variables.Date);
      }
      if (variables.time || variables.Time) {
        readableContent = readableContent.replace(/\[Time\]/gi, variables.time || variables.Time);
      }
      if (variables.trackingNumber || variables['Tracking Number']) {
        readableContent = readableContent.replace(/\[Tracking Number\]/gi, variables.trackingNumber || variables['Tracking Number']);
      }
    }

    // Default dynamic fallbacks if still containing placeholders
    if (readableContent.includes('[Date]')) {
      const stageDatesAny = project.stageDates as any;
      const siteVisitStage = stageDatesAny?.get ? stageDatesAny.get('SITE_MEASUREMENT') : stageDatesAny?.['SITE_MEASUREMENT'];
      const defaultDate = siteVisitStage?.scheduleDate
        ? new Date(siteVisitStage.scheduleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      readableContent = readableContent.replace(/\[Date\]/gi, defaultDate);
    }
    if (readableContent.includes('[Time]')) {
      readableContent = readableContent.replace(/\[Time\]/gi, '11:00 AM');
    }
    if (readableContent.includes('[Tracking Number]')) {
      const tracking = (project as any).vrlLrNumber || (project as any).trackingNumber || 'VRL-PENDING';
      readableContent = readableContent.replace(/\[Tracking Number\]/gi, tracking);
    }

    if (customNote && customNote.trim()) {
      readableContent += `\n\nNote: ${customNote.trim()}`;
    }

    const now = new Date();
    const dateKey = formatDateKey(now);
    const idempotencyKey = `MANUAL_${project.projectId}_${Date.now()}_${templateName}`;

    const messageDoc = await WhatsAppMessage.create({
      projectId: project._id,
      projectCode: project.projectId,
      customerId: customer._id,
      customerName: customer.fullName,
      groupId: project.whatsappGroupId,
      templateName,
      messageType: 'template',
      recipientType: 'group',
      direction: 'OUTGOING',
      messageContent: readableContent,
      status: 'SENDING',
      isAutomated: false,
      idempotencyKey,
      variablesPayload: variableValues,
    });

    const sendResult = await whatsappService.sendGroupTemplateMessage({
      recipientType: 'group',
      to: project.whatsappGroupId,
      templateName,
      languageCode: approvedTemplate.templateLanguage || 'en_US',
      components,
    });

    // If WhatsApp Web Bot is active, also dispatch actual readable text to group
    const botStatus = whatsAppWebBot.getStatus();
    if (botStatus.isConnected && project.whatsappGroupId) {
      try {
        await whatsAppWebBot.sendMessageToGroup(project.whatsappGroupId, readableContent);
      } catch (botErr: any) {
        console.warn('[WhatsApp] Web bot dispatch notice:', botErr.message);
      }
    }

    if (sendResult.success) {
      messageDoc.status = 'SENT';
      messageDoc.metaMessageId = sendResult.messageId;
      messageDoc.sentAt = new Date();
      messageDoc.rawResponse = sendResult.metaResponse;
      await messageDoc.save();

      // Advance productionStage and nextUpdateAt if project is in MANUFACTURING
      project.lastUpdateAt = new Date();
      project.postponedUntil = undefined;
      const interval = project.whatsapp?.intervalDays || project.updateFrequencyDays || 10;
      if (POST_PRODUCTION_PAYMENT_STAGES.includes(project.projectStatus)) {
        if (templateName === 'PRODUCTION_UPDATE_STAGE_1') {
          project.productionStage = 2;
          project.nextUpdateAt = calculateNextUpdateDate(interval, new Date());
        } else if (templateName === 'PRODUCTION_UPDATE_STAGE_2') {
          project.productionStage = 3;
          project.nextUpdateAt = calculateNextUpdateDate(interval, new Date());
        } else if (templateName === 'PRODUCTION_UPDATE_STAGE_3') {
          project.productionStage = 4;
          project.nextUpdateAt = undefined;
        } else {
          project.nextUpdateAt = calculateNextUpdateDate(interval, new Date());
        }
        if (project.whatsapp) {
          project.whatsapp.lastUpdateAt = project.lastUpdateAt;
          project.whatsapp.nextUpdateAt = project.nextUpdateAt;
        }
      } else {
        project.nextUpdateAt = undefined;
        if (project.whatsapp) {
          project.whatsapp.nextUpdateAt = undefined;
        }
      }
      await project.save();

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'WHATSAPP_SENT',
        description: `Manual WhatsApp update sent by ${req.user?.name} to group (${project.whatsappGroupName || project.whatsappGroupId}). Template: ${templateName}`,
        userId: req.user?._id,
        userName: req.user?.name,
        metadata: {
          metaMessageId: sendResult.messageId,
          templateName,
          isTestMode: sendResult.isTestMode,
        },
      });

      return res.json({
        success: true,
        message: 'WhatsApp update sent successfully',
        data: messageDoc,
        isTestMode: sendResult.isTestMode,
      });
    } else {
      messageDoc.status = 'FAILED';
      messageDoc.failedAt = new Date();
      messageDoc.errorCode = 'META_DISPATCH_ERROR';
      messageDoc.errorMessage = sendResult.error || 'Failed to dispatch via Meta API';
      await messageDoc.save();

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'WHATSAPP_FAILED',
        description: `Manual WhatsApp update dispatch failed: ${sendResult.error}`,
        userId: req.user?._id,
        userName: req.user?.name,
        metadata: { error: sendResult.error },
      });

      return res.status(502).json({
        success: false,
        message: `Failed to send WhatsApp message: ${sendResult.error}`,
        data: messageDoc,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/postpone
 * Postpones next scheduled update by specified days (e.g. 3, 5, 7 days)
 */
whatsappRouter.post('/postpone', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, postponeDays = 7, reason } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const currentTarget = project.nextUpdateAt || new Date();
    const newNextDate = new Date(currentTarget);
    newNextDate.setDate(newNextDate.getDate() + Number(postponeDays));
    newNextDate.setHours(9, 0, 0, 0);

    project.nextUpdateAt = newNextDate;
    project.postponedUntil = newNextDate;
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'CUSTOMER_UPDATE',
      description: `WhatsApp update postponed by ${postponeDays} days to ${newNextDate.toDateString()}. ${reason ? `Reason: ${reason}` : ''}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({
      success: true,
      message: `Update postponed to ${newNextDate.toDateString()}`,
      nextUpdateAt: newNextDate,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/pause
 */
whatsappRouter.post('/pause', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, reason } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    project.automationEnabled = false;
    project.pauseReason = reason || 'Manually paused by CRM agent';
    await project.save();

    await WhatsAppChannel.findOneAndUpdate({ projectId: project._id }, { automationEnabled: false, groupStatus: 'PAUSED' });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `WhatsApp automation PAUSED. Reason: ${project.pauseReason}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'WhatsApp automation paused', project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/resume
 */
whatsappRouter.post('/resume', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    project.automationEnabled = true;
    project.pauseReason = undefined;
    project.nextUpdateAt = calculateNextUpdateDate(project.updateFrequencyDays || 20, new Date());
    await project.save();

    await WhatsAppChannel.findOneAndUpdate({ projectId: project._id }, { automationEnabled: true, groupStatus: 'ACTIVE' });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `WhatsApp automation RESUMED. Next update scheduled for ${project.nextUpdateAt.toDateString()}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'WhatsApp automation resumed', project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/whatsapp/frequency
 */
whatsappRouter.patch('/frequency', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, frequencyDays } = req.body;

    const days = parseInt(frequencyDays, 10);
    if (!days || days < 1) {
      return res.status(400).json({ success: false, message: 'Valid frequency days required (min 1 day)' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    project.updateFrequencyDays = days;
    project.nextUpdateAt = calculateNextUpdateDate(days, project.lastUpdateAt || new Date());
    await project.save();

    await WhatsAppChannel.findOneAndUpdate({ projectId: project._id }, { updateFrequencyDays: days });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'CUSTOMER_UPDATE',
      description: `WhatsApp update frequency changed to every ${days} days. Next update: ${project.nextUpdateAt.toDateString()}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/reply
 * Send direct text message response to customer / group
 */
whatsappRouter.post('/reply', authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, messageText } = req.body;

    if (!projectId || !messageText) {
      return res.status(400).json({ success: false, message: 'Project ID and message text are required' });
    }

    const project = await Project.findById(projectId).populate('customerId');
    if (!project || !project.whatsappGroupId) {
      return res.status(404).json({ success: false, message: 'Project or linked WhatsApp group not found' });
    }

    const customer = project.customerId as any;

    const sendResult = await whatsappService.sendGroupTextMessage({
      recipientType: 'group',
      to: project.whatsappGroupId,
      text: messageText,
    });

    const msgDoc = await WhatsAppMessage.create({
      projectId: project._id,
      projectCode: project.projectId,
      customerId: customer._id,
      customerName: customer.fullName,
      groupId: project.whatsappGroupId,
      metaMessageId: sendResult.messageId,
      messageType: 'text',
      recipientType: 'group',
      direction: 'OUTGOING',
      senderName: req.user?.name,
      messageContent: messageText,
      status: sendResult.success ? 'SENT' : 'FAILED',
      sentAt: sendResult.success ? new Date() : undefined,
      failedAt: sendResult.success ? undefined : new Date(),
      errorMessage: sendResult.error,
      isAutomated: false,
    });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'WHATSAPP_SENT',
      description: `Manual reply sent to WhatsApp group by ${req.user?.name}: "${messageText}"`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, data: msgDoc });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/messages
 * Global message log
 */
whatsappRouter.get('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 100, direction, status } = req.query;
    const query: any = {};
    if (direction) query.direction = direction;
    if (status) query.status = status;

    const messages = await WhatsAppMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.json({ success: true, count: messages.length, data: messages });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/config/validate
 * Validates backend WATI API connection & configuration
 */
whatsappRouter.get('/config/validate', async (req: AuthRequest, res: Response) => {
  try {
    const status = await watiService.validateConfiguration();
    return res.json({ success: true, data: status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/projects/:id/group
 * Create a WhatsApp Group for CRM Project via WATI
 */
whatsappRouter.post('/projects/:id/group', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const { groupNameOverride, intervalDays = 15, dryRun, existingGroupId: inputGroupId, inviteLink, forceRelink } = req.body;

    const project = await Project.findById(projectId).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const customer = project.customerId as any;
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer record not found for project' });
    }

    // Customer consent validation
    if (!customer.whatsappOptIn) {
      return res.status(400).json({
        success: false,
        message: 'Customer has not consented to WhatsApp communications (whatsappOptIn is disabled). Please confirm consent before creating a group.',
      });
    }

    // Duplicate check: Verify whether a group is already linked to this project (unless forceRelink is specified)
    const existingGroupId = project.whatsapp?.groupId || project.whatsappGroupId;
    if (existingGroupId && !forceRelink) {
      return res.status(409).json({
        success: false,
        message: `Project already has an active WhatsApp group linked (Group ID: ${existingGroupId}). Duplicate creation prevented.`,
        data: { groupId: existingGroupId, groupName: project.whatsapp?.groupName || project.whatsappGroupName },
      });
    }

    // Format customer phone number in international E.164 format
    const rawPhone = customer.whatsappNumber || customer.phoneNumber;
    const formattedPhone = formatInternationalPhone(rawPhone);
    if (!formattedPhone || formattedPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: `Invalid customer phone number: ${rawPhone}. International format required.`,
      });
    }

    const groupName = groupNameOverride?.trim() || `${project.projectName} — Alpha Updates`;

    // Validate intervalDays
    const allowedIntervals = [1, 10, 15, 20];
    const chosenInterval = allowedIntervals.includes(Number(intervalDays)) ? Number(intervalDays) : 15;
    const nextUpdate = calculateNextUpdateDate(chosenInterval, new Date());

    // If user provided an existing group link or existing group ID, link directly
    if (inputGroupId || inviteLink) {
      const assignedId = inputGroupId?.trim() || `wati_grp_${Date.now()}`;
      project.whatsapp = {
        provider: 'WATI',
        groupId: assignedId,
        groupName,
        inviteLink: inviteLink?.trim() || undefined,
        botPhoneNumber: '+91 93848 20316',
        invitationStatus: 'ACCEPTED',
        groupStatus: 'ACTIVE',
        updatesEnabled: true,
        paused: false,
        intervalDays: chosenInterval as 1 | 10 | 15 | 20,
        nextUpdateAt: nextUpdate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      project.whatsappGroupId = assignedId;
      project.whatsappGroupName = groupName;
      project.automationEnabled = true;
      project.updateFrequencyDays = chosenInterval;
      project.nextUpdateAt = nextUpdate;
      await project.save();

      await WhatsAppChannel.findOneAndUpdate(
        { projectId: project._id },
        {
          whatsappGroupId: assignedId,
          groupName,
          projectCode: project.projectId,
          customerId: customer._id,
          customerName: customer.fullName,
          groupStatus: 'ACTIVE',
          automationEnabled: true,
          updateFrequencyDays: chosenInterval,
          nextUpdateDate: nextUpdate,
          participants: [{ phoneNumber: formattedPhone, name: customer.fullName, role: 'MEMBER' }],
        },
        { upsert: true, new: true }
      );

      return res.status(201).json({
        success: true,
        message: 'Existing WhatsApp Group linked successfully',
        data: { project, group: { groupId: assignedId, groupName, inviteLink } },
      });
    }

    // Call WATI Provider createGroup
    const result = await watiService.createGroup(
      {
        name: groupName,
        description: `Project updates for ${project.projectName} by Alpha Elevators`,
        contactTargets: [formattedPhone],
        ownerEmail: config.wati.ownerEmail,
      },
      { dryRun: dryRun === true || config.wati.dryRun }
    );

    if (result.success && result.groupId) {
      // Store in MongoDB
      const nextUpdate = calculateNextUpdateDate(chosenInterval, new Date());
      project.whatsapp = {
        provider: 'WATI',
        groupId: result.groupId,
        groupName: result.groupName || groupName,
        invitationStatus: 'PENDING',
        groupStatus: 'ACTIVE',
        updatesEnabled: true,
        paused: false,
        intervalDays: chosenInterval as 1 | 10 | 15 | 20,
        nextUpdateAt: nextUpdate,
        lastUpdateAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      project.whatsappGroupId = result.groupId;
      project.whatsappGroupName = result.groupName || groupName;
      project.automationEnabled = true;
      project.updateFrequencyDays = chosenInterval;
      project.nextUpdateAt = nextUpdate;
      await project.save();

      // Upsert WhatsAppChannel
      await WhatsAppChannel.findOneAndUpdate(
        { projectId: project._id },
        {
          whatsappGroupId: result.groupId,
          groupName: result.groupName || groupName,
          projectCode: project.projectId,
          customerId: customer._id,
          customerName: customer.fullName,
          groupStatus: 'ACTIVE',
          automationEnabled: true,
          updateFrequencyDays: chosenInterval,
          nextUpdateDate: nextUpdate,
          participants: [
            {
              phoneNumber: formattedPhone,
              name: customer.fullName,
              role: 'MEMBER',
            },
          ],
        },
        { upsert: true, new: true }
      );

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'STATUS_CHANGE',
        description: `WATI WhatsApp group created: "${groupName}" (Group ID: ${result.groupId}) with update cadence ${chosenInterval} days.`,
        userId: req.user?._id,
        userName: req.user?.name,
        metadata: { groupId: result.groupId, isDryRun: result.isDryRun },
      });

      return res.status(201).json({
        success: true,
        message: 'WhatsApp group created successfully',
        data: {
          project,
          group: result,
        },
      });
    } else {
      // Handle Meta Groups API restriction (Error 131000)
      if (result.metaGroupsRestricted) {
        return res.status(400).json({
          success: false,
          metaGroupsRestricted: true,
          errorCode: 131000,
          message: result.error || 'Meta WhatsApp Cloud API restricts programmatic group creation on this account (Error 131000).',
          details: 'Meta restricts automated group creation to accounts with specialized Groups API permissions. You can easily link an existing WhatsApp group directly by pasting the group invite link, or use Dry-Run mode.',
        });
      }

      // Group creation returned error (e.g. OBA required code 7013)
      if (result.requiresOba) {
        // Record status in project so UI indicates OBA requirement
        if (!project.whatsapp) {
          project.whatsapp = {
            provider: 'WATI',
            invitationStatus: 'FAILED',
            groupStatus: 'AWAITING_OBA_APPROVAL',
            updatesEnabled: false,
            paused: true,
            intervalDays: chosenInterval as 10 | 15 | 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await project.save();
        }
        return res.status(400).json({
          success: false,
          requiresOba: true,
          errorCode: 7013,
          message: result.error || 'WATI requires Official Business Account (OBA / Blue Tick) verification to create WhatsApp Groups via API.',
          details: 'You may verify your WhatsApp Business account or use Dry-Run mode to simulate group automation.',
        });
      }

      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to create WhatsApp group via WATI',
        errorCode: result.errorCode,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/whatsapp/projects/:id/group
 * Unlink/remove WhatsApp group from project
 */
whatsappRouter.delete('/projects/:id/group', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    project.whatsapp = undefined;
    project.whatsappGroupId = undefined;
    project.whatsappGroupName = undefined;
    project.automationEnabled = false;
    await project.save();

    await WhatsAppChannel.deleteOne({ projectId: project._id });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: 'WhatsApp group unlinked from project.',
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'WhatsApp group unlinked successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/projects/:id/group
 * Get WhatsApp group metadata and status for a project
 */
whatsappRouter.get('/projects/:id/group', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const customer = project.customerId as any;
    const groupId = project.whatsapp?.groupId || project.whatsappGroupId;

    let watiGroupDetails = null;
    if (groupId) {
      try {
        const details = await watiService.getGroupDetails(groupId);
        if (details.success && details.group) {
          watiGroupDetails = details.group;
        }
      } catch {
        // Ignore external query failure
      }
    }

    const channel = await WhatsAppChannel.findOne({ projectId: project._id });

    return res.json({
      success: true,
      data: {
        projectId: project.projectId,
        projectName: project.projectName,
        customerName: customer?.fullName,
        customerPhone: formatInternationalPhone(customer?.whatsappNumber || customer?.phoneNumber),
        consentGiven: !!customer?.whatsappOptIn,
        whatsapp: project.whatsapp || {
          provider: 'WATI',
          groupId: project.whatsappGroupId,
          groupName: project.whatsappGroupName,
          invitationStatus: project.whatsappGroupId ? 'PENDING' : 'NOT_INVITED',
          groupStatus: project.whatsappGroupId ? 'ACTIVE' : 'NOT_LINKED',
          updatesEnabled: project.automationEnabled,
          paused: !project.automationEnabled,
          intervalDays: project.updateFrequencyDays || 15,
          nextUpdateAt: project.nextUpdateAt,
          lastUpdateAt: project.lastUpdateAt,
        },
        channel,
        watiDetails: watiGroupDetails,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/projects/:id/group/invite
 * Send invites to pending contacts
 */
whatsappRouter.post('/projects/:id/group/invite', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const groupId = project.whatsapp?.groupId || project.whatsappGroupId;
    if (!groupId) {
      return res.status(400).json({ success: false, message: 'No WhatsApp group linked to this project' });
    }

    const inviteResult = await watiService.inviteContacts({ groupId });
    if (inviteResult.success) {
      if (project.whatsapp) {
        project.whatsapp.invitationStatus = 'SENT';
        await project.save();
      }

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'STATUS_CHANGE',
        description: `WATI group invitation sent to pending contacts for group ${groupId}`,
        userId: req.user?._id,
        userName: req.user?.name,
      });

      return res.json({ success: true, message: 'Group invitations sent successfully', data: inviteResult });
    } else {
      return res.status(400).json({ success: false, message: inviteResult.error || 'Failed to dispatch invitations' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/whatsapp/projects/:id/config
 * Update intervalDays (10, 15, 20) and automation toggle
 */
whatsappRouter.patch('/projects/:id/config', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { intervalDays, updatesEnabled } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (intervalDays !== undefined) {
      const allowed = [1, 10, 15, 20];
      const parsedDays = Number(intervalDays);
      if (!allowed.includes(parsedDays)) {
        return res.status(400).json({
          success: false,
          message: `Invalid interval value: ${intervalDays}. Allowed update intervals are 1, 10, 15, or 20 days.`,
        });
      }
      project.updateFrequencyDays = parsedDays;
      if (!project.whatsapp) {
        project.whatsapp = {
          provider: 'WATI',
          groupId: project.whatsappGroupId,
          groupName: project.whatsappGroupName,
          invitationStatus: 'PENDING',
          groupStatus: 'ACTIVE',
          updatesEnabled: project.automationEnabled,
          paused: !project.automationEnabled,
          intervalDays: parsedDays as 1 | 10 | 15 | 20,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        project.whatsapp.intervalDays = parsedDays as 1 | 10 | 15 | 20;
      }
      project.nextUpdateAt = calculateNextUpdateDate(parsedDays, project.lastUpdateAt || new Date());
      project.whatsapp.nextUpdateAt = project.nextUpdateAt;
    }

    if (updatesEnabled !== undefined) {
      const enabled = Boolean(updatesEnabled);
      project.automationEnabled = enabled;
      if (project.whatsapp) {
        project.whatsapp.updatesEnabled = enabled;
        project.whatsapp.paused = !enabled;
      }
    }

    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `WhatsApp automation settings updated: Interval = ${project.updateFrequencyDays} days, Enabled = ${project.automationEnabled}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'Configuration saved successfully', project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/projects/:id/pause
 */
whatsappRouter.post('/projects/:id/pause', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    project.automationEnabled = false;
    project.pauseReason = reason || 'Paused by Project Manager';
    if (project.whatsapp) {
      project.whatsapp.paused = true;
      project.whatsapp.updatesEnabled = false;
      project.whatsapp.groupStatus = 'PAUSED';
    }
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `WhatsApp automation paused: ${project.pauseReason}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'Automation paused', project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/projects/:id/resume
 */
whatsappRouter.post('/projects/:id/resume', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    project.automationEnabled = true;
    project.pauseReason = undefined;
    const interval = project.whatsapp?.intervalDays || project.updateFrequencyDays || 15;
    project.nextUpdateAt = calculateNextUpdateDate(interval, new Date());
    if (project.whatsapp) {
      project.whatsapp.paused = false;
      project.whatsapp.updatesEnabled = true;
      project.whatsapp.groupStatus = 'ACTIVE';
      project.whatsapp.nextUpdateAt = project.nextUpdateAt;
    }
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `WhatsApp automation resumed. Next update: ${project.nextUpdateAt.toDateString()}`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'Automation resumed', project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/projects/:id/preview
 * Previews the next scheduled message generated from verified database attributes
 */
whatsappRouter.get('/projects/:id/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { customNote } = req.query;
    const project = await Project.findById(req.params.id).populate('customerId');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const customer = project.customerId as any;
    const previewText = generateProjectUpdateText(project, customer, typeof customNote === 'string' ? customNote : undefined);

    return res.json({
      success: true,
      data: {
        projectId: project.projectId,
        projectName: project.projectName,
        customerName: customer?.fullName,
        currentStage: project.projectStatus,
        nextMilestone: STAGE_NEXT_MILESTONE_MAP[project.projectStatus] || 'Next milestone in progress',
        previewText,
        nextScheduledAt: project.nextUpdateAt,
        intervalDays: project.whatsapp?.intervalDays || project.updateFrequencyDays || 15,
        targetGroupId: project.whatsapp?.groupId || project.whatsappGroupId || 'Not Linked',
        inviteLink: project.whatsapp?.inviteLink,
        botPhoneNumber: project.whatsapp?.botPhoneNumber || '+91 93848 20316',
        participants: project.whatsapp?.participants || [],
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/projects/:id/participants
 * List all WhatsApp broadcast participants for a project
 */
whatsappRouter.get('/projects/:id/participants', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id).populate('customerId');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const customer = project.customerId as any;
    const participants = project.whatsapp?.participants || [];

    return res.json({
      success: true,
      primaryCustomer: {
        name: customer?.fullName || 'Primary Client',
        phone: customer?.whatsappNumber || customer?.phoneNumber,
        role: 'PRIMARY_CLIENT',
      },
      participants,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/projects/:id/participants
 * Add an additional WhatsApp broadcast recipient to project
 */
whatsappRouter.post('/projects/:id/participants', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, name, role = 'MEMBER' } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: 'Phone number is required' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    if (!project.whatsapp) {
      project.whatsapp = {
        provider: 'WATI',
        invitationStatus: 'ACCEPTED',
        groupStatus: 'ACTIVE',
        updatesEnabled: true,
        paused: false,
        intervalDays: 15,
      };
    }

    if (!project.whatsapp.participants) {
      project.whatsapp.participants = [];
    }

    const cleanDigits = phoneNumber.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10+ digit phone number required' });
    }
    const formattedPhone = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : `+${cleanDigits}`;

    // Avoid duplicates
    const exists = project.whatsapp.participants.some(p => p.phoneNumber.replace(/\D/g, '') === cleanDigits);
    if (!exists) {
      project.whatsapp.participants.push({
        phoneNumber: formattedPhone,
        name: name?.trim() || 'Project Member',
        role,
      });
      await project.save();
    }

    return res.json({
      success: true,
      message: `Participant ${name || formattedPhone} added successfully`,
      participants: project.whatsapp.participants,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/whatsapp/projects/:id/participants/:phone
 * Remove participant from project WhatsApp channel
 */
whatsappRouter.delete('/projects/:id/participants/:phone', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const targetPhoneDigits = req.params.phone.replace(/\D/g, '');
    if (project.whatsapp?.participants) {
      project.whatsapp.participants = project.whatsapp.participants.filter(
        p => p.phoneNumber.replace(/\D/g, '') !== targetPhoneDigits
      );
      await project.save();
    }

    return res.json({
      success: true,
      message: 'Participant removed successfully',
      participants: project.whatsapp?.participants || [],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/projects/:id/send-test
 * Dispatch automated message to all project recipients via WATI API
 */
whatsappRouter.post('/projects/:id/send-test', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { customNote, dryRun } = req.body;
    const project = await Project.findById(req.params.id).populate('customerId');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const customer = project.customerId as any;
    const groupId = project.whatsapp?.groupId || project.whatsappGroupId;

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'No WhatsApp group linked to this project' });
    }

    if (!customer?.whatsappOptIn) {
      return res.status(400).json({ success: false, message: 'Customer has not consented to WhatsApp communications.' });
    }

    const messageText = generateProjectUpdateText(project, customer, customNote);
    const isDry = dryRun === true || config.wati.dryRun;

    // Collect all recipients: Primary Customer + Additional Participants
    const recipients: Array<{ phone: string; name: string; role: string }> = [];
    const customerPhone = customer?.whatsappNumber || customer?.phoneNumber;
    if (customerPhone) {
      recipients.push({
        phone: customerPhone,
        name: customer.fullName || 'Customer',
        role: 'PRIMARY_CLIENT',
      });
    }

    if (Array.isArray(project.whatsapp?.participants)) {
      for (const p of project.whatsapp.participants) {
        if (p.phoneNumber && !recipients.some(r => r.phone.replace(/\D/g, '') === p.phoneNumber.replace(/\D/g, ''))) {
          recipients.push({
            phone: p.phoneNumber,
            name: p.name || 'Participant',
            role: p.role || 'MEMBER',
          });
        }
      }
    }

    // If targetType is GROUP or explicit group post requested (or default when group is linked)
    if (req.body.targetType === 'GROUP' || (!req.body.targetType && (project.whatsapp?.inviteLink || groupId))) {
      const inviteTarget = project.whatsapp?.inviteLink || groupId;
      const botStatus = whatsAppWebBot.getStatus();

      if (isDry) {
        const log = await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId,
          messageText,
          messageType: 'text',
          scheduledAt: new Date(),
          attemptedAt: new Date(),
          sentAt: new Date(),
          providerMessageId: `DRY_GRP_${Date.now()}`,
          status: 'SENT',
          attemptCount: 1,
          isDryRun: true,
        });

        return res.json({
          success: true,
          isDryRun: true,
          message: 'Dry-Run update recorded for WhatsApp Group!',
          data: log,
        });
      }

      if (botStatus.isConnected) {
        const botResult = await whatsAppWebBot.sendMessageToGroup(inviteTarget, messageText);
        if (botResult.success) {
          const log = await WhatsAppMessageLog.create({
            projectId: project._id,
            groupId,
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
            groupId,
            templateName: STAGE_TEMPLATE_MAP[project.projectStatus] || 'SITE_VISIT_COMPLETED',
            messageType: 'template',
            recipientType: 'group',
            direction: 'OUTGOING',
            messageContent: messageText,
            status: 'SENT',
            sentAt: new Date(),
            isAutomated: false,
            idempotencyKey: `SEND_TEST_${project.projectId}_${Date.now()}`,
          });

          await logProjectActivity({
            projectId: project._id,
            projectCode: project.projectId,
            type: 'WHATSAPP_SENT',
            description: `WhatsApp update dispatched directly inside group "${project.whatsappGroupName || project.projectName}" via Web Bot`,
            userId: req.user?._id,
            userName: req.user?.name,
          });

          return res.json({
            success: true,
            message: 'Message delivered automatically inside the WhatsApp group!',
            data: log,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: botResult.error || 'Failed to dispatch message inside group',
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          requiresScan: true,
          botStatus: botStatus.status,
          qrCode: botStatus.qrCode,
          message: 'WhatsApp Web Bot is not connected. Please scan the QR code to link your bot for automatic group posting.',
        });
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid recipient phone numbers found for this project.' });
    }

    if (isDry) {
      const logs = [];
      for (const r of recipients) {
        const simulatedId = `test_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const log = await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId,
          messageText,
          messageType: 'text',
          scheduledAt: new Date(),
          attemptedAt: new Date(),
          sentAt: new Date(),
          providerMessageId: simulatedId,
          status: 'SENT',
          attemptCount: 1,
          isDryRun: true,
        });
        logs.push(log);
      }

      return res.json({
        success: true,
        isDryRun: true,
        message: `Dry-Run broadcast recorded for ${recipients.length} recipients.`,
        data: logs[0],
        recipientsCount: recipients.length,
      });
    }

    // Live dispatch to all registered recipients via WATI API
    const dispatchResults: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const r of recipients) {
      const sendResult = await watiService.sendGroupText({
        groupId,
        customerPhone: r.phone,
        text: messageText,
        targetType: 'DIRECT',
      });

      if (sendResult.success) {
        successCount++;
        const log = await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId,
          messageText,
          messageType: 'text',
          scheduledAt: new Date(),
          attemptedAt: new Date(),
          sentAt: new Date(),
          providerMessageId: sendResult.messageId,
          status: 'SENT',
          attemptCount: 1,
          isDryRun: false,
        });
        dispatchResults.push({ recipient: r, success: true, messageId: sendResult.messageId });
      } else {
        failureCount++;
        const log = await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId,
          messageText,
          messageType: 'text',
          scheduledAt: new Date(),
          attemptedAt: new Date(),
          status: (sendResult.status as any) || 'FAILED',
          attemptCount: 1,
          lastError: sendResult.error,
          isDryRun: false,
        });
        dispatchResults.push({ recipient: r, success: false, error: sendResult.error });
      }
    }

    const recipientNames = recipients.map(r => r.name).join(', ');
    const msg = successCount > 0
      ? `Dispatched update via WATI API to ${successCount} of ${recipients.length} recipients (${recipientNames}).`
      : `Failed to dispatch to recipients: ${dispatchResults[0]?.error || 'Provider rejected request'}`;

    return res.json({
      success: successCount > 0,
      message: msg,
      successCount,
      failureCount,
      totalRecipients: recipients.length,
      results: dispatchResults,
      data: dispatchResults[0],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/projects/:id/messages
 * List project message log history (WhatsAppMessageLog)
 */
whatsappRouter.get('/projects/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const logs = await WhatsAppMessageLog.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(100);

    // Also include any legacy messages
    const legacy = await WhatsAppMessage.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      count: logs.length,
      data: {
        logs,
        legacy,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/messages/:id/retry
 * Retry eligible failed message log
 */
whatsappRouter.post('/messages/:id/retry', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const log = await WhatsAppMessageLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Message log not found' });

    if (log.status !== 'FAILED' && log.status !== 'AWAITING_PROVIDER_CAPABILITY') {
      return res.status(400).json({ success: false, message: `Job with status "${log.status}" is not eligible for retry.` });
    }

    log.attemptCount += 1;
    log.attemptedAt = new Date();

    const project = await Project.findById(log.projectId).populate('customerId');
    const customer = project?.customerId as any;
    const customerPhone = customer?.whatsappNumber || customer?.phoneNumber;
    const inviteTarget = project?.whatsapp?.inviteLink || log.groupId;
    const botStatus = whatsAppWebBot.getStatus();

    let sendResult: any;

    if (log.groupId) {
      // Group message: Use WhatsApp Web Bot, do not use WATI
      if (botStatus.isConnected && inviteTarget) {
        console.log(`[Retry] Retrying group message via WhatsApp Web Bot for target: ${inviteTarget}`);
        sendResult = await whatsAppWebBot.sendMessageToGroup(inviteTarget, log.messageText);
      } else {
        return res.status(400).json({
          success: false,
          requiresScan: true,
          botStatus: botStatus.status,
          qrCode: botStatus.qrCode,
          message: 'WhatsApp Web Bot is not connected. Please scan the QR code in WhatsApp settings to link your bot for group messaging.',
        });
      }
    } else {
      sendResult = await watiService.sendGroupText({
        groupId: log.groupId,
        customerPhone,
        text: log.messageText,
      });
    }

    if (sendResult.success) {
      log.status = 'SENT';
      log.sentAt = new Date();
      log.providerMessageId = sendResult.messageId || `BOT_RETRY_${Date.now()}`;
      log.lastError = undefined;
      await log.save();
      return res.json({ success: true, message: 'Message retried and sent successfully inside group', data: log });
    } else {
      log.status = sendResult.status as any || 'FAILED';
      log.lastError = sendResult.error;
      await log.save();
      return res.json({ success: false, message: sendResult.error, data: log });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/whatsapp/bot/status
 * Check connection status and retrieve QR code
 */
whatsappRouter.get('/bot/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = whatsAppWebBot.getStatus();
    return res.json({ success: true, ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/bot/initialize
 * Start or regenerate QR code
 */
whatsappRouter.post('/bot/initialize', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await whatsAppWebBot.initialize();
    const status = whatsAppWebBot.getStatus();
    return res.json({ success: true, message: 'WhatsApp Web Bot initialized', ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/whatsapp/bot/logout
 * Log out and clear bot session
 */
whatsappRouter.post('/bot/logout', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await whatsAppWebBot.logout();
    const status = whatsAppWebBot.getStatus();
    return res.json({ success: true, message: 'WhatsApp Web Bot logged out', ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

