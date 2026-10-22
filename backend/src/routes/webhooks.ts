import { Router, Request, Response } from 'express';
import { config } from '../config';
import {
  WebhookEvent,
  WhatsAppMessage,
  WhatsAppMessageLog,
  WhatsAppChannel,
  Project,
  Customer,
  SystemSettings,
} from '../models';
import { logProjectActivity } from '../services/activity/activityService';
import { whatsappService, watiService } from '../services/whatsapp';

export const webhookRouter = Router();

/**
 * GET /api/webhooks/whatsapp
 * Meta Webhook Verification Challenge
 */
webhookRouter.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Webhook:GET] Verification challenge received:', { mode, token, challenge });

  if (mode && token) {
    if (mode === 'subscribe' && token === config.meta.verifyToken) {
      console.log('[Webhook:GET] Verification challenge successful!');
      return res.status(200).send(challenge);
    } else {
      console.warn('[Webhook:GET] Verification failed. Token mismatch.');
      return res.status(403).send('Forbidden: Token mismatch');
    }
  }

  return res.status(400).send('Bad Request: Missing parameters');
});

/**
 * POST /api/webhooks/whatsapp
 * Ingest WhatsApp Business Cloud API Events
 */
webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  const body = req.body;

  // Immediately acknowledge receipt to Meta to avoid retries
  res.status(200).json({ status: 'EVENT_RECEIVED' });

  try {
    // Record webhook activity in SystemSettings
    await SystemSettings.updateOne(
      { key: 'GLOBAL_CONFIG' },
      { lastWebhookReceivedAt: new Date(), metaWebhookStatus: 'HEALTHY' }
    );

    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // 1. Process Message Status Updates (SENT, DELIVERED, READ, FAILED)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            await handleStatusUpdate(statusObj);
          }
        }

        // 2. Process Incoming Messages (including Group Messages)
        if (value.messages && Array.isArray(value.messages)) {
          for (const messageObj of value.messages) {
            await handleIncomingMessage(messageObj, value.contacts);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Webhook:POST] Error processing WhatsApp webhook:', err);
  }
});

/**
 * Process delivery receipts and read indicators
 */
async function handleStatusUpdate(statusObj: any): Promise<void> {
  const metaMessageId = statusObj.id;
  const statusStr = statusObj.status?.toUpperCase(); // delivered, read, failed, sent
  const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

  const eventId = `STATUS_${metaMessageId}_${statusStr}`;

  // Idempotency check
  const existingEvent = await WebhookEvent.findOne({ eventId });
  if (existingEvent) {
    return;
  }

  await WebhookEvent.create({
    eventId,
    eventType: 'statuses',
    payload: statusObj,
    status: 'PROCESSED',
  });

  const message = await WhatsAppMessage.findOne({ metaMessageId });
  if (!message) {
    return;
  }

  if (statusStr === 'DELIVERED') {
    message.status = 'DELIVERED';
    message.deliveredAt = timestamp;
  } else if (statusStr === 'READ') {
    message.status = 'READ';
    message.readAt = timestamp;
  } else if (statusStr === 'SENT') {
    if (message.status === 'SCHEDULED' || message.status === 'SENDING') {
      message.status = 'SENT';
      message.sentAt = timestamp;
    }
  } else if (statusStr === 'FAILED') {
    message.status = 'FAILED';
    message.failedAt = timestamp;
    const errorData = statusObj.errors?.[0];
    if (errorData) {
      message.errorCode = String(errorData.code);
      message.errorMessage = errorData.title || errorData.message || 'Delivery failed';
    }
  }

  await message.save();
}

/**
 * Process incoming group or direct messages from customers
 */
async function handleIncomingMessage(messageObj: any, contacts: any[] = []): Promise<void> {
  const messageId = messageObj.id;
  const eventId = `MSG_${messageId}`;

  // Idempotency check
  const existingEvent = await WebhookEvent.findOne({ eventId });
  if (existingEvent) {
    return;
  }

  await WebhookEvent.create({
    eventId,
    eventType: 'messages',
    payload: messageObj,
    status: 'PROCESSED',
  });

  // Extract group ID or sender
  const groupId = messageObj.group_id || messageObj.context?.group_id || messageObj.from;
  const senderPhone = messageObj.from;
  const senderName =
    contacts.find((c) => c.wa_id === senderPhone)?.profile?.name ||
    messageObj.profile?.name ||
    senderPhone;

  // Extract text or media description
  let messageContent = '';
  const msgType = messageObj.type || 'text';

  if (msgType === 'text') {
    messageContent = messageObj.text?.body || '';
  } else if (msgType === 'image') {
    messageContent = `[Image Received]: ${messageObj.image?.caption || 'Photo attached'}`;
  } else if (msgType === 'document') {
    messageContent = `[Document Received]: ${messageObj.document?.filename || 'File attached'}`;
  } else if (msgType === 'audio') {
    messageContent = '[Voice Note Received]';
  } else {
    messageContent = `[${msgType} message received]`;
  }

  // Find linked WhatsApp Channel by groupId or phone number
  let channel = await WhatsAppChannel.findOne({
    $or: [{ whatsappGroupId: groupId }, { 'participants.phoneNumber': senderPhone }],
  });

  // If not found by group ID, try searching Project directly
  let project = null;
  if (channel) {
    project = await Project.findById(channel.projectId);
  } else {
    project = await Project.findOne({ whatsappGroupId: groupId });
  }

  if (project) {
    await WhatsAppMessage.create({
      projectId: project._id,
      projectCode: project.projectId,
      customerId: project.customerId,
      customerName: senderName,
      groupId: groupId,
      metaMessageId: messageId,
      messageType: msgType === 'text' ? 'text' : 'document',
      recipientType: messageObj.group_id ? 'group' : 'individual',
      direction: 'INCOMING',
      senderName,
      senderPhone,
      messageContent,
      status: 'READ',
      isAutomated: false,
      readAt: new Date(),
    });

    // Update Channel lastMessageDate
    if (channel) {
      channel.lastMessageDate = new Date();
      await channel.save();
    }

    // Log Activity
    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'WHATSAPP_RECEIVED',
      description: `Customer message received in WhatsApp: "${messageContent}" from ${senderName}`,
      metadata: {
        metaMessageId: messageId,
        senderPhone,
        senderName,
      },
    });

    console.log(`[Webhook:POST] Successfully processed incoming message for project ${project.projectId}: "${messageContent}"`);
  } else {
    console.warn(`[Webhook:POST] Unlinked WhatsApp message received from ${senderPhone} (Group: ${groupId}). Content: "${messageContent}"`);
  }
}

/**
 * GET /api/webhooks/wati
 * WATI Webhook Health / Ping Verification
 */
webhookRouter.get('/wati', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'HEALTHY', provider: 'WATI' });
});

/**
 * POST /api/webhooks/wati
 * Ingest official WATI Delivery, Failure, and Inbound-Message Webhooks
 */
webhookRouter.post('/wati', async (req: Request, res: Response) => {
  // Validate webhook authenticity if configured
  if (!watiService.verifyWebhook(req)) {
    console.warn('[WatiWebhook] Rejected webhook with invalid signature.');
    return res.status(403).json({ error: 'Forbidden: Signature mismatch' });
  }

  // Acknowledge receipt to WATI immediately
  res.status(200).json({ result: true, status: 'EVENT_RECEIVED' });

  try {
    const body = req.body;
    if (!body) return;

    const eventType = body.eventType || body.event || body.type;
    const providerMsgId = body.whatsappMessageId || body.messageId || body.id;
    const statusStr = (body.status || eventType || '').toUpperCase();
    const eventId = `WATI_${providerMsgId || Date.now()}_${statusStr}`;

    // Idempotency check via WebhookEvent collection
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing) return;

    await WebhookEvent.create({
      eventId,
      eventType: eventType || 'wati_event',
      payload: body,
      status: 'PROCESSED',
    });

    // 1. Process delivery / read / failure status updates
    if (providerMsgId) {
      const log = await WhatsAppMessageLog.findOne({
        $or: [{ providerMessageId: providerMsgId }, { idempotencyKey: providerMsgId }],
      });

      if (log) {
        if (statusStr.includes('DELIVER') || statusStr === 'DELIVERED') {
          log.status = 'DELIVERED';
        } else if (statusStr.includes('READ') || statusStr === 'READ') {
          log.status = 'READ';
        } else if (statusStr.includes('FAIL') || statusStr === 'FAILED') {
          log.status = 'FAILED';
          log.lastError = body.error || body.message || 'Delivery failed';
        } else if (statusStr.includes('SENT') || statusStr === 'SENT') {
          if (log.status === 'SCHEDULED' || log.status === 'SENDING') {
            log.status = 'SENT';
            log.sentAt = new Date();
          }
        }
        await log.save();
      }

      // Also update legacy WhatsAppMessage
      const msg = await WhatsAppMessage.findOne({
        $or: [{ metaMessageId: providerMsgId }, { idempotencyKey: providerMsgId }],
      });
      if (msg) {
        if (statusStr.includes('DELIVER')) {
          msg.status = 'DELIVERED';
          msg.deliveredAt = new Date();
        } else if (statusStr.includes('READ')) {
          msg.status = 'READ';
          msg.readAt = new Date();
        } else if (statusStr.includes('FAIL')) {
          msg.status = 'FAILED';
          msg.failedAt = new Date();
          msg.errorMessage = body.error || body.message;
        }
        await msg.save();
      }
    }

    // 2. Process incoming messages (e.g. from customer or group)
    if (eventType === 'message' || eventType === 'messageCreated' || body.text || body.messageText) {
      const incomingText = body.text || body.messageText || body.data?.text || '';
      const senderPhone = body.waId || body.senderId || body.from || '';
      const senderName = body.senderName || body.name || senderPhone || 'Customer';
      const groupId = body.groupId || body.conversationId;

      // Find matching project
      let project = null;
      if (groupId) {
        project = await Project.findOne({
          $or: [{ 'whatsapp.groupId': groupId }, { whatsappGroupId: groupId }],
        });
      }
      if (!project && senderPhone) {
        const cleanPhone = senderPhone.replace(/\D/g, '');
        const cust = await Customer.findOne({
          $or: [
            { phoneNumber: { $regex: cleanPhone } },
            { whatsappNumber: { $regex: cleanPhone } },
          ],
        });
        if (cust) {
          project = await Project.findOne({ customerId: cust._id });
        }
      }

      if (project) {
        await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId: groupId || project.whatsapp?.groupId || 'DIRECT',
          messageText: incomingText,
          messageType: 'text',
          status: 'READ',
          attemptCount: 1,
          metadata: { direction: 'INCOMING', senderName, senderPhone },
        });

        await WhatsAppMessage.create({
          projectId: project._id,
          projectCode: project.projectId,
          customerId: project.customerId,
          customerName: senderName,
          groupId: groupId || project.whatsapp?.groupId || 'DIRECT',
          metaMessageId: providerMsgId || `WATI_IN_${Date.now()}`,
          messageType: 'text',
          recipientType: groupId ? 'group' : 'individual',
          direction: 'INCOMING',
          senderName,
          senderPhone,
          messageContent: incomingText,
          status: 'READ',
          isAutomated: false,
          readAt: new Date(),
        });

        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_RECEIVED',
          description: `Message received via WATI from ${senderName}: "${incomingText}"`,
          metadata: { providerMsgId, senderPhone },
        });
      }
    }
  } catch (err: any) {
    console.error('[WatiWebhook:POST] Error processing WATI webhook:', err);
  }
});
