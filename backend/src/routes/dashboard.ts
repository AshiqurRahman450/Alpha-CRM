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

/**
 * GET /api/dashboard/card-items
 * Returns the exact list of records corresponding to any dashboard card clicked
 */
dashboardRouter.get('/card-items', async (req: AuthRequest, res: Response) => {
  try {
    const { type, stage } = req.query;
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

    let title = 'Dashboard Count List';
    let subtitle = 'Records overview';
    let itemType: 'project' | 'customer' | 'message' = 'project';
    let items: any[] = [];

    const formatProject = (p: any) => ({
      _id: p._id,
      projectId: p.projectId,
      projectName: p.projectName,
      projectStatus: p.projectStatus,
      paymentStatus: p.paymentStatus,
      orderValue: p.orderValue || 0,
      advanceAmount: p.advanceAmount || 0,
      totalPaid: p.totalPaid || 0,
      balanceAmount: p.balanceAmount || 0,
      liftModel: p.liftModel,
      siteAddress: p.siteAddress,
      customerName: (p.customerId as any)?.fullName || 'Customer',
      customerPhone: (p.customerId as any)?.phoneNumber,
      customerWhatsapp: (p.customerId as any)?.whatsappNumber,
      customerEmail: (p.customerId as any)?.email,
      whatsappGroupId: p.whatsappGroupId,
      whatsappOptIn: (p.customerId as any)?.whatsappOptIn,
      nextUpdateAt: p.nextUpdateAt,
      paymentRequest: p.paymentRequest,
      advancePercentage: p.advancePercentage,
      createdAt: p.createdAt,
    });

    switch (type) {
      case 'totalCustomers': {
        title = 'Total Customers';
        subtitle = 'All registered and verified elevator customers';
        itemType = 'customer';
        const customers = await Customer.find({ ...bdmFilter }).sort({ createdAt: -1 });
        const projectCounts = await Project.aggregate([
          { $match: { ...bdmFilter } },
          { $group: { _id: '$customerId', count: { $sum: 1 } } },
        ]);
        const countMap: Record<string, number> = {};
        for (const pc of projectCounts) {
          if (pc._id) countMap[pc._id.toString()] = pc.count;
        }
        items = customers.map((c) => ({
          _id: c._id,
          fullName: c.fullName,
          phoneNumber: c.phoneNumber,
          whatsappNumber: c.whatsappNumber,
          email: c.email,
          city: c.city,
          state: c.state,
          address: c.address,
          customerType: c.customerType,
          whatsappOptIn: c.whatsappOptIn,
          leadSource: c.leadSource,
          bdmPhone: c.bdmPhone,
          projectCount: countMap[c._id.toString()] || 0,
          createdAt: c.createdAt,
        }));
        break;
      }

      case 'totalProjects': {
        title = 'Total Projects';
        subtitle = 'All elevator installation projects';
        itemType = 'project';
        const projects = await Project.find({ ...bdmFilter })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'activeProjects': {
        title = 'Active Projects';
        subtitle = 'Orders confirmed & active in the 4-month elevator manufacturing and installation cycle';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'projectsAwaitingPayment':
      case 'awaitingPayment': {
        title = 'Projects Awaiting Payment';
        subtitle = 'Projects with outstanding customer balance or pending milestone payment';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          paymentStatus: { $in: ['PENDING', 'PARTIAL_PAID'] },
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'projectsInManufacturing':
      case 'manufacturing': {
        title = 'Projects in Manufacturing';
        subtitle = 'Factory fabrication stage: shaft fabrication, motor assembly & panel wiring';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: 'MANUFACTURING',
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'projectsReadyForDelivery':
      case 'readyForDelivery': {
        title = 'Projects Ready for Delivery';
        subtitle = 'QC passed, dispatched, or in transit to customer site';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: { $in: ['QUALITY_CHECK', 'DISPATCH', 'DELIVERY'] },
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'installationOngoing':
      case 'installation': {
        title = 'Installation Ongoing Projects';
        subtitle = 'On-site shaft rigging, guide rail alignment, cabin erection & electrical wiring';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: 'INSTALLATION',
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'handoverCount':
      case 'handover': {
        title = 'Handover & Testing Projects';
        subtitle = 'Safety inspection, load testing, commissioning & final handover to client';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: 'TESTING',
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'whatsappUpdatesDueToday':
      case 'updatesDueToday':
      case 'upcoming_today': {
        title = "WhatsApp Updates Due Today";
        subtitle = "Active projects scheduled for automated or manual WhatsApp group dispatch today";
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          automationEnabled: true,
          whatsappGroupId: { $exists: true, $ne: '' },
          projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
          $or: [
            { nextUpdateAt: { $lte: endOfToday } },
            { nextUpdateAt: { $exists: false } },
            { nextUpdateAt: null },
          ],
        })
          .populate('customerId')
          .sort({ nextUpdateAt: 1 });
        items = projects.map(formatProject);
        break;
      }

      case 'upcoming_tomorrow': {
        title = "WhatsApp Updates Due Tomorrow";
        subtitle = "Projects scheduled for customer WhatsApp group dispatch in next 24 hours";
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          automationEnabled: true,
          whatsappGroupId: { $exists: true, $ne: '' },
          projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
          nextUpdateAt: { $gte: startOfTomorrow, $lte: endOfTomorrow },
        })
          .populate('customerId')
          .sort({ nextUpdateAt: 1 });
        items = projects.map(formatProject);
        break;
      }

      case 'upcoming_next_7_days': {
        title = "WhatsApp Updates Due Next 7 Days";
        subtitle = "Projects scheduled for customer WhatsApp group dispatch over the upcoming week";
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          automationEnabled: true,
          whatsappGroupId: { $exists: true, $ne: '' },
          projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
          nextUpdateAt: { $gt: endOfTomorrow, $lte: in7Days },
        })
          .populate('customerId')
          .sort({ nextUpdateAt: 1 });
        items = projects.map(formatProject);
        break;
      }

      case 'whatsappMessagesSent': {
        title = 'WhatsApp Messages Sent';
        subtitle = 'Successfully delivered automated & manual WhatsApp updates to client groups';
        itemType = 'message';
        const messages = await WhatsAppMessage.find({
          status: { $in: ['SENT', 'DELIVERED', 'READ'] },
        })
          .sort({ createdAt: -1 })
          .limit(100);
        items = messages;
        break;
      }

      case 'whatsappMessagesFailed': {
        title = 'WhatsApp Failed Messages';
        subtitle = 'Failed dispatches due to Meta API issues, expired tokens or invalid groups';
        itemType = 'message';
        const messages = await WhatsAppMessage.find({
          status: 'FAILED',
        })
          .sort({ createdAt: -1 })
          .limit(100);
        items = messages;
        break;
      }

      case 'pendingApprovals':
      case 'pendingApprovalCount': {
        title = 'Pending Approvals (Drawing & Cabin)';
        subtitle = 'Elevator projects waiting for design or customer approval confirmation';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: { $in: ['DESIGN', 'CUSTOMER_APPROVAL'] },
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'crmPaymentRequests':
      case 'crmPaymentRequestsCount': {
        title = 'CRM Payment Requests';
        subtitle = 'Milestone collection requests initiated by CRM awaiting accountant recording';
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          'paymentRequest.status': 'REQUESTED',
        })
          .populate('customerId')
          .sort({ 'paymentRequest.requestedAt': -1 });
        items = projects.map(formatProject);
        break;
      }

      case 'stage': {
        const stageStr = typeof stage === 'string' ? stage : '';
        title = `${stageStr.replace(/_/g, ' ')} Projects`;
        subtitle = `Elevator projects currently situated in ${stageStr.replace(/_/g, ' ')} stage`;
        itemType = 'project';
        const projects = await Project.find({
          ...bdmFilter,
          projectStatus: stageStr,
        })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }

      default: {
        title = 'Projects List';
        subtitle = 'All elevator installation projects';
        itemType = 'project';
        const projects = await Project.find({ ...bdmFilter })
          .populate('customerId')
          .sort({ createdAt: -1 });
        items = projects.map(formatProject);
        break;
      }
    }

    return res.json({
      success: true,
      cardType: type,
      title,
      subtitle,
      count: items.length,
      itemType,
      data: items,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

