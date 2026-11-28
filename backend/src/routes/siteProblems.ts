import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { SiteProblem, Customer, Project } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';

export const siteProblemRouter = Router();

siteProblemRouter.use(authenticate);

export const PROBLEM_ASSIGNEES = ['Srinivasan (TL)', 'Sundaram', 'Bala', 'Maari'] as const;

export function normalizeProblemAssignee(raw?: string | null): string {
  if (!raw) return 'Sundaram';
  const val = String(raw).trim();
  if (/srinivasan|srini/i.test(val)) return 'Srinivasan (TL)';
  if (/sundaram|sundar/i.test(val)) return 'Sundaram';
  if (/\bbala\b/i.test(val) && !/balaji/i.test(val)) return 'Bala';
  if (/maari|mari|site\s*inspector/i.test(val)) return 'Maari';
  return 'Sundaram';
}

export function getAssigneeRegex(assignee: string): RegExp {
  const norm = normalizeProblemAssignee(assignee);
  if (norm === 'Srinivasan (TL)') return /srinivasan|srini/i;
  if (norm === 'Sundaram') return /sundaram|sundar/i;
  if (norm === 'Bala') return /^bala$/i;
  if (norm === 'Maari') return /maari|mari|site\s*inspector/i;
  return new RegExp(norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export function getLoggedInProblemAssignee(user: any): string | null {
  if (!user) return null;
  const role = String(user.role || '').toUpperCase();
  const name = String(user.name || '');
  const email = String(user.email || '');

  if (role === 'BDM' || /balaji/i.test(name) || /balaji/i.test(email)) return null;

  if (role === 'SITE_INSPECTOR' || /maari|siteinspector/i.test(name) || /maari|siteinspector/i.test(email)) {
    return 'Maari';
  }
  if (/srinivasan|srini/i.test(role) || /srinivasan|srini/i.test(name) || /srinivasan|srini/i.test(email)) {
    return 'Srinivasan (TL)';
  }
  if (/sundaram|sundar/i.test(role) || /sundaram|sundar/i.test(name) || /sundaram|sundar/i.test(email)) {
    return 'Sundaram';
  }
  if (/\bbala\b/i.test(role) || /\bbala\b/i.test(name) || /\bbala\b/i.test(email) || email.startsWith('bala@')) {
    return 'Bala';
  }
  return null;
}

export function isSundaramUser(user: any): boolean {
  return getLoggedInProblemAssignee(user) === 'Sundaram';
}

export function canAccessSiteProblems(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (['ADMIN', 'CRM', 'LOGISTICS', 'LOGISTICS_TL', 'SITE_INSPECTOR', 'TECHNICAL_MANAGER', 'TECHNICAL_LEAD'].includes(role)) {
    return true;
  }
  return Boolean(getLoggedInProblemAssignee(user));
}

/**
 * GET /api/site-problems
 * Returns site/post-handover lift problems and counts.
 * - For Srinivasan (TL), Sundaram, or Bala: returns problems assigned to them.
 * - For Maari (SITE_INSPECTOR): returns problems assigned to Maari OR reported by Maari.
 * - For CRM / Admin / Logistics: returns all problems (with optional ?assignedTo= filter).
 */
siteProblemRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessSiteProblems(req.user)) {
      return res.json({
        success: true,
        count: 0,
        stats: { total: 0, assigned: 0, finished: 0, byAssignee: {} },
        data: [],
      });
    }

    const { status, search, assignedTo: queryAssignee } = req.query;
    const loggedInAssignee = getLoggedInProblemAssignee(req.user);
    const isMaari = String(req.user?.role || '').toUpperCase() === 'SITE_INSPECTOR' || loggedInAssignee === 'Maari';

    const scopeCondition: any = {};
    if (loggedInAssignee && !isMaari) {
      scopeCondition.assignedTo = getAssigneeRegex(loggedInAssignee);
    } else if (isMaari) {
      if (queryAssignee && typeof queryAssignee === 'string' && queryAssignee !== 'ALL') {
        scopeCondition.assignedTo = getAssigneeRegex(queryAssignee);
      } else {
        const maariOr: any[] = [{ assignedTo: getAssigneeRegex('Maari') }];
        if (req.user?._id) {
          maariOr.push({ reportedBy: req.user._id });
        }
        maariOr.push({ reportedByRole: 'SITE_INSPECTOR' });
        scopeCondition.$or = maariOr;
      }
    } else if (queryAssignee && typeof queryAssignee === 'string' && queryAssignee !== 'ALL') {
      scopeCondition.assignedTo = getAssigneeRegex(queryAssignee);
    }

    const query: any = { ...scopeCondition };

    if (status && typeof status === 'string' && ['ASSIGNED', 'FINISHED'].includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const searchOr = [
        { customerName: regex },
        { customerCode: regex },
        { customerPhone: regex },
        { projectName: regex },
        { projectCode: regex },
        { problemDescription: regex },
        { problemId: regex },
        { assignedTo: regex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const [problems, allScopedProblems] = await Promise.all([
      SiteProblem.find(query).sort({ status: 1, createdAt: -1 }).lean(),
      SiteProblem.find(scopeCondition).select('status assignedTo').lean(),
    ]);

    const totalCount = allScopedProblems.length;
    const assignedCount = allScopedProblems.filter((p) => p.status === 'ASSIGNED').length;
    const finishedCount = allScopedProblems.filter((p) => p.status === 'FINISHED').length;

    const byAssignee: Record<string, { total: number; assigned: number; finished: number }> = {
      'Srinivasan (TL)': { total: 0, assigned: 0, finished: 0 },
      Sundaram: { total: 0, assigned: 0, finished: 0 },
      Bala: { total: 0, assigned: 0, finished: 0 },
      Maari: { total: 0, assigned: 0, finished: 0 },
    };

    for (const p of allScopedProblems) {
      const norm = normalizeProblemAssignee(p.assignedTo);
      if (!byAssignee[norm]) {
        byAssignee[norm] = { total: 0, assigned: 0, finished: 0 };
      }
      byAssignee[norm].total++;
      if (p.status === 'FINISHED') {
        byAssignee[norm].finished++;
      } else {
        byAssignee[norm].assigned++;
      }
    }

    return res.json({
      success: true,
      count: problems.length,
      activeAssigneeScope: loggedInAssignee,
      stats: {
        total: totalCount,
        assigned: assignedCount,
        finished: finishedCount,
        byAssignee,
      },
      data: problems,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/site-problems
 * Creates a new site problem or post-handover customer callback lift issue
 * and assigns it to Srinivasan (TL), Sundaram, Bala, or Maari.
 */
siteProblemRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessSiteProblems(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign or submit site/lift problems.',
      });
    }

    const {
      customerId,
      customerName: rawCustomerName,
      customerPhone: rawCustomerPhone,
      projectId,
      projectName: rawProjectName,
      problemDescription,
      images,
      assignedTo: rawAssignedTo,
      problemType: rawProblemType,
    } = req.body;

    if (!problemDescription || !String(problemDescription).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the lift issue / site problem description.',
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

    const finalCustomerName = (customerDoc?.fullName || rawCustomerName || projectDoc?.projectName || '').trim();
    if (!finalCustomerName) {
      return res.status(400).json({
        success: false,
        message: 'Please select or enter the customer name.',
      });
    }

    const imageList: string[] = Array.isArray(images)
      ? images.filter((img) => typeof img === 'string' && img.trim().length > 0)
      : [];

    const canonicalAssignee = normalizeProblemAssignee(rawAssignedTo);
    const isInspector = String(req.user?.role || '').toUpperCase() === 'SITE_INSPECTOR';
    const resolvedProblemType =
      rawProblemType === 'SITE_INSPECTION' || (isInspector && !rawProblemType)
        ? 'SITE_INSPECTION'
        : 'POST_HANDOVER_CALLBACK';

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
      problemType: resolvedProblemType,
      customerId: customerDoc?._id || projectDoc?.customerId || undefined,
      customerName: finalCustomerName,
      customerCode: customerDoc?.customerId || projectDoc?.customerCode || undefined,
      customerPhone:
        rawCustomerPhone ||
        customerDoc?.phoneNumber ||
        customerDoc?.whatsappNumber ||
        undefined,
      projectId: projectDoc?._id || undefined,
      projectName: projectDoc?.projectName || (rawProjectName ? String(rawProjectName).trim() : undefined),
      projectCode: projectDoc?.projectId || undefined,
      siteAddress: projectDoc?.siteAddress || customerDoc?.address || customerDoc?.city || undefined,
      problemDescription: String(problemDescription).trim(),
      images: imageList,
      status: 'ASSIGNED',
      assignedTo: canonicalAssignee,
      reportedBy: req.user?._id,
      reportedByName: req.user?.name || (isInspector ? 'Maari' : 'CRM'),
      reportedByRole: req.user?.role || 'CRM',
    });

    return res.status(201).json({
      success: true,
      message: `Lift problem ${problemId} for ${finalCustomerName} assigned to ${canonicalAssignee}!`,
      data: created,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/site-problems/:id/assign
 * CRM / Admin reassigns a problem to Srinivasan (TL), Sundaram, Bala, or Maari
 */
siteProblemRouter.patch('/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessSiteProblems(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const problem = await SiteProblem.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem record not found' });
    }
    const canonicalAssignee = normalizeProblemAssignee(req.body.assignedTo);
    problem.assignedTo = canonicalAssignee;
    await problem.save();

    return res.json({
      success: true,
      message: `Problem ${problem.problemId} assigned to ${canonicalAssignee}!`,
      data: problem,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/site-problems/:id/finish
 * Assigned role (Srinivasan, Sundaram, Bala, Maari) or CRM/Admin marks a problem as FINISHED (or reopens to ASSIGNED)
 */
siteProblemRouter.patch('/:id/finish', async (req: AuthRequest, res: Response) => {
  try {
    if (!canAccessSiteProblems(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this problem.',
      });
    }

    const problem = await SiteProblem.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const { status, resolutionNotes } = req.body;
    const nextStatus = status === 'ASSIGNED' ? 'ASSIGNED' : 'FINISHED';
    const loggedInAssignee = getLoggedInProblemAssignee(req.user);

    problem.status = nextStatus;
    if (nextStatus === 'FINISHED') {
      problem.finishedAt = new Date();
      problem.finishedByName = loggedInAssignee || req.user?.name || problem.assignedTo || 'Team Lead';
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
          ? `Problem ${problem.problemId} marked as Finished by ${problem.finishedByName}!`
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
    if (!canAccessSiteProblems(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const deleted = await SiteProblem.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Site problem not found' });
    }

    return res.json({
      success: true,
      message: `Problem ${deleted.problemId} deleted`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
