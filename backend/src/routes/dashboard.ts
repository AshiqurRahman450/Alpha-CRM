import { Router, Response } from 'express';
import { Customer, Project, WhatsAppMessage, WhatsAppChannel, SystemSettings } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getTlRegexForUser, getCustomerTlFilter, isTlUser } from '../utils/tlAuth';

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
    const isLogisticsTL = isTlUser(req.user);

    let bdmFilter: any = {};
    let customerFilter: any = {};

    if (isBDM) {
      bdmFilter = { bdmId: req.user?._id };
      customerFilter = { bdmId: req.user?._id };
    } else if (isLogisticsTL) {
      const tlRegex = getTlRegexForUser(req.user);
      if (tlRegex) {
        const assignedCusts = await Customer.find({
          $or: [
            { assignedTl: tlRegex },
            { assignedTlId: req.user?._id },
            { assignedEmployee: tlRegex },
          ],
        }).select('_id').lean();
        const custIds = assignedCusts.map((c) => c._id);
        bdmFilter = {
          $or: [
            { assignedTl: tlRegex },
            { assignedEmployee: tlRegex },
            { customerId: { $in: custIds } },
          ],
        };
        customerFilter = {
          $or: [
            { assignedTl: tlRegex },
            { assignedTlId: req.user?._id },
            { assignedEmployee: tlRegex },
          ],
        };
      }
    }

    // 1. Execute all dashboard queries in a single parallel batch with lightweight projections (.lean())
    const ALL_STAGES = [
      'PAYMENT_RECEIVED',
      'SITE_MEASUREMENT',
      'DESIGN',
      'CUSTOMER_APPROVAL',
      'ENGINEERING',
      'MANUFACTURING',
      'PRODUCTION_IN_PROGRESS',
      'QUALITY_CHECK',
      'DISPATCH',
      'MATERIAL_DISPATCHED',
      'MATERIAL_IN_TRANSIT',
      'DELIVERY',
      'MATERIAL_DELIVERY',
      'INSTALLATION',
      'TESTING',
      'COMPLETED',
      'ON_HOLD',
      'CANCELLED',
    ];

    const [
      totalCustomers,
      allMatchingProjects,
      messageStatusAgg,
      settings,
      pendingPaymentProjects,
      crmPaymentRequests,
      upcomingAutomationProjects,
      recentMessages,
      pilotProjects,
    ] = await Promise.all([
      Customer.countDocuments({ ...customerFilter }),
      Project.find({ ...bdmFilter })
        .select('projectStatus paymentStatus balanceAmount paymentRequest.status')
        .lean(),
      WhatsAppMessage.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      SystemSettings.findOne({ key: 'GLOBAL_CONFIG' }).lean(),
      Project.find({
        ...bdmFilter,
        paymentStatus: { $in: ['PENDING', 'PARTIAL_PAID'] },
      })
        .select('projectId projectName customerId orderValue advanceAmount totalPaid balanceAmount paymentStatus paymentRequest createdAt')
        .populate('customerId', 'fullName phoneNumber email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Project.find({
        ...bdmFilter,
        'paymentRequest.status': 'REQUESTED',
      })
        .select('projectId projectName customerId orderValue advanceAmount totalPaid balanceAmount paymentStatus paymentRequest')
        .populate('customerId', 'fullName phoneNumber email')
        .sort({ 'paymentRequest.requestedAt': -1 })
        .limit(25)
        .lean(),
      Project.find({
        automationEnabled: true,
        whatsappGroupId: { $exists: true, $ne: '' },
        projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
        $or: [
          { nextUpdateAt: { $lte: in7Days } },
          { nextUpdateAt: { $exists: false } },
          { nextUpdateAt: null },
        ],
      })
        .select('projectId projectName projectStatus customerId whatsappGroupId nextUpdateAt advancePercentage')
        .populate('customerId', 'fullName phoneNumber whatsappOptIn')
        .lean(),
      WhatsAppMessage.find()
        .select('projectId projectCode customerId customerName groupId templateName messageType recipientType direction senderName messageContent status sentAt createdAt')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Project.find()
        .select('projectId projectName customerId projectStatus whatsappGroupId nextUpdateAt')
        .populate('customerId', 'fullName whatsappOptIn')
        .limit(10)
        .lean(),
    ]);

    // Compute all project counts & stage distribution in-memory in O(N) from the single lightweight projection
    const statusDistribution: Record<string, number> = {};
    for (const st of ALL_STAGES) {
      statusDistribution[st] = 0;
    }

    let totalProjects = 0;
    let activeProjectsCount = 0;
    let awaitingPaymentCount = 0;
    let manufacturingCount = 0;
    let readyForDeliveryCount = 0;
    let installationOngoingCount = 0;
    let handoverCount = 0;
    let pendingApprovalCount = 0;
    let crmPaymentRequestsCount = 0;
    let totalPendingBalance = 0;

    const READY_FOR_DELIVERY_SET = new Set([
      'QUALITY_CHECK',
      'DISPATCH',
      'MATERIAL_DISPATCHED',
      'MATERIAL_IN_TRANSIT',
      'DELIVERY',
      'MATERIAL_DELIVERY',
    ]);

    for (const p of allMatchingProjects) {
      totalProjects++;
      const st = p.projectStatus;
      if (st) {
        statusDistribution[st] = (statusDistribution[st] || 0) + 1;
      }
      if (st !== 'COMPLETED' && st !== 'CANCELLED') {
        activeProjectsCount++;
      }
      if (p.paymentStatus === 'PENDING' || p.paymentStatus === 'PARTIAL_PAID') {
        awaitingPaymentCount++;
        totalPendingBalance += Number(p.balanceAmount || 0);
      }
      if (st === 'MANUFACTURING' || st === 'PRODUCTION_IN_PROGRESS') {
        manufacturingCount++;
      }
      if (st && READY_FOR_DELIVERY_SET.has(st)) {
        readyForDeliveryCount++;
      }
      if (st === 'INSTALLATION') {
        installationOngoingCount++;
      }
      if (st === 'TESTING') {
        handoverCount++;
      }
      if (st === 'DESIGN' || st === 'CUSTOMER_APPROVAL') {
        pendingApprovalCount++;
      }
      if (p.paymentRequest?.status === 'REQUESTED') {
        crmPaymentRequestsCount++;
      }
    }

    // Merge legacy aliases so counts are unified across views
    const mfgCount = (statusDistribution['MANUFACTURING'] || 0) + (statusDistribution['PRODUCTION_IN_PROGRESS'] || 0);
    statusDistribution['MANUFACTURING'] = mfgCount;
    statusDistribution['PRODUCTION_IN_PROGRESS'] = mfgCount;

    const dispatchCount = (statusDistribution['DISPATCH'] || 0) + (statusDistribution['MATERIAL_DISPATCHED'] || 0);
    statusDistribution['DISPATCH'] = dispatchCount;
    statusDistribution['MATERIAL_DISPATCHED'] = dispatchCount;

    let messagesSentCount = 0;
    let messagesFailedCount = 0;
    for (const m of messageStatusAgg) {
      if (m._id === 'SENT' || m._id === 'DELIVERED' || m._id === 'READ') {
        messagesSentCount += m.count;
      } else if (m._id === 'FAILED') {
        messagesFailedCount += m.count;
      }
    }

    const updatesDueTodayProjects: any[] = [];
    const updatesTomorrowProjects: any[] = [];
    const updatesNext7DaysProjects: any[] = [];

    for (const p of upcomingAutomationProjects) {
      if (!p.nextUpdateAt) {
        updatesDueTodayProjects.push(p);
      } else {
        const dt = new Date(p.nextUpdateAt);
        if (dt <= endOfToday) {
          updatesDueTodayProjects.push(p);
        } else if (dt >= startOfTomorrow && dt <= endOfTomorrow) {
          updatesTomorrowProjects.push(p);
        } else if (dt > endOfTomorrow && dt <= in7Days) {
          updatesNext7DaysProjects.push(p);
        }
      }
    }

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
    const isLogisticsTL = isTlUser(req.user);

    let bdmFilter: any = {};
    let customerFilter: any = {};

    if (isBDM) {
      bdmFilter = { bdmId: req.user?._id };
      customerFilter = { bdmId: req.user?._id };
    } else if (isLogisticsTL) {
      const tlRegex = getTlRegexForUser(req.user);
      if (tlRegex) {
        const assignedCusts = await Customer.find({
          $or: [
            { assignedTl: tlRegex },
            { assignedTlId: req.user?._id },
            { assignedEmployee: tlRegex },
          ],
        }).select('_id').lean();
        const custIds = assignedCusts.map((c) => c._id);
        bdmFilter = {
          $or: [
            { assignedTl: tlRegex },
            { assignedEmployee: tlRegex },
            { customerId: { $in: custIds } },
          ],
        };
        customerFilter = {
          $or: [
            { assignedTl: tlRegex },
            { assignedTlId: req.user?._id },
            { assignedEmployee: tlRegex },
          ],
        };
      }
    }

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
      googleMapsLink: p.googleMapsLink || (p.customerId as any)?.googleMapsLink,
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

    const findCardProjects = (filter: any, sort: any = { createdAt: -1 }) =>
      Project.find(filter)
        .select(
          'projectId projectName projectStatus paymentStatus orderValue advanceAmount totalPaid balanceAmount liftModel siteAddress googleMapsLink customerId whatsappGroupId nextUpdateAt paymentRequest advancePercentage createdAt'
        )
        .populate('customerId', 'fullName phoneNumber whatsappNumber email googleMapsLink whatsappOptIn')
        .sort(sort)
        .lean();

    switch (type) {
      case 'totalCustomers': {
        title = 'Total Customers';
        subtitle = 'All registered and verified elevator customers';
        itemType = 'customer';
        const [customers, projectCounts] = await Promise.all([
          Customer.find({ ...customerFilter })
            .select('fullName phoneNumber whatsappNumber email city state address googleMapsLink customerType whatsappOptIn leadSource bdmPhone createdAt')
            .sort({ createdAt: -1 })
            .lean(),
          Project.aggregate([
            { $match: { ...bdmFilter } },
            { $group: { _id: '$customerId', count: { $sum: 1 } } },
          ]),
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
          googleMapsLink: c.googleMapsLink,
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
        const projects = await findCardProjects({ ...bdmFilter });
        items = projects.map(formatProject);
        break;
      }

      case 'activeProjects': {
        title = 'Active Projects';
        subtitle = 'Orders confirmed & active in the 4-month elevator manufacturing and installation cycle';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
        });
        items = projects.map(formatProject);
        break;
      }

      case 'projectsAwaitingPayment':
      case 'awaitingPayment': {
        title = 'Projects Awaiting Payment';
        subtitle = 'Projects with outstanding customer balance or pending milestone payment';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          paymentStatus: { $in: ['PENDING', 'PARTIAL_PAID'] },
        });
        items = projects.map(formatProject);
        break;
      }

      case 'projectsInManufacturing':
      case 'manufacturing': {
        title = 'Projects in Manufacturing';
        subtitle = 'Factory fabrication stage: shaft fabrication, motor assembly & panel wiring';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: { $in: ['MANUFACTURING', 'PRODUCTION_IN_PROGRESS'] },
        });
        items = projects.map(formatProject);
        break;
      }

      case 'projectsReadyForDelivery':
      case 'readyForDelivery': {
        title = 'Projects Ready for Delivery';
        subtitle = 'QC passed, dispatched, or in transit to customer site';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: { $in: ['QUALITY_CHECK', 'DISPATCH', 'MATERIAL_DISPATCHED', 'MATERIAL_IN_TRANSIT', 'DELIVERY', 'MATERIAL_DELIVERY'] },
        });
        items = projects.map(formatProject);
        break;
      }

      case 'installationOngoing':
      case 'installation': {
        title = 'Installation Ongoing Projects';
        subtitle = 'On-site shaft rigging, guide rail alignment, cabin erection & electrical wiring';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: 'INSTALLATION',
        });
        items = projects.map(formatProject);
        break;
      }

      case 'handoverCount':
      case 'handover': {
        title = 'Handover & Testing Projects';
        subtitle = 'Safety inspection, load testing, commissioning & final handover to client';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: 'TESTING',
        });
        items = projects.map(formatProject);
        break;
      }

      case 'whatsappUpdatesDueToday':
      case 'updatesDueToday':
      case 'upcoming_today': {
        title = "WhatsApp Updates Due Today";
        subtitle = "Active projects scheduled for automated or manual WhatsApp group dispatch today";
        itemType = 'project';
        const projects = await findCardProjects(
          {
            ...bdmFilter,
            automationEnabled: true,
            whatsappGroupId: { $exists: true, $ne: '' },
            projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
            $or: [
              { nextUpdateAt: { $lte: endOfToday } },
              { nextUpdateAt: { $exists: false } },
              { nextUpdateAt: null },
            ],
          },
          { nextUpdateAt: 1 }
        );
        items = projects.map(formatProject);
        break;
      }

      case 'upcoming_tomorrow': {
        title = "WhatsApp Updates Due Tomorrow";
        subtitle = "Projects scheduled for customer WhatsApp group dispatch in next 24 hours";
        itemType = 'project';
        const projects = await findCardProjects(
          {
            ...bdmFilter,
            automationEnabled: true,
            whatsappGroupId: { $exists: true, $ne: '' },
            projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
            nextUpdateAt: { $gte: startOfTomorrow, $lte: endOfTomorrow },
          },
          { nextUpdateAt: 1 }
        );
        items = projects.map(formatProject);
        break;
      }

      case 'upcoming_next_7_days': {
        title = "WhatsApp Updates Due Next 7 Days";
        subtitle = "Projects scheduled for customer WhatsApp group dispatch over the upcoming week";
        itemType = 'project';
        const projects = await findCardProjects(
          {
            ...bdmFilter,
            automationEnabled: true,
            whatsappGroupId: { $exists: true, $ne: '' },
            projectStatus: { $nin: ['COMPLETED', 'CANCELLED', 'ON_HOLD'] },
            nextUpdateAt: { $gt: endOfTomorrow, $lte: in7Days },
          },
          { nextUpdateAt: 1 }
        );
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
          .limit(100)
          .lean();
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
          .limit(100)
          .lean();
        items = messages;
        break;
      }

      case 'pendingApprovals':
      case 'pendingApprovalCount': {
        title = 'Pending Approvals (Drawing & Cabin)';
        subtitle = 'Elevator projects waiting for design or customer approval confirmation';
        itemType = 'project';
        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: { $in: ['DESIGN', 'CUSTOMER_APPROVAL'] },
        });
        items = projects.map(formatProject);
        break;
      }

      case 'crmPaymentRequests':
      case 'crmPaymentRequestsCount': {
        title = 'CRM Payment Requests';
        subtitle = 'Milestone collection requests initiated by CRM awaiting accountant recording';
        itemType = 'project';
        const projects = await findCardProjects(
          {
            ...bdmFilter,
            'paymentRequest.status': 'REQUESTED',
          },
          { 'paymentRequest.requestedAt': -1 }
        );
        items = projects.map(formatProject);
        break;
      }

      case 'stage': {
        const stageStr = typeof stage === 'string' ? stage : '';
        const STAGE_LABELS: Record<string, string> = {
          PAYMENT_RECEIVED: 'Advance Payment Received',
          SITE_MEASUREMENT: 'Site Visit',
          DESIGN: 'Drawing and Cabin',
          CUSTOMER_APPROVAL: 'Drawing and Cabin Design Approval',
          ENGINEERING: 'Production Payment',
          MANUFACTURING: 'Production in progress',
          PRODUCTION_IN_PROGRESS: 'Production in progress',
          QUALITY_CHECK: 'Readiness Payment',
          DISPATCH: 'Material ready to Dispatch',
          MATERIAL_DISPATCHED: 'Material ready to Dispatch',
          MATERIAL_IN_TRANSIT: 'Material in transit',
          DELIVERY: 'Pre Site Visit',
          MATERIAL_DELIVERY: 'Material Delivered',
          INSTALLATION: 'Installation in Progress',
          TESTING: 'Handover - Payment Pending',
          COMPLETED: 'Project Completed',
          ON_HOLD: 'On Hold',
          CANCELLED: 'Cancelled',
        };
        const stageLabel = STAGE_LABELS[stageStr] || stageStr.replace(/_/g, ' ');
        title = `${stageLabel} Projects`;
        subtitle = `Elevator projects currently situated in ${stageLabel} stage`;
        itemType = 'project';
        let statusQuery: any = stageStr;
        if (stageStr === 'MANUFACTURING' || stageStr === 'PRODUCTION_IN_PROGRESS') {
          statusQuery = { $in: ['MANUFACTURING', 'PRODUCTION_IN_PROGRESS'] };
        } else if (stageStr === 'DISPATCH' || stageStr === 'MATERIAL_DISPATCHED') {
          statusQuery = { $in: ['DISPATCH', 'MATERIAL_DISPATCHED'] };
        }

        const projects = await findCardProjects({
          ...bdmFilter,
          projectStatus: statusQuery,
        });
        items = projects.map(formatProject);
        break;
      }

      default: {
        title = 'Projects List';
        subtitle = 'All elevator installation projects';
        itemType = 'project';
        const projects = await findCardProjects({ ...bdmFilter });
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

