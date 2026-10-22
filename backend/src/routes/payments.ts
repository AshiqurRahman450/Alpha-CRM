import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Payment, Project, Customer, WhatsAppMessage, WhatsAppMessageLog } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logProjectActivity } from '../services/activity/activityService';
import { whatsappService, whatsAppWebBot } from '../services/whatsapp';
import { generatePaymentReceiptPdf } from '../services/receipt/receiptGenerator';

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

    if (inviteTarget) {
      try {
        const customerName = customer?.fullName || 'Valued Client';
        const waCaption = `*Official Payment Receipt* 🧾\n\nDear ${customerName},\nWe have successfully received your payment!\n\n*Project:* ${project.projectName} (${project.projectId})\n*Amount Received:* ₹${paidNum.toLocaleString('en-IN')}\n*Payment Milestone:* ${payment.paymentType || 'Milestone Payment'}\n*Payment Method:* ${paymentMethod || 'Bank Transfer'}\n*Receipt No:* ${payment.receiptNumber}\n*Transaction Ref:* ${transactionReference}\n\n*Total Paid So Far:* ₹${newTotalPaid.toLocaleString('en-IN')}\n*Outstanding Balance:* ₹${newBalance.toLocaleString('en-IN')}\n\nPlease find your official payment receipt document attached above for your records.\n\nThank you for choosing Alpha Elevators!`;

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
              messageText: `[PAYMENT RECEIPT DISPATCHED]: ${payment.receiptNumber}\n${waCaption}`,
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
        } else {
          groupDispatchError = 'WhatsApp Web Bot is not connected. Reconnect bot via WhatsApp settings to dispatch receipts.';
        }
      } catch (waErr: any) {
        console.error('[PaymentReceipt] Failed to dispatch WhatsApp receipt to group:', waErr.message);
        groupDispatchError = waErr.message;
      }
    }

    return res.status(201).json({
      success: true,
      data: payment,
      project,
      receiptSentToGroup,
      groupDispatchError,
      message: receiptSentToGroup
        ? `Payment recorded and official receipt (${payment.receiptNumber}) sent directly to the WhatsApp group!`
        : `Payment recorded successfully.`,
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

    return res.json({
      success: true,
      message: `Receipt ${payment.receiptNumber} sent directly to the WhatsApp group!`,
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

