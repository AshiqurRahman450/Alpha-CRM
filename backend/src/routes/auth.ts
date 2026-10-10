import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  return res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone,
    },
  });
});

/**
 * GET /api/auth/bdms
 * Returns a list of BDMs for assignment
 */
authRouter.get('/bdms', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bdms = await User.find({ role: 'BDM', isActive: true }).select('name email role');
    return res.json({ success: true, data: bdms });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
