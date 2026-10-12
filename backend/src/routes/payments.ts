import { Router, Response } from 'express';
import { Payment, Project, Customer, WhatsAppMessage } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logProjectActivity } from '../services/activity/activityService';
import { whatsappService } from '../services/whatsapp';

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
paymentRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
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

    // Send WhatsApp notification if group linked
    if (project.whatsappGroupId) {
      try {
        const waText = `*Payment Received* 💰\n\nDear Customer,\nWe have successfully received a payment of *₹${paidNum.toLocaleString('en-IN')}* via ${paymentMethod || 'Bank Transfer'}.\nReceipt No: ${payment.receiptNumber}\nRef: ${transactionReference}\n\n*Total Paid So Far:* ₹${newTotalPaid.toLocaleString('en-IN')}\n*Outstanding Balance:* ₹${newBalance.toLocaleString('en-IN')}\n\nThank you for choosing Alpha Elevators!`;
        const sendResult = await whatsappService.sendGroupTextMessage({
          recipientType: 'group',
          to: project.whatsappGroupId,
          text: waText
        });
        
        await WhatsAppMessage.create({
          projectId: project._id,
          projectCode: project.projectId,
          customerId: customer._id,
          customerName: customer.fullName,
          groupId: project.whatsappGroupId,
          metaMessageId: sendResult?.messageId || `sim-${Date.now()}`,
          messageType: 'text',
          recipientType: 'group',
          direction: 'OUTGOING',
          senderName: 'System (Automated)',
          messageContent: waText,
          status: sendResult?.success ? 'SENT' : 'FAILED',
          sentAt: sendResult?.success ? new Date() : undefined,
          failedAt: sendResult?.success ? undefined : new Date(),
          errorMessage: sendResult?.error,
          isAutomated: true,
        });
      } catch (waErr) {
        console.error('Failed to send WhatsApp payment notification', waErr);
      }
    }

    return res.status(201).json({ success: true, data: payment, project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/payments/:id
 */
paymentRouter.put('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
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

