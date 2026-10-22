import { Router, Response } from 'express';
import { SystemSettings, User } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp';
import { processDueWhatsAppUpdates } from '../services/scheduler/schedulerService';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

/**
 * GET /api/settings
 */
settingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let settings = await SystemSettings.findOne({ key: 'GLOBAL_CONFIG' });
    if (!settings) {
      settings = await SystemSettings.create({ key: 'GLOBAL_CONFIG' });
    }

    const health = await whatsappService.validateConfiguration();

    return res.json({
      success: true,
      data: settings,
      metaDiagnostics: health,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/settings
 */
settingsRouter.put('/', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyName,
      companyAddress,
      supportPhone,
      supportEmail,
      automationEnabled,
      defaultUpdateFrequencyDays,
      defaultUpdateTime,
      timezone,
      allowEmployeeOverride,
      pilotModeEnabled,
      whatsappTestMode,
      metaApiVersion,
      metaPhoneNumberId,
      metaWabaId,
      metaAppId,
    } = req.body;

    let settings = await SystemSettings.findOne({ key: 'GLOBAL_CONFIG' });
    if (!settings) {
      settings = new SystemSettings({ key: 'GLOBAL_CONFIG' });
    }

    if (companyName) settings.companyName = companyName;
    if (companyAddress) settings.companyAddress = companyAddress;
    if (supportPhone) settings.supportPhone = supportPhone;
    if (supportEmail) settings.supportEmail = supportEmail;
    if (automationEnabled !== undefined) settings.automationEnabled = !!automationEnabled;
    if (defaultUpdateFrequencyDays) settings.defaultUpdateFrequencyDays = Number(defaultUpdateFrequencyDays);
    if (defaultUpdateTime) settings.defaultUpdateTime = defaultUpdateTime;
    if (timezone) settings.timezone = timezone;
    if (allowEmployeeOverride !== undefined) settings.allowEmployeeOverride = !!allowEmployeeOverride;
    if (pilotModeEnabled !== undefined) settings.pilotModeEnabled = !!pilotModeEnabled;
    if (whatsappTestMode !== undefined) settings.whatsappTestMode = !!whatsappTestMode;
    if (metaApiVersion) settings.metaApiVersion = metaApiVersion;
    if (metaPhoneNumberId) settings.metaPhoneNumberId = metaPhoneNumberId;
    if (metaWabaId) settings.metaWabaId = metaWabaId;
    if (metaAppId) settings.metaAppId = metaAppId;

    settings.updatedBy = req.user?.name;
    await settings.save();

    await whatsappService.refreshConfig();

    return res.json({ success: true, data: settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/settings/trigger-scheduler
 * Manually trigger the automation cycle for testing
 */
settingsRouter.post('/trigger-scheduler', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await processDueWhatsAppUpdates();
    return res.json({
      success: true,
      message: `Triggered automation cycle: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/settings/users
 */
settingsRouter.get('/users', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
