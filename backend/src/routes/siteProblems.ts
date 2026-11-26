import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { SiteProblem, Customer, Project } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';

export const siteProblemRouter = Router();

siteProblemRouter.use(authenticate);

export function isSundaramUser(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (role === 'BDM') return false;
  const name = String(user.name || '');
  const email = String(user.email || '');
  return /sundaram|sundar/i.test(name) || /sundaram|sundar/i.test(email) || /sundaram|sundar/i.test(role);
}

export function isSiteInspectorOrSundaram(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  return role === 'SITE_INSPECTOR' || isSundaramUser(user);
}

/**
 * GET /api/site-problems
 * Returns site problems and counts (assigned vs finished by Sundaram).
 * Strictly visible only to Sundaram role and the Site Inspector role.
 */
siteProblemRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!isSiteInspectorOrSundaram(req.user)) {
      return res.json({
        success: true,
        count: 0,
        stats: { total: 0, assigned: 0, finished: 0 },
        data: [],
      });
    }

    const { status, search } = req.query;
    const query: any = {};

    if (status && typeof status === 'string' && ['ASSIGNED', 'FINISHED'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { customerName: regex },
        { customerCode: regex },
        { projectName: regex },
        { projectCode: regex },
        { problemDescription: regex },
        { problemId: regex },
      ];
    }

    const [problems, totalCount, assignedCount, finishedCount] = await Promise.all([
      SiteProblem.find(query).sort({ status: 1, createdAt: -1 }).lean(),
      SiteProblem.countDocuments({}),
      SiteProblem.countDocuments({ status: 'ASSIGNED' }),
      SiteProblem.countDocuments({ status: 'FINISHED' }),
    ]);

    return res.json({
      success: true,
      count: problems.length,
      stats: {
        total: totalCount,
        assigned: assignedCount,
        finished: finishedCount,
      },
      data: problems,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/site-problems
 * Creates a new site problem report with uploaded issue image(s), problem text, and customer
 * and assigns it directly to Sundaram.
 */
siteProblemRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!isSiteInspectorOrSundaram(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only Site Inspector or Sundaram role can submit site problems.',
      });
    }

    const {
      customerId,
      customerName: rawCustomerName,
      projectId,
      projectName: rawProjectName,
      problemDescription,
      images,
    } = req.body;

    if (!problemDescription || !String(problemDescription).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the site problem description.',
      });
    }

    let customerDoc: any = null;
    if (customerId && Types.ObjectId.isValid(String(customerId))) {
      customerDoc = await Customer.findById(customerId).lean();
    }

    let projectDoc: any = null;
    if (projectId && Types.ObjectId.isValid(String(projectId))) {
      projectDoc = await Project.findById(projectId).lean();
    } else if (customerDoc) {
      projectDoc = await Project.findOne({ customerId: customerDoc._id }).sort({ createdAt: -1 }).lean();
    }

    const finalCustomerName = (customerDoc?.fullName || rawCustomerName || '').trim();
    if (!finalCustomerName) {
      return res.status(400).json({
        success: false,
        message: 'Please select or enter the customer name.',
      });
    }

    const imageList: string[] = Array.isArray(images)
      ? images.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : [];

    if (imageList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one image of the site problem.',
      });
    }

    // Generate next problemId (ISS-001, ISS-002, ...)
    const lastProblem = await SiteProblem.findOne().sort({ createdAt: -1 }).select('problemId').lean();
    let nextNum = 1;
    if (lastProblem?.problemId) {
      const m = String(lastProblem.problemId).match(/(\d+)/);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    let problemId = `ISS-${String(nextNum).padStart(3, '0')}`;
    while (await SiteProblem.exists({ problemId })) {
      nextNum++;
      problemId = `ISS-${String(nextNum).padStart(3, '0')}`;
    }

    const created = await SiteProblem.create({
      problemId,
      customerId: customerDoc?._id || undefined,
      customerName: finalCustomerName,
      customerCode: customerDoc?.customerId || undefined,
      customerPhone: customerDoc?.phoneNumber || customerDoc?.whatsappNumber || undefined,
      projectId: projectDoc?._id || undefined,
      projectName: projectDoc?.projectName || (rawProjectName ? String(rawProjectName).trim() : undefined),
      projectCode: projectDoc?.projectId || undefined,
      siteAddress: projectDoc?.siteAddress || customerDoc?.address || customerDoc?.city || undefined,
      problemDescription: String(problemDescription).trim(),
      images: imageList,
      status: 'ASSIGNED',
      assignedTo: 'Sundaram',
      reportedBy: req.user?._id,
      reportedByName: req.user?.name || 'Site Inspector',
    });

    return res.status(201).json({
      success: true,
      message: `Site problem ${problemId} sent to Sundaram!`,
      data: created,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/site-problems/:id/finish
 * Sundaram marks a site problem as FINISHED (or reopens to ASSIGNED)
 */
siteProblemRouter.patch('/:id/finish', async (req: AuthRequest, res: Response) => {
  try {
    if (!isSundaramUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only Sundaram can mark assigned site problems as finished.',
      });
    }

    const problem = await SiteProblem.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Site problem not found' });
    }

    const { status, resolutionNotes } = req.body;
    const nextStatus = status === 'ASSIGNED' ? 'ASSIGNED' : 'FINISHED';

    problem.status = nextStatus;
    if (nextStatus === 'FINISHED') {
      problem.finishedAt = new Date();
      problem.finishedByName = req.user?.name || 'Sundaram';
      if (resolutionNotes !== undefined) {
        problem.resolutionNotes = String(resolutionNotes || '').trim();
      }
    } else {
      problem.finishedAt = undefined;
      problem.finishedByName = undefined;
    }

    await problem.save();

    return res.json({
      success: true,
      message:
        nextStatus === 'FINISHED'
          ? `Problem ${problem.problemId} marked as Finished by Sundaram!`
          : `Problem ${problem.problemId} reopened as Assigned`,
      data: problem,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/site-problems/:id
 */
siteProblemRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isSiteInspectorOrSundaram(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const deleted = await SiteProblem.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Site problem not found' });
    }

    return res.json({
      success: true,
      message: `Site problem ${deleted.problemId} deleted`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
