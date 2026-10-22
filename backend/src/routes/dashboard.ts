import { Router, Response } from 'express';
import { Customer, Project, WhatsAppMessage, WhatsAppChannel, SystemSettings } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/**
 * GET /api/dashboard
 */
dashboardRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const endOfTomorrow = new Date(endOfToday);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    const in7Days = new Date(endOfToday);
    in7Days.setDate(in7Days.getDate() + 7);

    const isBDM = req.user?.role === 'BDM';
    const bdmFilter = isBDM ? { bdmId: req.user?._id } : {};

    // 1. Core Metrics
    const [
      totalCustomers,
      totalProjects,
      activeProjectsCount,
      awaitingPaymentCount,
      manufacturingCount,
      readyForDeliveryCount,
      installationOngoingCount,
      handoverCount,
      messagesSentCount,
      messagesFailedCount,
      settings,
      pendingApprovalCount,
      pendingBalanceAgg,
      pendingPaymentProjects,
      crmPaymentRequestsCount,
      crmPaymentRequests,
    ] = await Promise.all([
      Customer.countDocuments({ ...bdmFilter }),
      Project.countDocuments({ ...bdmFilter }),
      Project.countDocuments({ ...bdmFilter, projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] } }),
      Project.countDocuments({ ...bdmFilter, paymentStatus: { $in: ['PENDING', 'PARTIAL_PAID'] } }),
      Project.countDocuments({ ...bdmFilter, projectStatus: 'MANUFACTURING' }),
      Project.countDocuments({ ...bdmFilter, projectStatus: { $in: ['QUALITY_CHECK', 'DISPATCH', 'DELIVERY'] } }),
      Project.countDocuments({ ...bdmFilter, projectStatus: 'INSTALLATION' }),
      Project.countDocuments({ ...bdmFilter, projectStatus: 'TESTING' }),
      WhatsAppMessage.countDocuments({ status: { $in: ['SENT', 'DELIVERED', 'READ'] } }),
      WhatsAppMessage.countDocuments({ status: 'FAILED' }),
      SystemSettings.findOne({ key: 'GLOBAL_CONFIG' }),
      Project.countDocuments({ ...bdmFilter, projectStatus: { $in: ['DESIGN', 'CUSTOMER_APPROVAL'] } }),
      Project.aggregate([
        { $match: { ...bdmFilter, paymentStatus: { $in: ['PENDING', 'PARTIAL_PAID'] } } },
        { $group: { _id: null, totalBalance: { $sum: '$balanceAmount' } } },
      ]),
      Project.find({
        ...bdmFilter,
        paymentStatus: { $in: ['PENDING', 'PARTIAL_PAID'] },
      })
        .populate('customerId')
        .sort({ createdAt: -1 })
        .limit(10),
      Project.countDocuments({ ...bdmFilter, 'paymentRequest.status': 'REQUESTED' }),
      Project.find({
        ...bdmFilter,
        'paymentRequest.status': 'REQUESTED',
      })
        .populate('customerId')
        .sort({ 'paymentRequest.requestedAt': -1 })
        .limit(25),
    ]);

    const totalPendingBalance = pendingBalanceAgg[0]?.totalBalance || 0;

    // 2. Updates Due Today (Projects with nextUpdateAt <= endOfToday and active)
    const updatesDueTodayProjects = await Project.find({
      automationEnabled: true,
      whatsappGroupId: { $exists: true, $ne: '' },
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
      $or: [
        { nextUpdateAt: { $lte: endOfToday } },
        { nextUpdateAt: { $exists: false } },
        { nextUpdateAt: null },
      ],
    }).populate('customerId');

    // 3. Upcoming Updates breakdown
    const updatesTomorrowProjects = await Project.find({
      automationEnabled: true,
      whatsappGroupId: { $exists: true, $ne: '' },
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
      nextUpdateAt: { $gte: startOfTomorrow, $lte: endOfTomorrow },
    }).populate('customerId');

    const updatesNext7DaysProjects = await Project.find({
      automationEnabled: true,
      whatsappGroupId: { $exists: true, $ne: '' },
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
      nextUpdateAt: { $gt: endOfTomorrow, $lte: in7Days },
    }).populate('customerId');

    // 4. Status distribution
    const statusDistributionRaw = await Project.aggregate([
      { $group: { _id: '$projectStatus', count: { $sum: 1 } } },
    ]);
    const statusDistribution: Record<string, number> = {};
    for (const item of statusDistributionRaw) {
      statusDistribution[item._id] = item.count;
    }

    // 5. Recent WhatsApp Communication
    const recentMessages = await WhatsAppMessage.find()
      .sort({ createdAt: -1 })
      .limit(8);

    // 6. Pilot Mode Status
    const pilotCustomers = await Customer.find().limit(10);
    const pilotProjects = await Project.find().populate('customerId').limit(10);

    return res.json({
      success: true,
      data: {
        cards: {
          totalCustomers,
          totalProjects,
          activeProjects: activeProjectsCount,
          projectsAwaitingPayment: awaitingPaymentCount,
          pendingRecordAmountCount: awaitingPaymentCount,
          crmPaymentRequestsCount,
          totalPendingBalance,
          projectsInManufacturing: manufacturingCount,
          projectsReadyForDelivery: readyForDeliveryCount,
          installationOngoing: installationOngoingCount,
          handoverCount,
          whatsappUpdatesDueToday: updatesDueTodayProjects.length,
          whatsappMessagesSent: messagesSentCount,
          whatsappMessagesFailed: messagesFailedCount,
          pendingApprovalCount,
        },
        crmPaymentRequests: crmPaymentRequests.map((p) => ({
          _id: p._id,
          projectId: p.projectId,
          projectName: p.projectName,
          customerName: (p.customerId as any)?.fullName || 'Customer',
          customerPhone: (p.customerId as any)?.phoneNumber,
          customerEmail: (p.customerId as any)?.email,
          orderValue: p.orderValue,
          advanceAmount: p.advanceAmount,
          totalPaid: p.totalPaid || 0,
          balanceAmount: p.balanceAmount,
          paymentStatus: p.paymentStatus,
          paymentRequest: p.paymentRequest,
        })),
        pendingPaymentProjects: pendingPaymentProjects.map((p) => ({
          _id: p._id,
          projectId: p.projectId,
          projectName: p.projectName,
          customerName: (p.customerId as any)?.fullName || 'Customer',
          customerPhone: (p.customerId as any)?.phoneNumber,
          orderValue: p.orderValue,
          advanceAmount: p.advanceAmount,
          totalPaid: p.totalPaid || 0,
          balanceAmount: p.balanceAmount,
          paymentStatus: p.paymentStatus,
          paymentRequest: p.paymentRequest,
        })),
        todayActions: updatesDueTodayProjects.map((p) => ({
          _id: p._id,
          projectId: p.projectId,
          projectName: p.projectName,
          projectStatus: p.projectStatus,
          customerName: (p.customerId as any)?.fullName || 'Customer',
          customerPhone: (p.customerId as any)?.phoneNumber,
          whatsappGroupId: p.whatsappGroupId,
          whatsappOptIn: (p.customerId as any)?.whatsappOptIn,
          nextUpdateAt: p.nextUpdateAt,
          advancePercentage: p.advancePercentage,
        })),
        upcomingSummary: {
          todayCount: updatesDueTodayProjects.length,
          tomorrowCount: updatesTomorrowProjects.length,
          next7DaysCount: updatesNext7DaysProjects.length,
          tomorrowList: updatesTomorrowProjects.map((p) => ({
            id: p._id,
            projectId: p.projectId,
            projectName: p.projectName,
            stage: p.projectStatus,
            date: p.nextUpdateAt,
          })),
          next7DaysList: updatesNext7DaysProjects.map((p) => ({
            id: p._id,
            projectId: p.projectId,
            projectName: p.projectName,
            stage: p.projectStatus,
            date: p.nextUpdateAt,
          })),
        },
        statusDistribution,
        recentMessages,
        pilotMode: {
          enabled: settings?.pilotModeEnabled ?? true,
          limit: settings?.pilotCustomerLimit ?? 10,
          currentPilotCount: pilotProjects.length,
          pilotProjects: pilotProjects.map((p, idx) => ({
            index: idx + 1,
            id: p._id,
            projectId: p.projectId,
            projectName: p.projectName,
            customerName: (p.customerId as any)?.fullName,
            stage: p.projectStatus,
            groupLinked: !!p.whatsappGroupId,
            optIn: !!(p.customerId as any)?.whatsappOptIn,
            nextUpdateAt: p.nextUpdateAt,
          })),
        },
        testModeActive: settings?.whatsappTestMode ?? true,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
