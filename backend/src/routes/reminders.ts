import { Router, Response } from 'express';
import { Reminder, WhatsAppMessageLog } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { whatsAppWebBot } from '../services/whatsapp';
import {
  dispatchSiteVisitWhatsAppReminders,
  checkScheduleDateReminders,
  processDueReminders,
} from '../services/scheduler/schedulerService';

export const reminderRouter = Router();

reminderRouter.use(authenticate);

/**
 * GET /api/reminders
 * Fetch all reminders for the logged-in user
 */
reminderRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const query: any = { userId: req.user?._id };
    
    if (status) {
      query.status = status;
    }

    const reminders = await Reminder.find(query)
      .sort({ dueAt: 1 })
      .populate('relatedProjectId', 'projectId projectName')
      .lean();

    return res.json({ success: true, data: reminders });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/reminders/due
 * Fetch reminders that are currently due and pending
 */
reminderRouter.get('/due', async (req: AuthRequest, res: Response) => {
  try {
    const reminders = await Reminder.find({
      userId: req.user?._id,
      status: 'PENDING',
      dueAt: { $lte: new Date() }
    })
      .sort({ dueAt: 1 })
      .populate('relatedProjectId', 'projectId projectName')
      .lean();

    return res.json({ success: true, data: reminders });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders
 * Create a new reminder
 * If title or notes relate to Schedule site visit, also sends a message to yourself using the WhatsApp bot number!
 */
reminderRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, notes, dueAt, relatedProjectId } = req.body;

    if (!title || !dueAt) {
      return res.status(400).json({ success: false, message: 'Title and dueAt are required' });
    }

    const reminder = new Reminder({
      userId: req.user?._id,
      title,
      notes,
      dueAt: new Date(dueAt),
      relatedProjectId: relatedProjectId || undefined,
    });

    await reminder.save();

    // Check if this reminder is for Schedule Site Visit
    const isSiteVisit = /site\s*visit/i.test(title) || /site\s*visit/i.test(notes || '');
    if (isSiteVisit) {
      if (relatedProjectId) {
        // Dispatch reminders to CRM & yourself via WhatsApp Bot
        dispatchSiteVisitWhatsAppReminders(relatedProjectId, undefined, 'MANUAL_REMINDER_CREATED').catch((err) =>
          console.warn('[Reminders] Error dispatching site visit reminder:', err.message)
        );
      } else {
        // Dispatch yourself message directly via WhatsApp Bot number
        const selfMsg = `🔔 *CRM Reminder: Schedule Site Visit (Self Notification)* 🔔\n\n` +
          `A new reminder was scheduled in Alpha Elevators CRM:\n` +
          `• *Title:* ${title}\n` +
          (notes ? `• *Notes:* ${notes}\n` : '') +
          `• *Due Time:* ${new Date(dueAt).toLocaleString('en-IN')}\n\n` +
          `Please contact the customer and schedule the site visit.\n\n` +
          `Thank you,\nAlpha Elevators CRM`;

        whatsAppWebBot.sendSelfMessage(selfMsg).then(async (res) => {
          if (res.success) {
            await WhatsAppMessageLog.create({
              recipientPhone: whatsAppWebBot.getStatus().botPhoneNumber || 'Bot',
              recipientName: 'Yourself (WhatsApp Bot)',
              messageText: `[SITE VISIT REMINDER (MANUAL)]: \n${selfMsg}`,
              messageType: 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: res.messageId,
              status: 'SENT',
              attemptCount: 1,
              isDryRun: false,
            });
            console.log(`[Reminders] Yourself message dispatched via WhatsApp Bot for manual site visit reminder`);
          }
        }).catch((err) => console.warn('[Reminders] Error sending self reminder:', err.message));
      }
    }

    return res.status(201).json({ success: true, data: reminder });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/reminders/:id/dismiss
 * Dismiss a reminder
 */
reminderRouter.patch('/:id/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user?._id });
    
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }

    reminder.status = 'DISMISSED';
    await reminder.save();

    return res.json({ success: true, data: reminder });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders/check
 * Trigger immediate execution of schedule date reminder check & due reminders
 * (Guarantees dispatching to CRM, Admin, and the connected WhatsApp Bot Number for yourself)
 */
reminderRouter.post('/check', async (req: AuthRequest, res: Response) => {
  try {
    const { force } = req.body || {};
    const shouldForce = force !== undefined ? Boolean(force) : true;
    await checkScheduleDateReminders(shouldForce);
    await processDueReminders();
    return res.json({
      success: true,
      message: 'Schedule date reminders checked and WhatsApp alerts dispatched (including to yourself via bot number).'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders/test-dispatch
 * Debug endpoint to test dispatch directly and return raw result
 */
reminderRouter.post('/test-dispatch', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body || {};
    const targetId = projectId || '6ad9aec3762c87fa6c60bc36';
    const result = await dispatchSiteVisitWhatsAppReminders(targetId, 1000, 'TEST_CALL');
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});



