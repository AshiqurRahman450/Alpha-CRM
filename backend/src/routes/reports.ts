import { Router, Response } from 'express';
import { Project, Customer, Payment, WhatsAppMessage } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';

export const reportRouter = Router();

reportRouter.use(authenticate);

/**
 * GET /api/reports
 */
reportRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [
      projects,
      payments,
      messages,
      customers,
    ] = await Promise.all([
      Project.find().populate('customerId').sort({ orderDate: -1 }),
      Payment.find().sort({ paymentDate: -1 }),
      WhatsAppMessage.find().sort({ createdAt: -1 }),
      Customer.find(),
    ]);

    // Financial totals
    const totalOrderBook = projects.reduce((sum, p) => sum + (p.orderValue || 0), 0);
    const totalCollected = projects.reduce((sum, p) => sum + (p.totalPaid || 0), 0);
    const totalOutstanding = totalOrderBook - totalCollected;

    // WhatsApp Message Stats
    const totalSent = messages.filter((m) => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length;
    const totalDelivered = messages.filter((m) => ['DELIVERED', 'READ'].includes(m.status)).length;
    const totalRead = messages.filter((m) => m.status === 'READ').length;
    const totalFailed = messages.filter((m) => m.status === 'FAILED').length;
    const totalIncoming = messages.filter((m) => m.direction === 'INCOMING').length;

    // Delivery timeline breakdown
    const now = new Date();
    const upcomingDeliveries = projects
      .filter((p) => p.expectedDeliveryDate && p.projectStatus !== 'COMPLETED' && p.projectStatus !== 'CANCELLED')
      .sort((a, b) => new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime())
      .slice(0, 10)
      .map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        customerName: (p.customerId as any)?.fullName,
        liftModel: p.liftModel,
        stage: p.projectStatus,
        expectedDeliveryDate: p.expectedDeliveryDate,
        daysRemaining: Math.ceil((new Date(p.expectedDeliveryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));

    return res.json({
      success: true,
      data: {
        financials: {
          totalOrderBook,
          totalCollected,
          totalOutstanding,
          collectionPercentage: totalOrderBook > 0 ? Math.round((totalCollected / totalOrderBook) * 100) : 0,
        },
        whatsappSummary: {
          totalSent,
          totalDelivered,
          totalRead,
          totalFailed,
          totalIncoming,
          deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 100,
        },
        upcomingDeliveries,
        recentFailures: messages.filter((m) => m.status === 'FAILED').slice(0, 5),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
