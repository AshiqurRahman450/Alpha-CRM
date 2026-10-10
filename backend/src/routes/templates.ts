import { Router, Response } from 'express';
import { WhatsAppTemplate } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const templateRouter = Router();

templateRouter.use(authenticate);

/**
 * GET /api/templates
 */
templateRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const templates = await WhatsAppTemplate.find().sort({ templateName: 1 });
    return res.json({ success: true, count: templates.length, data: templates });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/templates
 */
templateRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      templateName,
      displayName,
      stageMapping,
      templateLanguage = 'en_US',
      templateStatus = 'APPROVED',
      metaTemplateId,
      bodyText,
      variablesList = [],
    } = req.body;

    if (!templateName || !displayName || !bodyText) {
      return res.status(400).json({ success: false, message: 'Template name, display name, and body text are required' });
    }

    const created = await WhatsAppTemplate.create({
      templateName: templateName.trim().toUpperCase(),
      displayName: displayName.trim(),
      stageMapping: stageMapping ? stageMapping.trim().toUpperCase() : undefined,
      templateLanguage,
      templateStatus,
      metaTemplateId,
      bodyText,
      variablesList,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/templates/:id/status
 */
templateRouter.patch('/:id/status', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await WhatsAppTemplate.findByIdAndUpdate(
      req.params.id,
      { templateStatus: status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/templates/:id
 */
templateRouter.put('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await WhatsAppTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
