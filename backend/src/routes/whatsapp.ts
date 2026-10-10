import { Router, Response } from 'express';
import {
  Project,
  Customer,
  WhatsAppChannel,
  WhatsAppMessage,
  WhatsAppTemplate,
} from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp';
import { logProjectActivity } from '../services/activity/activityService';
import {
  STAGE_TEMPLATE_MAP,
  STAGE_NEXT_MILESTONE_MAP,
  calculateNextUpdateDate,
  formatDateKey,
} from '../services/scheduler/schedulerService';

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
whatsappRouter.post('/send', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, templateNameOverride, customNote } = req.body;

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

    const templateName = templateNameOverride || STAGE_TEMPLATE_MAP[project.projectStatus] || 'PROGRESS_UPDATE';

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

    const stageNameFormatted = project.projectStatus.replace(/_/g, ' ');
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

    const readableContent = `Hello ${variableValues.customer_name},\n\nProject Update — ${variableValues.project_name}\n\nCurrent Stage: ${variableValues.project_stage}\nNext Milestone: ${variableValues.next_milestone}${customNote ? `\n\nNote: ${customNote}` : ''}\n\nWe will continue to keep you updated.\nThank you,\nAlpha Elevators`;

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

    if (sendResult.success) {
      messageDoc.status = 'SENT';
      messageDoc.metaMessageId = sendResult.messageId;
      messageDoc.sentAt = new Date();
      messageDoc.rawResponse = sendResult.metaResponse;
      await messageDoc.save();

      // Advance next update date by frequency
      project.lastUpdateAt = new Date();
      project.nextUpdateAt = calculateNextUpdateDate(project.updateFrequencyDays || 20, new Date());
      project.postponedUntil = undefined;
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
whatsappRouter.post('/reply', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
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
