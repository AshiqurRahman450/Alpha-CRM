import { Router, Response } from 'express';
import {
  Project,
  Customer,
  Payment,
  WhatsAppChannel,
  WhatsAppMessage,
  ProjectActivity,
  ProjectStatus,
} from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logProjectActivity } from '../services/activity/activityService';
import {
  calculateNextUpdateDate,
  triggerAdvancePaymentReminderForCRM,
  dismissScheduleDateRemindersForProject,
} from '../services/scheduler/schedulerService';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, req.params.id + '-drawing-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

export const projectRouter = Router();

projectRouter.use(authenticate);

/**
 * GET /api/projects
 */
projectRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, paymentStatus, search, updateDue, employee } = req.query;
    const query: any = {};

    if (req.user?.role === 'BDM') {
      query.bdmId = req.user._id;
    }

    if (status && typeof status === 'string') {
      query.projectStatus = status;
    }

    if (paymentStatus && typeof paymentStatus === 'string') {
      query.paymentStatus = paymentStatus;
    }

    if (employee && typeof employee === 'string') {
      query.assignedEmployee = employee;
    }

    if (updateDue === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query.nextUpdateAt = { $lte: endOfDay };
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { projectName: searchRegex },
        { projectId: searchRegex },
        { liftModel: searchRegex },
        { siteAddress: searchRegex },
      ];
    }

    const projects = await Project.find(query).populate('customerId').sort({ createdAt: -1 });
    return res.json({ success: true, count: projects.length, data: projects });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects
 */
projectRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerId,
      projectName,
      siteAddress,
      liftModel,
      liftType,
      numberOfFloors,
      shaftModel,
      liftAmount = 0,
      shaftAmount = 0,
      orderValue,
      advancePercentage = 30,
      productionPaymentPercent = 40,
      readinessNotificationPercent = 20,
      dispatchMaterialsPercent = 5,
      afterInstallationPercent = 5,
      expectedDeliveryDate,
      assignedEmployee,
      projectManager,
      updateFrequencyDays = 20,
      whatsappGroupId,
      notes,
    } = req.body;

    if (!customerId || !projectName || !siteAddress || !orderValue || !expectedDeliveryDate) {
      return res.status(400).json({
        success: false,
        message: 'Customer, project name, site address, order value, and expected delivery date are required',
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const count = await Project.countDocuments();
    const projectId = `ALP-${String(count + 1).padStart(3, '0')}`;

    const numOrderValue = Number(orderValue);
    const numAdvPct = Number(advancePercentage);
    const advanceAmount = Math.round((numOrderValue * numAdvPct) / 100);
    const balanceAmount = numOrderValue - advanceAmount;

    // Next update date defaulted to frequency days from now
    const nextUpdate = calculateNextUpdateDate(Number(updateFrequencyDays), new Date());

    const newProject = await Project.create({
      projectId,
      customerId: customer._id,
      customerCode: customer.customerId,
      projectName: projectName.trim(),
      siteAddress: siteAddress.trim(),
      liftModel: liftModel || 'Hydraulic Home Series',
      liftType: liftType || 'Home Lift',
      numberOfFloors,
      shaftModel: shaftModel?.trim(),
      liftAmount: Number(liftAmount),
      shaftAmount: Number(shaftAmount),
      orderValue: numOrderValue,
      advancePercentage: numAdvPct,
      productionPaymentPercent: Number(productionPaymentPercent),
      readinessNotificationPercent: Number(readinessNotificationPercent),
      dispatchMaterialsPercent: Number(dispatchMaterialsPercent),
      afterInstallationPercent: Number(afterInstallationPercent),
      advanceAmount,
      totalPaid: advanceAmount, // by default initial 30% advance confirms order
      balanceAmount,
      paymentStatus: 'ADVANCE_PAID',
      orderDate: new Date(),
      expectedDeliveryDate: new Date(expectedDeliveryDate),
      projectStatus: 'PAYMENT_RECEIVED',
      assignedEmployee: assignedEmployee || req.user?.name,
      projectManager,
      notes,
      whatsappGroupId: whatsappGroupId ? whatsappGroupId.trim() : undefined,
      whatsappGroupName: whatsappGroupId ? `${projectName.trim()} — Alpha Updates` : undefined,
      automationEnabled: true,
      updateFrequencyDays: Number(updateFrequencyDays),
      nextUpdateAt: nextUpdate,
    });

    // Record initial 30% Advance Payment
    await Payment.create({
      projectId: newProject._id,
      projectCode: projectId,
      customerId: customer._id,
      customerName: customer.fullName,
      totalOrderValue: numOrderValue,
      advanceRequired: advanceAmount,
      amountPaid: advanceAmount,
      balanceAmount,
      paymentType: 'Booking Advance',
      paymentDate: new Date(),
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: `INIT-ADV-${projectId}`,
      paymentStatus: 'SUCCESS',
      receiptNumber: `REC-${projectId}-01`,
      notes: `Initial ${numAdvPct}% advance booking payment received`,
    });

    // Link WhatsApp Channel if provided
    if (whatsappGroupId) {
      await WhatsAppChannel.create({
        whatsappGroupId: whatsappGroupId.trim(),
        groupName: `${projectName.trim()} — Alpha Updates`,
        projectId: newProject._id,
        projectCode: projectId,
        customerId: customer._id,
        customerName: customer.fullName,
        groupStatus: 'ACTIVE',
        automationEnabled: true,
        updateFrequencyDays: Number(updateFrequencyDays),
        nextUpdateDate: nextUpdate,
        participants: [
          { phoneNumber: customer.phoneNumber, name: customer.fullName, role: 'MEMBER' },
        ],
      });
    }

    // Log Activity
    await logProjectActivity({
      projectId: newProject._id,
      projectCode: projectId,
      type: 'STATUS_CHANGE',
      description: `Project ${projectId} created. 30% advance received. Initial status set to PAYMENT_RECEIVED.`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.status(201).json({ success: true, data: newProject });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/projects/:id
 */
projectRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id).populate('customerId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const channel = await WhatsAppChannel.findOne({ projectId: project._id });
    const payments = await Payment.find({ projectId: project._id }).sort({ paymentDate: -1 });
    const messages = await WhatsAppMessage.find({ projectId: project._id }).sort({ createdAt: -1 });
    const activities = await ProjectActivity.find({ projectId: project._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        project,
        channel,
        payments,
        messages,
        activities,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/projects/:id
 */
projectRouter.put('/:id', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    Object.assign(project, req.body);

    // If orderValue or schedule percentages are modified, recalculate financials
    const orderVal = Number(project.orderValue) || 0;
    const advPct = Number(project.advancePercentage) || 0;
    project.advanceAmount = Math.round((orderVal * advPct) / 100);
    project.balanceAmount = Math.max(0, orderVal - (project.totalPaid || 0));

    if (project.totalPaid >= orderVal && orderVal > 0) {
      project.paymentStatus = 'FULLY_PAID';
    } else if (project.totalPaid >= project.advanceAmount && project.advanceAmount > 0) {
      project.paymentStatus = 'ADVANCE_PAID';
    } else if (project.totalPaid > 0) {
      project.paymentStatus = 'PARTIAL_PAID';
    } else {
      project.paymentStatus = 'PENDING';
    }

    await project.save();
    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/status
 */
projectRouter.patch('/:id/status', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM') {
      if (status !== 'CUSTOMER_APPROVAL') {
        if (status !== 'ENGINEERING' || project.projectStatus !== 'CUSTOMER_APPROVAL') {
          return res.status(403).json({ success: false, message: 'BDMs can only update the Drawing and Cabin Design Approval stage' });
        }
      }
      if (project.bdmId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
      }
    }

    const prevStatus = project.projectStatus;
    project.projectStatus = status as ProjectStatus;
    if (notes) {
      project.notes = notes;
    }
    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'STATUS_CHANGE',
      description: `Project status updated from ${prevStatus} to ${status}. ${notes ? `Note: ${notes}` : ''}`,
      userId: req.user?._id,
      userName: req.user?.name,
      metadata: { previousStatus: prevStatus, newStatus: status },
    });

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/stage-dates
 */
projectRouter.patch('/:id/stage-dates', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    const { stageKey, scheduleDate, executedDate } = req.body;
    if (!stageKey) {
      return res.status(400).json({ success: false, message: 'stageKey is required' });
    }

    if (req.user?.role === 'BDM' && stageKey !== 'CUSTOMER_APPROVAL') {
      return res.status(403).json({ success: false, message: 'BDMs can only update dates for the Drawing and Cabin Design Approval stage' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM' && project.bdmId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    if (!project.stageDates) {
      project.stageDates = new Map();
    }

    const currentDates = project.stageDates.get(stageKey) || {};
    
    if (scheduleDate !== undefined) {
      currentDates.scheduleDate = scheduleDate ? new Date(scheduleDate) : null;
    }
    
    if (executedDate !== undefined) {
      currentDates.executedDate = executedDate ? new Date(executedDate) : null;
    }

    project.stageDates.set(stageKey, currentDates);
    await project.save();

    if (stageKey === 'PAYMENT_RECEIVED' && executedDate) {
      await triggerAdvancePaymentReminderForCRM(project._id);
    } else if (stageKey === 'SITE_MEASUREMENT' && scheduleDate) {
      await dismissScheduleDateRemindersForProject(project._id);
    }

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/projects/:id/stage-dates-bulk
 */
projectRouter.patch('/:id/stage-dates-bulk', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'updates must be an array' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (req.user?.role === 'BDM' && project.bdmId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    if (!project.stageDates) {
      project.stageDates = new Map();
    }

    for (const update of updates) {
      const { stageKey, scheduleDate, executedDate } = update;
      
      if (req.user?.role === 'BDM' && stageKey !== 'CUSTOMER_APPROVAL') {
        continue;
      }

      const currentDates = project.stageDates.get(stageKey) || {};
      
      if (scheduleDate !== undefined) {
        currentDates.scheduleDate = scheduleDate ? new Date(scheduleDate) : null;
      }
      
      if (executedDate !== undefined) {
        currentDates.executedDate = executedDate ? new Date(executedDate) : null;
      }

      project.stageDates.set(stageKey, currentDates);
    }
    
    await project.save();

    const hasPaymentExecuted = updates.some((u: any) => u.stageKey === 'PAYMENT_RECEIVED' && u.executedDate);
    const hasSiteVisitScheduled = updates.some((u: any) => u.stageKey === 'SITE_MEASUREMENT' && u.scheduleDate);

    if (hasPaymentExecuted) {
      await triggerAdvancePaymentReminderForCRM(project._id);
    }
    if (hasSiteVisitScheduled) {
      await dismissScheduleDateRemindersForProject(project._id);
    }

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/notes
 */
projectRouter.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { note } = req.body;
    if (!note) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'NOTE',
      description: note,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, message: 'Note added successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/projects/:id/drawing
 */
projectRouter.post('/:id/drawing', authorize('ADMIN', 'CRM', 'MANAGER'), upload.single('drawing'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    project.drawingUrl = `/uploads/${req.file.filename}`;

    // Automatically set DESIGN schedule & executed dates to today
    if (!project.stageDates) project.stageDates = new Map();
    const currentDates = project.stageDates.get('DESIGN') || {};
    currentDates.scheduleDate = new Date();
    currentDates.executedDate = new Date();
    project.stageDates.set('DESIGN', currentDates);

    const prevStatus = project.projectStatus;
    // Advance to next stage (CUSTOMER_APPROVAL)
    project.projectStatus = 'CUSTOMER_APPROVAL';

    await project.save();

    await logProjectActivity({
      projectId: project._id,
      projectCode: project.projectId,
      type: 'DOCUMENT_UPLOAD',
      description: `Drawing uploaded. DESIGN stage auto-completed. Status advanced from ${prevStatus} to CUSTOMER_APPROVAL.`,
      userId: req.user?._id,
      userName: req.user?.name,
    });

    return res.json({ success: true, data: project });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
