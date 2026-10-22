import { Router, Response } from 'express';
import { Reminder } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';

export const reminderRouter = Router();

reminderRouter.use(authenticate);

/**
 * GET /api/reminders
 * Fetch all reminders for the logged-in user
 */
reminderRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const query: any = { userId: req.user?._id };
    
    if (status) {
      query.status = status;
    }

    const reminders = await Reminder.find(query)
      .sort({ dueAt: 1 })
      .populate('relatedProjectId', 'projectId projectName')
      .lean();

    return res.json({ success: true, data: reminders });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/reminders/due
 * Fetch reminders that are currently due and pending
 */
reminderRouter.get('/due', async (req: AuthRequest, res: Response) => {
  try {
    const reminders = await Reminder.find({
      userId: req.user?._id,
      status: 'PENDING',
      dueAt: { $lte: new Date() }
    })
      .sort({ dueAt: 1 })
      .populate('relatedProjectId', 'projectId projectName')
      .lean();

    return res.json({ success: true, data: reminders });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders
 * Create a new reminder
 */
reminderRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, notes, dueAt, relatedProjectId } = req.body;

    if (!title || !dueAt) {
      return res.status(400).json({ success: false, message: 'Title and dueAt are required' });
    }

    const reminder = new Reminder({
      userId: req.user?._id,
      title,
      notes,
      dueAt: new Date(dueAt),
      relatedProjectId: relatedProjectId || undefined,
    });

    await reminder.save();
    return res.status(201).json({ success: true, data: reminder });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/reminders/:id/dismiss
 * Dismiss a reminder
 */
reminderRouter.patch('/:id/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user?._id });
    
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }

    reminder.status = 'DISMISSED';
    await reminder.save();

    return res.json({ success: true, data: reminder });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reminders/check
 * Trigger immediate execution of schedule date reminder check (CRM, Admin, Connected Bot)
 */
reminderRouter.post('/check', async (req: AuthRequest, res: Response) => {
  try {
    const { checkScheduleDateReminders } = await import('../services/scheduler/schedulerService');
    await checkScheduleDateReminders();
    return res.json({ success: true, message: 'Schedule date reminders checked and dispatched successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

