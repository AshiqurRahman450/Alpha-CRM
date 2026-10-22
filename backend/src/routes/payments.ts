import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Payment, Project, Customer, WhatsAppMessage, WhatsAppMessageLog, User } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logProjectActivity } from '../services/activity/activityService';
import { whatsappService, whatsAppWebBot, watiService } from '../services/whatsapp';
import { generatePaymentReceiptPdf } from '../services/receipt/receiptGenerator';
import {
  scheduleEscalationMatrixDispatch,
  triggerAdvancePaymentReminderForCRMAndAdmin,
} from '../services/scheduler/schedulerService';

export const paymentRouter = Router();

paymentRouter.use(authenticate);

/**
 * GET /api/payments
 */
paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, customerId } = req.query;
    const query: any = {};
    if (projectId) query.projectId = projectId;
    if (customerId) query.customerId = customerId;

    const payments = await Payment.find(query).sort({ paymentDate: -1 });
    return res.json({ success: true, count: payments.length, data: payments });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payments/:id
 */
paymentRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    return res.json({ success: true, data: payment });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/payments
 */
paymentRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId,
      amountPaid,
      paymentMethod,
      transactionReference,
      paymentType,
      receiptNumber,
      notes,
    } = req.body;

    if (!projectId || !amountPaid || !transactionReference) {
      return res.status(400).json({
        success: false,
        message: 'Project ID, payment amount, and transaction reference are required',
      });
    }

    const project = await Project.findById(projectId).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Restriction: Accountant can ONLY record payment if CRM has requested it for this customer/project
    if (req.user?.role === 'ACCOUNTANT' && project.paymentRequest?.status !== 'REQUESTED') {
      return res.status(403).json({
        success: false,
        message: 'Payment recording is restricted. CRM must request payment collection for this customer before the Accountant can record payment.',
      });
    }

    const customer = project.customerId as any;
    const paidNum = Number(amountPaid);
    const newTotalPaid = (project.totalPaid || 0) + paidNum;
    const newBalance = Math.max(0, project.orderValue - newTotalPaid);

    let newPaymentStatus: any = 'PARTIAL_PAID';
    if (newTotalPaid >= project.orderValue) {
      newPaymentStatus = 'FULLY_PAID';
    } else if (newTotalPaid >= project.advanceAmount) {
      newPaymentStatus = 'ADVANCE_PAID';
    }

    // Save payment record
    const payment = await Payment.create({
      projectId: project._id,
      projectCode: project.projectId,
      customerId: customer._id,
      customerName: customer.fullName,
      totalOrderValue: project.orderValue,
      advanceRequired: project.advanceAmount,
      amountPaid: paidNum,
      balanceAmount: newBalance,
      paymentType: paymentType || 'OTHER',
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'BANK_TRANSFER',
      transactionReference: transactionReference.trim(),
      receiptNumber: receiptNumber || `REC-${project.projectId}-${Date.now().toString().slice(-4)}`,
      paymentStatus: 'SUCCESS',
      notes,
    });

    // Update project
    project.totalPaid = newTotalPaid;
    project.balanceAmount = newBalance;
    project.paymentStatus = newPaymentStatus;
    if (project.paymentRequest && project.paymentRequest.status === 'REQUESTED') {
      project.paymentRequest.status = 'RECORDED';
    }

    // Check if this payment fulfills or corresponds to Advance Payment
    const isAdvancePayment =
      (paymentType && String(paymentType).toLowerCase().includes('advance')) ||
      (payment.paymentType && String(payment.paymentType).toLowerCase().includes('advance')) ||
      newPaymentStatus === 'ADVANCE_PAID' ||
      (project.paymentRequest?.paymentType && String(project.paymentRequest.paymentType).toLowerCase().includes('advance')) ||
      (newTotalPaid >= (project.advanceAmount || 0) && (project.advanceAmount || 0) > 0);

    if (isAdvancePayment) {
      if (!project.stageDates) {
        project.stageDates = new Map();
      }
      const paymentStage = project.stageDates.get('PAYMENT_RECEIVED') || {};
      paymentStage.executedDate = new Date();
      if (!paymentStage.scheduleDate) {
        paymentStage.scheduleDate = new Date();
      }
      project.stageDates.set('PAYMENT_RECEIVED', paymentStage);

      // Advance project status if at initial stage
      if (!project.projectStatus) {
        project.projectStatus = 'PAYMENT_RECEIVED';
      }
      console.log(`[Payment] Marked stage "PAYMENT_RECEIVED" as EXECUTED/DONE for project ${project.projectId}`);
    }

    await project.save();

    // Log Activity
    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'PAYMENT',
      description: `Payment of ₹${paidNum.toLocaleString('en-IN')} received via ${paymentMethod || 'Bank Transfer'}. Ref: ${transactionReference}. Remaining balance: ₹${newBalance.toLocaleString('en-IN')}`,
      userId: req.user?._id,
      userName: req.user?.name,
      metadata: { amount: paidNum, balance: newBalance, reference: transactionReference },
    });

    if (isAdvancePayment) {
      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'STATUS_CHANGE',
        description: `Stage "Advance Payment Received" marked COMPLETED upon receiving ₹${paidNum.toLocaleString('en-IN')}.`,
        userId: req.user?._id,
        userName: req.user?.name,
      });

      // 1. Schedule Customer Concern Escalation Matrix to be dispatched to WhatsApp group after 30 minutes
      await scheduleEscalationMatrixDispatch(project);

      // 2. Remind CRM and Admin to schedule Site Visit (both in-app reminder and 1-to-1 WhatsApp messages)
      await triggerAdvancePaymentReminderForCRMAndAdmin(project._id, paidNum);
    }

    // Automatically generate official PDF Receipt
    let receiptPdfPath: string | null = null;
    let receiptRelativeUrl: string | null = null;
    let receiptFileName: string | null = null;

    try {
      const generated = await generatePaymentReceiptPdf(payment, project, customer);
      receiptPdfPath = generated.filePath;
      receiptRelativeUrl = generated.relativeUrl;
      receiptFileName = generated.fileName;
      payment.receiptUrl = receiptRelativeUrl;
      await payment.save();
      console.log(`[PaymentReceipt] Generated receipt PDF: ${receiptFileName} (${receiptRelativeUrl})`);
    } catch (pdfErr: any) {
      console.error('[PaymentReceipt] Error generating PDF receipt:', pdfErr.message);
    }

    // Automatically send Receipt to WhatsApp Group via Web Bot
    let receiptSentToGroup = false;
    let groupDispatchError: string | null = null;
    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;

    const customerName = customer?.fullName || 'Valued Client';
    const waCaption = `*Official Payment Receipt* 🧾\n\nDear ${customerName},\nWe have successfully received your payment!\n\n*Project:* ${project.projectName} (${project.projectId})\n*Amount Received:* ₹${paidNum.toLocaleString('en-IN')}\n*Payment Milestone:* ${payment.paymentType || 'Milestone Payment'}\n*Payment Method:* ${paymentMethod || 'Bank Transfer'}\n*Receipt No:* ${payment.receiptNumber}\n*Transaction Ref:* ${transactionReference}\n\n*Total Paid So Far:* ₹${newTotalPaid.toLocaleString('en-IN')}\n*Outstanding Balance:* ₹${newBalance.toLocaleString('en-IN')}\n\nPlease find your official payment receipt document attached above for your records.\n\nThank you for choosing Alpha Elevators!`;

    // 1. Dispatch Receipt to WhatsApp Group
    if (inviteTarget) {
      try {
        const botStatus = whatsAppWebBot.getStatus();
        if (botStatus.isConnected) {
          let sendRes: any;
          if (receiptPdfPath && fs.existsSync(receiptPdfPath)) {
            sendRes = await whatsAppWebBot.sendDocumentToGroup(
              inviteTarget,
              receiptPdfPath,
              receiptFileName || `Receipt-${payment.receiptNumber}.pdf`,
              waCaption
            );
          } else {
            sendRes = await whatsAppWebBot.sendMessageToGroup(inviteTarget, waCaption);
          }

          if (sendRes.success) {
            receiptSentToGroup = true;
            await WhatsAppMessageLog.create({
              projectId: project._id,
              groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
              messageText: `[PAYMENT RECEIPT DISPATCHED TO GROUP]: ${payment.receiptNumber}\n${waCaption}`,
              messageType: receiptPdfPath ? 'document' : 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: sendRes.messageId,
              status: 'SENT',
              attemptCount: 1,
              isDryRun: false,
            });

            await logProjectActivity({
              projectId: project._id,
              projectCode: project.projectId,
              type: 'WHATSAPP_SENT',
              description: `Payment receipt "${payment.receiptNumber}" (₹${paidNum.toLocaleString('en-IN')}) sent directly to WhatsApp group via Web Bot (+${botStatus.botPhoneNumber || 'Bot'})`,
              userId: req.user?._id,
              userName: req.user?.name,
            });
            console.log(`[PaymentReceipt] Receipt document sent to WhatsApp group for ${project.projectId}`);
          } else {
            groupDispatchError = sendRes.error;
          }
        }

        // Fallback to WATI group message if Web Bot not connected or failed
        if (!receiptSentToGroup) {
          try {
            console.log(`[PaymentReceipt] Dispatching payment receipt notice to group via WATI...`);
            const watiRes = await watiService.sendGroupText({
              target: inviteTarget,
              targetType: 'GROUP',
              text: waCaption,
            });
            if (watiRes.success) {
              receiptSentToGroup = true;
              await WhatsAppMessageLog.create({
                projectId: project._id,
                groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
                messageText: `[PAYMENT RECEIPT DISPATCHED TO GROUP VIA WATI]: ${payment.receiptNumber}\n${waCaption}`,
                messageType: 'text',
                scheduledAt: new Date(),
                attemptedAt: new Date(),
                sentAt: new Date(),
                providerMessageId: watiRes.messageId,
                status: 'SENT',
                attemptCount: 1,
                isDryRun: false,
              });
            } else {
              groupDispatchError = watiRes.error || groupDispatchError;
            }
          } catch (watiErr: any) {
            console.error('[PaymentReceipt] WATI group dispatch error:', watiErr.message);
            groupDispatchError = watiErr.message;
          }
        }
      } catch (waErr: any) {
        console.error('[PaymentReceipt] Failed to dispatch WhatsApp receipt to group:', waErr.message);
        groupDispatchError = waErr.message;
      }
    }

    // 2. Dispatch Official Receipt 1-to-1 to CRM WhatsApp Number
    let receiptSentToCrm = false;
    let crmDispatchError: string | null = null;
    let targetCrmPhone = project.paymentRequest?.requestedByPhone;

    if (!targetCrmPhone && project.paymentRequest?.requestedBy) {
      const requester = await User.findOne({ name: project.paymentRequest.requestedBy });
      if (requester?.phone) targetCrmPhone = requester.phone;
    }
    if (!targetCrmPhone) {
      const crmUser = await User.findOne({ role: 'CRM', phone: { $exists: true, $ne: '' } });
      if (crmUser?.phone) targetCrmPhone = crmUser.phone;
    }
    if (!targetCrmPhone) {
      const adminUser = await User.findOne({ role: 'ADMIN', phone: { $exists: true, $ne: '' } });
      if (adminUser?.phone) targetCrmPhone = adminUser.phone;
    }
    if (!targetCrmPhone) {
      targetCrmPhone = '+91 98200 54321';
    }

    const crmRecipientName = project.paymentRequest?.requestedBy || 'CRM Team';
    const crmCaption = `🧾 *Official Payment Receipt Recorded* 🧾\n\nDear CRM Team,\nAccountant (*${req.user?.name || 'Accountant'}*) has recorded a payment and generated receipt *${payment.receiptNumber}* for project *${project.projectName}* (${project.projectId}).\n\n*Receipt Summary:*\n• *Customer Name:* ${customerName}\n• *Customer Phone:* ${customer?.phoneNumber || 'N/A'}\n• *Amount Received:* ₹${paidNum.toLocaleString('en-IN')}\n• *Payment Stage:* ${payment.paymentType || 'Milestone Payment'}\n• *Payment Method:* ${paymentMethod || 'Bank Transfer'}\n• *Transaction Ref:* ${transactionReference}\n• *Total Collected to Date:* ₹${newTotalPaid.toLocaleString('en-IN')}\n• *Remaining Balance:* ₹${newBalance.toLocaleString('en-IN')}\n\n${receiptSentToGroup ? '✅ *Group Dispatch:* Official receipt PDF was sent to the client WhatsApp group.\n' : ''}Attached above is the official PDF payment receipt for your records.\n\nAlpha Elevators CRM`;

    if (targetCrmPhone) {
      try {
        const botStatus = whatsAppWebBot.getStatus();
        if (botStatus.isConnected) {
          let crmRes: any;
          if (receiptPdfPath && fs.existsSync(receiptPdfPath)) {
            console.log(`[PaymentReceipt] Sending official receipt PDF 1-to-1 to CRM ${crmRecipientName} (+${targetCrmPhone}) via Web Bot`);
            crmRes = await whatsAppWebBot.sendDirectDocument(
              targetCrmPhone,
              receiptPdfPath,
              receiptFileName || `Receipt-${payment.receiptNumber}.pdf`,
              crmCaption
            );
          } else {
            console.log(`[PaymentReceipt] Sending receipt summary 1-to-1 to CRM ${crmRecipientName} (+${targetCrmPhone}) via Web Bot`);
            crmRes = await whatsAppWebBot.sendDirectMessage(targetCrmPhone, crmCaption);
          }

          if (crmRes.success) {
            receiptSentToCrm = true;
            await WhatsAppMessageLog.create({
              projectId: project._id,
              recipientPhone: targetCrmPhone,
              recipientName: crmRecipientName,
              messageText: `[RECEIPT 1-TO-1 TO CRM]: ${payment.receiptNumber}\n${crmCaption}`,
              messageType: receiptPdfPath ? 'document' : 'text',
              scheduledAt: new Date(),
              attemptedAt: new Date(),
              sentAt: new Date(),
              providerMessageId: crmRes.messageId,
              status: 'SENT',
              attemptCount: 1,
              isDryRun: false,
            });
            console.log(`[PaymentReceipt] Official receipt PDF sent 1-to-1 to CRM (+${targetCrmPhone}) via Web Bot! ID: ${crmRes.messageId}`);
          } else {
            crmDispatchError = crmRes.error;
          }
        }

        // Fallback to WATI if Web Bot is not connected or failed
        if (!receiptSentToCrm) {
          try {
            console.log(`[PaymentReceipt] Dispatching 1-to-1 receipt notice to CRM (+${targetCrmPhone}) via WATI`);
            const watiRes = await watiService.sendGroupText({
              target: targetCrmPhone,
              targetType: 'DIRECT',
              text: crmCaption,
              contactName: crmRecipientName,
            });
            if (watiRes.success) {
              receiptSentToCrm = true;
              await WhatsAppMessageLog.create({
                projectId: project._id,
                recipientPhone: targetCrmPhone,
                recipientName: crmRecipientName,
                messageText: `[RECEIPT 1-TO-1 TO CRM VIA WATI]: ${payment.receiptNumber}\n${crmCaption}`,
                messageType: 'text',
                scheduledAt: new Date(),
                attemptedAt: new Date(),
                sentAt: new Date(),
                providerMessageId: watiRes.messageId,
                status: 'SENT',
                attemptCount: 1,
                isDryRun: false,
              });
              console.log(`[PaymentReceipt] Receipt notification sent 1-to-1 to CRM (+${targetCrmPhone}) via WATI!`);
            } else {
              crmDispatchError = watiRes.error || crmDispatchError;
            }
          } catch (watiErr: any) {
            console.error('[PaymentReceipt] Failed to dispatch receipt to CRM via WATI:', watiErr.message);
            crmDispatchError = watiErr.message;
          }
        }

        if (receiptSentToCrm) {
          await logProjectActivity({
            projectId: project._id,
            projectCode: project.projectId,
            type: 'WHATSAPP_SENT',
            description: `Payment receipt "${payment.receiptNumber}" sent 1-to-1 to CRM (${crmRecipientName} - +${targetCrmPhone})`,
            userId: req.user?._id,
            userName: req.user?.name,
          });
        }
      } catch (crmErr: any) {
        console.error('[PaymentReceipt] Failed to dispatch receipt to CRM:', crmErr.message);
        crmDispatchError = crmErr.message;
      }
    }

    return res.status(201).json({
      success: true,
      data: payment,
      project,
      receiptSentToGroup,
      receiptSentToCrm,
      groupDispatchError,
      crmDispatchError,
      message: `Payment recorded successfully! ${receiptSentToGroup ? 'Receipt sent to group. ' : ''}${receiptSentToCrm ? 'Receipt sent 1-to-1 to CRM.' : ''}`.trim(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/payments/:id/send-receipt
 * Manually trigger or re-send official payment receipt document into WhatsApp group
 */
paymentRouter.post('/:id/send-receipt', authorize('ADMIN', 'CRM', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const project = await Project.findById(payment.projectId).populate('customerId');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const customer = project.customerId as any;
    const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;

    if (!inviteTarget) {
      return res.status(400).json({ success: false, message: 'Project has no WhatsApp group invite link or group ID configured' });
    }

    const botStatus = whatsAppWebBot.getStatus();
    if (!botStatus.isConnected) {
      return res.status(400).json({ success: false, message: 'WhatsApp Web Bot is not connected. Please pair bot via WhatsApp tab.' });
    }

    // Locate or re-generate PDF receipt
    let receiptPdfPath: string | null = null;
    let receiptFileName = `Receipt-${(payment.receiptNumber || payment._id.toString()).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    if (payment.receiptUrl) {
      const fullPath = path.resolve(__dirname, '../../uploads', payment.receiptUrl.replace(/^\/uploads\//, ''));
      if (fs.existsSync(fullPath)) {
        receiptPdfPath = fullPath;
      }
    }

    if (!receiptPdfPath) {
      const generated = await generatePaymentReceiptPdf(payment, project, customer);
      receiptPdfPath = generated.filePath;
      payment.receiptUrl = generated.relativeUrl;
      receiptFileName = generated.fileName;
      await payment.save();
    }

    const customerName = customer?.fullName || 'Valued Client';
    const waCaption = `*Official Payment Receipt* 🧾\n\nDear ${customerName},\nPlease find your official payment receipt for Project ${project.projectName} (${project.projectId}) attached below.\n\n*Receipt No:* ${payment.receiptNumber || 'N/A'}\n*Amount:* ₹${(payment.amountPaid || 0).toLocaleString('en-IN')}\n*Method:* ${payment.paymentMethod || 'Bank Transfer'}\n*Ref:* ${payment.transactionReference || 'N/A'}\n*Remaining Balance:* ₹${(payment.balanceAmount || 0).toLocaleString('en-IN')}\n\nThank you,\nAlpha Elevators Team`;

    const sendRes = await whatsAppWebBot.sendDocumentToGroup(
      inviteTarget,
      receiptPdfPath,
      receiptFileName,
      waCaption
    );

    if (!sendRes.success) {
      return res.status(500).json({ success: false, message: sendRes.error || 'Failed to dispatch receipt to WhatsApp group' });
    }

    await WhatsAppMessageLog.create({
      projectId: project._id,
      groupId: project.whatsapp?.groupId || project.whatsappGroupId || 'GROUP',
      messageText: `[MANUAL RECEIPT DISPATCH]: ${payment.receiptNumber}\n${waCaption}`,
      messageType: 'document',
      scheduledAt: new Date(),
      attemptedAt: new Date(),
      sentAt: new Date(),
      providerMessageId: sendRes.messageId,
      status: 'SENT',
      attemptCount: 1,
      isDryRun: false,
    });

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'WHATSAPP_SENT',
      description: `Payment receipt "${payment.receiptNumber}" sent directly to WhatsApp group via Web Bot (+${botStatus.botPhoneNumber || 'Bot'})`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    // Also send receipt 1-to-1 to CRM number
    let targetCrmPhone = project.paymentRequest?.requestedByPhone;
    if (!targetCrmPhone && project.paymentRequest?.requestedBy) {
      const requester = await User.findOne({ name: project.paymentRequest.requestedBy });
      if (requester?.phone) targetCrmPhone = requester.phone;
    }
    if (!targetCrmPhone) {
      const crmUser = await User.findOne({ role: 'CRM', phone: { $exists: true, $ne: '' } });
      if (crmUser?.phone) targetCrmPhone = crmUser.phone;
    }
    if (!targetCrmPhone) {
      const adminUser = await User.findOne({ role: 'ADMIN', phone: { $exists: true, $ne: '' } });
      if (adminUser?.phone) targetCrmPhone = adminUser.phone;
    }
    if (!targetCrmPhone) {
      targetCrmPhone = '+91 98200 54321';
    }

    const crmRecipientName = project.paymentRequest?.requestedBy || 'CRM Team';
    const crmCaption = `🧾 *Official Payment Receipt Dispatched* 🧾\n\nDear CRM Team,\nPayment receipt *${payment.receiptNumber}* for Project *${project.projectName}* (${project.projectId}) has been sent to the client WhatsApp group.\n\n*Receipt Details:*\n• *Customer:* ${customerName}\n• *Amount:* ₹${(payment.amountPaid || 0).toLocaleString('en-IN')}\n• *Method:* ${payment.paymentMethod || 'Bank Transfer'}\n• *Ref:* ${payment.transactionReference || 'N/A'}\n• *Remaining Balance:* ₹${(payment.balanceAmount || 0).toLocaleString('en-IN')}\n\nAttached above is the official receipt for CRM records.\n\nAlpha Elevators CRM`;

    if (targetCrmPhone) {
      try {
        if (botStatus.isConnected) {
          if (receiptPdfPath && fs.existsSync(receiptPdfPath)) {
            await whatsAppWebBot.sendDirectDocument(targetCrmPhone, receiptPdfPath, receiptFileName, crmCaption);
          } else {
            await whatsAppWebBot.sendDirectMessage(targetCrmPhone, crmCaption);
          }
        } else {
          await watiService.sendGroupText({
            target: targetCrmPhone,
            targetType: 'DIRECT',
            text: crmCaption,
            contactName: crmRecipientName,
          });
        }
        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_SENT',
          description: `Payment receipt "${payment.receiptNumber}" sent 1-to-1 to CRM (${crmRecipientName} - +${targetCrmPhone})`,
          userId: req.user?._id,
          userName: req.user?.name,
        });
      } catch (crmErr: any) {
        console.warn('[PaymentReceipt] Notice dispatching manual receipt to CRM:', crmErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Receipt ${payment.receiptNumber} sent directly to the WhatsApp group and 1-to-1 to CRM!`,
      data: { messageId: sendRes.messageId },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/payments/:id
 */
paymentRouter.put('/:id', authorize('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      amountPaid,
      paymentMethod,
      transactionReference,
      paymentType,
      receiptNumber,
      paymentDate,
      paymentStatus,
      notes,
    } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const project = await Project.findById(payment.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Associated project not found' });
    }

    // Update payment fields
    if (amountPaid !== undefined) payment.amountPaid = Number(amountPaid);
    if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod;
    if (transactionReference !== undefined) payment.transactionReference = transactionReference.trim();
    if (paymentType !== undefined) payment.paymentType = paymentType;
    if (receiptNumber !== undefined) payment.receiptNumber = receiptNumber.trim();
    if (paymentDate !== undefined) payment.paymentDate = new Date(paymentDate);
    if (paymentStatus !== undefined) payment.paymentStatus = paymentStatus;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    // Recalculate project payments based on all SUCCESS payments
    const allSuccessfulPayments = await Payment.find({
      projectId: project._id,
      paymentStatus: 'SUCCESS',
    });

    const newTotalPaid = allSuccessfulPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const newBalance = Math.max(0, project.orderValue - newTotalPaid);

    let newPaymentStatus: any = 'PARTIAL_PAID';
    if (newTotalPaid >= project.orderValue) {
      newPaymentStatus = 'FULLY_PAID';
    } else if (newTotalPaid >= project.advanceAmount) {
      newPaymentStatus = 'ADVANCE_PAID';
    } else if (newTotalPaid === 0) {
      newPaymentStatus = 'PENDING';
    }

    project.totalPaid = newTotalPaid;
    project.balanceAmount = newBalance;
    project.paymentStatus = newPaymentStatus;
    await project.save();

    payment.balanceAmount = newBalance;
    await payment.save();

    // Log Activity
    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'PAYMENT',
      description: `Payment record updated: ₹${payment.amountPaid?.toLocaleString('en-IN')} (${payment.paymentType}, Ref: ${payment.transactionReference}). Total paid: ₹${newTotalPaid.toLocaleString('en-IN')}, Remaining balance: ₹${newBalance.toLocaleString('en-IN')}`,
      userId: req.user?._id,
      userName: req.user?.name,
      metadata: { amount: payment.amountPaid, balance: newBalance, reference: payment.transactionReference },
    });

    return res.json({ success: true, data: payment, project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/payments/:id
 */
paymentRouter.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const project = await Project.findById(payment.projectId);
    const deletedAmount = payment.amountPaid;
    const ref = payment.transactionReference;

    await Payment.findByIdAndDelete(req.params.id);

    if (project) {
      const allSuccessfulPayments = await Payment.find({
        projectId: project._id,
        paymentStatus: 'SUCCESS',
      });

      const newTotalPaid = allSuccessfulPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
      const newBalance = Math.max(0, project.orderValue - newTotalPaid);

      let newPaymentStatus: any = 'PARTIAL_PAID';
      if (newTotalPaid >= project.orderValue) {
        newPaymentStatus = 'FULLY_PAID';
      } else if (newTotalPaid >= project.advanceAmount) {
        newPaymentStatus = 'ADVANCE_PAID';
      } else if (newTotalPaid === 0) {
        newPaymentStatus = 'PENDING';
      }

      project.totalPaid = newTotalPaid;
      project.balanceAmount = newBalance;
      project.paymentStatus = newPaymentStatus;
      await project.save();

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'PAYMENT',
        description: `Payment record deleted: ₹${deletedAmount?.toLocaleString('en-IN')} (Ref: ${ref}). Total paid: ₹${newTotalPaid.toLocaleString('en-IN')}, Remaining balance: ₹${newBalance.toLocaleString('en-IN')}`,
        userId: req.user?._id,
        userName: req.user?.name,
        metadata: { deletedAmount, balance: newBalance, reference: ref },
      });
    }

    return res.json({ success: true, message: 'Payment deleted successfully', project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

