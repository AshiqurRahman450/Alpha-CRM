import { Router, Response } from 'express';
import { WhatsAppTemplate } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { TEMPLATES } from '../scripts/seed';

export const templateRouter = Router();

export async function autoSyncTimelineTemplates() {
  try {
    const allowedNames = TEMPLATES.map((t) => t.templateName);
    // Remove obsolete templates that are no longer in TEMPLATES
    await WhatsAppTemplate.deleteMany({ templateName: { $nin: allowedNames } });

    for (const t of TEMPLATES) {
      const existing = await WhatsAppTemplate.findOne({ templateName: t.templateName });
      if (existing) {
        existing.displayName = t.displayName;
        existing.stageMapping = t.stageMapping;
        existing.category = t.category;
        existing.bodyText = t.bodyText;
        existing.variablesList = t.variablesList;
        existing.templateStatus = 'APPROVED';
        existing.metaTemplateId = `META_TMPL_${t.templateName}`;
        await existing.save();
        console.log(`[Templates] Auto-synced template ${t.templateName} ("${t.displayName}")`);
      } else {
        await WhatsAppTemplate.create({
          templateName: t.templateName,
          displayName: t.displayName,
          stageMapping: t.stageMapping,
          category: t.category,
          bodyText: t.bodyText,
          variablesList: t.variablesList,
          templateStatus: 'APPROVED',
          templateLanguage: 'en_US',
          metaTemplateId: `META_TMPL_${t.templateName}`,
        });
        console.log(`[Templates] Created template ${t.templateName} ("${t.displayName}")`);
      }
    }
  } catch (err: any) {
    console.warn('[Templates] Auto-sync templates notice:', err.message);
  }
}

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
 * POST /api/templates/sync-timeline-stages
 * Renames and syncs all WhatsApp message templates with Project Execution Timeline stage names
 */
templateRouter.post('/sync-timeline-stages', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await autoSyncTimelineTemplates();
    const templates = await WhatsAppTemplate.find().sort({ templateName: 1 });
    return res.json({
      success: true,
      message: `Successfully synchronized WhatsApp message templates with Project Execution Timeline stage names`,
      data: templates,
    });
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
templateRouter.put('/:id', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
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
