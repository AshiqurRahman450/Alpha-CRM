import { Router, Response } from 'express';
import { Reminder, WhatsAppMessageLog, Project, Customer, Quotation } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { whatsAppWebBot } from '../services/whatsapp';
import {
  dispatchSiteVisitWhatsAppReminders,
  checkScheduleDateReminders,
  processDueReminders,
} from '../services/scheduler/schedulerService';

export const reminderRouter = Router();

export const PROJECT_STAGE_NEXT_WORK: Record<
  string,
  { currentLabel: string; nextStageKey: string; nextWork: string; description: string }
> = {
  PAYMENT_RECEIVED: {
    currentLabel: 'Advance Payment Received',
    nextStageKey: 'SITE_MEASUREMENT',
    nextWork: 'Schedule Site Visit (PM)',
    description: 'Coordinate with customer to schedule site visit for shaft measurements.',
  },
  SITE_MEASUREMENT: {
    currentLabel: 'Site Visit',
    nextStageKey: 'DESIGN',
    nextWork: 'Prepare Drawing & Cabin Design',
    description: 'Draft civil shaft layout and cabin design options for client review.',
  },
  DESIGN: {
    currentLabel: 'Drawing and Cabin',
    nextStageKey: 'CUSTOMER_APPROVAL',
    nextWork: 'Obtain Client Design Approval',
    description: 'Share elevator drawings & cabin finish options with customer for approval.',
  },
  CUSTOMER_APPROVAL: {
    currentLabel: 'Drawing and Cabin Design Approval',
    nextStageKey: 'ENGINEERING',
    nextWork: 'Collect Production Payment (40%)',
    description: 'Request 40% production payment milestone from customer before manufacturing.',
  },
  ENGINEERING: {
    currentLabel: 'Production Payment',
    nextStageKey: 'MANUFACTURING',
    nextWork: 'Issue Approval Drawing to Factory',
    description: 'Release approved technical drawings to manufacturing plant for fabrication.',
  },
  MANUFACTURING: {
    currentLabel: 'Approval Drawing to factory',
    nextStageKey: 'QUALITY_CHECK',
    nextWork: 'Collect Readiness Payment (20%)',
    description: 'Notify customer of material readiness and collect 20% readiness payment.',
  },
  QUALITY_CHECK: {
    currentLabel: 'Rediness Payment',
    nextStageKey: 'DELIVERY',
    nextWork: 'Conduct Pre-Site Visit Inspection',
    description: 'Inspect site readiness, electrical power supply, and hoistway clearance.',
  },
  DELIVERY: {
    currentLabel: 'Pre Site Visit',
    nextStageKey: 'DISPATCH',
    nextWork: 'Dispatch Materials & Confirm Delivery',
    description: 'Dispatch elevator components via logistics and provide tracking number.',
  },
  DISPATCH: {
    currentLabel: 'Expected Delivery',
    nextStageKey: 'INSTALLATION',
    nextWork: 'Commence Elevator Installation',
    description: 'Deploy installation engineering crew for 11-stage erection programme.',
  },
  INSTALLATION: {
    currentLabel: 'Installation Start Date',
    nextStageKey: 'TESTING',
    nextWork: 'Complete Testing & Handover',
    description: 'Conduct final high-speed testing, safety commissioning, and customer handover.',
  },
  TESTING: {
    currentLabel: 'Handover',
    nextStageKey: 'COMPLETED',
    nextWork: 'Finalize Project Completion & Sign-off',
    description: 'Obtain final handover sign-off certificate and warranty activation.',
  },
};

/**
 * Automatically synchronizes Next Work reminders for every active project for CRM/Admin users
 */
async function syncProjectNextWorkReminders(userId: any) {
  try {
    const activeProjects = await Project.find({
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
    }).populate('customerId', 'fullName customerId phoneNumber');

    for (const p of activeProjects) {
      const stageInfo = PROJECT_STAGE_NEXT_WORK[p.projectStatus];
      if (!stageInfo) continue;

      const customer: any = p.customerId || {};
      const customerName = customer.fullName || p.projectName || 'Client';

      const title = `Next Move: ${stageInfo.nextWork} - ${p.projectName} (${p.projectId})`;
      const notes = `Customer: ${customerName} (${customer.phoneNumber || 'N/A'}). Current Stage: ${stageInfo.currentLabel}. Next step to move project forward: ${stageInfo.nextWork} — ${stageInfo.description}`;
      const dueAt = p.nextUpdateAt || new Date();

      const existing = await Reminder.findOne({
        userId,
        relatedProjectId: p._id,
        type: 'PROJECT_NEXT_WORK',
        status: 'PENDING',
      });

      if (existing) {
        if (existing.title !== title) {
          existing.title = title;
          existing.notes = notes;
          existing.dueAt = dueAt;
          existing.customerName = customerName;
          await existing.save();
        }
      } else {
        await Reminder.create({
          userId,
          title,
          notes,
          dueAt,
          status: 'PENDING',
          type: 'PROJECT_NEXT_WORK',
          relatedProjectId: p._id,
          relatedCustomerId: customer._id || p.customerId,
          customerName,
          actionRequired: true,
        });
      }
    }
  } catch (err: any) {
    console.warn('[SyncProjectNextWorkReminders] Error:', err.message);
  }
}

reminderRouter.use(authenticate);

/**
 * GET /api/reminders
 * Fetch all reminders for the logged-in user, including quotation approval requests & project next work
 */
reminderRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const isCrmOrAdmin = req.user?.role === 'CRM' || req.user?.role === 'ADMIN';

    // For CRM and Admin, keep active project next-work reminders synchronized
    if (isCrmOrAdmin && req.user?._id) {
      await syncProjectNextWorkReminders(req.user._id);
    }

    const orConditions: any[] = [
      { userId: req.user?._id },
      { type: 'QUOTATION_APPROVAL' },
      {
        type: 'WHATSAPP_MESSAGE',
        whatsappGroupId: { $exists: true, $nin: ['', null, 'DIRECT'] },
      },
    ];
    if (isCrmOrAdmin) {
      orConditions.push({ type: 'PROJECT_NEXT_WORK' });
    }

    const query: any = {
      $or: orConditions,
    };

    if (status) {
      query.status = status;
    }

    const reminders = await Reminder.find(query)
      .sort({ dueAt: -1 })
      .populate('relatedProjectId', 'projectId projectName projectStatus liftModel customerId')
      .populate('relatedQuotationId', 'offerNo customerName status data createdCustomerCode createdProjectCode')
      .populate('relatedCustomerId', 'fullName customerId phoneNumber city')
      .lean();

    return res.json({ success: true, data: reminders });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/reminders/due
 * Fetch reminders that are currently due and pending (including Quotation approvals, project next work & WhatsApp customer messages)
 */
reminderRouter.get('/due', async (req: AuthRequest, res: Response) => {
  try {
    const isCrmOrAdmin = req.user?.role === 'CRM' || req.user?.role === 'ADMIN';

    const orConditions: any[] = [
      { userId: req.user?._id },
      { type: 'QUOTATION_APPROVAL' },
      {
        type: 'WHATSAPP_MESSAGE',
        whatsappGroupId: { $exists: true, $nin: ['', null, 'DIRECT'] },
      },
    ];
    if (isCrmOrAdmin) {
      orConditions.push({ type: 'PROJECT_NEXT_WORK' });
    }

    const reminders = await Reminder.find({
      $or: orConditions,
      status: 'PENDING',
      dueAt: { $lte: new Date() },
    })
      .sort({ dueAt: -1 })
      .populate('relatedProjectId', 'projectId projectName projectStatus liftModel customerId')
      .populate('relatedQuotationId', 'offerNo customerName status data createdCustomerCode createdProjectCode')
      .populate('relatedCustomerId', 'fullName customerId phoneNumber city')
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
    let reminder;
    if (req.user?.role === 'CRM' || req.user?.role === 'ADMIN') {
      reminder = await Reminder.findById(req.params.id);
    } else {
      reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user?._id });
    }
    
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



