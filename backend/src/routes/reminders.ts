import { Router, Response } from 'express';
import { Reminder, WhatsAppMessageLog, Project, Customer, Quotation, User } from '../models';
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
    nextWork: 'Begin Production in progress',
    description: 'Initiate elevator fabrication and manufacturing sequence.',
  },
  MANUFACTURING: {
    currentLabel: 'Production in progress',
    nextStageKey: 'QUALITY_CHECK',
    nextWork: 'Collect Readiness Payment (20%)',
    description: 'Complete 6-stage manufacturing and notify client of material readiness.',
  },
  PRODUCTION_IN_PROGRESS: {
    currentLabel: 'Production in progress',
    nextStageKey: 'QUALITY_CHECK',
    nextWork: 'Collect Readiness Payment (20%)',
    description: 'Complete 6-stage manufacturing and notify client of material readiness.',
  },
  QUALITY_CHECK: {
    currentLabel: 'Readiness Payment',
    nextStageKey: 'DISPATCH',
    nextWork: 'Dispatch Elevator Materials (VRL)',
    description: 'Collect readiness payment and dispatch elevator materials.',
  },
  DISPATCH: {
    currentLabel: 'Material Dispatched',
    nextStageKey: 'MATERIAL_IN_TRANSIT',
    nextWork: 'Track Material in Transit',
    description: 'Consignment moving via logistics with VRL tracking number.',
  },
  MATERIAL_DISPATCHED: {
    currentLabel: 'Material Dispatched',
    nextStageKey: 'MATERIAL_IN_TRANSIT',
    nextWork: 'Track Material in Transit',
    description: 'Consignment moving via logistics with VRL tracking number.',
  },
  MATERIAL_IN_TRANSIT: {
    currentLabel: 'Material in transit',
    nextStageKey: 'DELIVERY',
    nextWork: 'Conduct Pre-Site Visit Inspection',
    description: 'Inspect site readiness, hoistway, and power supply before delivery.',
  },
  DELIVERY: {
    currentLabel: 'Pre Site Visit',
    nextStageKey: 'MATERIAL_DELIVERY',
    nextWork: 'Receive Material Delivery at Site',
    description: 'Receive materials at site and commence unloading.',
  },
  MATERIAL_DELIVERY: {
    currentLabel: 'Material Delivery',
    nextStageKey: 'INSTALLATION',
    nextWork: 'Commence Elevator Installation',
    description: 'Deploy installation engineering crew for erection programme.',
  },
  INSTALLATION: {
    currentLabel: 'Installation in Progress',
    nextStageKey: 'TESTING',
    nextWork: 'Complete Testing & Handover Formalities',
    description: 'Complete 11-stage erection programme and safety testing.',
  },
  TESTING: {
    currentLabel: 'Handover - Payment Pending',
    nextStageKey: 'COMPLETED',
    nextWork: 'Collect Handover Payment & Final Sign-off',
    description: 'Collect final handover payment and issue warranty certificate.',
  },
  COMPLETED: {
    currentLabel: 'Project Completed',
    nextStageKey: 'COMPLETED',
    nextWork: 'Project Completed (AMC Active)',
    description: 'Project fully commissioned and operational.',
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
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.name?.toLowerCase().includes('nithesh');

    // For CRM and Admin, keep active project next-work reminders synchronized
    if (isCrmOrAdmin && req.user?._id) {
      await syncProjectNextWorkReminders(req.user._id);
    }

    const orConditions: any[] = [
      { userId: req.user?._id },
      {
        type: 'WHATSAPP_MESSAGE',
        whatsappGroupId: { $exists: true, $nin: ['', null, 'DIRECT'] },
      },
    ];
    if (isCrmOrAdmin) {
      orConditions.push({
        userId: { $in: [null, undefined] },
        type: { $in: ['QUOTATION_APPROVAL', 'PROJECT_NEXT_WORK'] },
      });
    }
    // Fast-Track Delivery Approval reminders are strictly visible ONLY to Admin role (Nithesh Babu)
    if (isAdmin) {
      orConditions.push({
        type: 'DELIVERY_APPROVAL',
      });
    }

    const query: any = {
      $or: orConditions,
    };

    if (status) {
      query.status = status;
    }

    const rawReminders = await Reminder.find(query)
      .sort({ dueAt: -1 })
      .populate('relatedProjectId', 'projectId projectName projectStatus liftModel customerId')
      .populate('relatedQuotationId', 'offerNo customerName status data createdCustomerCode createdProjectCode')
      .populate('relatedCustomerId', 'fullName customerId phoneNumber city')
      .lean();

    // Deduplicate reminders: ensure that if there are any duplicate pending quotation approvals
    // or project next work reminders in the DB, only one reminder per quotation/project is returned
    const seenApprovalQuotations = new Set<string>();
    const seenProjectNextWork = new Set<string>();

    const reminders = rawReminders.filter((rem: any) => {
      if (rem.type === 'QUOTATION_APPROVAL' && rem.status === 'PENDING') {
        const quotKey = String(
          rem.relatedQuotationId?._id ||
          rem.relatedQuotationId ||
          rem.relatedQuotationOfferNo ||
          rem.customerName ||
          rem._id
        );
        if (seenApprovalQuotations.has(quotKey)) return false;
        seenApprovalQuotations.add(quotKey);
      } else if (rem.type === 'PROJECT_NEXT_WORK' && rem.status === 'PENDING') {
        const projKey = String(
          rem.relatedProjectId?._id ||
          rem.relatedProjectId ||
          rem.title ||
          rem._id
        );
        if (seenProjectNextWork.has(projKey)) return false;
        seenProjectNextWork.add(projKey);
      } else if (rem.type === 'DELIVERY_APPROVAL') {
        // Show delivery approval reminder strictly to Admin (Nithesh Babu) ONLY
        if (!isAdmin) return false;
      }
      return true;
    });

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
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.name?.toLowerCase().includes('nithesh');

    const orConditions: any[] = [
      { userId: req.user?._id },
      {
        type: 'WHATSAPP_MESSAGE',
        whatsappGroupId: { $exists: true, $nin: ['', null, 'DIRECT'] },
      },
    ];
    if (isCrmOrAdmin) {
      orConditions.push({
        userId: { $in: [null, undefined] },
        type: { $in: ['QUOTATION_APPROVAL', 'PROJECT_NEXT_WORK'] },
      });
    }
    if (isAdmin) {
      orConditions.push({
        type: 'DELIVERY_APPROVAL',
      });
    }

    const rawReminders = await Reminder.find({
      $or: orConditions,
      status: 'PENDING',
      dueAt: { $lte: new Date() },
    })
      .sort({ dueAt: -1 })
      .populate('relatedProjectId', 'projectId projectName projectStatus liftModel customerId')
      .populate('relatedQuotationId', 'offerNo customerName status data createdCustomerCode createdProjectCode')
      .populate('relatedCustomerId', 'fullName customerId phoneNumber city')
      .lean();

    const seenApprovalQuotations = new Set<string>();
    const seenProjectNextWork = new Set<string>();

    const reminders = rawReminders.filter((rem: any) => {
      if (rem.type === 'QUOTATION_APPROVAL' && rem.status === 'PENDING') {
        const quotKey = String(
          rem.relatedQuotationId?._id ||
          rem.relatedQuotationId ||
          rem.relatedQuotationOfferNo ||
          rem.customerName ||
          rem._id
        );
        if (seenApprovalQuotations.has(quotKey)) return false;
        seenApprovalQuotations.add(quotKey);
      } else if (rem.type === 'PROJECT_NEXT_WORK' && rem.status === 'PENDING') {
        const projKey = String(
          rem.relatedProjectId?._id ||
          rem.relatedProjectId ||
          rem.title ||
          rem._id
        );
        if (seenProjectNextWork.has(projKey)) return false;
        seenProjectNextWork.add(projKey);
      } else if (rem.type === 'DELIVERY_APPROVAL') {
        if (!isAdmin) return false;
      }
      return true;
    });

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

    // If dismissing a quotation approval reminder, dismiss all copies across users
    if (reminder.type === 'QUOTATION_APPROVAL') {
      const dismissFilter: any = { type: 'QUOTATION_APPROVAL', status: 'PENDING' };
      if (reminder.relatedQuotationId) {
        dismissFilter.relatedQuotationId = reminder.relatedQuotationId;
      } else if (reminder.relatedQuotationOfferNo) {
        dismissFilter.relatedQuotationOfferNo = reminder.relatedQuotationOfferNo;
      }
      await Reminder.updateMany(dismissFilter, { status: 'DISMISSED' });
    }

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
 * POST /api/reminders/delivery-approval
 * Create a Fast-Track Delivery Approval Reminder (60 / 90 Days) for Nithesh Babu (Admin)
 * and dispatches 1-to-1 WhatsApp request to selected phone numbers (7810091290, 9884998125, or both)
 */
reminderRouter.post('/delivery-approval', async (req: AuthRequest, res: Response) => {
  try {
    const {
      offerNo,
      customerName,
      model,
      city,
      days,
      targetPhones,
      reason,
      quotationId,
    } = req.body;

    const requestedDays = Number(days) || 60;
    const clientName = customerName?.trim() || 'Client';
    const offerCode = offerNo?.trim() || 'DRAFT-QUOTATION';

    // 1. Find Admin user ID
    const adminUser = await User.findOne({
      $or: [
        { role: 'ADMIN' },
        { name: /nithesh/i },
        { phone: /7810091290|9884998125/ }
      ]
    }).lean();

    const targetUserId = adminUser?._id || req.user?._id;

    const title = `⚡ Fast-Track Delivery Approval: ${requestedDays} Days for ${clientName}`;
    const notes = `Customer: ${clientName} | Quotation: ${offerCode} | Model: ${model || 'Alpha Elevator'} | City: ${city || 'Chennai'} | Requested Delivery: ${requestedDays} Days (Standard: 120 Days).${reason ? ` Reason: ${reason}` : ''} Requires Admin (Nithesh Babu) approval.`;

    // 2. Create pending reminder for Admin
    const reminder = await Reminder.create({
      userId: targetUserId,
      title,
      notes,
      dueAt: new Date(),
      status: 'PENDING',
      type: 'DELIVERY_APPROVAL',
      customerName: clientName,
      relatedQuotationOfferNo: offerCode,
      relatedQuotationId: quotationId,
      requestedDeliveryDays: requestedDays,
      actionRequired: true,
      targetAdminPhone: Array.isArray(targetPhones) ? targetPhones.join(', ') : String(targetPhones || '7810091290'),
      requestedByUserId: req.user?._id,
      requestedByUserName: req.user?.name || 'BDM',
      requestedByUserPhone: req.user?.phone,
    });

    // 3. Update Quotation record in DB if exists (or create stub)
    if (offerCode) {
      await Quotation.updateOne(
        { $or: [{ offerNo: offerCode }, { _id: quotationId }] },
        {
          $set: {
            'data.deliveryApprovalStatus': 'PENDING',
            'data.deliveryApprovalDays': requestedDays,
            'data.deliveryApprovalRequestedAt': new Date().toISOString(),
            'data.requestedByUserId': req.user?._id,
            'data.requestedByUserName': req.user?.name || 'BDM',
            'data.requestedByUserPhone': req.user?.phone,
          }
        }
      ).catch(() => {});
    }

    // 4. Send direct WhatsApp message via WhatsApp Web Bot if available
    const waText = `🚨 *FAST-TRACK DELIVERY APPROVAL REQUEST* 🚨\n\nDear Nithesh Babu,\nAn expedited delivery timeline of *${requestedDays} Days* has been requested for quotation approval:\n\n👤 *Customer Name:* ${clientName}\n🏢 *Elevator Model:* ${model || 'Alpha Elevator'}\n📄 *Offer No:* ${offerCode}\n📍 *Site / City:* ${city || 'Chennai'}\n⏱️ *Requested Timeline:* ${requestedDays} Days (Standard: 120 Days)\n${reason ? `📝 *Reason:* ${reason}\n` : ''}\nPlease approve this expedited delivery schedule in Alpha CRM Reminders so this proposal can be issued.`;

    const phonesToSend: string[] = Array.isArray(targetPhones) ? targetPhones : [targetPhones || '7810091290'];
    const waResults: any[] = [];

    const botStatus = whatsAppWebBot.getStatus();
    if (botStatus.isConnected) {
      for (const phone of phonesToSend) {
        const clean = String(phone).replace(/\D/g, '').slice(-10);
        if (clean.length === 10) {
          try {
            const sendRes = await whatsAppWebBot.sendDirectMessage(`91${clean}`, waText);
            waResults.push({ phone: clean, success: sendRes.success });
          } catch (e: any) {
            waResults.push({ phone: clean, success: false, error: e.message });
          }
        }
      }
    }

    return res.json({
      success: true,
      message: `Fast-track delivery approval (${requestedDays} Days) requested successfully for Nithesh Babu.`,
      reminder,
      waResults,
      waText,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/reminders/delivery-approval/status
 * Check if expedited delivery approval has been granted by Nithesh Babu for a quotation offer
 */
reminderRouter.get('/delivery-approval/status', async (req: AuthRequest, res: Response) => {
  try {
    const offerNo = String(req.query.offerNo || '').trim();
    if (!offerNo) {
      return res.json({ success: true, status: 'NOT_REQUESTED' });
    }

    const baseOfferNo = offerNo.replace(/-[123]$/, '').trim();
    const quote = await Quotation.findOne({
      $or: [
        { offerNo },
        { offerNo: new RegExp(`^${baseOfferNo}(-[123])?$`, 'i') },
      ],
    }).select('offerNo status data').lean();

    if (quote?.data?.deliveryApprovalStatus === 'APPROVED') {
      const days = Number(quote.data.deliveryDays || quote.data.deliveryApprovalDays || 60);
      return res.json({
        success: true,
        status: 'APPROVED',
        deliveryDays: days,
        deliveryTime: quote.data.deliveryTime || `${days} days post confirmation on drawings and finishes.`,
        approvedBy: quote.data.deliveryApprovalBy || 'Nithesh Babu (Admin)',
        approvedAt: quote.data.deliveryApprovalAt,
      });
    }

    const reminder = await Reminder.findOne({
      relatedQuotationOfferNo: new RegExp(`^${baseOfferNo}`, 'i'),
      type: 'DELIVERY_APPROVAL',
    }).sort({ updatedAt: -1 }).lean();

    if (reminder) {
      if (reminder.status === 'DISMISSED') {
        const days = Number(reminder.requestedDeliveryDays || 60);
        return res.json({
          success: true,
          status: 'APPROVED',
          deliveryDays: days,
          deliveryTime: `${days} days post confirmation on drawings and finishes.`,
          approvedBy: 'Nithesh Babu (Admin)',
          approvedAt: reminder.updatedAt,
        });
      } else if (reminder.status === 'PENDING') {
        return res.json({
          success: true,
          status: 'PENDING',
          requestedDays: reminder.requestedDeliveryDays || 60,
        });
      }
    }

    return res.json({
      success: true,
      status: quote?.data?.deliveryApprovalStatus || 'NOT_REQUESTED',
      deliveryDays: quote?.data?.deliveryDays || 120,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders/delivery-approval/:id/approve
 * Approves the Fast-Track Delivery timeline (Admin / Nithesh Babu only)
 */
reminderRouter.post('/delivery-approval/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.name?.toLowerCase().includes('nithesh');
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only Admin (Nithesh Babu) is authorized to approve fast-track delivery.' });
    }

    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Approval reminder not found' });
    }

    reminder.status = 'DISMISSED';
    await reminder.save();

    const approvedDays = reminder.requestedDeliveryDays || 60;
    const offerCode = reminder.relatedQuotationOfferNo;

    // Update quotation document if exists
    if (offerCode || reminder.relatedQuotationId) {
      await Quotation.updateOne(
        { $or: [{ offerNo: offerCode }, { _id: reminder.relatedQuotationId }] },
        {
          $set: {
            'data.deliveryDays': approvedDays,
            'data.deliveryTime': `${approvedDays} days post confirmation on drawings and finishes.`,
            'data.deliveryApprovalStatus': 'APPROVED',
            'data.deliveryApprovalDays': approvedDays,
            'data.deliveryApprovalBy': req.user?.name || 'Nithesh Babu (Admin)',
            'data.deliveryApprovalAt': new Date().toISOString(),
          }
        }
      ).catch(() => {});
    }

    // Notify the requesting BDM via CRM reminder
    if (reminder.requestedByUserId) {
      await Reminder.create({
        userId: reminder.requestedByUserId,
        title: `🎉 Nithesh Babu (Admin) Approved ${approvedDays} Days Fast-Track Delivery!`,
        notes: `Your expedited delivery request of ${approvedDays} Days for quotation ${offerCode} (${reminder.customerName || 'Client'}) has been APPROVED by Nithesh Babu (Admin). The quotation form and live PDF have been automatically updated.`,
        dueAt: new Date(),
        status: 'PENDING',
        type: 'GENERAL',
        relatedQuotationOfferNo: offerCode,
        customerName: reminder.customerName,
        requestedDeliveryDays: approvedDays,
        actionRequired: false,
      }).catch(() => {});
    }

    // Send direct WhatsApp notification to the requesting BDM
    try {
      const bdmUser = reminder.requestedByUserId ? await User.findById(reminder.requestedByUserId).lean() : null;
      const bdmPhone = reminder.requestedByUserPhone || bdmUser?.phone;
      if (bdmPhone) {
        const cleanPhone = bdmPhone.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length === 10) {
          const bdmWaText = `🎉 *FAST-TRACK DELIVERY APPROVED BY NITHESH BABU (ADMIN)* 🎉\n\nDear ${reminder.requestedByUserName || bdmUser?.name || 'BDM'},\nYour expedited delivery timeline of *${approvedDays} Days* for quotation *${offerCode}* (${reminder.customerName || 'Client'}) has been APPROVED by *Nithesh Babu (Admin)*.\n\nThe quotation form and live PDF have been automatically updated to *${approvedDays} Days*.`;
          await whatsAppWebBot.sendDirectMessage(`91${cleanPhone}`, bdmWaText);
        }
      }
    } catch (e: any) {
      console.warn('[DeliveryApproval] Could not dispatch WhatsApp to BDM:', e.message);
    }

    return res.json({
      success: true,
      message: `Expedited delivery of ${approvedDays} Days approved successfully for ${reminder.customerName || 'customer'}!`,
      approvedDays,
      offerCode,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders/delivery-approval/:id/reject
 * Rejects the Fast-Track Delivery timeline (Admin / Nithesh Babu only)
 */
reminderRouter.post('/delivery-approval/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.name?.toLowerCase().includes('nithesh');
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only Admin (Nithesh Babu) is authorized to reject fast-track delivery.' });
    }

    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Approval reminder not found' });
    }

    reminder.status = 'DISMISSED';
    await reminder.save();

    const offerCode = reminder.relatedQuotationOfferNo;
    if (offerCode || reminder.relatedQuotationId) {
      await Quotation.updateOne(
        { $or: [{ offerNo: offerCode }, { _id: reminder.relatedQuotationId }] },
        {
          $set: {
            'data.deliveryDays': 120,
            'data.deliveryTime': '120 days post confirmation on drawings and finishes.',
            'data.deliveryApprovalStatus': 'REJECTED',
            'data.deliveryApprovalBy': req.user?.name || 'Nithesh Babu (Admin)',
            'data.deliveryApprovalAt': new Date().toISOString(),
          }
        }
      ).catch(() => {});
    }

    return res.json({
      success: true,
      message: `Expedited delivery request rejected. Reverted to standard 120 days.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});




